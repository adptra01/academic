# Academic Research Analysis Platform — MVP

> Scientific engine deterministik adalah inti. AI hanya asisten opsional pasca-MVP dan DILARANG menghitung statistik.

Satu penelitian = satu Project: Dataset (versioned) → Variables → Preprocessing → Analysis → Results → Log → Export.

## Quickstart dev (DDEV + Node lokal)

```bash
ddev start
cd frontend && npm install
NEXT_PUBLIC_API_URL=http://localhost:8100 npm run dev -- -p 3100
# frontend: http://localhost:3100
# backend docs: http://localhost:8100/docs
```

Buat akun dev sendiri lewat `POST /api/v1/auth/register`, atau seed akun demo
lokal: `./scripts/seed_demo.sh` (akun & kata sandinya dicetak ke stdout — tidak
pernah ditulis di dokumen ini, karena repo ini publik).

## Quickstart prod (VPS, ringkas — detail: `docs/runbook-prod.md`)

```bash
cp .env.example .env && chmod 600 .env   # isi secrets (openssl rand -hex 32)
docker compose up --build -d             # TLS di Nginx/VPS, ENV=prod, COOKIE_SECURE=true
```

## Struktur repo

```
academic/
├── tasks/prd-academic-research-platform-mvp.md  # PRD (sumber kebenaran MVP)
├── docs/ (00-architecture, runbook-prod, scientific-spec, scientific-validation)
├── backend/ (FastAPI + engine: app/{core,models,routers,services/stats,tasks} + methods/registry + tests/)
│   └── migrations/ (Alembic, baseline c328765abd10)
├── frontend/ (Next.js 14 + TS + Tailwind + KaTeX)
├── db/init.sql, compose.yml (prod), .ddev/ (local), scripts/{backup,seed_demo}.sh
└── CHANGELOG.md
```

## Aturan main MVP

1. **Jangan hitung statistik di Node.js.** Semua hitungan di `backend/` (Pandas/NumPy/SciPy/Statsmodels).
2. **Jangan ubah dataset asli.** Preprocessing selalu buat `dataset_versions` baru.
3. **Semua metode ikut template** `docs/scientific-spec/mvp-methods.md` (spec di kode: `services/stats/`).
4. **Semua analisis punya Analysis ID + log immutable + result_hash.**
5. **Rilis gagal jika scientific tests FAIL** (toleransi 1e-6, effect size 1e-4).
6. Upload saja (CSV/XLSX/XLS/SAV/JSON). Scraping/OAuth/API/AI = OUT OF SCOPE.
7. Setelah edit backend: `ddev restart` → cek `/health` + `pytest` + `tsc` bila sentuh frontend.

## Status fase (semua MVP selesai, terverifikasi)

- [x] Fase 0 — Scientific spec
- [x] Fase 1 — Foundation/Auth/Project (+rate-limit, headers, Alembic)
- [x] Fase 2 — Dataset (5 format, preview+paging, profil, versioning, diff, hapus aman, unduh CSV)
- [x] Fase 3 — Preprocessing (15 ops, rantai multi-op, sync/async+polling UI)
- [x] Fase 4 — Variables (type/role, auto-suggest, editor UI)
- [x] Fase 5 — Statistical engine (15 metode + asumsi otomatis + effect size)
- [x] Fase 6/7 — Result + grafik (6 tipe) + KaTeX + APA
- [x] Fase 10/11 — Export CSV/XLSX/PDF/DOCX/TEX/JSON + Pusat Export + Research Log + rerun identik
- [x] Polish — Tailwind, print CSS, a11y awal, seed demo, backup script
- [ ] Gate manusia: validasi R/SPSS (`docs/scientific-validation.md`), beta 20–50 user, TLS prod
- [ ] Pasca-MVP: ML (Fase 8), Apriori (9), API/OAuth/scraping (12–13), AI assistant
