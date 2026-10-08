import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
ACCESS_TOKEN_SECRET = os.environ["ACCESS_TOKEN_SECRET"]
REFRESH_TOKEN_SECRET = os.environ["REFRESH_TOKEN_SECRET"]
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
ACCESS_TOKEN_SECONDS = int(os.getenv("ACCESS_TOKEN_SECONDS", 900))
REFRESH_TOKEN_SECONDS = int(os.getenv("REFRESH_TOKEN_SECONDS", 604800))