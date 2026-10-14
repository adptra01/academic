"""Login sosial (Google OAuth2): otentikasi via akun Google, sesi tetap JWT internal.
Alur: frontend → GET /auth/google/url → redirect Google → callback code →
POST /auth/google/callback → verifikasi ID token → find-or-create user → TokenOut.
Auto-link HANYA bila Google menyatakan email_verified=true.
Butuh env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
"""
import urllib.parse
import urllib.request
import json
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.db import get_db
from app.core.config import settings
from app.core.security import create_token
from app.core.rate import limiter
from app.models import User
from app.schemas import TokenOut, UserOut
from fastapi import Request

router = APIRouter(prefix="/api/v1/auth", tags=["social-auth"])

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
OAUTH_MARKER = "oauth:google:"


class GoogleCallbackIn(BaseModel):
    code: str = Field(min_length=1)
    redirect_uri: str | None = None
    state: str | None = None


def _enabled() -> tuple[str, str]:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID/SECRET kosong)")
    return settings.google_client_id, settings.google_client_secret


@router.get("/google/url")
def google_url(redirect_uri: str | None = None) -> dict:
    from app.core.oauth_state import issue

    cid, _ = _enabled()
    redir = redirect_uri or f"{settings.frontend_url}/auth/callback"
    state = issue("google", redir)
    q = {"response_type": "code", "client_id": cid, "redirect_uri": redir, "scope": "openid email profile", "access_type": "online", "prompt": "select_account", "state": state}
    return {"url": GOOGLE_AUTH + "?" + urllib.parse.urlencode(q), "redirect_uri": redir, "state": state}


@router.post("/google/callback", response_model=TokenOut)
@limiter.limit("10/minute")
def google_callback(request: Request, body: GoogleCallbackIn, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    from app.core.oauth_state import consume

    cid, secret = _enabled()
    redir = body.redirect_uri or f"{settings.frontend_url}/auth/callback"
    try:
        consume("google", body.state or "", redir)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    data = urllib.parse.urlencode({"grant_type": "authorization_code", "code": body.code, "client_id": cid, "client_secret": secret, "redirect_uri": redir}).encode()
    req = urllib.request.Request(GOOGLE_TOKEN, data=data, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            tok = json.loads(resp.read())
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Token exchange gagal: {e}")
    id_token = tok.get("id_token")
    if not id_token:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Google tidak mengembalikan id_token")
    try:
        from google.oauth2 import id_token as _id
        from google.auth.transport import requests as _req

        claims = _id.verify_oauth2_token(id_token, _req.Request(), cid)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"ID token tidak valid: {e}")
    email = (claims.get("email") or "").lower().strip()
    if not email or not claims.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email Google tak terverifikasi")
    name = (claims.get("name") or email.split("@")[0]).strip()[:100]
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        user = User(email=email, password_hash=OAUTH_MARKER + claims.get("sub", ""), name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_token(str(user.id))
    response.set_cookie("access_token", token, max_age=24 * 3600, httponly=True, samesite="lax", secure=settings.cookie_secure)
    return TokenOut(access_token=token, user=UserOut(id=user.id, email=user.email, name=user.name, created_at=user.created_at))
