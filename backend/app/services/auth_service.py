from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User

_settings = get_settings()
_ALGORITHM = "HS256"
_EXPIRE_DAYS = 7


def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS),
    }
    return jwt.encode(payload, _settings.jwt_secret, algorithm=_ALGORITHM)


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _settings.jwt_secret, algorithms=[_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User | None:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, _settings.jwt_secret, algorithms=[_ALGORITHM])
        user_id = int(payload["sub"])
        return db.get(User, user_id)
    except (JWTError, KeyError, ValueError):
        return None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
