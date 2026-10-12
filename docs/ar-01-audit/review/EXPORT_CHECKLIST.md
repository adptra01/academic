# AR-01 Export Validation Checklist

## Tujuan
Memastikan 6 format ekspor (CSV, XLSX, PDF, DOCX, TeX, JSON) konsisten dengan hasil kanonis engine.

---

## Checklist per Format

| Item | CSV | XLSX | PDF | DOCX | TeX | JSON |
|------|-----|------|-----|------|-----|------|
| **Identitas** | | | | | | |
| Analysis ID tercantum | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Dataset version tercantum | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Metode & parameter | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Waktu analisis | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Versi software | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **Hasil Numerik** | | | | | | |
| Statistik uji (t, χ², F, r, ρ, U, W, H) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Derajat kebebasan (df) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| p-value (format `p < .001` bukan `1.2e-45`) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Effect size (Cohen's d, V, R², VIF) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Interval kepercayaan (jika ada) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **Deskriptif & Asumsi** | | | | | | |
| n_source vs n_analisis | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| n_rows_dropped | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Warning asumsi | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Tabel kontingensi (chi2) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **Narasi & Interpretasi** | | | | | | |
| Ringkasan analisis | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Interpretasi (Bahasa Indonesia) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Batasan metodologis | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Formula LaTeX | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **Reproduksibilitas** | | | | | | |
| Analysis ID | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Result hash | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Riwayat transformasi | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Konfigurasi lengkap | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **Kualitas File** | | | | | | |
| Nama file: `laporan_<uid>_<method>.<ext>` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Encoding UTF-8 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Angka desimal koma (ID) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Label Bahasa Indonesia | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Appendix lengkap (PDF/DOCX/TeX) | — | — | ☐ | ☐ | ☐ | — |

---

## Prosedur Validasi

1. **Jalankan analisis acuan** (mis. `ttest_ind` pada `A1_balanced_equal_var.csv`)
2. **Ekspor 6 format** via API `/exports`
3. **Bandingkan numerik** tiap file dengan `engine_result.json` (kanonis)
4. **Periksa visual** PDF/DOCX/TeX untuk layout, formula, appendix
5. **Verifikasi hash** result_hash di metadata ekspor sama dengan engine
6. **Catak temuan** di `docs/ar-01-audit/review/export_review.md`

---

## Kriteria Lulus

- ✅ Semua 6 format memiliki isi numerik identik (selisih < 1e-10)
- ✅ p-value diformat `p < .001` di SEMUA format
- ✅ Label Bahasa Indonesia di SEMUA format
- ✅ Appendix PDF/DOCX/TeX berisi: dataset info, versi, variabel, parameter, hash, timestamp
- ✅ Nama file mengikuti pola `laporan_<uid>_<method>.<ext>`
- ✅ JSON ekspor valid dan berisi struktur lengkap (bukan flatten)

---

## Catatan Khusus per Format

### CSV
- Hanya tabel hasil utama (tanpa metadata)
- Header: `Kunci,Nilai` (Bahasa Indonesia)
- Cocok untuk import spreadsheet lain

### XLSX
- Multi-sheet: `Ringkasan`, `Statistik`, `Perhitungan`, `Parameter`, `Asumsi`, `Transformasi`
- Setiap sheet diberi header bahasa Indonesia

### PDF
- Render via ReportLab
- Appendix halaman terakhir
- Formula LaTeX dirender sebagai teks (bukan MathJax)

### DOCX
- Render via python-docx
- Appendix terpisah
- Tabel diformat rapi

### TeX
- File `.tex` yang bisa dikompilasi `pdflatex`
- Menggunakan `booktabs`, `siunitx`, `amsmath`
- Appendix via `\appendix`

### JSON
- Struktur hierarkis lengkap (mirip `engine_result`)
- Termasuk `warnings`, `notes`, `advice` (MA rules)
- Bisa di-parse programatik untuk meta-analisis