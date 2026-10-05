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
import urllib.parse
import urllib.request
import urllib.robotparser
import pandas as pd
from .base import DataConnector, FetchResult, raw_hash, register, utcnow

_last_hit: dict[str, float] = {}
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
        import os

        url = config.get("url", "")
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
        min_interval = float(config.get("min_interval", 2.0))
        now = time.time()
        if now - _last_hit.get(parts.hostname, 0) < min_interval:
            time.sleep(min_interval - (now - _last_hit[parts.hostname]))
        timeout = int(config.get("timeout", 15))
        retries = int(config.get("max_retries", 2))
        table_index = int(config.get("table_index", 0))
        raw: bytes | None = None
        last: Exception | None = None
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
        _last_hit[parts.hostname] = time.time()
        text = raw.decode("utf-8", errors="replace")
        lowered = text.lower()
        if any(s in lowered for s in ("name=\"password\"", "type=\"password\"", "paywall", "subscribe to continue")):
            raise ScraperError("Halaman tampak login/paywall — scraping DITOLAK")
        try:
            tables = pd.read_html(text)
        except ValueError as e:
            raise ScraperError(f"Tidak ada tabel HTML: {e}")
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
