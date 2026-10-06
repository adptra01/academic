"""Scraper ber-guardrail: tabel HTML publik → records.
Aturan keras (lihat docs/scraping-policy.md):
- domain allowlist (env SCRAPER_ALLOWLIST, koma; kosong = tolak semua kecuali localhost dev)
- patuhi robots.txt; tolak bila Disallow
- JANGAN bypass login/paywall/auth (401/403/login-form → tolak dengan pesan jelas)
- rate limit per domain, timeout, retry terbatas, UA teridentifikasi, raw hash,
  request log, dedup, provenance penuh.
"""
from __future__ import annotations
import time
import re
import urllib.parse
import urllib.request
import urllib.robotparser
import pandas as pd
from .base import DataConnector, FetchResult, raw_hash, register, utcnow

_last_hit: dict[str, float] = {}

PRESETS = [
    {"id": "wikipedia", "name": "Tabel artikel Wikipedia", "description": "Tempel URL artikel Wikipedia, pilih tabelnya.",
     "example_url": "https://en.wikipedia.org/wiki/List_of_countries_by_population", "table_index": 0},
    {"id": "first-table", "name": "Tabel pertama halaman mana pun", "description": "Ambil tabel pertama yang ditemukan di URL allowlisted.",
     "example_url": "", "table_index": 0},
    {"id": "bps-statik", "name": "Tabel publik BPS/statistik", "description": "Tempel URL tabel publik (mis. Badan Pusat Statistik).",
     "example_url": "", "table_index": 0},
    {"id": "auto-detect", "name": "Auto Detect (Coba semua strategi)", "description": "Coba Wikipedia → Tabel pertama → BPS → Google Sheets → Generic HTML. Ambil yang paling kaya data.",
     "example_url": "", "table_index": 0, "auto": True},
    {"id": "google-sheets", "name": "Google Sheets Publik", "description": "CSV export dari Google Sheets publik (format: https://docs.google.com/spreadsheets/d/ID/export?format=csv).",
     "example_url": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv", "table_index": 0},
    {"id": "generic-html", "name": "Generic HTML Table (Fallback)", "description": "Coba semua tabel di halaman, ambil yang paling kaya data (baris × kolom).",
     "example_url": "", "table_index": 0},
]


def guard_url(url: str):
    """Allowlist + robots check. Mengembalikan urlparse parts."""
    import os

    parts = urllib.parse.urlparse(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ScraperError("URL tidak valid")
    allow = [d.strip() for d in os.getenv("SCRAPER_ALLOWLIST", "").split(",") if d.strip()]
    if not _allowlisted(parts.hostname, allow):
        raise ScraperError(f"Domain '{parts.hostname}' tidak di allowlist (SCRAPER_ALLOWLIST)")
    try:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{parts.scheme}://{parts.hostname}/robots.txt")
        rp.read()
        if not rp.can_fetch("AcademicResearchBot", url):
            raise ScraperError("robots.txt melarang path ini — scraping DITOLAK")
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError(f"robots.txt tak terbaca, batal demi aman: {e}")
    return parts


def download_guarded(url: str, config: dict) -> tuple[str, str, bytes]:
    """Download dengan rate-limit/timeout/retry + tolak login/paywall."""
    import os  # noqa

    parts = urllib.parse.urlparse(url)
    min_interval = float(config.get("min_interval", 2.0))
    now = time.time()
    if now - _last_hit.get(parts.hostname or "", 0) < min_interval:
        time.sleep(min_interval - (now - _last_hit[parts.hostname or ""]))
    timeout = int(config.get("timeout", 15))
    retries = int(config.get("max_retries", 2))
    raw: bytes | None = None
    last: Exception | None = None
    final_url = url
    for _ in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AcademicResearchBot/0.1 (+research; rate-limited)"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status in (401, 403):
                    raise ScraperError(f"HTTP {resp.status}: halaman butuh auth — JANGAN bypass")
                raw = resp.read()
                final_url = resp.geturl()
            break
        except ScraperError:
            raise
        except Exception as e:
            last = e
            time.sleep(1)
    if raw is None:
        raise ScraperError(f"Gagal fetch: {last}")
    _last_hit[parts.hostname or ""] = time.time()
    text = raw.decode("utf-8", errors="replace")
    lowered = text.lower()
    if any(x in lowered for x in ("name=\"password\"", "type=\"password\"", "paywall", "subscribe to continue")):
        raise ScraperError("Halaman tampak login/paywall — scraping DITOLAK")
    return text, final_url, raw


def list_tables(text: str) -> list:
    try:
        from io import StringIO
        tables = pd.read_html(StringIO(text))
    except ValueError as e:
        raise ScraperError(f"Tidak ada tabel HTML: {e}")
    return [t.dropna(how="all").drop_duplicates() for t in tables]


def inspect_url(url: str, config: dict) -> dict:
    """Pratinjau tanpa menyimpan: daftar tabel (bentuk, kolom, 3 baris contoh)."""
    guard_url(url)
    text, final_url, raw = download_guarded(url, config)
    tables = list_tables(text)
    out = []
    for i, df in enumerate(tables):
        cols = [str(c) for c in df.columns]
        sample = df.head(3).astype(object).where(df.head(3).notna(), None).to_dict(orient="records")
        out.append({"index": i, "rows": int(len(df)), "cols": int(len(df.columns)), "columns": cols[:20], "sample": sample})
    return {"url": url, "final_url": final_url, "raw_hash": raw_hash(raw), "tables": out}


REQUEST_LOG: list[dict] = []


class ScraperError(Exception):
    pass


def _allowlisted(host: str, allow: list[str]) -> bool:
    host = host.lower()
    if host in ("localhost", "127.0.0.1"):
        return True
    return any(host == d.lower() or host.endswith("." + d.lower()) for d in allow)


@register
class HTMLTableScraper(DataConnector):
    kind = "scraper"
    provider = "html_table"

    def authenticate(self, config: dict) -> dict:
        return {"note": "scraper publik tanpa auth; halaman login/paywall DITOLAK"}

    def fetch(self, config: dict) -> FetchResult:
        url = config.get("url", "")
        preset_id = config.get("preset_id", "first-table")
        
        # Auto-detect mode: coba semua strategi berurutan
        if preset_id == "auto-detect":
            return self._fetch_auto_detect(url, config)
        
        # Google Sheets publik via CSV export
        if preset_id == "google-sheets":
            return self._fetch_google_sheets(url, config)
        
        # Mode standar: table_index eksplisit
        guard_url(url)
        table_index = int(config.get("table_index", 0))
        text, final_url, raw = download_guarded(url, config)
        tables = list_tables(text)
        if table_index >= len(tables):
            raise ScraperError(f"table_index {table_index} di luar {len(tables)} tabel")
        df = tables[table_index].dropna(how="all").drop_duplicates()
        records = df.astype(object).where(df.notna(), None).to_dict(orient="records")
        REQUEST_LOG.append({"url": final_url, "at": utcnow(), "bytes": len(raw), "status": "ok"})
        return FetchResult(
            records=records,
            provenance={
                "source": "scraper:html_table", "retrieved_at": utcnow(),
                "query": {"url": url, "final_url": final_url, "table_index": table_index},
                "raw_hash": raw_hash(raw), "record_count": len(records),
                "robots": "allowed", "deduped": True,
            },
        )

    def _fetch_auto_detect(self, url: str, config: dict) -> FetchResult:
        """Coba strategi berurutan: wikipedia → first-table → bps-statik → google-sheets → generic-html"""
        strategies = [
            ("wikipedia", {"table_index": 0}),
            ("first-table", {"table_index": 0}),
            ("bps-statik", {"table_index": 0}),
            ("google-sheets", {}),
            ("generic-html", {"table_index": 0}),
        ]
        
        last_error = None
        for preset_id, preset_config in strategies:
            try:
                merged_config = {**config, **preset_config}
                # Temporarily override preset_id to avoid recursion
                merged_config = {**config, **preset_config, "preset_id": preset_id}
                return self.fetch(merged_config)
            except Exception as e:
                last_error = e
                continue
        raise ScraperError(f"Auto-detect gagal: {last_error}")

    def _fetch_google_sheets(self, url: str, config: dict) -> FetchResult:
        """Fetch Google Sheets via CSV export endpoint."""
        # Convert Google Sheets URL to CSV export format
        # https://docs.google.com/spreadsheets/d/ID/edit#gid=0
        # -> https://docs.google.com/spreadsheets/d/ID/export?format=csv&gid=GID
        import re
        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
        if not match:
            raise ScraperError("URL Google Sheets tidak valid. Format: https://docs.google.com/spreadsheets/d/ID/...")
        sheet_id = match.group(1)
        gid_match = re.search(r'[#&]gid=(\d+)', url)
        gid = gid_match.group(1) if gid_match else "0"
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
        
        # Fetch CSV directly
        config_gs = {**config, "url": csv_url, "preset_id": "generic-html"}
        return self.fetch(config_gs)
