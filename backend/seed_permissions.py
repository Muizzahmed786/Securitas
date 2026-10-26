import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5433/securitas")
# Remove async driver prefix if present
if "+asyncpg" in DB_URL:
    DB_URL = DB_URL.replace("+asyncpg", "")

def seed():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO permissions (name, description)
        VALUES ('crypto_keys.create', 'Create system wrapping and cryptographic keys')
        ON CONFLICT (name) DO NOTHING;
    """)

    role_perms = {
        'ADMIN': [
            'users.manage', 'roles.manage', 'policies.manage',
            'documents.upload', 'documents.read', 'documents.download',
            'documents.share', 'documents.revoke', 'documents.sign',
            'documents.verify', 'documents.delete', 'documents.search',
            'audit.read', 'risk.read', 'crypto_keys.create'
        ],
        'DOCUMENT_OWNER': [
            'documents.upload', 'documents.read', 'documents.download',
            'documents.share', 'documents.revoke', 'documents.sign',
            'documents.verify', 'documents.delete', 'documents.search',
            'crypto_keys.create'
        ],
        'EMPLOYEE': [
            'documents.read', 'documents.download', 'documents.verify', 'documents.search'
        ],
        'SECURITY_AUDITOR': [
            'audit.read', 'risk.read', 'documents.verify', 'documents.search'
        ]
    }

    cur.execute("DELETE FROM role_permissions;")
    for role_name, perms in role_perms.items():
        cur.execute("SELECT id FROM roles WHERE name = %s;", (role_name,))
        role_id = cur.fetchone()[0]
        for perm_name in perms:
            cur.execute("SELECT id FROM permissions WHERE name = %s;", (perm_name,))
            perm_row = cur.fetchone()
            if perm_row:
                perm_id = perm_row[0]
                cur.execute(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                    (role_id, perm_id)
                )

    conn.commit()
    cur.execute("SELECT count(*) FROM role_permissions;")
    count = cur.fetchone()[0]
    print(f"Successfully seeded role_permissions: {count} permissions mapped across roles.")
    conn.close()

if __name__ == "__main__":
    seed()
