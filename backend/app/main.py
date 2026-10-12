"""Application API — FastAPI. Interface ke Method Engine. DILARANG hitung statistik di luar methods/."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter  # noqa: F401  (limiter kanonis di app.core.rate)
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse
from app.core.config import settings
from app.core.rate import limiter
from app.routers import auth, projects, datasets, preprocess, variables, analyses, results, feedback, sources, sharing, social_auth, guided

if len(settings.jwt_secret) < 32:
    raise RuntimeError("JWT_SECRET terlalu pendek (min 32 char). Generate: openssl rand -hex 32")
if settings.env == "prod" and not settings.cookie_secure:
    raise RuntimeError("ENV=prod mewajibkan COOKIE_SECURE=true (HTTPS)")

app = FastAPI(title="Academic Research API (MVP)", version=settings.software_version)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def _rate_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "Terlalu banyak percobaan, coba lagi sebentar"})


@app.middleware("http")
async def _security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.backend_cors_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(datasets.router)
app.include_router(preprocess.router)
app.include_router(variables.router)
app.include_router(analyses.router)
app.include_router(guided.router)
app.include_router(results.router)
app.include_router(feedback.router)
app.include_router(sources.router)
app.include_router(sharing.router)
app.include_router(sharing.public_router)
app.include_router(social_auth.router)


class HealthOut(BaseModel):
    status: str
    version: str


@app.get("/health", response_model=HealthOut, tags=["system"])
def health() -> HealthOut:
    return HealthOut(status="ok", version=settings.software_version)


@app.get("/api/v1/methods", tags=["methods"])
def list_methods() -> dict:
    """Daftar 15 metode MVP (sumber: docs/scientific-spec/mvp-methods.md)."""
    from pathlib import Path
    import yaml  # type: ignore[import-untyped]
    reg = Path(__file__).resolve().parents[1] / "methods" / "registry.yaml"
    data = yaml.safe_load(reg.read_text()) if reg.exists() else {"methods": []}
    return data
