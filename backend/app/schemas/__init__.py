"""Pydantic schemas — validasi di boundary API."""
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    research_type: str = Field(default="Skripsi", pattern="^(Skripsi|Tesis|Disertasi|Paper|Lainnya)$")


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    research_type: str | None = Field(default=None, pattern="^(Skripsi|Tesis|Disertasi|Paper|Lainnya)$")


class ProjectOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    research_type: str
    created_at: datetime
    updated_at: datetime
