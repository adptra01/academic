"""ML Fase 8 regression tests (feature/ml-v8). Nilai expected dari engine deterministik
(random_state=42); cross-check manual vs sklearn langsung saat review.
Bukan bagian RC1 freeze (lihat CHANGELOG scope unfreeze).
"""
import pandas as pd
from app.services.stats import run_analysis


def _clf_df():
    return pd.DataFrame({
        "x1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        "x2": [2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19],
        "y": (["neg"] * 8 + ["pos"] * 12),
    })


def test_ml_classify_logreg():
    r = run_analysis(_clf_df(), "ml_classify", {"features": ["x1", "x2"], "target": "y", "algorithm": "logistic_regression"}, {})
    s = r["statistics"]
    assert s["accuracy"] == 1.0 and s["f1_macro"] == 1.0
    assert s["confusion_matrix"] == [[2, 0], [0, 3]]
    assert abs(s["cv_accuracy_mean"] - 0.9) < 1e-9
    assert s["model_params"]["random_state"] == 42
    assert r["visualization"]["roc"]["mode"] == "binary"


def test_ml_classify_all_algorithms_run():
    for algo in ["naive_bayes", "decision_tree", "random_forest", "svm"]:
        r = run_analysis(_clf_df(), "ml_classify", {"features": ["x1", "x2"], "target": "y", "algorithm": algo}, {})
        assert 0.0 <= r["statistics"]["accuracy"] <= 1.0
    r = run_analysis(_clf_df(), "ml_classify", {"features": ["x1", "x2"], "target": "y", "algorithm": "random_forest"}, {})
    assert set(r["statistics"]["feature_importances"].keys()) == {"x1", "x2"}


def test_ml_classify_bad_algorithm():
    import pytest

    with pytest.raises(ValueError, match="algorithm harus"):
        run_analysis(_clf_df(), "ml_classify", {"features": ["x1"], "target": "y", "algorithm": "gpt"}, {})


def _blob_df():
    import numpy as np

    rng = np.random.RandomState(0)
    X = np.vstack([rng.randn(10, 2) + [0, 0], rng.randn(10, 2) + [5, 5], rng.randn(10, 2) + [0, 5]])
    return pd.DataFrame(X, columns=["a", "b"])


def test_ml_cluster_kmeans():
    r = run_analysis(_blob_df(), "ml_cluster", {"features": ["a", "b"], "algorithm": "kmeans", "n_clusters": 3}, {})
    s = r["statistics"]
    assert s["sizes"] == {"0": 10, "1": 10, "2": 10} or sorted(s["sizes"].values()) == [10, 10, 10]
    assert abs(s["silhouette"] - 0.6603746698450372) < 1e-9
    assert abs(s["inertia"] - 52.5052) < 1e-3
    assert r["visualization"]["scatter2d"]["x_feature"] == "a"


def test_ml_cluster_hierarchical():
    r = run_analysis(_blob_df(), "ml_cluster", {"features": ["a", "b"], "algorithm": "hierarchical", "n_clusters": 3}, {})
    assert sorted(r["statistics"]["sizes"].values()) == [10, 10, 10]
    assert abs(r["statistics"]["silhouette"] - 0.6603746698450372) < 1e-9


def _text_df():
    docs = (["pelayanan sangat baik dan memuaskan"] * 8 + ["barang bagus harga murah meriah"] * 8 + ["pengiriman cepat sampai tepat waktu"] * 8)
    return pd.DataFrame({"teks": docs})


def test_text_tfidf():
    r = run_analysis(_text_df(), "text_tfidf", {"column": "teks"}, {})
    s = r["statistics"]
    assert s["vocab_size"] == 23 and s["matrix_shape"] == [24, 23]
    assert s["top_terms"][0]["term"] == "baik"


def test_text_lda():
    r = run_analysis(_text_df(), "text_lda", {"column": "teks", "n_topics": 3}, {})
    assert len(r["statistics"]["topics"]) == 3
    assert abs(r["statistics"]["perplexity_bound"] - 14.465707199452714) < 1e-6
