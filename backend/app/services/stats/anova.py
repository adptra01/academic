"""M-08 One-Way ANOVA + eta² + Tukey HSD (jika signifikan)."""
from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats as ss
from app.services.stats import clean, decision, fmt_p, METHOD_NAMES
from app.services.stats.normality import check as _norm_check


def run_oneway(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col, grp = variables.get("column"), variables.get("group")
    if not col or not grp:
        raise ValueError("anova_oneway butuh 'variables.column' (numerik) dan 'variables.group' (≥3 grup)")
    if col not in df.columns or grp not in df.columns:
        raise ValueError("Kolom tidak ada")
    sub = pd.DataFrame({"v": pd.to_numeric(df[col], errors="coerce"), "g": df[grp].astype(str)}).dropna()
    levels = sorted(sub["g"].unique().tolist())
    if len(levels) < 3:
        raise ValueError(f"One-Way ANOVA butuh ≥3 grup (dapat {len(levels)}: {levels}) — untuk 2 grup gunakan Independent t-Test")
    groups = [sub.loc[sub["g"] == lv, "v"].to_numpy() for lv in levels]
    if any(len(g) < 2 for g in groups):
        raise ValueError("Tiap grup butuh minimal 2 nilai")
    f, p = ss.f_oneway(*groups)
    f, p = float(f), float(p)
    n_total = int(sum(len(g) for g in groups))
    k = len(levels)
    grand = float(sub["v"].mean())
    ssb = float(sum(len(g) * (g.mean() - grand) ** 2 for g in groups))
    sst = float(((sub["v"] - grand) ** 2).sum())
    ssw = sst - ssb
    dfb, dfw = k - 1, n_total - k
    eta2 = float(ssb / sst) if sst != 0 else 0.0
    _, p_levene = ss.levene(*groups)
    dec = decision(p, alpha)
    norm_checks = [_norm_check(g, alpha, f"grup '{lv}'") for g, lv in zip(groups, levels)]
    assumptions = [
        *norm_checks,
        {"name": f"homogenitas (Levene) p={float(p_levene):.4f}", "p_value": clean(float(p_levene)), "passed": bool(p_levene >= alpha), "note": "ANOVA cukup robust — lanjutkan dengan catatan" if p_levene < alpha else "asumsi terpenuhi"},
    ]
    calc = [f"k={k} grup, N={n_total}; SSB={ssb:.4f} (df={dfb}), SSW={ssw:.4f} (df={dfw})", f"F({dfb},{dfw})={f:.4f}, {fmt_p(p)}, η²={eta2:.3f}", f"Keputusan: {dec['text']} (α={alpha})"]
    warnings: list[str] = []
    if any(c.get("passed") is False for c in norm_checks):
        warnings.append("Ada grup tidak normal — pertimbangkan Kruskal-Wallis")
    posthoc = None
    if dec["reject_h0"]:
        try:
            from statsmodels.stats.multicomp import pairwise_tukeyhsd

            tuk = pairwise_tukeyhsd(sub["v"].to_numpy(), sub["g"].to_numpy(), alpha=alpha)
            rows = []
            s = str(tuk.summary())
            for line in s.splitlines():
                if "True" in line or "False" in line:
                    rows.append(line.strip())
            posthoc = {"method": "Tukey HSD", "rows_text": rows, "summary": s}
            calc.append(f"Post-hoc Tukey HSD signifikan — {len([r for r in rows if 'True' in r])} pasangan berbeda")
        except Exception as e:
            warnings.append(f"Tukey HSD gagal: {e}")
    else:
        warnings.append("ANOVA tidak signifikan — post-hoc tidak diperlukan. Jika asumsi gagal, lihat Kruskal-Wallis")
        if p_levene < alpha:
            warnings.append(f"Levene p={float(p_levene):.3f} — varians tidak homogen, interpretasi hati-hati")
    return {
        "method": "anova_oneway", "method_name": METHOD_NAMES["anova_oneway"], "alpha": alpha, "n": n_total,
        "statistics": {"k": k, "groups": levels, "group_means": clean({lv: float(sub.loc[sub['g'] == lv, 'v'].mean()) for lv in levels}), "group_ns": clean({lv: int((sub['g'] == lv).sum()) for lv in levels}), "ssb": clean(ssb), "ssw": clean(ssw), "dfb": dfb, "dfw": dfw, "msb": clean(ssb / dfb), "msw": clean(ssw / dfw) if dfw else None, "f": f, "p_value": p, "posthoc": posthoc},
        "assumptions": assumptions,
        "formula_latex": r"F=\frac{MSB}{MSW}=\frac{SSB/(k-1)}{SSW/(N-k)},\quad \eta^2=\frac{SSB}{SST}",
        "parameters": {"column": col, "group": grp, "groups": levels},
        "calculation": calc, "decision": dec, "effect_size": {"eta_squared": clean(eta2)},
        "interpretation": f"One-Way ANOVA '{col}' antar {k} grup (N={n_total}): F({dfb},{dfw})={f:.3f}, {fmt_p(p)}, η²={eta2:.3f}. " + ("Minimal satu grup berbeda signifikan — lihat Tukey HSD." if dec["reject_h0"] else "Tidak ada bukti perbedaan rata-rata antar grup."),
        "warnings": warnings,
    }
