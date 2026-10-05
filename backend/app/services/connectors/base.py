"""Data Source abstraction (Fase 12-13).
Semua sumber (Upload/API/OAuth/Scraper) bermuara ke mekanisme yang sama:
Raw Dataset → Immutable Dataset Version → Preprocessing → Analysis.
Setiap fetch WAJIB menghasilkan provenance (source, retrieved_at, query/config
yang sudah disanitasi, raw_hash, record_count).
"""
from __future__ import annotations
import hashlib
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone


SECRET_KEYS = ("token", "access_token", "refresh_token", "api_key", "apikey", "secret", "password", "authorization", "client_secret")


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def raw_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sanitize_config(config: dict) -> dict:
    """Hapus secret dari config sebelum disimpan/dilog."""
    clean: dict = {}
    for k, v in config.items():
        if k.lower() in SECRET_KEYS or any(s in k.lower() for s in ("token", "secret", "password", "key")):
            clean[k] = "***redacted***"
        elif isinstance(v, dict):
            clean[k] = sanitize_config(v)
        else:
            clean[k] = v
    return clean


@dataclass
class FetchResult:
    records: list[dict]
    provenance: dict = field(default_factory=dict)


class DataConnector(ABC):
    """Interface yang wajib diimplementasikan setiap connector baru:
    1. subclass DataConnector, 2. set `kind`+`provider`, 3. implementasikan
    authenticate/fetch/normalize/metadata, 4. daftarkan di REGISTRY.
    """

    kind: str = "api"
    provider: str = "generic"

    @abstractmethod
    def authenticate(self, config: dict) -> dict:
        """Validasi kredensial/config. Kembalikan headers/context aman (tanpa secret)."""

    @abstractmethod
    def fetch(self, config: dict) -> FetchResult:
        """Ambil raw data + provenance. Terapkan timeout/retry/rate-limit di sini."""

    def normalize(self, raw: list[dict], mapping: dict | None = None) -> list[dict]:
        """Petakan raw records ke kolom dataset. mapping: {kolom_tujuan: path.bertitik}."""
        if not mapping:
            if raw and isinstance(raw[0], dict):
                cols = sorted({k for r in raw for k in r})
                return [{c: r.get(c) for c in cols} for r in raw]
            raise ValueError("Record mentah bukan objek — wajib berikan 'mapping'")
        out = []
        for r in raw:
            row = {}
            for dest, path in mapping.items():
                cur: object = r
                for part in str(path).split("."):
                    cur = cur.get(part) if isinstance(cur, dict) else None
                    if cur is None:
                        break
                row[dest] = cur
            out.append(row)
        return out

    def metadata(self) -> dict:
        return {"kind": self.kind, "provider": self.provider}


REGISTRY: dict[str, type[DataConnector]] = {}


def register(cls: type[DataConnector]) -> type[DataConnector]:
    REGISTRY[f"{cls.kind}:{cls.provider}"] = cls
    return cls


def get_connector(kind: str, provider: str) -> DataConnector:
    key = f"{kind}:{provider}"
    if key not in REGISTRY:
        raise ValueError(f"Connector '{key}' tidak dikenal. Tersedia: {sorted(REGISTRY)}")
    return REGISTRY[key]()
