import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
ACCESS_TOKEN_SECRET = os.environ["ACCESS_TOKEN_SECRET"]
REFRESH_TOKEN_SECRET = os.environ["REFRESH_TOKEN_SECRET"]
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
ACCESS_TOKEN_SECONDS = int(os.getenv("ACCESS_TOKEN_SECONDS", 900))
REFRESH_TOKEN_SECONDS = int(os.getenv("REFRESH_TOKEN_SECONDS", 604800))
for name in ("ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"):
    value = globals()[name]
    if len(value) < 32 or value.startswith("REPLACE_"):
        raise ValueError(f"{name} must be a random secret of at least 32 characters")
if ACCESS_TOKEN_SECRET == REFRESH_TOKEN_SECRET:
    raise ValueError("Access and refresh token secrets must be different")
