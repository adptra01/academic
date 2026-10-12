#!/usr/bin/env python3
"""
AR-01 Numerical Comparison — Bandingkan hasil engine dengan referensi independen (SciPy).

Usage:
    python scripts/ar01_compare_results.py
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import stats
import warnings
warnings.filterwarnings("ignore")

RESULTS_DIR = Path("docs/ar-01-audit/results")
COMPARE_DIR = Path("docs/ar-01-audit/reference_outputs")
COMPARE_DIR.mkdir(parents=True, exist_ok=True)

TOLERANCE = {
    "statistic": 1e-6,
    "p_value": 1e-6,
    "effect_size": 1e-6,
    "r_squared": 1e-6,
    "coefficient": 1e-6,
    "vif": 1e-4,
}

# --- Fungsi Referensi SciPy --------------------------------------------------

def ref_ttest_ind(df, col1, col2, alpha=0.05):
    """Independent t-test: Student's (equal_var=True) dan Welch (equal_var=False)."""
    groups = df[col1].unique()
    if len(groups) != 2:
        return None
    g1 = df[df[col1] == groups[0]][col2].dropna().values
    g2 = df[df[col1] == groups[1]][col2].dropna().values
    t_student, p_student = stats.ttest_ind(g1, g2, equal_var=True)
    t_welch, p_welch = stats.ttest_ind(g1, g2, equal_var=False)
    # Cohen's d
    n1, n2 = len(g1), len(g2)
    var1, var2 = np.var(g1, ddof=1), np.var(g2, ddof=1)
    pooled_sd = np.sqrt(((n1-1)*var1 + (n2-1)*var2) / (n1 + n2 - 2))
    d = (np.mean(g1) - np.mean(g2)) / pooled_sd if pooled_sd > 0 else 0
    return {
        "student": {"t": float(t_student), "p": float(p_student), "df": n1+n2-2, "cohens_d": float(d)},
        "welch": {"t": float(t_welch), "p": float(p_welch), "df": None, "cohens_d": float(d)},
    }

def ref_ttest_paired(df, col1, col2):
    """Paired t-test."""
    paired = df[[col1, col2]].dropna()
    t, p = stats.ttest_rel(paired[col1], paired[col2])
    # Cohen's dz
    diff = paired[col1] - paired[col2]
    dz = float(diff.mean() / diff.std(ddof=1)) if diff.std(ddof=1) > 0 else 0
    return {"t": float(t), "p": float(p), "df": len(paired)-1, "cohens_dz": dz}

def ref_ttest_1samp(df, column, mu):
    """One-sample t-test."""
    data = df[column].dropna().values
    t, p = stats.ttest_1samp(data, mu)
    d = float((np.mean(data) - mu) / np.std(data, ddof=1)) if np.std(data, ddof=1) > 0 else 0
    return {"t": float(t), "p": float(p), "df": len(data)-1, "cohens_d": d}

def ref_mannwhitney(df, col1, col2):
    """Mann-Whitney U test."""
    groups = df[col1].unique()
    g1 = df[df[col1] == groups[0]][col2].dropna().values
    g2 = df[df[col1] == groups[1]][col2].dropna().values
    u, p = stats.mannwhitneyu(g1, g2, alternative="two-sided")
    return {"u": float(u), "p": float(p)}

def ref_wilcoxon(df, col1, col2):
    """Wilcoxon signed-rank test."""
    paired = df[[col1, col2]].dropna()
    stat, p = stats.wilcoxon(paired[col1], paired[col2], alternative="two-sided", zero_method="wilcox")
    return {"statistic": float(stat), "p": float(p)}

def ref_chi2_independence(df, col1, col2):
    """Chi-square test of independence."""
    ct = pd.crosstab(df[col1], df[col2])
    chi2, p, dof, expected = stats.chi2_contingency(ct)
    # Cramér's V
    n = ct.values.sum()
    min_dim = min(ct.shape)
    v = float(np.sqrt(chi2 / (n * (min_dim - 1)))) if min_dim > 1 else 0.0
    return {"chi2": float(chi2), "p": float(p), "df": int(dof), "cramers_v": v, "expected_min": float(expected.min())}

def ref_chi2_gof(df, column):
    """Chi-square goodness of fit."""
    obs = df[column].value_counts().sort_index().values
    chi2, p = stats.chisquare(obs)
    return {"chi2": float(chi2), "p": float(p), "df": len(obs)-1}

def ref_linreg_simple(df, x, y):
    """Simple linear regression via OLS."""
    clean = df[[x, y]].dropna()
    X = clean[x].values
    Y = clean[y].values
    n = len(X)
    if n < 2:
        return None
    x_mean, y_mean = X.mean(), Y.mean()
    Sxx = np.sum((X - x_mean)**2)
    Sxy = np.sum((X - x_mean) * (Y - y_mean))
    if Sxx == 0:
        return None
    beta1 = Sxy / Sxx
    beta0 = y_mean - beta1 * x_mean
    Y_pred = beta0 + beta1 * X
    ss_res = np.sum((Y - Y_pred)**2)
    ss_tot = np.sum((Y - y_mean)**2)
    r2 = 1 - ss_res/ss_tot if ss_tot > 0 else 0
    mse = ss_res / (n - 2) if n > 2 else 0
    se_beta1 = np.sqrt(mse / Sxx) if Sxx > 0 and mse > 0 else 0
    t_beta1 = beta1 / se_beta1 if se_beta1 > 0 else 0
    p_beta1 = 2 * stats.t.sf(abs(t_beta1), n-2) if n > 2 else 1
    return {
        "intercept": float(beta0),
        "slope": float(beta1),
        "r_squared": float(r2),
        "p_value_slope": float(p_beta1),
        "t_statistic_slope": float(t_beta1),
    }

def ref_pearson(df, col1, col2):
    """Pearson correlation."""
    clean = df[[col1, col2]].dropna()
    r, p = stats.pearsonr(clean[col1], clean[col2])
    n = len(clean)
    # CI 95% via Fisher z-transform
    z = np.arctanh(r)
    se = 1/np.sqrt(n-3)
    z_low, z_high = z - 1.96*se, z + 1.96*se
    ci_low, ci_high = np.tanh(z_low), np.tanh(z_high)
    return {"r": float(r), "p": float(p), "ci95": [float(ci_low), float(ci_high)], "n": n}

def ref_spearman(df, col1, col2):
    """Spearman correlation."""
    clean = df[[col1, col2]].dropna()
    rho, p = stats.spearmanr(clean[col1], clean[col2])
    return {"rho": float(rho), "p": float(p), "n": len(clean)}

# --- Pembandingan ------------------------------------------------------------

def compare_values(ref: dict, eng: dict, path: str = "") -> list[dict]:
    """Bandingkan dua dict secara rekursif, return list perbedaan."""
    diffs = []
    all_keys = set(ref.keys()) | set(eng.keys())
    for k in all_keys:
        new_path = f"{path}.{k}" if path else k
        if k not in ref:
            diffs.append({"path": new_path, "status": "EXTRA_IN_ENGINE", "engine": eng[k]})
            continue
        if k not in eng:
            diffs.append({"path": new_path, "status": "MISSING_IN_ENGINE", "reference": ref[k]})
            continue
        rv, ev = ref[k], eng[k]
        if isinstance(rv, dict) and isinstance(ev, dict):
            diffs.extend(compare_values(rv, ev, new_path))
        elif isinstance(rv, (int, float)) and isinstance(ev, (int, float)):
            tol = TOLERANCE.get(k, 1e-6)
            if abs(rv - ev) > tol:
                diffs.append({
                    "path": new_path,
                    "status": "MISMATCH",
                    "reference": rv,
                    "engine": ev,
                    "abs_diff": abs(rv - ev),
                    "rel_diff": abs(rv - ev) / max(abs(rv), 1e-12),
                    "tolerance": tol,
                })
        elif rv != ev:
            diffs.append({"path": new_path, "status": "VALUE_DIFF", "reference": rv, "engine": ev})
    return diffs

def extract_engine_stats(result: dict) -> dict:
    """Ekstrak statistik yang relevan dari hasil engine untuk dibandingkan."""
    stats_out = result.get("statistics", {})
    out = {}
    # Flatten statistik utama
    for k in ["t", "t_statistic", "u", "chi2", "statistic", "r", "rho", "f",
              "p", "p_value", "p_value_slope", "df", "r_squared", "r2",
              "cohens_d", "cohens_dz", "cramers_v", "intercept", "slope",
              "cohens_d", "cramers_v", "effect_size"]:
        if k in stats_out:
            out[k] = stats_out[k]
    # Effect size nested
    es = result.get("effect_size", {})
    if isinstance(es, dict):
        for k, v in es.items():
            out[k] = v
    return out

def run_comparison():
    all_diffs = []

    for scenario_dir in sorted(RESULTS_DIR.iterdir()):
        if not scenario_dir.is_dir() or scenario_dir.name.startswith("_"):
            continue
        summary_path = scenario_dir / "00_summary.json"
        if not summary_path.exists():
            continue

        summary = json.loads(summary_path.read_text())
        print(f"\n📊 Membandingkan: {scenario_dir.name}")

        # Load CSV untuk referensi
        csv_name = summary.get("csv_file")
        csv_path = Path("docs/ar-01-audit/scenarios") / csv_name
        if not csv_path.exists():
            print(f"   ⚠️  CSV tidak ditemukan: {csv_path}")
            continue
        df = pd.read_csv(csv_path)

        # Bandingkan setiap analisis
        for analysis_key, result in summary.get("analyses", {}).items():
            # Cari file hasil detail
            result_files = list(scenario_dir.glob(f"04_result_{analysis_key}.json"))
            if not result_files:
                continue
            engine_result = json.loads(result_files[0].read_text())
            eng_stats = extract_engine_stats(engine_result)

            # Tentukan referensi berdasarkan metode
            method = engine_result.get("method", "")
            ref_stats = None
            try:
                if method == "ttest_ind":
                    # Cari kolom dari variables
                    vars_used = engine_result.get("variables", {})
                    # Coba cari col1, col2
                    col1 = vars_used.get("col1") or vars_used.get("group")
                    col2 = vars_used.get("col2") or vars_used.get("column") or vars_used.get("y")
                    if col1 and col2:
                        ref_stats = ref_ttest_ind(df, col1, col2)
                        # Pilih student atau welch berdasarkan apakah equal_var
                        # Engine default: Welch jika varians tidak sama
                        # Kita bandingkan keduanya
                elif method == "ttest_paired":
                    vars_used = engine_result.get("variables", {})
                    col1 = vars_used.get("col1")
                    col2 = vars_used.get("col2")
                    if col1 and col2:
                        ref_stats = ref_ttest_paired(df, col1, col2)
                elif method == "ttest_1samp":
                    col = engine_result.get("variables", {}).get("column")
                    params = engine_result.get("params", {})
                    mu = params.get("mu", 0)
                    if col:
                        ref_stats = ref_ttest_1samp(df, col, mu)
                elif method == "mannwhitney":
                    vars_used = engine_result.get("variables", {})
                    col1 = vars_used.get("col1") or vars_used.get("group")
                    col2 = vars_used.get("col2") or vars_used.get("column")
                    if col1 and col2:
                        ref_stats = ref_mannwhitney(df, col1, col2)
                elif method == "wilcoxon":
                    vars_used = engine_result.get("variables", {})
                    col1 = vars_used.get("col1")
                    col2 = vars_used.get("col2")
                    if col1 and col2:
                        ref_stats = ref_wilcoxon(df, col1, col2)
                elif method == "chi2_independence":
                    vars_used = engine_result.get("variables", {})
                    col1 = vars_used.get("col1") or vars_used.get("group")
                    col2 = vars_used.get("col2") or vars_used.get("column")
                    if col1 and col2:
                        ref_stats = ref_chi2_independence(df, col1, col2)
                elif method == "chi2_gof":
                    col = engine_result.get("variables", {}).get("column")
                    if col:
                        ref_stats = ref_chi2_gof(df, col)
                elif method == "linreg_simple":
                    vars_used = engine_result.get("variables", {})
                    x = vars_used.get("x")
                    y = vars_used.get("y")
                    if x and y:
                        ref_stats = ref_linreg_simple(df, x, y)
                elif method == "linreg_multiple":
                    # Multiple regression comparison is more complex, skip detailed coeff compare
                    ref_stats = {"skipped": "multiple regression coeff comparison not implemented"}
                elif method == "pearson":
                    vars_used = engine_result.get("variables", {})
                    col1 = vars_used.get("col1")
                    col2 = vars_used.get("col2")
                    if col1 and col2:
                        ref_stats = ref_pearson(df, col1, col2)
                elif method == "spearman":
                    vars_used = engine_result.get("variables", {})
                    col1 = vars_used.get("col1")
                    col2 = vars_used.get("col2")
                    if col1 and col2:
                        ref_stats = ref_spearman(df, col1, col2)
            except Exception as e:
                print(f"   ⚠️  Reference calc error for {method}: {e}")

            if ref_stats:
                diffs = compare_values(ref_stats, eng_stats, f"{scenario_dir.name}.{analysis_key}")
                if diffs:
                    print(f"   ❌ MISMATCH: {analysis_key}")
                    for d in diffs:
                        print(f"      {d['path']}: ref={d.get('reference')} eng={d.get('engine')} diff={d.get('abs_diff')}")
                else:
                    print(f"   ✅ MATCH: {analysis_key}")
                all_diffs.extend(diffs)

    # Simpan laporan perbandingan
    report_path = COMPARE_DIR / "numerical_comparison_report.json"
    report_path.write_text(json.dumps({
        "total_comparisons": len(all_diffs),
        "mismatches": len([d for d in all_diffs if d["status"] == "MISMATCH"]),
        "details": all_diffs,
    }, ensure_ascii=False, indent=2))

    # Summary markdown
    mismatches = [d for d in all_diffs if d["status"] == "MISMATCH"]
    md_path = COMPARE_DIR / "COMPARISON_SUMMARY.md"
    with open(md_path, "w") as f:
        f.write("# Numerical Comparison Summary\n\n")
        f.write(f"- Total comparisons: {len(all_diffs)}\n")
        f.write(f"- Mismatches: {len(mismatches)}\n\n")
        if mismatches:
            f.write("## Mismatches\n\n")
            for d in mismatches:
                f.write(f"- **{d['path']}**: ref={d.get('reference')}, eng={d.get('engine')}, |Δ|={d.get('abs_diff'):.2e}, tol={d.get('tolerance'):.2e}\n")
        else:
            f.write("✅ **Semua perbandingan numerik PASS dalam toleransi.**\n")

    print(f"\n📄 Laporan disimpan: {report_path}")
    print(f"📄 Ringkasan: {md_path}")

if __name__ == "__main__":
    run_comparison()