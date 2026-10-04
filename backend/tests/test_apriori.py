"""Apriori regression tests (feature/apriori). Expected dihitung manual.
Fixture: T1:A,B,C T2:A,B T3:A,C T4:B,C T5:A,B,C
support{A,B}=0.6, conf A→B=0.75, lift=0.75/0.8=0.9375.
Bukan bagian RC1 freeze.
"""
import pandas as pd
import pytest
from app.services.stats import run_analysis


def _basket_df():
    return pd.DataFrame({
        "A": [1, 1, 1, 0, 1],
        "B": [1, 1, 0, 1, 1],
        "C": [1, 0, 1, 1, 1],
    })


def test_apriori_rules():
    r = run_analysis(_basket_df(), "apriori", {"columns": ["A", "B", "C"]}, {"min_support": 0.4, "min_confidence": 0.6, "min_lift": 0.9})
    s = r["statistics"]
    assert s["rule_count"] == 6
    assert s["n_transactions"] == 5
    ab = next(x for x in s["rules"] if x["antecedent"] == ["A"] and x["consequent"] == ["B"])
    assert abs(ab["support"] - 0.6) < 1e-9
    assert abs(ab["confidence"] - 0.75) < 1e-9
    assert abs(ab["lift"] - 0.9375) < 1e-9


def test_apriori_strict_filter_warns():
    r = run_analysis(_basket_df(), "apriori", {"columns": ["A", "B", "C"]}, {"min_support": 0.9, "min_confidence": 0.99})
    assert r["statistics"]["rule_count"] == 0
    assert any("Tidak ada rule" in w for w in r["warnings"])


def test_apriori_bad_params():
    with pytest.raises(ValueError, match="min_support"):
        run_analysis(_basket_df(), "apriori", {"columns": ["A"]}, {"min_support": 1.5})
    with pytest.raises(ValueError, match="columns"):
        run_analysis(_basket_df(), "apriori", {}, {})
