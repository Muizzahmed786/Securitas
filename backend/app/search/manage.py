"""Run from backend/: python -m app.search.manage init-key | reindex"""
import argparse
import asyncio
import os
import secrets
from collections import Counter
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text

BACKEND = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND / ".env", override=False)
from app.database import get_db
from .service import active_key, prepare_index, save_index


async def init_key(db):
    # Serializes concurrent executions of this setup command.
    await db.execute(text("SELECT pg_advisory_xact_lock(739104221)"))
    existing = (await db.execute(text("SELECT id FROM crypto_keys WHERE purpose = 'SEARCH'"))).first()
    if existing:
        print("Search key records already exist. No keys were created or overwritten.")
        return
    configured = os.getenv("SEARCH_KEY_DIR", "./private_keys").strip()
    if not configured:
        raise RuntimeError("SEARCH_KEY_DIR cannot be empty")
    directory = Path(configured).expanduser()
    if not directory.is_absolute():
        directory = BACKEND / directory
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    key_id = uuid4()
    path = directory.resolve() / f"search-{key_id}.key"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as output:
        output.write(secrets.token_bytes(32))
        output.flush()
        os.fsync(output.fileno())
    # Keep the key file on uncertain database commit outcomes. Never overwrite it.
    await db.execute(text("""
        INSERT INTO crypto_keys (id, owner_id, purpose, algorithm, public_key_pem, secret_ref, status)
        VALUES (:id, NULL, 'SEARCH', 'HMAC-SHA256', NULL, :path, 'ACTIVE')
    """), {"id": key_id, "path": str(path)})
    await db.commit()
    print(f"Search key registered: {key_id}. Keep its private file backed up.")


async def reindex(db):
    from app.documents.router import get_upload_directory
    from app.signatures.crypto import decrypt_document
    key_id, _ = await active_key(db)
    await db.rollback()
    counts = Counter()
    last_id = None
    while True:
        condition = "AND id > :last" if last_id else ""
        row = (await db.execute(text(f"""
            SELECT * FROM documents WHERE deleted_at IS NULL {condition}
            ORDER BY id LIMIT 1 FOR UPDATE
        """), {"last": last_id} if last_id else {})).mappings().first()
        if row is None:
            await db.rollback()
            break
        document = dict(row)
        last_id = document["id"]
        try:
            wrapping = (await db.execute(text("SELECT * FROM crypto_keys WHERE id = :id"),
                {"id": document["wrapping_key_id"]})).mappings().first()
            if not wrapping or wrapping["purpose"] != "KEY_WRAPPING" or wrapping["owner_id"] is not None:
                raise RuntimeError("Wrapping key unavailable")
            # Same decryption signature already used by your document router.
            data = await run_in_threadpool(decrypt_document, document, dict(wrapping), get_upload_directory())
            prepared = await prepare_index(db, data, document["filename"])
            del data
            state = prepared[0]
            if state == "FAILED" or prepared[1] != key_id:
                # Do not destroy a working old index when extraction/key access fails.
                await db.rollback()
                counts["FAILED"] += 1
                print(f"{last_id}: FAILED (existing index retained)")
                continue
            await save_index(db, last_id, prepared)
            await db.commit()
            counts[state] += 1
            print(f"{last_id}: {state}")
        except Exception:
            await db.rollback()
            counts["FAILED"] += 1
            print(f"{last_id}: FAILED (existing index retained)")
    print(dict(counts))
    if counts["FAILED"]:
        raise SystemExit(1)


async def main(command):
    async for db in get_db():
        try:
            await (init_key(db) if command == "init-key" else reindex(db))
        finally:
            await db.rollback()
        break


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("init-key", "reindex"))
    asyncio.run(main(parser.parse_args().command))
