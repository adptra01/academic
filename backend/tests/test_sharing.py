"""Sharing + feedback tests (feature/sharing). Self-contained (user/project/dataset
dibuat per test) agar jalan di DB fresh maupun dev. Tanpa network tambahan.
Bukan bagian RC1 freeze.
"""
import io
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    return TestClient(app, raise_server_exceptions=False)


def _register(client, tag):
    email = f"sharetest_{tag}_{uuid.uuid4().hex[:8]}@synthetic.beta"
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "Synth12345", "name": "Share Test"})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _project_dataset(client, token):
    h = {"Authorization": f"Bearer {token}"}
    pid = client.post("/api/v1/projects", headers=h, json={"title": "Share Test"}).json()["id"]
    csv = "a,b\n1,2\n3,4\n5,6\n"
    r = client.post(f"/api/v1/projects/{pid}/datasets/upload", headers=h, files={"file": ("t.csv", io.BytesIO(csv.encode()), "text/csv")})
    assert r.status_code == 201, r.text
    return pid, r.json()["dataset"]["id"]


def _analysis(client, token, pid, dsid):
    h = {"Authorization": f"Bearer {token}"}
    r = client.post("/api/v1/analyses/run", headers=h, json={"project_id": pid, "dataset_id": dsid, "method": "descriptive", "variables": {"columns": ["a"]}})
    assert r.status_code == 201, r.text
    return r.json()["analysis_uid"]


def test_share_lifecycle(client):
    t = _register(client, "a")
    h = {"Authorization": f"Bearer {t}"}
    pid, dsid = _project_dataset(client, t)
    uid = _analysis(client, t, pid, dsid)
    r = client.post(f"/api/v1/analyses/{uid}/share", headers=h, json={"expires_days": 30})
    assert r.status_code == 201, r.text
    token = r.json()["token"]
    pub = client.get(f"/public/shared/{token}")
    assert pub.status_code == 200, pub.text
    body = pub.json()
    assert body["analysis_uid"] == uid
    assert "email" not in pub.text and "password_hash" not in pub.text
    assert client.delete(f"/api/v1/analyses/{uid}/share", headers=h).status_code == 204
    assert client.get(f"/public/shared/{token}").status_code == 404


def test_share_other_user_404(client):
    t1 = _register(client, "b1")
    t2 = _register(client, "b2")
    pid, dsid = _project_dataset(client, t1)
    uid = _analysis(client, t1, pid, dsid)
    h2 = {"Authorization": f"Bearer {t2}"}
    assert client.post(f"/api/v1/analyses/{uid}/share", headers=h2, json={}).status_code == 404
    assert client.get(f"/api/v1/analyses/{uid}/share", headers=h2).status_code == 404


def test_share_validation(client):
    t = _register(client, "c")
    h = {"Authorization": f"Bearer {t}"}
    pid, dsid = _project_dataset(client, t)
    uid = _analysis(client, t, pid, dsid)
    assert client.post(f"/api/v1/analyses/{uid}/share", headers=h, json={"expires_days": 400}).status_code == 422
    r = client.post("/api/v1/feedback", headers=h, json={"analysis_uid": uid, "category": "ui", "description": "pendek"})
    assert r.status_code == 422
    r = client.post("/api/v1/feedback", headers=h, json={"analysis_uid": uid, "category": "ui", "description": "Laporan beta yang cukup panjang."})
    assert r.status_code == 201, r.text
    assert client.get("/api/v1/feedback", headers=h).status_code == 200
