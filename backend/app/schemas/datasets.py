"""Dataset schemas — upload response + preview/profile."""
import uuid
from datetime import datetime
from pydantic import BaseModel


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    detected_type: str
    missing_count: int
    missing_pct: float
    unique_count: int


class DatasetProfile(BaseModel):
    rows: int
    cols: int
    missing_total: int
    missing_pct: float
    duplicate_rows: int
    columns: list[ColumnProfile]


class VersionOut(BaseModel):
    id: uuid.UUID
    version_number: int
    parent_version_id: uuid.UUID | None
    transformation_log: list | dict
    created_at: datetime
    content_hash: str | None = None
    schema_version: str = "1.0"
    collector_version: str | None = None
    normalization_version: str = "1.0"
    record_count: int | None = None
    validation_report: dict | None = None


class DatasetOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    filename: str
    file_type: str
    size_bytes: int
    rows_count: int | None
    cols_count: int | None
    created_at: datetime
    versions: list[VersionOut] = []


class UploadOut(BaseModel):
    dataset: DatasetOut
    profile: DatasetProfile
    active_version: int = 1
