"""Validated document uploads with AES-GCM and RSA-wrapped document keys."""

import io
import logging
import os
import zipfile
from pathlib import Path
from uuid import UUID, uuid4

import olefile
from app.crypto.encryption import encrypt_document, decrypt_document
from app.crypto.key_manager import load_private_key
from app.cryptoKeys.router import get_private_key_settings
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from urllib.parse import quote
from sqlalchemy import text

from app.database import get_db
from app.rbac.dependency import require_permission
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse


BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIRECTORY / ".env", override=False)

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_FILE_SIZE = 20 * 1024 * 1024


def get_upload_directory():
    configured_path = os.getenv("DOCUMENT_STORAGE_DIR", "./private_uploads").strip()
    if not configured_path:
        raise ApiError(503, "DOCUMENT_STORAGE_DIR cannot be empty")
    directory = Path(configured_path).expanduser()
    if not directory.is_absolute():
        directory = BACKEND_DIRECTORY / directory
    return directory.resolve()


MIME_TYPES = {
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": (
        "application/vnd.openxmlformats-officedocument."
        "wordprocessingml.document"
    ),
}


async def read_upload(file: UploadFile) -> bytes:
    data = await file.read(MAX_FILE_SIZE + 1)
    if not data:
        raise ApiError(400, "The uploaded file is empty")
    if len(data) > MAX_FILE_SIZE:
        raise ApiError(413, "Maximum file size is 20 MiB")
    return data


def validate_document(filename: str, data: bytes):
    filename = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if (
        not filename
        or len(filename) > 255
        or any(ord(character) < 32 or ord(character) == 127 for character in filename)
    ):
        raise ApiError(400, "Invalid filename")

    extension = Path(filename).suffix.lower()
    if extension not in MIME_TYPES:
        raise ApiError(415, "Only TXT, PDF, DOC, and DOCX files are supported")

    if extension == ".txt":
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ApiError(415, "TXT files must use UTF-8 encoding") from error

    elif extension == ".pdf":
        if not data.startswith(b"%PDF-"):
            raise ApiError(415, "File does not appear to be a PDF")

    elif extension == ".docx":
        try:
            # Inspect entry names without extracting/decompressing the archive.
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = set(archive.namelist())
                if not {"[Content_Types].xml", "word/document.xml"}.issubset(names):
                    raise ApiError(415, "File does not appear to be a DOCX")
                if any(name.lower() == "word/vbaproject.bin" for name in names):
                    raise ApiError(415, "Macro-enabled DOCX files are not supported")
        except (zipfile.BadZipFile, OSError, ValueError) as error:
            raise ApiError(415, "Invalid DOCX file") from error

    elif extension == ".doc":
        try:
            with olefile.OleFileIO(io.BytesIO(data)) as document:
                valid = document.exists("WordDocument") and (
                    document.exists("0Table") or document.exists("1Table")
                )
                if not valid:
                    raise ApiError(415, "File does not appear to be a Word DOC")
        except (olefile.OleFileError, OSError, ValueError) as error:
            raise ApiError(415, "Invalid DOC file") from error

    return filename, MIME_TYPES[extension]


async def validate_classification(classification: str, db):
    result = await db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM document_classifications
                WHERE name = :classification
            )
        """),
        {"classification": classification},
    )
    if not result.scalar_one():
        raise ApiError(400, "Invalid document classification")


async def get_wrapping_key(db):
    result = await db.execute(text("""
        SELECT id, public_key_pem, secret_ref
        FROM crypto_keys
        WHERE owner_id IS NULL
          AND purpose = 'KEY_WRAPPING'
          AND algorithm = 'RSA-OAEP-SHA256'
          AND status = 'ACTIVE'
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR SHARE
    """))
    key = result.mappings().first()
    if key is None:
        raise ApiError(503, "No active document wrapping key is configured")

    # Uploads need only the public key, but avoid knowingly encrypting new
    # documents when the private-key file needed for recovery is missing.
    secret_ref = key["secret_ref"]
    try:
        private_path = Path(secret_ref) if secret_ref else None
        available = (
            private_path is not None
            and private_path.is_absolute()
            and await run_in_threadpool(private_path.is_file)
        )
    except (OSError, TypeError, ValueError):
        available = False
    if not available:
        logger.error("Private key file is unavailable for wrapping key %s", key["id"])
        raise ApiError(503, "The configured wrapping private key file is unavailable")
    return key


def write_encrypted_file(path: Path, ciphertext: bytes):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(ciphertext)
            output.flush()
            os.fsync(output.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise


async def insert_document(values: dict, db):
    result = await db.execute(
        text("""
            INSERT INTO documents (
                id, owner_id, filename, storage_path, mime_type,
                file_size_bytes, classification, encryption_algorithm,
                encryption_nonce, authentication_tag, encrypted_dek,
                wrapping_key_id, content_hash
            )
            VALUES (
                :id, :owner_id, :filename, :storage_path, :mime_type,
                :file_size_bytes, :classification, 'AES-256-GCM',
                :encryption_nonce, :authentication_tag, :encrypted_dek,
                :wrapping_key_id, :content_hash
            )
            RETURNING created_at
        """),
        values,
    )
    return result.scalar_one()


async def insert_upload_audit(request_id, user_id, document_id, db):
    await db.execute(
        text("""
            INSERT INTO audit_events (
                request_id, user_id, document_id, action, status
            )
            VALUES (
                :request_id, :user_id, :document_id, 'documents.upload', 'SUCCESS'
            )
        """),
        {"request_id": request_id, "user_id": user_id, "document_id": document_id},
    )


@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    classification: str = Form("INTERNAL"),
    user=Depends(require_permission("documents.upload")),
    db=Depends(get_db),
):
    document_id = uuid4()
    request_id = uuid4()
    file_written = False
    commit_attempted = False
    storage_path = None

    try:
        user_id = user["id"]
        storage_path = get_upload_directory() / f"{document_id}.enc"
        data = await read_upload(file)
        filename, mime_type = await run_in_threadpool(
            validate_document, file.filename or "", data
        )
        classification = classification.strip().upper()
        await validate_classification(classification, db)
        wrapping_key = await get_wrapping_key(db)
        encrypted = await run_in_threadpool(
            encrypt_document, data, wrapping_key["public_key_pem"], document_id
        )
        file_size = len(data)
        del data

        await run_in_threadpool(
            write_encrypted_file, storage_path, encrypted["ciphertext"]
        )
        file_written = True
        del encrypted["ciphertext"]

        created_at = await insert_document(
            {
                "id": document_id,
                "owner_id": user_id,
                "filename": filename,
                "storage_path": str(storage_path),
                "mime_type": mime_type,
                "file_size_bytes": file_size,
                "classification": classification,
                "encryption_nonce": encrypted["nonce"],
                "authentication_tag": encrypted["authentication_tag"],
                "encrypted_dek": encrypted["encrypted_dek"],
                "wrapping_key_id": wrapping_key["id"],
                "content_hash": encrypted["content_hash"],
            },
            db,
        )
        await insert_upload_audit(request_id, user_id, document_id, db)
        commit_attempted = True
        await db.commit()

    except BaseException as error:
        try:
            await db.rollback()
        except Exception:
            logger.exception("Failed to roll back document upload")
        if file_written and not commit_attempted:
            try:
                await run_in_threadpool(storage_path.unlink, missing_ok=True)
            except Exception:
                logger.exception("Could not clean up encrypted file %s", document_id)
        if not isinstance(error, Exception) or isinstance(error, ApiError):
            raise
        logger.exception("Document upload failed: %s", document_id)
        raise ApiError(500, "Document upload failed") from error
    finally:
        # Closing the temporary upload must not mask the transaction outcome.
        try:
            await file.close()
        except Exception:
            logger.exception("Could not close upload for document %s", document_id)

    return ApiResponse(
        201,
        {
            "id": str(document_id),
            "filename": filename,
            "mime_type": mime_type,
            "file_size_bytes": file_size,
            "classification": classification,
            "created_at": created_at.isoformat(),
        },
        "Document uploaded and encrypted successfully",
    )


@router.get("")
async def list_documents(
    user=Depends(require_permission("documents.read")), db=Depends(get_db),
):
    result = await db.execute(text("""
        SELECT id, filename, mime_type, file_size_bytes, classification, created_at
        FROM documents WHERE owner_id = :owner_id AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC
    """), {"owner_id": user["id"]})
    return ApiResponse(200, {"documents": [dict(row) for row in result.mappings().all()]})


def read_and_decrypt_document(document):
    # Only opaque UUID-named ciphertext files inside the configured storage root.
    expected = get_upload_directory() / f"{document['id']}.enc"
    supplied = Path(document["storage_path"])
    stored = supplied.resolve()
    if stored != expected or supplied.is_symlink():
        raise ValueError("Invalid document storage location")
    if not stored.is_file() or stored.stat().st_size > MAX_FILE_SIZE:
        raise ValueError("Encrypted document unavailable")
    passphrase, directory = get_private_key_settings()
    private_path = Path(document["secret_ref"]).resolve()
    if private_path.parent != directory:
        raise ValueError("Invalid key storage location")
    private_key = load_private_key(private_path.read_bytes(), passphrase)
    return decrypt_document(stored.read_bytes(), document, private_key)


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    user=Depends(require_permission("documents.download")), db=Depends(get_db),
):
    # Constrain the SQL by owner before looking up storage paths or key material.
    result = await db.execute(text("""
        SELECT d.*, k.secret_ref FROM documents d
        JOIN crypto_keys k ON k.id = d.wrapping_key_id
        WHERE d.id = :document_id AND d.owner_id = :owner_id AND d.deleted_at IS NULL
          AND k.purpose = 'KEY_WRAPPING' AND k.algorithm = 'RSA-OAEP-SHA256'
          AND k.status = 'ACTIVE' AND k.revoked_at IS NULL
          AND (k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP)
    """), {"document_id": document_id, "owner_id": user["id"]})
    document = result.mappings().first()
    if document is None:
        raise ApiError(404, "Document unavailable")
    try:
        plaintext = await run_in_threadpool(read_and_decrypt_document, document)
        await db.execute(text("""
            INSERT INTO audit_events (request_id, user_id, document_id, action, status)
            VALUES (:request_id, :user_id, :document_id, 'documents.download', 'SUCCESS')
        """), {"request_id": uuid4(), "user_id": user["id"], "document_id": document_id})
        await db.commit()
    except Exception as error:
        await db.rollback()
        logger.error("Document download failed for %s (%s)", document_id, type(error).__name__)
        raise ApiError(503, "Document could not be downloaded") from error
    return Response(
        content=plaintext, media_type=document["mime_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": "attachment; filename*=UTF-8''" + quote(document["filename"], safe=""),
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        },
    )
