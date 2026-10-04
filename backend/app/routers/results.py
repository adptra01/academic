"""Results router: chart PNG + export CSV/XLSX/PDF/DOCX (tabel+grafik+appendix). US-019/020 (FR-22/23)."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import Analysis, AnalysisResult, Dataset, DatasetVersion, Export, Project, ResearchLog, User, Variable
from app.services.charts import CHART_TYPES, DEFAULT_CHART, make_chart
from app.services.export_service import build_csv, build_docx, build_latex, build_pdf, build_xlsx
from app.services.version_io import load_version_df

router = APIRouter(prefix="/api/v1", tags=["results"])


def _load(uid: str, user: User, db: Session):
    a = db.query(Analysis).join(Project, Project.id == Analysis.project_id).filter(Analysis.analysis_uid == uid, Project.user_id == user.id).first()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis tidak ditemukan")
    res = db.query(AnalysisResult).filter(AnalysisResult.analysis_id == a.id).first()
    base = db.query(DatasetVersion).filter(DatasetVersion.id == a.dataset_version_id).first()
    ds = db.query(Dataset).filter(Dataset.id == base.dataset_id).first() if base else None
    log = db.query(ResearchLog).filter(ResearchLog.analysis_id == a.id).first()
    if not res or not base or not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data analysis tidak lengkap")
    df = load_version_df(ds, base)
    return a, res, ds, base, log, df


@router.get("/analyses/{uid}/chart")
def chart(uid: str, type: str | None = Query(default=None), dpi: int = Query(default=150, ge=72, le=300), title: str = Query(default=""), column: str | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a, res, ds, base, log, df = _load(uid, user, db)
    ct = type or DEFAULT_CHART.get(a.method, "histogram")
    if type and type not in CHART_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"chart type harus salah satu {sorted(CHART_TYPES)}")
    variables = dict(a.variables)
    if column:
        if column not in df.columns:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Kolom '{column}' tidak ada")
        variables = {**variables, "column": column, "columns": [column]}
    try:
        png, used = make_chart(df, a.method, variables, res.result, ct, dpi=dpi, title=title)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return Response(content=png, media_type="image/png", headers={"X-Chart-Type": used})


@router.get("/analyses/{uid}/export")
def export(uid: str, format: str = Query(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fmt = format.lower()
    if fmt not in ("csv", "xlsx", "pdf", "docx", "tex", "json"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="format harus csv|xlsx|pdf|docx|tex|json")
    a, res, ds, base, log, df = _load(uid, user, db)
    result = res.result
    var_rows = db.query(Variable).filter(Variable.dataset_version_id == base.id).all()
    context = {
        "dataset": {"filename": ds.filename, "version": base.version_number, "rows": ds.rows_count, "cols": ds.cols_count},
        "variables": [{"name": v.name, "type": v.var_type, "role": v.var_role} for v in var_rows],
        "analysis_uid": uid, "timestamp": log.timestamp.isoformat() if log and log.timestamp else "",
        "software_version": res.software_version,
    }
    if fmt == "csv":
        content, media = build_csv(result), "text/csv"
        fname = f"{uid}.csv"
    elif fmt == "json":
        import json as _json

        content, media = _json.dumps({"analysis_uid": uid, "method": a.method, "result": result, "result_hash": res.result_hash, "software_version": res.software_version}, ensure_ascii=False, indent=2).encode("utf-8"), "application/json"
        fname = f"{uid}.json"
    elif fmt == "xlsx":
        content, media = build_xlsx(result), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        fname = f"{uid}.xlsx"
    elif fmt == "docx":
        try:
            chart_png, _ = make_chart(df, a.method, a.variables, result, None, dpi=200)
        except Exception:
            chart_png = None
        content, media = build_docx(result, context, chart_png), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        fname = f"{uid}.docx"
    elif fmt == "tex":
        content, media = build_latex(result, context, f"{uid}.png"), "application/x-latex"
        fname = f"{uid}.tex"
    else:
        try:
            chart_png, _ = make_chart(df, a.method, a.variables, result, None, dpi=300)
        except Exception:
            chart_png = None
        # appendix: gabungkan context ke result copy agar PDF memuat info dataset
        full = {**result, "_appendix": context}
        content, media = build_pdf(full, context, chart_png), "application/pdf"
        fname = f"{uid}.pdf"
    # catat export (path logis; file disajikan langsung)
    storage_path = f"/code/storage/exports/{fname}"
    try:
        from pathlib import Path as _P

        p = _P(storage_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(content)
    except Exception:
        pass
    db.add(Export(analysis_id=a.id, format=fmt, storage_path=storage_path))
    db.commit()
    return Response(content=content, media_type=media, headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/projects/{project_id}/exports")
def list_exports(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    """Pusat export: semua file yang pernah dibuat di project ini."""
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    rows = (
        db.query(Export, Analysis)
        .join(Analysis, Analysis.id == Export.analysis_id)
        .filter(Analysis.project_id == project_id)
        .order_by(Export.created_at.desc()).all()
    )
    return [{"analysis_uid": a.analysis_uid, "method": a.method, "format": e.format, "created_at": e.created_at.isoformat() if e.created_at else None} for e, a in rows]


@router.get("/analyses/{uid}/viz")
def viz(uid: str, type: str | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """ECharts-ready visualization dataset. LAPISAN VISUAL — angka dari engine, tak menghitung."""
    from app.services import vizdata

    a, res, ds, base, log, df = _load(uid, user, db)
    try:
        return vizdata.build(df, a.method, a.variables, res.result, base.version_number, type, uid)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
