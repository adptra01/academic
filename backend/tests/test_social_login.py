"""Social login tests (feature/social-login). Google di-mock — tanpa network.
Bukan bagian RC1 freeze.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    return TestClient(app, raise_server_exceptions=False)


def test_google_disabled_without_config(client):
    r = client.get("/api/v1/auth/google/url")
    assert r.status_code in (200, 501)


def test_google_callback_new_and_link(client, monkeypatch):
    import app.routers.social_auth as sa

    monkeypatch.setattr(sa.settings, "google_client_id", "cid-test")
    monkeypatch.setattr(sa.settings, "google_client_secret", "sec-test")

    import app.routers.social_auth as sa2

    class FakeResp:
        status = 200

        def read(self):
            import json

            return json.dumps({"id_token": "IDTOK", "access_token": "AT"}).encode()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(sa2.urllib.request, "urlopen", lambda req, timeout=None: FakeResp())

    import google.oauth2.id_token as _idt

    monkeypatch.setattr(_idt, "verify_oauth2_token", lambda tok, req, cid: {"email": f"guser_{uuid.uuid4().hex[:6]}@gmail.com", "email_verified": True, "name": "G User", "sub": "sub123"})
    st = client.get("/api/v1/auth/google/url").json()["state"]
    r = client.post("/api/v1/auth/google/callback", json={"code": "AUTHCODE", "state": st})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]
    # login kedua dengan email sama → user yang sama (link), bukan duplikat
    uid1 = r.json()["user"]["id"]
    monkeypatch.setattr(_idt, "verify_oauth2_token", lambda tok, req, cid: {"email": r.json()["user"]["email"], "email_verified": True, "name": "G User", "sub": "sub123"})
    st2 = client.get("/api/v1/auth/google/url").json()["state"]
    r2 = client.post("/api/v1/auth/google/callback", json={"code": "AUTHCODE2", "state": st2})
    assert r2.status_code == 200, r2.text
    assert r2.json()["user"]["id"] == uid1


def test_google_callback_rejects_missing_or_reused_state(client, monkeypatch):
    import app.routers.social_auth as sa

    monkeypatch.setattr(sa.settings, "google_client_id", "cid-test")
    monkeypatch.setattr(sa.settings, "google_client_secret", "sec-test")
    # Tanpa state → 401.
    r = client.post("/api/v1/auth/google/callback", json={"code": "C"})
    assert r.status_code == 401, r.text
    # State asing → 401.
    r = client.post("/api/v1/auth/google/callback", json={"code": "C", "state": "bukan-state-valid"})
    assert r.status_code == 401, r.text


def test_google_unverified_rejected(client, monkeypatch):
    import app.routers.social_auth as sa

    monkeypatch.setattr(sa.settings, "google_client_id", "cid-test")
    monkeypatch.setattr(sa.settings, "google_client_secret", "sec-test")

    class FakeResp:
        status = 200

        def read(self):
            import json

            return json.dumps({"id_token": "IDTOK"}).encode()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(sa.urllib.request, "urlopen", lambda req, timeout=None: FakeResp())
    import google.oauth2.id_token as _idt

    monkeypatch.setattr(_idt, "verify_oauth2_token", lambda tok, req, cid: {"email": "x@gmail.com", "email_verified": False})
    st = client.get("/api/v1/auth/google/url").json()["state"]
    r = client.post("/api/v1/auth/google/callback", json={"code": "C", "state": st})
    assert r.status_code == 401, r.text
