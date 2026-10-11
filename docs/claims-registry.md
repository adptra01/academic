# Evidence Registry — Klaim Publik vs Bukti

> **Satu-satunya sumber kebenaran** untuk klaim yang dipublikasikan di situs.
> Setiap klaim punya bukti, cakupan, dan status. Kalau bukti berubah, status
> berubah. Kalau klaim berubah, barisnya berubah.
>
> Terakhir diperbarui: **2026-10-11**. Bagian "Riwayat perubahan klaim" di
> bawah mencatat koreksi yang pernah dilakukan.

## Status yang dipakai

| Status | Arti |
| --- | --- |
| `tested` | Bukti ada dan bisa direproduksi (test/fixture/commit) |
| `human_review_pending` | Bukti teknis ada, menunggu validator Humans |
| `not_run` | Belum dijalankan — **tidak boleh diklaim** |
| `unsupported` | Tidak ada bukti — **tidak boleh diklaim** |

---

## 1. Klaim komputasi

| # | Klaim publik | Bukti | Cakupan | Status |
| --- | --- | --- | --- | --- |
| C-01 | Statistik dihitung memakai SciPy & StatsModels (bukan rumus yang ditulis manual) | `backend/app/services/stats/*.py` — semua panggilan `ss.*` / `sm.OLS` terlihat terbuka | Seluruh engine | `tested` |
| C-02 | 15 metode MVP tersedia | `backend/methods/registry.yaml`, `frontend/src/lib/methods.ts` | 15 metode | `tested` |
| C-03 | Parameter pustaka dikunci | `backend/requirements.txt` (versi exact) | Semua | `tested` |

> Catatan C-01: ini **koreksi**. Klaim lama menyatakan engine "ditulis ulang
> dari rumus aslinya — bukan panggilan SciPy". Itu tidak benar dan sudah
> dihapus. Yang benar: pustaka standar dipakai terbuka; nilai produk ada di
> orkestrasi, bukan di rumus.

## 2. Klaim validasi numerik

| # | Klaim publik | Bukti | Cakupan | Status |
| --- | --- | --- | --- | --- |
| C-04 | 61 pengujian regresi otomatis di CI | `.github/workflows/ci.yml`, `backend/tests/` | Seluruh repo | `tested` |
| C-05 | Diadu dengan base R, 32 perbandingan, 0 gagal | `docs/validation-evidence/r_outputs.csv` (54 baris, base R di container `rocker/r-base`) + `scripts/validation/compare.py` (exit 0) | **15 metode MVP** | `tested` |
| C-06 | Toleransi 1e-6 (statistik) / 1e-4 (effect size) | Header `compare.py`, `docs/scientific-validation.md` | 32 checks | `tested` |
| C-07 | Selisih Mann-Whitney terdokumentasi (continuity correction) | `docs/scientific-validation.md` catatan di bawah output compare | 1 check | `tested` |
| C-08 | Validasi silang **SPSS** | `docs/scientific-validation.md` tabel manual — **masih kosong** | — | `not_run` |
| C-09 | Persetujuan metodolog (tanda tangan manusia) | Status header `scientific-validation.md` | — | `human_review_pending` |
| C-10 | Effect size memiliki expected value di test-suite | `backend/tests/` — **belum ada assertion numerik effect size** | — | `unsupported` |

> C-10 dicatat sebagai `unsupported` karena situs sempat menyebut toleransi
> 1e-4 untuk effect size. Angka toleransinya benar, tetapi **tesnya belum ada**.
> Klaim tidak boleh naik ke "effect size teruji" sebelum assertion ditulis.

## 3. Klaim reproduksibilitas

| # | Klaim publik | Bukti | Cakupan | Status |
| --- | --- | --- | --- | --- |
| C-11 | Analysis ID format `ANL-YYYYMMDD-XXXXXX` | Diuji manual pada dataset 5.022 baris (`CHANGELOG.md` 2026-10-10/11) | 4 analisis | `tested` |
| C-12 | Rerun menghasilkan `result_hash` identik | Uji manual: `ANL-…-F9G5NL` → rerun `ANL-…-BIKBIV`, hash sama, "identik: YA" | 1 metode (ttest_ind) | `tested` |
| C-13 | `research_logs` append-only (tidak ada endpoint ubah/hapus) | Grep router: tidak ada `PUT/PATCH/DELETE` untuk logs | Seluruh repo | `tested` |
| C-14 | Audit log tidak dapat diubah (integritas) | Hanya absensi route — **belum ada uji manipulasi/permission** | — | `unsupported` |

## 4. Klaim metodologi

| # | Klaim publik | Bukti | Cakupan | Status |
| --- | --- | --- | --- | --- |
| C-15 | Asumsi dicek otomatis sebelum menghitung | `backend/app/services/stats/{normality,ttest,anova}.py`; terverifikasi pada data nyata (normality FAIL → saran non-parametrik) | 3 kelompok metode | `tested` |
| C-16 | Metode diganti otomatis bila n > 5000 (Shapiro → D'Agostino) | `normality.py`, terverifikasi: n=5022 → D'Agostino-Pearson dipilih | 1 aturan | `tested` |
| C-17 | Interpretasi berbahasa Indonesia | `interpretation` di setiap fungsi stats | 15 metode | `tested` |
| C-18 | Wording interpretasi disetujui metodolog | `tasks/prd-…-mvp.md:379` masih open question, **tidak ada penyetujui** | — | `unsupported` |
| C-19 | Helper spreadsheet (copy APA-style) | `frontend/src/lib/api.ts` (`apaStyle`), diuji manual | 1 metode | `tested` |

## 5. Klaim cakupan metode

| # | Klaim publik | Bukti | Cakupan | Status |
| --- | --- | --- | --- | --- |
| C-20 | 15 metode statistik tervalidasi | C-05 (32 checks, 15 metode, 0 fail) | 15 metode | `tested` |
| C-21 | 5 metode fase-2 (ML cluster/classify, TF-IDF, LDA, Apriori) | `backend/tests/test_ml.py` memakai dataset sepele (accuracy selalu 1.0) | 5 metode | `unsupported` — **belum layak diklaim, tidak untuk beta** |
| C-22 | `chi2_gof` punya test | Grep `backend/tests/` → tidak ada | — | `unsupported` |
| C-23 | Ekspor **PDF** menyertakan lampiran (appendix) | `export_service.py::build_pdf` menerima `context` tapi **tidak pernah memakainya** — lampiran hanya ada di DOCX & TeX | — | `unsupported` — dikoreksi 2026-10-11 |
| C-24 | Env dapat dikonfigurasi lewat UI (α, μ₀, n_clusters, dsb.) | `/api/v1/methods/{id}` kini mengirim spec **bertipe** (`variables` vs `params` terpisah); `VariablePicker` merender keduanya | 20 metode | `tested` (diperbaiki 2026-10-11 — sebelumnya 5 metode rusak: `mu`/`n_clusters`/`mode`/`expected`/`min_support` tampil sebagai dropdown kolom) |

---

## Aturan penggunaan

1. **Halaman publik tidak boleh memuat klaim yang statusnya `unsupported` atau
   `not_run`.** Kalau sebuah blok halaman métrakui klaim seperti itu, blok itu
   harus ditulis ulang (bukan diberi tanda bintang kecil).
2. Klaim `tested` boleh tampil **dengan menunjuk ke bukti** (nama berkas, jumlah
   check, atau tautan dokumen validasi).
3. Klaim `human_review_pending` boleh tampil **jika disebut sebagai yang
   menunggu**, bukan sebagai yang selesai.
4. Tambah klaim baru? Tambah barisnya di sini **sebelum** ia muncul di UI.

## Riwayat perubahan klaim

| Tanggal | Klaim | Sebelum | Sesudah | Alasan |
| --- | --- | --- | --- | --- |
| 2026-10-11 | C-01 | "ditulis ulang dari rumus aslinya — bukan panggilan SciPy" | "memakai SciPy & StatsModels, nilai ada di orkestrasi" | Klaim tidak didukung kode; engine memanggil `ss.*` |
| 2026-10-11 | C-05 | "belum ada bukti R" | "32 perbandingan vs base R, 0 gagal" | Validasi R dijalankan sungguhan (`r_outputs.csv`) |
| 2026-10-11 | C-08 | "R dan SPSS dipakai sebagai acuan" (di 7 halaman) | R → done; SPSS → `not_run`, disebut eksplisit | `r_outputs.csv` tidak ada; tabel SPSS kosong |
| 2026-10-11 | C-21 | 20 metode ditampilkan tanpa perbedaan | 5 fase-2 ditandai eksperimental/tidak untuk beta | Tidak ada validasi numerik |
| 2026-10-11 | C-23 | "PDF sudah membawa ... lampiran" | PDF disebut membawa hasil inti; lampiran hanya DOCX & TeX | `build_pdf` menerima `context` tapi tidak memakainya |
| 2026-10-11 | C-24 | 5 metode tidak bisa dikonfigurasi (spec string bebas) | `METHOD_SPEC` bertipe; params dipisah dari kolom; α/μ₀ bisa diisi | Heuristik regex di picker salah baca parameter sebagai kolom |

## Yang harus diisi berikutnya

- [ ] Tabel SPSS di `docs/scientific-validation.md:46-51` — isi hasil SPSS asli, atau hapus klaim SPSS seluruhnya.
- [ ] Assertion numerik effect size di `backend/tests/` (C-10).
- [ ] Test `chi2_gof` (C-22).
- [ ] Uji manipulasi audit log (C-14).
- [ ] Tanda tangan metodolog untuk wording interpretasi (C-18).
- [ ] `LICENSE` di root — keputusan model distribusi.