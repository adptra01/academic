"""M-02 Normality: Shapiro-Wilk (n≤5000) atau D'Agostino (n>5000)."""
from __future__ import annotations
import pandas as pd
from scipy import stats as ss
from app.services.stats import clean, decision, fmt_p, METHOD_NAMES


def _test(x: pd.Series, method: str) -> tuple[str, float, float]:
    n = len(x)
    if method == "auto":
        method = "shapiro" if n <= 5000 else "dagostino"
    if method == "shapiro":
        if not 3 <= n <= 5000:
            raise ValueError(f"Shapiro-Wilk butuh 3 ≤ n ≤ 5000 (n={n}); gunakan method='dagostino' atau KS")
        w, p = ss.shapiro(x)
        return "Shapiro-Wilk", float(w), float(p)
    if method == "dagostino":
        if n < 20:
            raise ValueError(f"D'Agostino butuh n ≥ 20 (n={n}); gunakan Shapiro")
        k2, p = ss.normaltest(x)
        return "D'Agostino-Pearson", float(k2), float(p)
    raise ValueError("method harus auto|shapiro|dagostino")


def check(values, alpha: float, label: str) -> dict:
    """Uji normalitas otomatis untuk engine lain. Tak pernah raise untuk data valid."""
    x = pd.to_numeric(pd.Series(values), errors="coerce").dropna()
    if len(x) < 3:
        return {"name": f"normalitas {label}", "passed": None, "note": f"n={len(x)} < 3, tidak dapat diuji"}
    name, stat, p = _test(x, "auto")
    return {"name": f"normalitas {label} ({name})", "statistic": clean(stat), "p_value": clean(p), "passed": bool(p >= alpha), "note": "otomatis"}


def run(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col = variables.get("column")
    if not col:
        raise ValueError("normality butuh 'variables.column'")
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada")
    x = pd.to_numeric(df[col], errors="coerce").dropna()
    if len(x) < 3:
        raise ValueError(f"Butuh minimal 3 nilai non-missing (dapat {len(x)})")
    m = params.get("method", variables.get("method", "auto"))
    name, stat, p = _test(x, m)
    dec = decision(p, alpha)
    normal = not dec["reject_h0"]
    return {
        "method": "normality", "method_name": METHOD_NAMES["normality"], "alpha": alpha,
        "n": int(len(x)),
        "statistics": {"test": name, "statistic": stat, "p_value": p, "normal": normal},
        "assumptions": [{"name": "independensi observasi", "passed": None, "note": "tidak dapat diuji otomatis — pastikan sampling/desain independen"}],
        "formula_latex": r"W=\frac{(\sum a_i x_{(i)})^2}{\sum(x-\bar{x})^2}" if "Shapiro" in name else r"K^2=Z_{skew}^2+Z_{kurt}^2",
        "parameters": {"column": col, "method": name},
        "calculation": [f"{name}: statistik={stat:.4f}, {fmt_p(p)}, α={alpha}", f"Keputusan: {'data konsisten dengan distribusi normal' if normal else 'data TIDAK normal'} ({dec['text']})"],
        "decision": dec, "effect_size": None,
        "interpretation": f"Uji normalitas {name} pada '{col}' (n={len(x)}): statistik={stat:.4f}, {fmt_p(p)}. " + ("Data dapat dianggap normal — uji parametrik boleh digunakan." if normal else "Data tidak normal — gunakan alternatif non-parametrik (Mann-Whitney/Wilcoxon/Kruskal-Wallis/Spearman)."),
        "warnings": [] if len(x) <= 5000 or "Shapiro" not in name else ["n > 5000: Shapiro tidak valid, otomatis memakai D'Agostino"],
    }
