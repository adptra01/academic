"""Analyses router: run 15 metode → Analysis ID + result + log immutable. US-010..017, US-018, US-021 (FR-12..25)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.models import Analysis, AnalysisResult, Dataset, DatasetVersion, Project, ResearchLog, User
from app.services.stats import METHOD_IDS, METHOD_NAMES, new_uid as make_uid, result_hash, run_analysis
from app.services.version_io import load_version_df

router = APIRouter(prefix="/api/v1", tags=["analyses"])

METHOD_VARIABLES_SPEC = {
    "descriptive": {"columns": "list[str] — 1..N kolom"},
    "normality": {"column": "str", "method": "auto|shapiro|dagostino (opsional)"},
    "pearson": {"x": "str numerik", "y": "str numerik"},
    "spearman": {"x": "str", "y": "str"},
    "ttest_1samp": {"column": "str numerik", "mu": "float pembanding"},
    "ttest_ind": {"column": "str numerik", "group": "str tepat 2 grup"},
    "ttest_paired": {"col1": "str", "col2": "str berpasangan"},
    "anova_oneway": {"column": "str numerik", "group": "str ≥3 grup"},
    "chi2_independence": {"col1": "str kategorikal", "col2": "str kategorikal"},
    "chi2_gof": {"column": "str kategorikal", "expected": "list[float] proporsi (opsional, default uniform)"},
    "mannwhitney": {"column": "str", "group": "str 2 grup"},
    "wilcoxon": {"col1": "str", "col2": "str berpasangan"},
    "kruskal": {"column": "str", "group": "str ≥3 grup"},
    "linreg_simple": {"x": "str numerik", "y": "str numerik"},
    "linreg_multiple": {"xs": "list[str] ≥2 numerik", "y": "str numerik"},
    "ml_classify": {"features": "list[str] numerik", "target": "str kategorikal", "algorithm": "naive_bayes|logistic_regression|decision_tree|random_forest|svm"},
    "ml_cluster": {"features": "list[str] numerik", "algorithm": "kmeans|hierarchical", "n_clusters": "int 2..20"},
    "text_tfidf": {"column": "str teks", "mode": "tfidf|bow"},
    "text_lda": {"column": "str teks", "n_topics": "int 2..10"},
    "apriori": {"columns": "list[str] item/biner/kategorikal", "min_support": "0<s≤1", "min_confidence": "0..1", "min_lift": "≥0"},
}


class RunIn(BaseModel):
    project_id: uuid.UUID
    dataset_id: uuid.UUID
    base_version: int = Field(default=1, ge=1)
    method: str
    variables: dict
    params: dict = Field(default_factory=dict)


class RunOut(BaseModel):
    analysis_uid: uuid.UUID | str
    method: str
    result: dict
    result_hash: str


def _get_ds(db: Session, user: User, project_id: uuid.UUID, dataset_id: uuid.UUID):
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.project_id == project_id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan di project ini")
    vs = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id).order_by(DatasetVersion.version_number).all()
    return proj, ds, vs


@router.get("/methods/{method_id}")
def method_spec(method_id: str) -> dict:
    if method_id not in METHOD_IDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Method tidak dikenal. Valid: {METHOD_IDS}")
    return {"id": method_id, "name": METHOD_NAMES[method_id], "variables": METHOD_VARIABLES_SPEC[method_id], "params": {"alpha": "float 0..1, default 0.05"}}


@router.post("/analyses/run", response_model=RunOut, status_code=status.HTTP_201_CREATED)
def run(body: RunIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RunOut:
    if body.method not in METHOD_IDS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Method '{body.method}' tidak dikenal")
    _, ds, vs = _get_ds(db, user, body.project_id, body.dataset_id)
    base = next((v for v in vs if v.version_number == body.base_version), None)
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version v{body.base_version} tidak ditemukan")
    try:
        df = load_version_df(ds, base)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Gagal membaca dataset: {e}")
    try:
        result = run_analysis(df, body.method, body.variables, body.params or {})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    uid = make_uid()
    h = result_hash(result)
    ts = datetime.now(timezone.utc)
    analysis = Analysis(project_id=body.project_id, dataset_version_id=base.id, analysis_uid=uid, method=body.method, variables=body.variables, params=body.params or {}, status="done")
    db.add(analysis)
    db.flush()
    db.add(AnalysisResult(analysis_id=analysis.id, result=result, result_hash=h, software_version=settings.software_version))
    db.add(ResearchLog(analysis_id=analysis.id, dataset_version_id=base.id, method=body.method, variables=body.variables, params=body.params or {}, software_version=settings.software_version, timestamp=ts))
    db.commit()
    return RunOut(analysis_uid=uid, method=body.method, result=result, result_hash=h)


def _out_detail(analysis: Analysis, db: Session) -> dict:
    res = db.query(AnalysisResult).filter(AnalysisResult.analysis_id == analysis.id).first()
    log = db.query(ResearchLog).filter(ResearchLog.analysis_id == analysis.id).first()
    base = db.query(DatasetVersion).filter(DatasetVersion.id == analysis.dataset_version_id).first()
    ds = db.query(Dataset).filter(Dataset.id == base.dataset_id).first() if base else None
    return {
        "analysis_uid": analysis.analysis_uid, "method": analysis.method,
        "project_id": str(analysis.project_id), "dataset_version_id": str(analysis.dataset_version_id),
        "dataset_filename": ds.filename if ds else None,
        "dataset_version_number": base.version_number if base else None,
        "variables": analysis.variables, "params": analysis.params, "status": analysis.status,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        "result": res.result if res else None, "result_hash": res.result_hash if res else None,
        "software_version": res.software_version if res else None,
        "timestamp": log.timestamp.isoformat() if log and log.timestamp else None,
    }


@router.get("/projects/{project_id}/analyses")
def list_analyses(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    rows = db.query(Analysis).filter(Analysis.project_id == project_id).order_by(Analysis.created_at.desc()).all()
    out: list[dict] = []
    for r in rows:
        res = db.query(AnalysisResult).filter(AnalysisResult.analysis_id == r.id).first()
        ver = db.query(DatasetVersion).filter(DatasetVersion.id == r.dataset_version_id).first()
        out.append({
            "analysis_uid": r.analysis_uid, "method": r.method, "variables": r.variables,
            "params": r.params, "status": r.status,
            "dataset_version_number": ver.version_number if ver else None,
            "result_hash": (res.result_hash[:16] + "…") if res else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return out


@router.get("/analyses/{uid}")
def get_analysis(uid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    r = db.query(Analysis).join(Project, Project.id == Analysis.project_id).filter(Analysis.analysis_uid == uid, Project.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis tidak ditemukan")
    return _out_detail(r, db)


@router.post("/analyses/{uid}/rerun", response_model=RunOut, status_code=status.HTTP_201_CREATED)
def rerun(uid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RunOut:
    src = db.query(Analysis).join(Project, Project.id == Analysis.project_id).filter(Analysis.analysis_uid == uid, Project.user_id == user.id).first()
    if not src:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis tidak ditemukan")
    base = db.query(DatasetVersion).filter(DatasetVersion.id == src.dataset_version_id).first()
    ds = db.query(Dataset).filter(Dataset.id == base.dataset_id).first() if base else None
    if not base or not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset version asal tidak ditemukan")
    df = load_version_df(ds, base)
    try:
        result = run_analysis(df, src.method, src.variables, src.params or {})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    new_uid_val = make_uid()
    h = result_hash(result)
    old_res = db.query(AnalysisResult).filter(AnalysisResult.analysis_id == src.id).first()
    identical = bool(old_res and old_res.result_hash == h)
    analysis = Analysis(project_id=src.project_id, dataset_version_id=base.id, analysis_uid=new_uid_val, method=src.method, variables=src.variables, params=src.params, status="done")
    db.add(analysis)
    db.flush()
    db.add(AnalysisResult(analysis_id=analysis.id, result={**result, "rerun_of": src.analysis_uid, "identical_to_original": identical}, result_hash=h, software_version=settings.software_version))
    db.add(ResearchLog(analysis_id=analysis.id, dataset_version_id=base.id, method=src.method, variables=src.variables, params=src.params, software_version=settings.software_version, timestamp=datetime.now(timezone.utc)))
    db.commit()
    final = db.query(AnalysisResult).filter(AnalysisResult.analysis_id == analysis.id).first()
    return RunOut(analysis_uid=new_uid_val, method=src.method, result=final.result, result_hash=h)
