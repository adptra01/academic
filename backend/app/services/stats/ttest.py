"""M-05/06/07 t-Tests: one-sample, independent (Student/Welch + Levene), paired. Effect: Cohen's d/dz."""
from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats as ss
from app.services.stats import clean, decision, fmt_p, METHOD_NAMES
from app.services.stats.normality import check as _norm_check


def _cohen_d(a: np.ndarray, b: np.ndarray | None, paired: bool, welch: bool = False) -> float:
    if paired and b is not None:
        d = a - b
        return float(d.mean() / d.std(ddof=1)) if d.std(ddof=1) != 0 else 0.0
    if b is None:
        return 0.0
    n1, n2 = len(a), len(b)
    if welch:
        pooled = float(np.sqrt((a.var(ddof=1) + b.var(ddof=1)) / 2))
    else:
        pooled = float(np.sqrt(((n1 - 1) * a.var(ddof=1) + (n2 - 1) * b.var(ddof=1)) / (n1 + n2 - 2)))
    return float((a.mean() - b.mean()) / pooled) if pooled != 0 else 0.0


def _ci_mean_diff_1samp(x: np.ndarray, alpha: float) -> tuple[float, float]:
    m, se = float(x.mean()), float(x.std(ddof=1) / np.sqrt(len(x)))
    h = float(ss.t.ppf(1 - alpha / 2, len(x) - 1)) * se
    return m - h, m + h


def run_1samp(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col = variables.get("column")
    mu = variables.get("mu", params.get("mu"))
    if not col or mu is None:
        raise ValueError("ttest_1samp butuh 'variables.column' dan 'mu' (nilai pembanding)")
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada")
    try:
        mu = float(mu)
    except (TypeError, ValueError):
        raise ValueError("'mu' harus angka")
    x = pd.to_numeric(df[col], errors="coerce").dropna().to_numpy()
    if len(x) < 2:
        raise ValueError("Butuh minimal 2 nilai non-missing")
    t, p = ss.ttest_1samp(x, mu)
    t, p = float(t), float(p)
    dfree = len(x) - 1
    lo, hi = _ci_mean_diff_1samp(x - mu, alpha)
    d = float((x.mean() - mu) / x.std(ddof=1)) if x.std(ddof=1) != 0 else 0.0
    dec = decision(p, alpha)
    norm = _norm_check(x, alpha, f"'{col}'")
    warnings = [] if norm.get("passed") is not False else ["Data tidak normal — hasil t-test meragukan, pertimbangkan Wilcoxon (menu non-parametrik)"]
    return {
        "method": "ttest_1samp", "method_name": METHOD_NAMES["ttest_1samp"], "alpha": alpha, "n": int(len(x)),
        "statistics": {"mean": clean(float(x.mean())), "std": clean(float(x.std(ddof=1))), "mu": mu, "t": t, "df": dfree, "p_value": p, "ci_mean_diff": {"lower": clean(lo), "upper": clean(hi)}},
        "assumptions": [norm],
        "formula_latex": r"t=\frac{\bar{x}-\mu_0}{s/\sqrt{n}},\quad df=n-1,\quad d=\frac{\bar{x}-\mu_0}{s}",
        "parameters": {"column": col, "mu": mu},
        "calculation": [f"mean={x.mean():.4f}, SD={x.std(ddof=1):.4f}, n={len(x)}, μ₀={mu}", f"t({dfree})={t:.4f}, {fmt_p(p)}, CI 95% selisih [{lo:.4f}, {hi:.4f}], d={d:.3f}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"cohens_d": clean(d)},
        "interpretation": f"One-sample t-test '{col}' vs μ₀={mu} (n={len(x)}): t({dfree})={t:.3f}, {fmt_p(p)}, d={d:.2f}. " + ("Rata-rata berbeda signifikan dari μ₀." if dec["reject_h0"] else "Tidak ada bukti rata-rata berbeda dari μ₀."),
        "warnings": warnings,
    }


def run_ind(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col, grp = variables.get("column"), variables.get("group")
    if not col or not grp:
        raise ValueError("ttest_ind butuh 'variables.column' (numerik) dan 'variables.group' (tepat 2 grup)")
    if col not in df.columns or grp not in df.columns:
        raise ValueError(f"Kolom tidak ada. Tersedia: {list(df.columns)}")
    sub = pd.DataFrame({"v": pd.to_numeric(df[col], errors="coerce"), "g": df[grp].astype(str)}).dropna()
    levels = sorted(sub["g"].unique().tolist())
    if len(levels) != 2:
        raise ValueError(f"Grouping harus tepat 2 grup (dapat {len(levels)}: {levels}) — untuk ≥3 grup gunakan One-Way ANOVA")
    a = sub.loc[sub["g"] == levels[0], "v"].to_numpy()
    b = sub.loc[sub["g"] == levels[1], "v"].to_numpy()
    if len(a) < 2 or len(b) < 2:
        raise ValueError("Tiap grup butuh minimal 2 nilai")
    _, p_levene = ss.levene(a, b)
    welch = bool(p_levene < alpha)
    t, p = ss.ttest_ind(a, b, equal_var=not welch)
    t, p = float(t), float(p)
    dfree = float((a.var(ddof=1) / len(a) + b.var(ddof=1) / len(b)) ** 2 / ((a.var(ddof=1) / len(a)) ** 2 / (len(a) - 1) + (b.var(ddof=1) / len(b)) ** 2 / (len(b) - 1))) if welch else len(a) + len(b) - 2
    se = float(np.sqrt(a.var(ddof=1) / len(a) + b.var(ddof=1) / len(b)))
    h = float(ss.t.ppf(1 - alpha / 2, dfree)) * se
    mdiff = float(a.mean() - b.mean())
    d = _cohen_d(a, b, paired=False, welch=welch)
    dec = decision(p, alpha)
    variant = "Welch" if welch else "Student"
    na = _norm_check(a, alpha, f"grup '{levels[0]}'")
    nb = _norm_check(b, alpha, f"grup '{levels[1]}'")
    warnings = [f"Varians tidak homogen (Levene p={p_levene:.3f}) — otomatis memakai koreksi Welch"] if welch else []
    if na.get("passed") is False or nb.get("passed") is False:
        warnings.append("Salah satu grup tidak normal — pertimbangkan Mann-Whitney")
    return {
        "method": "ttest_ind", "method_name": METHOD_NAMES["ttest_ind"], "alpha": alpha, "n": int(len(sub)),
        "statistics": {"variant": variant, "group_a": levels[0], "n_a": int(len(a)), "mean_a": clean(float(a.mean())), "sd_a": clean(float(a.std(ddof=1))), "group_b": levels[1], "n_b": int(len(b)), "mean_b": clean(float(b.mean())), "sd_b": clean(float(b.std(ddof=1))), "levene_p": clean(float(p_levene)), "t": t, "df": clean(dfree), "p_value": p, "mean_diff": clean(mdiff), "ci_diff": {"lower": clean(mdiff - h), "upper": clean(mdiff + h)}},
        "assumptions": [
            na, nb,
            {"name": f"homogenitas (Levene) p={p_levene:.4f}", "p_value": clean(float(p_levene)), "passed": not welch, "note": "dipakai Welch" if welch else "dipakai Student"},
        ],
        "formula_latex": r"t=\frac{\bar{x}_1-\bar{x}_2}{\sqrt{s_1^2/n_1+s_2^2/n_2}}\ (\mathrm{Welch}),\quad d=\frac{\bar{x}_1-\bar{x}_2}{s_{pooled}}",
        "parameters": {"column": col, "group": grp, "groups": levels},
        "calculation": [f"{levels[0]}: M={a.mean():.4f}, SD={a.std(ddof=1):.4f}, n={len(a)}; {levels[1]}: M={b.mean():.4f}, SD={b.std(ddof=1):.4f}, n={len(b)}", f"Levene p={p_levene:.4f} → {variant}; t({dfree:.1f})={t:.4f}, {fmt_p(p)}, selisih={mdiff:.4f} CI 95% [{mdiff - h:.4f}, {mdiff + h:.4f}], d={d:.3f}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"cohens_d": clean(d)},
        "interpretation": f"Independent t-test ({variant}) '{col}' {levels[0]} vs {levels[1]}: t({dfree:.1f})={t:.3f}, {fmt_p(p)}, d={d:.2f}. " + ("Rata-rata kedua grup berbeda signifikan." if dec["reject_h0"] else "Tidak ada bukti perbedaan rata-rata."),
        "warnings": warnings,
    }


def run_paired(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    c1, c2 = variables.get("col1"), variables.get("col2")
    if not c1 or not c2:
        raise ValueError("ttest_paired butuh 'variables.col1' dan 'variables.col2' (berpasangan, mis. pre/post)")
    for c in (c1, c2):
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    pair = pd.DataFrame({"a": pd.to_numeric(df[c1], errors="coerce"), "b": pd.to_numeric(df[c2], errors="coerce")}).dropna()
    if len(pair) < 2:
        raise ValueError("Butuh minimal 2 pasangan non-missing")
    a, b = pair["a"].to_numpy(), pair["b"].to_numpy()
    t, p = ss.ttest_rel(a, b)
    t, p = float(t), float(p)
    dfree = len(a) - 1
    dd = a - b
    h = float(ss.t.ppf(1 - alpha / 2, dfree)) * float(dd.std(ddof=1) / np.sqrt(len(dd)))
    mdiff = float(dd.mean())
    dz = float(dd.mean() / dd.std(ddof=1)) if dd.std(ddof=1) != 0 else 0.0
    dec = decision(p, alpha)
    nd = _norm_check(dd, alpha, "selisih (d)")
    warnings = [] if nd.get("passed") is not False else ["Selisih tidak normal — pertimbangkan Wilcoxon"]
    return {
        "method": "ttest_paired", "method_name": METHOD_NAMES["ttest_paired"], "alpha": alpha, "n": int(len(a)),
        "statistics": {"mean_diff": clean(mdiff), "sd_diff": clean(float(dd.std(ddof=1))), "t": t, "df": dfree, "p_value": p, "ci_diff": {"lower": clean(mdiff - h), "upper": clean(mdiff + h)}},
        "assumptions": [nd],
        "formula_latex": r"t=\frac{\bar{d}}{s_d/\sqrt{n}},\quad df=n-1,\quad d_z=\frac{\bar{d}}{s_d}",
        "parameters": {"col1": c1, "col2": c2},
        "calculation": [f"selisih mean={mdiff:.4f}, SD={dd.std(ddof=1):.4f}, n={len(a)}", f"t({dfree})={t:.4f}, {fmt_p(p)}, CI 95% [{mdiff - h:.4f}, {mdiff + h:.4f}], dz={dz:.3f}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"cohens_dz": clean(dz)},
        "interpretation": f"Paired t-test {c1} vs {c2} (n={len(a)}): t({dfree})={t:.3f}, {fmt_p(p)}, dz={dz:.2f}. " + ("Ada perbedaan signifikan antar pengukuran berpasangan." if dec["reject_h0"] else "Tidak ada bukti perbedaan."),
        "warnings": warnings,
    }
