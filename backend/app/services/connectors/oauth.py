"""OAuth: token terenkripsi per user, tak pernah masuk dataset/research log.
Research Log hanya menyimpan metadata (provider, retrieved_at, scope hash).
Butuh env OAUTH_ENCRYPTION_KEY (fernet, 32 byte urlsafe-base64); fallback
JWT_SECRET hanya untuk DEV dan dicatat di metadata sebagai 'dev-fallback'.
"""
from __future__ import annotations
import base64
import hashlib
import json
import os
import urllib.parse
import urllib.request
from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> tuple[Fernet, bool]:
    key = os.getenv("OAUTH_ENCRYPTION_KEY", "")
    if key:
        return Fernet(key.encode()), False
    raw = os.getenv("JWT_SECRET", "change_me").encode()
    digest = hashlib.sha256(b"oauth|" + raw).digest()
    return Fernet(base64.urlsafe_b64encode(digest)), True


def encrypt_token(token: dict | str) -> tuple[str, bool]:
    f, fallback = _fernet()
    payload = token if isinstance(token, str) else json.dumps(token)
    return f.encrypt(payload.encode()).decode(), fallback


def decrypt_token(blob: str) -> dict | str:
    f, _ = _fernet()
    try:
        raw = f.decrypt(blob.encode()).decode()
    except InvalidToken as e:
        raise ValueError("Token tidak dapat didekripsi (kunci berubah?)") from e
    try:
        return json.loads(raw)
    except ValueError:
        return raw


def authorization_url(auth_endpoint: str, client_id: str, redirect_uri: str, scope: str = "", state: str = "") -> str:
    q = {"response_type": "code", "client_id": client_id, "redirect_uri": redirect_uri}
    if scope:
        q["scope"] = scope
    if state:
        q["state"] = state
    return auth_endpoint + ("&" if "?" in auth_endpoint else "?") + urllib.parse.urlencode(q)


def exchange_code(token_endpoint: str, code: str, client_id: str, client_secret: str, redirect_uri: str, timeout: int = 15) -> dict:
    body = urllib.parse.urlencode({"grant_type": "authorization_code", "code": code, "client_id": client_id, "client_secret": client_secret, "redirect_uri": redirect_uri}).encode()
    req = urllib.request.Request(token_endpoint, data=body, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status >= 400:
            raise ValueError(f"Token exchange HTTP {resp.status}")
        data = json.loads(resp.read())
    if "access_token" not in data:
        raise ValueError("Respons token tanpa access_token")
    return data


def client_credentials(token_endpoint: str, client_id: str, client_secret: str, scope: str = "", timeout: int = 15) -> dict:
    body = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": client_id, "scope": scope}).encode()
    raw = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    req = urllib.request.Request(token_endpoint, data=body, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {raw}"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status >= 400:
            raise ValueError(f"Token HTTP {resp.status}")
        return json.loads(resp.read())
