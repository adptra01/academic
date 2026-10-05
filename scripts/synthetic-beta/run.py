#!/usr/bin/env python3
"""Synthetic beta: 5 persona otomatis menjalankan workflow peneliti end-to-end
+ probe reliabilitas teknis. Bukan pengganti beta manusia (Gate 2).
Stdlib only. Usage: python3 run.py [BASE_URL]
Output: report dict → stdout + docs/beta-synthetic/report-<ts>.json
Exit: 0 bila memenuhi ambang (completion ≥90%, 0 critical, 0 leak), 1 bila tidak.
"""
import csv
import json
import mimetypes
import os
import sys
import threading
import time
import urllib.request
import uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8100"
HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.normpath(os.path.join(HERE, "..", "..", "docs", "beta-synthetic"))

PERSONAS = [
    {"name": "s1_undergrad", "methods": [("pearson", {"x": "service_quality", "y": "satisfaction"}), ("ttest_ind", {"column": "satisfaction", "group": "gender"})]},
    {"name": "s2_grad", "methods": [("anova_oneway", {"column": "satisfaction", "group": "cabang"}), ("linreg_multiple", {"xs": ["service_quality", "pre"], "y": "satisfaction"})]},
    {"name": "lecturer", "methods": [("chi2_independence", {"col1": "gender", "col2": "member"}), ("kruskal", {"column": "satisfaction", "group": "cabang"})]},
    {"name": "spss_veteran", "methods": [("ttest_paired", {"col1": "pre", "col2": "post"}), ("spearman", {"x": "service_quality", "y": "satisfaction"})]},
    {"name": "edge_tester", "methods": [("descriptive", {"columns": ["service_quality", "satisfaction", "gender"]}), ("normality", {"column": "service_quality"})]},
]

CHECKS: list = []
LOCK = threading.Lock()


def check(persona, step, ok, detail=""):
    with LOCK:
        CHECKS.append({"persona": persona, "step": step, "ok": bool(ok), "detail": str(detail)[:200]})
    print(("PASS " if ok else "FAIL ") + f"{persona}:{step} {detail}"[:160])


def _req(method, path, body=None, token=None, ctype="application/json"):
    data = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", ctype)
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def _upload(token, pid, filepath, fname=None):
    boundary = uuid.uuid4().hex
    with open(filepath, "rb") as f:
        content = f.read()
    fname = fname or os.path.basename(filepath)
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{fname}\"\r\n"
            f"Content-Type: {mimetypes.guess_type(fname)[0] or 'application/octet-stream'}\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request(BASE + f"/api/v1/projects/{pid}/datasets/upload", data=body, method="POST")
    r.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def _make_riset_csv(path, n=300, seed=7):
    import random

    rnd = random.Random(seed)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["service_quality", "satisfaction", "gender", "cabang", "member", "pre", "post"])
        for i in range(n):
            sq = round(rnd.gauss(4.0, 0.8), 2)
            st = round(min(5, max(1, 0.5 * sq + rnd.gauss(2.2, 0.5))), 2)
            g = "L" if i % 2 == 0 else "P"
            cb = ["A", "B", "C"][i % 3]
            mb = "ya" if rnd.random() < 0.6 else "tidak"
            pre = round(rnd.gauss(70, 8), 1)
            post = round(pre + rnd.gauss(5, 2), 1)
            w.writerow([sq, st, g, cb, mb, pre, post])


def persona_flow(p):
    name = p["name"]
    email, pw = f"{name}@synthetic.beta", "Synth12345"
    try:
        st, out = _req("POST", "/api/v1/auth/register", {"email": email, "password": pw, "name": name})
        token = json.loads(out)["access_token"] if st == 201 else None
        if not token:
            st, out = _req("POST", "/api/v1/auth/login", {"email": email, "password": pw})
            token = json.loads(out)["access_token"]
        check(name, "register/login", True)
    except Exception as e:
        return check(name, "register/login", False, e)
    try:
        st, out = _req("POST", "/api/v1/projects", {"title": f"Beta {name}", "research_type": "Skripsi"}, token)
        pid = json.loads(out)["id"]
        check(name, "create_project", st == 201)
    except Exception as e:
        return check(name, "create_project", False, e)
    csv_path = f"/tmp/opencode/synth_{name}.csv"
    _make_riset_csv(csv_path)
    st, up = _upload(token, pid, csv_path, "riset.csv")
    os.remove(csv_path)
    if st != 201:
        return check(name, "upload", False, f"HTTP {st}")
    dsid = up["dataset"]["id"]
    check(name, "upload", True, f"{up['profile']['rows']}x{up['profile']['cols']}")
    # variables: set first var Dependent
    try:
        st, out = _req("GET", f"/api/v1/datasets/{dsid}/versions/1/variables", token=token)
        vars_ = json.loads(out)
        _req("PATCH", f"/api/v1/variables/{vars_[0]['id']}", {"var_role": "Dependent"}, token)
        check(name, "variables", True)
    except Exception as e:
        check(name, "variables", False, e)
    # preprocess chain
    try:
        st, out = _req("POST", f"/api/v1/datasets/{dsid}/preprocess", {"base_version": 1, "operations": [{"op": "scale_standard", "column": "service_quality"}]}, token)
        j = json.loads(out)
        check(name, "preprocess", st == 201 and j.get("new_version") == 2, str(j)[:100])
    except Exception as e:
        check(name, "preprocess", False, e)
    for method, variables in p["methods"]:
        try:
            st, out = _req("POST", "/api/v1/analyses/run", {"project_id": pid, "dataset_id": dsid, "method": method, "variables": variables}, token)
            r = json.loads(out)
            res = r["result"]
            ok = st == 201 and res.get("formula_latex") and res.get("calculation") and ("assumptions" in res)
            check(name, f"run:{method}", ok, r["analysis_uid"])
            if not ok:
                continue
            uid = r["analysis_uid"]
            st2, out2 = _req("GET", f"/api/v1/analyses/{uid}/chart", token=token)
            check(name, f"chart:{method}", st2 == 200 and out2[:4] == b"\x89PNG")
            st3, out3 = _req("GET", f"/api/v1/analyses/{uid}/export?format=pdf", token=token)
            check(name, f"export:{method}", st3 == 200 and out3[:5] == b"%PDF-")
            st4, out4 = _req("POST", f"/api/v1/analyses/{uid}/rerun", token=token)
            rr = json.loads(out4)
            check(name, f"rerun:{method}", st4 == 201 and rr["result"].get("identical_to_original") is True)
        except Exception as e:
            check(name, f"run:{method}", False, e)
    # research log lists
    try:
        st, out = _req("GET", f"/api/v1/projects/{pid}/analyses", token=token)
        check(name, "research_log", st == 200 and len(json.loads(out)) >= len(p["methods"]))
    except Exception as e:
        check(name, "research_log", False, e)
    return pid, token


def probes(tokens):
    t0 = tokens[0]
    # isolation: user2 reads user1 analysis → 404
    try:
        st, out = _req("GET", "/api/v1/projects", token=tokens[0])
        p1 = json.loads(out)[0]["id"]
        st, out = _req("GET", f"/api/v1/projects/{p1}/analyses", token=tokens[0])
        uid1 = json.loads(out)[0]["analysis_uid"]
        st, _ = _req("GET", f"/api/v1/analyses/{uid1}", token=tokens[1])
        check("probe", "isolation_cross_user", st == 404, f"HTTP {st}")
    except Exception as e:
        check("probe", "isolation_cross_user", False, e)
    # invalid uploads
    open("/tmp/opencode/bad.exe", "w").write("x")
    st, _ = _upload(t0, "00000000-0000-0000-0000-000000000000", "/tmp/opencode/bad.exe")
    check("probe", "upload_exe_rejected", st in (400, 404, 422), f"HTTP {st}")
    os.remove("/tmp/opencode/bad.exe")
    # concurrency: 10 parallel runs
    st, out = _req("GET", "/api/v1/projects", token=t0)
    pid = json.loads(out)[0]["id"]
    st, out = _req("GET", f"/api/v1/projects/{pid}/datasets", token=t0)
    dsid = json.loads(out)[0]["id"]
    results = []

    def one(i):
        try:
            st, out = _req("POST", "/api/v1/analyses/run", {"project_id": pid, "dataset_id": dsid, "method": "descriptive", "variables": {"columns": ["service_quality"]}}, t0)
            results.append(st == 201)
        except Exception:
            results.append(False)

    ths = [threading.Thread(target=one, args=(i,)) for i in range(10)]
    [t.start() for t in ths]
    [t.join() for t in ths]
    check("probe", "concurrent_10", all(results) and len(results) == 10, f"{sum(results)}/10")
    # large dataset → async preprocess path (15k rows)
    big = "/tmp/opencode/synth_big.csv"
    _make_riset_csv(big, n=15000)
    st, up = _upload(t0, pid, big, "big.csv")
    os.remove(big)
    if st == 201:
        dsb = up["dataset"]["id"]
        st, out = _req("POST", f"/api/v1/datasets/{dsb}/preprocess", {"base_version": 1, "operations": [{"op": "scale_standard", "column": "service_quality"}]}, t0)
        j = json.loads(out)
        if j.get("job_id"):
            for _ in range(60):
                time.sleep(3)
                st2, out2 = _req("GET", f"/api/v1/jobs/{j['job_id']}", token=t0)
                if json.loads(out2).get("state") in ("SUCCESS", "FAILURE"):
                    break
            check("probe", "async_big", json.loads(out2).get("state") == "SUCCESS", json.loads(out2).get("state"))
        else:
            check("probe", "async_big", False, "not queued")
    else:
        check("probe", "async_big", False, f"upload HTTP {st}")


def main():
    t0 = time.time()
    tokens = []
    for p in PERSONAS:
        r = persona_flow(p)
        if isinstance(r, tuple):
            tokens.append(r[1])
    if tokens:
        probes(tokens)
    total = len(CHECKS)
    passed = sum(1 for c in CHECKS if c["ok"])
    leaks = [c for c in CHECKS if not c["ok"] and "isolation" in c["step"]]
    crit = [c for c in CHECKS if not c["ok"] and ("run:" in c["step"] or "rerun" in c["step"])]
    verdict = passed / total >= 0.9 and not crit and not leaks
    os.makedirs(OUTDIR, exist_ok=True)
    report = {"ts": time.strftime("%Y%m%d-%H%M%S"), "elapsed_s": round(time.time() - t0, 1), "passed": passed, "total": total, "verdict": "PASS" if verdict else "FAIL", "checks": CHECKS}
    with open(os.path.join(OUTDIR, f"report-{report['ts']}.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n== {passed}/{total} passed in {report['elapsed_s']}s → {report['verdict']} ==")
    return 0 if verdict else 1


if __name__ == "__main__":
    sys.exit(main())
