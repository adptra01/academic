"""Statistical Engine — dispatcher + helpers JSON-safe. SEMUA hitungan deterministik di sini (SciPy/Statsmodels). DILARANG memakai LLM untuk angka."""
from __future__ import annotations
import hashlib
import json
import random
import string
from datetime import datetime, timezone
import numpy as np
import pandas as pd

METHOD_IDS = [
    "descriptive", "normality", "pearson", "spearman",
    "ttest_1samp", "ttest_ind", "ttest_paired", "anova_oneway",
    "chi2_independence", "chi2_gof", "mannwhitney", "wilcoxon", "kruskal",
    "linreg_simple", "linreg_multiple",
    # Phase 2 (di luar RC1 freeze — lihat CHANGELOG scope unfreeze):
    "ml_classify", "ml_cluster", "text_tfidf", "text_lda",
    "apriori",
]

METHOD_NAMES = {
    "descriptive": "Descriptive Statistics",
    "normality": "Normality Test",
    "pearson": "Pearson Correlation",
    "spearman": "Spearman Correlation",
    "ttest_1samp": "One-Sample t-Test",
    "ttest_ind": "Independent Samples t-Test",
    "ttest_paired": "Paired Samples t-Test",
    "anova_oneway": "One-Way ANOVA",
    "chi2_independence": "Chi-Square Test of Independence",
    "chi2_gof": "Chi-Square Goodness of Fit",
    "mannwhitney": "Mann-Whitney U Test",
    "wilcoxon": "Wilcoxon Signed-Rank Test",
    "kruskal": "Kruskal-Wallis Test",
    "linreg_simple": "Simple Linear Regression",
    "linreg_multiple": "Multiple Linear Regression",
    "ml_classify": "ML Classification",
    "ml_cluster": "ML Clustering",
    "text_tfidf": "Text Vectorization (TF-IDF/BoW)",
    "text_lda": "Topic Modeling (LDA)",
    "apriori": "Association Rules (Apriori)",
}


def new_uid() -> str:
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"ANL-{day}-{rand}"


def clean(v):
    """Buat nilai JSON-safe: numpy → python, NaN/inf → None."""
    if v is None:
        return None
    if isinstance(v, (bool, str)):
        return v
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return f if np.isfinite(f) else None
    if isinstance(v, float):
        return v if np.isfinite(v) else None
    if isinstance(v, int):
        return v
    if isinstance(v, dict):
        return {str(k): clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [clean(x) for x in v]
    return v


def result_hash(result: dict) -> str:
    canon = json.dumps(result, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def analysis_hash(context: dict, result: dict) -> str:
    """Hash deterministik dari context + result untuk deteksi duplikat analisis.
    context berisi: method, variables, params, dataset_version_id, project_id.
    Duplikat = kombinasi context + result identik → hash sama.
    """
    payload = {
        "context": {k: context.get(k) for k in
                    ("method", "variables", "params", "dataset_version_id", "project_id")},
        "result": result,
    }
    canon = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def decision(p: float, alpha: float) -> dict:
    reject = bool(p < alpha)
    return {"alpha": alpha, "p": clean(p), "reject_h0": reject, "text": "Tolak H0" if reject else "Gagal menolak H0"}


def fmt_p(p: float) -> str:
    if p is None:
        return "p = ?"
    if p < 0.001:
        return "p < .001"
    return f"p = {p:.3f}"


def _num_col(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada. Tersedia: {list(df.columns)}")
    s = pd.to_numeric(df[col], errors="coerce")
    return s


def run_analysis(df: pd.DataFrame, method: str, variables: dict, params: dict) -> dict:
    """Dispatcher. Mengembalikan result payload (belum termasuk uid/hash)."""
    if method not in METHOD_IDS:
        raise ValueError(f"Method '{method}' tidak dikenal. Valid: {METHOD_IDS}")
    alpha = float(params.get("alpha", 0.05))
    if not 0 < alpha < 1:
        raise ValueError("alpha harus di antara 0 dan 1")
    from app.services.stats import descriptive, normality, correlation, ttest, anova, chi2, nonparam, regression, ml_classify, ml_cluster, text_mining, apriori

    table = {
        "descriptive": descriptive.run,
        "normality": normality.run,
        "pearson": correlation.run_pearson,
        "spearman": correlation.run_spearman,
        "ttest_1samp": ttest.run_1samp,
        "ttest_ind": ttest.run_ind,
        "ttest_paired": ttest.run_paired,
        "anova_oneway": anova.run_oneway,
        "chi2_independence": chi2.run_independence,
        "chi2_gof": chi2.run_gof,
        "mannwhitney": nonparam.run_mannwhitney,
        "wilcoxon": nonparam.run_wilcoxon,
        "kruskal": nonparam.run_kruskal,
        "linreg_simple": regression.run_simple,
        "linreg_multiple": regression.run_multiple,
        "ml_classify": ml_classify.run,
        "ml_cluster": ml_cluster.run,
        "text_tfidf": text_mining.run_tfidf,
        "text_lda": text_mining.run_lda,
        "apriori": apriori.run,
    }
    result = table[method](df, variables, alpha, params)

    # Transparansi n: banyak metode membuang baris (missing/pasangan tak lengkap)
    # secara internal, sehingga n pada tabel hasil ≠ n dataset. Kedua angka itu
    # wajib berdampingan; kalau tidak, paper menulis n=1250 sementara tabel
    # n=1187 dan pembimbing langsung bertanya. (PR-04)
    n_source = int(len(df))
    n_used = int(result.get("n", n_source)) if isinstance(result.get("n"), (int, float)) else n_source
    dropped = max(0, n_source - n_used)
    result["n_source"] = n_source
    result["n_rows_dropped"] = dropped
    if dropped > 0:
        note = (f"n analisis {n_used} dari {n_source} baris sumber "
                f"({dropped} baris tidak ikut dihitung, mis. data kosong/pasangan tak lengkap).")
        result.setdefault("notes", [])
        result["notes"].append(note)
        # kept as a warning so it surfaces at the top of the result view
        result.setdefault("warnings", [])
        if note not in result["warnings"]:
            result["warnings"].append(note)

    return result
