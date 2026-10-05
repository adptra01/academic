"""Public share: link publik revocable/expirable per analysis.
Publik hanya melihat hasil ilmiah — TANPA identitas user, token, atau secret.
"""
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import Analysis, AnalysisResult, Dataset, DatasetVersion, Project, ResearchLog, SharedLink, User

router = APIRouter(prefix="/api/v1", tags=["sharing"])
public_router = APIRouter(prefix="/public", tags=["public"])


class ShareIn(BaseModel):
    expires_days: int | None = Field(default=None, ge=1, le=365)


def _owned(uid: str, user: User, db: Session) -> Analysis:
    a = db.query(Analysis).join(Project, Project.id == Analysis.project_id).filter(Analysis.analysis_uid == uid, Project.user_id == user.id).first()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis tidak ditemukan")
    return a


@router.post("/analyses/{uid}/share", status_code=status.HTTP_201_CREATED)
def create_share(uid: str, body: ShareIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    a = _owned(uid, user, db)
    link = db.query(SharedLink).filter(SharedLink.analysis_id == a.id).first()
    if link:
        link.revoked = False
        link.expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days) if body.expires_days else None
    else:
        link = SharedLink(analysis_id=a.id, token=secrets.token_urlsafe(32), expires_at=datetime.now(timezone.utc) + timedelta(days=body.expires_days) if body.expires_days else None)
        db.add(link)
    db.commit()
    db.refresh(link)
    return {"token": link.token, "expires_at": link.expires_at.isoformat() if link.expires_at else None, "revoked": link.revoked}


@router.get("/analyses/{uid}/share")
def share_status(uid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    a = _owned(uid, user, db)
    link = db.query(SharedLink).filter(SharedLink.analysis_id == a.id).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belum ada link share")
    return {"token": link.token, "expires_at": link.expires_at.isoformat() if link.expires_at else None, "revoked": link.revoked}


@router.delete("/analyses/{uid}/share", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share(uid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    a = _owned(uid, user, db)
    link = db.query(SharedLink).filter(SharedLink.analysis_id == a.id).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belum ada link share")
    link.revoked = True
    db.commit()
    return None


@public_router.get("/shared/{token}")
def view_shared(token: str, db: Session = Depends(get_db)) -> dict:
    link = db.query(SharedLink).filter(SharedLink.token == token, SharedLink.revoked.is_(False)).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link tidak valid / dicabut")
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link kedaluwarsa")
    a = db.query(Analysis).filter(Analysis.id == link.analysis_id).first()
    res = db.query(AnalysisResult).filter(AnalysisResult.analysis_id == link.analysis_id).first()
    base = db.query(DatasetVersion).filter(DatasetVersion.id == a.dataset_version_id).first()
    ds = db.query(Dataset).filter(Dataset.id == base.dataset_id).first() if base else None
    log = db.query(ResearchLog).filter(ResearchLog.analysis_id == link.analysis_id).first()
    return {
        "analysis_uid": a.analysis_uid, "method": a.method,
        "variables": a.variables, "params": a.params,
        "dataset": {"filename": ds.filename if ds else None, "version": base.version_number if base else None},
        "result": res.result if res else None, "result_hash": res.result_hash if res else None,
        "software_version": res.software_version if res else None,
        "timestamp": log.timestamp.isoformat() if log and log.timestamp else None,
        "shared_note": "Tautan publik read-only. Identitas pemilik disembunyikan.",
    }
