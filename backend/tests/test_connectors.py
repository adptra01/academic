"""Connector tests (feature/connectors). Tanpa network: urlopen/robots di-mock.
Bukan bagian RC1 freeze.
"""
import io
import json
import urllib.request

import pytest

from app.services.connectors.base import REGISTRY, get_connector, sanitize_config
from app.services.connectors import http_api as _h  # noqa: F401 (registrasi)
from app.services.connectors import scraper as _s  # noqa: F401 (registrasi)
from app.services.connectors.oauth import decrypt_token, encrypt_token


class _Resp:
    def __init__(self, payload, status=200):
        self._b = json.dumps(payload).encode()
        self.status = status

    def read(self):
        return self._b

    def geturl(self):
        return "http://x/"

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_registry():
    assert "api:generic_rest" in {f"{c.kind}:{c.provider}" for c in REGISTRY.values()}
    assert "scraper:html_table" in {f"{c.kind}:{c.provider}" for c in REGISTRY.values()}
    with pytest.raises(ValueError, match="tidak dikenal"):
        get_connector("api", "nope")


def test_normalize_mapping():
    c = get_connector("api", "generic_rest")
    out = c.normalize([{"a": {"b": 1}, "z": 9}], {"x": "a.b"})
    assert out == [{"x": 1}]


def test_sanitize_redacts():
    clean = sanitize_config({"url": "https://a", "headers": {"Authorization": "Bearer S3CR3T"}, "api_key": "k"})
    assert clean["headers"]["Authorization"] == "***redacted***"
    assert clean["api_key"] == "***redacted***"
    assert clean["url"] == "https://a"


def test_rest_pagination_mock(monkeypatch):
    pages = {1: {"data": {"items": [{"v": 1}, {"v": 2}]}}, 2: {"data": {"items": []}}}
    seen = []

    def fake_open(req, timeout=None):
        url = req.full_url if hasattr(req, "full_url") else req
        seen.append(url)
        import urllib.parse as _p

        q = _p.parse_qs(_p.urlparse(url).query)
        pg = int(q.get("page", ["1"])[0])
        return _Resp(pages[pg])

    monkeypatch.setattr(urllib.request, "urlopen", fake_open)
    c = get_connector("api", "generic_rest")
    res = c.fetch({"url": "https://api.example.com/r", "records_path": "data.items", "mapping": {"v": "v"}, "pagination": {"param": "page", "max_pages": 5}})
    assert res.provenance["record_count"] == 2
    assert res.records == [{"v": 1}, {"v": 2}]
    assert "Authorization" not in json.dumps(res.provenance)


def test_rest_rejects_http():
    c = get_connector("api", "generic_rest")
    with pytest.raises(Exception, match="https"):
        c.fetch({"url": "http://insecure.example.com/r"})


def test_scraper_allowlist_deny():
    c = get_connector("scraper", "html_table")
    with pytest.raises(Exception, match="allowlist"):
        c.fetch({"url": "https://berita.example.com/tabel"})


def test_oauth_roundtrip():
    blob, _ = encrypt_token({"access_token": "abc123"})
    assert decrypt_token(blob) == {"access_token": "abc123"}
    assert "abc123" not in blob
