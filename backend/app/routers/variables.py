"""Variables router: konfigurasi type + role per dataset_version (Fase 4, US-007, FR-8)."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import Dataset, DatasetVersion, Project, User, Variable

router = APIRouter(prefix="/api/v1", tags=["variables"])

VAR_TYPES = {"Numerical", "Ordinal", "Nominal", "Binary", "Text", "Datetime", "ID"}
VAR_ROLES = {"Independent", "Dependent", "Control", "Grouping", "ID", "Ignore"}


class VariableOut(BaseModel):
    id: uuid.UUID
    name: str
    var_type: str
    var_role: str


class VariableUpdate(BaseModel):
    var_type: str | None = Field(default=None)
    var_role: str | None = Field(default=None)


def _get_version(dataset_id: uuid.UUID, version_number: int, user: User, db: Session):
    ds = db.query(Dataset).join(Project, Project.id == Dataset.project_id).filter(Dataset.id == dataset_id, Project.user_id == user.id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan")
    v = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == ds.id, DatasetVersion.version_number == version_number).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version v{version_number} tidak ditemukan")
    return ds, v


@router.get("/datasets/{dataset_id}/versions/{version_number}/variables", response_model=list[VariableOut])
def list_variables(dataset_id: uuid.UUID, version_number: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[VariableOut]:
    _, v = _get_version(dataset_id, version_number, user, db)
    rows = db.query(Variable).filter(Variable.dataset_version_id == v.id).order_by(Variable.name).all()
    return [VariableOut(id=r.id, name=r.name, var_type=r.var_type, var_role=r.var_role) for r in rows]


@router.patch("/variables/{variable_id}", response_model=VariableOut)
def update_variable(variable_id: uuid.UUID, body: VariableUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> VariableOut:
    r = (
        db.query(Variable)
        .join(DatasetVersion, DatasetVersion.id == Variable.dataset_version_id)
        .join(Dataset, Dataset.id == DatasetVersion.dataset_id)
        .join(Project, Project.id == Dataset.project_id)
        .filter(Variable.id == variable_id, Project.user_id == user.id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variable tidak ditemukan")
    if body.var_type is not None:
        if body.var_type not in VAR_TYPES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"var_type harus salah satu: {sorted(VAR_TYPES)}")
        r.var_type = body.var_type
    if body.var_role is not None:
        if body.var_role not in VAR_ROLES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"var_role harus salah satu: {sorted(VAR_ROLES)}")
        r.var_role = body.var_role
    db.commit()
    db.refresh(r)
    return VariableOut(id=r.id, name=r.name, var_type=r.var_type, var_role=r.var_role)
