import numpy as np
import pandas as pd
from scipy import stats
from app.services.stats import run_analysis

def test_chi2_gof_engine_matches_scipy():
    # Buat data kategori: A muncul 10x, B 20x, C 30x, D 40x
    df = pd.DataFrame({"obs": ["A"]*10 + ["B"]*20 + ["C"]*30 + ["D"]*40})
    res = run_analysis(df, "chi2_gof", {"column": "obs"}, {"alpha": 0.05})
    
    # Scipy reference: observasi counts = [10, 20, 30, 40], expected uniform = [25, 25, 25, 25]
    s_chi2, s_p = stats.chisquare([10, 20, 30, 40])
    
    assert np.isclose(res["statistics"]["chi2"], s_chi2)
    assert np.isclose(res["statistics"]["p_value"], s_p)
    assert res["method"] == "chi2_gof"

def test_chi2_gof_custom_expected_proportions():
    df = pd.DataFrame({"obs": ["X"]*5 + ["Y"]*15})
    # Expected: X=0.25, Y=0.75 (bukan uniform 0.5/0.5)
    res = run_analysis(df, "chi2_gof", {"column": "obs", "expected": [0.25, 0.75]}, {"alpha": 0.05})
    
    # n=20, expected counts: [5, 15]
    s_chi2, s_p = stats.chisquare([5, 15], f_exp=[5, 15])
    
    assert np.isclose(res["statistics"]["chi2"], s_chi2)
    assert np.isclose(res["statistics"]["p_value"], s_p)
    assert res["statistics"]["df"] == 1
    assert res["parameters"]["expected_proportions"] == [0.25, 0.75]
