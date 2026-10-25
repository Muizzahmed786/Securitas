import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/securitas")
ACCESS_TOKEN_SECRET = os.environ.get("ACCESS_TOKEN_SECRET", "securitas_access_token_secret_test_key_32chars!")
REFRESH_TOKEN_SECRET = os.environ.get("REFRESH_TOKEN_SECRET", "securitas_refresh_token_secret_test_key_32chars!")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
ACCESS_TOKEN_SECONDS = int(os.getenv("ACCESS_TOKEN_SECONDS", 900))
REFRESH_TOKEN_SECONDS = int(os.getenv("REFRESH_TOKEN_SECONDS", 604800))
SECRET_KEY = os.getenv("SECRET_KEY", ACCESS_TOKEN_SECRET)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Resolve passphrase inconsistency without breaking access to existing encrypted files
RSA_PRIVATE_KEY_PASSPHRASE = os.getenv("RSA_PRIVATE_KEY_PASSPHRASE") or os.getenv("WRAPPING_PRIVATE_KEY_PASSPHRASE") or ""
WRAPPING_PRIVATE_KEY_PASSPHRASE = RSA_PRIVATE_KEY_PASSPHRASE

DOCUMENT_STORAGE_DIR = os.getenv("DOCUMENT_STORAGE_DIR", "./private_uploads")
RSA_PRIVATE_KEY_DIR = os.getenv("RSA_PRIVATE_KEY_DIR", "./private_keys")
STEP_UP_HMAC_SECRET = os.getenv("STEP_UP_HMAC_SECRET", "securitas_step_up_hmac_secret_32_chars!")


class Settings:
    DATABASE_URL = DATABASE_URL
    ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET
    REFRESH_TOKEN_SECRET = REFRESH_TOKEN_SECRET
    COOKIE_SECURE = COOKIE_SECURE
    ACCESS_TOKEN_SECONDS = ACCESS_TOKEN_SECONDS
    REFRESH_TOKEN_SECONDS = REFRESH_TOKEN_SECONDS
    SECRET_KEY = SECRET_KEY
    JWT_ALGORITHM = JWT_ALGORITHM
    RSA_PRIVATE_KEY_PASSPHRASE = RSA_PRIVATE_KEY_PASSPHRASE
    WRAPPING_PRIVATE_KEY_PASSPHRASE = WRAPPING_PRIVATE_KEY_PASSPHRASE
    DOCUMENT_STORAGE_DIR = DOCUMENT_STORAGE_DIR
    RSA_PRIVATE_KEY_DIR = RSA_PRIVATE_KEY_DIR
    STEP_UP_HMAC_SECRET = STEP_UP_HMAC_SECRET


settings = Settings()