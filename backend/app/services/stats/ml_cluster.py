"""M-17 Clustering: K-Means + Hierarchical (Ward). Deterministik (random_state=42).
Output: labels, sizes, inertia (kmeans), silhouette, centroids, linkage info.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.metrics import silhouette_score
from scipy.cluster.hierarchy import linkage
from app.services.stats import clean, METHOD_NAMES


def run(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    feats = variables.get("features")
    algo = variables.get("algorithm", params.get("algorithm", "kmeans"))
    k = int(params.get("n_clusters", variables.get("n_clusters", 3)))
    if not feats or not isinstance(feats, list):
        raise ValueError("ml_cluster butuh 'variables.features' (list numerik ≥2 kolom untuk visualisasi)")
    if len(feats) < 1:
        raise ValueError("Minimal 1 fitur")
    if algo not in ("kmeans", "hierarchical"):
        raise ValueError("algorithm harus kmeans|hierarchical")
    if not 2 <= k <= 20:
        raise ValueError("n_clusters harus 2..20")
    for c in feats:
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    sub = pd.DataFrame({c: pd.to_numeric(df[c], errors="coerce") for c in feats}).dropna()
    if len(sub) < k + 1:
        raise ValueError(f"Butuh >{k} baris bersih (dapat {len(sub)})")
    X = sub.to_numpy()
    if algo == "kmeans":
        model = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = model.fit_predict(X)
        inertia = float(model.inertia_)
        centers = model.cluster_centers_.tolist()
        extra = {"inertia": clean(inertia)}
    else:
        model = AgglomerativeClustering(n_clusters=k, linkage="ward")
        labels = model.fit_predict(X)
        Z = linkage(X, method="ward")
        centers = []
        extra = {"linkage": "ward", "merge_distances_first5": clean(Z[:5, 2].tolist())}
    sil = None
    if 2 <= k < len(X):
        try:
            sil = float(silhouette_score(X, labels))
        except Exception:
            sil = None
    sizes = {int(lv): int((labels == lv).sum()) for lv in sorted(np.unique(labels).tolist())}
    viz_scatter = None
    try:
        idx = np.arange(len(X))
        if len(X) > 2000:
            rng = np.random.RandomState(42)
            idx = np.sort(rng.choice(len(X), 2000, replace=False))
        viz_scatter = {
            "x": clean(X[idx, 0].tolist() if X.shape[1] >= 1 else []),
            "y": clean(X[idx, 1].tolist() if X.shape[1] >= 2 else [0.0] * len(idx)),
            "label": clean(labels[idx].tolist()),
            "x_feature": feats[0], "y_feature": feats[1] if len(feats) > 1 else None,
            "centers": clean(centers) if centers else None,
            "note": "ECharts-ready: scatter x vs y colored by label" + ("" if X.shape[1] <= 2 else " (2 fitur pertama)"),
        }
    except Exception:
        viz_scatter = None
    warnings = []
    if sil is not None and sil < 0.25:
        warnings.append(f"Silhouette rendah ({sil:.3f}) — cluster tumpang tindih, coba k lain")
    return {
        "method": "ml_cluster", "method_name": METHOD_NAMES["ml_cluster"], "alpha": alpha, "n": int(len(sub)),
        "statistics": {"algorithm": algo, "k": k, "features": feats, "sizes": sizes, "centroids": clean(centers), "silhouette": clean(sil), **extra},
        "assumptions": [{"name": "skala fitur sebanding", "passed": None, "note": "standarisasi dulu (preprocessing) bila rentang fitur jauh berbeda"}],
        "formula_latex": r"J=\sum_{j=1}^{k}\sum_{x\in C_j}\|x-\mu_j\|^2,\quad s=\frac{b-a}{\max(a,b)}",
        "parameters": {"features": feats, "algorithm": algo, "n_clusters": k},
        "calculation": [f"n={len(sub)}, k={k}, sizes={sizes}"] + ([f"inertia={inertia:.4f}"] if algo == "kmeans" else []) + ([f"silhouette={sil:.4f}"] if sil is not None else []),
        "decision": None,
        "effect_size": {"silhouette": clean(sil)},
        "visualization": {"scatter2d": viz_scatter, "meta": {"analysis_method": "ml_cluster", "note": "ECharts-ready"}},
        "interpretation": f"Clustering {algo} k={k} (n={len(sub)}): sizes={sizes}" + (f", silhouette={sil:.3f}." if sil is not None else ".") + (" Struktur cluster jelas." if (sil or 0) >= 0.5 else " Struktur lemah — eksplorasi k lain."),
        "warnings": warnings,
    }
