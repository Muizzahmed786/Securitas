import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Load backend configuration first, then fall back to the default .env lookup.
load_dotenv(BACKEND_DIR / ".env")
load_dotenv()

# Require the core database and authentication secrets to be configured.
DATABASE_URL = os.environ["DATABASE_URL"]
ACCESS_TOKEN_SECRET = os.environ["ACCESS_TOKEN_SECRET"]
REFRESH_TOKEN_SECRET = os.environ["REFRESH_TOKEN_SECRET"]

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
ACCESS_TOKEN_SECONDS = int(os.getenv("ACCESS_TOKEN_SECONDS", "900"))
REFRESH_TOKEN_SECONDS = int(os.getenv("REFRESH_TOKEN_SECONDS", "604800"))
SECRET_KEY = os.getenv("SECRET_KEY", ACCESS_TOKEN_SECRET)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Support both passphrase variable names for compatibility with existing
# encrypted private keys.
RSA_PRIVATE_KEY_PASSPHRASE = (
    os.getenv("RSA_PRIVATE_KEY_PASSPHRASE")
    or os.getenv("WRAPPING_PRIVATE_KEY_PASSPHRASE")
    or ""
)
WRAPPING_PRIVATE_KEY_PASSPHRASE = RSA_PRIVATE_KEY_PASSPHRASE

DOCUMENT_STORAGE_DIR = os.getenv(
    "DOCUMENT_STORAGE_DIR", "./private_uploads"
)
RSA_PRIVATE_KEY_DIR = os.getenv("RSA_PRIVATE_KEY_DIR", "./private_keys")

# Configure a dedicated secret for step-up authentication.
STEP_UP_HMAC_SECRET = (
    os.getenv("STEP_UP_HMAC_SECRET")
    or (ACCESS_TOKEN_SECRET + "_step_up_hmac_secret_32bytes!")
)


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
