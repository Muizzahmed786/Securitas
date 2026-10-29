import hashlib
import hmac
import logging
from pathlib import Path

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text
from app.utils.ApiError import ApiError
from .extraction import extraction_worker, normalize_words

logger = logging.getLogger(__name__)


async def active_key(db):
    rows = (await db.execute(text("""
        SELECT id, secret_ref FROM crypto_keys
        WHERE purpose = 'SEARCH' AND owner_id IS NULL
          AND algorithm = 'HMAC-SHA256' AND status = 'ACTIVE'
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > clock_timestamp())
        ORDER BY created_at DESC LIMIT 2
    """))).mappings().all()
    if len(rows) != 1:
        raise ApiError(503, "Configure exactly one active system search key")
    row = rows[0]
    try:
        path = Path(row["secret_ref"])
        if not path.is_absolute():
            raise ValueError("Absolute key path required")
        key = await run_in_threadpool(path.read_bytes)
        if len(key) != 32:
            raise ValueError("Invalid search key")
    except (OSError, ValueError, TypeError) as error:
        raise ApiError(503, "Search key is unavailable") from error
    return row["id"], key


def keyword_token(key, word):
    return hmac.new(key, b"securitas:content:v1\0" + word.encode("utf-8"), hashlib.sha256).digest()


def query_words(query):
    if len(query) > 300:
        raise ApiError(400, "Search query must be at most 300 characters")
    words = normalize_words(query)
    if not 1 <= len(words) <= 10:
        raise ApiError(400, "Enter between 1 and 10 distinct words")
    return words


async def prepare_index(db, data, filename):
    # Keep upload available if search setup or extraction is unavailable.
    try:
        async with db.begin_nested():
            key_id, key = await active_key(db)
        state, words = await run_in_threadpool(extraction_worker, data, filename)
        return state, key_id, [keyword_token(key, word) for word in words]
    except Exception:
        logger.warning("Search preparation unavailable; document upload can continue")
        return "FAILED", None, []


async def save_index(db, document_id, prepared):
    state, key_id, tokens = prepared
    # No commits here: the document and its index belong to the caller's transaction.
    await db.execute(text("DELETE FROM document_search_tokens WHERE document_id = :id"), {"id": document_id})
    for offset in range(0, len(tokens), 1000):
        await db.execute(text("""
            INSERT INTO document_search_tokens (document_id, search_key_id, token)
            VALUES (:document_id, :search_key_id, :token)
            ON CONFLICT DO NOTHING
        """), [{"document_id": document_id, "search_key_id": key_id, "token": token}
               for token in tokens[offset:offset + 1000]])
    await db.execute(text("""
        INSERT INTO document_search_status (document_id, search_key_id, state, token_count)
        VALUES (:id, :key, :state, :count)
        ON CONFLICT (document_id) DO UPDATE SET
            search_key_id = EXCLUDED.search_key_id, state = EXCLUDED.state,
            token_count = EXCLUDED.token_count, indexed_at = CURRENT_TIMESTAMP
    """), {"id": document_id, "key": key_id, "state": state, "count": len(tokens)})
    return state


async def save_upload_index(db, document_id, prepared):
    try:
        async with db.begin_nested():
            return await save_index(db, document_id, prepared)
    except Exception:
        logger.warning("Search index write failed for document %s", document_id)
        return "FAILED"


# Content access only. Verification privileges never grant content search access.
ACCESS_SQL = """
    d.deleted_at IS NULL AND (
        d.owner_id = :uid OR EXISTS (
            SELECT 1 FROM document_access a
            WHERE a.document_id = d.id AND a.user_id = :uid
              AND a.permission IN ('READ', 'DOWNLOAD')
              AND a.revoked_at IS NULL
              AND (a.expires_at IS NULL OR a.expires_at > clock_timestamp())
        )
    )
"""


async def highest_classification(db, user_id):
    # Assess all accessible content, not just matching documents: no match-dependent
    # risk error that could reveal a keyword's presence before step-up authentication.
    row = (await db.execute(text(f"""
        SELECT d.classification FROM documents d
        JOIN document_classifications c ON c.name = d.classification
        WHERE {ACCESS_SQL}
        ORDER BY c.sensitivity_score DESC, d.classification LIMIT 1
    """), {"uid": user_id})).first()
    return row[0] if row else "PUBLIC"


async def matches(db, user_id, key_id, tokens, classification="RESTRICTED"):
    params = {"uid": user_id, "key": key_id, "count": len(tokens), "classification": classification}
    placeholders = []
    for index, token in enumerate(tokens):
        name = f"t{index}"
        params[name] = token
        placeholders.append(":" + name)
    # Tokens, never raw input, are bound as SQL parameters.
    result = await db.execute(text(f"""
        SELECT d.id, d.owner_id, d.filename, d.mime_type, d.file_size_bytes,
               d.classification, d.created_at, (d.owner_id = :uid) AS is_owner
        FROM documents d
        WHERE {ACCESS_SQL}
          AND d.classification IN (
              SELECT name FROM document_classifications
              WHERE sensitivity_score <= (
                  SELECT sensitivity_score FROM document_classifications WHERE name = :classification
              )
          ) AND d.id IN (
            SELECT document_id FROM document_search_tokens
            WHERE search_key_id = :key AND token IN ({', '.join(placeholders)})
            GROUP BY document_id HAVING COUNT(DISTINCT token) = :count
        )
        ORDER BY d.created_at DESC, d.id DESC LIMIT 101
    """), params)
    rows = [dict(row) for row in result.mappings().all()]
    return {"documents": rows[:100], "has_more": len(rows) > 100}
