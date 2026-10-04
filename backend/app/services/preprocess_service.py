"""Preprocessing ops — deterministik, Pandas/sklearn-rumus saja. Setiap op: (df_baru, detail)."""
from __future__ import annotations
import re
import numpy as np
import pandas as pd

VALID_OPS = {
    "drop_missing", "fill_missing", "remove_outlier_iqr",
    "scale_standard", "scale_minmax", "transform_log", "transform_sqrt",
    "mapping", "onehot", "rename", "drop_columns",
    "text_lowercase", "text_remove_punct", "text_remove_stopwords",
    "remove_duplicates",
}

STOP_ID = {"dan", "atau", "yang", "di", "ke", "dari", "ini", "itu", "dengan", "untuk", "pada", "adalah", "sebagai", "tidak", "ada", "saya", "kami", "mereka", "akan", "telah", "sudah", "juga", "sangat", "lebih", "kurang", "dalam", "oleh", "karena", "jika", "saat", "serta", "dapat", "bisa"}
STOP_EN = {"the", "and", "or", "of", "to", "in", "is", "it", "with", "for", "on", "are", "was", "were", "this", "that", "a", "an", "as", "by", "at", "from", "be", "have", "has", "i", "you", "we", "they", "will", "very", "more", "not", "no"}


def _need_col(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada. Kolom tersedia: {list(df.columns)}")
    return df[col]


def apply_operations(df: pd.DataFrame, operations: list[dict]) -> tuple[pd.DataFrame, list[dict]]:
    out = df.copy()
    details: list[dict] = []
    for i, op_spec in enumerate(operations):
        op = op_spec.get("op")
        if op not in VALID_OPS:
            raise ValueError(f"Op ke-{i + 1} tidak dikenal: '{op}'. Valid: {sorted(VALID_OPS)}")
        fn = _OPS[op]
        out, detail = fn(out, op_spec)
        detail["order"] = i + 1
        details.append(detail)
    return out, details


def _op_drop_missing(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    cols = spec.get("columns")
    before = len(df)
    if cols:
        for c in cols:
            _need_col(df, c)
        out = df.dropna(subset=cols)
    else:
        out = df.dropna()
    return out, {"op": "drop_missing", "columns": cols, "rows_before": before, "rows_after": len(out), "removed": before - len(out)}


def _op_fill_missing(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("fill_missing butuh 'column'")
    s = _need_col(df, col)
    strategy = spec.get("strategy", "mean")
    missing_before = int(s.isna().sum())
    out = df.copy()
    if strategy == "mean":
        if not pd.api.types.is_numeric_dtype(s.dtype):
            raise ValueError(f"fill_missing mean hanya untuk numerik (kolom '{col}' bertipe {s.dtype})")
        out[col] = s.fillna(float(s.mean()))
    elif strategy == "median":
        if not pd.api.types.is_numeric_dtype(s.dtype):
            raise ValueError(f"fill_missing median hanya untuk numerik (kolom '{col}')")
        out[col] = s.fillna(float(s.median()))
    elif strategy == "mode":
        m = s.mode(dropna=True)
        if len(m) == 0:
            raise ValueError(f"Tidak ada modus untuk kolom '{col}' (semua missing)")
        out[col] = s.fillna(m.iloc[0])
    elif strategy == "constant":
        if "value" not in spec:
            raise ValueError("fill_missing constant butuh 'value'")
        out[col] = s.fillna(spec["value"])
    else:
        raise ValueError(f"strategy '{strategy}' tidak dikenal (mean|median|mode|constant)")
    return out, {"op": "fill_missing", "column": col, "strategy": strategy, "filled": missing_before - int(out[col].isna().sum())}


def _op_remove_outlier_iqr(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("remove_outlier_iqr butuh 'column'")
    s = _need_col(df, col)
    if not pd.api.types.is_numeric_dtype(s.dtype):
        raise ValueError(f"remove_outlier_iqr hanya untuk numerik (kolom '{col}')")
    k = float(spec.get("factor", 1.5))
    q1, q3 = float(s.quantile(0.25)), float(s.quantile(0.75))
    iqr = q3 - q1
    lo, hi = q1 - k * iqr, q3 + k * iqr
    before = len(df)
    out = df[(s >= lo) & (s <= hi) | s.isna()].copy()
    return out, {"op": "remove_outlier_iqr", "column": col, "factor": k, "q1": q1, "q3": q3, "iqr": iqr, "lower": lo, "upper": hi, "rows_before": before, "rows_after": len(out), "removed": before - len(out)}


def _op_scale_standard(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("scale_standard butuh 'column'")
    s = _need_col(df, col)
    if not pd.api.types.is_numeric_dtype(s.dtype):
        raise ValueError(f"scale_standard hanya untuk numerik (kolom '{col}')")
    mean, std = float(s.mean()), float(s.std(ddof=0))
    if std == 0 or np.isnan(std):
        raise ValueError(f"Kolom '{col}' memiliki std=0, tidak dapat di-standard-scaling")
    out = df.copy()
    out[col] = (s - mean) / std
    return out, {"op": "scale_standard", "column": col, "mean": mean, "std_pop": std, "formula": f"z = (x - {mean:.6g}) / {std:.6g}"}


def _op_scale_minmax(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("scale_minmax butuh 'column'")
    s = _need_col(df, col)
    if not pd.api.types.is_numeric_dtype(s.dtype):
        raise ValueError(f"scale_minmax hanya untuk numerik (kolom '{col}')")
    mn, mx = float(s.min()), float(s.max())
    if mx == mn:
        raise ValueError(f"Kolom '{col}' min=max, tidak dapat di-minmax-scaling")
    out = df.copy()
    out[col] = (s - mn) / (mx - mn)
    return out, {"op": "scale_minmax", "column": col, "min": mn, "max": mx, "formula": f"x' = (x - {mn:.6g}) / ({mx:.6g} - {mn:.6g})"}


def _op_transform_log(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("transform_log butuh 'column'")
    s = _need_col(df, col)
    if not pd.api.types.is_numeric_dtype(s.dtype):
        raise ValueError(f"transform_log hanya untuk numerik (kolom '{col}')")
    bad = int(((s <= 0) & s.notna()).sum())
    if bad:
        raise ValueError(f"Kolom '{col}' mengandung {bad} nilai <= 0 — log natural tidak valid. Bersihkan dulu atau pakai transformasi lain.")
    out = df.copy()
    out[col] = np.log(s)
    return out, {"op": "transform_log", "column": col, "formula": "x' = ln(x)"}


def _op_transform_sqrt(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("transform_sqrt butuh 'column'")
    s = _need_col(df, col)
    if not pd.api.types.is_numeric_dtype(s.dtype):
        raise ValueError(f"transform_sqrt hanya untuk numerik (kolom '{col}')")
    bad = int(((s < 0) & s.notna()).sum())
    if bad:
        raise ValueError(f"Kolom '{col}' mengandung {bad} nilai negatif — sqrt tidak valid.")
    out = df.copy()
    out[col] = np.sqrt(s)
    return out, {"op": "transform_sqrt", "column": col, "formula": "x' = sqrt(x)"}


def _op_mapping(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    mapping = spec.get("mapping")
    if not col or not isinstance(mapping, dict) or not mapping:
        raise ValueError("mapping butuh 'column' dan 'mapping' dict tidak kosong, mis. {'L':'Laki-laki','P':'Perempuan'}")
    _need_col(df, col)
    out = df.copy()
    out[col] = out[col].replace(mapping)
    return out, {"op": "mapping", "column": col, "mapping": mapping}


def _op_onehot(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("onehot butuh 'column'")
    _need_col(df, col)
    drop_original = bool(spec.get("drop_original", True))
    prefix = spec.get("prefix") or col
    dummies = pd.get_dummies(df[col], prefix=prefix, dummy_na=False).astype(int)
    new_cols = list(dummies.columns)
    out = pd.concat([df, dummies], axis=1)
    if drop_original:
        out = out.drop(columns=[col])
    return out, {"op": "onehot", "column": col, "new_columns": new_cols, "drop_original": drop_original}


def _op_text_lowercase(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("text_lowercase butuh 'column'")
    _need_col(df, col)
    out = df.copy()
    out[col] = out[col].astype(object).where(out[col].isna(), out[col].astype(str).str.lower())
    return out, {"op": "text_lowercase", "column": col}


def _op_text_remove_punct(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("text_remove_punct butuh 'column'")
    _need_col(df, col)
    out = df.copy()
    out[col] = out[col].astype(object).where(out[col].isna(), out[col].astype(str).str.replace(r"[^\w\s]", "", regex=True).str.replace(r"\s+", " ", regex=True).str.strip())
    return out, {"op": "text_remove_punct", "column": col}


def _op_text_remove_stopwords(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    col = spec.get("column")
    if not col:
        raise ValueError("text_remove_stopwords butuh 'column'")
    _need_col(df, col)
    lang = str(spec.get("lang", "both")).lower()
    stop: set[str] = set()
    if lang in ("id", "both"):
        stop |= STOP_ID
    if lang in ("en", "both"):
        stop |= STOP_EN
    if lang not in ("id", "en", "both"):
        raise ValueError("lang harus id|en|both")
    out = df.copy()

    def _clean(v) -> object:
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return v
        toks = str(v).split()
        kept = [t for t in toks if t.lower() not in stop]
        return " ".join(kept)

    out[col] = out[col].map(_clean)
    return out, {"op": "text_remove_stopwords", "column": col, "lang": lang, "stopwords_used": len(stop)}


def _op_rename(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    mapping = spec.get("mapping")
    if not isinstance(mapping, dict) or not mapping:
        raise ValueError("rename butuh 'mapping' dict tidak kosong, mis. {'jk': 'gender'}")
    for old in mapping:
        if old not in df.columns:
            raise ValueError(f"Kolom '{old}' tidak ada. Tersedia: {list(df.columns)}")
    for new in mapping.values():
        if not isinstance(new, str) or not new.strip():
            raise ValueError("Nama baru harus string tidak kosong")
        if new in df.columns and new not in mapping:
            raise ValueError(f"Nama '{new}' sudah dipakai kolom lain")
    out = df.rename(columns=mapping)
    return out, {"op": "rename", "mapping": mapping}


def _op_drop_columns(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    cols = spec.get("columns")
    if not cols or not isinstance(cols, list):
        raise ValueError("drop_columns butuh 'columns' (list), mis. {'columns': ['id']}")
    for c in cols:
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada. Tersedia: {list(df.columns)}")
    if len(cols) >= len(df.columns):
        raise ValueError("Tidak boleh menghapus semua kolom")
    out = df.drop(columns=cols)
    return out, {"op": "drop_columns", "columns": cols}


def _op_remove_duplicates(df: pd.DataFrame, spec: dict) -> tuple[pd.DataFrame, dict]:
    cols = spec.get("columns")  # opsional subset
    before = len(df)
    out = df.drop_duplicates(subset=cols) if cols else df.drop_duplicates()
    return out, {"op": "remove_duplicates", "columns": cols, "rows_before": before, "rows_after": len(out), "removed": before - len(out)}


_OPS = {
    "drop_missing": _op_drop_missing,
    "fill_missing": _op_fill_missing,
    "remove_outlier_iqr": _op_remove_outlier_iqr,
    "scale_standard": _op_scale_standard,
    "scale_minmax": _op_scale_minmax,
    "transform_log": _op_transform_log,
    "transform_sqrt": _op_transform_sqrt,
    "mapping": _op_mapping,
    "onehot": _op_onehot,
    "rename": _op_rename,
    "drop_columns": _op_drop_columns,
    "text_lowercase": _op_text_lowercase,
    "text_remove_punct": _op_text_remove_punct,
    "text_remove_stopwords": _op_text_remove_stopwords,
    "remove_duplicates": _op_remove_duplicates,
}

# re-export agar tidak unused
_ = re.compile
