"""Manifest versi dataset (spek Tahap 4): setiap versi immutable membawa hash
konten kanonis + versi skema/kolektor/normalisasi + hitungan + laporan validasi.
Hash = sha256 dari bytes CSV kanonis (utf-8, tanpa index) yang disimpan.
"""
from __future__ import annotations
import hashlib

SCHEMA_VERSION = "1.0"
NORMALIZATION_VERSION = "1.0"


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validation_summary(profile: dict) -> dict:
    cols = profile.get("columns") or []
    worst = sorted(cols, key=lambda c: c.get("missing_pct", 0), reverse=True)[:3]
    return {
        "rows": profile.get("rows"),
        "cols": profile.get("cols"),
        "missing_pct": profile.get("missing_pct"),
        "duplicate_rows": profile.get("duplicate_rows"),
        "worst_missing": [{"name": c.get("name"), "missing_pct": c.get("missing_pct")} for c in worst],
    }


def version_manifest(content: bytes, profile: dict, collector: str | None = None) -> dict:
    """Bangun field manifest untuk DatasetVersion(**manifest)."""
    return {
        "content_hash": content_hash(content),
        "schema_version": SCHEMA_VERSION,
        "collector_version": collector,
        "normalization_version": NORMALIZATION_VERSION,
        "record_count": profile.get("rows"),
        "validation_report": validation_summary(profile),
    }
