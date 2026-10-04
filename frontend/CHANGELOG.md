
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
