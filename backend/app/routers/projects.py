"""Project router: CRUD dengan isolasi user_id (FR-3, FR-4). US-003."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import Project, User
from app.schemas import ProjectIn, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _out(p: Project) -> ProjectOut:
    return ProjectOut(id=p.id, title=p.title, description=p.description, research_type=p.research_type, created_at=p.created_at, updated_at=p.updated_at)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProjectOut:
    p = Project(user_id=user.id, title=body.title.strip(), description=body.description, research_type=body.research_type)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _out(p)


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ProjectOut]:
    rows = db.query(Project).filter(Project.user_id == user.id).order_by(Project.updated_at.desc()).all()
    return [_out(p) for p in rows]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProjectOut:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    return _out(p)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: uuid.UUID, body: ProjectUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProjectOut:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    if body.title is not None:
        p.title = body.title.strip()
    if body.description is not None:
        p.description = body.description
    if body.research_type is not None:
        p.research_type = body.research_type
    db.commit()
    db.refresh(p)
    return _out(p)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    from pathlib import Path as _Path

    from app.models import Dataset, DatasetVersion

    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")
    paths: set[str] = set()
    for ds in db.query(Dataset).filter(Dataset.project_id == project_id).all():
        paths.add(ds.storage_path)
        for v in db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id).all():
            if v.storage_path:
                paths.add(v.storage_path)
    db.delete(p)
    db.commit()
    for path in paths:
        try:
            _P = _Path(path)
            if _P.is_file():
                _P.unlink()
        except OSError:
            pass
    return None
