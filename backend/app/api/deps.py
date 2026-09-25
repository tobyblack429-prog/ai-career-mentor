from datetime import datetime, timedelta, timezone
import os
import uuid
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User
from app.core.security import SECRET_KEY, ALGORITHM
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

GUEST_EMAIL = "guest@local.careermentor"


def is_allowed_public_origin(origin: str | None, headers) -> bool:
    """Allow the current deployment origin or an explicitly configured dev origin."""
    if not origin:
        return False
    parsed = urlsplit(origin.rstrip("/"))
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path:
        return False
    normalized = f"{parsed.scheme}://{parsed.netloc}"
    if normalized in {value.rstrip("/") for value in settings.CORS_ORIGINS}:
        return True
    host = headers.get("host", "").lower()
    expected_scheme = "https" if os.getenv("VERCEL") else headers.get("x-forwarded-proto", "http")
    return bool(host) and normalized.lower() == f"{expected_scheme}://{host}"


def create_anonymous_session(db: Session) -> tuple[User, str]:
    """Create an isolated anonymous user and a purpose-bound signed cookie token."""
    from app.core.config import settings

    user_id = str(uuid.uuid4())
    email = f"anon-{user_id}@anonymous.invalid"
    # Never let a deployment's admin email configuration identify an anonymous user.
    while email.lower() == settings.ADMIN_EMAIL.strip().lower():
        user_id = str(uuid.uuid4())
        email = f"anon-{user_id}@anonymous.invalid"
    user = User(id=user_id, name="Anonymous visitor", email=email, hashed_pw=None)
    db.add(user)
    db.commit()
    db.refresh(user)
    expires = datetime.now(timezone.utc) + timedelta(seconds=settings.ANONYMOUS_SESSION_TTL_SECONDS)
    token = jwt.encode(
        {"sub": user.id, "type": "anonymous_session", "iss": "ai-career-mentor", "aud": "anonymous-session", "exp": expires},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return user, token


def get_anonymous_user(cookie_value: str | None, db: Session) -> User | None:
    """Resolve only an unexpired anonymous-session cookie; never accept bearer tokens here."""
    if not cookie_value:
        return None
    try:
        payload = jwt.decode(
            cookie_value,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience="anonymous-session",
            issuer="ai-career-mentor",
        )
        if payload.get("type") != "anonymous_session":
            return None
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.email.startswith("anon-") or not user.email.endswith("@anonymous.invalid"):
        return None
    return user


def get_or_create_guest_user(db: Session) -> User:
    """Return the single local workspace user used when authentication is disabled."""
    user = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if user is None:
        user = User(name="Local User", email=GUEST_EMAIL, hashed_pw=None)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def get_current_user(request: Request, token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if settings.AUTH_DISABLED:
        return get_or_create_guest_user(db)

    if settings.PUBLIC_ANONYMOUS_ACCESS:
        origin = request.headers.get("origin")
        if origin and not is_allowed_public_origin(origin, request.headers):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origin not allowed")
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_allowed_public_origin(origin, request.headers):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origin not allowed")
        user = get_anonymous_user(request.cookies.get(settings.ANONYMOUS_SESSION_COOKIE), db)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Anonymous session required",
            )
        return user

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    try:
        from app.core.observability import track_active_user
        track_active_user(user.id)
    except Exception:
        pass
        
    return user
