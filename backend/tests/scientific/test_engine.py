"""Numerical validation Fase 5 (gate rilis, US-022/FR-25).
Nilai expected di bawah dihitung independen via SciPy 1.14/Statsmodels 0.14
dan HARUS dicocokkan ulang dengan R/SPSS sebelum Beta (lihat docs/scientific-spec).
Toleransi: 1e-6 (effect size 1e-4). CI pipeline gagal jika ada FAIL.
"""
import math
import pandas as pd
from app.services.stats import run_analysis

TOL = 1e-6


def _close(a, b, tol=TOL):
    assert abs(a - b) <= tol * max(1.0, abs(b)), f"{a} != {b}"


def test_descriptive_mean_var():
    df = pd.DataFrame({"v": [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]})
    r = run_analysis(df, "descriptive", {"columns": ["v"]}, {})
    s = r["statistics"]["v"]
    _close(s["mean"], 5.0)
    _close(s["variance"], 4.571428571428571)


def test_normality_shapiro():
    df = pd.DataFrame({"v": [5.1, 4.9, 5.0, 5.2, 4.8, 5.1, 5.0, 4.9]})
    r = run_analysis(df, "normality", {"column": "v"}, {})
    _close(r["statistics"]["statistic"], 0.965072856890031)
    assert r["statistics"]["normal"] is True


def test_pearson():
    df = pd.DataFrame({"x": [1, 2, 3, 4, 5, 6, 7, 8], "y": [2, 4, 5, 4, 6, 7, 8, 9]})
    r = run_analysis(df, "pearson", {"x": "x", "y": "y"}, {})
    _close(r["statistics"]["r"], 0.9652943485372385)
    assert r["decision"]["reject_h0"] is True


def test_spearman():
    df = pd.DataFrame({"x": [1, 2, 3, 4, 5, 6, 7, 8], "y": [2, 4, 5, 4, 6, 7, 8, 9]})
    r = run_analysis(df, "spearman", {"x": "x", "y": "y"}, {})
    _close(r["statistics"]["rho"], 0.9581010095306072)


def test_ttest_1samp():
    df = pd.DataFrame({"v": [22, 25, 30, 28, 35, 40, 23, 31, 29, 27]})
    r = run_analysis(df, "ttest_1samp", {"column": "v", "mu": 30}, {})
    _close(r["statistics"]["t"], -0.5795005569646918)
    assert r["decision"]["reject_h0"] is False


def test_ttest_ind_welch_path():
    # Levene p=0.037 < 0.05 → engine wajib pakai Welch
    a = [23, 25, 28, 30, 32, 29, 27, 26, 31, 24]
    b = [20, 22, 21, 19, 23, 18, 22, 20, 21, 19]
    df = pd.DataFrame({"v": a + b, "g": ["A"] * 10 + ["B"] * 10})
    r = run_analysis(df, "ttest_ind", {"column": "v", "group": "g"}, {})
    assert r["statistics"]["variant"] == "Welch"
    _close(r["statistics"]["t"], 6.4807406984078595)
    assert r["decision"]["reject_h0"] is True


def test_ttest_paired():
    df = pd.DataFrame({"pre": [10, 12, 14, 11, 13], "post": [12, 14, 15, 13, 15]})
    r = run_analysis(df, "ttest_paired", {"col1": "pre", "col2": "post"}, {})
    _close(r["statistics"]["t"], -9.0)


def test_anova_oneway():
    df = pd.DataFrame({
        "v": [6, 7, 8, 7, 6, 9, 10, 11, 9, 10, 4, 5, 4, 6, 5],
        "g": ["a"] * 5 + ["b"] * 5 + ["c"] * 5,
    })
    r = run_analysis(df, "anova_oneway", {"column": "v", "group": "g"}, {})
    _close(r["statistics"]["f"], 45.23809523809525)
    assert r["statistics"]["posthoc"] is not None  # signifikan → Tukey wajib ada


def test_chi2_independence():
    rows = (["ya"] * 30 + ["tidak"] * 20) + (["ya"] * 10 + ["tidak"] * 40)
    cols = (["l"] * 50) + (["p"] * 50)
    df = pd.DataFrame({"c1": rows, "c2": cols})
    r = run_analysis(df, "chi2_independence", {"col1": "c1", "col2": "c2"}, {})
    _close(r["statistics"]["chi2"], 15.041666666666668)


def test_mannwhitney():
    a = [23, 25, 28, 30, 32, 29, 27, 26, 31, 24]
    b = [20, 22, 21, 19, 23, 18, 22, 20, 21, 19]
    df = pd.DataFrame({"v": a + b, "g": ["A"] * 10 + ["B"] * 10})
    r = run_analysis(df, "mannwhitney", {"column": "v", "group": "g"}, {})
    _close(r["statistics"]["u"], 99.5)


def test_wilcoxon():
    df = pd.DataFrame({"pre": [10, 12, 14, 11, 13], "post": [12, 14, 15, 13, 15]})
    r = run_analysis(df, "wilcoxon", {"col1": "pre", "col2": "post"}, {})
    _close(r["statistics"]["w"], 0.0)


def test_kruskal():
    df = pd.DataFrame({
        "v": [6, 7, 8, 7, 6, 9, 10, 11, 9, 10, 4, 5, 4, 6, 5],
        "g": ["a"] * 5 + ["b"] * 5 + ["c"] * 5,
    })
    r = run_analysis(df, "kruskal", {"column": "v", "group": "g"}, {})
    _close(r["statistics"]["h"], 12.21633393829402)
    assert r["statistics"]["posthoc"] is not None


def test_linreg_simple():
    df = pd.DataFrame({"x": [1, 2, 3, 4, 5], "y": [2.1, 4.0, 6.2, 7.9, 10.1]})
    r = run_analysis(df, "linreg_simple", {"x": "x", "y": "y"}, {})
    _close(r["statistics"]["r_squared"], 0.9987138101482901)
    slope = next(c for c in r["statistics"]["coefs"] if c["term"] == "x")
    _close(slope["coef"], 1.99)


def test_linreg_multiple_runs():
    df = pd.DataFrame({
        "x1": [1, 2, 3, 4, 5, 6, 7, 8],
        "x2": [2, 1, 4, 3, 6, 5, 8, 7],
        "y": [3, 4, 7, 8, 11, 12, 15, 16],
    })
    r = run_analysis(df, "linreg_multiple", {"xs": ["x1", "x2"], "y": "y"}, {})
    assert r["statistics"]["r_squared"] > 0.99
    assert "vif" in r["statistics"]


def test_two_groups_rejected_for_anova():
    df = pd.DataFrame({"v": [1, 2, 3, 4], "g": ["a", "a", "b", "b"]})
    try:
        run_analysis(df, "anova_oneway", {"column": "v", "group": "g"}, {})
    except ValueError as e:
        assert "≥3" in str(e)
    else:
        raise AssertionError("ANOVA dengan 2 grup harus ditolak")


def test_auto_assumptions_ttest_ind():
    import pandas as pd
    from app.services.stats import run_analysis

    a = [23, 25, 28, 30, 32, 29, 27, 26, 31, 24]
    b = [20, 22, 21, 19, 23, 18, 22, 20, 21, 19]
    df = pd.DataFrame({"v": a + b, "g": ["A"] * 10 + ["B"] * 10})
    r = run_analysis(df, "ttest_ind", {"column": "v", "group": "g"}, {})
    names = [x["name"] for x in r["assumptions"]]
    assert any("grup 'A'" in n for n in names) and any("grup 'B'" in n for n in names)
    assert all(x["passed"] is not None for x in r["assumptions"])


def test_auto_assumptions_anova():
    import pandas as pd
    from app.services.stats import run_analysis

    df = pd.DataFrame({
        "v": [6, 7, 8, 7, 6, 9, 10, 11, 9, 10, 4, 5, 4, 6, 5],
        "g": ["a"] * 5 + ["b"] * 5 + ["c"] * 5,
    })
    r = run_analysis(df, "anova_oneway", {"column": "v", "group": "g"}, {})
    assert len(r["assumptions"]) == 4  # 3 normalitas grup + Levene
    assert all(x["passed"] is not None for x in r["assumptions"])


def test_auto_assumptions_regression():
    import pandas as pd
    from app.services.stats import run_analysis

    df = pd.DataFrame({"x": [1, 2, 3, 4, 5, 6, 7, 8], "y": [2.1, 4.0, 6.2, 7.9, 10.1, 12.0, 14.2, 15.9]})
    r = run_analysis(df, "linreg_simple", {"x": "x", "y": "y"}, {})
    names = [x["name"] for x in r["assumptions"]]
    assert any("residual" in n for n in names) and any("Breusch-Pagan" in n for n in names)
