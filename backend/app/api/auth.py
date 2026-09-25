from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User
from app.models.schemas import UserRegister, UserLogin, TokenResponse, GoogleLogin, RefreshTokenRequest
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, SECRET_KEY, ALGORITHM
from google.oauth2 import id_token
from google.auth.transport import requests
from app.core.config import settings
from jose import JWTError, jwt
from loguru import logger
from app.core.observability import track_user_registration

router = APIRouter()


def _token_pair(user: User) -> dict:
    payload = {"sub": str(user.id)}
    return {
        "access_token": create_access_token(data=payload),
        "refresh_token": create_refresh_token(data=payload),
        "token_type": "bearer",
        "name": user.name,
        "email": user.email,
    }

@router.post("/register", response_model=TokenResponse)
def register(user: UserRegister, db: Session = Depends(get_db)):
    email_clean = user.email.strip().lower()
    
    db_user = db.query(User).filter(User.email == email_clean).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pw = get_password_hash(user.password)
    new_user = User(name=user.name, email=email_clean, hashed_pw=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    track_user_registration()
    
    return _token_pair(new_user)

@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    email_clean = user.email.strip().lower()
    logger.info("Login attempt received")
    
    db_user = db.query(User).filter(User.email == email_clean).first()
    if not db_user:
        logger.warning("Login failed: user not found")
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if not db_user.hashed_pw:
        logger.warning("Login failed: user has no password login")
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    pw_verified = verify_password(user.password, db_user.hashed_pw)
    if not pw_verified:
        logger.warning("Login failed: invalid credentials")
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    return _token_pair(db_user)

@router.post("/google", response_model=TokenResponse)
def google_login(data: GoogleLogin, db: Session = Depends(get_db)):
    try:
        token_str = data.credential.strip()
        
        # Google Access Tokens start with 'ya29.' or do not have JWT segments
        if token_str.startswith("ya29.") or token_str.count(".") < 2:
            import httpx
            # Query Google UserInfo API with the Access Token
            userinfo_response = httpx.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token_str}"},
                timeout=10.0
            )
            if userinfo_response.status_code != 200:
                raise ValueError(f"Google Access Token verification failed with status {userinfo_response.status_code}")
            idinfo = userinfo_response.json()
        else:
            # Verify as a standard JWT ID Token
            idinfo = id_token.verify_oauth2_token(
                token_str, 
                requests.Request(), 
                settings.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=10 # Allow 10 seconds leeway for clock skew
            )

        email = idinfo['email'].strip().lower()
        name = idinfo.get('name', email.split('@')[0])
        
        # Check if user exists
        db_user = db.query(User).filter(User.email == email).first()
        
        if not db_user:
            # Create new user for first-time Google login
            db_user = User(name=name, email=email, hashed_pw=None) 
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            track_user_registration()
            
        return _token_pair(db_user)

    except Exception as e:
        logger.error(f"Google Auth Error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Google authentication failed: {str(e)}")



@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
    )
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise credentials_exception

    return _token_pair(db_user)
