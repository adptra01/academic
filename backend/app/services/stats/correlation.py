"""M-03 Pearson + M-04 Spearman. Pearson cek normalitas otomatis; CI via Fisher z."""
from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats as ss
from app.services.stats import clean, decision, fmt_p, METHOD_NAMES

_STRENGTH = [(0.2, "sangat lemah"), (0.4, "lemah"), (0.6, "sedang"), (0.8, "kuat"), (1.01, "sangat kuat")]


def _strength(r: float) -> str:
    for bound, label in _STRENGTH:
        if abs(r) < bound:
            return label
    return "sangat kuat"


def _ci_fisher(r: float, n: int, alpha: float) -> tuple[float | None, float | None]:
    if n < 4 or abs(r) >= 1:
        return None, None
    z = float(np.arctanh(r))
    se = 1 / np.sqrt(n - 3)
    zc = float(ss.norm.ppf(1 - alpha / 2))
    return float(np.tanh(z - zc * se)), float(np.tanh(z + zc * se))


def _prep(df, variables):
    xname, yname = variables.get("x"), variables.get("y")
    if not xname or not yname:
        raise ValueError("korelasi butuh 'variables.x' dan 'variables.y'")
    for c in (xname, yname):
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    pair = pd.DataFrame({"x": pd.to_numeric(df[xname], errors="coerce"), "y": pd.to_numeric(df[yname], errors="coerce")}).dropna()
    if len(pair) < 3:
        raise ValueError(f"Butuh minimal 3 pasangan non-missing (dapat {len(pair)})")
    return xname, yname, pair


def run_pearson(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    from app.services.stats.normality import _test as _norm

    xname, yname, pair = _prep(df, variables)
    r, p = ss.pearsonr(pair["x"], pair["y"])
    r, p = float(r), float(p)
    lo, hi = _ci_fisher(r, len(pair), alpha)
    assumptions, warnings = [], []
    for label, col in (("X", pair["x"]), ("Y", pair["y"])):
        try:
            tname, _, tp = _norm(col, "auto")
            ok = bool(tp >= alpha)
            assumptions.append({"name": f"normalitas {label} ({tname})", "p_value": clean(tp), "passed": ok, "note": "Pearson sensitif terhadap non-normalitas/outlier"})
            if not ok:
                warnings.append(f"{label} tidak normal ({tname} p={tp:.3f}) — pertimbangkan Spearman")
        except ValueError as e:
            assumptions.append({"name": f"normalitas {label}", "passed": None, "note": str(e)})
    dec = decision(p, alpha)
    return {
        "method": "pearson", "method_name": METHOD_NAMES["pearson"], "alpha": alpha, "n": int(len(pair)),
        "statistics": {"r": r, "p_value": p, "ci95": {"lower": lo, "upper": hi}, "strength": _strength(r)},
        "assumptions": assumptions,
        "formula_latex": r"r=\frac{\mathrm{cov}(X,Y)}{s_X s_Y},\quad t=\frac{r\sqrt{n-2}}{\sqrt{1-r^2}},\ df=n-2",
        "parameters": {"x": xname, "y": yname},
        "calculation": [f"n={len(pair)}, r={r:.4f}, {fmt_p(p)}, CI 95% [{lo:.3f}, {hi:.3f}]" if lo is not None else f"n={len(pair)}, r={r:.4f}, {fmt_p(p)}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"r": r, "interpretation": f"korelasi {_strength(r)}"},
        "interpretation": f"Korelasi Pearson {xname}–{yname} (n={len(pair)}): r={r:.3f} ({_strength(r)}), {fmt_p(p)}. " + (f"Hubungan signifikan — {xname} menjelaskan ~{r**2*100:.1f}% varians {yname} (R²={r**2:.3f})." if dec["reject_h0"] else "Tidak ada bukti hubungan linear yang signifikan."),
        "warnings": warnings,
    }


def run_spearman(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    xname, yname, pair = _prep(df, variables)
    rho, p = ss.spearmanr(pair["x"], pair["y"])
    rho, p = float(rho), float(p)
    lo, hi = _ci_fisher(rho, len(pair), alpha)
    dec = decision(p, alpha)
    return {
        "method": "spearman", "method_name": METHOD_NAMES["spearman"], "alpha": alpha, "n": int(len(pair)),
        "statistics": {"rho": rho, "p_value": p, "ci95": {"lower": lo, "upper": hi}, "strength": _strength(rho)},
        "assumptions": [{"name": "hubungan monotonik", "passed": None, "note": "periksa scatter plot — Spearman tidak butuh normalitas"}],
        "formula_latex": r"\rho=\mathrm{Pearson}(\mathrm{rank}(X),\mathrm{rank}(Y))",
        "parameters": {"x": xname, "y": yname},
        "calculation": [f"n={len(pair)}, ρ={rho:.4f}, {fmt_p(p)}", f"Keputusan: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"rho": rho, "interpretation": f"korelasi {_strength(rho)}"},
        "interpretation": f"Korelasi Spearman {xname}–{yname} (n={len(pair)}): ρ={rho:.3f} ({_strength(rho)}), {fmt_p(p)}. " + ("Hubungan monotonik signifikan." if dec["reject_h0"] else "Tidak ada bukti hubungan monotonik yang signifikan."),
        "warnings": [],
    }
