# Scientific Validation — Evidence Record (Gate 1 RC1)

> Status: ⏳ MENUNGGU SIGN-OFF MANUSIA. Template per-metode di bawah WAJIB diisi
> validator berkompetensi statistik/metodologi. AI/developer hanya menyiapkan paket.

## Kunci yang dikunci

- **MVP = 15 scientific methods = 16 executable analysis endpoints**
  (M-09 Chi-Square = Independence + Goodness-of-Fit; paket validasi menjalankan
  16 runs: 15 metode + 1 run tambahan Welch pada dataset varians tak homogen).
  Jangan sampai reviewer membaca "15 metode" tetapi melihat "16 Analysis ID"
  tanpa penjelasan ini.
- Toleransi: statistik/koefisien/CI/R²/VIF rel **1e-6** (abs floor 1e-12);
  p-value umum rel 1e-6; **p-value rank tests (MW/Wilcoxon/Kruskal) rel 1e-3**
  (R memakai continuity correction, SciPy tidak — perbedaan metodologis yang diketahui).
- Levene (homogenitas): base R tidak menyediakannya — validasi via **SPSS saja**.

## Cara menjalankan (validator)

```bash
# 1. Dataset benchmark (deterministik, berversi di repo)
python3 scripts/validation/make_benchmarks.py   # → docs/validation-evidence/bench_*.csv

# 2. Sisi engine (butuh backend jalan)
python3 scripts/validation/run_engine.py http://localhost:8100 validator@kampus.ac.id Validasi123
# → docs/validation-evidence/engine_outputs.json (16 runs + Analysis ID)

# 3. Sisi R (BASE R saja, tanpa paket tambahan; di mesin validator yang ada R)
cd docs/validation-evidence && Rscript ../../scripts/validation/validate.R
# → r_outputs.csv

# 4. Bandingkan (exit 0 = semua PASS)
python3 scripts/validation/compare.py
```

SPSS: impor CSV yang sama, jalankan prosedur setara, catat di tabel manual di bawah.

## Hasil compare.py (ditempel validator)

```text
(paste output compare.py di sini)
```

## Tabel manual SPSS / catatan perbedaan definisi

| Metode | SPSS prosedur | Engine | SPSS | |Δ| | Status | Catatan definisi |
|---|---|---|---|---|---|
| ttest_ind (Student/Welch) | T-TEST / GLM | | | | ☐ | |
| anova_oneway (+Tukey) | ONEWAY | | | | ☐ | |
| Levene | (dari output SPSS di atas) | | | | ☐ | base R tak menyediakan — SPSS saja |
| ... | | | | | ☐ | |

> Jangan mengubah implementasi agar angka "terlihat sama". Jika beda, investigasi
> MENGAPA (definisi, koreksi, df, algoritme) dan catat di kolom Catatan definisi.

## Acceptance criterion Gate 1

```text
15/15 methods + tolerance documented + reference software documented
+ dataset preserved + evidence recorded = SCIENTIFIC VALIDATION PASS
```

## Sign-off (manusia, wajib)

- Validator (nama, afiliasi, kompetensi): _______________
- Tanggal: _______________
- Keputusan: ☐ PASS 15/15 → lanjut Gate 2 (Beta) · ☐ FAIL (daftar metode + temuan): _______________
- Tanda tangan: _______________
