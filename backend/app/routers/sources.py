"""Data Sources router: API/OAuth/Scraper → Raw → Immutable Dataset Version.
Research Log & dataset TIDAK PERNAH menyimpan secret (config disanitasi).
Spek Dataset Studio: capabilities (§Tahap2), preflight terpisah (§Tahap2),
fetch = job async 202 (§Tahap3), OAuth koneksi terpisah dari login (§6B).
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.rate import limiter
from app.core.urlguard import guard_url
from app.models import DataSource, OAuthConnection, Project, User
from app.services.connectors.base import get_connector
from app.services.connectors import http_api as _http  # noqa: F401 (registrasi)
from app.services.connectors import scraper as _scr  # noqa: F401 (registrasi)
from app.services.connectors import youtube as _yt  # noqa: F401 (registrasi)
from app.services.connectors import base as _base
from app.services.connectors.capabilities import all_capabilities, capability
from app.services.connectors.oauth import decrypt_token, encrypt_token

router = APIRouter(prefix="/api/v1", tags=["data-sources"])

MAX_RECORDS = 20000
BROWSER_PROVIDERS = {"tiktok_comments", "instagram_comments", "youtube_comments", "facebook_comments", "x_comments"}


class FetchIn(BaseModel):
    kind: str
    provider: str
    config: dict = Field(default_factory=dict)
    # access_mode: public | oauth | api_key | session (spek §1: tanpa akun = default)
    access_mode: str = Field(default="public", max_length=16)


class PreflightIn(BaseModel):
    kind: str = "scraper"
    provider: str
    access_mode: str = Field(default="public", max_length=16)
    config: dict = Field(default_factory=dict)


class OAuthStoreIn(BaseModel):
    provider: str = Field(min_length=1, max_length=80)
    access_token: str = Field(min_length=1)
    refresh_token: str | None = None
    granted_scopes: list[str] = Field(default_factory=list)
    expires_in: int | None = Field(default=None, ge=0)
    provider_account_id: str | None = Field(default=None, max_length=200)
    meta: dict = Field(default_factory=dict)


class OAuthRefreshIn(BaseModel):
    token_endpoint: str
    client_id: str
    client_secret: str


def _validate_fetch(db: Session, user: User, project_id: uuid.UUID, kind: str, provider: str, access_mode: str, raw_config: dict) -> tuple[dict, dict, list[str]]:
    """Validasi definitif SEBELUM enqueue (dipakai preflight + fetch).
    Return (config_bersih, capability, warnings). Raise HTTPException bila gagal."""
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    try:
        get_connector(kind, provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    cap = capability(kind, provider)
    if access_mode not in cap["access_modes"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Metode '{access_mode}' tidak didukung {cap['label']}. Didukung: {', '.join(cap['access_modes'])}. {cap['note']}")
    config = dict(raw_config or {})
    warnings: list[str] = []
    if cap["note"]:
        warnings.append(cap["note"])
    # SSRF-guard untuk URL target (spek §6D).
    if config.get("url"):
        try:
            config["url"] = guard_url(str(config["url"]))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    # Batas rekaman: clamp ke kapabilitas (bukan gagal diam-diam).
    try:
        limit = int(config.get("limit", cap["default_limit"]))
    except (TypeError, ValueError):
        limit = cap["default_limit"]
    if limit < 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Limit minimal 1.")
    if limit > cap["max_limit"]:
        warnings.append(f"Limit {limit} melebihi batas {cap['label']} ({cap['max_limit']}) — dibatasi otomatis.")
        limit = cap["max_limit"]
    config["limit"] = limit
    # OAuth mode: koneksi wajib sudah ada (hubungkan dulu, bukan saat fetch).
    if access_mode == "oauth" or config.pop("use_oauth", False):
        access_mode = "oauth"
        oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == provider, OAuthConnection.status == "active").first()
        if not oc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Belum ada koneksi aktif '{provider}' — hubungkan dulu di tab Sosmed (OAuth), lalu ulangi.")
        config["use_oauth"] = True
    # Session mode: storage_state hanya bila diizinkan (spek §6C P0).
    if access_mode == "session" or "storage_state" in config:
        if "storage_state" in config and not settings.storage_state_allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Login via storage_state.json dinonaktifkan di server ini (kebijakan keamanan). Gunakan mode publik atau OAuth.")
        if "storage_state" not in config:
            warnings.append("Tanpa file login: hanya konten publik yang bisa diambil.")
    if access_mode == "api_key" and not config.get("api_key") and not (config.get("headers") or {}).get("Authorization"):
        warnings.append("Mode API key tanpa api_key/headers — endpoint publik mungkin tetap bisa, privat akan gagal.")
    return config, cap, warnings


@router.get("/data-sources/connectors")
def list_connectors(user: User = Depends(get_current_user)) -> list[dict]:
    _ = user
    return [{"kind": c.kind, "provider": c.provider} for c in _base.REGISTRY.values()]


@router.get("/sources/capabilities")
def sources_capabilities(user: User = Depends(get_current_user)) -> list[dict]:
    """Registry kapabilitas (spek Tahap 2): UI membaca ini, bukan asumsi."""
    _ = user
    return all_capabilities()


@router.post("/datasets/preflight")
@limiter.limit("30/minute")
def datasets_preflight(request: Request, body: PreflightIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Validasi konfigurasi TANPA mengambil data (spek Tahap 2).
    Preflight sukses TIDAK menjamin data ada — eksekusi tetap via job."""
    _ = request
    proj = db.query(Project).filter(Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buat project dulu sebelum preflight.")
    config, cap, warnings = _validate_fetch(db, user, proj.id, body.kind, body.provider, body.access_mode, body.config)
    checks = [
        {"name": "connector", "ok": True, "detail": f"{cap['label']} tersedia"},
        {"name": "access_mode", "ok": True, "detail": f"mode '{body.access_mode}' didukung"},
        {"name": "target", "ok": True, "detail": "URL lolos SSRF-guard" if config.get("url") else "tanpa URL target (mode API)"},
        {"name": "limit", "ok": True, "detail": f"limit efektif {config.get('limit')}"},
    ]
    if body.access_mode == "oauth":
        oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == body.provider, OAuthConnection.status == "active").first()
        scopes = ", ".join(oc.granted_scopes or []) if oc else ""
        checks.append({"name": "oauth", "ok": oc is not None,
                       "detail": f"terhubung ({scopes})" if oc else "belum terhubung — hubungkan dulu"})
    return {"ok": all(c["ok"] for c in checks), "checks": checks, "warnings": warnings,
            "effective": {"kind": body.kind, "provider": body.provider, "access_mode": body.access_mode, "limit": config.get("limit")}}


@router.post("/projects/{project_id}/data-sources/fetch", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
def fetch_source(request: Request, project_id: uuid.UUID, body: FetchIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Buat extraction JOB (spek Tahap 3): 202 + job_id, poll GET /api/v1/jobs/{job_id}.
    Header Idempotency-Key opsional: kirim ulang aman, job tidak duplikat."""
    from app.core import idempotency as _idem
    from app.tasks.fetch_source import fetch_source_job

    config, cap, warnings = _validate_fetch(db, user, project_id, body.kind, body.provider, body.access_mode, body.config)
    _ = cap
    key = (request.headers.get("Idempotency-Key") or "").strip()[:128]
    if key:
        r = _idem._redis()
        if r is not None:
            import json as _json
            raw = r.get(f"idem:fetch:{project_id}:{user.id}:{key}")
            if raw:
                try:
                    prev = _json.loads(raw)
                    if prev.get("job_id"):
                        return {"job_id": prev["job_id"], "status": "queued", "deduped": True, "warnings": warnings}
                except ValueError:
                    pass
    job = fetch_source_job.delay(str(project_id), body.kind, body.provider, config, str(user.id))
    if key:
        import json as _json
        from app.core import idempotency as _idem2
        r2 = _idem2._redis()
        if r2 is not None:
            r2.set(f"idem:fetch:{project_id}:{user.id}:{key}", _json.dumps({"job_id": job.id, "status": "queued"}), ex=_idem2.TTL)
    return {"job_id": job.id, "status": "queued", "warnings": warnings}


@router.post("/oauth/connections", status_code=status.HTTP_201_CREATED)
def store_oauth(body: OAuthStoreIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    blob, fallback = encrypt_token({"access_token": body.access_token, **({"refresh_token": body.refresh_token} if body.refresh_token else {})})
    exp = None
    if body.expires_in:
        from datetime import timedelta
        exp = datetime.now(timezone.utc) + timedelta(seconds=body.expires_in)
    oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == body.provider).first()
    if oc:
        oc.encrypted_token = blob
        oc.meta = {**(body.meta or {}), "dev_key_fallback": fallback}
        oc.granted_scopes = body.granted_scopes or oc.granted_scopes
        oc.expires_at = exp or oc.expires_at
        oc.provider_account_id = body.provider_account_id or oc.provider_account_id
        oc.status = "active"
        oc.revoked_at = None
    else:
        oc = OAuthConnection(user_id=user.id, provider=body.provider, encrypted_token=blob, meta={**(body.meta or {}), "dev_key_fallback": fallback},
                             granted_scopes=body.granted_scopes, expires_at=exp, provider_account_id=body.provider_account_id, status="active")
        db.add(oc)
    db.commit()
    return {"provider": body.provider, "stored": True, "dev_key_fallback": fallback}


YOUTUBE_OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.readonly"


@router.get("/oauth/youtube/start")
def youtube_oauth_start(user: User = Depends(get_current_user)) -> dict:
    """OAuth B nyata untuk YouTube (spek §2/§6B): izin API terpisah dari login aplikasi.
    Butuh GOOGLE_CLIENT_ID/SECRET yang sama; scope youtube.readonly."""
    from app.core.oauth_state import issue

    cid = settings.google_client_id
    if not cid or not settings.google_client_secret:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="OAuth YouTube belum dikonfigurasi (GOOGLE_CLIENT_ID/SECRET kosong)")
    redir = f"{settings.frontend_url}/auth/callback"
    state = issue("youtube", redir)
    q = {"response_type": "code", "client_id": cid, "redirect_uri": redir, "scope": f"openid email profile {YOUTUBE_OAUTH_SCOPE}",
         "access_type": "offline", "prompt": "consent", "state": state}
    import urllib.parse
    return {"url": "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(q), "state": state,
            "scope": YOUTUBE_OAUTH_SCOPE, "note": "Izin ini HANYA untuk YouTube Data API, bukan login aplikasi."}


class YoutubeCallbackIn(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)


@router.post("/oauth/youtube/callback", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def youtube_oauth_callback(request: Request, body: YoutubeCallbackIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    from app.core.oauth_state import consume
    from app.services.connectors.oauth import exchange_code

    _ = request
    cid, secret = settings.google_client_id, settings.google_client_secret
    if not cid or not secret:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="OAuth YouTube belum dikonfigurasi")
    redir = f"{settings.frontend_url}/auth/callback"
    try:
        consume("youtube", body.state, redir)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    try:
        tok = exchange_code("https://oauth2.googleapis.com/token", body.code, cid, secret, redir)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Token exchange gagal: {e}")
    blob, fallback = encrypt_token(tok)
    scopes = (tok.get("scope") or "").split()
    exp = None
    if tok.get("expires_in"):
        from datetime import timedelta
        exp = datetime.now(timezone.utc) + timedelta(seconds=int(tok["expires_in"]))
    oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == "youtube").first()
    if oc:
        oc.encrypted_token = blob
        oc.granted_scopes = scopes
        oc.expires_at = exp
        oc.status = "active"
        oc.revoked_at = None
        oc.meta = {**(oc.meta or {}), "dev_key_fallback": fallback}
    else:
        oc = OAuthConnection(user_id=user.id, provider="youtube", encrypted_token=blob, granted_scopes=scopes,
                             expires_at=exp, status="active", meta={"dev_key_fallback": fallback})
        db.add(oc)
    db.commit()
    return {"provider": "youtube", "stored": True, "scopes": scopes, "dev_key_fallback": fallback}


@router.get("/oauth/connections")
def list_oauth(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id).all()
    return [{"provider": r.provider, "status": r.status, "scopes": r.granted_scopes or [],
             "expires_at": r.expires_at.isoformat() if r.expires_at else None,
             "provider_account_id": r.provider_account_id,
             "updated_at": r.updated_at.isoformat() if r.updated_at else None} for r in rows]


@router.delete("/oauth/connections/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_oauth(provider: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Cabut koneksi (soft-revoke: token dihapus, baris audit dipertahankan)."""
    from datetime import datetime, timezone

    oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == provider).first()
    if not oc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Koneksi tidak ditemukan")
    oc.encrypted_token = ""
    oc.status = "revoked"
    oc.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return None


@router.post("/oauth/connections/{provider}/refresh")
def refresh_oauth(provider: str, body: OAuthRefreshIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    from app.services.connectors.oauth import refresh_access_token

    oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == provider).first()
    if not oc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Koneksi tidak ditemukan")
    try:
        tok = decrypt_token(oc.encrypted_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{e} — hapus koneksi dan hubungkan ulang")
    rt = tok.get("refresh_token") if isinstance(tok, dict) else None
    if not rt:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tidak ada refresh_token tersimpan — hubungkan ulang")
    try:
        new_tok = refresh_access_token(body.token_endpoint, body.client_id, body.client_secret, rt)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    blob, fallback = encrypt_token(new_tok if isinstance(new_tok, dict) else {"access_token": new_tok})
    oc.encrypted_token = blob
    oc.meta = {**(oc.meta or {}), "token_endpoint": body.token_endpoint, "dev_key_fallback": fallback}
    db.commit()
    return {"provider": provider, "refreshed": True}


@router.get("/projects/{project_id}/data-sources")
def list_sources(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    rows = db.query(DataSource).filter(DataSource.project_id == project_id).order_by(DataSource.created_at.desc()).all()
    return [{"id": str(r.id), "kind": r.kind, "provider": r.provider, "config": r.config, "raw_hash": (r.raw_hash[:16] + "…") if r.raw_hash else None, "record_count": r.record_count, "dataset_id": str(r.dataset_id) if r.dataset_id else None, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


class ScrapeInspectIn(BaseModel):
    url: str = Field(min_length=8, max_length=2000)


@router.get("/scraper/presets")
def scraper_presets(user: User = Depends(get_current_user)) -> list[dict]:
    from app.services.connectors.scraper import PRESETS

    _ = user
    try:
        presets = list(PRESETS.values()) if hasattr(PRESETS, "values") else list(PRESETS)
    except Exception:
        presets = []
    presets.extend([
        {"id": "tiktok_comments", "name": "TikTok Comments", "description": "Scrape komentar video TikTok", "kind": "scraper", "provider": "tiktok_comments", "fields": [{"name": "url", "label": "TikTok Video URL", "type": "url", "required": True}, {"name": "limit", "label": "Limit", "type": "number", "default": 500}, {"name": "scroll_delay_ms", "label": "Scroll Delay (ms)", "type": "number", "default": 800}, {"name": "storage_state", "label": "Storage State (JSON, opsional)", "type": "textarea"}, {"name": "headless", "label": "Headless", "type": "checkbox", "default": True}]},
        {"id": "instagram_comments", "name": "Instagram Comments", "description": "Scrape komentar IG Post/Reels", "kind": "scraper", "provider": "instagram_comments", "fields": [{"name": "url", "label": "Instagram URL", "type": "url", "required": True}, {"name": "limit", "label": "Limit", "type": "number", "default": 300}, {"name": "storage_state", "label": "Storage State (JSON, opsional)", "type": "textarea"}, {"name": "headless", "label": "Headless", "type": "checkbox", "default": True}]},
        {"id": "youtube_comments", "name": "YouTube Comments", "description": "Scrape komentar YouTube", "kind": "scraper", "provider": "youtube_comments", "fields": [{"name": "url", "label": "YouTube Video URL", "type": "url", "required": True}, {"name": "limit", "label": "Limit", "type": "number", "default": 500}, {"name": "storage_state", "label": "Storage State (JSON, opsional)", "type": "textarea"}, {"name": "headless", "label": "Headless", "type": "checkbox", "default": True}]},
        {"id": "facebook_comments", "name": "Facebook Comments", "description": "Scrape komentar Facebook Post", "kind": "scraper", "provider": "facebook_comments", "fields": [{"name": "url", "label": "Facebook Post URL", "type": "url", "required": True}, {"name": "limit", "label": "Limit", "type": "number", "default": 300}, {"name": "storage_state", "label": "Storage State (JSON, opsional)", "type": "textarea"}, {"name": "headless", "label": "Headless", "type": "checkbox", "default": True}]},
        {"id": "x_comments", "name": "X (Twitter) Replies", "description": "Scrape replies X/Twitter", "kind": "scraper", "provider": "x_comments", "fields": [{"name": "url", "label": "X Post URL", "type": "url", "required": True}, {"name": "limit", "label": "Limit", "type": "number", "default": 300}, {"name": "storage_state", "label": "Storage State (JSON, opsional)", "type": "textarea"}, {"name": "headless", "label": "Headless", "type": "checkbox", "default": True}]},
    ])
    return presets


@router.post("/scraper/inspect")
@limiter.limit("30/minute")
def scraper_inspect(request: Request, body: ScrapeInspectIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Pratinjau tabel di URL (allowlist + SSRF-guard + robots tetap ditegakkan). Tanpa menyimpan."""
    from app.services.connectors.scraper import ScraperError as _SE
    from app.services.connectors.scraper import inspect_url

    _ = (db, request)
    try:
        clean = guard_url(body.url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    try:
        return inspect_url(clean, {})
    except (_SE, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/scraper/request-log")
def scraper_log(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    _ = (db, user)
    from app.services.connectors.scraper import REQUEST_LOG

    return REQUEST_LOG[-limit:]
