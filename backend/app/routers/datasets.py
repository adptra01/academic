"""Dataset router: upload + preview + profile + versioning immutable. US-004/005/006 (FR-5/6/7)."""
import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from starlette.background import BackgroundTask
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.storage import save_upload
from app.core.config import settings
from app.models import Analysis, Dataset, DatasetVersion, Project, User, Variable
from app.schemas.datasets import DatasetOut, UploadOut, VersionOut, DatasetProfile
from app.services.dataset_service import ALLOWED_EXTS, profile_dataframe, preview_rows, read_dataset
from app.services.version_io import load_version_df

router = APIRouter(prefix="/api/v1", tags=["datasets"])


def _cleanup_tmp(path: str) -> BackgroundTask:
    """Hapus berkas sementara setelah respons selesai dikirim."""

    def _rm() -> None:
        try:
            os.unlink(path)
        except OSError:
            pass

    return BackgroundTask(_rm)

MAX_BYTES = 50 * 1024 * 1024  # di-override via settings.max_upload_mb jika diset


def _limit_bytes() -> int:
    return settings.max_upload_mb * 1024 * 1024


def _get_project(project_id: uuid.UUID, user: User, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    return p


def _dataset_out(ds: Dataset, versions: list[DatasetVersion]) -> DatasetOut:
    return DatasetOut(
        id=ds.id, project_id=ds.project_id, filename=ds.filename, file_type=ds.file_type,
        size_bytes=ds.size_bytes, rows_count=ds.rows_count, cols_count=ds.cols_count,
        created_at=ds.created_at,
        versions=[VersionOut(id=v.id, version_number=v.version_number, parent_version_id=v.parent_version_id, transformation_log=v.transformation_log, created_at=v.created_at) for v in versions],
    )


@router.post("/projects/{project_id}/datasets/upload", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(project_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UploadOut:
    _get_project(project_id, user, db)
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File wajib dilampirkan")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Format tidak didukung. Gunakan: {sorted(ALLOWED_EXTS)}")
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File kosong")
    if len(content) > _limit_bytes():
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File melebihi {settings.max_upload_mb}MB")

    storage_path = save_upload(str(project_id), file.filename, content)
    try:
        df = read_dataset(storage_path, ext)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"File tidak dapat dibaca: {e}")
    if df.shape[0] == 0 or df.shape[1] == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Dataset kosong (0 baris/kolom)")

    prof = profile_dataframe(df)
    ds = Dataset(project_id=project_id, filename=file.filename, storage_path=storage_path, file_type=ext, size_bytes=len(content), rows_count=prof["rows"], cols_count=prof["cols"])
    db.add(ds)
    db.flush()  # dapatkan ds.id
    v1 = DatasetVersion(dataset_id=ds.id, version_number=1, parent_version_id=None, transformation_log=[{"op": "upload", "filename": file.filename, "file_type": ext}], active_columns=[c["name"] for c in prof["columns"]])
    db.add(v1)
    db.flush()
    # auto-suggest variables (US-007 awal; user dapat ubah di Fase 4)
    for c in prof["columns"]:
        db.add(Variable(dataset_version_id=v1.id, name=c["name"], var_type=c["detected_type"], var_role="Ignore"))
    db.commit()
    db.refresh(ds)
    versions = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id).order_by(DatasetVersion.version_number).all()
    return UploadOut(dataset=_dataset_out(ds, versions), profile=DatasetProfile(**prof))


@router.get("/projects/{project_id}/datasets", response_model=list[DatasetOut])
def list_datasets(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[DatasetOut]:
    _get_project(project_id, user, db)
    rows = db.query(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.created_at.desc()).all()
    out: list[DatasetOut] = []
    for ds in rows:
        vs = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id).order_by(DatasetVersion.version_number).all()
        out.append(_dataset_out(ds, vs))
    return out


def _get_dataset(dataset_id: uuid.UUID, user: User, db: Session) -> tuple[Dataset, list[DatasetVersion]]:
    ds = db.query(Dataset).join(Project, Project.id == Dataset.project_id).filter(Dataset.id == dataset_id, Project.user_id == user.id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan")
    vs = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id).order_by(DatasetVersion.version_number).all()
    return ds, vs


@router.get("/datasets/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DatasetOut:
    ds, vs = _get_dataset(dataset_id, user, db)
    return _dataset_out(ds, vs)


@router.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    """Hapus dataset + file. DITOLAK (409) jika sudah ada analysis/log (lindungi reproducibility)."""
    from pathlib import Path as _Path

    ds, vs = _get_dataset(dataset_id, user, db)
    vids = [v.id for v in vs]
    n_analyses = db.query(Analysis).filter(Analysis.dataset_version_id.in_(vids)).count() if vids else 0
    if n_analyses:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Dataset memiliki {n_analyses} analysis — hapus/dokumentasikan analyses dulu agar jejak penelitian tidak hilang")
    paths = {ds.storage_path} | {v.storage_path for v in vs if v.storage_path}
    for v in vs:
        db.query(Variable).filter(Variable.dataset_version_id == v.id).delete()
        db.delete(v)
    db.delete(ds)
    db.commit()
    for p in paths:
        try:
            _Path(p).unlink(missing_ok=True)
        except OSError:
            pass
    return None


@router.get("/datasets/{dataset_id}/profile", response_model=DatasetProfile)
def get_profile(dataset_id: uuid.UUID, version: int = Query(1, ge=1), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DatasetProfile:
    ds, vs = _get_dataset(dataset_id, user, db)
    v = next((x for x in vs if x.version_number == version), None)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version v{version} tidak ditemukan")
    # v1 → file asli; vN+ → CSV hasil transformasi (Fase 3)
    df = load_version_df(ds, v)
    return DatasetProfile(**profile_dataframe(df))


@router.get("/datasets/{dataset_id}/download")
def download_version(dataset_id: uuid.UUID, version: int = Query(1, ge=1), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Unduh CSV dataset pada version tertentu (data bersih hasil preprocessing)."""
    from fastapi.responses import FileResponse as _FR

    ds, vs = _get_dataset(dataset_id, user, db)
    v = next((x for x in vs if x.version_number == version), None)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version v{version} tidak ditemukan")
    df = load_version_df(ds, v)
    # Berkas sementara dibuat lewat tempfile: path sebelumnya di-hardcode ke
    # /tmp/opencode (sisa lingkungan pengembangan) dan bisa tidak ada di server.
    with tempfile.NamedTemporaryFile(suffix=f"_v{version}.csv", delete=False) as tmp:
        out = tmp.name
    df.to_csv(out, index=False, encoding="utf-8")
    base = ds.filename.rsplit(".", 1)[0]
    return _FR(out, media_type="text/csv", filename=f"{base}_v{version}.csv",
               background=_cleanup_tmp(out))


@router.get("/datasets/{dataset_id}/diff")
def diff_versions(dataset_id: uuid.UUID, from_version: int = Query(1, ge=1, alias="from"), to_version: int = Query(..., ge=1, alias="to"), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Bandingkan dua version: delta baris, kolom tambah/hilang, drift mean numerik."""
    import pandas as pd

    ds, vs = _get_dataset(dataset_id, user, db)
    va = next((x for x in vs if x.version_number == from_version), None)
    vb = next((x for x in vs if x.version_number == to_version), None)
    if not va or not vb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salah satu version tidak ditemukan")
    dfa, dfb = load_version_df(ds, va), load_version_df(ds, vb)
    cols_a, cols_b = [str(c) for c in dfa.columns], [str(c) for c in dfb.columns]
    drift: list[dict] = []
    for c in cols_a:
        if c in dfb.columns:
            sa, sb = pd.to_numeric(dfa[c], errors="coerce"), pd.to_numeric(dfb[c], errors="coerce")
            if pd.api.types.is_numeric_dtype(sa.dtype) or sa.notna().sum():
                try:
                    drift.append({"column": c, "mean_from": clean_float(sa.mean()), "mean_to": clean_float(sb.mean()), "missing_from": int(sa.isna().sum()), "missing_to": int(sb.isna().sum())})
                except Exception:
                    pass
    return {
        "from": from_version, "to": to_version,
        "rows_from": int(len(dfa)), "rows_to": int(len(dfb)), "rows_delta": int(len(dfb) - len(dfa)),
        "columns_added": [c for c in cols_b if c not in cols_a],
        "columns_removed": [c for c in cols_a if c not in cols_b],
        "numeric_drift": drift,
    }


def clean_float(v) -> float | None:
    try:
        f = float(v)
        return f if f == f and abs(f) != float("inf") else None
    except (TypeError, ValueError):
        return None


@router.get("/datasets/{dataset_id}/preview")
def get_preview(dataset_id: uuid.UUID, version: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    ds, vs = _get_dataset(dataset_id, user, db)
    v = next((x for x in vs if x.version_number == version), None)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version v{version} tidak ditemukan")
    df = load_version_df(ds, v)
    data = preview_rows(df, limit=limit, offset=offset)
    data["dataset_id"] = str(ds.id)
    data["version"] = version
    data["columns"] = [str(c) for c in df.columns]
    return data
