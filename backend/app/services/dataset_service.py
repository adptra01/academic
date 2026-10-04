"""Dataset parsing + profiling. Pandas/NumPy saja (Fase 2). Statistik inferensial = Fase 5, DILARANG di sini."""
from __future__ import annotations
import io
from pathlib import Path
import numpy as np
import pandas as pd

ALLOWED_EXTS = {"csv", "xlsx", "xls", "sav", "json"}


def read_dataset(storage_path: str, file_type: str) -> pd.DataFrame:
    p = Path(storage_path)
    ft = file_type.lower()
    if ft == "csv":
        # coba utf-8, fallback latin-1; separator auto-detect via python engine
        try:
            return pd.read_csv(p, encoding="utf-8")
        except UnicodeDecodeError:
            return pd.read_csv(p, encoding="latin-1")
    if ft in ("xlsx", "xls"):
        engine = "openpyxl" if ft == "xlsx" else "xlrd"
        return pd.read_excel(p, engine=engine)
    if ft == "sav":
        import pyreadstat  # SPSS .sav

        df, _meta = pyreadstat.read_sav(str(p))
        return df
    if ft == "json":
        try:
            return pd.read_json(p, orient="records")
        except ValueError:
            return pd.read_json(p)
    raise ValueError(f"Unsupported file_type: {file_type}")


def suggest_type(series: pd.Series) -> str:
    """Auto-suggest var_type: Numerical | Binary | Datetime | ID | Nominal | Text."""
    name = str(series.name or "")
    if pd.api.types.is_bool_dtype(series.dtype):
        return "Binary"
    if pd.api.types.is_datetime64_any_dtype(series.dtype):
        return "Datetime"
    if pd.api.types.is_numeric_dtype(series.dtype):
        try:
            nunique = int(series.nunique(dropna=True))
        except Exception:
            nunique = -1
        if nunique == 2:
            return "Binary"
        return "Numerical"
    # object / string / category
    try:
        n = len(series)
        nunique = int(series.nunique(dropna=True))
    except Exception:
        return "Text"
    if nunique == 2:
        return "Binary"
    if "id" in name.lower() and nunique == n and n > 0:
        return "ID"
    if nunique <= 20:
        return "Nominal"
    # teks panjang → Text
    try:
        avg_len = series.dropna().astype(str).str.len().mean()
        if avg_len is not None and float(avg_len) > 50:
            return "Text"
    except Exception:
        pass
    if nunique > 100:
        return "Text"
    return "Nominal"


def profile_dataframe(df: pd.DataFrame) -> dict:
    n_rows, n_cols = int(df.shape[0]), int(df.shape[1])
    total_cells = n_rows * n_cols
    missing_total = int(df.isna().sum().sum()) if total_cells else 0
    missing_pct = round(missing_total / total_cells * 100, 2) if total_cells else 0.0
    try:
        dup_rows = int(df.duplicated().sum())
    except Exception:
        dup_rows = 0
    columns: list[dict] = []
    for col in df.columns:
        s = df[col]
        missing = int(s.isna().sum())
        try:
            nunique = int(s.nunique(dropna=True))
        except Exception:
            nunique = 0
        dtype = str(s.dtype)
        col_info: dict = {
            "name": str(col),
            "dtype": dtype,
            "detected_type": suggest_type(s),
            "missing_count": missing,
            "missing_pct": round(missing / n_rows * 100, 2) if n_rows else 0.0,
            "unique_count": nunique,
        }
        if pd.api.types.is_numeric_dtype(s.dtype):
            desc = s.describe()
            col_info["stats"] = {
                "mean": _num(desc.get("mean")),
                "std": _num(desc.get("std")),
                "min": _num(desc.get("min")),
                "max": _num(desc.get("max")),
            }
        columns.append(col_info)
    return {
        "rows": n_rows,
        "cols": n_cols,
        "missing_total": missing_total,
        "missing_pct": missing_pct,
        "duplicate_rows": dup_rows,
        "columns": columns,
    }


def _num(v) -> float | None:
    try:
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return float(v)
    except Exception:
        return None


def preview_rows(df: pd.DataFrame, limit: int = 20, offset: int = 0) -> dict:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    sub = df.iloc[offset : offset + limit]
    # NaN → None agar JSON valid
    rows = sub.replace({np.nan: None}).to_dict(orient="records")
    return {"limit": limit, "offset": offset, "total_rows": int(len(df)), "rows": rows}
