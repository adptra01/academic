
## [2026-10-08] — Layout tahap 02–07: stepper vertikal + panel satu tahap
- Ganti navigasi ganda (ProcessRail horizontal + barisan 7 tab) dengan satu stepper vertikal `components/app/step-nav.tsx`: ikon + nama + nomor tahap + ringkasan hasil + status selesai/terkunci; sticky di desktop, chip scroll-mendatar di ponsel
- Tiap tahap kini satu panel: kepala "Tahap NN dari 06" + judul + petunjuk + konten, plus tombol Kembali/Lanjut; diff "Bandingkan Versi" digabung sebagai sub-kartu opsional di tahap Bersihkan (bukan tahap wajib)
- Status jujur dari data: terkunci bila belum ada file, selesai bila ada artefaknya (file/kolom/versi/analisis/unduhan); daftar file + ambil-dari-web pindah ke dalam tahap 02
- Token dipakai ulang dari `@theme` (paper/ink/rule/accent), tanpa warna baru; animasi hanya `fade-in` (transform/opacity)
- Insiden: `</div>` grid kurang satu + bungkus `<Card>` diff hilang saat pemindahan blok → diperbaiki; overflow 1142px di 390px karena grid item tanpa `min-w-0` → ditambah
- Verified: `tsc` bersih, `next build` 11/11, klik Lanjut pindah tahap + header ikut ("Tahap 03 dari 06"), 390/390 tanpa overflow

## [2026-10-08] — Perbaikan "Failed to fetch" + bahasa menu untuk user umum
- **Akar masalah "Failed to fetch"** (bukan CORS): (1) container `db` mati → backend 500 dengan `psycopg.OperationalError [Errno -2] Name or service not known`; `/health` tetap 200 karena **tidak menyentuh database** sehingga health check menipu; (2) default `apiUrl()` jatuh ke `localhost:8000` yang hanya hidup di jaringan container — DDEV memetakan `:8000` → host `:8100`
- `lib/api.ts`: default → `http://localhost:8100`; `fetchWithContext()` mengubah kegagalan jaringan menjadi pesan yang menyebut URL yang dicoba + langkah perbaikan; dipakai di 6 halaman + `xhr.onerror` upload. Halaman login juga menangani respons non-JSON dan `access_token` yang hilang
- `frontend/.env.local` dibuat (git-ignored) supaya `next dev` tanpa env tetap benar
- Login page dirapikan: field API URL dipindah ke `<details>` "API tidak bisa dihubungi?" + tombol buka `/health`; pesan 401 → "Sesi berakhir"
- `lib/plain-terms.ts` (baru): satu kamus istilah teknis → bahasa sehari-hari, dipakai bersama oleh dashboard dan project detail agar tidak ada dua kosakata untuk satu hal
- Bahasa menu: tab `Dataset/Variables/Preprocess/Diff/Analysis/Log/Export` → `Lihat Data/Atur Kolom/Bersihkan Data/Bandingkan Versi/Jalankan Analisis/Riwayat Analisis/Unduh Hasil`, masing-masing dengan ikon + subjudul penjelasan; `Unggah dataset` → `Unggah File Data`; `dipakai` → `sedang dipakai`; `Run` → `Jalankan Analisis` (form bernomor 1–2)
- `ProcessRail`: tiap tahap punya ikon + nomor + nama; di bawah `md` berubah jadi daftar vertikal bertingkat dengan penanda "sedang dikerjakan" (rail horizontal memaksa scroll mendatar di ponsel)
- `OP_PLAIN` + `METHOD_PLAIN`: 15 operasi dan 20 metode punya nama bahasa sehari-hari, dengan nama teknis tetap ditampilkan di bawahnya agar cocok dengan log, ekspor, dan literatur
- Insiden: ikon tab menempel ke label (tidak ada `gap`) → `gap-2` + `shrink-0`; `langkah 01` masih tertinggal di satu tempat → `Tahap 01`
- Verified: `pytest` 61 passed, `tsc` bersih, `next build` 11/11, login sukses di `localhost:3000`, pesan baru terverifikasi saat URL disetel ke port mati (`:9999`), tanpa horizontal overflow di 390px, rel+tab sinkron dengan tab

## [2026-10-06] — Konsol: dashboard + project detail
- Primitif `ui/*` diselaraskan ke design token yang sama dengan halaman public: kartu jadi hairline tanpa shadow, tombol ke aksen petrol + `pressable` + `ring-accent`, badge/alert terdesaturasi, tabel header mono kecil + angka tabular, tab jadi rail garis bawah (bukan pil abu-abu), input/label rapat + fokus aksen
- `ProcessRail` (baru): 7 tahap `Buat project → Unggah data → Variabel → Bersihkan → Analisis → Hasil → Ekspor`, dipakai di dashboard (`current=1`) dan project detail (ikut tab aktif lewat `STAGE_BY_TAB`) — urutan Create Project → Open Project → selanjutnya jadi kerangka yang selalu terlihat
- Shell konsol `(app)/layout.tsx`: sticky, `bg-paper-2`, nav Dashboard/Metode/Reproduksi, nama pengguna dari profil yang disimpan saat login; nav pindah ke sheet di bawah `md` supaya rail tahap dapat lebar penuh
- Dashboard: rail tahap, form Create Project memakai `research_type` (5 nilai yang diizinkan backend) + `description` — sebelumnya UI mengabaikan keduanya; daftar project jadi hairline list dengan `Buka` + tombol hapus (ikon, `aria-label`), skeleton saat memuat, empty state, ganti password di `<details>`
- Project detail: header meta (judul, jenis, jumlah dataset/analisis/export), upload + empty state "Belum ada dataset", daftar dataset hairline dengan badge `dipakai`, blok import API/scraper jadi `<details>` opsional (sebelumnya selalu tampil di atas lipatan), 7 tab tetap sama
- Halaman `analyses/[uid]` belum disentuh (fase berikutnya)
- Insiden: rail tahap + TabsList melebar dokumen di 390px (`min-w-max` + `inline-flex`) → `w-full max-w-full overflow-x-auto overscroll-x-contain`; tombol `Buka` dengan `opacity-0` tidak terlihat saat hover di headless → jadi selalu tampil
- Verified: `tsc --noEmit` bersih, `next build` 11/11, 200 di 4 halaman public + 4 rute aplikasi, rail ikut tab (Log → tahap 06 Hasil), research log menampilkan 6 analisis + hash dari API nyata, tanpa horizontal overflow di 390px (`scrollW=clientW=390` di dashboard & project)

## [2026-10-06] — Halaman public (welcome + 3 halaman detail)
- Route group `(marketing)` dengan shell sendiri (header/grain/footer); `(app)` menyimpan halaman terautentikasi → **URL lama tidak berubah** (`/dashboard`, `/login`, `/register`, `/analyses/[uid]`, `/projects/[id]`, `/shared/[token]`, `/auth/callback` tetap sama)
- Welcome page dipecah: 9.180px → **3.164px**. Rincian dipindah ke `/metode` (katalog + filter/pencarian), `/alur` (8 langkah + format + 15 operasi + grafik), `/reproduksi` (audit log + result_hash + bukti validasi R/SPSS). Welcome: hero + ringkasan 7 kelompok + 4 langkah inti + CTA
- Nav jadi tautan rute sungguhan + active state (`aria-current="page"`) via `usePathname`; footer ikut diperbarui (anchor `#format` yang mati sudah diganti)
- Design system: token Tailwind v4 (`paper/ink/rule/accent/abyss` + aksen petrol tunggal), font Archivo + IBM Plex Mono (mono untuk semua angka & ID), tekstur grafik-kertas + grain fixed, underline SVG `pathLength="1"`
- Konten diturunkan dari kode, bukan dikarang: 15 metode MVP + 5 fase 2 dari `methods/registry.yaml`, 15 op dari `VALID_OPS`, 13 tipe grafik dari `CHART_TYPES`, 6 format export, toleransi 1e-6/1e-4 dari gate rilis
- State lengkap: katalog punya loading→hasil (skeleton shimmer), empty state, dan error inline; "Analysis record" di hero memanggil `/health` sungguhan (status engine jujur online/offline + Coba lagi)
- a11y: gate `.js-reveal` (tanpa JS konten tetap terlihat), `prefers-reduced-motion`, label di atas input + helper text, skip-to-content belum (TODO)
- Insiden: `[data-reveal]{opacity:0}` bikin 38 elemen tak terlihat bila observer gagal → diperbaiki dengan gate `js-reveal` + `threshold 0`; label meta di alur kerja menabrak teks → meta dipindah jadi chip; header jadi dobel saat layout `(marketing)` dibuat (page lama masih render SiteHeader sendiri) → header/footer/grain hanya dari layout
- Section `Format` di `/alur` dirapikan: 3 kolom tinggi tak sama + blok 15-op yang terpisah → 3 grup seragam (`Format file` 5 masuk/6 keluar berdampingan, `Tipe grafik` grid 13, `Operasi preprocessing` daftar 2 kolom dengan keterangan per op); kolom konteks jadi sticky; grid grafik pakai border eksplisit supaya sel kosong di baris terakhir tidak tampil sebagai blok abu
- Duplikasi judul dibersihkan: h2 `Pipeline` dan `Provenance` dihapus karena `PageHeader` sudah memikulnya (teksnya sama persis sebelumnya)
- Nav `Beranda` dikembalikan sebagai item pertama + breadcrumb `← Beranda` di halaman detail
- Verified: `tsc --noEmit` bersih, `next build` 11/11 page (4 public statis), 200 di 4 halaman public + 4 rute aplikasi, anchor `/metode#wilcoxon` mendarat di top=112, tanpa horizontal overflow di 390px (scrollW=clientW=390)
- Catatan: `next lint` tidak dijalankan — ESLint belum dikonfigurasi di repo (prompt interaktif), di luar scope

## [2026-10-04] — Export LaTeX
- `build_latex` (article+booktabs+graphicx+hyperref): tabel statistik, formula verbatim, calculation, figure placeholder + appendix; escape karakter khusus; format `tex` di endpoint + CHECK + UI
- Verified: 200, begin/end seimbang (5/5), header/footer OK

## [2026-10-04] — Rename + drop kolom (tutup gap PRD Fase 2)
- Ops baru: `rename` {mapping} (validasi kolom ada, nama baru unik/tidak kosong) + `drop_columns` {columns} (tolak hapus semua); 15 ops total; dropdown UI otomatis (OPS const)
- Variables carry-over: kolom rename → auto-suggest baru (role reset Ignore, terdokumentasi); drop → hilang
- Tests: `tests/test_preprocess.py` (6 cases: rename/drop/fill/drop-missing/outlier+scale/unknown-op); pytest 22 passed
- E2E: rename→v2, drop gender→v3 (2 cols), preview v3 OK

## [2026-10-04] — Logout + hapus project + Alembic
- UI: tombol Logout di nav (client component, hapus token + panggil /logout), tombol Hapus per project (konfirmasi)
- API: DELETE project kini hapus file storage dataset/version (sebelumnya yatim); cascade DB tidak berubah
- Alembic aktif: `backend/alembic.ini` + `migrations/{env.py,script.py.mako,versions/}`; autogenerate vs live DB = 0 create/add ops (model⇄DB sinkron, terbukti); baseline no-op `c328765abd10` di-stamp head; runbook mencatat workflow revisi
- Verified: del-project 204→404, logout UI→Login, tsc bersih, pytest 22 passed

## [2026-10-05] — Cetak, JSON, a11y
- Print CSS (@media print): nav/form/tombol disembunyikan — halaman hasil bisa dicetak ke PDF via browser
- Export JSON (uid+method+result+hash+version); CHECK +ALTER (csv|xlsx|pdf|docx|tex|json); tombol UI; terverifikasi struktur
- aria-label pada form login/register/dashboard (langkah awal aksesibilitas)
- Verified: pytest 25 passed, tsc bersih

## [2026-10-05] — Diff version + unduh PNG
- `GET /datasets/{id}/diff?from&to`: delta baris, kolom tambah/hilang, drift mean+missing numerik; 404 versi tak ada; UI bandingkan + tabel
- Tombol "Unduh PNG grafik" (blob URL + download attr)
- Insiden: 2 file rusak oleh edit (def+body menempel di datasets.py, div ganda di page) → diperbaiki; pelajaran: JANGAN edit baris def/JSX-boundary tanpa baca ulang; health+pytest+tsc selalu setelah restart
- Verified: diff v1→v3 (+kualitas, -service_quality/gender), pytest 25 passed, tsc bersih

## [2026-10-05] — Paging preview + pilih kolom grafik
- Preview: Prev/Next (limit 10, offset) + counter "Baris X–Y dari N"; reset saat ganti dataset/version
- Chart: param `column` override (histogram/boxplot/qq) + dropdown kolom di UI untuk descriptive multi-kolom; 422 kolom tak ada
- Verified: chart override 200, offset ok, pytest 25 passed, tsc bersih

## [2026-10-05] — Apriori DONE (feature/apriori dari master, RC1 utuh)
- Modul `stats/apriori.py` mandiri (tanpa dep baru): one-hot otomatis, kandidat level-wise + pruning, support/confidence/lift, filter min_support/confidence/lift + max_length, traceability penuh
- Grafik `rules` (bar lift top-15 + garis lift=1); registry/spec/UI terisi
- Verified: pytest 30 (27 RC1 + 3 Apriori hitung-manual), tsc bersih, E2E 22 rules + chart 200

## [2026-10-05] — Login dengan Google (feature/social-login)
- GET /auth/google/url + POST /auth/google/callback: tukar code, verifikasi ID token (google-auth resmi), auto-link hanya email_verified, sesi JWT internal sama; tanpa config → 501 jelas
- Keamanan: password_hash marker oauth:google (login password selalu gagal), token Google tak disimpan, rate-limit 10/mnt
- UI: tombol di login + halaman /auth/callback; docs/social-login.md (setup Cloud + redirect URI dev/prod)
- Verified: pytest 58 (55 + 3 mocked), tsc bersih; E2E penuh butuh kredensial Google asli (milik user)
