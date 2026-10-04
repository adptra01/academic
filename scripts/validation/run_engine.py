#!/usr/bin/env python3
"""Run all benchmark analyses against the engine, save outputs for R/SPSS comparison.
Stdlib only. Usage: python3 run_engine.py [BASE_URL] [EMAIL] [PASSWORD]
Output: docs/validation-evidence/engine_outputs.json
"""
import json
import mimetypes
import os
import sys
import urllib.request
import uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8100"
EMAIL = sys.argv[2] if len(sys.argv) > 2 else "validator@kampus.ac.id"
PASSWORD = sys.argv[3] if len(sys.argv) > 3 else "Validasi123"
HERE = os.path.dirname(os.path.abspath(__file__))
EV = os.path.normpath(os.path.join(HERE, "..", "..", "docs", "validation-evidence"))

PLAN = [
    ("bench_descriptive.csv", "descriptive", {"columns": ["v"]}, {}),
    ("bench_normality.csv", "normality", {"column": "v_normal"}, {}),
    ("bench_corr.csv", "pearson", {"x": "x", "y": "y"}, {}),
    ("bench_corr.csv", "spearman", {"x": "x", "y": "y"}, {}),
    ("bench_ttest_onesamp.csv", "ttest_1samp", {"column": "v", "mu": 100}, {}),
    ("bench_ttest_ind.csv", "ttest_ind", {"column": "v", "group": "g"}, {}),
    ("bench_ttest_welch.csv", "ttest_ind", {"column": "v", "group": "g"}, {}),
    ("bench_ttest_paired.csv", "ttest_paired", {"col1": "pre", "col2": "post"}, {}),
    ("bench_anova.csv", "anova_oneway", {"column": "v", "group": "g"}, {}),
    ("bench_chi2.csv", "chi2_independence", {"col1": "c1", "col2": "c2"}, {}),
    ("bench_gof.csv", "chi2_gof", {"column": "k"}, {}),
    ("bench_mannwhitney.csv", "mannwhitney", {"column": "v", "group": "g"}, {}),
    ("bench_wilcoxon.csv", "wilcoxon", {"col1": "pre", "col2": "post"}, {}),
    ("bench_kruskal.csv", "kruskal", {"column": "v", "group": "g"}, {}),
    ("bench_regression.csv", "linreg_simple", {"x": "x1", "y": "y"}, {}),
    ("bench_regression.csv", "linreg_multiple", {"xs": ["x1", "x2"], "y": "y"}, {}),
]


def _req(method, path, body=None, token=None, ctype="application/json"):
    data = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", ctype)
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(r) as resp:
        return resp.status, resp.read()


def _upload(path, token, project_id, filepath):
    boundary = uuid.uuid4().hex
    with open(filepath, "rb") as f:
        content = f.read()
    fname = os.path.basename(filepath)
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{fname}\"\r\n"
            f"Content-Type: {mimetypes.guess_type(fname)[0] or 'text/csv'}\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request(BASE + path, data=body, method="POST")
    r.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    r.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


def main():
    try:
        _, out = _req("POST", "/api/v1/auth/register", {"email": EMAIL, "password": PASSWORD, "name": "Validator"})
        token = json.loads(out)["access_token"]
    except Exception:
        _, out = _req("POST", "/api/v1/auth/login", {"email": EMAIL, "password": PASSWORD})
        token = json.loads(out)["access_token"]
    _, out = _req("POST", "/api/v1/projects", {"title": "Validation RC1", "research_type": "Paper"}, token)
    pid = json.loads(out)["id"]
    dsids = {}
    for fname, _, _, _ in PLAN:
        if fname not in dsids:
            up = _upload(f"/api/v1/projects/{pid}/datasets/upload", token, pid, os.path.join(EV, fname))
            dsids[fname] = up["dataset"]["id"]
            print(f"upload {fname}: {up['profile']['rows']}x{up['profile']['cols']}")
    results = []
    for fname, method, variables, params in PLAN:
        _, out = _req("POST", "/api/v1/analyses/run", {"project_id": pid, "dataset_id": dsids[fname], "method": method, "variables": variables, "params": params}, token)
        r = json.loads(out)
        results.append({"file": fname, "method": method, "variables": variables, "analysis_uid": r["analysis_uid"], "result": r["result"], "result_hash": r["result_hash"]})
        print(f"{method} on {fname}: {r['analysis_uid']}")
    with open(os.path.join(EV, "engine_outputs.json"), "w") as f:
        json.dump(results, f, indent=2)
    print("saved engine_outputs.json")


if __name__ == "__main__":
    main()
