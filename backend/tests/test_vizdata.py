"""vizdata tests (feature/echarts). Lapisan visual saja — deterministik, tanpa engine.
Bukan bagian RC1 freeze.
"""
import pandas as pd
from app.services import vizdata


def _df():
    return pd.DataFrame({"x": [1, 2, 3, 4, 5, 6, 7, 8], "y": [2, 4, 5, 4, 6, 7, 8, 9], "g": ["a", "a", "b", "b", "a", "a", "b", "b"]})


def test_histogram_bins():
    out = vizdata.build(_df(), "descriptive", {"columns": ["x", "y"]}, {"method": "descriptive"}, 1, "histogram", "U1")
    assert out["type"] == "histogram"
    assert sum(out["data"]["counts"]) == 8
    assert out["metadata"] == {"analysis_uid": "U1", "dataset_version": 1, "method": "descriptive"}


def test_boxplot_groups():
    out = vizdata.build(_df(), "ttest_ind", {"column": "x", "group": "g"}, {"method": "ttest_ind"}, 2, "boxplot", "U2")
    assert [g["name"] for g in out["data"]["groups"]] == ["a", "b"]
    assert len(out["data"]["groups"][0]["stats"]) == 5


def test_scatter_trend_from_result():
    res = {"method": "linreg_simple", "statistics": {"coefs": [{"term": "const", "coef": 1.0}, {"term": "x", "coef": 2.0}]}}
    out = vizdata.build(_df(), "linreg_simple", {"x": "x", "y": "y"}, res, 1, "scatter", "U3")
    assert len(out["data"]["points"]) == 8
    assert out["data"]["trend"] == {"a": 1.0, "b": 2.0, "line": [[1.0, 3.0], [8.0, 17.0]]}


def test_bar_contingency():
    res = {"method": "chi2_independence", "statistics": {"contingency": {"ya": {"l": 30, "p": 20}, "tidak": {"l": 10, "p": 40}}}}
    out = vizdata.build(_df(), "chi2_independence", {"col1": "a", "col2": "b"}, res, 1, "bar", "U4")
    assert out["data"]["categories"] == ["l", "p"]
    assert out["data"]["series"][0] == {"name": "tidak", "values": [10, 40]}


def test_passthrough_confusion_roc():
    res = {
        "method": "ml_classify",
        "statistics": {"confusion_matrix": [[2, 0], [1, 3]], "classes": ["neg", "pos"]},
        "visualization": {"roc": {"mode": "binary", "fpr": [0, 0.5, 1], "tpr": [0, 0.8, 1]}},
    }
    c = vizdata.build(_df(), "ml_classify", {}, res, 1, "confusion", "U5")
    assert c["data"]["matrix"] == [[2, 0], [1, 3]]
    r = vizdata.build(_df(), "ml_classify", {}, res, 1, "roc", "U5")
    assert r["data"]["tpr"] == [0, 0.8, 1]


def test_unknown_type_and_missing():
    import pytest

    with pytest.raises(ValueError, match="viz type"):
        vizdata.build(_df(), "pearson", {"x": "x", "y": "y"}, {"method": "pearson"}, 1, "pie3d", "U6")
    with pytest.raises(ValueError, match="tidak tersedia"):
        vizdata.build(_df(), "ml_classify", {}, {"method": "ml_classify", "statistics": {}}, 1, "roc", "U6")
