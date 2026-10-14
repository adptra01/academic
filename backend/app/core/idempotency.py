"""Idempotency-Key untuk endpoint job (spek §8: pengiriman ulang tidak duplikat).
Client mengirim header `Idempotency-Key: <uuid>`. Respons job yang sama
dikembalikan selama 24 jam. Redis primary, memori fallback.
"""
from __future__ import annotations
import json
import logging
import time

from app.core.config import settings

log = logging.getLogger("academic.idempotency")
TTL = 24 * 3600

_mem: dict[str, tuple[str, float]] = {}


def _redis():
    try:
        import redis
        r = redis.Redis.from_url(settings.redis_url, socket_timeout=3)
        r.ping()
        return r
    except Exception as e:
        log.warning("Redis idempotency tak tersedia, fallback memori: %s", e)
        return None


def claim(key: str, scope: str, payload: dict) -> dict | None:
    """Coba klaim key. Kembalikan respons tersimpan bila key sudah dipakai, else None."""
    if not key:
        return None
    name = f"idem:{scope}:{key}"
    body = json.dumps(payload)
    r = _redis()
    if r is not None:
        if r.set(name, body, ex=TTL, nx=True):
            return None
        raw = r.get(name)
        try:
            return json.loads(raw) if raw else {"deduped": True}
        except ValueError:
            return {"deduped": True}
    now = time.time()
    hit = _mem.get(name)
    if hit is not None and hit[1] >= now:
        try:
            return json.loads(hit[0])
        except ValueError:
            return {"deduped": True}
    _mem[name] = (body, now + TTL)
    return None
