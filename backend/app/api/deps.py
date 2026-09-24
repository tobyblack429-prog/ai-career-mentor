from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User
from app.core.security import SECRET_KEY, ALGORITHM
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

GUEST_EMAIL = "guest@local.careermentor"


def get_or_create_guest_user(db: Session) -> User:
    """Return the single local workspace user used when authentication is disabled."""
    user = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if user is None:
        user = User(name="Local User", email=GUEST_EMAIL, hashed_pw=None)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if settings.AUTH_DISABLED:
        return get_or_create_guest_user(db)

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
