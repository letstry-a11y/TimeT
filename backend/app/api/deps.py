import secrets
import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.config import settings
from app.core.security import decode_token
from app.crud import user as user_crud
from app.models.user import User

# auto_error=False so a missing token/key doesn't 401 on its own — we decide
# below which credential to accept (either a JWT or the hermes API key).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


async def _user_from_api_key(db: AsyncSession, api_key: str) -> Optional[User]:
    """Resolve the hermes service user from a static API key.

    Returns None when the key is unset/invalid so the caller can fall back to
    JWT auth. Uses a constant-time comparison to avoid leaking the key via
    timing.
    """
    configured = settings.HERMES_API_KEY
    if not configured or not settings.HERMES_USER_EMAIL:
        return None
    if not secrets.compare_digest(api_key, configured):
        return None
    user = await user_crud.get_user_by_email(db, settings.HERMES_USER_EMAIL)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Hermes service user is not configured or inactive",
        )
    return user


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Depends(api_key_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1) Service access: a valid X-API-Key acts as the hermes user, no JWT needed.
    if api_key:
        user = await _user_from_api_key(db, api_key)
        if user is not None:
            return user

    # 2) Normal access: validate the JWT bearer token (frontend path, unchanged).
    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    token_type = payload.get("type")
    if token_type != "access":
        raise credentials_exception

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    user = await user_crud.get_user(db, user_id)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user
