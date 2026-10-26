import sys
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

DB_NAME = os.environ.get("POSTGRES_DB", "securitas")
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")

def init_db():
    print(f"Connecting to PostgreSQL server at {DB_HOST}:{DB_PORT} as user '{DB_USER}'...")
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
        exists = cursor.fetchone()
        if not exists:
            print(f"Creating database '{DB_NAME}'...")
            cursor.execute(f'CREATE DATABASE "{DB_NAME}"')
            print(f"Database '{DB_NAME}' created successfully.")
        else:
            print(f"Database '{DB_NAME}' already exists.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error connecting to PostgreSQL or creating database: {e}")
        return False

    print(f"Connecting to database '{DB_NAME}' to apply schema...")
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        cursor = conn.cursor()
        
        schema_path = os.path.join(os.path.dirname(__file__), "docsentinel_schema.sql")
        with open(schema_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
            
        cursor.execute(sql_script)
        conn.commit()
        print("Schema applied successfully!")
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        print("\nCreated Tables in 'public' schema:")
        for t in tables:
            print(f" - {t[0]}")
            
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error applying SQL schema: {e}")
        return False

if __name__ == "__main__":
    success = init_db()
    if not success:
        sys.exit(1)
