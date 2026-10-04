#!/usr/bin/env python3
"""Compare engine_outputs.json vs r_outputs.csv.
Tolerances (documented in docs/scientific-validation.md):
- statistics/coefs/CI/R2: rel 1e-6, abs floor 1e-12
- p-values umum: rel 1e-6, abs floor 1e-12
- p-values rank tests (MW/Wilcoxon/Kruskal): rel 1e-3 — R pakai continuity
  correction, SciPy tidak; perbedaan metodologis yang diketahui, bukan bug.
Exit: 0 = all PASS, 1 = ada FAIL, 2 = input hilang.
"""
import csv
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EV = os.path.normpath(os.path.join(HERE, "..", "..", "docs", "validation-evidence"))

REL = 1e-6
ABS_FLOOR = 1e-12
REL_RANK_P = 1e-3

# (file, method, engine_path, r_method, r_metric, kind)
COMPS = [
    ("bench_descriptive.csv", "descriptive", "statistics.v.mean", "descriptive", "mean", "stat"),
    ("bench_descriptive.csv", "descriptive", "statistics.v.variance", "descriptive", "var", "stat"),
    ("bench_descriptive.csv", "descriptive", "statistics.v.std", "descriptive", "sd", "stat"),
    ("bench_normality.csv", "normality", "statistics.statistic", "normality", "statistic", "stat"),
    ("bench_normality.csv", "normality", "statistics.p_value", "normality", "p", "p"),
    ("bench_corr.csv", "pearson", "statistics.r", "pearson", "r", "stat"),
    ("bench_corr.csv", "pearson", "statistics.p_value", "pearson", "p", "p"),
    ("bench_corr.csv", "pearson", "statistics.ci95.lower", "pearson", "ci_lo", "stat"),
    ("bench_corr.csv", "pearson", "statistics.ci95.upper", "pearson", "ci_hi", "stat"),
    ("bench_corr.csv", "spearman", "statistics.rho", "spearman", "rho", "stat"),
    ("bench_corr.csv", "spearman", "statistics.p_value", "spearman", "p", "p"),
    ("bench_ttest_onesamp.csv", "ttest_1samp", "statistics.t", "ttest_1samp", "t", "stat"),
    ("bench_ttest_onesamp.csv", "ttest_1samp", "statistics.p_value", "ttest_1samp", "p", "p"),
    ("bench_ttest_ind.csv", "ttest_ind", "statistics.t", "ttest_ind", "t", "stat"),
    ("bench_ttest_ind.csv", "ttest_ind", "statistics.p_value", "ttest_ind", "p", "p"),
    ("bench_ttest_welch.csv", "ttest_ind", "statistics.t", "ttest_welch", "t", "stat"),
    ("bench_ttest_welch.csv", "ttest_ind", "statistics.p_value", "ttest_welch", "p", "p"),
    ("bench_ttest_paired.csv", "ttest_paired", "statistics.t", "ttest_paired", "t", "stat"),
    ("bench_ttest_paired.csv", "ttest_paired", "statistics.p_value", "ttest_paired", "p", "p"),
    ("bench_anova.csv", "anova_oneway", "statistics.f", "anova_oneway", "f", "stat"),
    ("bench_anova.csv", "anova_oneway", "statistics.p_value", "anova_oneway", "p", "p"),
    ("bench_chi2.csv", "chi2_independence", "statistics.chi2", "chi2_independence", "chi2", "stat"),
    ("bench_chi2.csv", "chi2_independence", "statistics.p_value", "chi2_independence", "p", "p"),
    ("bench_gof.csv", "chi2_gof", "statistics.chi2", "chi2_gof", "chi2", "stat"),
    ("bench_gof.csv", "chi2_gof", "statistics.p_value", "chi2_gof", "p", "p"),
    ("bench_mannwhitney.csv", "mannwhitney", "statistics.p_value", "mannwhitney", "p", "rankp"),
    ("bench_wilcoxon.csv", "wilcoxon", "statistics.p_value", "wilcoxon", "p", "rankp"),
    ("bench_kruskal.csv", "kruskal", "statistics.h", "kruskal", "h", "stat"),
    ("bench_kruskal.csv", "kruskal", "statistics.p_value", "kruskal", "p", "rankp"),
    ("bench_regression.csv", "linreg_simple", "statistics.r_squared", "linreg_simple", "r2", "stat"),
    ("bench_regression.csv", "linreg_multiple", "statistics.r_squared", "linreg_multiple", "r2", "stat"),
    ("bench_regression.csv", "linreg_multiple", "statistics.vif.x1", "linreg_multiple", "vif_x1", "stat"),
]


def _get(d, path):
    for part in path.split("."):
        if not isinstance(d, dict) or part not in d:
            return None
        d = d[part]
    return d


def main():
    eng_path = os.path.join(EV, "engine_outputs.json")
    r_path = os.path.join(EV, "r_outputs.csv")
    if not os.path.exists(eng_path):
        print("MISSING engine_outputs.json — jalankan scripts/validation/run_engine.py dulu")
        return 2
    if not os.path.exists(r_path):
        print("MISSING r_outputs.csv — validator harus menjalankan scripts/validation/validate.R di R")
        return 2
    eng = {(r["file"], r["method"]): r["result"] for r in json.load(open(eng_path))}
    rmap = {}
    with open(r_path) as f:
        for row in csv.DictReader(f):
            if row["value"] not in ("", "NA"):
                rmap[(row["method"], row["metric"])] = float(row["value"])
    fails = 0
    print(f"{'check':50s} {'engine':>14s} {'R':>14s} {'|Δ|':>12s} status")
    for fname, method, epath, rm, rmet, kind in COMPS:
        ev = _get(eng.get((fname, method), {}), epath)
        rv = rmap.get((rm, rmet))
        if ev is None or rv is None:
            print(f"{fname}:{method}:{epath:30s} MISSING DATA  FAIL")
            fails += 1
            continue
        delta = abs(ev - rv)
        tol = (REL_RANK_P if kind == "rankp" else REL) * max(1.0, abs(rv))
        tol = max(tol, ABS_FLOOR)
        ok = delta <= tol
        if not ok:
            fails += 1
        print(f"{fname}:{method}:{epath:30s} {ev:14.6g} {rv:14.6g} {delta:12.2g} {'PASS' if ok else 'FAIL'}")
    print(f"\n{fails} FAIL dari {len(COMPS)} checks")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
