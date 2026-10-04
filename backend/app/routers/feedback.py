"""Feedback router: Report a Problem (beta Gate 2). Kategori + auto Analysis ID/version."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import Analysis, DatasetVersion, FeedbackReport, Project, User

router = APIRouter(prefix="/api/v1", tags=["feedback"])

CATEGORIES = {
    "statistical_result": "Hasil statistik",
    "assumption": "Asumsi",
    "formula": "Formula",
    "data_processing": "Data processing",
    "export": "Export",
    "ui": "UI",
    "other": "Lainnya",
}


class FeedbackIn(BaseModel):
    analysis_uid: str = Field(min_length=1, max_length=32)
    category: str
    description: str = Field(min_length=10, max_length=5000)


class FeedbackOut(BaseModel):
    id: uuid.UUID
    analysis_uid: str
    category: str
    created_at: object


@router.post("/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def create_feedback(body: FeedbackIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> FeedbackOut:
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"category harus salah satu: {sorted(CATEGORIES)}")
    a = db.query(Analysis).join(Project, Project.id == Analysis.project_id).filter(Analysis.analysis_uid == body.analysis_uid, Project.user_id == user.id).first()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis tidak ditemukan")
    ver = db.query(DatasetVersion).filter(DatasetVersion.id == a.dataset_version_id).first()
    rep = FeedbackReport(user_id=user.id, analysis_id=a.id, analysis_uid=a.analysis_uid, dataset_version_number=ver.version_number if ver else None, category=body.category, description=body.description.strip())
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return FeedbackOut(id=rep.id, analysis_uid=rep.analysis_uid, category=rep.category, created_at=rep.created_at)


@router.get("/feedback")
def list_feedback(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.query(FeedbackReport).filter(FeedbackReport.user_id == user.id).order_by(FeedbackReport.created_at.desc()).all()
    return [{"id": str(r.id), "analysis_uid": r.analysis_uid, "dataset_version": r.dataset_version_number, "category": r.category, "description": r.description, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]
