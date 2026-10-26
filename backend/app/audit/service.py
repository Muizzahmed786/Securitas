import json
import logging
from uuid import UUID, uuid4
from sqlalchemy import text
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = {
    "password", "password_hash", "passphrase", "token", "access_token",
    "refresh_token", "accessToken", "refreshToken", "secret", "private_key",
    "encrypted_dek", "dek", "key_pem", "otp", "otp_digest", "data", "content"
}

def sanitize_metadata(metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not metadata:
        return {}
    sanitized = {}
    for k, v in metadata.items():
        if k.lower() in SENSITIVE_KEYS or any(s in k.lower() for s in ("secret", "token", "password", "key_pem")):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_metadata(v)
        elif isinstance(v, bytes):
            sanitized[k] = f"[BINARY: {len(v)} bytes]"
        else:
            sanitized[k] = v
    return sanitized

async def log_audit_event(
    db,
    action: str,
    status: str,  # SUCCESS, FAILURE, DENIED, CHALLENGED
    user_id: Optional[int] = None,
    document_id: Optional[UUID] = None,
    risk_event_id: Optional[UUID] = None,
    request_id: Optional[UUID] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    if request_id is None:
        request_id = uuid4()
    
    clean_meta = sanitize_metadata(metadata)
    try:
        await db.execute(
            text("""
                INSERT INTO audit_events (
                    request_id, user_id, document_id, risk_event_id,
                    action, status, ip_address, metadata, timestamp
                ) VALUES (
                    :request_id, :user_id, :document_id, :risk_event_id,
                    :action, :status, :ip_address, CAST(:metadata AS jsonb), CURRENT_TIMESTAMP
                )
            """),
            {
                "request_id": request_id,
                "user_id": user_id,
                "document_id": document_id,
                "risk_event_id": risk_event_id,
                "action": action,
                "status": status,
                "ip_address": ip_address,
                "metadata": json.dumps(clean_meta),
            }
        )
        await db.commit()
    except Exception as e:
        logger.exception("Failed to write audit event: %s", e)
