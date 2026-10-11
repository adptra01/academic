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

## Hasil compare.py — engine vs R base (dijalankan 2026-10-11)

Runner: base R di container `rocker/r-base` (`Rscript scripts/validation/validate.R`
→ `r_outputs.csv`, 54 baris), lalu `scripts/validation/compare.py`.
Status: **0 FAIL dari 32 checks** (exit 0). Cakupan: 15 metode MVP.

```text
check                                                      engine              R          |Δ| status
bench_descriptive.csv:descriptive:statistics.v.mean                     101.397        101.397      3.3e-13 PASS
bench_descriptive.csv:descriptive:statistics.v.variance                 256.756        256.756            0 PASS
bench_descriptive.csv:descriptive:statistics.v.std                      16.0236        16.0236      4.3e-14 PASS
bench_normality.csv:normality:statistics.statistic                 0.980331       0.980331      2.6e-11 PASS
bench_normality.csv:normality:statistics.p_value                   0.565986       0.565986      1.1e-09 PASS
bench_corr.csv:pearson:statistics.r                         0.789672       0.789672      4.4e-16 PASS
bench_corr.csv:pearson:statistics.p_value                1.39041e-09    1.39041e-09      1.1e-23 PASS
bench_corr.csv:pearson:statistics.ci95.lower                 0.63416        0.63416      8.9e-16 PASS
bench_corr.csv:pearson:statistics.ci95.upper                 0.88378        0.88378      2.2e-16 PASS
bench_corr.csv:spearman:statistics.rho                       0.833247       0.833247            0 PASS
bench_corr.csv:spearman:statistics.p_value                 2.5371e-11     2.5371e-11      1.3e-26 PASS
bench_ttest_onesamp.csv:ttest_1samp:statistics.t                          1.33324        1.33324      4.4e-15 PASS
bench_ttest_onesamp.csv:ttest_1samp:statistics.p_value                   0.190188       0.190188      2.2e-16 PASS
bench_ttest_ind.csv:ttest_ind:statistics.t                         -2.15806       -2.15806        8e-15 PASS
bench_ttest_ind.csv:ttest_ind:statistics.p_value                  0.0350754      0.0350754      2.8e-16 PASS
bench_ttest_welch.csv:ttest_ind:statistics.t                         -2.89468       -2.89468      2.2e-15 PASS
bench_ttest_welch.csv:ttest_ind:statistics.p_value                 0.00626071     0.00626071      4.3e-17 PASS
bench_ttest_paired.csv:ttest_paired:statistics.t                         -10.3089       -10.3089        2e-14 PASS
bench_ttest_paired.csv:ttest_paired:statistics.p_value                2.70432e-10    2.70432e-10      1.6e-24 PASS
bench_anova.csv:anova_oneway:statistics.f                          44.1244        44.1244      2.1e-14 PASS
bench_anova.csv:anova_oneway:statistics.p_value                2.64382e-12    2.64382e-12      2.3e-26 PASS
bench_chi2.csv:chi2_independence:statistics.chi2                       15.0417        15.0417      3.2e-14 PASS
bench_chi2.csv:chi2_independence:statistics.p_value                0.000105164    0.000105164      1.5e-19 PASS
bench_gof.csv:chi2_gof:statistics.chi2                            14             14      1.8e-15 PASS
bench_gof.csv:chi2_gof:statistics.p_value                0.000911882    0.000911882      1.7e-18 PASS
bench_mannwhitney.csv:mannwhitney:statistics.p_value                    0.35161        0.35225      0.00064 PASS
bench_wilcoxon.csv:wilcoxon:statistics.p_value                1.90735e-06    1.90735e-06            0 PASS
bench_kruskal.csv:kruskal:statistics.h                          8.78466        8.78466      1.8e-15 PASS
bench_kruskal.csv:kruskal:statistics.p_value                  0.0123719      0.0123719      2.8e-17 PASS
bench_regression.csv:linreg_simple:statistics.r_squared                 0.909925       0.909925      2.2e-16 PASS
bench_regression.csv:linreg_multiple:statistics.r_squared                 0.926408       0.926408      4.4e-16 PASS
bench_regression.csv:linreg_multiple:statistics.vif.x1                     1.00037        1.00037      1.3e-15 PASS

0 FAIL dari 32 checks
```

Catatan: selisih Mann-Whitney p-value (0.35161 vs 0.35225, Δ=0.00064) adalah
perbedaan *continuity correction* — R mengaplikasinya, SciPy tidak. Toleransi
rank-test 1e-3 memang disetel untuk ini (lihat header `compare.py`).

**Yang BELUM ada buktinya:** (1) validasi silang SPSS — tabel manual di bawah
masih kosong; (2) tanda tangan metodolog — status di header dokumen ini masih
menunggu. Keduanya belum boleh diklaim.


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
