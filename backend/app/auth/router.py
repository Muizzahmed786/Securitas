import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from sqlalchemy import text
from fastapi import Depends, APIRouter, Request, Response
from fastapi.concurrency import run_in_threadpool
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse
from app.config import *
from app.database import get_db
from app.utils.FormatRequest import *

router = APIRouter()


def hash_password(password):
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ApiError(400, "Password must not exceed 72 UTF-8 bytes")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def is_password_correct(password, password_hash):
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        return False
    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))


def generate_tokens(user_id):
    now = datetime.now(timezone.utc)
    access_payload = {
        "id": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=ACCESS_TOKEN_SECONDS)
    }
    refresh_payload = {
        "id": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(seconds=REFRESH_TOKEN_SECONDS),
        "jti": str(uuid.uuid4())
    }
    access_token = jwt.encode(
        access_payload, ACCESS_TOKEN_SECRET, algorithm="HS256"
    )
    refresh_token = jwt.encode(
        refresh_payload, REFRESH_TOKEN_SECRET, algorithm="HS256"
    )
    return access_token, refresh_token


def verify_token(token, secret, expected_type):
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"require": ["id", "type", "exp"]}
        )
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "Token has expired")
    except jwt.InvalidTokenError:
        raise ApiError(401, "Invalid token")
    if payload["type"] != expected_type:
        raise ApiError(401, "Invalid token type")
    if not isinstance(payload["id"], str):
        raise ApiError(401, "Invalid token user ID")
    return payload


def set_auth_cookies(response, access_token, refresh_token):
    response.set_cookie(
        key="accessToken", value=access_token,
        httponly=True, secure=COOKIE_SECURE, samesite="lax",
        path="/", max_age=ACCESS_TOKEN_SECONDS
    )
    response.set_cookie(
        key="refreshToken", value=refresh_token,
        httponly=True, secure=COOKIE_SECURE, samesite="lax",
        path="/", max_age=REFRESH_TOKEN_SECONDS
    )


async def find_user(db, user_id):
    result = await db.execute(
        text("""
        SELECT u.id, u.email, u.role_id, r.name AS role,
               u.is_active, u.created_at, u.updated_at
        FROM users AS u
        JOIN roles AS r ON r.id = u.role_id
        WHERE u.id::text = :user_id
        """),
        {"user_id": str(user_id)}
    )
    user = result.mappings().first()
    if user is None:
        raise ApiError(401, "Invalid token user")
    if not user["is_active"]:
        raise ApiError(403, "User account is inactive")
    return dict(user)


async def verify_jwt(request: Request, db=Depends(get_db)):
    token = request.cookies.get("accessToken")
    if not token:
        authorization = request.headers.get("Authorization", "")
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if not token:
        raise ApiError(401, "Unauthorized request")
    payload = verify_token(token, ACCESS_TOKEN_SECRET, "access")
    return await find_user(db, payload["id"])


@router.post("/register", status_code=201)
async def register(request: Request, db=Depends(get_db)):
    body = await read_body(request)
    email = required_string(body, "email").strip().lower()
    password = required_string(body, "password")
    role_id = int(body.get("role_id"))

    if role_id not in [1, 2, 3, 4]:
        raise ApiError(400, "role_id must be an integer: 1, 2, 3, or 4")

    if "is_active" in body:
        raise ApiError(400, "Account status cannot be set at registration")

    role_result = await db.execute(
        text("SELECT id, name FROM roles WHERE id = :role_id"),
        {"role_id": role_id}
    )
    role = role_result.mappings().first()
    if role is None:
        raise ApiError(400, "Selected role does not exist")

    user_result = await db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": email}
    )
    existing_user = user_result.mappings().first()
    if existing_user is not None:
        raise ApiError(409, "User with this email already exists")

    password_hash = await run_in_threadpool(hash_password, password)
    try:
        created_user_result = await db.execute(
            text("""
            INSERT INTO users (
                email, password_hash, role_id, is_active, created_at, updated_at
            )
            VALUES (:email, :password_hash, :role_id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id, email, role_id, is_active, created_at, updated_at
            """),
            {"email": email, "password_hash": password_hash, "role_id": role["id"]}
        )
        await db.commit()
        created_user = created_user_result.mappings().first()
    except Exception as e:
        await db.rollback()
        if "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
            raise ApiError(409, "User details already exist")
        raise e

    user = dict(created_user)
    user["role"] = role["name"]
    return ApiResponse(201, user, "User registered successfully")


@router.post("/login")
async def login(request: Request, response: Response, db=Depends(get_db)):
    body = await read_body(request)
    email = required_string(body, "email").strip().lower()
    password = required_string(body, "password")
    user_result = await db.execute(
        text("SELECT id, password_hash FROM users WHERE email = :email"),
        {"email": email}
    )
    print(user_result)
    user = user_result.mappings().first()
    if user is None:
        raise ApiError(401, "Invalid user credentials")
    password_valid = await run_in_threadpool(
        is_password_correct, password, user["password_hash"]
    )
    if not password_valid:
        raise ApiError(401, "Invalid user credentials")

    logged_in_user = await find_user(db, str(user["id"]))
    access_token, refresh_token = generate_tokens(user["id"])
    set_auth_cookies(response, access_token, refresh_token)
    return ApiResponse(200, {
        "user": logged_in_user,
        "accessToken": access_token,
        "refreshToken": refresh_token
    }, "User logged in successfully")


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        "accessToken", path="/", httponly=True,
        secure=COOKIE_SECURE, samesite="lax"
    )
    response.delete_cookie(
        "refreshToken", path="/", httponly=True,
        secure=COOKIE_SECURE, samesite="lax"
    )
    return ApiResponse(200, {}, "Authentication cookies cleared")


@router.get("/get-current-user")
async def get_current_user(user=Depends(verify_jwt)):
    return ApiResponse(200, user, "Current user fetched successfully")


@router.post("/refresh-access-token")
async def refresh_access_token(
    request: Request, response: Response, db=Depends(get_db)
):
    refresh_token = request.cookies.get("refreshToken")
    if not refresh_token:
        body = await read_body(request)
        refresh_token = required_string(body, "refreshToken")
    payload = verify_token(refresh_token, REFRESH_TOKEN_SECRET, "refresh")
    user = await find_user(db, payload["id"])

    access_token, unused_refresh_token = generate_tokens(user["id"])
    response.set_cookie(
        key="accessToken", value=access_token,
        httponly=True, secure=COOKIE_SECURE, samesite="lax",
        path="/", max_age=ACCESS_TOKEN_SECONDS
    )
    return ApiResponse(200, {
        "accessToken": access_token,
        "refreshToken": refresh_token
    }, "Access token refreshed")