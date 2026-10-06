import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.users.models import User, Role, AuthSession
from app.auth.schemas import UserCreate, UserResponse, Token
from app.auth.security import get_password_hash, verify_password, create_access_token
from app.auth.dependencies import get_current_active_user, get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Validate uniqueness
    stmt = select(User).where(User.email == user_in.email)
    existing_user = (await db.execute(stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Get EMPLOYEE role
    role_stmt = select(Role).where(Role.name == "EMPLOYEE")
    employee_role = (await db.execute(role_stmt)).scalar_one_or_none()
    if not employee_role:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Default role missing")

    hashed_password = get_password_hash(user_in.password)
    
    new_user = User(
        email=user_in.email,
        password_hash=hashed_password,
        role_id=employee_role.id
    )
    db.add(new_user)
    
    try:
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    return new_user

@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    invalid_creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    stmt = select(User).where(User.email == form_data.username)
    user = (await db.execute(stmt)).scalar_one_or_none()
    
    if not user:
        raise invalid_creds_exc
        
    if not verify_password(form_data.password, user.password_hash):
        raise invalid_creds_exc

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    jti = uuid.uuid4()
    access_token, expire = create_access_token(user_id=user.id, jti=jti)
    
    # Capture IP and User Agent
    client_host = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    session_record = AuthSession(
        user_id=user.id,
        jwt_jti=jti,
        expires_at=expire,
        ip_address=client_host,
        user_agent=user_agent
    )
    db.add(session_record)
    
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create session")
        
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Extract token from the Authorization header to find JTI
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")
        
    token = auth_header.split(" ")[1]
    from app.auth.security import decode_access_token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
    jti_str = payload.get("jti")
    try:
        jti = uuid.UUID(jti_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token JTI")

    # Find the session and revoke it
    stmt = select(AuthSession).where(AuthSession.jwt_jti == jti)
    session_record = (await db.execute(stmt)).scalar_one_or_none()
    
    if session_record and session_record.revoked_at is None:
        session_record.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        
    return None

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user
