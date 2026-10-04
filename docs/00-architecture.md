# Arsitektur Final MVP (terkunci)

```
              USER (peneliti umum)
                    │
                    ▼
           ┌─────────────────┐
           │  NEXT.JS (TS)   │  interface saja, DILARANG hitung statistik
           │  Tailwind+shadcn│
           └────────┬────────┘
                    │ REST /api/v1
                    ▼
           ┌─────────────────┐
           │ FASTAPI (Python)│  Application API: auth, projects, datasets, analyses, exports
           └────────┬────────┘
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
 DATA MGMT     METHOD ENGINE   PROJECT ENGINE
 Pandas/NumPy  SciPy/Statsmod  PostgreSQL (8 tabel)
               sklearn (preproc
               saja, MVP)
     │              │
     └──────┬───────┘
            ▼
      RESULT ENGINE
   Tables + Charts + Report
            │
            ▼
      EXPORT ENGINE
    CSV / XLSX / PDF
```

## Keputusan

- Frontend: Next.js 14 App Router + TS + Tailwind CSS (utilities) + KaTeX (formula).
- Grafik: matplotlib (backend, PNG grayscale akademik) — ECharts interaktif opsional follow-up.
- shadcn/ui: opsional follow-up (belum dipakai; utilities mencakup kebutuhan MVP).
- Backend: Python 3.11 + FastAPI + SQLAlchemy 2 + Alembic + Celery + Redis.
- Scientific: Pandas 2 + NumPy + SciPy + Statsmodels. sklearn HANYA untuk preprocessing MVP (scaling/encoding). Klasifikasi/clustering = OUT.
- DB: PostgreSQL 15. Storage: S3-compatible (MinIO dev). Proxy: Nginx. Deploy: single VPS via `compose.yml`.
- Version: `SOFTWARE_VERSION=0.1.0+mvp` disimpan di setiap `research_logs`.

## Alur data (immutable)

```
Upload → datasets/v1 (original) → preprocessing → datasets/vN+1 (parent_version_id + transformation_log)
→ variables (type+role per version) → analyses (method+variables+params) → analysis_results (result+hash)
→ research_logs (append-only) → exports (CSV/XLSX/PDF + appendix)
```

## Keamanan baseline

HTTPS (Nginx TLS di prod), argon2/bcrypt, JWT HttpOnly Secure SameSite 24 jam, validasi upload (ekstensi+MIME+≤50MB), isolasi `WHERE user_id=:uid` di semua query (atau RLS), audit login, backup harian, soft-delete dataset + hapus objek S3.
