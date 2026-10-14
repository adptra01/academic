"""Celery task pengambilan data sumber (spek Tahap 3).
Eksekusi berat (Playwright/API) TIDAK di request thread: endpoint mengembalikan
202 + job_id, frontend mem-poll GET /api/v1/jobs/{job_id}.
Stage via self.update_state(meta={"stage": ...}): validating → running →
normalizing. Hasil SUCCESS: {dataset_id, version, profile, provenance,
partial, warnings}. FAILURE menyimpan error + tahap gagal.
"""
from app.core.queue import celery_app


def _fail(stage: str, msg: str):
    raise ValueError(f"[{stage}] {msg}")


@celery_app.task(name="fetch_source_job", bind=True)
def fetch_source_job(self, project_id: str, kind: str, provider: str, config: dict, user_id: str) -> dict:
    import uuid as _uuid
    import pandas as _pd
    from app.core.db import SessionLocal as _Session
    from app.models import Dataset as _Dataset, DatasetVersion as _DatasetVersion, DataSource as _DataSource, OAuthConnection as _OAuthConnection, Project as _Project, Variable as _Variable
    from app.services.dataset_service import profile_dataframe as _prof
    from app.core.storage import save_upload as _save
    from app.core.urlguard import guard_url as _guard
    from app.services.connectors.base import get_connector as _get, sanitize_config as _san
    from app.services.connectors import http_api as _http  # noqa: F401 (registrasi)
    from app.services.connectors import scraper as _scr  # noqa: F401 (registrasi)
    from app.services.connectors import youtube as _yt  # noqa: F401 (registrasi)
    from app.services.connectors import base as _base  # noqa: F401

    MAX_RECORDS = 20000
    self.update_state(state="STARTED", meta={"stage": "validating"})
    db = _Session()
    try:
        try:
            proj = db.query(_Project).filter(_Project.id == _uuid.UUID(project_id), _Project.user_id == _uuid.UUID(user_id)).first()
            if not proj:
                _fail("validating", "Project tidak ditemukan")
            try:
                conn = _get(kind, provider)
            except ValueError as e:
                _fail("validating", str(e))
            cfg = dict(config or {})
            if "url" in cfg and cfg["url"]:
                try:
                    cfg["url"] = _guard(str(cfg["url"]))
                except ValueError as e:
                    _fail("validating", str(e))
            if cfg.pop("use_oauth", False):
                oc = db.query(_OAuthConnection).filter(_OAuthConnection.user_id == _uuid.UUID(user_id), _OAuthConnection.provider == provider).first()
                if not oc:
                    _fail("validating", f"Belum ada koneksi OAuth '{provider}'")
                from app.services.connectors.oauth import decrypt_token as _dec
                tok = _dec(oc.encrypted_token)
                at = tok.get("access_token") if isinstance(tok, dict) else tok
                headers = dict(cfg.get("headers") or {})
                headers.setdefault("Authorization", f"Bearer {at}")
                cfg["headers"] = headers
            self.update_state(state="STARTED", meta={"stage": "running"})
            from app.services.connectors.http_api import ConnectorError as _CE
            from app.services.connectors.scraper import ScraperError as _SE
            from app.services.connectors.browser_base import BrowserScraperError as _BSE
            try:
                fetched = conn.fetch(cfg)
            except (_CE, _SE, _BSE, ValueError) as e:
                _fail("running", str(e))
            if not fetched.records:
                _fail("running", "Sumber mengembalikan 0 records")
            if len(fetched.records) > MAX_RECORDS:
                _fail("running", f"Terlalu banyak records ({len(fetched.records)} > {MAX_RECORDS}) — persempit query")
            self.update_state(state="STARTED", meta={"stage": "normalizing"})
            df = _pd.DataFrame(fetched.records)
            if df.shape[1] == 0:
                _fail("normalizing", "Records kosong")
            content = df.to_csv(index=False, encoding="utf-8").encode("utf-8")
            storage_path = _save(str(project_id), f"{provider}_import.csv", content)
            prof = _prof(df)
            ds = _Dataset(project_id=_uuid.UUID(project_id), filename=f"{provider}_import.csv", storage_path=storage_path, file_type="csv", size_bytes=len(content), rows_count=prof["rows"], cols_count=prof["cols"], source_kind=f"{kind}:{provider}", source_meta=fetched.provenance)
            db.add(ds)
            db.flush()
            v1 = _DatasetVersion(dataset_id=ds.id, version_number=1, parent_version_id=None, transformation_log=[{"op": "source_import", **fetched.provenance}], active_columns=[c["name"] for c in prof["columns"]])
            db.add(v1)
            db.flush()
            for c in prof["columns"]:
                db.add(_Variable(dataset_version_id=v1.id, name=c["name"], var_type=c["detected_type"], var_role="Ignore"))
            warnings = [w for w in (fetched.provenance.get("warnings") or []) if isinstance(w, str)]
            src = _DataSource(user_id=_uuid.UUID(user_id), project_id=_uuid.UUID(project_id), kind=kind, provider=provider, config=_san(cfg), raw_hash=fetched.provenance.get("raw_hash"), record_count=len(fetched.records), dataset_id=ds.id)
            db.add(src)
            db.commit()
            return {"dataset_id": str(ds.id), "version": 1, "profile": prof, "provenance": fetched.provenance,
                    "partial": bool(warnings), "warnings": warnings}
        finally:
            db.close()
    except ValueError:
        raise
    except Exception as e:
        _fail("running", f"Kesalahan internal worker: {e}")
