"""Unit test preprocessing ops (Fase 3). Deterministik, tanpa DB."""
import numpy as np
import pandas as pd
import pytest
from app.services.preprocess_service import apply_operations


def _df():
    return pd.DataFrame({
        "jk": ["L", "P", "L", None, "P"],
        "usia": [22.0, 25.0, None, 30.0, 28.0],
        "id": [1, 2, 3, 4, 5],
    })


def test_rename():
    out, det = apply_operations(_df(), [{"op": "rename", "mapping": {"jk": "gender"}}])
    assert list(out.columns) == ["gender", "usia", "id"]
    assert det[0]["mapping"] == {"jk": "gender"}


def test_rename_missing_col():
    with pytest.raises(ValueError, match="tidak ada"):
        apply_operations(_df(), [{"op": "rename", "mapping": {"zz": "a"}}])


def test_drop_columns():
    out, det = apply_operations(_df(), [{"op": "drop_columns", "columns": ["id"]}])
    assert list(out.columns) == ["jk", "usia"]
    with pytest.raises(ValueError, match="semua kolom"):
        apply_operations(_df(), [{"op": "drop_columns", "columns": ["jk", "usia", "id"]}])


def test_fill_median_and_drop():
    out, _ = apply_operations(_df(), [{"op": "fill_missing", "column": "usia", "strategy": "median"}])
    assert out["usia"].isna().sum() == 0
    out2, det2 = apply_operations(_df(), [{"op": "drop_missing", "columns": ["jk"]}])
    assert det2[0]["removed"] == 1 and len(out2) == 4


def test_outlier_and_scale_chain():
    df = pd.DataFrame({"x": [1.0, 2.0, 3.0, 4.0, 100.0]})
    out, det = apply_operations(df, [{"op": "remove_outlier_iqr", "column": "x"}, {"op": "scale_standard", "column": "x"}])
    assert det[0]["removed"] == 1
    assert abs(out["x"].mean()) < 1e-9


def test_unknown_op():
    with pytest.raises(ValueError, match="tidak dikenal"):
        apply_operations(_df(), [{"op": "teleport"}])
