"""M-13/14 Regresi linear: OLS via Statsmodels. Output koef/SE/t/p, R²/adj-R²/F, VIF (multiple)."""
from __future__ import annotations
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import het_breuschpagan
from app.services.stats import clean, decision, fmt_p, METHOD_NAMES
from app.services.stats.normality import check as _norm_check


def _residual_checks(model, alpha: float) -> tuple[dict, dict | None, list[str]]:
    """Kembalikan (normality_check, bp_check|None, warnings)."""
    import numpy as np

    resid = np.asarray(model.resid)
    norm = _norm_check(resid, alpha, "residual")
    bp = None
    warnings: list[str] = []
    try:
        lm, lm_p, _, _ = het_breuschpagan(resid, model.model.exog)
        bp = {"name": f"homoskedastisitas (Breusch-Pagan) p={float(lm_p):.4f}", "statistic": clean(float(lm)), "p_value": clean(float(lm_p)), "passed": bool(lm_p >= alpha), "note": "otomatis"}
        if lm_p < alpha:
            warnings.append("Heteroskedastisitas terdeteksi (BP p<α) — gunakan robust SE atau transformasi")
    except Exception as e:
        warnings.append(f"Uji Breusch-Pagan gagal: {e}")
    if norm.get("passed") is False:
        warnings.append("Residual tidak normal — interval/p-value regresi kurang valid")
    return norm, bp, warnings


def _fit_ols(y: pd.Series, X: pd.DataFrame):
    Xc = sm.add_constant(X, has_constant="add")
    model = sm.OLS(y, Xc).fit()
    return model


def _summarize(model, alpha: float) -> dict:
    ci = model.conf_int(alpha=alpha)
    coefs = []
    for name in model.params.index.tolist():
        coefs.append({"term": str(name), "coef": clean(float(model.params[name])), "se": clean(float(model.bse[name])), "t": clean(float(model.tvalues[name])), "p_value": clean(float(model.pvalues[name]))})
    return {
        "coefs": coefs,
        "r_squared": clean(float(model.rsquared)),
        "adj_r_squared": clean(float(model.rsquared_adj)),
        "f_stat": clean(float(model.fvalue)),
        "f_p": clean(float(model.f_pvalue)),
        "nobs": int(model.nobs),
        "ci": {str(k): {"lower": clean(float(v[0])), "upper": clean(float(v[1]))} for k, v in ci.to_dict(orient="index").items()},
    }


def run_simple(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    xname, yname = variables.get("x"), variables.get("y")
    if not xname or not yname:
        raise ValueError("linreg_simple butuh 'variables.x' dan 'variables.y' (numerik)")
    for c in (xname, yname):
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    sub = pd.DataFrame({"x": pd.to_numeric(df[xname], errors="coerce"), "y": pd.to_numeric(df[yname], errors="coerce")}).dropna()
    if len(sub) < 3:
        raise ValueError("Butuh minimal 3 baris non-missing")
    model = _fit_ols(sub["y"], sub[["x"]])
    s = _summarize(model, alpha)
    b = next(c for c in s["coefs"] if c["term"] == "x")
    a = next(c for c in s["coefs"] if c["term"] == "const")
    dec = decision(b["p_value"], alpha)
    fdec = decision(s["f_p"], alpha)
    norm_c, bp_c, auto_w = _residual_checks(model, alpha)
    assumptions = [
        {"name": "linearitas", "passed": None, "note": "periksa scatter X–Y"},
        norm_c,
    ]
    if bp_c:
        assumptions.append(bp_c)
    else:
        assumptions.append({"name": "homoskedastisitas", "passed": None, "note": "periksa residual-vs-fitted plot"})
    return {
        "method": "linreg_simple", "method_name": METHOD_NAMES["linreg_simple"], "alpha": alpha, "n": int(len(sub)),
        "statistics": {**s, "equation": f"Y = {a['coef']:.4f} + {b['coef']:.4f}·X"},
        "assumptions": assumptions,
        "formula_latex": r"\hat{Y}=a+bX,\quad b=\frac{\mathrm{cov}(X,Y)}{\mathrm{var}(X)}",
        "parameters": {"x": xname, "y": yname},
        "calculation": [f"n={len(sub)}", f"Y = {a['coef']:.4f} + {b['coef']:.4f}·X; b: t={b['t']:.3f}, {fmt_p(b['p_value'])}; R²={s['r_squared']:.3f}, adj-R²={s['adj_r_squared']:.3f}; F={s['f_stat']:.3f}, {fmt_p(s['f_p'])}", f"Keputusan slope: {dec['text']} (α={alpha})"],
        "decision": dec, "effect_size": {"r_squared": s["r_squared"]},
        "interpretation": f"Regresi {yname} atas {xname} (n={len(sub)}): {fmt_p(b['p_value'])}, R²={s['r_squared']:.3f}. " + (f"Setiap +1 {xname} → {yname} berubah {b['coef']:.3f} (signifikan)." if dec["reject_h0"] else "Slope tidak signifikan."),
        "warnings": auto_w if fdec["reject_h0"] else auto_w + ["Model keseluruhan tidak signifikan (F-test)"],
    }


def run_multiple(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    xs, yname = variables.get("xs"), variables.get("y")
    if not xs or not isinstance(xs, list) or not yname:
        raise ValueError("linreg_multiple butuh 'variables.xs' (list ≥2) dan 'variables.y'")
    if len(xs) < 2:
        raise ValueError("Multiple regression butuh minimal 2 prediktor (gunakan Simple untuk 1 X)")
    for c in [*xs, yname]:
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    cols = {c: pd.to_numeric(df[c], errors="coerce") for c in [*xs, yname]}
    sub = pd.DataFrame(cols).dropna()
    if len(sub) < len(xs) + 2:
        raise ValueError(f"Butuh minimal {len(xs) + 2} baris (dapat {len(sub)})")
    X, y = sub[xs], sub[yname]
    model = _fit_ols(y, X)
    s = _summarize(model, alpha)
    # VIF
    vif: dict = {}
    warnings: list[str] = []
    try:
        Xc = sm.add_constant(X, has_constant="add")
        for i, c in enumerate(Xc.columns):
            if c == "const":
                continue
            vif[c] = clean(float(variance_inflation_factor(Xc.to_numpy(), i)))
        high = [c for c, v in vif.items() if v is not None and v > 10]
        if high:
            warnings.append(f"Multikolinearitas: VIF>10 pada {high} — pertimbangkan drop/centering")
    except Exception as e:
        warnings.append(f"VIF gagal: {e}")
    s["vif"] = vif
    fdec = decision(s["f_p"], alpha)
    sig = [c["term"] for c in s["coefs"] if c["term"] != "const" and c["p_value"] is not None and c["p_value"] < alpha]
    norm_c, bp_c, auto_w = _residual_checks(model, alpha)
    assumptions = [
        {"name": "linearitas", "passed": None, "note": "periksa scatter per-X"},
        {"name": "non-multikolinearitas (VIF<10)", "passed": all((v or 0) < 10 for v in vif.values()), "note": f"VIF={vif}"},
        norm_c,
    ]
    if bp_c:
        assumptions.append(bp_c)
    warnings = warnings + auto_w
    return {
        "method": "linreg_multiple", "method_name": METHOD_NAMES["linreg_multiple"], "alpha": alpha, "n": int(len(sub)),
        "statistics": s,
        "assumptions": assumptions,
        "formula_latex": r"\hat{Y}=b_0+b_1X_1+\cdots+b_kX_k",
        "parameters": {"xs": xs, "y": yname},
        "calculation": [f"n={len(sub)}, k={len(xs)}", f"R²={s['r_squared']:.3f}, adj-R²={s['adj_r_squared']:.3f}; F={s['f_stat']:.3f}, {fmt_p(s['f_p'])}", f"Prediktor signifikan: {sig or '-'}", f"Keputusan model: {fdec['text']} (α={alpha})"],
        "decision": fdec, "effect_size": {"r_squared": s["r_squared"], "adj_r_squared": s["adj_r_squared"]},
        "interpretation": f"Regresi berganda {yname} atas {xs} (n={len(sub)}): R²={s['r_squared']:.3f}, {fmt_p(s['f_p'])}. " + (f"Prediktor signifikan: {sig}." if sig else "Tidak ada prediktor signifikan."),
        "warnings": warnings if fdec["reject_h0"] else warnings + ["Model keseluruhan tidak signifikan (F-test)"],
    }
