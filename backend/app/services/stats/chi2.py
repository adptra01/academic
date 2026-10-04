"""M-09 Chi-Square: independence (+Cramer's V) dan goodness-of-fit."""
from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats as ss
from app.services.stats import clean, decision, fmt_p, METHOD_NAMES


def run_independence(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    c1, c2 = variables.get("col1"), variables.get("col2")
    if not c1 or not c2:
        raise ValueError("chi2_independence butuh 'variables.col1' dan 'variables.col2' (kategorikal)")
    for c in (c1, c2):
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    sub = pd.DataFrame({"a": df[c1].astype(str), "b": df[c2].astype(str)}).dropna()
    if len(sub) == 0:
        raise ValueError("Tidak ada baris non-missing")
    ct = pd.crosstab(sub["a"], sub["b"])
    if ct.shape[0] < 2 or ct.shape[1] < 2:
        raise ValueError(f"Tabel kontingensi minimal 2x2 (dapat {ct.shape[0]}x{ct.shape[1]})")
    chi2, p, dof, expected = ss.chi2_contingency(ct)
    chi2, p = float(chi2), float(p)
    n = int(ct.to_numpy().sum())
    v = float(np.sqrt(chi2 / (n * (min(ct.shape) - 1)))) if min(ct.shape) > 1 else 0.0
    low_exp = int((expected < 5).sum())
    dec = decision(p, alpha)
    warnings = [f"{low_exp} sel expected < 5 — asumsi Chi-Square dilanggar, pertimbangkan Fisher's Exact (di luar MVP)"] if low_exp else []
    return {
        "method": "chi2_independence", "method_name": METHOD_NAMES["chi2_independence"], "alpha": alpha, "n": n,
        "statistics": {"chi2": chi2, "df": int(dof), "p_value": p, "contingency": {str(k): {str(k2): int(v2) for k2, v2 in row.items()} for k, row in ct.to_dict(orient="index").items()}, "expected_min": clean(float(expected.min()))},
        "assumptions": [{"name": "expected frequency ≥ 5", "passed": low_exp == 0, "note": f"min expected = {expected.min():.2f}"}],
        "formula_latex": r"\chi^2=\sum\frac{(O-E)^2}{E},\quad df=(r-1)(c-1),\quad V=\sqrt{\frac{\chi^2}{n(\min(r,c)-1)}}",
        "parameters": {"col1": c1, "col2": c2},
        "calculation": [f"Tabel {ct.shape[0]}x{ct.shape[1]}, n={n}", f"χ²({dof})={chi2:.4f}, {fmt_p(p)}, Cramer's V={v:.3f}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"cramers_v": clean(v)},
        "interpretation": f"Chi-Square {c1} × {c2} (n={n}): χ²({dof})={chi2:.3f}, {fmt_p(p)}, V={v:.2f}. " + ("Ada hubungan signifikan antar variabel." if dec["reject_h0"] else "Tidak ada bukti hubungan."),
        "warnings": warnings,
    }


def run_gof(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col = variables.get("column")
    if not col:
        raise ValueError("chi2_gof butuh 'variables.column' (kategorikal)")
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada")
    s = df[col].astype(str).dropna()
    if len(s) == 0:
        raise ValueError("Kolom kosong")
    obs_counts = s.value_counts().sort_index()
    cats = obs_counts.index.tolist()
    exp_prop = variables.get("expected", params.get("expected"))
    if exp_prop is None:
        exp_prop = [1 / len(cats)] * len(cats)
    if len(exp_prop) != len(cats):
        raise ValueError(f"'expected' harus sepanjang jumlah kategori ({len(cats)}: {cats})")
    if abs(sum(exp_prop) - 1) > 1e-6:
        raise ValueError("'expected' harus berjumlah 1 (proporsi)")
    f_exp = [len(s) * p for p in exp_prop]
    chi2, p = ss.chisquare(obs_counts.to_numpy(), f_exp)
    chi2, p = float(chi2), float(p)
    dof = len(cats) - 1
    dec = decision(p, alpha)
    low = sum(1 for e in f_exp if e < 5)
    return {
        "method": "chi2_gof", "method_name": METHOD_NAMES["chi2_gof"], "alpha": alpha, "n": int(len(s)),
        "statistics": {"chi2": chi2, "df": dof, "p_value": p, "observed": clean({str(k): int(v) for k, v in obs_counts.items()}), "expected": clean({str(k): float(e) for k, e in zip(cats, f_exp)})},
        "assumptions": [{"name": "expected ≥ 5", "passed": low == 0, "note": f"{low} kategori expected < 5"}],
        "formula_latex": r"\chi^2=\sum\frac{(O-E)^2}{E},\quad df=k-1",
        "parameters": {"column": col, "expected_proportions": exp_prop},
        "calculation": [f"k={len(cats)} kategori, n={len(s)}", f"χ²({dof})={chi2:.4f}, {fmt_p(p)}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": None,
        "interpretation": f"Goodness-of-fit '{col}' (n={len(s)}): χ²({dof})={chi2:.3f}, {fmt_p(p)}. " + ("Distribusi berbeda signifikan dari yang diharapkan." if dec["reject_h0"] else "Distribusi konsisten dengan proporsi yang diharapkan."),
        "warnings": [f"{low} kategori expected < 5"] if low else [],
    }
