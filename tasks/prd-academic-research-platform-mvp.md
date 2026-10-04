# PRD: Academic Research Analysis Platform — MVP

## Introduction / Overview

**Nama sementara produk:** Academic Research Analysis Platform

**Prinsip produk:** Mesin analisis ilmiah deterministik adalah inti produk. AI hanya fitur opsional fase lanjutan dan DILARANG menjadi jalur perhitungan.

**Masalah yang diselesaikan:**
Peneliti umum (mahasiswa S1/S2/S3 dan peneliti) yang melakukan penelitian kuantitatif/komputasional saat ini harus berpindah-pindah antara Excel/SPSS/R/Python, menyalin hasil manual ke Word, dan tidak memiliki jejak analisis yang reproducible. Tidak ada satu alur end-to-end: Upload dataset → definisi variabel → cek asumsi → hitung dengan rumus transparan → interpretasi → tabel/grafik akademik → export → reproducibility log.

**MVP ini membuktikan:** Seorang peneliti dapat melakukan penelitian kuantitatif dasar sepenuhnya di dalam platform dengan hasil yang benar (tervalidasi vs SPSS/R/Python), transparan (formula + parameter + kalkulasi ditampilkan), dan reproducible (dataset version + Analysis ID + log + timestamp).

**Satu penelitian = satu Project:**
```
PROJECT
├── Dataset (versioned)
├── Data Preparation (log transformasi)
├── Variables (type + role)
├── Analysis (method + params)
├── Results (stat + decision + effect size)
├── Research Log (append-only)
└── Export (CSV/XLSX/PDF)
```

**Contoh acuan:** Skripsi — Pengaruh Kualitas Pelayanan terhadap Kepuasan Pelanggan (n=150, X=service_quality, Y=customer_satisfaction).

## Goals

- Peneliti dapat Register → Login → Create Project → Open Project tanpa bantuan admin.
- Peneliti dapat Upload CSV/XLSX/XLS/SAV/JSON dan melihat preview + profil dataset (rows, cols, missing %, tipe kolom) dalam < 10 detik untuk file ≤ 50MB.
- Peneliti dapat mengkonfigurasi variabel (type: Numerical/Ordinal/Nominal/Binary/Text + role: Independent/Dependent/Control/Grouping/ID).
- Peneliti dapat melakukan preprocessing dasar TANPA merusak dataset asli (semua transformasi menghasilkan dataset version baru).
- Sistem menjalankan 15 metode statistik MVP (Chi-Square = 2 endpoint) dengan cek asumsi otomatis sebelum perhitungan.
- Setiap hasil menampilkan: Method, Sample n, Group stats, Test statistic, df, p-value, CI, Effect Size, Formula, Parameters, Calculation steps, Decision (α=0.05, Reject/Fail to reject H0), dan Interpretasi terpisah.
- Setiap analisis memiliki Analysis ID unik, dataset version reference, software version, timestamp, dan dapat dibuka ulang (rerun identik).
- Peneliti dapat membuat tabel statistik + grafik akademik (histogram, boxplot, scatter, bar, line, distribution, correlation, regression) yang layak skripsi/paper.
- Peneliti dapat Export hasil ke CSV/XLSX/PDF termasuk appendix (dataset info + method + params + formula + calculation + result).
- Hasil numerik lolos validasi ilmiah vs referensi (SPSS/R/Python) dalam toleransi yang ditentukan.

## User Stories

### US-001: Registrasi akun
**Description:** As a peneliti, I want mendaftar dengan email + password so that saya memiliki akun untuk menyimpan project penelitian saya.

**Acceptance Criteria:**
- [ ] Form register: email (validasi format), password (min 8 char), nama
- [ ] Email duplikat ditolak dengan pesan "Email sudah terdaftar"
- [ ] Password di-hash (bcrypt/argon2, bukan plaintext) di database
- [ ] Setelah sukses, user diarahkan ke dashboard project
- [ ] Typecheck/lint passes

### US-002: Login dan session
**Description:** As a peneliti terdaftar, I want login dan tetap login so that saya dapat kembali ke project tanpa login ulang setiap saat.

**Acceptance Criteria:**
- [ ] Form login: email + password, error spesifik "Email atau password salah" (tidak bocorkan mana yang salah)
- [ ] Session JWT HttpOnly cookie, expiry otomatis 24 jam
- [ ] Tombol logout menghapus session dan redirect ke /login
- [ ] Halaman /dashboard tanpa login redirect ke /login
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Membuat dan membuka project
**Description:** As a peneliti, I want membuat project penelitian baru so that semua dataset, variabel, analisis, dan export tersimpan dalam satu wadah.

**Acceptance Criteria:**
- [ ] Tombol "New Project" membuka modal: title (wajib), description (opsional), research_type (dropdown: Skripsi/Tesis/Disertasi/Paper/Lainnya)
- [ ] Dashboard menampilkan daftar project (title, updated_at, jumlah dataset, jumlah analisis)
- [ ] Klik project membuka detail project dengan tab: Dataset | Variables | Analysis | Results | Log | Export
- [ ] User hanya melihat project miliknya (project isolation, query difilter by user_id)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Upload dataset (CSV/XLSX/XLS/SAV/JSON)
**Description:** As a peneliti, I want upload file dataset so that saya dapat memulai analisis tanpa konversi manual.

**Acceptance Criteria:**
- [ ] Dropzone menerima .csv, .xlsx, .xls, .sav, .json, max 50MB, validasi ekstensi + MIME
- [ ] File tersimpan ke S3-compatible storage dengan path `users/{user_id}/projects/{project_id}/datasets/{version}/original.<ext>`
- [ ] Metadata tersimpan: filename, size_bytes, rows, cols, uploaded_at
- [ ] File korup / format salah menampilkan error ramah "File tidak dapat dibaca, periksa format"
- [ ] Upload progress bar terlihat
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Preview dan profil dataset
**Description:** As a peneliti, I want melihat preview + profil dataset so that saya paham struktur data sebelum analisis.

**Acceptance Criteria:**
- [ ] Tampilkan: Rows count, Columns count, Missing % total
- [ ] Tabel preview 20 baris pertama dengan pagination
- [ ] Daftar kolom: name, detected_type (numerical/categorical/text/datetime), missing_count, unique_count
- [ ] Deteksi missing value (empty, NA, NaN, null) dan duplicate rows count
- [ ] Loading preview ≤ 10 detik untuk file ≤ 50MB
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Dataset versioning (immutable original)
**Description:** As a peneliti, I want dataset asli tidak pernah diubah so that setiap preprocessing dapat dilacak dan direproduksi.

**Acceptance Criteria:**
- [ ] Tabel `dataset_versions`: id, dataset_id, version_number (v1, v2...), parent_version_id, transformation_log JSON, created_at
- [ ] Operasi preprocessing SELALU membuat version baru, tidak UPDATE in-place
- [ ] UI menampilkan dropdown version selector + diff log "v1 → v2: drop_missing(age), encode(gender)"
- [ ] Dapat mengembalikan active_version ke versi lama untuk analisis
- [ ] Typecheck/lint passes

### US-007: Konfigurasi variabel (type + role)
**Description:** As a peneliti, I want menentukan tipe dan peran setiap variabel so that engine memahami struktur ilmiah dataset.

**Acceptance Criteria:**
- [ ] Per kolom dapat set Type: Numerical | Ordinal | Nominal | Binary | Text | Datetime | ID
- [ ] Per kolom dapat set Role: Independent | Dependent | Control | Grouping | ID | Ignore
- [ ] Auto-suggest: kolom numerik → Numerical, kolom 2 nilai unik → Binary, kolom teks panjang → Text (dapat di-override)
- [ ] Validasi: minimal 1 Dependent untuk analisis inferensial, tampilkan warning jika belum diset
- [ ] Konfigurasi tersimpan per dataset_version
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-008: Preprocessing numerik dasar
**Description:** As a peneliti, I want membersihkan variabel numerik so that data siap uji statistik.

**Acceptance Criteria:**
- [ ] Pilihan per kolom: drop_missing | fill_missing (mean/median/mode/constant) | detect_outlier (IQR, tampilkan count + batas) | remove_outlier | scale (standard/minmax) | transform (log/sqrt)
- [ ] Preview before/after (5 baris + mean/SD before/after)
- [ ] Eksekusi via background job (Celery) jika rows > 10.000, tampilkan job status
- [ ] Hasilkan dataset version baru + transformation_log
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-009: Preprocessing kategorikal + teks + duplikat
**Description:** As a peneliti, I want membersihkan variabel kategorikal/teks dan duplikat so that data konsisten.

**Acceptance Criteria:**
- [ ] Kategorikal: category mapping (mis. "L"/"P" → "Laki-laki"/"Perempuan"), one-hot/dummy encoding toggle
- [ ] Teks: lowercase, punctuation removal, tokenization preview, stopword removal (ID + EN list), stemming/lemmatization toggle
- [ ] Duplikat: tombol "Remove duplicate rows" menampilkan jumlah duplikat yang akan dihapus + konfirmasi
- [ ] Semua operasi menghasilkan version baru, tidak merusak original
- [ ] Typecheck/lint passes

### US-010: Descriptive statistics
**Description:** As a peneliti, I want melihat statistik deskriptif so that saya memahami karakteristik data.

**Acceptance Criteria:**
- [ ] Input: pilih 1..N kolom numerik + dataset_version
- [ ] Output tabel: n, mean, median, mode, min, max, range, variance, SD, Q1, Q3, IQR, skewness, kurtosis + frequency/percentage untuk kategorikal
- [ ] Validasi numerik vs referensi Python (toleransi 1e-6) pada test suite
- [ ] Hasil tersimpan ke `analysis_results` dengan Analysis ID
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-011: Normality test (Shapiro-Wilk + Kolmogorov-Smirnov)
**Description:** As a peneliti, I want menguji normalitas so that saya tahu apakah boleh memakai uji parametrik.

**Acceptance Criteria:**
- [ ] Input: 1 kolom numerik, pilih metode (Shapiro jika n ≤ 5000 auto-suggest, KS jika n > 5000)
- [ ] Output: W/D statistic, p-value, α=0.05, decision (Normal / Tidak normal), QQ-plot + histogram
- [ ] Warning otomatis jika n > 5000 untuk Shapiro ("gunakan KS/Lilliefors")
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-012: Correlation (Pearson + Spearman)
**Description:** As a peneliti, I want menguji korelasi antar variabel numerik so that saya tahu kekuatan hubungan.

**Acceptance Criteria:**
- [ ] Input: X (numerical), Y (numerical), α default 0.05
- [ ] Cek asumsi otomatis: Pearson → tampilkan hasil normality X dan Y + warning jika tidak normal (sarankan Spearman); Spearman → tanpa asumsi normalitas
- [ ] Output: r/rho, p-value, CI 95%, n, scatter plot + garis tren, interpretasi kekuatan (0.0-0.2 sangat lemah ... 0.8-1.0 sangat kuat)
- [ ] Contoh acuan lolos: service_quality vs customer_satisfaction r ≈ 0.621
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-013: t-Test (One-Sample, Independent, Paired)
**Description:** As a peneliti, I want membandingkan mean 1 atau 2 kelompok so that saya dapat menguji hipotesis beda rata-rata.

**Acceptance Criteria:**
- [ ] One-Sample: input kolom numerik + mu (nilai pembanding), output t, df, p, CI, mean diff, Cohen's d
- [ ] Independent: input kolom numerik + kolom grouping (2 grup), cek Levene homogeneity, output Group A/B mean±SD, t, df, p, CI diff, Cohen's d
- [ ] Paired: input 2 kolom berpasangan (pre/post), output mean diff, t, df, p, CI, Cohen's dz
- [ ] Semua menampilkan formula (LaTeX), parameters, calculation steps, decision Reject/Fail to reject H0
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-014: One-Way ANOVA
**Description:** As a peneliti, I want membandingkan mean ≥3 kelompok so that saya dapat menguji perbedaan antar kelompok.

**Acceptance Criteria:**
- [ ] Input: dependent numerik + grouping (≥3 grup), α=0.05
- [ ] Cek asumsi: normality per grup + Levene homogeneity, tampilkan PASS/FAIL per asumsi
- [ ] Output: tabel ANOVA (SSB, SSW, dfb, dfw, MSB, MSW, F, p), eta-squared, post-hoc Tukey HSD jika p < α, boxplot per grup
- [ ] Jika asumsi gagal, sarankan Kruskal-Wallis (link ke US-016)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-015: Chi-Square (Independence + Goodness of Fit)
**Description:** As a peneliti, I want menguji hubungan antar variabel kategorikal so that saya dapat analisis data nominal/ordinal.

**Acceptance Criteria:**
- [ ] Independence: input 2 kolom kategorikal, output contingency table, expected frequencies, χ², df, p, Cramer's V, stacked bar chart
- [ ] Goodness of Fit: input 1 kolom kategorikal + expected proportions, output χ², df, p
- [ ] Warning jika expected frequency < 5 ("asumsi tidak terpenuhi, pertimbangkan Fisher's Exact di luar MVP")
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-016: Non-parametrik (Mann-Whitney U, Wilcoxon, Kruskal-Wallis)
**Description:** As a peneliti, I want alternatif non-parametrik saat data tidak normal so that hipotesis tetap dapat diuji.

**Acceptance Criteria:**
- [ ] Mann-Whitney U: 1 numerik + grouping 2 grup (independen), output U, z, p, rank-biserial r
- [ ] Wilcoxon Signed-Rank: 2 kolom berpasangan, output W, z, p, matched-pairs rank-biserial
- [ ] Kruskal-Wallis: 1 numerik + grouping ≥3 grup, output H, df, p, epsilon-squared, Dunn post-hoc jika signifikan
- [ ] Setiap metode menampilkan kapan dipakai (mis. "gunakan saat normality FAIL")
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-017: Regresi (Simple + Multiple Linear)
**Description:** As a peneliti, I want memodelkan pengaruh X terhadap Y so that saya dapat prediksi dan uji pengaruh.

**Acceptance Criteria:**
- [ ] Simple: 1 X numerik + 1 Y numerik, output persamaan Y = a + bX, b, SE, t, p, R², adjusted R², F, residual plot, regression line plot
- [ ] Multiple: N X numerik + 1 Y, output tabel koefisien (b, SE, t, p, VIF per X), R², adjusted R², F-test, ANOVA table, multicollinearity warning jika VIF > 10
- [ ] Cek asumsi: linearity (scatter), normality residual (Shapiro), homoscedasticity info
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-018: Result & verification view (formula + kalkulasi + keputusan)
**Description:** As a peneliti, I want melihat BUKAN hanya p-value tetapi seluruh jejak perhitungan so that saya percaya dan bisa menulis ke skripsi.

**Acceptance Criteria:**
- [ ] Layout hasil selalu urutan: Method | Sample n | Group stats | Test statistic | df | p | CI | Effect size | Formula (LaTeX) | Parameters | Calculation steps | Decision (α, p vs α, Reject/Fail) | Interpretasi penelitian (terpisah, bahasa Indonesia)
- [ ] Contoh Independent t-Test menampilkan: n=100, Mean A/B, SD A/B, t=..., df=..., p=..., Cohen's d=...
- [ ] Tombol "Copy APA-style" (mis. t(98) = 2.85, p = .005, d = 0.57)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-019: Grafik akademik
**Description:** As a peneliti, I want grafik yang layak skripsi/paper so that saya tidak perlu membuat ulang di Excel.

**Acceptance Criteria:**
- [ ] Jenis: histogram, boxplot, scatter, bar, line, distribution (KDE), correlation heatmap, regression plot
- [ ] Style akademik: grayscale-friendly, label sumbu + n + p-value opsional, font serif option, DPI 300 untuk export PDF
- [ ] Bukan dashboard marketing (no gradient neon, no 3D)
- [ ] Setiap grafik memiliki tombol Download PNG/SVG + judul + caption otomatis
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-020: Export CSV/XLSX/PDF + appendix
**Description:** As a peneliti, I want mengunduh hasil so that saya dapat melampirkan ke skripsi.

**Acceptance Criteria:**
- [ ] Export CSV: raw result table; XLSX: multi-sheet (Summary, Data, Calculation); PDF: tabel + grafik + appendix
- [ ] Appendix PDF wajib berisi: Dataset info (name, version, rows/cols), Method, Variables, Parameters, Formula, Calculation, Result, Analysis ID, Timestamp, Software version
- [ ] File export tercatat di tabel `exports` (id, analysis_id, format, path, created_at)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-021: Reproducibility — Analysis ID + log + rerun
**Description:** As a peneliti, I want membuka ulang analisis lama dengan hasil identik so that penelitian saya auditable.

**Acceptance Criteria:**
- [ ] Setiap run menghasilkan Analysis ID format `ANL-YYYYMMDD-XXXXXX` (unik, tidak berurutan tebakan)
- [ ] `research_logs` append-only: analysis_id, dataset_version_id, method, variables JSON, params JSON, software_version, timestamp, result_hash
- [ ] Halaman detail Analysis ID menampilkan semua di atas + tombol "Rerun" → hasil baru harus sama (result_hash sama) atau tampilkan diff jika dataset_version berubah
- [ ] Tidak ada endpoint DELETE/UPDATE untuk logs (immutable)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-022: Scientific accuracy test suite (gate rilis)
**Description:** As a developer, I want test numerik otomatis vs referensi so that MVP tidak rilis jika hitungan salah.

**Acceptance Criteria:**
- [ ] Test dataset tetap (mis. `tests/fixtures/ttest_n100.csv` dengan expected t=2.847 dari R/SPSS)
- [ ] Setiap dari 15 metode memiliki minimal 2 test cases (normal + edge: missing, n kecil)
- [ ] Toleransi: 1e-6 untuk statistik deskriptif/korelasi/t/ANOVA/chi-square/regresi; 1e-4 untuk effect size
- [ ] CI pipeline gagal jika ada test FAIL; laporan PASS/FAIL per metode
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Sistem harus menyediakan registrasi (email, password hash, nama) dan validasi email duplikat.
- FR-2: Sistem harus menyediakan login/logout dengan session JWT HttpOnly, expiry 24 jam, dan proteksi route dashboard.
- FR-3: Sistem harus mengisolasi data per user (semua query project/dataset/analysis difilter by user_id).
- FR-4: Sistem harus menyediakan CRUD Project (title wajib, description opsional, research_type enum).
- FR-5: Sistem harus menerima upload CSV/XLSX/XLS/SAV/JSON ≤50MB ke S3-compatible storage dan menyimpan metadata (rows, cols, size, uploaded_at).
- FR-6: Sistem harus menampilkan preview 20 baris + profil dataset (rows, cols, missing %, per-kolom type/missing/unique/duplicate count) ≤10 detik untuk file ≤50MB.
- FR-7: Sistem harus mengimplementasikan dataset versioning immutable (v1 original tidak dapat diubah, transformasi selalu buat vN+1 dengan parent_version_id + transformation_log JSON).
- FR-8: Sistem harus menyediakan konfigurasi variabel per dataset_version: Type (Numerical/Ordinal/Nominal/Binary/Text/Datetime/ID) + Role (Independent/Dependent/Control/Grouping/ID/Ignore) dengan auto-suggest yang dapat di-override.
- FR-9: Sistem harus menyediakan preprocessing numerik: drop/fill missing (mean/median/mode/constant), outlier detection IQR, remove outlier, scaling (standard/minmax), transform (log/sqrt) dengan preview before/after.
- FR-10: Sistem harus menyediakan preprocessing kategorikal/teks/duplikat: category mapping, dummy/one-hot toggle, lowercase, punctuation removal, tokenization preview, stopword ID+EN, stemming/lemmatization toggle, remove duplicate rows dengan konfirmasi.
- FR-11: Preprocessing dengan rows > 10.000 harus berjalan sebagai background job (Redis+Celery) dengan status polling.
- FR-12: Sistem harus menjalankan Descriptive Statistics (n, mean, median, mode, min, max, range, variance, SD, Q1, Q3, IQR, skewness, kurtosis, frequency/percentage).
- FR-13: Sistem harus menjalankan Normality Test (Shapiro-Wilk + Kolmogorov-Smirnov) dengan auto-saran berdasarkan n dan QQ-plot + histogram.
- FR-14: Sistem harus menjalankan Pearson dan Spearman dengan cek asumsi normalitas otomatis + scatter + CI 95% + interpretasi kekuatan.
- FR-15: Sistem harus menjalankan One-Sample, Independent (dengan Levene), Paired t-Test dengan output t, df, p, CI, mean diff, Cohen's d/dz + formula + kalkulasi + decision.
- FR-16: Sistem harus menjalankan One-Way ANOVA dengan tabel SSB/SSW/MSB/MSW/F/p + eta-squared + Tukey HSD jika signifikan + boxplot + cek normality per grup + Levene.
- FR-17: Sistem harus menjalankan Chi-Square Independence (contingency + expected + χ²/df/p + Cramer's V) dan Goodness of Fit dengan warning expected < 5.
- FR-18: Sistem harus menjalankan Mann-Whitney U (U,z,p,r), Wilcoxon (W,z,p), Kruskal-Wallis (H,df,p,epsilon-squared + Dunn jika signifikan).
- FR-19: Sistem harus menjalankan Simple (Y=a+bX, b/SE/t/p, R²/adj-R²/F, residual plot) dan Multiple Linear Regression (tabel koefisien + VIF + warning VIF>10 + ANOVA table).
- FR-20: Semua metode WAJIB mengikuti template: Description, Purpose, Input, Data Requirement, Assumptions, Parameters, Formula (LaTeX), Calculation, Result, Validation, Interpretation, Reference.
- FR-21: Sistem harus menampilkan Result View berurutan: Method → Sample → Group stats → Statistic → df → p → CI → Effect size → Formula → Parameters → Calculation → Decision (α=0.05) → Interpretasi terpisah.
- FR-22: Sistem harus menyediakan grafik akademik (histogram, boxplot, scatter, bar, line, KDE, correlation heatmap, regression) dengan style grayscale-friendly + download PNG/SVG + caption otomatis.
- FR-23: Sistem harus menyediakan Export CSV (raw), XLSX (multi-sheet), PDF (tabel+grafik+appendix lengkap) dan mencatat ke tabel exports.
- FR-24: Sistem harus menghasilkan Analysis ID unik per run, menyimpan research_logs immutable (dataset_version, method, variables, params, software_version, timestamp, result_hash), dan menyediakan Rerun identik.
- FR-25: Sistem harus menjalankan validasi numerik otomatis vs R/SPSS/Python dengan toleransi 1e-6 (1e-4 untuk effect size) dan menggagalkan rilis jika FAIL.
- FR-26: Sistem harus memisahkan Frontend (Next.js) dan Scientific Engine (FastAPI/Python); DILARANG menghitung statistik di Node.js.
- FR-27: Sistem harus berjalan di Docker (frontend, backend, postgres, redis, worker, nginx) dan dapat di-deploy ke single VPS.

## Non-Goals (Out of Scope MVP)

- Tidak ada scraping media sosial dalam bentuk apapun.
- Tidak ada OAuth media sosial / account connection / penyimpanan access token.
- Tidak ada API connector resmi (Twitter/X, TikTok, dll).
- Tidak ada AI assistant (penjelasan hasil via LLM, narasi otomatis, rekomendasi metode via LLM). Rekomendasi metode hanya via rules engine deterministik (mis. jika normality FAIL → sarankan non-parametrik).
- Tidak ada Machine Learning classification (Naive Bayes, Logistic Regression, Decision Tree, Random Forest, SVM), clustering (K-Means, Hierarchical), NLP lanjutan (BoW/TF-IDF/N-Gram/LDA), Apriori.
- Tidak ada multi-user collaboration, project sharing, role dosen reviewer, komentar.
- Tidak ada multi-tenant kampus/organisasi, workspace lab.
- Tidak ada subscription/payment/billing/quota.
- Tidak ada mobile app native; hanya web responsive.
- Tidak ada export DOCX/LaTeX (fase berikutnya).
- Tidak ada Fisher's Exact, Repeated Measures ANOVA, ANCOVA, MANOVA, SEM, time-series (fase berikutnya).
- Tidak ada penghapusan/ubahan research_logs (immutable by design).

## Design Considerations

- Stack UI: Next.js 14+ App Router + TypeScript + Tailwind CSS + shadcn/ui. Dark/light mode, tetapi default light untuk keterbacaan akademik.
- Prinsip: information density untuk peneliti, bukan landing page. Tabel statistik monospace tabular-nums, p-value format `p < .001` jika sangat kecil.
- Layout Project Detail: sidebar kiri (Dataset, Variables, Preprocessing, Analysis, Results, Log, Export) + konten kanan. Breadcrumb Project Title > Dataset vX > Analysis ID.
- Reuse komponen: shadcn Table, Dialog, Select, Tabs, Toast, Form. Chart library: ECharts atau Plotly (pilih satu, konsisten). Formula render: KaTeX.
- Grafik akademik: hindari gradient/neon/3D. Wajib ada: judul, label sumbu dengan unit, n per grup, font minimal 11pt saat export PDF, opsi grayscale.
- Bahasa UI: Indonesia untuk label utama, Inggris untuk istilah statistik baku (mean, SD, p-value, confidence interval) agar sesuai skripsi.
- Aksesibilitas: keyboard navigable, focus ring, kontras AA untuk tabel.
- File desain: belum ada mockup; buat langsung di kode dengan verifikasi browser per US.

## Technical Considerations

- Arsitektur:
  ```
  Next.js (TS) → REST → FastAPI (/api/v1) → [DataMgmt (Pandas/NumPy) | MethodEngine (SciPy/Statsmodels/sklearn-minimal) | ProjectEngine (PostgreSQL)] → ResultEngine (tables/charts) → ExportEngine (reportlab/openpyxl)
  Heavy jobs → Redis + Celery worker. Storage → S3-compatible (MinIO untuk dev, S3/R2 untuk prod). Reverse proxy → Nginx. Semua via Docker Compose.
  ```
- Database awal (PostgreSQL 15+):
  ```
  users(id, email unique, password_hash, name, created_at)
  projects(id, user_id FK, title, description, research_type, created_at, updated_at)
  datasets(id, project_id FK, filename, storage_path, file_type, size_bytes, rows_count, cols_count, created_at)
  dataset_versions(id, dataset_id FK, version_number, parent_version_id nullable, transformation_log JSONB, active_columns JSONB, created_at)
  variables(id, dataset_version_id FK, name, var_type, var_role, created_at)
  analyses(id, project_id FK, dataset_version_id FK, method, variables JSONB, params JSONB, status, created_at)
  analysis_results(id, analysis_id FK unique, result JSONB, result_hash, software_version, created_at)
  exports(id, analysis_id FK, format, storage_path, created_at)
  research_logs(id, analysis_id FK, dataset_version_id, method, variables JSONB, params JSONB, software_version, timestamp) — append-only, no UPDATE/DELETE API
  ```
- Scientific Engine: Python 3.11+, Pandas 2.x, NumPy 1.26+, SciPy 1.12+, Statsmodels 0.14+, scikit-learn (hanya untuk preprocessing dasar MVP, bukan classification). DILARANG memakai LLM untuk angka. Semua fungsi murni deterministik dengan `random_state` tetap jika ada randomisasi.
- Method Template (wajib per metode, simpan sebagai `backend/methods/<method>.yaml` + `.py`):
  ```
  description, purpose, input_schema, data_requirement, assumptions[], parameters{}, formula_latex, calculation_steps, result_schema, validation_dataset, interpretation_template, reference[]
  ```
- Validasi numerik: folder `backend/tests/scientific/` dengan fixtures + expected dari R/SPSS. Contoh: `ttest_n100.csv → t=2.847`. CI harus hijau sebelum merge.
- Keamanan MVP baseline: HTTPS (Nginx TLS), password hashing argon2/bcrypt, JWT HttpOnly Secure SameSite, validasi upload (ekstensi+MIME+size+scan), project isolation (RLS atau app-level check), audit log login, backup harian Postgres + file storage, tombol Delete Dataset (soft-delete + hapus file S3).
- Performa: preview ≤10s (≤50MB), analisis ≤5s untuk n≤10.000 (di luar itu via Celery async), export PDF ≤15s.
- Versioning: Git + conventional commits; software_version (mis. `0.1.0+mvp`) disimpan di setiap research_log untuk reproducibility.
- Queue: Redis + Celery untuk preprocessing besar, analisis regresi besar, export PDF. Endpoint mengembalikan `job_id`, frontend polling `/jobs/{id}`.

## Success Metrics

- Fungsional: 100% workflow end-to-end (Register → Project → Upload → Preview → Variables → Preprocessing → 15 metode → Result+Formula → Grafik → Export → Rerun) berjalan tanpa error pada dataset uji 1.250 rows x 18 cols.
- Akurasi: 100% dari 15 metode PASS vs referensi (toleransi 1e-6, effect size 1e-4). Contoh: Independent t-Test `t=2.847` sama dengan R/SPSS.
- Transparansi: 100% hasil menampilkan formula + parameters + calculation + decision + Analysis ID. Audit acak 10 analisis menunjukkan appendix PDF lengkap.
- Reproducibility: Rerun 20 analisis lama menghasilkan result_hash identik 100%.
- Usability beta (20-50 peneliti): ≥80% dapat upload→export tanpa panduan, ≥70% menyatakan "hasil dapat dipahami untuk skripsi", 0 kebocoran data antar-user.
- Performa: p95 preview ≤10s, analisis ≤5s (n≤10k), PDF export ≤15s di VPS 4vCPU/8GB.
- Kualitas kode: typecheck + lint + scientific tests hijau di CI untuk setiap merge ke main.

## Open Questions

- Apakah perlu batasan n maksimum per analisis di MVP (mis. 100.000 rows) untuk menjaga performa VPS tunggal?
- Format SAV (SPSS): apakah memakai `pyreadstat` dan bagaimana menangani value labels + missing user-defined? Perlu spesifikasi konversi ke Pandas.
- Apakah interpretasi Bahasa Indonesia dibuat sebagai template deterministik (bukan LLM) dengan slot angka? Siapa yangmenyetujui wording akademiknya (dosen/metodolog)?
- Apakah α selalu 0.05 atau user dapat mengubah (0.01/0.10)? Jika dapat diubah, apakah decision + grafik ikut berubah otomatis?
- Apakah perlu mode offline / export full reproducibility bundle (.zip berisi dataset version + logs + PDF) di MVP atau fase berikutnya?
- Bagaimana kebijakan retensi dan hapus permanen dataset sensitif (GDPR-like) untuk penelitian manusia?
- Apakahdb schema di atas sudah cukup untuk evolusi ke multi-user tanpa migrasi breaking? Perlu review arsitek sebelum Fase 1 coding.

---

**Keputusan final terkunci:** Frontend Next.js+TS+Tailwind+shadcn/ui. Backend FastAPI. Komputasi NumPy+Pandas+SciPy+Statsmodels. DB PostgreSQL. Queue Redis+Celery. Storage S3-compatible. Deploy Docker+VPS+Nginx. Upload → API resmi → OAuth → scraping (hanya Upload di MVP). AI hanya asisten pasca-MVP, bukan engine hitung.
