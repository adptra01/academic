"""Base Playwright browser scraper for social media platforms."""
from __future__ import annotations

import asyncio
import json
import os
import tempfile
from abc import abstractmethod
from datetime import datetime, timezone
from typing import Any

from .base import DataConnector, FetchResult, raw_hash, sanitize_config, utcnow


class BrowserScraperError(Exception):
    pass


# Pola pemblokir umum saat pemindaian awal kosong: (kategori, penanda teks/url, saran).
# Dicek terhadap innerText halaman — memberi pesan spesifik, bukan "coba lagi" buta.
BLOCKER_PATTERNS: list[tuple[str, list[str], str]] = [
    (
        "login",
        ["log in to continue", "sign in to continue", "log in", "sign in", "masuk untuk melanjutkan", "/login"],
        "Halaman meminta LOGIN. Solusi: login sekali di browser → export storage_state.json → unggah di tab Sosmed "
        "(mode Sesi browser). Konten privat/pengikut saja tidak bisa diambil tanpa login.",
    ),
    (
        "captcha",
        ["captcha", "verify you are", "unusual traffic", "trafik tidak biasa", "verify it's you", "i'm not a robot"],
        "Platform menampilkan VERIFIKASI BOT. Jangan spam request — tunggu ±10–15 menit, gunakan sesi browser "
        "yang sudah login (storage_state.json), lalu ulangi dengan limit kecil (20–50).",
    ),
    (
        "consent",
        ["before you continue", "cookie", "setuju", "accept all", "terima semua"],
        "Dialog PERSETUJUAN/cookie menghalangi konten. Coba ulangi — bila berulang, gunakan storage_state dari sesi browser Anda.",
    ),
    (
        "comments_off",
        ["comments are turned off", "komentar dinonaktifkan", "comments disabled", "commenting is disabled"],
        "KOMENTAR DIMATIKAN untuk konten ini — tidak ada yang bisa diambil. Pilih konten lain.",
    ),
    (
        "unavailable",
        ["video unavailable", "video tidak tersedia", "postingan tidak tersedia", "page not found", "halaman tidak ditemukan",
         "tidak dapat diakses", "content isn't available", "sorry, this page", "private video", "video privat", "account suspended"],
        "KONTEN TIDAK TERSEDIA (dihapus/privat/URL salah). Periksa link-nya dan pastikan publik.",
    ),
    (
        "rate",
        ["try again later", "coba lagi nanti", "something went wrong", "rate limit", "too many requests"],
        "Platform MEMBATASI SEMENTARA. Tunggu ±10–15 menit lalu ulangi dengan limit kecil (20–50).",
    ),
]


class BaseBrowserScraper(DataConnector):
    """Base class for browser-based social media scrapers using Playwright."""

    kind = "scraper"

    def __init__(self) -> None:
        self.browser = None
        self.context = None
        self.page = None

    def _load_storage_state(self, storage_state: str | dict | None) -> dict | None:
        if not storage_state:
            return None
        if isinstance(storage_state, dict):
            return storage_state
        if isinstance(storage_state, str):
            if os.path.exists(storage_state):
                try:
                    with open(storage_state, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception as e:
                    raise BrowserScraperError(f"Gagal load storage_state: {e}")
            try:
                return json.loads(storage_state)
            except Exception:
                raise BrowserScraperError("storage_state bukan path valid atau JSON valid")
        return None

    async def _launch(
        self,
        headless: bool = True,
        storage_state: str | dict | None = None,
        user_agent: str | None = None,
    ):
        try:
            from playwright.async_api import async_playwright
        except ImportError as e:
            raise BrowserScraperError(f"Playwright belum terinstall: {e}")

        self._pw = await async_playwright().start()
        self.browser = await self._pw.chromium.launch(headless=headless)

        context_kwargs: dict[str, Any] = {"viewport": {"width": 1280, "height": 900}}
        context_kwargs["user_agent"] = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        )

        ss = self._load_storage_state(storage_state)
        if ss:
            if isinstance(storage_state, str) and os.path.exists(storage_state):
                context_kwargs["storage_state"] = storage_state
            else:
                fd, path = tempfile.mkstemp(suffix=".json", prefix="ss_")
                try:
                    with os.fdopen(fd, "w", encoding="utf-8") as f:
                        json.dump(ss, f)
                    context_kwargs["storage_state"] = path
                    self._ss_temp = path
                except Exception:
                    os.close(fd)
                    raise

        self.context = await self.browser.new_context(**context_kwargs)
        self.page = await self.context.new_page()

    async def _close(self):
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if hasattr(self, "_pw"):
                await self._pw.stop()
            if hasattr(self, "_ss_temp") and os.path.exists(self._ss_temp):
                try:
                    os.unlink(self._ss_temp)
                except Exception:
                    pass
        except Exception:
            pass

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    async def _detect_blockers(self, label: str) -> str:
        """Pindai halaman saat ekstraksi awal kosong → pesan spesifik berbahasa Indonesia."""
        try:
            text = (await self.page.evaluate("() => (document.body ? document.body.innerText : '').slice(0, 4000)") or "").lower()
            url = (self.page.url or "").lower()
        except Exception:
            return ""
        for _cat, markers, hint in BLOCKER_PATTERNS:
            if any(m in text or m in url for m in markers):
                return f"{label}: {hint}"
        return (
            f"{label}: pemindaian awal tidak menemukan komentar. Kemungkinan: butuh login "
            "(pakai mode Sesi browser + storage_state.json), konten privat/dibatasi, atau tampilan "
            "platform berubah. Coba limit kecil (20–50) dulu."
        )

    def _normalize_records(self, raw: list[dict]) -> list[dict]:
        normalized = []
        seen = set()
        for r in raw:
            if not isinstance(r, dict):
                continue
            text = str(r.get("text", "")).strip()
            if not text:
                continue
            cid = r.get("comment_id") or r.get("id") or text[:100]
            key = f"{r.get('platform', '')}:{cid}:{text[:80]}"
            if key in seen:
                continue
            seen.add(key)
            normalized.append(
                {
                    "platform": r.get("platform", self.provider.replace("_comments", "")),
                    "post_url": r.get("post_url") or "",
                    "author_username": r.get("author_username") or r.get("username") or "",
                    "author_url": r.get("author_url") or "",
                    "text": text,
                    "likes": r.get("likes") or r.get("like_count") or 0,
                    "replies_count": r.get("replies_count") or 0,
                    "comment_id": str(cid),
                    "parent_id": r.get("parent_id") or "",
                    "created_at": r.get("created_at") or r.get("timestamp") or "",
                    "is_reply": bool(r.get("is_reply") or r.get("parent_id")),
                    "retrieved_at": self._now_iso(),
                }
            )
        return normalized

    @abstractmethod
    async def _scrape(self, config: dict) -> list[dict]:
        pass

    def fetch(self, config: dict) -> FetchResult:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            records = loop.run_until_complete(self._scrape(dict(config or {})))
        finally:
            loop.close()

        normalized = self._normalize_records(records)
        if not normalized:
            raise BrowserScraperError(
                f"Tidak ada komentar valid yang berhasil diekstrak (platform={self.provider}, mentah={len(records)}). "
                + (
                    "Data mentah ada tapi kosong/tak valid — kemungkinan besar selektor platform berubah; laporkan URL-nya."
                    if records
                    else "Pemindaian awal tidak menemukan komentar (komentar dimatikan/privat/butuh login — lihat pesan tahap running)."
                )
            )

        raw_bytes = json.dumps(normalized, ensure_ascii=False).encode("utf-8")
        return FetchResult(
            records=normalized,
            provenance={
                "source": f"scraper:{self.kind}:{self.provider}",
                "retrieved_at": utcnow(),
                "query": sanitize_config(dict(config or {})),
                "raw_hash": raw_hash(raw_bytes),
                "record_count": len(normalized),
                "raw_count": len(records),
                "robots": "user-session",
                "deduped": True,
            },
        )

    def authenticate(self, config: dict) -> dict:
        return {"note": "Browser scraper dengan session user (storage_state opsional)"}
