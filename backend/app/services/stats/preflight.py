"""Pre-flight analysis: cek syarat sebelum menjalankan analisis.

Tujuan: kesalahan konfigurasi (kolom salah, μ kosong, jumlah grup keliru)
harus muncul SEBELUM tombol "Jalankan Analisis" ditekan, dengan pesan yang
menunjuk field bermasalah dan cara memperbaikinya — bukan `422` samar yang
ditampilkan di bagian atas halaman.

Aturan keras (blocking) hanya untuk kondisi yang membuat hasil tidak
bermakna. Sisanya jadi peringatan (tidak memblokir) — convene pengguna tetap
memegang kendali atas pilihannya.

Tidak ada LLM di sini: semua pemeriksaan deterministik dari spec + data.
"""
from __future__ import annotations

import pandas as pd

# Kolom numerik yang boleh dipakai sebagai variabel analisis.
NUMERIC_HINTS = ("numerical", "numeric", "number", "int", "float", "decimal")
CATEGORICAL_HINTS = ("nominal", "ordinal", "binary", "categor")
TEXT_HINTS = ("text",)


def _is_numeric_col(s: pd.Series) -> bool:
    return bool(pd.api.types.is_numeric_dtype(s.dtype))


def _check_col_kind(df: pd.DataFrame, col: str, kind: str) -> str | None:
    """Kembalikan pesan error bila kolom tidak cocok jenisnya (atau None)."""
    s = df[col]

    if kind == "numeric" and not _is_numeric_col(s):
        return f"kolom '{col}' bukan numerik"

    if kind in ("categorical", "group") and _is_numeric_col(s):
        return f"kolom '{col}' numerik — butuh kolom kategorikal untuk pengelompokan"

    if kind == "text" and not (s.dtype == object or str(s.dtype) in ("string", "category")):
        return f"kolom '{col}' bukan teks"

    return None


def preflight(df: pd.DataFrame, spec: dict, variables: dict, params: dict | None = None) -> list[dict]:
    """Cek syarat menjalankan analisis.

   (spec: {"variables": {key: {kind,label,multi}}, "params": {...}})

    Kembalikan daftar isu. Tiap isu:
      {level: "blocking"|"warn", key, message, fix}

    - `key`   : nama field di spec (frontend bisa menandai field tsb)
    - `fix`   : saran singkat cara memperbaikinya
    """
    params = params or {}
    issues: list[dict] = []

    col_specs: dict = spec.get("variables") or {}
    param_specs: dict = spec.get("params") or {}

    # --- kolom wajib terisi & valid -------------------------------------
    for key, cs in col_specs.items():
        label = cs.get("label", key)
        raw = variables.get(key)

        if cs.get("multi"):
            chosen = [c for c in (raw or []) if c]
            if not chosen:
                issues.append({"level": "blocking", "key": key,
                               "message": f"{label}: belum ada kolom yang dipilih",
                               "fix": "pilih minimal satu kolom"})
            for c in chosen:
                if c not in df.columns:
                    issues.append({"level": "blocking", "key": key,
                                   "message": f"{label}: kolom '{c}' tidak ada di dataset ini",
                                   "fix": f"pilih kolom yang ada. tersedia: {', '.join(map(str, list(df.columns)[:6]))}…"})
                else:
                    err = _check_col_kind(df, c, cs.get("kind", "any"))
                    if err:
                        issues.append({"level": "blocking", "key": key, "message": f"{label}: {err}", "fix": "pilih kolom dengan jenis yang sesuai"})
        else:
            chosen = (raw or "").strip() if isinstance(raw, str) else ""
            if not chosen:
                issues.append({"level": "blocking", "key": key,
                               "message": f"{label}: belum diisi",
                               "fix": "pilih satu kolom"})
            elif chosen not in df.columns:
                issues.append({"level": "blocking", "key": key,
                               "message": f"{label}: kolom '{chosen}' tidak ada di dataset ini",
                               "fix": f"pilih kolom yang ada. tersedia: {', '.join(map(str, list(df.columns)[:6]))}…"})
            else:
                err = _check_col_kind(df, chosen, cs.get("kind", "any"))
                if err:
                    issues.append({"level": "blocking", "key": key, "message": f"{label}: {err}", "fix": "pilih kolom dengan jenis yang sesuai"})

    # --- parameter wajib terisi -----------------------------------------
    for key, ps in param_specs.items():
        if not ps.get("required"):
            continue

        label = ps.get("label", key)
        if key in ("alpha",):
            # alpha selalu ada default backend; validasi di analytics_crud
            continue

        val = params.get(key)
        if val is None or (isinstance(val, str) and not val.strip()):
            issues.append({"level": "blocking", "key": key,
                           "message": f"{label}: belum diisi (wajib)",
                           "fix": "isi nilai parameter ini"})

    # --- peringatan (tidak memblokir) ------------------------------------
    # kelompok pengelompok: jumlah level harus sesuai syarat metode.
    for key, cs in col_specs.items():
        if cs.get("kind") != "group":
            continue

        raw = variables.get(key)
        chosen = raw if isinstance(raw, str) else ""
        if chosen and chosen in df.columns:
            n_levels = int(df[chosen].nunique(dropna=True))
            if n_levels < 2:
                issues.append({"level": "blocking", "key": key,
                               "message": f"Kolom '{chosen}' hanya punya {n_levels} nilai unik — tidak bisa membagi kelompok",
                               "fix": "pilih kolom pengelompok yang punya minimal 2 kelompok"})

    # n minimum untuk uji tertentu
    return issues