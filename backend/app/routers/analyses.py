"""Analyses router: run 15 metode → Analysis ID + result + log immutable. US-010..017, US-018, US-021 (FR-12..25)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.rate import limiter
from app.core.config import settings
from app.models import Analysis, AnalysisResult, Dataset, DatasetVersion, Project, ResearchLog, User
from app.services.stats import METHOD_IDS, METHOD_NAMES, new_uid as make_uid, result_hash, run_analysis
from app.services.version_io import load_version_df

router = APIRouter(prefix="/api/v1", tags=["analyses"])

def _col(kind: str, label: str, multi: bool = False) -> dict:
    return {"kind": kind, "label": label, "multi": multi}


# Spec per metode dengan `variables` (kolom dari dataset) dan `params` (angka/
# opsi metode) DIPISAHKAN. Sebelumnya keduanya ditumpuk dalam satu dict string
# bebas, sehingga frontend harus menebak regex mana kolom dan mana parameter —
# tebakan itu salah untuk `mu`, `expected`, `n_clusters`, `mode`, dan friends.
METHOD_SPEC: dict[str, dict] = {
    "descriptive": {
        "variables": {"columns": _col("any", "Kolom (boleh beberapa)", multi=True)},
        "params": {},
    },
    "normality": {
        "variables": {"column": _col("numeric", "Kolom numerik")},
        "params": {"method": {"kind": "enum", "label": "Metode uji",
                              "options": ["auto", "shapiro", "dagostino"], "default": "auto"}},
    },
    "pearson": {
        "variables": {"x": _col("numeric", "X"), "y": _col("numeric", "Y")},
        "params": {},
    },
    "spearman": {
        "variables": {"x": _col("numeric", "X"), "y": _col("numeric", "Y")},
        "params": {},
    },
    "ttest_1samp": {
        "variables": {"column": _col("numeric", "Kolom numerik")},
        "params": {"mu": {"kind": "number", "label": "Nilai pembanding (μ₀)", "required": True}},
    },
    "ttest_ind": {
        "variables": {"column": _col("numeric", "Kolom numerik"),
                      "group": _col("group", "Kolom pengelompok (2 grup)")},
        "params": {},
    },
    "ttest_paired": {
        "variables": {"col1": _col("numeric", "Kolom 1"),
                      "col2": _col("numeric", "Kolom 2 (berpasangan)")},
        "params": {},
    },
    "anova_oneway": {
        "variables": {"column": _col("numeric", "Kolom numerik"),
                      "group": _col("group", "Kolom pengelompok (≥3 grup)")},
        "params": {},
    },
    "chi2_independence": {
        "variables": {"col1": _col("categorical", "Kolom kategorikal 1"),
                      "col2": _col("categorical", "Kolom kategorikal 2")},
        "params": {},
    },
    "chi2_gof": {
        "variables": {"column": _col("categorical", "Kolom kategorikal")},
        "params": {"expected": {"kind": "number_list", "label": "Proporsi harapan (opsional)",
                                "hint": "Kosongkan untuk memakai proporsi uniform"}},
    },
    "mannwhitney": {
        "variables": {"column": _col("numeric", "Kolom numerik"),
                      "group": _col("group", "Kolom pengelompok (2 grup)")},
        "params": {},
    },
    "wilcoxon": {
        "variables": {"col1": _col("numeric", "Kolom 1"),
                      "col2": _col("numeric", "Kolom 2 (berpasangan)")},
        "params": {},
    },
    "kruskal": {
        "variables": {"column": _col("numeric", "Kolom numerik"),
                      "group": _col("group", "Kolom pengelompok (≥3 grup)")},
        "params": {},
    },
    "linreg_simple": {
        "variables": {"x": _col("numeric", "X"), "y": _col("numeric", "Y")},
        "params": {},
    },
    "linreg_multiple": {
        "variables": {"xs": _col("numeric", "X (boleh beberapa)", multi=True),
                      "y": _col("numeric", "Y")},
        "params": {},
    },
    "ml_classify": {
        "variables": {"features": _col("numeric", "Fitur", multi=True),
                      "target": _col("categorical", "Target")},
        "params": {"algorithm": {"kind": "enum", "label": "Algoritma",
                                 "options": ["naive_bayes", "logistic_regression", "decision_tree",
                                             "random_forest", "svm"]}},
    },
    "ml_cluster": {
        "variables": {"features": _col("numeric", "Fitur", multi=True)},
        "params": {
            "algorithm": {"kind": "enum", "label": "Algoritma", "options": ["kmeans", "hierarchical"]},
            "n_clusters": {"kind": "int", "label": "Jumlah cluster", "min": 2, "max": 20},
        },
    },
    "text_tfidf": {
        "variables": {"column": _col("text", "Kolom teks")},
        "params": {"mode": {"kind": "enum", "label": "Mode", "options": ["tfidf", "bow"]}},
    },
    "text_lda": {
        "variables": {"column": _col("text", "Kolom teks")},
        "params": {"n_topics": {"kind": "int", "label": "Jumlah topik", "min": 2, "max": 10}},
    },
    "apriori": {
        "variables": {"columns": _col("categorical", "Item / kolom biner", multi=True)},
        "params": {
            "min_support": {"kind": "number", "label": "Min support (0–1)"},
            "min_confidence": {"kind": "number", "label": "Min confidence (0–1)"},
            "min_lift": {"kind": "number", "label": "Min lift (≥0)"},
        },
    },
}

# Hanya kolom yang boleh dipilih; sisanya parameter numerik/opsi.
METHOD_VARIABLES_SPEC = {mid: {k: v["label"] for k, v in spec["variables"].items()}
                         for mid, spec in METHOD_SPEC.items()}
METHOD_PARAM_SPEC = {mid: spec["params"] for mid, spec in METHOD_SPEC.items()}


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
    # `variables` (kolom dataset) dan `params` (angka/opsi metode) dikirim
    # terpisah & bertipe agar frontend tidak perlu menebak dari string.
    return {
        "id": method_id,
        "name": METHOD_NAMES[method_id],
        "variables": METHOD_SPEC[method_id]["variables"],
        "params": {**METHOD_SPEC[method_id]["params"],
                   "alpha": {"kind": "number", "label": "Tingkat signifikansi (α)",
                             "min": 0.0001, "max": 0.5, "default": 0.05}},
    }


@router.post("/analyses/run", response_model=RunOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def run(request: Request, body: RunIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RunOut:
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
