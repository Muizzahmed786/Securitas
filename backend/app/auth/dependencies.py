import uuid
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.auth.security import decode_access_token
from app.users.models import User, AuthSession

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id_str: str = payload.get("sub")
    jti_str: str = payload.get("jti")
    token_type: str = payload.get("type")
    
    if user_id_str is None or jti_str is None or token_type != "access":
        raise credentials_exception
        
    try:
        user_id = int(user_id_str)
        jti = uuid.UUID(jti_str)
    except ValueError:
        raise credentials_exception

    # Query auth_sessions to ensure it exists and is not revoked/expired
    stmt = select(AuthSession).where(AuthSession.jwt_jti == jti)
    result = await db.execute(stmt)
    session_record = result.scalar_one_or_none()
    
    if session_record is None:
        raise credentials_exception
        
    if session_record.revoked_at is not None:
        raise credentials_exception
        
    if datetime.now(timezone.utc) >= session_record.expires_at:
        raise credentials_exception

    # Query User
    user_stmt = select(User).options(joinedload(User.role)).where(User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
        
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return current_user
