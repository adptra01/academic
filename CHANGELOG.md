# Changelog

## [2026-10-04] — PRD MVP Academic Research Analysis Platform
- Created `tasks/prd-academic-research-platform-mvp.md` (scope B, target peneliti umum, upload-only, single-user, success C)
- Locked IN SCOPE: auth → project → upload CSV/XLSX/XLS/SAV/JSON → preview → variables → preprocessing dasar → 14 metode statistik → result+formula → grafik akademik → export CSV/XLSX/PDF → reproducibility (Analysis ID + log)
- Locked OUT OF SCOPE: scraping, OAuth, API connector, AI assistant, ML/NLP/Apriori, multi-user/sharing, multi-tenant, billing, mobile, DOCX/LaTeX
- Governance: read WORKSPACE-RULES.md + AI/opencode/rules/ before writing; no files outside /mnt/DiskD/Projects/academic

## [2026-10-04] — Implementasi Fase 0 + Fondasi Fase 1 (DDEV local)
- Fase 0 gate: `docs/scientific-spec/mvp-methods.md` (14 metode: input/requirement/asumsi/params/output/formula/validasi)
- Arsitektur: `docs/00-architecture.md`, `README.md`, `db/init.sql` (8 tabel MVP, citext+pgcrypto)
- Backend skeleton: FastAPI `/health` + `/api/v1/methods`, `app/core/{config,security,db,queue}`, `app/models`, `methods/registry.yaml`, `requirements.txt` (+pyyaml), `Dockerfile`, `tests/scientific/test_descriptive.py`
- Frontend skeleton: Next.js 14 + TS (`package.json`, `app/page.tsx`, `layout.tsx`, `tsconfig.json`, `next.config.js`, `Dockerfile`)
- Prod: `compose.yml` (postgres15+redis+minio+backend+worker+frontend+nginx), `nginx.conf`, `.env.example`, `.gitignore`
- Local (DDEV per permintaan user): `.ddev/config.yaml` (generic, postgres15, ports backend 8000/frontend 3000/minio 9000, post-start init.sql), `.ddev/docker-compose.academic.yaml` (backend/frontend/worker/minio), addon `ddev/ddev-redis v2.2.0`
- Catatan: `compose.yml` tetap untuk VPS prod; DDEV hanya untuk local dev (`ddev start` → https://academic.ddev.site)

## [2026-10-04] — DDEV local verified OK
- `ddev start` OK: web, db (postgres15), backend, frontend, redis, worker
- Verified: `GET /health` → {"status":"ok","version":"0.1.0+mvp"}, `GET /api/v1/methods` → 14 metode, frontend Next.js serve OK, `\dt` → 9 tabel MVP
- MinIO dinonaktifkan di DDEV local (registry 401/pull-denied); dev pakai filesystem, prod tetap via compose.yml (butuh docker login di VPS)
- Ports dinamis: backend 127.0.0.1:32774→8000, frontend 32781→3000 (cek `ddev describe`); router web_extra 8000/3000 menunjuk web container, akses langsung via host-port untuk dev

## [2026-10-04] — Fase 1 Auth + Projects DONE (DDEV verified)
- Models: 9 tabel (`app/models/__init__.py`) sinkron dengan `db/init.sql`
- Security fix: passlib+bcrypt5 rusak (72-bytes ValueError) → ganti ke `bcrypt` langsung + pin `bcrypt==5.0.0`, tambah `email-validator==2.2.0`
- Baru: `app/schemas`, `app/core/deps.py` (Bearer ATAU HttpOnly cookie), `routers/auth.py` (register 201/409, login 401-generik, logout 204, me), `routers/projects.py` (CRUD + `WHERE user_id`, 404 jika milik orang lain)
- `main.py`: CORS + include routers; OpenAPI: /auth/*, /projects, /projects/{id}, /methods, /health
- Rebuild: `ddev restart --no-cache`
- Test E2E (curl): register→409 duplikat→401 pass-salah→login→me→create→list(1)→user B list([])+get-A→404→unauth→401→patch judul→delete 204→list(0). SEMUA PASS.

## [2026-10-04] — Fase 2 Dataset Management DONE (DDEV verified)
- Deps: tambah `python-multipart==0.0.20` (upload), `xlrd==2.0.1` (XLS); storage volume `backend_storage:/code/storage` + `STORAGE_DIR` di backend+worker (MinIO tetap nonaktif lokal, S3 hanya prod)
- Baru: `app/core/storage.py` (save lokal), `app/services/dataset_service.py` (pandas/pyreadstat: read csv/xlsx/xls/sav/json, suggest_type Numerical/Binary/Datetime/ID/Nominal/Text, profile rows/cols/missing/dup/unique, preview JSON-safe), `app/schemas/datasets.py`, `routers/datasets.py` (upload 201/400/413/422, list, detail, /profile, /preview?limit&offset, isolasi via join Project.user_id)
- Auto: upload → datasets + dataset_versions v1 (transformation_log upload) + variables auto-suggest (role Ignore)
- Test E2E: CSV(10x4, gender→Binary) + JSON(2x3) + XLSX(3x3) upload OK; preview limit=3 OK; profile OK; B akses A →404; ext .txt →400; empty →400. SEMUA PASS.

## [2026-10-04] — Fase 3 Preprocessing + Fase 4 Variables DONE (DDEV verified)
- Migrasi: `dataset_versions.storage_path` (model + init.sql + ALTER live) — v1=NULL (file asli), vN+=CSV transformasi
- Baru: `services/preprocess_service.py` (13 ops: drop/fill missing, outlier IQR, standard/minmax, log/sqrt, mapping, onehot, lowercase, punct, stopwords ID+EN, dedup), `services/version_io.py` (load per-version), `tasks/__init__.py` (Celery `preprocess_dataset`), `routers/preprocess.py` (sync ≤10k / 202-queued >10k + `GET /jobs/{id}`), `routers/variables.py` (list per-version + PATCH type/role)
- `queue.py`: import app.tasks agar worker kenal task; volume `backend_storage` dipakai backend+worker (async terbukti jalan)
- Fix: import `apply_operations` dari `preprocess_service` (bukan `dataset_service`) di router + task
- Test E2E: mapping L/P→Laki-laki/Perempuan + z-score (v2); vars carry-over; PATCH role + 422; bad-col 422; onehot→v3 (4 cols); chain [1,2,3]; async 11k rows → SUCCESS v2; teks "Saya SANGAT suka..." → "suka pelayanan". SEMUA PASS.

## [2026-10-04] — Fase 5 Statistical Engine DONE (DDEV verified, 16/16 tests PASS)
- Baru: `services/stats/` (engine dispatcher + helpers JSON-safe + 8 modul: descriptive, normality, correlation, ttest, anova, chi2, nonparam, regression) — 15 metode registry, deterministik SciPy/Statsmodels, tanpa LLM
- Setiap hasil: statistics + assumptions + formula_latex + parameters + calculation + decision(α) + effect_size + interpretation ID + warnings
- Baru: `routers/analyses.py` (POST /run → ANL-UID + result_hash + research_log; GET list/detail; POST /{uid}/rerun → identical_to_original; GET /methods/{id} spec)
- Tests: `tests/scientific/test_engine.py` (15 cases, expected hardcoded dari SciPy, tol 1e-6) + Dockerfile COPY tests; `pytest` 16 passed di container
- E2E 13 metode via API pada n=60 (semua 201 + UID + decision + effect); detail/rerun/isolation/422 validated
- Fix: `new_uid` shadowing di rerun (UnboundLocalError → `make_uid`); rerun verified identical=True + hash_match=True
- Catatan: nilai expected wajib dicocokkan ulang vs R/SPSS sebelum Beta (US-022); Dunn post-hoc Kruskal = pairwise MW+Bonferroni (didokumentasikan)

## [2026-10-04] — Fase 6/7 Result+Charts+Export+UI DONE (DDEV verified)
- Charts: `services/charts.py` (matplotlib Agg; histogram/boxplot/scatter+trend/bar/residual/QQ; style akademik grayscale; 150 web/300 PDF) + `GET /analyses/{uid}/chart?type&dpi` (422 tipe salah, X-Chart-Type)
- Export: `services/export_service.py` + `GET /analyses/{uid}/export?format=` (CSV result-table; XLSX Summary/Statistics/Calculation/Parameters; PDF reportlab tabel+formula+calculation+grafik+appendix; tercatat di exports)
- UI: Next.js pages login (asli dengan field API URL→localStorage, toleran port dinamis DDEV), register, dashboard, projects/[id] (upload+run+list), analyses/[uid] (decision badge, interpretasi, grafik via blob+token, Copy APA, unduh CSV/XLSX/PDF), lib/api.ts (token, apaStyle per metode)
- Infra: matplotlib==3.9.2; port dinamis dipertahankan (router klaim 3000/8000 → fixed port tabrakan, web_extra_exposed_ports dihapus, didokumentasikan)
- Verified: chart PNG 26-41KB ×5 metode; CSV/XLSX(PK)/PDF(%PDF-) OK; semua pages 200; `tsc --noEmit` bersih; pytest 16 passed
- Follow-up: Tailwind+shadcn polish, KaTeX render formula, ECharts interaktif (opsional, tidak blokir MVP)

## [2026-10-04] — Hardening Prod + Validation Gate (Fase 14/15 persiapan Beta)
- Auth: rate limit 10/menit/IP (429) di register/login via slowapi==0.1.9 (`core/rate.py` pakai get_remote_address; lambda kustom crash → diganti)
- Startup guard: JWT_SECRET min 32 char; ENV=prod wajib COOKIE_SECURE=true; cookie secure dari settings
- HTTP: security headers (nosniff/DENY/no-referrer); CORS dari env BACKEND_CORS_ORIGINS (`.env.example` + ENV, COOKIE_SECURE)
- Docs: `docs/runbook-prod.md` (secrets/TLS/backup/ops/go-live checklist), `docs/scientific-validation.md` (tabel 15 metode vs R/SPSS, gate Beta), `scripts/backup.sh` (pg_dump+storage, cron, retensi 14h)
- Verified: headers OK; login OK; 12x bad-pass → 9×401 lalu 429; smoke pearson 201; pytest 16 passed; frontend 200

## [2026-10-04] — Review UI + CORS fix + port stabil
- Bug nyata dari review browser: fetch frontend→backend gagal CORS (origin port dinamis tidak diizinkan) → tambah `BACKEND_CORS_REGEX` (DDEV: `http://127\.0\.0\.1:\d+`), tetap dukung credentials
- Port stabil untuk review manusia: frontend `3100:3000`, backend `8100:8000` (3000/8000 diklaim ddev-router); NEXT_PUBLIC_API_URL=http://localhost:8100
- Review via agent-browser (Chrome headless): login OK, dashboard, project (6 datasets, 15 metode), analysis (decision+interpretasi+grafik+export) — screenshot di /tmp/opencode/ui-*.png

## [2026-10-04] — Frontend pindah ke Node lokal ( ¯\_(ツ)_/¯ Docker)
- `.ddev/docker-compose.academic.yaml`: service frontend DIHAPUS (port 3100 untuk `npm run dev`); backend fixed `8100:8000`; CORS regex → `http://(127.0.0.1|localhost):\d+`
- Dev flow: `ddev start` (db+redis+backend+worker) + `cd frontend && npm install && NEXT_PUBLIC_API_URL=http://localhost:8100 npm run dev -- -p 3100`
- Verified: login tanpa config manual (prefill 8100), dashboard render; screenshot /tmp/opencode/ui-local-dashboard.png
- Catatan: `frontend/Dockerfile` + service di root `compose.yml` tetap untuk prod VPS

## [2026-10-04] — Halaman hasil lengkap + SAV verified
- API: `GET /analyses/{uid}` kini sertakan `dataset_filename` + `dataset_version_number` (research log lengkap di UI)
- UI: tabel statistik (flatten key/value) + effect size, formula via KaTeX (fallback pre), parameters&variables JSON, meta dataset·version·software·timestamp
- Deps: `katex` (npm); `tsc` bersih
- Upload: SAV/SPSS terverifikasi E2E (pyreadstat write→upload→profile 3x3, type detect OK); XLS read path sama dengan XLSX (xlrd), fixture tulis dilewati
- Verified: screenshot analysis (tabel + KaTeX area + grafik), page 200

## [2026-10-04] — UI dataset lengkap + seed demo
- Project page: pilih dataset + version tabs, preview 10 baris, profil kolom, editor variables (type/role dropdown → PATCH), form preprocessing (13 ops + kolom + params JSON → version baru), run analysis pakai base version aktif
- `scripts/seed_demo.sh`: user demo + project + CSV 10 baris + pearson & ttest_ind contoh (idempoten); kredensial demo@kampus.ac.id / Demo12345
- Verified browser: role→Dependent tersimpan (API confirm); sections Preview/Profil/Variables/Preprocessing render; tsc bersih

## [2026-10-04] — Asumsi di UI + hapus dataset + Research Log
- UI analisis: tabel Asumsi (nama, p-value, PASS/FAIL/cek-manual, catatan) — terverifikasi render (Levene PASS)
- API: `DELETE /datasets/{id}` → 204 + hapus file; 409 jika ada analysis ("15 analysis" teruji); 404 setelah hapus; fix import Analysis yang sempat 500
- API: `GET /projects/{id}/analyses` diperkaya (version_number, result_hash 16, params) → UI Research Log tabel (UID, method, ver, hash, waktu)
- UI project: tombol Hapus per dataset (konfirmasi, tampilkan pesan 409)
- Verified: pytest 16 passed, tsc bersih, screenshot boxplot + calculation + export

## [2026-10-04] — DOCX export + unduh dataset + polling async
- Export DOCX (python-docx==1.1.2): judul, keputusan, tabel statistik, formula, calculation, grafik, appendix reproducibility; `exports.format` CHECK +ALTER live (csv|xlsx|pdf|docx); UI +tombol DOCX; terverifikasi PK 66KB
- `GET /datasets/{id}/download?version=` → CSV versi (data bersih); tombol "Unduh CSV vN" di UI; terverifikasi isi benar
- Preprocess UI: jika 202-queued → polling `/jobs/{id}` 2s (maks 2 mnt) → version baru otomatis; tidak lagi "cek via API"
- Insiden: edit hampir menghapus endpoint preview (orphan code) → dipulihkan + terverifikasi 200
- Verified: pytest 16 passed, tsc bersih, snapshot UI (Unduh CSV, Research Log, Hapus, Unduh DOCX)

## [2026-10-04] — Polish Tailwind v4
- `tailwindcss + @tailwindcss/postcss + postcss` (npm lokal); `postcss.config.mjs`; `globals.css` → satu import
- Rewrite 7 halaman dengan utilities: sticky nav blur, cards shadow, tabel slate, badges merah/hijau, form fokus ring; konten & alur identik
- Verified: screenshot home + Pearson (r=0.818, Tolak H0 merah, tabel rapi); tsc bersih
- shadcn component library tetap opsional follow-up (utilities mencakup 80% kebutuhan MVP)

## [2026-10-04] — Progress upload, ganti password, pusat export
- Upload: XHR + progress bar (ganti fetch) untuk file besar
- Auth: `POST /auth/change-password` (verifikasi lama, min 8, rate-limited) + form di dashboard; teruji 401/200/revert
- `GET /projects/{id}/exports` (join analyses, desc) + Pusat Export di UI (format, waktu, tombol Unduh); teruji + screenshot
- Insiden: edit merusak indentasi `def export` → backend crash-loop; diperbaiki, guard: verifikasi /health setelah setiap restart

## [2026-10-04] — Asumsi otomatis penuh
- `normality.check()` helper; t-Test (1-sampel/ind/per-pasangan), ANOVA per-grup, regresi (residual + Breusch-Pagan homoskedastisitas) kini terisi PASS/FAIL otomatis + warning saran non-parametrik
- Insiden: 2 edit merusak struktur (normality._test hilang, test indent) → tulis-ulang file + guard pytest setelah restart
- Tests: +3 cases asumsi; pytest 25 passed; E2E ANOVA 4 asumsi terisi

## [2026-10-05] — Rantai multi-op + Unduh Log CSV
- Preprocessing UI: tambah/hapus operasi ke rantai (N ops) → 1 version baru; polling async dipertahankan
- Research Log: tombol Unduh Log CSV (dibuat client-side dari state)
- Verified browser: rantai mapping+scale via UI → v4 (gender ter-mapping, quality z-score); tsc bersih

## [2026-10-05] — README akurat + durasi + verifikasi hapus
- README ditulis ulang mengikuti realita (struktur, quickstart dev+prod, status fase, aturan guard)
- runAnalysis tampilkan durasi komputasi ("selesai dalam Xs")
- Verified: hapus project membersihkan file storage (1→0); tsc bersih

## [2026-10-05] — Arah A: kunci 15 metode + paket validasi + invariant AI
- Konsistensi: PRD (4×), main.py docstring, 00-architecture (stack riil: Tailwind util, KaTeX, matplotlib; shadcn/ECharts = follow-up), mvp-methods (M-09 = 2 endpoint) → MVP = 15 metode runnable di semua dokumen
- Paket Gate 1 (AI menyiapkan, manusia sign-off): `scripts/validation/{make_benchmarks.py (14 CSV deterministik LCG+Box-Muller), run_engine.py (stdlib, 16 runs → engine_outputs.json), validate.R (base R saja → r_outputs.csv), compare.py (toleransi terdokumentasi, exit 0/1/2)}`
- `docs/scientific-validation.md` → evidence record (cara run, tabel SPSS, acceptance, blok sign-off manusia)
- ADR-0001 (`docs/adr/`): AI dilarang menghitung angka ilmiah + `tests/test_arch_invariant.py` (gagalkan CI bila dep/import LLM masuk)
- Scope: E — MVP dibekukan; B/C/D setelah RC1
- Insiden: generator chi2 flat-list (CSV rusak) → pasangan list; diperbaiki + regenerate
- Verified: pytest 27 passed; engine 16/16 runs tersimpan; compare exit 2 (R tak ada di workstation — sesuai peran)

## [2026-10-05] — Rerun UI + petunjuk metode
- Halaman hasil: kartu Reproducibility + tombol Rerun → tampil UID baru + status identik
- Form run: petunjuk "Butuh: ..." per metode (dari GET /methods/{id}) — bantu pemilihan variabel saat beta
- Insiden: div ganda di kartu Export (edit) → diperbaiki via python (edit tool gagal match whitespace)
- Verified: tsc bersih, tombol Rerun + kartu tampil di browser

## [2026-10-05] — RC1: Report a Problem + panduan beta + checklist Gate-2
- Definisi anti-ambiguitas: 15 methods = 16 endpoints (M-09 ganda) di mvp-methods + validation doc
- Report a Problem: tabel feedback_reports (migrasi Alembic f1e2d3c4b5a6, up/down teruji), POST/GET /feedback (201/422/404), form di halaman hasil + dataset version otomatis
- `docs/beta-guide.md`: skenario task completion, kriteria, aturan lapor
- Checklist Gate-2 (evidence 2026-10-05 pasca-restart): pytest 27, health ok, alembic head, rerun hash identik, 6/6 export 200, isolasi 404, exe 400, rate-limit 429, tsc bersih, frontend 200
- Insiden: skrip cek pakai variabel salah (T vs TOKEN) → hasil 404 palsu; pelajaran: echo respons mentah saat debug

## [2026-10-05] — SCOPE UNFREEZE (keputusan user)
- RC1 freeze dicabut atas perintah eksplisit user. Urutan ekspansi: ML Fase 8 → Apriori → API/OAuth/scraping → shadcn+ECharts.
- Gate manusia (R/SPSS, beta, prod) tetap berjalan paralel sebagai tanggung jawab manusia.

## [2026-10-05] — ML Fase 8 DONE (feature/ml-v8, RC1 core utuh)
- Git policy aktif: main=RC1 (tag rc1-core-freeze); kerja di feature/ml-v8
- Klasifikasi 5 algo (NB/LR/DT/RF/SVM): stratified split, acc/P/R/F1 macro, per-class, confusion, ROC-AUC biner+OvR, 5-fold CV, feature importance, hyperparams + seed eksplisit, kurva ROC ECharts-ready
- Clustering K-Means + Hierarchical Ward: sizes, inertia, silhouette, centroids, scatter2d ECharts-ready
- Teks: TF-IDF/BoW (top terms) + LDA (topik, perplexity) — sklearn saja, tanpa download eksternal
- Grafik PNG: confusion, roc, cluster, dendrogram, topics, topterms (untuk PDF; ECharts konsumsi JSON nanti)
- UI: 4 metode di dropdown + 6 tipe chart baru; registry + method-spec terisi
- Insiden: factory lambda belum dipanggil (AttributeError) → diperbaiki + rebuild
- Verified: pytest 34 (27 RC1 hijau + 7 ML), tsc bersih, E2E + 4 grafik 200; komit 8c026ce
## [2026-10-05] — ECharts DONE (feature/echarts dari master, core utuh)
- `services/vizdata.py` (di luar stats/): histogram bins, boxplot five-number, scatter sample (cap 2000, seed 42) + trend dari result, bar kontingensi, passthrough confusion/roc/cluster/topics/topterms/rules — payload {type,data,metadata}
- `GET /analyses/{uid}/viz?type=` (422 tipe salah); frontend echarts-for-react + toggle Statis/Interaktif
- Insiden: braket `]` vs `}` di bar() (tertangkap sebelum import — file belum pernah dipakai); 2 edit whitespace merusak def (diperbaiki); pelajaran ditegakkan
- Verified: pytest 33 (27 RC1 + 6 viz), tsc bersih, /viz scatter + 422, screenshot ECharts titik data asli
