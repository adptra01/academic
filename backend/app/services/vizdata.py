"""Visualization datasets untuk ECharts — LAPISAN VISUAL SAJA, tak menghitung statistik.
Semua angka berasal dari result engine atau agregasi deterministik mentah
(histogram bins, sampling titik). Modul terpisah dari services/stats (RC1 freeze).
Setiap payload: {type, data, metadata{analysis_uid, dataset_version}}.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

MAX_POINTS = 2000
MAX_BINS = 30


def _meta(result: dict, version: int | None, uid: str | None = None) -> dict:
    return {"analysis_uid": uid, "dataset_version": version, "method": result.get("method")}


def histogram(df: pd.DataFrame, col: str, result: dict, version: int | None, uid: str | None = None) -> dict:
    s = pd.to_numeric(df[col], errors="coerce").dropna()
    if len(s) == 0:
        raise ValueError(f"Kolom '{col}' kosong")
    counts, edges = np.histogram(s.to_numpy(), bins=min(MAX_BINS, max(5, len(s) // 5)))
    return {"type": "histogram", "data": {"bins": [round(float(e), 4) for e in edges.tolist()], "counts": [int(c) for c in counts.tolist()], "n": int(len(s))}, "metadata": _meta(result, version, uid)}


def boxplot(df: pd.DataFrame, col: str, group: str | None, result: dict, version: int | None, uid: str | None = None) -> dict:
    groups = []
    if group and group in df.columns:
        sub = pd.DataFrame({"v": pd.to_numeric(df[col], errors="coerce"), "g": df[group].astype(str)}).dropna()
        for lv in sorted(sub["g"].unique().tolist()):
            vals = sub.loc[sub["g"] == lv, "v"].to_numpy()
            groups.append({"name": str(lv), "stats": _five(vals), "n": int(len(vals))})
    else:
        vals = pd.to_numeric(df[col], errors="coerce").dropna().to_numpy()
        groups.append({"name": str(col), "stats": _five(vals), "n": int(len(vals))})
    return {"type": "boxplot", "data": {"groups": groups}, "metadata": _meta(result, version, uid)}


def _five(vals: np.ndarray) -> list:
    q = np.quantile(vals, [0, 0.25, 0.5, 0.75, 1.0]).tolist()
    return [round(float(x), 4) for x in q]


def scatter(df: pd.DataFrame, xcol: str, ycol: str, result: dict, version: int | None, uid: str | None = None, trend: bool = False) -> dict:
    sub = pd.DataFrame({"x": pd.to_numeric(df[xcol], errors="coerce"), "y": pd.to_numeric(df[ycol], errors="coerce")}).dropna()
    if len(sub) == 0:
        raise ValueError("Tidak ada pasangan non-missing")
    if len(sub) > MAX_POINTS:
        sub = sub.iloc[np.sort(np.random.RandomState(42).choice(len(sub), MAX_POINTS, replace=False))]
    payload: dict = {"type": "scatter", "data": {"points": [[round(float(x), 4), round(float(y), 4)] for x, y in zip(sub["x"], sub["y"])], "n": int(len(sub)), "sampled": int(len(sub)) < len(df)}, "metadata": _meta(result, version, uid)}
    if trend:
        st = result.get("statistics") or {}
        coefs = st.get("coefs") if isinstance(st.get("coefs"), list) else None
        b = a = None
        if coefs:
            for c in coefs:
                if c.get("term") == "x":
                    b = c.get("coef")
                if c.get("term") == "const":
                    a = c.get("coef")
        if a is not None and b is not None:
            xs = [float(sub["x"].min()), float(sub["x"].max())]
            payload["data"]["trend"] = {"a": a, "b": b, "line": [[xs[0], a + b * xs[0]], [xs[1], a + b * xs[1]]]}
    return payload


def bar(result: dict, version: int | None, uid: str | None = None) -> dict:
    st = result.get("statistics") or {}
    cont = st.get("contingency")
    if cont:
        cats = sorted({k2 for row in cont.values() for k2 in row})
        series = [{"name": str(k), "values": [int(cont[k].get(c, 0)) for c in cats]} for k in sorted(cont)]
        return {"type": "bar", "data": {"categories": [str(c) for c in cats], "series": series}, "metadata": _meta(result, version, uid)}
    obs = st.get("observed")
    if obs:
        return {"type": "bar", "data": {"categories": list(obs.keys()), "series": [{"name": "observed", "values": list(obs.values())}]}, "metadata": _meta(result, version, uid)}
    raise ValueError("data bar tidak tersedia pada hasil ini")


def passthrough(result: dict, version: int | None, kind: str, uid: str | None = None) -> dict:
    st = result.get("statistics") or {}
    viz = result.get("visualization") or {}
    mapping = {
        "confusion": {"matrix": st.get("confusion_matrix"), "classes": st.get("classes")},
        "roc": viz.get("roc"),
        "cluster": viz.get("scatter2d"),
        "topics": {"topics": st.get("topics")},
        "topterms": {"terms": st.get("top_terms")},
        "rules": {"rules": st.get("rules")},
    }
    if kind not in mapping or mapping[kind] is None:
        raise ValueError(f"data {kind} tidak tersedia pada hasil ini")
    return {"type": kind, "data": mapping[kind], "metadata": _meta(result, version, uid)}


def build(df: pd.DataFrame, method: str, variables: dict, result: dict, version: int | None, viz_type: str | None, uid: str | None = None) -> dict:
    from app.services.charts import DEFAULT_CHART

    table = {"histogram": "histogram", "boxplot": "boxplot", "scatter": "scatter", "bar": "bar", "confusion": "confusion", "roc": "roc", "cluster": "cluster", "dendrogram": "dendrogram", "topics": "topics", "topterms": "topterms", "rules": "rules", "residual": "residual", "qq": "qq"}
    vt = viz_type or DEFAULT_CHART.get(method, "histogram")
    if vt not in table:
        raise ValueError(f"viz type harus salah satu {sorted(table)}")
    v = variables
    if vt == "histogram":
        col = v.get("column") or v.get("y") or (v.get("columns") or [None])[0] or v.get("x")
        return histogram(df, col, result, version, uid)
    if vt == "boxplot":
        col = v.get("column") or v.get("col1") or v.get("y")
        grp = v.get("group")
        return boxplot(df, col, grp, result, version, uid)
    if vt == "scatter":
        return scatter(df, v.get("x") or v.get("col1") or v.get("column"), v.get("y") or v.get("col2") or v.get("column"), result, version, uid, trend=(method in ("pearson", "spearman", "linreg_simple")))
    if vt == "bar":
        return bar(result, version, uid)
    if vt in ("confusion", "roc", "cluster", "topics", "topterms", "rules"):
        return passthrough(result, version, vt, uid)
    raise ValueError(f"tipe '{vt}' belum didukung ECharts interaktif (gunakan PNG)")
