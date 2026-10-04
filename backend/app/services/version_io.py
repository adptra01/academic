"""Helper: muat DataFrame untuk version berapa pun. v1 → file asli; vN+ → CSV hasil transformasi."""
from __future__ import annotations
import pandas as pd
from app.models import Dataset, DatasetVersion
from app.services.dataset_service import read_dataset


def load_version_df(ds: Dataset, version: DatasetVersion) -> pd.DataFrame:
    if version.version_number == 1 or not version.storage_path:
        return read_dataset(ds.storage_path, ds.file_type)
    # file versi tersimpan sebagai CSV utf-8
    return pd.read_csv(version.storage_path, encoding="utf-8")
