"""M-01 Descriptive Statistics."""
from __future__ import annotations
import pandas as pd
from app.services.stats import clean, METHOD_NAMES

FORMULA = r"\bar{x}=\frac{\sum x}{n},\quad s^2=\frac{\sum(x-\bar{x})^2}{n-1}"


def run(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    cols = variables.get("columns")
    if not cols or not isinstance(cols, list):
        raise ValueError("descriptive butuh 'variables.columns' (list nama kolom), mis. {'columns': ['age', 'score']}")
    desc: dict = {}
    for col in cols:
        if col not in df.columns:
            raise ValueError(f"Kolom '{col}' tidak ada")
        s = df[col]
        if pd.api.types.is_numeric_dtype(s.dtype):
            x = pd.to_numeric(s, errors="coerce").dropna()
            n = int(len(x))
            if n == 0:
                desc[col] = {"n": 0, "note": "semua missing"}
                continue
            desc[col] = clean({
                "n": n, "mean": x.mean(), "median": x.median(),
                "mode": x.mode(dropna=True).tolist()[:5],
                "min": x.min(), "max": x.max(), "range": x.max() - x.min(),
                "variance": x.var(ddof=1) if n > 1 else None,
                "std": x.std(ddof=1) if n > 1 else None,
                "q1": x.quantile(0.25), "q3": x.quantile(0.75),
                "iqr": x.quantile(0.75) - x.quantile(0.25),
                "skewness": x.skew() if n > 2 else None,
                "kurtosis": x.kurt() if n > 3 else None,
                "missing": int(s.isna().sum()),
            })
        else:
            vc = s.value_counts(dropna=False)
            desc[col] = clean({
                "n": int(s.notna().sum()), "unique": int(s.nunique(dropna=True)),
                "missing": int(s.isna().sum()),
                "frequency": {str(k): int(v) for k, v in vc.head(20).items()},
            })
    return {
        "method": "descriptive", "method_name": METHOD_NAMES["descriptive"], "alpha": alpha,
        "n": clean(int(len(df))), "statistics": desc, "assumptions": [],
        "formula_latex": FORMULA, "parameters": {"columns": cols},
        "calculation": [f"Kolom '{c}': n={v.get('n')}, mean={v.get('mean')}" if "mean" in v else f"Kolom '{c}': kategorikal, {v.get('unique')} kategori" for c, v in desc.items()],
        "decision": None, "effect_size": None,
        "interpretation": f"Statistik deskriptif {len(cols)} kolom dari n={len(df)} baris.",
        "warnings": [],
    }
