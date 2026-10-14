"""Celery task preprocessing (rows > 10.000). Worker membaca ulang file agar request tidak timeout."""
from app.core.queue import celery_app
from app.tasks import fetch_source as _fetch_source  # noqa: F401 (registrasi task)


@celery_app.task(name="preprocess_dataset", bind=True)
def preprocess_dataset(self, dataset_id: str, base_version: int, operations: list[dict], user_id: str) -> dict:
    import uuid as _uuid
    from pathlib import Path as _Path
    from app.core.db import SessionLocal as _Session
    from app.core.config import settings as _settings
    from app.models import Dataset as _Dataset, DatasetVersion as _DatasetVersion, Project as _Project, Variable as _Variable
    from app.services.version_io import load_version_df as _load
    from app.services.dataset_service import profile_dataframe as _prof, suggest_type as _suggest
    from app.services.preprocess_service import apply_operations as _apply

    db = _Session()
    try:
        ds = db.query(_Dataset).join(_Project, _Project.id == _Dataset.project_id).filter(_Dataset.id == _uuid.UUID(dataset_id), _Project.user_id == _uuid.UUID(user_id)).first()
        if not ds:
            raise ValueError("Dataset tidak ditemukan")
        vs = db.query(_DatasetVersion).filter(_DatasetVersion.dataset_id == ds.id).order_by(_DatasetVersion.version_number).all()
        base = next((v for v in vs if v.version_number == base_version), None)
        if not base:
            raise ValueError(f"Version v{base_version} tidak ditemukan")
        df = _load(ds, base)
        new_df, details = _apply(df, operations)
        max_v = max(v.version_number for v in vs)
        dest = _Path(f"/code/storage/projects/{ds.project_id}/{ds.id}_v{max_v + 1}.csv")
        dest.parent.mkdir(parents=True, exist_ok=True)
        new_df.to_csv(dest, index=False, encoding="utf-8")
        prof = _prof(new_df)
        new_v = _DatasetVersion(dataset_id=ds.id, version_number=max_v + 1, parent_version_id=base.id, transformation_log=(base.transformation_log or []) + details, active_columns=list(new_df.columns), storage_path=str(dest))
        db.add(new_v)
        db.flush()
        prev_vars = db.query(_Variable).filter(_Variable.dataset_version_id == base.id).all()
        prev_map = {v.name: v for v in prev_vars}
        for c in new_df.columns:
            col = str(c)
            if col in prev_map:
                db.add(_Variable(dataset_version_id=new_v.id, name=col, var_type=prev_map[col].var_type, var_role=prev_map[col].var_role))
            else:
                db.add(_Variable(dataset_version_id=new_v.id, name=col, var_type=_suggest(new_df[col]), var_role="Ignore"))
        db.commit()
        return {"dataset_id": str(ds.id), "new_version": max_v + 1, "rows": prof["rows"], "cols": prof["cols"], "details": details}
    finally:
        db.close()
