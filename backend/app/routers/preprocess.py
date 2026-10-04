"""Preprocess router: transformasi → version baru (immutable). Sync ≤10k rows, async via Celery di atas itu (FR-11)."""
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from celery.result import AsyncResult
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.queue import celery_app
from app.models import Dataset, DatasetVersion, Project, User, Variable
from app.schemas.datasets import DatasetProfile
from app.services.dataset_service import profile_dataframe, suggest_type
from app.services.preprocess_service import apply_operations
from app.services.version_io import load_version_df

router = APIRouter(prefix="/api/v1", tags=["preprocess"])

SYNC_MAX_ROWS = 10_000


class PreprocessIn(BaseModel):
    base_version: int = Field(default=1, ge=1)
    operations: list[dict] = Field(min_length=1, max_length=50)


class PreprocessOut(BaseModel):
    dataset_id: uuid.UUID
    new_version: int
    rows_before: int
    rows: int
    cols: int
    details: list[dict]
    profile: DatasetProfile


def _get_ds(dataset_id: uuid.UUID, user: User, db: Session) -> tuple[Dataset, list[DatasetVersion]]:
    ds = db.query(Dataset).join(Project, Project.id == Dataset.project_id).filter(Dataset.id == dataset_id, Project.user_id == user.id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan")
    vs = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id).order_by(DatasetVersion.version_number).all()
    return ds, vs


def _build_new_version(db: Session, ds: Dataset, base, new_df, details: list[dict]):
    import pandas as pd  # noqa

    vs = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id).order_by(DatasetVersion.version_number).all()
    max_v = max(v.version_number for v in vs)
    dest = Path(f"/code/storage/projects/{ds.project_id}/{ds.id}_v{max_v + 1}.csv")
    dest.parent.mkdir(parents=True, exist_ok=True)
    new_df.to_csv(dest, index=False, encoding="utf-8")
    prof = profile_dataframe(new_df)
    new_v = DatasetVersion(dataset_id=ds.id, version_number=max_v + 1, parent_version_id=base.id, transformation_log=(base.transformation_log or []) + details, active_columns=list(new_df.columns), storage_path=str(dest))
    db.add(new_v)
    db.flush()
    prev_vars = db.query(Variable).filter(Variable.dataset_version_id == base.id).all()
    prev_map = {v.name: v for v in prev_vars}
    for c in new_df.columns:
        col = str(c)
        if col in prev_map:
            db.add(Variable(dataset_version_id=new_v.id, name=col, var_type=prev_map[col].var_type, var_role=prev_map[col].var_role))
        else:
            db.add(Variable(dataset_version_id=new_v.id, name=col, var_type=suggest_type(new_df[col]), var_role="Ignore"))
    db.commit()
    db.refresh(new_v)
    return new_v, prof


@router.post("/datasets/{dataset_id}/preprocess", status_code=status.HTTP_201_CREATED)
def preprocess(dataset_id: uuid.UUID, body: PreprocessIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ds, vs = _get_ds(dataset_id, user, db)
    base = next((v for v in vs if v.version_number == body.base_version), None)
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version v{body.base_version} tidak ditemukan")
    try:
        df = load_version_df(ds, base)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Gagal membaca base version: {e}")
    if len(df) > SYNC_MAX_ROWS:
        from app.tasks import preprocess_dataset

        job = preprocess_dataset.delay(str(ds.id), body.base_version, body.operations, str(user.id))
        return {"status": "queued", "job_id": job.id, "message": f"Dataset {len(df)} rows > {SYNC_MAX_ROWS}, diproses async. Poll GET /api/v1/jobs/{job.id}"}
    try:
        new_df, details = apply_operations(df, body.operations)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    new_v, prof = _build_new_version(db, ds, base, new_df, details)
    return PreprocessOut(dataset_id=ds.id, new_version=new_v.version_number, rows_before=len(df), rows=prof["rows"], cols=prof["cols"], details=details, profile=DatasetProfile(**prof))


@router.get("/jobs/{job_id}")
def job_status(job_id: str, user: User = Depends(get_current_user)) -> dict:
    _ = user
    res = AsyncResult(job_id, app=celery_app)
    out: dict = {"job_id": job_id, "state": res.state}
    if res.state == "SUCCESS":
        out["result"] = res.result
    elif res.state == "FAILURE":
        out["error"] = str(res.result)
    elif res.info:
        try:
            out["info"] = dict(res.info) if isinstance(res.info, dict) else str(res.info)
        except Exception:
            out["info"] = str(res.info)
    return out
