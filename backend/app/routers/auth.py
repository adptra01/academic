"""Auth router: register/login/logout/me. US-001 + US-002."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_token
from app.core.rate import limiter
from app.models import User
from app.schemas import RegisterIn, LoginIn, ChangePasswordIn, TokenOut, UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 24 * 3600  # sinkron dengan JWT_EXPIRE_HOURS default


def _user_out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, name=u.name, created_at=u.created_at)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(request: Request, body: RegisterIn, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    email = body.email.lower().strip()
    exists = db.query(User).filter(func.lower(User.email) == email).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email sudah terdaftar")
    user = User(email=email, password_hash=hash_password(body.password), name=body.name.strip())
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(str(user.id))
    response.set_cookie(COOKIE_NAME, token, max_age=COOKIE_MAX_AGE, httponly=True, samesite="lax", secure=settings.cookie_secure)
    return TokenOut(access_token=token, user=_user_out(user))


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, body: LoginIn, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    email = body.email.lower().strip()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    # Pesan generik: jangan bocorkan email vs password yang salah (US-002).
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email atau password salah")
    token = create_token(str(user.id))
    response.set_cookie(COOKIE_NAME, token, max_age=COOKIE_MAX_AGE, httponly=True, samesite="lax", secure=settings.cookie_secure)
    return TokenOut(access_token=token, user=_user_out(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)
    return None


@router.post("/change-password", response_model=UserOut)
@limiter.limit("10/minute")
def change_password(request: Request, body: ChangePasswordIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UserOut:
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password lama salah")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return _user_out(user)
