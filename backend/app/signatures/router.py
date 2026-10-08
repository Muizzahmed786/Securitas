import json
import logging
import os
from pathlib import Path
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Request, Response
from fastapi.concurrency import run_in_threadpool
from Cryptodome.Hash import SHA256
from sqlalchemy import text

from app.database import get_db
from app.rbac.dependency import require_permission
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse
from .crypto import ALGORITHM, decode_signature, decrypt_document, generate_key_pair, verify_signature

router = APIRouter()
logger = logging.getLogger(__name__)
BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIRECTORY / ".env", override=False)


async def read_json_object(request: Request):
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        raise ApiError(415, "Content-Type must be application/json")
    # Bounded before parsing; both endpoint payloads are much smaller than 8 KiB.
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 8192:
            raise ApiError(413, "JSON request exceeds 8 KiB")
    try:
        body = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as error:
        raise ApiError(400, "Invalid JSON request") from error
    if not isinstance(body, dict):
        raise ApiError(400, "JSON body must be an object")
    return body


def parse_uuid(value, field):
    if not isinstance(value, str):
        raise ApiError(400, f"{field} must be a UUID string")
    try:
        return UUID(value)
    except ValueError as error:
        raise ApiError(400, f"{field} must be a valid UUID") from error


async def audit(db, user, action, document_id=None, metadata=None):
    await db.execute(text("""
        INSERT INTO audit_events (request_id, user_id, document_id, action, status, metadata)
        VALUES (:request, :user, :document, :action, 'SUCCESS', CAST(:metadata AS jsonb))
    """), {"request": uuid4(), "user": user["id"], "document": document_id,
           "action": action, "metadata": json.dumps(metadata or {})})


async def authorized_document(db, document_id, user, *, owner_only=False):
    result = await db.execute(text("""
        SELECT * FROM documents WHERE id = :id AND deleted_at IS NULL FOR SHARE
    """), {"id": document_id})
    document = result.mappings().first()
    if document is None:
        raise ApiError(404, "Document not found")
    if document["owner_id"] == user["id"]:
        return document
    if not owner_only:
        access = await db.execute(text("""
            SELECT id FROM document_access
            WHERE document_id = :document AND user_id = :user
              AND permission IN ('READ', 'DOWNLOAD') AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > clock_timestamp())
            FOR SHARE
        """), {"document": document_id, "user": user["id"]})
        if access.first() is not None:
            return document
    raise ApiError(404, "Document not found")


async def plaintext_for(db, document):
    result = await db.execute(text("""
        SELECT * FROM crypto_keys WHERE id = :id FOR SHARE
    """), {"id": document["wrapping_key_id"]})
    wrapping = result.mappings().first()
    if wrapping is None or wrapping["owner_id"] is not None:
        raise ApiError(503, "Document wrapping key unavailable")
    # Retired wrapping keys remain usable for old documents; never select the newest key.
    configured = os.getenv("DOCUMENT_STORAGE_DIR", "./private_uploads").strip()
    if not configured:
        raise ApiError(503, "DOCUMENT_STORAGE_DIR cannot be empty")
    root = Path(configured).expanduser()
    if not root.is_absolute():
        root = BACKEND_DIRECTORY / root
    password = os.getenv("WRAPPING_PRIVATE_KEY_PASSPHRASE") or None
    try:
        return await run_in_threadpool(decrypt_document, document, wrapping, root, password)
    except Exception as error:
        logger.error("Could not decrypt/validate document %s (%s)", document["id"], type(error).__name__)
        raise ApiError(409, "Stored document could not be decrypted or failed integrity validation") from error


@router.post("/keys/generate", status_code=201)
async def generate_signing_key(request: Request,
                               user=Depends(require_permission("documents.sign")),
                               db=Depends(get_db)):
    body = await read_json_object(request)
    password = body.get("passphrase")
    if password is not None and not isinstance(password, str):
        raise ApiError(400, "passphrase must be a string or null")
    if password is not None:
        try:
            password_length = len(password.encode("utf-8"))
        except UnicodeEncodeError as error:
            raise ApiError(400, "Passphrase must contain valid Unicode") from error
        if not 12 <= password_length <= 128:
            raise ApiError(400, "Passphrase must be 12–128 UTF-8 bytes")
    private_pem, public_pem = await run_in_threadpool(generate_key_pair, password)
    key_id = uuid4()
    await db.execute(text("""
        INSERT INTO crypto_keys (id, owner_id, purpose, algorithm, public_key_pem, secret_ref)
        VALUES (:id, :owner, 'SIGNING', :algorithm, :public, :reference)
    """), {"id": key_id, "owner": user["id"], "algorithm": ALGORITHM,
           "public": public_pem, "reference": f"client-held:{key_id}"})
    await audit(db, user, "signing_keys.create", metadata={"key_id": str(key_id)})
    await db.commit()
    # No private key persistence, logging, or JSON wrapping. Never auto-retry this POST.
    return Response(content=private_pem, status_code=201, media_type="application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="signing-{key_id}.pem"',
                             "X-Signing-Key-Id": str(key_id), "Cache-Control": "no-store",
                             "Pragma": "no-cache", "X-Content-Type-Options": "nosniff"})


@router.get("/keys")
async def list_signing_keys(user=Depends(require_permission("documents.sign")), db=Depends(get_db)):
    result = await db.execute(text("""
        SELECT id, algorithm, public_key_pem, status, created_at, expires_at, revoked_at,
               (status = 'ACTIVE' AND revoked_at IS NULL
                AND (expires_at IS NULL OR expires_at > clock_timestamp())) AS usable_for_signing
        FROM crypto_keys WHERE owner_id = :owner AND purpose = 'SIGNING'
        ORDER BY created_at DESC
    """), {"owner": user["id"]})
    keys = []
    for row in result.mappings():
        item = dict(row)
        item["id"] = str(item["id"])
        for field in ("created_at", "expires_at", "revoked_at"):
            item[field] = item[field].isoformat() if item[field] else None
        keys.append(item)
    return ApiResponse(200, keys, "Signing public keys fetched")


@router.post("/keys/{key_id}/revoke")
async def revoke_signing_key(key_id: str, user=Depends(require_permission("documents.sign")),
                             db=Depends(get_db)):
    key_id = parse_uuid(key_id, "key_id")
    result = await db.execute(text("""
        UPDATE crypto_keys SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, clock_timestamp())
        WHERE id = :id AND owner_id = :owner AND purpose = 'SIGNING' RETURNING id
    """), {"id": key_id, "owner": user["id"]})
    if result.first() is None:
        raise ApiError(404, "Signing key not found")
    await audit(db, user, "signing_keys.revoke", metadata={"key_id": str(key_id)})
    await db.commit()
    return ApiResponse(200, {"id": str(key_id)}, "Signing key revoked; public key retained")


@router.post("/documents/{document_id}", status_code=201)
async def add_signature(document_id: str, request: Request,
                        user=Depends(require_permission("documents.sign")), db=Depends(get_db)):
    document_id = parse_uuid(document_id, "document_id")
    body = await read_json_object(request)
    signing_key_id = parse_uuid(body.get("signing_key_id"), "signing_key_id")
    signature_base64 = body.get("signature_base64")
    if not isinstance(signature_base64, str) or not 1 <= len(signature_base64) <= 1024:
        raise ApiError(400, "signature_base64 must be a string of 1–1024 characters")
    document = await authorized_document(db, document_id, user, owner_only=True)
    # Serializes submissions for the same key and blocks concurrent key revocation.
    result = await db.execute(text("""
        SELECT * FROM crypto_keys WHERE id = :id AND owner_id = :owner
            AND purpose = 'SIGNING' AND algorithm = :algorithm
        FOR UPDATE
    """), {"id": signing_key_id, "owner": user["id"], "algorithm": ALGORITHM})
    key = result.mappings().first()
    if key is None:
        raise ApiError(404, "Your signing key was not found")
    available = await db.execute(text("""
        SELECT status = 'ACTIVE' AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > clock_timestamp())
        FROM crypto_keys WHERE id = :id
    """), {"id": key["id"]})
    if not available.scalar_one():
        raise ApiError(409, "Signing key is inactive, expired, or revoked")
    try:
        signature = decode_signature(signature_base64)
    except ValueError as error:
        raise ApiError(400, str(error)) from error
    plaintext = await plaintext_for(db, document)
    try:
        valid = await run_in_threadpool(verify_signature, key["public_key_pem"], signature, plaintext)
    except (ValueError, TypeError, IndexError) as error:
        raise ApiError(503, "Registered signing public key is invalid") from error
    if not valid:
        raise ApiError(400, "Signature does not match the stored document and registered public key")
    existing = await db.execute(text("""
        SELECT id FROM document_signatures WHERE document_id = :document AND signing_key_id = :key
    """), {"document": document_id, "key": key["id"]})
    if existing.first() is not None:
        raise ApiError(409, "This key already signed this document")
    # Check expiry again after crypto work; insert only while key is still usable.
    result = await db.execute(text("""
        INSERT INTO document_signatures
            (document_id, signer_id, signing_key_id, signature, signature_algorithm, signed_content_hash)
        SELECT :document, :signer, id, :signature, :algorithm, :hash
        FROM crypto_keys WHERE id = :key AND status = 'ACTIVE' AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > clock_timestamp())
        RETURNING id, signed_at
    """), {"document": document_id, "signer": user["id"], "key": key["id"],
           "signature": signature, "algorithm": ALGORITHM, "hash": SHA256.new(plaintext).hexdigest()})
    row = result.mappings().first()
    if row is None:
        raise ApiError(409, "Signing key expired while verifying")
    await audit(db, user, "documents.sign", document_id, {"signature_id": str(row["id"])})
    await db.commit()
    return ApiResponse(201, {"id": str(row["id"]), "document_id": str(document_id),
                             "signing_key_id": str(key["id"]), "signed_at": row["signed_at"].isoformat()},
                       "Signature verified and saved")


@router.get("/documents/{document_id}/verify")
async def verify_document_signatures(document_id: str,
                                     user=Depends(require_permission("documents.verify")),
                                     db=Depends(get_db)):
    document_id = parse_uuid(document_id, "document_id")
    document = await authorized_document(db, document_id, user)
    plaintext = await plaintext_for(db, document)
    result = await db.execute(text("""
        SELECT s.*, k.owner_id AS key_owner, k.purpose, k.algorithm AS key_algorithm,
               k.public_key_pem, k.status AS key_status, k.expires_at, k.revoked_at,
               (k.status = 'ACTIVE' AND k.revoked_at IS NULL
                 AND (k.expires_at IS NULL OR k.expires_at > clock_timestamp())) AS key_usable_now
        FROM document_signatures s JOIN crypto_keys k ON k.id = s.signing_key_id
        WHERE s.document_id = :document ORDER BY s.signed_at, s.id
        FOR SHARE OF s, k
    """), {"document": document_id})
    signatures = []
    for row in result.mappings():
        valid = False
        metadata_valid = (row["key_owner"] == row["signer_id"] == document["owner_id"]
                          and row["purpose"] == "SIGNING"
                          and row["key_algorithm"] == row["signature_algorithm"] == ALGORITHM
                          and row["signed_content_hash"] == document["content_hash"])
        if metadata_valid:
            try:
                valid = await run_in_threadpool(verify_signature, row["public_key_pem"],
                                                bytes(row["signature"]), plaintext)
            except (ValueError, TypeError, IndexError):
                valid = False
        signatures.append({"id": str(row["id"]), "signer_id": row["signer_id"],
                           "signing_key_id": str(row["signing_key_id"]),
                           "signed_at": row["signed_at"].isoformat(),
                           "cryptographically_valid": valid, "key_status": row["key_status"],
                           "key_usable_now": row["key_usable_now"],
                           "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
                           "revoked_at": row["revoked_at"].isoformat() if row["revoked_at"] else None})
    await audit(db, user, "documents.verify", document_id,
                {"signature_count": len(signatures), "invalid_count": sum(not s["cryptographically_valid"] for s in signatures)})
    await db.commit()
    return ApiResponse(200, {"document_id": str(document_id), "document_integrity_valid": True,
                             "has_signatures": bool(signatures), "signatures": signatures},
                       "Stored document signatures checked")
