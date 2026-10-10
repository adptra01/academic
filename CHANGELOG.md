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
## [2026-10-05] — shadcn foundation + migrasi (feature/shadcn)
- 11 primitif gaya shadcn (button, input+textarea, card, badge+alert, table, label, select/dialog/tabs/progress/tooltip Radix, lucide) + cn()
- Project → Tabs (Dataset/Variables/Preprocess/Diff/Analysis/Log/Export, sesuai konsep PRD); delete via Dialog; upload via Progress; Badge/Alert/Select di semua form
- Analysis → Tabs (Hasil/Grafik/Formula/Export/Repro/Lapor) + Badge keputusan/asumsi + Select chart
- Dashboard: Card + Dialog hapus + Badge; login/register: Card + Label + Alert
- Insiden: DB container stopped pasca-restart (500 login) → `ddev start`; Radix Select larang value "" (sudah ditangani sentinel)
- Verified: pytest 27 (core utuh), tsc bersih, screenshot Tabs + Variables shadcn
## [2026-10-05] — API/OAuth/Scraping DONE (feature/connectors dari master, core utuh)
- Abstraksi DataConnector (authenticate/fetch/normalize/metadata) + registry; GenericREST (GET/POST, mapping, paginasi, timeout/retry, https-only); OAuth terenkripsi Fernet (tak pernah di log/dataset, fallback DEV jujur dilaporkan); Scraper guardrail (allowlist, robots, tolak 401/403/paywall, rate-limit, hash, request-log, dedup)
- DB: oauth_connections + data_sources + datasets.source_* (migrasi c2d3e4f5a6b7, stamp setelah init.sql hook); provenance + config tersanitasi di setiap fetch
- UI: kartu Import via API/Scraper + tabel sumber; env dev OAUTH_ENCRYPTION_KEY + SCRAPER_ALLOWLIST
- Docs: scraping-policy (7 aturan mengikat)
- Insiden: edit whitespace merusak models (diperbaiki via python + ast check)
- Verified: pytest 34 (27 RC1 + 7 connectors mocked), E2E fetch 5 rows + OAuth roundtrip + deny, screenshot UI
## [2026-10-05] — Synthetic beta DONE (feature/synthetic-beta, core utuh)
- `scripts/synthetic-beta/run.py` (stdlib): 5 persona × workflow penuh (register→project→upload→variables→preprocess→2 metode→chart→export→rerun→log) + probe (isolasi antar-user, exe ditolak, konkurensi 10/10, async 15k rows)
- Hasil: 74/74 PASS (11.0s); evidence di docs/beta-synthetic/
- Insiden: fixture tanpa kolom `post` → 1 FAIL; diperbaiki, rerun hijau. Bukan pengganti beta manusia.

## [2026-10-05] — INTEGRASI: 6 branch → master (20 metode, 50 tests)
- Merge berurutan dengan resolusi union: ml-v8 → apriori → echarts → shadcn → connectors → synthetic-beta
- Konflik tersulit: halaman project/analysis (Tabs shadcn × dropdown ML/Apriori × toggle viz) — diselesaikan: Tabs dipertahankan + semua metode + toggle + kartu Import shadcn
- Pelajaran merge: file yang ditulis-ulang total (vs edit) paling aman direset via `git checkout --theirs` + aplikasikan delta kecil; JANGAN hapus blok via anchor samar
- Verified: pytest 50 (27+7+3+6+7), tsc bersih, /methods = 20, UI terintegrasi (Tabs + Import + semua metode)

## [2026-10-05] — Share publik + medsos via OAuth/API resmi (feature/sharing)
- Share: shared_links (migrasi + stamp), POST/GET/DELETE + GET /public/shared (anon, tanpa identitas), halaman /shared/[token], UI kartu Bagikan + 3 tests
- Medsos sesuai arahan (auth dulu, pustaka resmi): requests-oauthlib (refresh) + google-api-python-client (YouTube: search→videos, quota-note, api_key/OAuth); endpoint refresh + matriks docs/social-acquisition.md; scraping langsung medsos tetap DITOLAK
- Insiden: wiring sharing hilang (re-apply); decrypt beda-kunci → 409 jelas (bukan 500); duplikat test (dedupe)
- Verified: pytest 55, tsc bersih, E2E share→anon→revoke, registry 3 connectors

## [2026-10-05] — Wizard scraping tanpa JSON (feature/scrape-wizard)
- Backend: refactor scraper (guard_url/download_guarded/list_tables/inspect_url) — fetch() perilaku identik; endpoint presets + inspect (tanpa simpan)
- UI: preset select + URL + Cek tabel → pilih tabel visual (bentuk/kolom/contoh) → Fetch; advanced JSON tetap ada sebagai toggle
- Verified: pytest 12 connectors, E2E deny allowlist + pesan merah jelas di UI, screenshot wizard

## [2026-10-10] — Redesain UI frontend mengikuti ngulikdata.com
- Referensi visual diekstrak dari DOM ngulikdata.com (bukan screenshot): Geist/Geist Mono, primer `oklch(0.204 0.2 271)` (diverifikasi sama dengan tombol referensi), netral hangat hue 78, radius 12px, pil, header 72px transparan, dot-grid, section berselang tanpa border, blok CTA biru penuh
- Cakupan: token `globals.css`, font root (`Archivo`/`IBM Plex Mono` dibuang), primitif `ui/button.tsx`, 18 komponen `components/public/*`, header/sidebar console, 4 view console, 3 view auth — hanya lapisan visual; fitur, alur, dan copy tidak berubah
- Akar masalah desain lama: `.graph-paper` (kertas grafik) + grain + aksen petrol diganti dot-grid + biru pekat
- **Fix bug pra-existing**: `SidebarProvider` dipindah dari `Providers` root ke layout `(pages)`; sebelumnya wrapper flex-row shadcn membuat halaman publik/auth tersusun horizontal (scrollWidth 1939px vs viewport 1280px)
- Verified: `tsc` bersih, `next build` 11/11, audit computed-style + cek overflow/console-error seluruh halaman publik via agent-browser (desktop 1440 + mobile 390); QA console dengan login demo (dashboard + project view, desktop + 390) tanpa overflow
- Akibat insiden DB: `ddev-academic-db` mati → login 500 (`/health` 200); dipulihkan via `ddev start` (init.sql jalan ulang = DB fresh), akun demo dibuat ulang + 1 project uji
- Backup pra-perubahan: `/mnt/DiskD/Workspace/Backups/academic-frontend-pre-redesign-ngulikdata-20261010-1510.tar.gz`

## [2026-10-10] — Light & dark mode + pembersihan kode mati (frontend)
- **Mode gelap penuh**: token `.dark` disempurnakan (bg/netral hangat, kartu elevasi, border tipis), `color-scheme` per mode, `html` diberi `bg-background`; `next-themes` tetap `attribute='class'` + `defaultTheme='system'`
- **Token semantik baru**: `--brand/--brand-foreground` (blok CTA biru tetap pekat di mode gelap, bukan bir terang menyilaukan), `--strong/--strong-foreground/--strong-accent` (panel Reproduksi tetap gelap di kedua mode + aksen terang untuk keterbacaan), `--shadow-card` tema-sadar, `--warn`/`--warn-wash`/`--accent-wash` bernilai terang & gelap
- **Turunan dari itu**: `analysis-receipt` (`bg-white` → `bg-card`, skeleton `bg-muted`, sheen `shimmer` berbasis `--foreground`), `methods-index` (input cari `bg-background`), tombol aksen publik `text-paper` → `text-primary-foreground`, `.caret` pakai `currentColor`
- **Grafik sadar tema** (`EChartView`): warna axis/grid/label/bar/line/baca dari variabel CSS dan bereaksi pada `resolvedTheme`; fallback `text-slate-500` → `text-muted-foreground`
- **`ModeToggle`** di header publik (sm+) + baris berlabel di panel menu mobile; console sudah punya dari sebelumnya
- **Hapus yang tidak perlu**: 17 komponen UI tanpa satu pun importer (`background-ripple`, `button-group`, `chart`, `checkbox`, `circular-progress`, `combobox`, `command`, `input-otp`, `pagination`, `popover`, `radio-group`, `rating`, `resizable`, `scroll-area`, `switch`, `timeline`, `toggle-group`); CSS mati (`.hatch`, `.animate-marquee`, `marquee-x`, `.input-*`, alias `paper-3/4`, `abyss*`); 8 dependensi npm yatim (`cmdk`, `input-otp`, `react-resizable-panels`, `recharts`, `@hookform/resolvers`, `@tanstack/react-table`, `react-hook-form`, `zod`)
- **Fix bug yang ditemukan saat migrasi**: alias `--color-accent → primary` membuat hover `dropdown-menu`/`select` tidak terbaca (bg biru + teks gelap) di kedua mode → komponen publik dimigrasi ke `primary`, alias `accent*` dibuang agar semantik `accent` shadcn kembali benar
- **Fix beranda breadcrumb**: prop `parent` di `PageHeader` dihapus (remah roti "Beranda" tidak lagi dirender di `/metode`, `/alur`, `/reproduksi`)
- Verified: `tsc` bersih, `next build` 11/11 route, screenshot + cek computed-style & overflow di `/`, `/reproduksi`, `/login`, `/dashboard`, `/projects/[id]` pada viewport 1440 untuk mode terang dan gelap; login demo → dashboard → project tanpa error konsol
- Insiden lingkungan: kontainer ddev `db` exited → login backend 500; dipulihkan via `ddev start` (tabel lama masih ada, data tidak terhapus)

## [2026-10-10] — Keamanan sebelum publikasi repo
- `.ddev/docker-compose.academic.yaml`: hapus `OAUTH_ENCRYPTION_KEY` asli (Fernet 32-byte) yang ter-commit — sekarang dibaca dari env host (`${OAUTH_ENCRYPTION_KEY}`); bila kosong backend memakai fallback dev berbasis `JWT_SECRET` yang ditandai `dev-fallback` di metadata koneksi
- Kredensial S3 dev (`minioadmin`/`minioadmin123`) diganti interpolasi `${S3_ACCESS_KEY:-minioadmin}`/`${S3_SECRET_KEY:-minioadmin}`
- Verifikasi: tidak ada kunci asli tersisa di berkas ter-track; `ddev restart` + health 200 + login demo tetap normal; tidak ada token OAuth tersimpan di DB lokal sehingga rotasi tidak merusak data
- Audit lain: `.env`/`.env.local` ter-gitignore (hanya `.env.example` ter-track), `db_snapshots` & `.ddev-docker-*.yaml` ter-gitignore, tidak ada dump DB, berkas terbesar 424K (`og-image.png`)

## [2026-10-10] — Lint hijau + SECURITY.md
- **Lint frontend: 201 masalah → 0** (29 berkas). PRD mensyaratkan "lint passes" di hampir semua US dan sebelumnya gagal.
  - `eslint --fix` menuntaskan 187 masalah otomatis (`padding-line-between-statements`, `import/order`, `lines-around-comment`)
  - 4 import tak terpakai dibuang: `METHODS` (validation-evidence), `FieldGroup`/`Label`/`Separator` (ProjectView)
  - `Formula` (AnalysisView) direfaktor: hasil `katex.renderToString` diletakkan di luar blok `try` — menghapus pelanggaran `react-hooks/error-boundaries` tanpa mengubah perilaku (KaTeX gagal → tampilkan sumber mentah)
  - 9 lokasi `react-hooks/set-state-in-effect` diberi `eslint-disable` beralasan: semuanya pola sah (baca localStorage/API/CSS var saat mount); lazy state saat render justru menyebabkan hydration mismatch
- **`SECURITY.md` dibuat** — selama ini dirujuk `.env.example`/`.gitignore` tapi tidak pernah ada. Isinya sesuai kondisi kode nyata, termasuk bagian jujur "Yang BELUM selesai": tidak ada validasi MIME, delete dataset masih hard delete (bukan soft-delete), belum ada audit log login, rate limit hanya di endpoint auth, tidak ada enkripsi at-rest, belum ada CI keamanan
- Catatan temuan: `@limiter.limit("10/minute")` aktif di register/login/ganti password/OAuth; bcrypt; cookie HttpOnly SameSite; isolasi `user_id` di semua query; `research_logs` append-only (tanpa route ubah/hapus); nama upload disanitasi (aman path traversal)
- Verified: `eslint` 0 masalah, `tsc` bersih, `next build` 11/11 route, screenshot mode gelap identik pra-perubahan, alur login → dashboard normal

## [2026-10-10] — CI/CD (PRD FR-25) + temuan drift skema

### Added
- `.github/workflows/ci.yml` — 2 job paralel, gate merah = jangan merge:
  - **backend**: Python 3.11 + service `postgres:15.7-bookworm`, apply `db/init.sql`, `alembic stamp head`, lalu `pytest -q` (61 test: engine deterministik + sharing + social-login)
  - **frontend**: Node 22, `npm ci` -> `npm run lint` -> `npm run check-types` -> `npm run build`
- Terpicu pada push/PR ke `master` + `workflow_dispatch`; `concurrency` membatalkan run lama agar tidak menumpuk

### Verified (lokal, bukan asumsi)
- Seluruh alur job backend diuji dulu di Postgres sekali-pakai lewat Docker (network `ddev-academic_default`): init.sql -> `stamp head` -> **61 test PASS dalam ~20s**
- `npm run lint` exit 0 dan `npm run check-types` exit 0 (perintah yang sama dipakai CI, bukan perintah tambahan)
- YAML divalidasi dengan parser (job, service, env, urutan step)

### Fixed / ditemukan saat memasang CI
- **Drift skema**: `db/init.sql` sudah memuat `feedback_reports`, `shared_links`, `oauth_connections`, `data_sources`, dan kolom `datasets.source_kind/source_meta`, sementara migrasi alembic `f1e2d3c4b5a6` -> `c2d3e4f5a6b7` -> `d3e4f5a6b7c8` membuat tabel yang sama lagi. Akibatnya `alembic upgrade head` **gagal** (`DuplicateTable: relation "feedback_reports" already exists`) pada DB fresh.
- Dampak: langkah `alembic upgrade head` di `docs/runbook-prod.md` (bagian "3. Deploy") tidak bisa dijalankan setelah `init.sql` mengisi volume Postgres baru. Dev tidak terpengaruh karena ddev hanya menjalankan `init.sql`.
- Penanganan CI: `init.sql` sebagai sumber skema + `alembic stamp head` (cukup menandai versi, tanpa eksekusi migrasi). Ini menutupi, bukan memutus akar — perlu keputusan: jadikan alembic satu-satunya sumber (init.sql hanya baseline), atau buat ketiga migrasi idempoten (`CREATE TABLE IF NOT EXISTS`).
- CI perlu `STORAGE_DIR` (default `/code/storage` tidak bisa dibuat di runner) dan `JWT_SECRET` >=32 char (`main.py` menolak lebih pendek saat import).

### Catatan kode (bukan bagian CI)
- `backend/app/routers/datasets.py` masih memakai path hardcode `/tmp/opencode/...` untuk berkas unduhan preview — sisa lingkungan pengembangan. Sebaiknya pakai `tempfile`.

## [2026-10-10] — Fix CI jalan pertama + repo tak bisa di-build

### Bug kritis: repo tidak bisa dibuild dari clone segar
Aturan `*.json` di `.gitignore` (dimaksudkan untuk mencegah commit dataset user)
ikut memblokir berkas konfigurasi frontend. Akibatnya di GitHub **tidak ada satu
pun berkas `.json` ter-track**, termasuk:
- `frontend/package.json` — manifest; tanpa itu `npm install`/`npm ci` mustahil
- `frontend/package-lock.json` — wajib untuk `npm ci` di CI
- `frontend/tsconfig.json`, `frontend/components.json`, `frontend/.prettierrc.json`
- `docs/validation-evidence/engine_outputs.json` — bukti validasi ilmiah (FR-25)

Perbaikan: tambah negasi eksplisit untuk kelima berkas itu + bukti validasi, di
`.gitignore`. Berkas data JSON (mis. `docs/beta-synthetic/report-*.json`,
dataset) tetap terblokir.

### Fix run CI #1
- **Frontend gagal di "Setup Node"** (`Some specified paths were not resolved,
  unable to cache dependencies`) — sebabnya `cache-dependency-path:
  frontend/package-lock.json` menunjuk berkas yang tidak ter-commit. Teratasi
  oleh fix gitignore di atas.
- **Backend gagal di "Apply schema"** — `psql "$DATABASE_URL"` memakai URI
  `postgresql+psycopg://...`; prefiks `+psycopg` milik SQLAlchemy tidak dikenali
  libpq sehingga psql diam-diam jatuh ke Unix socket. Diganti flag eksplisit
  `-h localhost -p 5432 -U postgres -d academic_test`.
- Lockfile diverifikasi sinkron dengan `package.json` (`npm ls
  --package-lock-only` tanpa ketidaksesuaian).

## [2026-10-10] — Fix CI #2: nama folder bentukan dengan aturan `data/`

### Bug
Typecheck CI gagal: `src/hooks/use-current-time-indicator.ts(7,36): error TS2307:
Cannot find module '@/assets/data/constants'`.

### Akar
Aturan `.gitignore` `data/` (untuk folder dataset upload) juga cocok dengan
direktori **sumber** `frontend/src/assets/data/` — namanya sama. Dua berkas `.ts`
di dalamnya tidak pernah ter-commit, jadi typecheck gagal di CI sementara lolos
di mesin lokal (berkas ada di disk, hanya tak ter-track).

### Solusi: hapus, bukan pengecualian
Setelah dilacak, seluruh rantainya **kode mati sisa template AdminCN** yang
fiturnya sudah dibuang saat migrasi:

| Berkas | Pemakai |
| --- | --- |
| `frontend/src/hooks/use-current-time-indicator.ts` (`useCurrentTimeIndicator`) | 0 |
| `frontend/src/hooks/use-event-visibility.ts` (`useEventVisibility`) | 0 |
| `frontend/src/hooks/use-pagination.ts` (`usePagination`) | 0 |
| `frontend/src/assets/data/constants.ts` | hanya hook mati di atas |
| `frontend/src/assets/data/event-type-options.ts` | 0 |

Dihapus (122 baris). Tidak ada tambahan pengecualian `.gitignore` — akar masalah
(nama folder sumber bertabrakan dengan aturan ignore data) hilang, bukan ditambal.

`use-mobile.ts` tetap ada dan masih dipakai (1 pemakai).
