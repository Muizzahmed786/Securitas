"""Local setup commands. These never expose an admin registration endpoint."""
import argparse
import asyncio
from pathlib import Path
from sqlalchemy import text
from app.database import SessionLocal, engine


async def promote(email):
    async with SessionLocal() as db:
        result = await db.execute(text("""
            UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'ADMIN')
            WHERE lower(email) = :email RETURNING id
        """), {"email": email.strip().lower()})
        if result.scalar_one_or_none() is None:
            raise SystemExit("Register this email through the app first.")
        await db.commit()
    await engine.dispose()
    print("Account promoted. Sign in again to initialize document encryption.")


def initialize():
    # The schema is the authoritative setup for this milestone. Alembic's
    # legacy empty initial revision does not initialize these tables.
    import psycopg2
    from sqlalchemy.engine import make_url
    from app.config import DATABASE_URL
    url = make_url(DATABASE_URL).set(drivername="postgresql")
    connection = psycopg2.connect(url.render_as_string(hide_password=False))
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass('public.users')")
            if cursor.fetchone()[0] is not None:
                raise SystemExit("Database is already initialized. Use sync-permissions for an existing schema.")
            cursor.execute((Path(__file__).resolve().parents[1] / 'docsentinel_schema.sql').read_text())
        connection.commit()
    finally:
        connection.close()
    print("Database initialized.")


async def sync_permissions():
    async with SessionLocal() as db:
        await db.execute(text("INSERT INTO permissions (name) VALUES ('crypto_keys.create') ON CONFLICT (name) DO NOTHING"))
        await db.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
            WHERE r.name = 'ADMIN'
               OR (r.name = 'DOCUMENT_OWNER' AND p.name LIKE 'documents.%')
               OR (r.name = 'EMPLOYEE' AND p.name IN ('documents.read', 'documents.download', 'documents.verify', 'documents.search'))
               OR (r.name = 'SECURITY_AUDITOR' AND p.name IN ('documents.verify', 'audit.read', 'risk.read'))
            ON CONFLICT DO NOTHING
        """))
        await db.commit()
    await engine.dispose()
    print("Role permissions synchronized.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init-db')
    sub.add_parser('sync-permissions')
    promote_parser = sub.add_parser('promote-admin')
    promote_parser.add_argument('email')
    args = parser.parse_args()
    if args.command == 'init-db':
        initialize()
    elif args.command == 'sync-permissions':
        asyncio.run(sync_permissions())
    else:
        asyncio.run(promote(args.email))
