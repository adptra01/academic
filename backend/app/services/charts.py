"""Visualization Engine — grafik akademik (bukan dashboard marketing).
Style: grayscale-friendly, label sumbu + n, font DejaVu, DPI 150 web / 300 PDF.
Semua fungsi: (df, analysis, result, opts) → bytes PNG. Deterministik (tanpa random).
"""
from __future__ import annotations
import io
import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

CHART_TYPES = {"histogram", "boxplot", "scatter", "bar", "residual", "qq"}

DEFAULT_CHART = {
    "descriptive": "histogram", "normality": "histogram",
    "pearson": "scatter", "spearman": "scatter",
    "ttest_1samp": "histogram", "ttest_ind": "boxplot", "ttest_paired": "boxplot",
    "anova_oneway": "boxplot", "chi2_independence": "bar", "chi2_gof": "bar",
    "mannwhitney": "boxplot", "wilcoxon": "boxplot", "kruskal": "boxplot",
    "linreg_simple": "scatter", "linreg_multiple": "residual",
}


def _fig(title: str, xlabel: str = "", ylabel: str = ""):
    plt.rcParams.update({"font.size": 10, "axes.grid": True, "grid.alpha": 0.3, "figure.autolayout": True})
    fig, ax = plt.subplots(figsize=(7, 4.2))
    ax.set_title(title, fontsize=12)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    return fig, ax


def _png(fig, dpi: int) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi)
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _series(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada untuk grafik")
    return df[col]


def histogram(df, col: str, title: str, dpi: int, mu: float | None = None) -> bytes:
    s = pd.to_numeric(_series(df, col), errors="coerce").dropna()
    if len(s) == 0:
        raise ValueError(f"Kolom '{col}' kosong")
    fig, ax = _fig(title or f"Histogram {col} (n={len(s)})", col, "Frekuensi")
    ax.hist(s.to_numpy(), bins=min(30, max(5, len(s) // 5)), color="#4a4a4a", edgecolor="white")
    if mu is not None:
        ax.axvline(mu, color="black", linestyle="--", label=f"μ₀={mu}")
        ax.legend()
    return _png(fig, dpi)


def boxplot(df, col: str, group: str | None, title: str, dpi: int) -> bytes:
    if group and group in df.columns:
        sub = pd.DataFrame({"v": pd.to_numeric(df[col], errors="coerce"), "g": df[group].astype(str)}).dropna()
        levels = sorted(sub["g"].unique().tolist())
        data = [sub.loc[sub["g"] == lv, "v"].to_numpy() for lv in levels]
        fig, ax = _fig(title or f"Boxplot {col} per {group} (n={len(sub)})", group, col)
        ax.boxplot(data, labels=levels)
    else:
        s = pd.to_numeric(_series(df, col), errors="coerce").dropna()
        fig, ax = _fig(title or f"Boxplot {col} (n={len(s)})", "", col)
        ax.boxplot([s.to_numpy()], labels=[col])
    return _png(fig, dpi)


def scatter(df, xcol: str, ycol: str, title: str, dpi: int, trend: bool = False) -> bytes:
    sub = pd.DataFrame({"x": pd.to_numeric(df[xcol], errors="coerce"), "y": pd.to_numeric(df[ycol], errors="coerce")}).dropna()
    if len(sub) == 0:
        raise ValueError("Tidak ada pasangan non-missing untuk scatter")
    fig, ax = _fig(title or f"Scatter {xcol} vs {ycol} (n={len(sub)})", xcol, ycol)
    ax.scatter(sub["x"], sub["y"], s=18, color="#333333")
    if trend and len(sub) >= 2:
        b, a = np.polyfit(sub["x"], sub["y"], 1)
        xs = np.linspace(sub["x"].min(), sub["x"].max(), 100)
        ax.plot(xs, a + b * xs, color="black", linewidth=1.5)
    return _png(fig, dpi)


def bar(df, col: str, other: str | None, title: str, dpi: int, expected: dict | None = None) -> bytes:
    if other and other in df.columns:
        ct = pd.crosstab(df[col].astype(str), df[other].astype(str))
        fig, ax = _fig(title or f"{col} × {other} (n={int(ct.to_numpy().sum())})", other, "Jumlah")
        x = np.arange(len(ct.columns))
        w = 0.8 / max(1, len(ct.index))
        for i, idx in enumerate(ct.index):
            ax.bar(x + i * w, ct.loc[idx].to_numpy(), width=w, label=str(idx))
        ax.set_xticks(x + w * (len(ct.index) - 1) / 2)
        ax.set_xticklabels([str(c) for c in ct.columns])
        ax.legend(title=str(col))
    else:
        vc = df[col].astype(str).value_counts().sort_index()
        fig, ax = _fig(title or f"Distribusi {col} (n={int(vc.sum())})", str(col), "Jumlah")
        bars = ax.bar([str(i) for i in vc.index], vc.to_numpy(), color="#4a4a4a")
        if expected:
            for b, k in zip(bars, vc.index):
                e = expected.get(str(k))
                if e is not None:
                    ax.plot([b.get_x(), b.get_x() + b.get_width()], [e, e], color="black", linewidth=2)
    return _png(fig, dpi)


def residual(df, ycol: str, xcols: list[str], title: str, dpi: int) -> bytes:
    import statsmodels.api as sm

    cols = {c: pd.to_numeric(df[c], errors="coerce") for c in [*xcols, ycol]}
    sub = pd.DataFrame(cols).dropna()
    X, y = sub[xcols], sub[ycol]
    model = sm.OLS(y, sm.add_constant(X, has_constant="add")).fit()
    fitted = np.asarray(model.fittedvalues)
    resid = np.asarray(model.resid)
    fig, ax = _fig(title or f"Residual vs Fitted (n={len(sub)})", "Fitted", "Residual")
    ax.scatter(fitted, resid, s=18, color="#333333")
    ax.axhline(0, color="black", linewidth=1)
    return _png(fig, dpi)


def qq(df, col: str, title: str, dpi: int) -> bytes:
    from scipy import stats as sss

    s = pd.to_numeric(_series(df, col), errors="coerce").dropna()
    if len(s) < 3:
        raise ValueError("QQ-plot butuh minimal 3 nilai")
    fig, ax = _fig(title or f"Q-Q Plot {col} (n={len(s)})", "Kuantil teoritis", "Kuantil sampel")
    (osm, osr), (slope, intercept, _) = sss.probplot(s.to_numpy(), dist="norm")
    ax.scatter(osm[0], osm[1], s=18, color="#333333")
    ax.plot(osm[0], slope * np.asarray(osm[0]) + intercept, color="black", linewidth=1.5)
    return _png(fig, dpi)


def make_chart(df: pd.DataFrame, method: str, variables: dict, result: dict, chart_type: str | None, dpi: int = 150, title: str = "") -> tuple[bytes, str]:
    """Kembalikan (png_bytes, chart_type_terpakai)."""
    ct = chart_type or DEFAULT_CHART.get(method, "histogram")
    if ct not in CHART_TYPES:
        raise ValueError(f"chart_type harus salah satu {sorted(CHART_TYPES)}")
    v = variables
    if ct == "histogram":
        col = v.get("column") or v.get("y") or (v.get("columns") or [None])[0] or v.get("x")
        return histogram(df, col, title, dpi, mu=v.get("mu")), ct
    if ct == "boxplot":
        col = v.get("column") or v.get("col1")
        grp = v.get("group")
        if col is None and v.get("col1") and v.get("col2"):
            tmp = pd.DataFrame({"v": pd.concat([pd.to_numeric(df[v["col1"]], errors="coerce"), pd.to_numeric(df[v["col2"]], errors="coerce")]), "g": [v["col1"]] * len(df) + [v["col2"]] * len(df)})
            fig, ax = _fig(title or f"Boxplot {v['col1']} vs {v['col2']}", "", "Nilai")
            ax.boxplot([pd.to_numeric(df[v["col1"]], errors="coerce").dropna().to_numpy(), pd.to_numeric(df[v["col2"]], errors="coerce").dropna().to_numpy()], labels=[v["col1"], v["col2"]])
            return _png(fig, dpi), ct
        return boxplot(df, col, grp, title, dpi), ct
    if ct == "scatter":
        x = v.get("x") or v.get("col1") or v.get("column")
        y = v.get("y") or v.get("col2") or v.get("column")
        return scatter(df, x, y, title, dpi, trend=(method in ("pearson", "spearman", "linreg_simple"))), ct
    if ct == "bar":
        col = v.get("column") or v.get("col1")
        other = v.get("col2") or v.get("group")
        exp = (result.get("statistics") or {}).get("expected")
        return bar(df, col, other if other in df.columns else None, title, dpi, expected=exp), ct
    if ct == "residual":
        y = v.get("y")
        xs = v.get("xs") or ([v["x"]] if v.get("x") else None)
        if not y or not xs:
            raise ValueError("residual butuh variabel regresi (x/y atau xs/y)")
        return residual(df, y, xs, title, dpi), ct
    if ct == "qq":
        col = v.get("column") or v.get("y") or v.get("x")
        return qq(df, col, title, dpi), ct
    raise ValueError("unreachable")
