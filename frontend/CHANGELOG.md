
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
