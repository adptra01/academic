"""Registry kapabilitas sumber (spek Tahap 2).
Setiap konektor mendeklarasikan: metode akses yang didukung, tipe data,
batas, scope/kredensial yang dibutuhkan, dan yang TIDAK didukung.
UI membaca tabel ini (GET /api/v1/sources/capabilities) — bukan mengasumsikan
semua platform sama. OAuth login aplikasi TIDAK SAMA dengan izin scrape:
kolom `note` menegaskan batas tiap platform.
"""
from __future__ import annotations

# access_mode: "public" (tanpa kredensial) | "oauth" (koneksi provider) |
#              "api_key" (kredensial layanan) | "session" (storage_state browser)
CAPABILITIES: dict[str, dict] = {
    "scraper:tiktok_comments": {
        "label": "TikTok — Komentar",
        "access_modes": ["public", "session"],
        "data_types": ["comments"],
        "default_limit": 500, "max_limit": 2000,
        "needs": [],
        "note": "Konten publik bisa tanpa login. OAuth TikTok TIDAK membuka semua komentar otomatis.",
    },
    "scraper:instagram_comments": {
        "label": "Instagram — Komentar",
        "access_modes": ["public", "session"],
        "data_types": ["comments"],
        "default_limit": 300, "max_limit": 1000,
        "needs": [],
        "note": "API resmi IG hanya untuk jenis akun/produk tertentu. Scraper browser untuk konten publik; privat butuh sesi.",
    },
    "scraper:youtube_comments": {
        "label": "YouTube — Komentar",
        "access_modes": ["public", "oauth", "api_key", "session"],
        "data_types": ["comments"],
        "default_limit": 500, "max_limit": 2000,
        "needs": ["youtube_api_key_or_oauth"],
        "note": "Login Google aplikasi ≠ izin YouTube. Data API butuh API key / scope youtube.readonly via koneksi youtube.",
    },
    "scraper:facebook_comments": {
        "label": "Facebook — Komentar",
        "access_modes": ["public", "session"],
        "data_types": ["comments"],
        "default_limit": 300, "max_limit": 1000,
        "needs": [],
        "note": "Akses publik terbatas per endpoint. Login FB biasa bukan jalan pintas ke semua komentar.",
    },
    "scraper:x_comments": {
        "label": "X / Twitter — Balasan",
        "access_modes": ["public", "session", "api_key"],
        "data_types": ["comments"],
        "default_limit": 300, "max_limit": 1000,
        "needs": [],
        "note": "Bergantung paket/kuota API X bila lewat API resmi.",
    },
    "api:youtube": {
        "label": "YouTube Data API",
        "access_modes": ["oauth", "api_key"],
        "data_types": ["videos", "channels", "comments"],
        "default_limit": 50, "max_limit": 500,
        "needs": ["youtube_api_key_or_oauth"],
        "note": "Butuh API key atau koneksi OAuth youtube (scope sesuai endpoint).",
    },
    "api:generic_rest": {
        "label": "API generik (REST JSON)",
        "access_modes": ["public", "oauth", "api_key"],
        "data_types": ["records"],
        "default_limit": 100, "max_limit": 20000,
        "needs": [],
        "note": "Otentikasi opsional via use_oauth / headers.",
    },
    "scraper:html_table": {
        "label": "Scraper tabel HTML",
        "access_modes": ["public"],
        "data_types": ["tables"],
        "default_limit": 5000, "max_limit": 20000,
        "needs": [],
        "note": "Hanya domain allowlist + lolos SSRF-guard. Tanpa login.",
    },
}

DEFAULT_CAPABILITY: dict = {
    "label": None,
    "access_modes": ["public"],
    "data_types": ["records"],
    "default_limit": 100, "max_limit": 20000,
    "needs": [],
    "note": "",
}


def capability(kind: str, provider: str) -> dict:
    cap = CAPABILITIES.get(f"{kind}:{provider}", DEFAULT_CAPABILITY)
    out = dict(cap)
    if out["label"] is None:
        out["label"] = f"{kind}:{provider}"
    return out


def all_capabilities() -> list[dict]:
    return [{"key": k, **v} for k, v in CAPABILITIES.items()]
