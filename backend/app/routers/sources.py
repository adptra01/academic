"""Data Sources router: API/OAuth/Scraper → Raw → Immutable Dataset Version.
Research Log & dataset TIDAK PERNAH menyimpan secret (config disanitasi).
"""
import uuid
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.storage import save_upload
from app.models import Dataset, DatasetVersion, DataSource, OAuthConnection, Project, User, Variable
from app.services.dataset_service import profile_dataframe
from app.services.connectors.base import get_connector, sanitize_config
from app.services.connectors import http_api as _http  # noqa: F401 (registrasi)
from app.services.connectors import scraper as _scr  # noqa: F401 (registrasi)
from app.services.connectors import base as _base
from app.services.connectors.oauth import decrypt_token, encrypt_token

router = APIRouter(prefix="/api/v1", tags=["data-sources"])

MAX_RECORDS = 20000


class FetchIn(BaseModel):
    kind: str
    provider: str
    config: dict = Field(default_factory=dict)


class OAuthStoreIn(BaseModel):
    provider: str = Field(min_length=1, max_length=80)
    access_token: str = Field(min_length=1)
    refresh_token: str | None = None
    meta: dict = Field(default_factory=dict)


@router.get("/data-sources/connectors")
def list_connectors(user: User = Depends(get_current_user)) -> list[dict]:
    _ = user
    return [{"kind": c.kind, "provider": c.provider} for c in _base.REGISTRY.values()]


@router.post("/projects/{project_id}/data-sources/fetch", status_code=status.HTTP_201_CREATED)
def fetch_source(project_id: uuid.UUID, body: FetchIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    try:
        conn = get_connector(body.kind, body.provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    config = dict(body.config or {})
    if config.pop("use_oauth", False):
        oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == body.provider).first()
        if not oc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Belum ada koneksi OAuth '{body.provider}' — simpan via POST /oauth/connections dulu")
        tok = decrypt_token(oc.encrypted_token)
        at = tok.get("access_token") if isinstance(tok, dict) else tok
        headers = dict(config.get("headers") or {})
        headers.setdefault("Authorization", f"Bearer {at}")
        config["headers"] = headers
    from app.services.connectors.http_api import ConnectorError as _CE
    from app.services.connectors.scraper import ScraperError as _SE

    try:
        fetched = conn.fetch(config)
    except (_CE, _SE, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    if not fetched.records:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sumber mengembalikan 0 records")
    if len(fetched.records) > MAX_RECORDS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Terlalu banyak records ({len(fetched.records)} > {MAX_RECORDS}) — persempit query")
    df = pd.DataFrame(fetched.records)
    if df.shape[1] == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Records kosong")
    content = df.to_csv(index=False, encoding="utf-8").encode("utf-8")
    storage_path = save_upload(str(project_id), f"{body.provider}_import.csv", content)
    prof = profile_dataframe(df)
    ds = Dataset(project_id=project_id, filename=f"{body.provider}_import.csv", storage_path=storage_path, file_type="csv", size_bytes=len(content), rows_count=prof["rows"], cols_count=prof["cols"], source_kind=f"{body.kind}:{body.provider}", source_meta=fetched.provenance)
    db.add(ds)
    db.flush()
    v1 = DatasetVersion(dataset_id=ds.id, version_number=1, parent_version_id=None, transformation_log=[{"op": "source_import", **fetched.provenance}], active_columns=[c["name"] for c in prof["columns"]])
    db.add(v1)
    db.flush()
    for c in prof["columns"]:
        db.add(Variable(dataset_version_id=v1.id, name=c["name"], var_type=c["detected_type"], var_role="Ignore"))
    src = DataSource(user_id=user.id, project_id=project_id, kind=body.kind, provider=body.provider, config=sanitize_config(config), raw_hash=fetched.provenance.get("raw_hash"), record_count=len(fetched.records), dataset_id=ds.id)
    db.add(src)
    db.commit()
    return {"dataset_id": str(ds.id), "version": 1, "profile": prof, "provenance": fetched.provenance}


@router.post("/oauth/connections", status_code=status.HTTP_201_CREATED)
def store_oauth(body: OAuthStoreIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    blob, fallback = encrypt_token({"access_token": body.access_token, **({"refresh_token": body.refresh_token} if body.refresh_token else {})})
    oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == body.provider).first()
    if oc:
        oc.encrypted_token = blob
        oc.meta = {**(body.meta or {}), "dev_key_fallback": fallback}
    else:
        oc = OAuthConnection(user_id=user.id, provider=body.provider, encrypted_token=blob, meta={**(body.meta or {}), "dev_key_fallback": fallback})
        db.add(oc)
    db.commit()
    return {"provider": body.provider, "stored": True, "dev_key_fallback": fallback}


@router.get("/oauth/connections")
def list_oauth(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id).all()
    return [{"provider": r.provider, "meta": r.meta, "updated_at": r.updated_at.isoformat() if r.updated_at else None} for r in rows]


@router.delete("/oauth/connections/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_oauth(provider: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    oc = db.query(OAuthConnection).filter(OAuthConnection.user_id == user.id, OAuthConnection.provider == provider).first()
    if not oc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Koneksi tidak ditemukan")
    db.delete(oc)
    db.commit()
    return None


@router.get("/projects/{project_id}/data-sources")
def list_sources(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    rows = db.query(DataSource).filter(DataSource.project_id == project_id).order_by(DataSource.created_at.desc()).all()
    return [{"id": str(r.id), "kind": r.kind, "provider": r.provider, "config": r.config, "raw_hash": (r.raw_hash[:16] + "…") if r.raw_hash else None, "record_count": r.record_count, "dataset_id": str(r.dataset_id) if r.dataset_id else None, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


@router.get("/scraper/request-log")
def scraper_log(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    _ = (db, user)
    from app.services.connectors.scraper import REQUEST_LOG

    return REQUEST_LOG[-limit:]
