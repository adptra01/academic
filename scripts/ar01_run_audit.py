#!/usr/bin/env python3
"""
AR-01 Audit Runner — Jalankan skenario penelitian via API dan bandingkan dengan referensi.

Usage:
    python scripts/ar01_run_audit.py --email validator@kampus.ac.id --password Validasi123
"""

import argparse
import csv
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests

# --- Konfigurasi -------------------------------------------------------------

API_BASE = os.getenv("AR01_API_BASE", "http://localhost:8100/api/v1")
SCENARIOS_DIR = Path("docs/ar-01-audit/scenarios")
RESULTS_DIR = Path("docs/ar-01-audit/results")
REFERENCE_DIR = Path("docs/ar-01-audit/reference_outputs")

TIMEOUT = 60  # detik

# --- Utilitas ----------------------------------------------------------------

def api_post(session: requests.Session, endpoint: str, json_data: dict) -> dict:
    url = f"{API_BASE}{endpoint}"
    resp = session.post(url, json=json_data, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def api_get(session: requests.Session, endpoint: str) -> dict:
    url = f"{API_BASE}{endpoint}"
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def api_post_file(session: requests.Session, endpoint: str, file_path: Path, data: dict) -> dict:
    url = f"{API_BASE}{endpoint}"
    with open(file_path, "rb") as f:
        files = {"file": (file_path.name, f, "text/csv")}
        resp = session.post(url, files=files, data=data, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def load_csv_rows(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

# --- Alur Audit per Skenario -------------------------------------------------

def run_scenario(session: requests.Session, project_id: str, scenario_name: str, csv_path: Path,
                 analyses: list[dict]) -> dict:
    """Upload dataset, jalankan analisis, simpan artefak lengkap."""
    scenario_dir = RESULTS_DIR / scenario_name
    scenario_dir.mkdir(parents=True, exist_ok=True)

    # 1. Upload dataset
    print(f"  📤 Upload {csv_path.name}...")
    upload_resp = api_post_file(
        session,
        f"/projects/{project_id}/datasets/upload",
        csv_path,
        data={"project_id": project_id}
    )
    dataset_id = upload_resp["dataset"]["id"]
    save_json(scenario_dir / "01_upload.json", upload_resp)

    # 2. Ambil detail dataset (versions, profile, variables)
    print(f"  📊 Profil dataset...")
    datasets = api_get(session, f"/projects/{project_id}/datasets")
    ds = next(d for d in datasets if d["id"] == dataset_id)
    save_json(scenario_dir / "02_dataset_detail.json", ds)

    # Gunakan versi terbaru (default v1)
    version = ds["versions"][-1]["version_number"] if ds["versions"] else 1

    # 3. Ambil variabel untuk referensi
    vars_resp = api_get(session, f"/datasets/{dataset_id}/versions/{version}/variables")
    save_json(scenario_dir / "03_variables.json", vars_resp)

    # 4. Jalankan setiap analisis
    results = {}
    for i, analysis_spec in enumerate(analyses):
        method = analysis_spec["method"]
        variables = analysis_spec["variables"]
        params = analysis_spec.get("params", {})

        print(f"  🔬 Analisis {i+1}: {method}...")
        run_resp = api_post(session, "/analyses/run", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "base_version": version,
            "method": method,
            "variables": variables,
            "params": params,
        })
        analysis_uid = run_resp["analysis_uid"]
        results[f"{method}_{i}"] = run_resp
        save_json(scenario_dir / f"04_result_{method}_{i}.json", run_resp)

        # Tunggu sebentar agar tidak overload
        time.sleep(0.5)

    # 4. Ekspor semua format untuk analisis terakhir (contoh)
    if results:
        last_uid = list(results.values())[-1]["analysis_uid"]
        for fmt in ["csv", "xlsx", "pdf", "docx", "tex", "json"]:
            try:
                print(f"  📄 Ekspor {fmt}...")
                export_resp = api_post(session, "/exports", {
                    "analysis_uid": last_uid,
                    "format": fmt,
                })
                save_json(scenario_dir / f"05_export_{fmt}.json", export_resp)
            except Exception as e:
                print(f"    ⚠️  Ekspor {fmt} gagal: {e}")

    # 5. Simpan summary
    summary = {
        "scenario": scenario_name,
        "csv_file": csv_path.name,
        "csv_sha256": sha256_file(csv_path),
        "dataset_id": dataset_id,
        "version_used": version,
        "analyses": list(results.keys()),
        "timestamp": time.time(),
    }
    save_json(scenario_dir / "00_summary.json", summary)

    return summary

# --- Main --------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="AR-01 Audit Runner")
    parser.add_argument("--email", required=True, help="Email validator")
    parser.add_argument("--password", required=True, help="Password validator")
    parser.add_argument("--api-base", default=API_BASE, help="Base URL API")
    args = parser.parse_args()

    global API_BASE
    API_BASE = args.api_base

    session = requests.Session()

    # Login
    print(f"🔐 Login as {args.email}...")
    login_resp = session.post(f"{API_BASE}/auth/login", json={
        "email": args.email,
        "password": args.password,
    })
    login_resp.raise_for_status()
    token = login_resp.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})

    # Buat project audit
    print("📁 Membuat project audit...")
    proj_resp = session.post(f"{API_BASE}/projects", json={
        "title": "AR-01 Academic Readiness Audit",
        "description": "Otomatisasi validasi skenario penelitian untuk audit kesiapan beta",
        "research_type": "Quantitative",
    })
    proj_resp.raise_for_status()
    project_id = proj_resp.json()["id"]
    print(f"   Project ID: {project_id}")

    # Definisi skenario & analisis yang diuji
    # Format: (scenario_name, csv_filename, [analysis_specs])
    scenarios = [
        # Scenario A: Independent groups
        ("A1_balanced_equal_var", "A1_balanced_equal_var.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "service_quality"}, "params": {"alpha": 0.05}},
            {"method": "mannwhitney", "variables": {"col1": "group", "col2": "service_quality"}, "params": {"alpha": 0.05}},
        ]),
        ("A2_unbalanced_unequal_var", "A2_unbalanced_unequal_var.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "service_quality"}, "params": {"alpha": 0.05}},
        ]),
        ("A3_skewed_outliers", "A3_skewed_outliers.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "service_quality"}, "params": {"alpha": 0.05}},
            {"method": "mannwhitney", "variables": {"col1": "group", "col2": "service_quality"}, "params": {"alpha": 0.05}},
        ]),
        ("A4_duplicate_id", "A4_duplicate_id.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "service_quality"}, "params": {"alpha": 0.05}},
        ]),

        # Scenario B: Paired
        ("B1_complete_pairs", "B1_complete_pairs.csv", [
            {"method": "ttest_paired", "variables": {"col1": "pre_score", "col2": "post_score"}, "params": {"alpha": 0.05}},
            {"method": "wilcoxon", "variables": {"col1": "pre_score", "col2": "post_score"}, "params": {"alpha": 0.05}},
        ]),
        ("B2_incomplete_pairs", "B2_incomplete_pairs.csv", [
            {"method": "ttest_paired", "variables": {"col1": "pre_score", "col2": "post_score"}, "params": {"alpha": 0.05}},
        ]),
        ("B3_duplicate_id", "B3_duplicate_id.csv", [
            {"method": "ttest_paired", "variables": {"col1": "pre_score", "col2": "post_score"}, "params": {"alpha": 0.05}},
        ]),
        ("B4_shuffled_order", "B4_shuffled_order.csv", [
            {"method": "ttest_paired", "variables": {"col1": "pre_score", "col2": "post_score"}, "params": {"alpha": 0.05}},
        ]),

        # Scenario C: Categorical
        ("C1_standard", "C1_standard.csv", [
            {"method": "chi2_independence", "variables": {"col1": "service_type", "col2": "satisfaction"}, "params": {"alpha": 0.05}},
        ]),
        ("C2_low_expected", "C2_low_expected.csv", [
            {"method": "chi2_independence", "variables": {"col1": "service_type", "col2": "satisfaction"}, "params": {"alpha": 0.05}},
        ]),
        ("C3_label_inconsistency", "C3_label_inconsistency.csv", [
            {"method": "chi2_independence", "variables": {"col1": "service_type", "col2": "satisfaction"}, "params": {"alpha": 0.05}},
        ]),
        ("C4_sparse", "C4_sparse.csv", [
            {"method": "chi2_independence", "variables": {"col1": "service_type", "col2": "satisfaction"}, "params": {"alpha": 0.05}},
        ]),

        # Scenario D: Regression
        ("D1_simple_linear", "D1_simple_linear.csv", [
            {"method": "linreg_simple", "variables": {"x": "price", "y": "sales_volume"}, "params": {"alpha": 0.05}},
        ]),
        ("D2_multicollinearity", "D2_multicollinearity.csv", [
            {"method": "linreg_multiple", "variables": {"x": ["price", "rating"], "y": "sales_volume"}, "params": {"alpha": 0.05}},
        ]),
        ("D3_outlier_leverage", "D3_outlier_leverage.csv", [
            {"method": "linreg_multiple", "variables": {"x": ["price", "rating"], "y": "sales_volume"}, "params": {"alpha": 0.05}},
        ]),
        ("D4_constant_predictor", "D4_constant_predictor.csv", [
            {"method": "linreg_multiple", "variables": {"x": ["price", "rating"], "y": "sales_volume"}, "params": {"alpha": 0.05}},
        ]),
        ("D5_missing", "D5_missing.csv", [
            {"method": "linreg_multiple", "variables": {"x": ["price", "rating"], "y": "sales_volume"}, "params": {"alpha": 0.05}},
        ]),

        # Scenario E: Data Quality
        ("E1_missing", "E1_missing.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "score"}, "params": {"alpha": 0.05}},
        ]),
        ("E2_duplicate_id", "E2_duplicate_id.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "score"}, "params": {"alpha": 0.05}},
        ]),
        ("E3_duplicate_rows", "E3_duplicate_rows.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "score"}, "params": {"alpha": 0.05}},
        ]),
        ("E5_constant_column", "E5_constant_column.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "score"}, "params": {"alpha": 0.05}},
        ]),
        ("E6_outlier", "E6_outlier.csv", [
            {"method": "ttest_1samp", "variables": {"column": "score"}, "params": {"mu": 15, "alpha": 0.05}},
        ]),
        ("E7_likert", "E7_likert.csv", [
            {"method": "pearson", "variables": {"col1": "q1", "col2": "q2"}, "params": {"alpha": 0.05}},
        ]),
        ("E8_combined", "E8_combined.csv", [
            {"method": "ttest_ind", "variables": {"col1": "group", "col2": "score"}, "params": {"alpha": 0.05}},
        ]),
    ]

    # Jalankan semua skenario
    all_summaries = []
    for scenario_name, csv_file, analyses in scenarios:
        csv_path = SCENARIOS_DIR / csv_file
        if not csv_path.exists():
            print(f"⚠️  File tidak ditemukan: {csv_path}, skip...")
            continue

        print(f"\n{'='*60}")
        print(f"🧪 SKENARIO: {scenario_name}")
        print(f"{'='*60}")

        try:
            summary = run_scenario(session, project_id, scenario_name, csv_path, analyses)
            all_summaries.append(summary)
            print(f"✅ Selesai: {scenario_name}")
        except Exception as e:
            print(f"❌ GAGAL: {scenario_name} — {e}")
            all_summaries.append({"scenario": scenario_name, "error": str(e)})

    # Simpan ringkasan keseluruhan
    save_json(RESULTS_DIR / "AUDIT_SUMMARY.json", {
        "project_id": project_id,
        "total_scenarios": len(scenarios),
        "completed": len([s for s in all_summaries if "error" not in s]),
        "failed": len([s for s in all_summaries if "error" in s]),
        "scenarios": all_summaries,
    })

    print(f"\n{'='*60}")
    print(f"🎉 AUDIT SELESAI")
    print(f"{'='*60}")
    print(f"Total skenario: {len(scenarios)}")
    print(f"Berhasil: {len([s for s in all_summaries if 'error' not in s])}")
    print(f"Gagal: {len([s for s in all_summaries if 'error' in s])}")
    print(f"Hasil di: {RESULTS_DIR}")

if __name__ == "__main__":
    main()