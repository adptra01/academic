# Method Readiness Matrix — AR-01 Academic Readiness Audit

> **Status**: DRAFT — untuk ditinjau peninjau metodologi
> **Tujuan**: Mendokumentasikan status validasi tiap metode sebelum dibuka untuk beta eksternal.
> **Kriteria beta**: Setiap metode yang dibuka harus memiliki (1) pengujian numerik lulus, (2) dokumentasi asumsi, (3) batasan yang dijelaskan, (4) hasil peninjauan manusia.

---

## 15 Metode MVP + 5 Fase-2 (tidak untuk beta)

| # | Method ID | Nama Tampilan | File Engine | Tes Numerik | Validasi R | Validasi SPSS | Asumsi Ter-dokumen | Batasan Ter-dokumen | Peninjau | Status Beta |
|---|-----------|---------------|-------------|-------------|------------|---------------|---------------------|----------------------|----------|-------------|
| 1 | `descriptive` | Ringkasan data (mean, SD, median) | descriptive.py | ✅ `test_descriptive.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 2 | `normality` | Uji normalitas (Shapiro-Wilk, KS) | normality.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 3 | `pearson` | Korelasi Pearson (linear) | correlation.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 4 | `spearman` | Korelasi Spearman (berpola) | correlation.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 5 | `ttest_1samp` | Uji t satu sampel | ttest.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 6 | `ttest_ind` | Uji t dua kelompok independen | ttest.py | ✅ `test_engine.py` (Welch + Student) | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 7 | `ttest_paired` | Uji t dua pengukuran berpasangan | ttest.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 8 | `anova_oneway` | ANOVA satu arah | anova.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 9a | `chi2_independence` | Uji chi-kuadrat (dua var kat.) | chi2.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ⚠️ Levene butuh SPSS | — | **SIAP DENGAN CATATAN** |
| 9b | `chi2_gof` | Uji chi-kuadrat (kesesuaian) | chi2.py | ✅ `test_gof.py` (baru) | ✅ | ⬜ | ✅ | ⚠️ Levene butuh SPSS | — | **SIAP DENGAN CATATAN** |
| 10 | `mannwhitney` | Uji Mann-Whitney U | nonparam.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 11 | `wilcoxon` | Uji Wilcoxon (berpasangan) | nonparam.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 12 | `kruskal` | Uji Kruskal-Wallis | nonparam.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 13 | `linreg_simple` | Regresi linier sederhana | regression.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 14 | `linreg_multiple` | Regresi linier berganda | regression.py | ✅ `test_engine.py` | ✅ | ⬜ | ✅ | ✅ | — | **SIAP** |
| 15 | `ml_classify` | Klasifikasi ML | ml_classify.py | ⬌ | ⬌ | ⬜ | ❌ | ❌ | — | **DIBATASI** |
| 16 | `ml_cluster` | Clustering ML | ml_cluster.py | ⬌ | ⬌ | ⬜ | ❌ | ❌ | — | **DIBATASI** |
| 17 | `text_tfidf` | Vektorisasi TF-IDF | text_mining.py | ⬌ | ⬌ | ⬜ | ❌ | ❌ | — | **DIBATASI** |
| 18 | `text_lda` | Topic Modeling LDA | text_mining.py | ⬌ | ⬌ | ⬜ | ❌ | ❌ | — | **DIBATASI** |
| 19 | `apriori` | Aturan Asosiasi | apriori.py | ⬌ | ⬌ | ⬜ | ❌ | ❌ | — | **DIBATASI** |

**Legenda**: ✅ = selesai & lulus, ⬌ = tes ada tapi tidak lengkap/validasi eksternal, ❌ = belum ada, ⬜ = belum dilakukan, ⚠️ = perlu perhatian khusus.

---

## Catatan Kritis per Metode

### Chi-Square (Independence & GOF) — Butuh SPSS untuk Levene
- **Masalah**: Base R tidak menyediakan uji Levene. Validasi silang SPSS diperlukan untuk mengonfirmasi asumsi homogenitas varians (untuk chi2_independence, frekuensi harapan <5).
- **Tindakan**: Tandai beta dengan catatan "asumsi Levene diverifikasi manual via SPSS". Jika tidak ada akses SPSS, batasi ke dataset dengan expected ≥ 5.

### ML / Text / Apriori (Fase-2) — Tidak untuk Beta MVP
- **Alasan**: Tidak ada tes numerik, tidak ada validasi R/SPSS, tidak ada dokumentasi asumsi/batasan, output belum standar MVP (tidak ada effect size, CI, dll).
- **Tindakan**: Sembunyikan dari UI beta (flag `FEATURE_PHASE2=false` atau hapus dari `METHODS` array di `ProjectView.tsx` untuk rilis beta).

---

## Matriks Advice Rules (MA-01..MA-06)

| Rule | Pemicu | Rekomendasi | `switch_to` | Tes Positif | Tes Negatif | Kasus Ambigu | Status |
|------|--------|-------------|-------------|-------------|-------------|--------------|--------|
| MA-01 | ID duplikat (>0) | Hapus/gabungkan duplikat | None | ✅ `test_advice.py` | ✅ | ID kardinalitas rendah | ✅ SIAP |
| MA-02 | Missing >5% (serius >40%) | Perbaiki data / pilih kolom lain | None | ✅ | ✅ | Missing di kolom non-terpilih | ✅ SIAP |
| MA-03 | `ttest_ind` + grup >2 | Pindah ke ANOVA | `anova_oneway` | ✅ | ✅ | Grup = 2 tapi tidak seimbang | ✅ SIAP |
| MA-04 | Grup <2 level | Pilih kolom lain | None | ✅ | ✅ | NA | ✅ SIAP |
| MA-05 | Outlier IQR >5% | Tinjau ekstrem / pakai robust | `mannwhitney`, `wilcoxon`, `spearman` | ✅ | ✅ | IQR = 0 (pagar kuantil) | ✅ SIAP |
| MA-06 | Skala 1..5 bulat ≤7 unik | Set tipe Ordinal | None | ✅ | ✅ | Skala 1..7, atau 0..10 | ✅ SIAP |

**Catatan**: Semua rule level `warn`, bukan `blocking`. Ini sesuai prinsip: sistem menyinggarkan konsekuensi, peneliti memutuskan.

---

## Gap yang Harus Ditutup Sebelum Beta

| Gap | Prioritas | Penanggung Jawab | Target Selesai |
|-----|-----------|------------------|----------------|
| Validasi SPSS untuk Levene (chi2, t-test homogen) | TINGGI | Peninjau metodologi | Minggu 1 |
| Peninjauan interpretasi otomatis (result view) | TINGGI | Frontend + Peninjau | Minggu 1 |
| Tes skenario penelitian nyata (5 keluarga) | TINGGI | Dev + Peninjau | Minggu 1-2 |
| Konsistensi ekspor 6 format vs hasil kanonis | SEDANG | Dev | Minggu 1 |
| Version hash coverage (preprocessing, engine version) | SEDANG | Dev | Minggu 1 |
| UI: sembunyikan metode Fase-2 (ML/Text/Apriori) | RENDAH | Frontend | Minggu 1 |

---

## Definisi "SIAP BETA" per Metode

Suatu metode dinyatakan **SIAP** untuk beta eksternal jika **semua** terpenuhi:

1. ✅ Tes numerik lulus vs SciPy/R (toleransi terdokumentasi)
2. ✅ Asumsi & batasan terdokumentasi di `docs/scientific-validation.md` dan UI
3. ✅ Pre-flight menangkap error konfigurasi & data
4. ✅ Advice rules (MA) relevan untuk metode tersebut lulus review
5. ✅ Result view menyajikan narasi akademik (bukan flatten Key/Value)
5. ✅ Ekspor 6 format konsisten dengan hasil kanonis
6. ✅ Hash & reproduksibilitas terverifikasi (analysis_hash, dataset_version)
7. ✅ Peninjau metodologi menandatangani `docs/scientific-validation.md`

---

## Rencana Pelaksanaan AR-01 (Minggu 1-2)

| Hari | Aktivitas | Deliverable |
|------|-----------|-------------|
| 1-2 | Buat dataset referensi 5 keluarga skenario | `docs/ar-01-audit/scenarios/*.csv` + metadata |
| 2-3 | Jalankan skenario via UI (E2E), simpan artefak lengkap | `docs/ar-01-audit/results/{scenario}_*/` |
| 3-4 | Bandingkan numerik vs referensi independen (SciPy/R) | `docs/ar-01-audit/reference_outputs/compare_*.md` |
| 4-5 | Audit advice rules per metode dengan dataset uji | `docs/ar-01-audit/review/advice_review.md` |
| 5-6 | Uji pre-flight: blokir, konfirmasi, warning | `docs/ar-01-audit/review/preflight_review.md` |
| 6-7 | Uji konsistensi ekspor (CSV/XLSX/PDF/DOCX/TeX/JSON) | `docs/ar-01-audit/review/export_review.md` |
| 7-8 | Review interpretasi & narasi result view | `docs/ar-01-audit/review/interpretation_review.md` |
| 8-9 | Peninjau metodologi menandatangani | `docs/scientific-validation.md` (sign-off) |
| 9-10 | Keputusan go/no-go per metode | `docs/ar-01-audit/RELEASE_DECISION.md` |

---

## Catatan untuk Pengembang

**Jangan tambahkan fitur baru** selama AR-01 berlangsung. Fokus pada:
1. Memperbaiki temuan audit (jika ada)
2. Menyempurnakan result view renderer per metode
3. Memastikan advice rules muncul di UI pre-flight & result
4. Verifikasi hash coverage

Setelah AR-01 selesai dan `RELEASE_DECISION.md` ditandatangani, baru lanjut ke pengujian pengguna terbatas (Minggu 3-4 roadmap 30 hari).