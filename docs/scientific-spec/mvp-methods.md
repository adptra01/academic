# Scientific Method Specification — MVP (Fase 0 Gate)

> TIDAK MASUK development Fase 1+ sebelum dokumen ini disetujui. Semua engine WAJIB ikut template ini.
> Referensi umum: SciPy docs, Statsmodels docs, SPSS Algorithms. Validasi vs R/SPSS/Python, toleransi 1e-6 (effect size 1e-4).

## Template wajib per metode (YAML + .py)

```yaml
name: independent_ttest
description: ...
purpose: ...
input: {dependent_variable, grouping_variable}
data_requirement: ...
assumptions: [...]
parameters: {alpha: 0.05}
formula_latex: ...
calculation_steps: [...]
result_schema: {...}
validation: {dataset, expected}
interpretation_template: ...
reference: [...]
```

---

### M-01 Descriptive Statistics
- **Input:** 1..N kolom numerik (+ frekuensi untuk kategorikal).
- **Requirement:** n ≥ 1. Mode boleh multimodal.
- **Asumsi:** tidak ada (deskriptif).
- **Params:** `percentiles=[25,50,75]`.
- **Output:** n, mean, median, mode, min, max, range, variance (ddof=1), SD, Q1/Q3/IQR, skewness, kurtosis, + frequency/% untuk kategorikal.
- **Formula:** mean=Σx/n, var=Σ(x-mean)²/(n-1), dll. (lihat `methods/descriptive.yaml`).
- **Validasi:** vs `pandas.describe()` identik 1e-6.

### M-02 Normality (Shapiro-Wilk + Kolmogorov-Smirnov)
- **Input:** 1 kolom numerik.
- **Requirement:** Shapiro n 3..5000; KS n ≥ 20 (Lilliefors bila mean/SD diestimasi).
- **Asumsi:** observasi independen.
- **Params:** `alpha=0.05`, `method=auto|shapiro|ks`.
- **Output:** statistic (W/D), p, decision Normal/Tidak normal, QQ-plot + histogram.
- **Formula:** W=(Σaᵢx₍ᵢ₎)²/Σ(x-mean)²; D=sup|Fₙ-F₀|.
- **Validasi:** vs `scipy.stats.shapiro/kstest` 1e-6.

### M-03 Pearson Correlation
- **Input:** X numerik, Y numerik (pairwise, hapus pasangan missing).
- **Requirement:** kedua numerik, n ≥ 3.
- **Asumsi:** linearitas, normalitas bivariat (cek Shapiro X,Y + warning), tanpa outlier ekstrem.
- **Params:** `alpha=0.05`.
- **Output:** r, p (two-tailed), CI 95% (Fisher z), n, scatter + tren, kekuatan (0-0.2 sangat lemah … 0.8-1 sangat kuat).
- **Formula:** r=cov(X,Y)/(sX·sY); t=r√(n-2)/√(1-r²), df=n-2.
- **Validasi:** contoh `service_quality vs satisfaction r≈0.621`.

### M-04 Spearman Correlation
- **Input:** X, Y (numerik/ordinal, boleh tidak normal).
- **Asumsi:** hubungan monotonik.
- **Output:** rho, p, n. Sama seperti Pearson tanpa asumsi normal.
- **Formula:** Pearson pada rank; koreksi ties.
- **Validasi:** vs `scipy.stats.spearmanr`.

### M-05 One-Sample t-Test
- **Input:** kolom numerik + `mu` (nilai pembanding).
- **Asumsi:** independen, normalitas (Shapiro) — jika FAIL sarankan Wilcoxon (di luar one-sample? catat sebagai warning, tetap hitung).
- **Output:** mean, SD, n, t=(mean-mu)/(s/√n), df=n-1, p two-tailed, CI mean diff, Cohen's d=(mean-mu)/s.
- **Validasi:** fixture `ttest_n100.csv → t=2.847`.

### M-06 Independent Samples t-Test
- **Input:** dependent numerik + grouping (tepat 2 grup).
- **Requirement:** tiap grup n ≥ 2.
- **Asumsi:** independen antar grup, normalitas per grup, homogenitas (Levene). Tampilkan PASS/FAIL per asumsi. Jika Levene FAIL → Welch (df Satterthwaite) otomatis + catat.
- **Output:** mean±SD per grup, t, df, p, CI diff, Cohen's d (pooled SD; Welch pakai sqrt((s1²+s2²)/2)).
- **Formula Welch:** t=(m1-m2)/√(s1²/n1+s2²/n2).
- **Contoh hasil:** n=100, t(98)=2.85, p=.005, d=0.57.

### M-07 Paired Samples t-Test
- **Input:** 2 kolom berpasangan (pre/post, panjang sama, n ≥ 2).
- **Asumsi:** selisih d berdistribusi normal (Shapiro pada d).
- **Output:** mean diff, SD diff, t=d̄/(s_d/√n), df=n-1, p, CI, Cohen's dz=d̄/s_d.

### M-08 One-Way ANOVA
- **Input:** dependent numerik + grouping ≥3 grup.
- **Asumsi:** normalitas per grup + Levene. Jika FAIL → link ke Kruskal-Wallis, tetap tampilkan ANOVA + warning.
- **Output:** tabel SSB/SSW/dfb/dfw/MSB/MSW/F=MSB/MSW/p, eta²=SSB/SST, Tukey HSD jika p<α, boxplot.
- **Validasi:** vs `statsmodels` + SPSS.

### M-09 Chi-Square
> Definisi hitung (anti-ambiguitas reviewer):
>
> ```text
> 15 scientific methods
> 16 executable analysis endpoints
>
> M-09 Chi-Square:
> - Chi-Square Independence
> - Chi-Square Goodness-of-Fit
> ```
>
> "Metode" = unit metodologis (M-01..M-14); "endpoint" = runnable API
> (`GET /methods` me-list 15 entri karena M-09 dipecah dua).
- **Independence:** 2 kategorikal → contingency + expected, χ²=Σ(O-E)²/E, df=(r-1)(c-1), p, Cramer's V, stacked bar. Warning jika E<5.
- **Goodness of Fit:** 1 kategorikal + expected proportions → χ², df=k-1, p.

### M-10 Mann-Whitney U
- **Input:** numerik/ordinal + grouping 2 grup independen. Dipakai saat normalitas FAIL.
- **Output:** U, z (approx normal, koreksi ties), p two-tailed, rank-biserial r=1-2U/(n1·n2), boxplot rank.
- **Formula:** U=n1·n2+n1(n1+1)/2-R1.

### M-11 Wilcoxon Signed-Rank
- **Input:** 2 kolom berpasangan.
- **Output:** W (min rank sum), z, p, matched-pairs rank-biserial. Warning zero-differences dibuang.

### M-12 Kruskal-Wallis
- **Input:** numerik/ordinal + grouping ≥3 grup.
- **Output:** H=12/(N(N+1))·ΣRᵢ²/nᵢ-3(N+1), df=k-1, p, epsilon²=H/((N²-1)/(N+1)), Dunn post-hoc jika signifikan.

### M-13 Simple Linear Regression
- **Input:** 1 X numerik + 1 Y numerik.
- **Asumsi:** linearitas, normalitas residual, homoskedastisitas (info plot).
- **Output:** Y=a+bX, b/SE/t/p per koef, R², adj-R², F/p model, ANOVA table, residual plot + regression line.
- **Formula OLS:** b=cov(X,Y)/var(X).

### M-14 Multiple Linear Regression
- **Input:** N X numerik + 1 Y.
- **Output:** tabel (b, SE, t, p, VIF), R²/adj-R²/F, ANOVA, warning VIF>10 (multikolinearitas), residual plots.
- **Validasi:** vs `statsmodels OLS` 1e-6.

## Aturan interpretasi (deterministik, bukan LLM)

Template Bahasa Indonesia dengan slot: `"Rata-rata kelompok A (M={m1:.2f}, SD={s1:.2f}) ... berbeda signifikan dari B ... t({df})={t:.3f}, p={p:.3f}, d={d:.2f}."` + decision `p<α → Tolak H0`.
Wording final disetujui metodolog sebelum Beta.
