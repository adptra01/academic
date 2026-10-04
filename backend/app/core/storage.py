"""Storage lokal (DDEV dev). Prod VPS pakai S3 — lihat compose.yml. Interface disamakan: save_upload() → storage_path."""
import os
import uuid
from pathlib import Path

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "/code/storage"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(project_id: str, original_filename: str, content: bytes) -> str:
    """Simpan file upload ke STORAGE_DIR/projects/<pid>/<uuid>_<safe>. Kembalikan storage_path absolut."""
    safe = "".join(c if c.isalnum() or c in ("-", "_", ".") else "_" for c in original_filename)[:120]
    dest_dir = STORAGE_DIR / "projects" / project_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{uuid.uuid4().hex}_{safe}"
    dest.write_bytes(content)
    return str(dest)


def read_bytes(storage_path: str) -> bytes:
    return Path(storage_path).read_bytes()
