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
    # Regex origin yang diizinkan (mendukung credentials). Mencakup localhost,
    # loopback, dan IP LAN privat — karena browser sering dibuka lewat Network
    # URL (mis. http://192.168.x.x:3100) yang Tampil di log `next dev`. Tanpa
    # ini preflight OPTIONS gagal (400) dan browser melaporkan semua API fetch
    # sebagai "Failed to fetch" yang tak bisa dibedakan dari server mati.
    backend_cors_regex: str = r"https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?"
    google_client_id: str = ""
    google_client_secret: str = ""
    frontend_url: str = "http://localhost:3100"
    cookie_secure: bool = False  # WAJIB True di prod (HTTPS)
    feature_phase2: bool = False  # Enable Phase 2 methods (ml_classify, ml_cluster, text_tfidf, text_lda, apriori)

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
