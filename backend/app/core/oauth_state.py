"""State OAuth sekali-pakai (anti-CSRF login, spek §6A).
Backend membuat `state` acak saat /start atau /google/url, mengikatnya ke
redirect_uri + provider, lalu callback WAJIB mengembalikannya. Entri dihapus
saat dipakai (replay ditolak). Penyimpanan: Redis (TTL 10 menit), fallback
dict in-memory bila Redis mati (cocok untuk dev single-process).
"""
from __future__ import annotations
import json
import logging
import secrets
import time

from app.core.config import settings

log = logging.getLogger("academic.oauth_state")
TTL = 600

_mem: dict[str, tuple[str, float]] = {}


def _redis():
    try:
        import redis
        r = redis.Redis.from_url(settings.redis_url, socket_timeout=3)
        r.ping()
        return r
    except Exception as e:
        log.warning("Redis state-store tak tersedia, fallback memori: %s", e)
        return None


def issue(provider: str, redirect_uri: str) -> str:
    state = secrets.token_urlsafe(32)
    payload = json.dumps({"provider": provider, "redirect_uri": redirect_uri})
    r = _redis()
    if r is not None:
        r.setex(f"oauth_state:{state}", TTL, payload)
    else:
        _mem[state] = (payload, time.time() + TTL)
    return state


def consume(provider: str, state: str, redirect_uri: str) -> None:
    """Validasi + hapus state. Raise ValueError bila tak valid (401 di router)."""
    if not state:
        raise ValueError("Parameter 'state' wajib (kemungkinan CSRF atau alur kedaluwarsa).")
    payload: str | None = None
    r = _redis()
    if r is not None:
        raw = r.get(f"oauth_state:{state}")
        if raw is not None:
            payload = raw.decode() if isinstance(raw, bytes) else str(raw)
            r.delete(f"oauth_state:{state}")
    else:
        hit = _mem.pop(state, None)
        if hit is not None and hit[1] >= time.time():
            payload = hit[0]
    if payload is None:
        raise ValueError("State tidak dikenal/kedaluwarsa — ulangi dari tombol login.")
    try:
        data = json.loads(payload)
    except ValueError:
        raise ValueError("State korup — ulangi dari tombol login.")
    if data.get("provider") != provider:
        raise ValueError("State tidak cocok untuk provider ini.")
    if data.get("redirect_uri") != redirect_uri:
        raise ValueError("redirect_uri tidak cocok dengan saat memulai login.")
