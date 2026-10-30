import re
import urllib.parse

def content_disposition_header(filename: str, disposition: str = "attachment") -> str:
    clean_ascii = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    encoded = urllib.parse.quote(filename, safe='')
    return f'{disposition}; filename="{clean_ascii}"; filename*=UTF-8\'\'{encoded}'

import io
import logging
import os
import zipfile
from pathlib import Path
from typing import Any, Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone

import olefile
from Cryptodome.Cipher import AES, PKCS1_OAEP
from Cryptodome.Hash import SHA256
from Cryptodome.PublicKey import RSA
from Cryptodome.Random import get_random_bytes
from fastapi import APIRouter, Depends, File, Form, Header, Request, UploadFile, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text

from app.auth.router import verify_jwt
from app.database import get_db
from app.rbac.dependency import require_permission
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse
from app.utils.FormatRequest import read_body, parse_uuid
from app.signatures.crypto import decrypt_document, verify_signature
from app.risk.schemas import RiskContext
from app.risk.service import evaluate_risk, consume_step_up_token
from app.audit.service import log_audit_event
from app.search.service import prepare_index, save_upload_index


BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]

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
        raise ApiError(415, "Only PDF, DOC, and DOCX files are supported")

    if extension == ".pdf":
        if not data.startswith(b"%PDF-"):
            raise ApiError(415, "File does not appear to be a PDF")

    elif extension == ".docx":
        try:
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
        except (OSError, ValueError) as error:
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
        SELECT id, public_key_pem, secret_ref, purpose, algorithm
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


def import_wrapping_public_key(public_key_pem):
    try:
        if isinstance(public_key_pem, bytes):
            public_key_pem = public_key_pem.decode("ascii")
        if not isinstance(public_key_pem, str):
            raise ValueError("Public PEM must be text")

        clean_pem = (
            public_key_pem.replace("\\r\\n", "\n")
            .replace("\\n", "\n")
            .replace("\r\n", "\n")
            .strip()
        )
        header = "-----BEGIN PUBLIC KEY-----"
        footer = "-----END PUBLIC KEY-----"
        if not (clean_pem.startswith(header) and clean_pem.endswith(footer)):
            raise ValueError("Expected a public-key PEM")
        body = "".join(clean_pem[len(header):-len(footer)].split())
        clean_pem = header + "\n" + "\n".join(
            body[index:index + 64] for index in range(0, len(body), 64)
        ) + "\n" + footer

        public_key = RSA.import_key(clean_pem)
        if public_key.has_private() or public_key.size_in_bits() < 2048:
            raise ValueError("Expected an RSA public key of at least 2048 bits")
        return public_key
    except (ValueError, TypeError, IndexError) as error:
        logger.error("Configured document wrapping public key is invalid")
        raise ApiError(503, "The configured RSA wrapping public key is invalid") from error


def encrypt_document(data: bytes, public_key_pem: str, document_id):
    public_key = import_wrapping_public_key(public_key_pem)
    aes_key = get_random_bytes(32)
    nonce = get_random_bytes(12)
    cipher = AES.new(aes_key, AES.MODE_GCM, nonce=nonce, mac_len=16)
    cipher.update(str(document_id).encode("utf-8"))
    ciphertext, authentication_tag = cipher.encrypt_and_digest(data)
    rsa_cipher = PKCS1_OAEP.new(public_key, hashAlgo=SHA256)
    return {
        "ciphertext": ciphertext,
        "nonce": nonce,
        "authentication_tag": authentication_tag,
        "encrypted_dek": rsa_cipher.encrypt(aes_key),
        "content_hash": SHA256.new(data).hexdigest(),
    }


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


async def authorized_document(db, document_id: UUID, user: dict, required_permission: str = ""):
    result = await db.execute(
        text("SELECT * FROM documents WHERE id = :id AND deleted_at IS NULL FOR SHARE"),
        {"id": document_id}
    )
    doc = result.mappings().first()
    if not doc:
        raise ApiError(404, "Document not found")

    user_id = user["id"]
    if doc["owner_id"] == user_id:
        return doc, "OWNER"

    # Auditors, Admins, and signature verification callers can verify any active document
    if user.get("role") in ("SECURITY_AUDITOR", "ADMIN") or required_permission == "VERIFY":
        return doc, "VERIFY"

    # Check active access grant
    access_res = await db.execute(
        text("""
            SELECT id, permission, expires_at, revoked_at
            FROM document_access
            WHERE document_id = :doc_id AND user_id = :user_id
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY created_at DESC
            LIMIT 1
            FOR SHARE
        """),
        {"doc_id": document_id, "user_id": user_id}
    )
    grant = access_res.mappings().first()
    if grant:
        if required_permission == "DOWNLOAD" and grant["permission"] == "READ":
            raise ApiError(403, "Access grant only permits READ, not DOWNLOAD")
        return doc, grant["permission"]

    # Check if a revoked or expired grant exists to give specific security error
    status_res = await db.execute(
        text("""
            SELECT revoked_at, expires_at
            FROM document_access
            WHERE document_id = :doc_id AND user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"doc_id": document_id, "user_id": user_id}
    )
    past_grant = status_res.mappings().first()
    if past_grant:
        if past_grant["revoked_at"] is not None:
            raise ApiError(403, "Access to this document has been revoked")
        now = datetime.now(timezone.utc)
        if past_grant["expires_at"] is not None and past_grant["expires_at"] <= now:
            raise ApiError(403, "Access to this document has expired")
            # Room access is a fallback after the existing direct-share checks.
    if required_permission in ("", "READ", "DOWNLOAD"):
        room_access = await db.execute(
            text("""
                SELECT 1
                FROM room_documents rd
                JOIN room_members rm ON rm.room_id = rd.room_id
                WHERE rd.document_id = :doc_id
                  AND rd.shared_by = :owner_id
                  AND rm.user_id = :user_id
                LIMIT 1
            """),
            {
                "doc_id": document_id,
                "owner_id": doc["owner_id"],
                "user_id": user_id,
            },
        )

        if room_access.scalar() is not None:
            return doc, "DOWNLOAD"

    raise ApiError(404, "Document not found or access denied")


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
    storage_path: Optional[Path] = None

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
        prepared_search = await prepare_index(db, data, filename)
        del data

        await run_in_threadpool(
            write_encrypted_file, storage_path, encrypted["ciphertext"]
        )
        file_written = True
        del encrypted["ciphertext"]

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
        )
        created_at = result.scalar_one()
        search_status = await save_upload_index(db, document_id, prepared_search)
        del prepared_search

        # Mark before commit: an uncertain commit outcome must never delete the file.
        # The audit helper also commits; persist the document/index first.
        commit_attempted = True
        await db.commit()

        await log_audit_event(
            db,
            action="documents.upload",
            status="SUCCESS",
            user_id=user_id,
            document_id=document_id,
            request_id=request_id,
            metadata={"filename": filename, "classification": classification, "file_size": file_size}
        )

    except BaseException as error:
        try:
            await db.rollback()
        except Exception:
            logger.exception("Failed to roll back document upload")
        if file_written and not commit_attempted and storage_path is not None:
            try:
                await run_in_threadpool(storage_path.unlink, missing_ok=True)
            except Exception:
                logger.exception("Could not clean up encrypted file %s", document_id)
        if not isinstance(error, Exception) or isinstance(error, ApiError):
            raise
        logger.exception("Document upload failed: %s", document_id)
        raise ApiError(500, "Document upload failed") from error
    finally:
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
            "search_status": search_status,
        },
        "Document uploaded and encrypted successfully",
    )


@router.get("")
@router.get("/")
async def list_documents(
    user=Depends(require_permission("documents.read", "documents.verify")),
    db=Depends(get_db),
):
    user_id = user["id"]
    is_auditor = user.get("role") in ("SECURITY_AUDITOR", "ADMIN")
    result = await db.execute(
        text("""
            SELECT d.id, d.owner_id, d.filename, d.mime_type, d.file_size_bytes,
                   d.classification, d.content_hash, d.created_at, d.updated_at,
                   u.email AS owner_email,
                   (d.owner_id = :user_id) AS is_owner,
                   COALESCE(da.permission, CASE WHEN d.owner_id = :user_id THEN 'OWNER' WHEN :is_auditor = TRUE THEN 'VERIFY' ELSE NULL END) AS access_permission,
                   (SELECT COUNT(*) FROM document_signatures ds WHERE ds.document_id = d.id) AS signature_count
            FROM documents d
            JOIN users u ON u.id = d.owner_id
            LEFT JOIN document_access da ON da.document_id = d.id
                AND da.user_id = :user_id
                AND da.revoked_at IS NULL
                AND (da.expires_at IS NULL OR da.expires_at > CURRENT_TIMESTAMP)
            WHERE d.deleted_at IS NULL
              AND (:is_auditor = TRUE OR d.owner_id = :user_id OR da.id IS NOT NULL)
            ORDER BY d.created_at DESC
        """),
        {"user_id": user_id, "is_auditor": is_auditor},
    )
    docs = []
    for row in result.mappings().all():
        item = dict(row)
        item["id"] = str(item["id"])
        item["permission"] = item.get("access_permission")
        item["created_at"] = item["created_at"].isoformat() if item["created_at"] else None
        item["updated_at"] = item["updated_at"].isoformat() if item["updated_at"] else None
        docs.append(item)
    return ApiResponse(200, docs, "Documents retrieved successfully")


@router.get("/shares/summary")
async def get_shares_summary(
    user=Depends(verify_jwt),
    db=Depends(get_db),
):
    is_admin_or_auditor = user.get("role") in ("ADMIN", "SECURITY_AUDITOR")
    query_str = """
        SELECT
            COUNT(*) FILTER (WHERE da.revoked_at IS NOT NULL) AS revoked_count,
            COUNT(*) FILTER (WHERE da.revoked_at IS NULL AND da.expires_at IS NOT NULL AND da.expires_at <= CURRENT_TIMESTAMP) AS expired_count,
            COUNT(*) FILTER (WHERE da.revoked_at IS NULL AND (da.expires_at IS NULL OR da.expires_at > CURRENT_TIMESTAMP)) AS active_count,
            COUNT(*) AS total_shares
        FROM document_access da
        JOIN documents d ON d.id = da.document_id
        WHERE d.deleted_at IS NULL
    """
    params = {}
    if not is_admin_or_auditor:
        query_str += " AND d.owner_id = :user_id"
        params["user_id"] = user["id"]

    res = await db.execute(text(query_str), params)
    row = res.mappings().first()

    return ApiResponse(
        200,
        {
            "active_shares": int(row["active_count"] or 0),
            "expired_shares": int(row["expired_count"] or 0),
            "revoked_shares": int(row["revoked_count"] or 0),
            "total_shares": int(row["total_shares"] or 0),
            "scope": "SYSTEM_WIDE" if is_admin_or_auditor else "USER_OWNED",
        },
        "Document shares summary retrieved successfully",
    )


@router.get("/{document_id}")
async def get_document_metadata(
    document_id: str,
    user=Depends(require_permission("documents.read")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    doc, permission = await authorized_document(db, doc_uuid, user)

    owner_res = await db.execute(text("SELECT email FROM users WHERE id = :id"), {"id": doc["owner_id"]})
    owner_email = owner_res.scalar() or "Unknown"

    sig_res = await db.execute(
        text("SELECT COUNT(*) FROM document_signatures WHERE document_id = :id"),
        {"id": doc_uuid}
    )
    signature_count = sig_res.scalar() or 0

    return ApiResponse(
        200,
        {
            "id": str(doc["id"]),
            "owner_id": doc["owner_id"],
            "owner_email": owner_email,
            "filename": doc["filename"],
            "mime_type": doc["mime_type"],
            "file_size_bytes": doc["file_size_bytes"],
            "classification": doc["classification"],
            "content_hash": doc["content_hash"],
            "permission": permission,
            "access_permission": permission,
            "signature_count": signature_count,
            "created_at": doc["created_at"].isoformat() if doc["created_at"] else None,
            "updated_at": doc["updated_at"].isoformat() if doc["updated_at"] else None,
        },
        "Document metadata retrieved successfully",
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    request: Request,
    step_up_token: Optional[str] = Header(None, alias="X-Step-Up-Token"),
    user=Depends(require_permission("documents.download")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    request_id = uuid4()
    doc, permission = await authorized_document(db, doc_uuid, user, required_permission="DOWNLOAD")

    # Adaptive Risk Engine check
    context = RiskContext(
        user_id=user["id"],
        user_role=user["role"],
        action="documents.download",
        document_id=doc_uuid,
        document_classification=doc["classification"],
        timestamp=datetime.now(timezone.utc),
        ip_address=request.client.host if request.client else "127.0.0.1",
        user_agent=request.headers.get("user-agent"),
        session_id=UUID(str(user["session_id"])) if user.get("session_id") else None,
    )

    risk_result, plain_otp = await evaluate_risk(context, db, request_id=request_id)

    if risk_result.decision == "BLOCK":
        await log_audit_event(
            db,
            action="documents.download",
            status="DENIED",
            user_id=user["id"],
            document_id=doc_uuid,
            risk_event_id=risk_result.event_id,
            request_id=request_id,
            metadata={"reason": risk_result.reason, "risk_score": risk_result.risk_score}
        )
        raise ApiError(403, f"Operation blocked by security policy: {risk_result.reason}")

    if risk_result.decision == "STEP_UP_AUTH":
        # Check if caller supplied step-up authorization token
        if step_up_token:
            await consume_step_up_token(db, user["id"], step_up_token)
        else:
            await log_audit_event(
                db,
                action="documents.download",
                status="CHALLENGED",
                user_id=user["id"],
                document_id=doc_uuid,
                risk_event_id=risk_result.event_id,
                request_id=request_id,
                metadata={"challenge_id": str(risk_result.step_up_challenge_id), "risk_score": risk_result.risk_score}
            )
            challenge_err_data: dict[str, Any] = {
                "step_up_required": True,
                "challenge_id": str(risk_result.step_up_challenge_id),
                "risk_score": risk_result.risk_score,
                "risk_level": risk_result.risk_level,
                "reason": risk_result.reason,
            }
            if plain_otp:
                challenge_err_data["challenge_otp"] = plain_otp
            raise ApiError(403, "Step-up authentication required for high-risk access", errors=challenge_err_data)

    # Fetch wrapping key
    wrapping_res = await db.execute(
        text("SELECT * FROM crypto_keys WHERE id = :id FOR SHARE"),
        {"id": doc["wrapping_key_id"]}
    )
    wrapping_key = wrapping_res.mappings().first()
    if not wrapping_key:
        raise ApiError(503, "Document wrapping key unavailable")

    try:
        plaintext = await run_in_threadpool(
            decrypt_document,
            dict(doc),
            dict(wrapping_key),
            get_upload_directory(),
        )
    except Exception as error:
        logger.error("Cryptographic or integrity failure decrypting document %s: %s", doc_uuid, error)
        await log_audit_event(
            db,
            action="documents.integrity_failure",
            status="FAILURE",
            user_id=user["id"],
            document_id=doc_uuid,
            request_id=request_id,
            metadata={"error": str(error), "expected_hash": doc["content_hash"]}
        )
        raise ApiError(409, "Document failed cryptographic integrity validation (tampering detected)") from error

    await log_audit_event(
        db,
        action="documents.download",
        status="SUCCESS",
        user_id=user["id"],
        document_id=doc_uuid,
        risk_event_id=risk_result.event_id,
        request_id=request_id,
        metadata={"filename": doc["filename"], "file_size": len(plaintext)}
    )

    return Response(
        content=plaintext,
        media_type=doc["mime_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": content_disposition_header(doc["filename"], "attachment"),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
        },
    )


@router.get("/{document_id}/view")
async def view_document(
    document_id: str,
    request: Request,
    step_up_token: Optional[str] = Header(None, alias="X-Step-Up-Token"),
    user=Depends(require_permission("documents.read")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    request_id = uuid4()
    doc, permission = await authorized_document(db, doc_uuid, user, required_permission="READ")

    # Adaptive Risk Engine check
    context = RiskContext(
        user_id=user["id"],
        user_role=user["role"],
        action="documents.read",
        document_id=doc_uuid,
        document_classification=doc["classification"],
        timestamp=datetime.now(timezone.utc),
        ip_address=request.client.host if request.client else "127.0.0.1",
        user_agent=request.headers.get("user-agent"),
        session_id=UUID(str(user["session_id"])) if user.get("session_id") else None,
    )

    risk_result, plain_otp = await evaluate_risk(context, db, request_id=request_id)

    if risk_result.decision == "BLOCK":
        await log_audit_event(
            db,
            action="documents.read",
            status="DENIED",
            user_id=user["id"],
            document_id=doc_uuid,
            risk_event_id=risk_result.event_id,
            request_id=request_id,
            metadata={"reason": risk_result.reason, "risk_score": risk_result.risk_score}
        )
        raise ApiError(403, f"Operation blocked by security policy: {risk_result.reason}")

    if risk_result.decision == "STEP_UP_AUTH":
        if step_up_token:
            await consume_step_up_token(db, user["id"], step_up_token)
        else:
            await log_audit_event(
                db,
                action="documents.read",
                status="CHALLENGED",
                user_id=user["id"],
                document_id=doc_uuid,
                risk_event_id=risk_result.event_id,
                request_id=request_id,
                metadata={"challenge_id": str(risk_result.step_up_challenge_id), "risk_score": risk_result.risk_score}
            )
            challenge_err_data: dict[str, Any] = {
                "step_up_required": True,
                "challenge_id": str(risk_result.step_up_challenge_id),
                "risk_score": risk_result.risk_score,
                "risk_level": risk_result.risk_level,
                "reason": risk_result.reason,
            }
            if plain_otp:
                challenge_err_data["challenge_otp"] = plain_otp
            raise ApiError(403, "Step-up authentication required for high-risk access", errors=challenge_err_data)

    # Fetch wrapping key
    wrapping_res = await db.execute(
        text("SELECT * FROM crypto_keys WHERE id = :id FOR SHARE"),
        {"id": doc["wrapping_key_id"]}
    )
    wrapping_key = wrapping_res.mappings().first()
    if not wrapping_key:
        raise ApiError(503, "Document wrapping key unavailable")

    try:
        plaintext = await run_in_threadpool(
            decrypt_document,
            dict(doc),
            dict(wrapping_key),
            get_upload_directory(),
        )
    except Exception as error:
        logger.error("Cryptographic or integrity failure decrypting document %s: %s", doc_uuid, error)
        await log_audit_event(
            db,
            action="documents.integrity_failure",
            status="FAILURE",
            user_id=user["id"],
            document_id=doc_uuid,
            request_id=request_id,
            metadata={"error": str(error), "expected_hash": doc["content_hash"]}
        )
        raise ApiError(409, "Document failed cryptographic integrity validation (tampering detected)") from error

    await log_audit_event(
        db,
        action="documents.read",
        status="SUCCESS",
        user_id=user["id"],
        document_id=doc_uuid,
        risk_event_id=risk_result.event_id,
        request_id=request_id,
        metadata={"filename": doc["filename"], "file_size": len(plaintext)}
    )

    return Response(
        content=plaintext,
        media_type=doc["mime_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": content_disposition_header(doc["filename"], "inline"),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
        },
    )


@router.get("/{document_id}/encrypted")
async def download_encrypted_document(
    document_id: str,
    user=Depends(require_permission("documents.read", "documents.verify")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    doc, permission = await authorized_document(db, doc_uuid, user, required_permission="VERIFY")

    storage_path = get_upload_directory() / f"{doc_uuid}.enc"
    if not storage_path.is_file():
        raise ApiError(404, "Encrypted file not found on storage")

    with open(storage_path, "rb") as f:
        ciphertext = f.read()

    await log_audit_event(
        db,
        action="documents.download_encrypted",
        status="SUCCESS",
        user_id=user["id"],
        document_id=doc_uuid,
        metadata={"filename": f"{doc['filename']}.enc", "file_size": len(ciphertext)},
    )

    return Response(
        content=ciphertext,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": content_disposition_header(f"{doc['filename']}.enc", "attachment"),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
        },
    )


@router.post("/{document_id}/verify")
async def verify_document(
    document_id: str,
    user=Depends(require_permission("documents.verify")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    doc, _ = await authorized_document(db, doc_uuid, user, required_permission="VERIFY")

    wrapping_res = await db.execute(
        text("SELECT * FROM crypto_keys WHERE id = :id FOR SHARE"),
        {"id": doc["wrapping_key_id"]}
    )
    wrapping_key = wrapping_res.mappings().first()
    if not wrapping_key:
        raise ApiError(503, "Document wrapping key unavailable")

    try:
        plaintext = await run_in_threadpool(
            decrypt_document,
            dict(doc),
            dict(wrapping_key),
            get_upload_directory(),
        )
        integrity_valid = True
    except Exception:
        integrity_valid = False
        plaintext = None

    signatures_res = await db.execute(
        text("""
            SELECT s.id, s.signer_id, s.signing_key_id, s.signed_at, s.signature,
                   s.signature_algorithm, s.signed_content_hash,
                   k.public_key_pem, k.status AS key_status, k.expires_at, k.revoked_at,
                   (k.status = 'ACTIVE' AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP)) AS key_usable_now
            FROM document_signatures s
            JOIN crypto_keys k ON k.id = s.signing_key_id
            WHERE s.document_id = :doc_id
            ORDER BY s.signed_at ASC
        """),
        {"doc_id": doc_uuid}
    )

    sigs = []
    for row in signatures_res.mappings().all():
        valid = False
        if integrity_valid and plaintext is not None:
            try:
                valid = await run_in_threadpool(
                    verify_signature,
                    row["public_key_pem"],
                    bytes(row["signature"]),
                    plaintext
                )
            except Exception:
                valid = False

        sigs.append({
            "id": str(row["id"]),
            "signer_id": row["signer_id"],
            "signing_key_id": str(row["signing_key_id"]),
            "signed_at": row["signed_at"].isoformat() if row["signed_at"] else None,
            "cryptographically_valid": valid,
            "key_status": row["key_status"],
            "key_usable_now": row["key_usable_now"],
        })

    await log_audit_event(
        db,
        action="documents.verify",
        status="SUCCESS" if integrity_valid else "FAILURE",
        user_id=user["id"],
        document_id=doc_uuid,
        metadata={"integrity_valid": integrity_valid, "signature_count": len(sigs)}
    )

    return ApiResponse(
        200,
        {
            "document_id": str(doc_uuid),
            "document_integrity_valid": integrity_valid,
            "content_hash": doc["content_hash"],
            "has_signatures": len(sigs) > 0,
            "signatures": sigs,
        },
        "Document verification complete",
    )


@router.post("/{document_id}/share", status_code=201)
async def share_document(
    document_id: str,
    request: Request,
    user=Depends(require_permission("documents.share")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    body = await read_body(request)

    recipient_email = body.get("recipient_email") or body.get("email")
    recipient_id = body.get("recipient_id") or body.get("user_id")
    permission = (body.get("permission") or "READ").upper()

    if permission not in ("READ", "DOWNLOAD"):
        raise ApiError(400, "Permission must be READ or DOWNLOAD")

    doc_res = await db.execute(
        text("SELECT id, owner_id FROM documents WHERE id = :id AND deleted_at IS NULL"),
        {"id": doc_uuid}
    )
    doc = doc_res.mappings().first()
    if not doc:
        raise ApiError(404, "Document not found")
    if doc["owner_id"] != user["id"]:
        raise ApiError(403, "Only the document owner can share this document")

    # Resolve recipient
    if recipient_id:
        try:
            rec_id_int = int(recipient_id)
        except (ValueError, TypeError):
            raise ApiError(400, "recipient_id must be a valid integer")
        user_res = await db.execute(
            text("SELECT id, email, is_active FROM users WHERE id = :id"),
            {"id": rec_id_int}
        )
    elif recipient_email:
        user_res = await db.execute(
            text("SELECT id, email, is_active FROM users WHERE lower(email) = :email"),
            {"email": str(recipient_email).strip().lower()}
        )
    else:
        raise ApiError(400, "recipient_email or recipient_id is required")

    recipient = user_res.mappings().first()
    if not recipient or not recipient["is_active"]:
        raise ApiError(404, "Recipient user not found or inactive")
    if recipient["id"] == user["id"]:
        raise ApiError(400, "Cannot share document with yourself")

    expires_at = None
    if body.get("expires_at"):
        try:
            expires_at = datetime.fromisoformat(str(body["expires_at"]).replace("Z", "+00:00"))
        except ValueError:
            raise ApiError(400, "Invalid expires_at format; use ISO-8601")

    # Revoke any existing active share for this document and recipient to avoid unique index violation
    await db.execute(
        text("""
            UPDATE document_access
            SET revoked_at = CURRENT_TIMESTAMP, revoked_by = :user_id
            WHERE document_id = :doc_id AND user_id = :recipient_id AND revoked_at IS NULL
        """),
        {"doc_id": doc_uuid, "recipient_id": recipient["id"], "user_id": user["id"]}
    )

    res = await db.execute(
        text("""
            INSERT INTO document_access (
                document_id, user_id, permission, granted_by, expires_at
            ) VALUES (
                :doc_id, :recipient_id, :permission, :granted_by, :expires_at
            )
            RETURNING id, created_at
        """),
        {
            "doc_id": doc_uuid,
            "recipient_id": recipient["id"],
            "permission": permission,
            "granted_by": user["id"],
            "expires_at": expires_at,
        }
    )
    access_row = res.mappings().first()
    if access_row is None:
        raise ApiError(500, "Could not create document access grant")

    await log_audit_event(
        db,
        action="documents.share",
        status="SUCCESS",
        user_id=user["id"],
        document_id=doc_uuid,
        metadata={"recipient_id": recipient["id"], "permission": permission, "expires_at": expires_at.isoformat() if expires_at else None}
    )
    await db.commit()

    return ApiResponse(
        201,
        {
            "id": access_row["id"],
            "document_id": str(doc_uuid),
            "recipient_id": recipient["id"],
            "recipient_email": recipient["email"],
            "permission": permission,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "created_at": access_row["created_at"].isoformat(),
        },
        "Document access granted successfully",
    )


@router.post("/{document_id}/revoke")
async def revoke_document_share(
    document_id: str,
    request: Request,
    user=Depends(require_permission("documents.revoke")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    body = await read_body(request)

    doc_res = await db.execute(
        text("SELECT id, owner_id FROM documents WHERE id = :id AND deleted_at IS NULL"),
        {"id": doc_uuid}
    )
    doc = doc_res.mappings().first()
    if not doc:
        raise ApiError(404, "Document not found")
    if doc["owner_id"] != user["id"]:
        raise ApiError(403, "Only the document owner can revoke document access")

    target_user_id = body.get("user_id") or body.get("recipient_id")
    access_id = body.get("access_id")

    if not target_user_id and not access_id:
        raise ApiError(400, "user_id or access_id is required")

    if target_user_id:
        try:
            target_id_int = int(target_user_id)
        except (ValueError, TypeError):
            raise ApiError(400, "user_id / recipient_id must be a valid integer")
        res = await db.execute(
            text("""
                UPDATE document_access
                SET revoked_at = CURRENT_TIMESTAMP, revoked_by = :user_id
                WHERE document_id = :doc_id AND user_id = :target_id AND revoked_at IS NULL
                RETURNING id
            """),
            {"doc_id": doc_uuid, "target_id": target_id_int, "user_id": user["id"]}
        )
    else:
        if access_id is None:
            raise ApiError(400, "access_id is required")
        try:
            access_id_int = int(access_id)
        except (ValueError, TypeError):
            raise ApiError(400, "access_id must be a valid integer")
        res = await db.execute(
            text("""
                UPDATE document_access
                SET revoked_at = CURRENT_TIMESTAMP, revoked_by = :user_id
                WHERE document_id = :doc_id AND id = :access_id AND revoked_at IS NULL
                RETURNING id
            """),
            {"doc_id": doc_uuid, "access_id": access_id_int, "user_id": user["id"]}
        )

    row = res.mappings().first()
    if not row:
        raise ApiError(404, "No active access grant found to revoke")

    await log_audit_event(
        db,
        action="documents.revoke",
        status="SUCCESS",
        user_id=user["id"],
        document_id=doc_uuid,
        metadata={"access_id": row["id"], "target_user_id": target_user_id}
    )
    await db.commit()

    return ApiResponse(200, {"access_id": row["id"], "revoked": True}, "Access revoked successfully")


@router.get("/{document_id}/shares")
async def list_document_shares(
    document_id: str,
    user=Depends(require_permission("documents.share")),
    db=Depends(get_db),
):
    doc_uuid = parse_uuid(document_id, "document_id")
    doc_res = await db.execute(
        text("SELECT id, owner_id FROM documents WHERE id = :id AND deleted_at IS NULL"),
        {"id": doc_uuid}
    )
    doc = doc_res.mappings().first()
    if not doc:
        raise ApiError(404, "Document not found")
    if doc["owner_id"] != user["id"]:
        raise ApiError(403, "Only the document owner can inspect shares")

    result = await db.execute(
        text("""
            SELECT da.id, da.document_id, da.user_id, da.permission, da.granted_by,
                   da.expires_at, da.revoked_at, da.created_at,
                   u.email AS recipient_email,
                   CASE
                       WHEN da.revoked_at IS NOT NULL THEN 'REVOKED'
                       WHEN da.expires_at IS NOT NULL AND da.expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED'
                       ELSE 'ACTIVE'
                   END AS status
            FROM document_access da
            JOIN users u ON u.id = da.user_id
            WHERE da.document_id = :doc_id
            ORDER BY da.created_at DESC
        """),
        {"doc_id": doc_uuid}
    )
    shares = []
    for row in result.mappings().all():
        item = dict(row)
        item["id"] = int(item["id"])
        item["document_id"] = str(item["document_id"])
        item["created_at"] = item["created_at"].isoformat() if item["created_at"] else None
        item["expires_at"] = item["expires_at"].isoformat() if item["expires_at"] else None
        item["revoked_at"] = item["revoked_at"].isoformat() if item["revoked_at"] else None
        shares.append(item)

    return ApiResponse(200, shares, "Document shares retrieved successfully")
