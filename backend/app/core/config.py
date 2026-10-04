"""Config via env. Secrets HANYA dari .env, jangan hardcode."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    software_version: str = "0.1.0+mvp"
    env: str = "dev"  # dev | prod
    database_url: str = "postgresql+psycopg://academic:change_me@localhost:5432/academic_mvp"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24
    max_upload_mb: int = 50
    backend_cors_origins: str = "http://localhost:3000"
    backend_cors_regex: str = ""  # mis. http://127\.0\.0\.1:\d+ untuk port dinamis DDEV (mendukung credentials)
    cookie_secure: bool = False  # WAJIB True di prod (HTTPS)

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
