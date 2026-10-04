"""M-10/11/12 Non-parametrik: Mann-Whitney U, Wilcoxon, Kruskal-Wallis (+post-hoc pairwise Bonferroni)."""
from __future__ import annotations
import itertools
import numpy as np
import pandas as pd
from scipy import stats as ss
from app.services.stats import clean, decision, fmt_p, METHOD_NAMES


def run_mannwhitney(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col, grp = variables.get("column"), variables.get("group")
    if not col or not grp:
        raise ValueError("mannwhitney butuh 'variables.column' + 'variables.group' (tepat 2 grup independen)")
    if col not in df.columns or grp not in df.columns:
        raise ValueError("Kolom tidak ada")
    sub = pd.DataFrame({"v": pd.to_numeric(df[col], errors="coerce"), "g": df[grp].astype(str)}).dropna()
    levels = sorted(sub["g"].unique().tolist())
    if len(levels) != 2:
        raise ValueError(f"Butuh tepat 2 grup (dapat {levels}) — untuk ≥3 gunakan Kruskal-Wallis")
    a = sub.loc[sub["g"] == levels[0], "v"].to_numpy()
    b = sub.loc[sub["g"] == levels[1], "v"].to_numpy()
    if len(a) == 0 or len(b) == 0:
        raise ValueError("Tiap grup butuh ≥1 nilai")
    u, p = ss.mannwhitneyu(a, b, alternative="two-sided")
    u, p = float(u), float(p)
    n1, n2 = len(a), len(b)
    r_rb = clean(1 - 2 * u / (n1 * n2))
    # aproksimasi z untuk pelaporan
    mu_u = n1 * n2 / 2
    sd_u = float(np.sqrt(n1 * n2 * (n1 + n2 + 1) / 12))
    z = float((u - mu_u) / sd_u) if sd_u else 0.0
    dec = decision(p, alpha)
    return {
        "method": "mannwhitney", "method_name": METHOD_NAMES["mannwhitney"], "alpha": alpha, "n": int(n1 + n2),
        "statistics": {"u": u, "z_approx": clean(z), "p_value": p, "n_a": n1, "n_b": n2, "groups": levels, "median_a": clean(float(np.median(a))), "median_b": clean(float(np.median(b)))},
        "assumptions": [{"name": "independensi + skala ordinal+", "passed": None, "note": "dipakai saat normalitas gagal untuk 2 grup independen"}],
        "formula_latex": r"U=n_1n_2+\frac{n_1(n_1+1)}{2}-R_1,\quad r_{rb}=1-\frac{2U}{n_1n_2}",
        "parameters": {"column": col, "group": grp, "groups": levels},
        "calculation": [f"{levels[0]}: median={np.median(a):.4f}, n={n1}; {levels[1]}: median={np.median(b):.4f}, n={n2}", f"U={u:.1f}, z≈{z:.3f}, {fmt_p(p)}, r_rb={r_rb}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"rank_biserial_r": r_rb},
        "interpretation": f"Mann-Whitney '{col}' {levels[0]} vs {levels[1]}: U={u:.1f}, {fmt_p(p)}. " + ("Distribusi kedua grup berbeda signifikan." if dec["reject_h0"] else "Tidak ada bukti perbedaan."),
        "warnings": [],
    }


def run_wilcoxon(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    c1, c2 = variables.get("col1"), variables.get("col2")
    if not c1 or not c2:
        raise ValueError("wilcoxon butuh 'variables.col1' dan 'variables.col2' (berpasangan)")
    for c in (c1, c2):
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    pair = pd.DataFrame({"a": pd.to_numeric(df[c1], errors="coerce"), "b": pd.to_numeric(df[c2], errors="coerce")}).dropna()
    if len(pair) == 0:
        raise ValueError("Tidak ada pasangan non-missing")
    w, p = ss.wilcoxon(pair["a"], pair["b"])
    w, p = float(w), float(p)
    n = len(pair)
    z = float(ss.norm.ppf(1 - p / 2)) if 0 < p < 1 else 0.0
    r_rb = clean(z / np.sqrt(n)) if n else None
    dec = decision(p, alpha)
    return {
        "method": "wilcoxon", "method_name": METHOD_NAMES["wilcoxon"], "alpha": alpha, "n": int(n),
        "statistics": {"w": w, "z_approx": clean(z), "p_value": p},
        "assumptions": [{"name": "selisih simetris", "passed": None, "note": "dipakai saat selisih tidak normal; nol-selisi dibuang otomatis"}],
        "formula_latex": r"W=\min(R_+,R_-)",
        "parameters": {"col1": c1, "col2": c2},
        "calculation": [f"n={n} pasangan", f"W={w:.1f}, {fmt_p(p)}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"matched_rank_biserial": r_rb},
        "interpretation": f"Wilcoxon {c1} vs {c2} (n={n}): W={w:.1f}, {fmt_p(p)}. " + ("Ada perbedaan signifikan." if dec["reject_h0"] else "Tidak ada bukti perbedaan."),
        "warnings": [],
    }


def run_kruskal(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col, grp = variables.get("column"), variables.get("group")
    if not col or not grp:
        raise ValueError("kruskal butuh 'variables.column' + 'variables.group' (≥3 grup)")
    if col not in df.columns or grp not in df.columns:
        raise ValueError("Kolom tidak ada")
    sub = pd.DataFrame({"v": pd.to_numeric(df[col], errors="coerce"), "g": df[grp].astype(str)}).dropna()
    levels = sorted(sub["g"].unique().tolist())
    if len(levels) < 3:
        raise ValueError(f"Kruskal-Wallis butuh ≥3 grup (dapat {levels}) — untuk 2 grup gunakan Mann-Whitney")
    groups = [sub.loc[sub["g"] == lv, "v"].to_numpy() for lv in levels]
    h, p = ss.kruskal(*groups)
    h, p = float(h), float(p)
    n_total = int(sum(len(g) for g in groups))
    eps2 = float(h / ((n_total**2 - 1) / (n_total + 1))) if n_total > 1 else 0.0
    dec = decision(p, alpha)
    posthoc = None
    warnings: list[str] = []
    if dec["reject_h0"]:
        m = len(list(itertools.combinations(levels, 2)))
        rows = []
        for g1, g2 in itertools.combinations(levels, 2):
            a = sub.loc[sub["g"] == g1, "v"].to_numpy()
            b = sub.loc[sub["g"] == g2, "v"].to_numpy()
            u, praw = ss.mannwhitneyu(a, b, alternative="two-sided")
            padj = min(float(praw) * m, 1.0)
            rows.append({"pair": f"{g1} vs {g2}", "p_raw": clean(float(praw)), "p_bonferroni": clean(padj), "significant": bool(padj < alpha)})
        posthoc = {"method": "Pairwise Mann-Whitney + Bonferroni", "comparisons": rows}
    return {
        "method": "kruskal", "method_name": METHOD_NAMES["kruskal"], "alpha": alpha, "n": n_total,
        "statistics": {"h": h, "df": len(levels) - 1, "p_value": p, "groups": levels, "posthoc": posthoc},
        "assumptions": [{"name": "independensi + skala ordinal+", "passed": None, "note": "alternatif non-parametrik ANOVA"}],
        "formula_latex": r"H=\frac{12}{N(N+1)}\sum\frac{R_i^2}{n_i}-3(N+1),\quad \epsilon^2=\frac{H}{(N^2-1)/(N+1)}",
        "parameters": {"column": col, "group": grp, "groups": levels},
        "calculation": [f"k={len(levels)} grup, N={n_total}", f"H({len(levels) - 1})={h:.4f}, {fmt_p(p)}, ε²={eps2:.3f}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"epsilon_squared": clean(eps2)},
        "interpretation": f"Kruskal-Wallis '{col}' antar {len(levels)} grup: H={h:.3f}, {fmt_p(p)}. " + ("Minimal satu grup berbeda — lihat post-hoc." if dec["reject_h0"] else "Tidak ada bukti perbedaan."),
        "warnings": warnings,
    }
