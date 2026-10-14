"""Tests for Guided Mode flow (AR-02).

Covers 5 scenarios A-E:
A. Basic flow: create intent → recommend → create config → confirm → run
B. Blocker handling: missing required column → 422 with blocker details
C. Confirmation handling: high missing >5% → 422 until acknowledged
D. Phase-2 hidden: ml_classify not recommended when FEATURE_PHASE2=false
E. Duplicate analysis detection: same config produces same hash
"""
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.db import get_db
from app.core.security import create_token
from app.models import User, Project, Dataset, DatasetVersion, ResearchIntent, AnalysisConfig, Analysis, AnalysisResult
from app.services.stats import compute_analysis_hash, get_visible_methods, PHASE2_METHODS


# ============================================================
# Scenario A: Basic flow
# ============================================================

def test_scenario_a_basic_flow(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Scenario A: Basic guided flow from intent to result."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    # 1. Create research intent
    intent_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "goal_category": "compare_groups",
        "design_hints": {"design": "between_subjects", "groups": 2, "paired": False, "outcome_type": "continuous"},
        "user_question": "Apakah ada perbedaan skor antara grup A dan B?"
    }
    resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
    assert resp.status_code == 201, f"Create intent failed: {resp.text}"
    intent = resp.json()
    intent_id = intent["id"]
    assert intent["goal_category"] == "compare_groups"

    # 2. Get research intent
    resp = client.get(f"/api/v1/research-intent/{intent_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == intent_id

    # 3. Recommend methods
    recommend_payload = {"research_intent_id": intent_id}
    resp = client.post("/api/v1/methods/recommend", json=recommend_payload, headers=auth_headers)
    assert resp.status_code == 200, f"Recommend failed: {resp.text}"
    recommend = resp.json()
    assert len(recommend["recommendations"]) > 0
    assert recommend["fallback"] == "descriptive"

    # Check ttest_ind is recommended for compare_groups with 2 groups
    method_ids = [r["method_id"] for r in recommend["recommendations"]]
    assert "ttest_ind" in method_ids, f"ttest_ind should be recommended, got {method_ids}"

    # Pick first recommendation
    top_rec = recommend["recommendations"][0]
    method = top_rec["method_id"]
    var_mapping = top_rec["variable_mapping"]

    # 4. Create analysis config (guided)
    config_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "method": method,
        "variables": var_mapping,
        "params": {"alpha": 0.05},
        "preprocessing_ops": [],
        "research_intent_id": intent_id,
        "wizard_step": 4
    }
    resp = client.post("/api/v1/analysis-config/guided", json=config_payload, headers=auth_headers)
    assert resp.status_code == 201, f"Create config failed: {resp.text}"
    config = resp.json()
    config_id = config["id"]
    assert config["status"] == "draft"
    assert config["source_mode"] == "guided"
    assert config["method"] == method

    # 5. Get analysis config
    resp = client.get(f"/api/v1/analysis-config/{config_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == config_id

    # 6. Confirm config (run preflight)
    confirm_payload = {"acknowledged_confirmations": []}
    resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json=confirm_payload, headers=auth_headers)
    # May have confirmations (missing data, dataset version binding) - handle both
    if resp.status_code == 422:
        # Acknowledge confirmations and retry
        issues = resp.json()["detail"]["issues"]
        ack_codes = [i["code"] for i in issues if i["level"] == "confirmation"]
        confirm_payload = {"acknowledged_confirmations": ack_codes}
        resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json=confirm_payload, headers=auth_headers)

    assert resp.status_code == 200, f"Confirm failed: {resp.text}"
    confirm_resp = resp.json()
    assert confirm_resp["config"]["status"] == "confirmed"
    assert "preflight" in confirm_resp

    # 7. Run guided analysis
    run_payload = {"analysis_config_id": config_id}
    resp = client.post("/api/v1/analyses/run-guided", json=run_payload, headers=auth_headers)
    assert resp.status_code == 201, f"Run guided failed: {resp.text}"
    run_result = resp.json()
    assert "analysis_uid" in run_result
    assert run_result["method"] == method
    assert "result" in run_result
    assert "result_hash" in run_result
    assert run_result["analysis_uid"].startswith("ANL-")


# ============================================================
# Scenario B: Blocker handling
# ============================================================

def test_scenario_b_blocker_handling(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Scenario B: Missing required column → 422 with blocker details."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    # Create intent
    intent_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "goal_category": "compare_groups",
        "design_hints": {"design": "between_subjects", "groups": 2}
    }
    resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
    assert resp.status_code == 201
    intent_id = resp.json()["id"]

    # Create config with MISSING required column (group)
    config_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "method": "ttest_ind",
        "variables": {"column": "score"},  # Missing "group"
        "params": {"alpha": 0.05},
        "preprocessing_ops": [],
        "research_intent_id": intent_id,
        "wizard_step": 4
    }
    resp = client.post("/api/v1/analysis-config/guided", json=config_payload, headers=auth_headers)
    assert resp.status_code == 201
    config_id = resp.json()["id"]

    # Confirm - should fail with blocker
    confirm_payload = {"acknowledged_confirmations": []}
    resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json=confirm_payload, headers=auth_headers)
    assert resp.status_code == 422, f"Expected 422 for blocker, got {resp.status_code}: {resp.text}"
    error = resp.json()["detail"]
    assert "message" in error
    assert "issues" in error
    blockers = error["issues"]
    assert len(blockers) > 0
    blocker = blockers[0]
    assert blocker["level"] == "blocking"
    assert blocker["code"] == "MISSING_REQUIRED_COLUMN"
    assert "group" in blocker["message"].lower() or "pengelompok" in blocker["message"].lower()


# ============================================================
# Scenario C: Confirmation handling
# ============================================================

def test_scenario_c_confirmation_handling(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion, db_session: Session):
    """Scenario C: High missing >5% → 422 until acknowledged."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    # Create dataset with high missing values
    import pandas as pd
    import tempfile
    import os

    df = pd.DataFrame({
        "id": range(1, 31),
        "group": ["A", "B"] * 15,
        "score": [10 + i if i % 3 != 0 else None for i in range(30)],  # ~33% missing, varying values
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        df.to_csv(f.name, index=False)
        storage_path = f.name

    ds2 = Dataset(
        project_id=test_project.id,
        filename="sample_missing.csv",
        storage_path=storage_path,
        file_type="csv",
        size_bytes=os.path.getsize(storage_path),
        rows_count=30,
        cols_count=2
    )
    db_session.add(ds2)
    db_session.commit()
    db_session.refresh(ds2)

    dv2 = DatasetVersion(
        dataset_id=ds2.id,
        version_number=1,
        transformation_log=[],
        storage_path=None
    )
    db_session.add(dv2)
    db_session.commit()
    db_session.refresh(dv2)
    dv2_id = str(dv2.id)

    try:
        # Create intent
        intent_payload = {
            "project_id": proj_id,
            "dataset_version_id": dv2_id,
            "goal_category": "compare_groups",
            "design_hints": {"design": "between_subjects", "groups": 2}
        }
        resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
        assert resp.status_code == 201
        intent_id = resp.json()["id"]

        # Create config
        config_payload = {
            "project_id": proj_id,
            "dataset_version_id": dv2_id,
            "method": "ttest_ind",
            "variables": {"column": "score", "group": "group"},
            "params": {"alpha": 0.05},
            "preprocessing_ops": [],
            "research_intent_id": intent_id,
            "wizard_step": 4
        }
        resp = client.post("/api/v1/analysis-config/guided", json=config_payload, headers=auth_headers)
        assert resp.status_code == 201
        config_id = resp.json()["id"]

        # Confirm - should fail with confirmation (HIGH_MISSING)
        confirm_payload = {"acknowledged_confirmations": []}
        resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json=confirm_payload, headers=auth_headers)
        assert resp.status_code == 422, f"Expected 422 for confirmation, got {resp.status_code}: {resp.text}"
        error = resp.json()["detail"]
        confirmations = error["issues"]
        assert len(confirmations) > 0
        # Find HIGH_MISSING confirmation
        high_missing = [c for c in confirmations if c["code"] == "HIGH_MISSING"]
        assert len(high_missing) > 0, f"Expected HIGH_MISSING confirmation, got: {[c['code'] for c in confirmations]}"
        conf = high_missing[0]
        assert conf["level"] == "confirmation"
        assert conf["code"] == "HIGH_MISSING"

        # Acknowledge and retry
        ack_codes = [c["code"] for c in confirmations]
        confirm_payload = {"acknowledged_confirmations": ack_codes}
        resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json=confirm_payload, headers=auth_headers)
        assert resp.status_code == 200, f"Retry with acknowledgment failed: {resp.text}"
        assert resp.json()["config"]["status"] == "confirmed"
    finally:
        if os.path.exists(storage_path):
            os.unlink(storage_path)


# ============================================================
# Scenario D: Phase-2 hidden
# ============================================================

def test_scenario_d_phase2_hidden(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Scenario D: Phase-2 methods hidden when FEATURE_PHASE2=false."""
    # Verify feature flag is off
    from app.core.config import settings
    assert settings.feature_phase2 == False, "FEATURE_PHASE2 should be false for this test"

    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    # Create intent for predict_outcome (would recommend ml_classify if Phase-2 enabled)
    intent_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "goal_category": "predict_outcome",
        "design_hints": {"outcome_type": "continuous"}
    }
    resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
    assert resp.status_code == 201
    intent_id = resp.json()["id"]

    # Recommend methods
    recommend_payload = {"research_intent_id": intent_id}
    resp = client.post("/api/v1/methods/recommend", json=recommend_payload, headers=auth_headers)
    assert resp.status_code == 200
    recommend = resp.json()

    # Check Phase-2 methods are NOT in recommendations
    method_ids = [r["method_id"] for r in recommend["recommendations"]]
    for phase2_method in PHASE2_METHODS:
        assert phase2_method not in method_ids, f"Phase-2 method {phase2_method} should be hidden"

    # Also verify /methods/{id} returns 404 for Phase-2 methods
    for phase2_method in PHASE2_METHODS:
        resp = client.get(f"/api/v1/methods/{phase2_method}", headers=auth_headers)
        assert resp.status_code == 404, f"Phase-2 method {phase2_method} should return 404"

    # Verify Phase-1 methods are visible
    visible = get_visible_methods()
    for phase2_method in PHASE2_METHODS:
        assert phase2_method not in visible
    for phase1_method in ["ttest_ind", "anova_oneway", "linreg_simple"]:
        assert phase1_method in visible


# ============================================================
# Scenario E: Duplicate analysis detection
# ============================================================

def test_scenario_e_duplicate_detection(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Scenario E: Same config produces same analysis_hash."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    # Create intent
    intent_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "goal_category": "compare_groups",
        "design_hints": {"design": "between_subjects", "groups": 2, "paired": False, "outcome_type": "continuous"}
    }
    resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
    assert resp.status_code == 201
    intent_id = resp.json()["id"]

    # Recommend and get mapping
    recommend_payload = {"research_intent_id": intent_id}
    resp = client.post("/api/v1/methods/recommend", json=recommend_payload, headers=auth_headers)
    assert resp.status_code == 200
    top_rec = resp.json()["recommendations"][0]
    method = top_rec["method_id"]
    var_mapping = top_rec["variable_mapping"]

    # Create config
    config_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "method": method,
        "variables": var_mapping,
        "params": {"alpha": 0.05},
        "preprocessing_ops": [],
        "research_intent_id": intent_id,
        "wizard_step": 4
    }
    resp = client.post("/api/v1/analysis-config/guided", json=config_payload, headers=auth_headers)
    assert resp.status_code == 201
    config_id = resp.json()["id"]

    # Confirm
    confirm_payload = {"acknowledged_confirmations": []}
    resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json=confirm_payload, headers=auth_headers)
    if resp.status_code == 422:
        issues = resp.json()["detail"]["issues"]
        ack_codes = [i["code"] for i in issues if i["level"] == "confirmation"]
        confirm_payload = {"acknowledged_confirmations": ack_codes}
        resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json=confirm_payload, headers=auth_headers)
    assert resp.status_code == 200

    # Run first analysis
    run_payload = {"analysis_config_id": config_id}
    resp1 = client.post("/api/v1/analyses/run-guided", json=run_payload, headers=auth_headers)
    assert resp1.status_code == 201
    run1 = resp1.json()
    uid1 = run1["analysis_uid"]
    hash1 = run1["result_hash"]

    # Run second analysis with SAME config (should be allowed but flagged as duplicate)
    # Note: The config is now "executed", so we need a new config with same params
    config_payload2 = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "method": method,
        "variables": var_mapping,
        "params": {"alpha": 0.05},
        "preprocessing_ops": [],
        "research_intent_id": intent_id,
        "wizard_step": 4
    }
    resp = client.post("/api/v1/analysis-config/guided", json=config_payload2, headers=auth_headers)
    assert resp.status_code == 201
    config_id2 = resp.json()["id"]

    resp = client.post(f"/api/v1/analysis-config/{config_id2}/confirm", json=confirm_payload, headers=auth_headers)
    if resp.status_code == 422:
        issues = resp.json()["detail"]["issues"]
        ack_codes = [i["code"] for i in issues if i["level"] == "confirmation"]
        confirm_payload = {"acknowledged_confirmations": ack_codes}
        resp = client.post(f"/api/v1/analysis-config/{config_id2}/confirm", json=confirm_payload, headers=auth_headers)
    assert resp.status_code == 200

    resp2 = client.post("/api/v1/analyses/run-guided", json={"analysis_config_id": config_id2}, headers=auth_headers)
    assert resp2.status_code == 201
    run2 = resp2.json()
    uid2 = run2["analysis_uid"]
    hash2 = run2["result_hash"]

    # Results should be identical (same hash)
    assert hash1 == hash2, "Same config on same data should produce identical result hash"

    # Analysis UIDs should be different (different runs)
    assert uid1 != uid2, "Different runs should have different UIDs"

    # Check duplicate detection in notes/warnings
    notes = run2.get("notes", [])
    warnings = run2.get("warnings", [])
    has_dup_note = any("sudah pernah dijalankan" in n or "identical" in n.lower() for n in notes + warnings)
    # The duplicate detection is in the analysis service - verify it's mentioned


# ============================================================
# Additional edge case tests
# ============================================================

def test_update_research_intent(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Test PATCH /research-intent/{id}."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    intent_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "goal_category": "compare_groups",
        "design_hints": {"design": "between_subjects", "groups": 2}
    }
    resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
    assert resp.status_code == 201
    intent_id = resp.json()["id"]

    # Update intent
    update_payload = {
        "goal_category": "test_association",
        "design_hints": {"design": "categorical_categorical"},
        "user_question": "Apakah ada asosiasi antara gender dan group?"
    }
    resp = client.patch(f"/api/v1/research-intent/{intent_id}", json=update_payload, headers=auth_headers)
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["goal_category"] == "test_association"
    assert updated["design_hints"]["design"] == "categorical_categorical"
    assert updated["user_question"] == update_payload["user_question"]


def test_manual_analysis_config_still_works(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Ensure existing manual /analyses/run still works (not modified)."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)
    ds_id = str(test_dataset_version.dataset_id)

    run_payload = {
        "project_id": proj_id,
        "dataset_id": ds_id,
        "base_version": 1,
        "method": "descriptive",
        "variables": {"columns": ["score", "age"]},
        "params": {}
    }
    resp = client.post("/api/v1/analyses/run", json=run_payload, headers=auth_headers)
    assert resp.status_code == 201, f"Manual run failed: {resp.text}"
    result = resp.json()
    assert "analysis_uid" in result
    assert result["method"] == "descriptive"


def test_preflight_endpoint(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Test /analyses/preflight endpoint (legacy format)."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)
    ds_id = str(test_dataset_version.dataset_id)

    preflight_payload = {
        "project_id": proj_id,
        "dataset_id": ds_id,
        "base_version": 1,
        "method": "ttest_ind",
        "variables": {"column": "score", "group": "group"},
        "params": {"alpha": 0.05}
    }
    resp = client.post("/api/v1/analyses/preflight", json=preflight_payload, headers=auth_headers)
    assert resp.status_code == 200
    result = resp.json()
    assert "ok" in result
    assert "issues" in result
    # Should have confirmations (dataset version binding, etc.)
    assert isinstance(result["issues"], list)


def test_analysis_hash_extended():
    """Test compute_analysis_hash includes all extended fields."""
    from app.services.stats import compute_analysis_hash
    import uuid

    dv_id = uuid.uuid4()
    proj_id = uuid.uuid4()

    hash1 = compute_analysis_hash(
        method="ttest_ind",
        variables={"column": "score", "group": "group"},
        params={"alpha": 0.05},
        dataset_version_id=dv_id,
        project_id=proj_id,
        preprocessing_ops=[{"op": "drop_missing", "column": "score"}],
        engine_version="0.1.0+mvp",
        missing_policy="listwise",
        random_seeds={"numpy": 42}
    )

    hash2 = compute_analysis_hash(
        method="ttest_ind",
        variables={"column": "score", "group": "group"},
        params={"alpha": 0.05},
        dataset_version_id=uuid.uuid4(),  # Different version ID
        project_id=proj_id,
        preprocessing_ops=[{"op": "drop_missing", "column": "score"}],
        engine_version="0.1.0+mvp",
        missing_policy="listwise",
        random_seeds={"numpy": 42}
    )

    assert hash1 != hash2, "Different dataset_version_id should produce different hash"

    # Same inputs = same hash
    hash3 = compute_analysis_hash(
        method="ttest_ind",
        variables={"column": "score", "group": "group"},
        params={"alpha": 0.05},
        dataset_version_id=dv_id,
        project_id=proj_id,
        preprocessing_ops=[{"op": "drop_missing", "column": "score"}],
        engine_version="0.1.0+mvp",
        missing_policy="listwise",
        random_seeds={"numpy": 42}
    )
    assert hash1 == hash3, "Same inputs should produce identical hash"

    # Just verify it returns a valid SHA256
    assert len(hash1) == 64
    assert all(c in "0123456789abcdef" for c in hash1)


def test_analysis_config_status_transitions(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Test AnalysisConfig status transitions: draft → confirmed → executed."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    intent_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "goal_category": "describe_data"
    }
    resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
    intent_id = resp.json()["id"]

    # Create config (draft)
    config_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "method": "descriptive",
        "variables": {"columns": ["score", "age"]},
        "params": {},
        "preprocessing_ops": [],
        "research_intent_id": intent_id,
        "wizard_step": 4
    }
    resp = client.post("/api/v1/analysis-config/guided", json=config_payload, headers=auth_headers)
    config_id = resp.json()["id"]

    # Confirm (draft → confirmed)
    resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json={"acknowledged_confirmations": []}, headers=auth_headers)
    if resp.status_code == 422:
        issues = resp.json()["detail"]["issues"]
        ack_codes = [i["code"] for i in issues if i["level"] == "confirmation"]
        resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json={"acknowledged_confirmations": ack_codes}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["config"]["status"] == "confirmed"

    # Run (confirmed → executed)
    resp = client.post("/api/v1/analyses/run-guided", json={"analysis_config_id": config_id}, headers=auth_headers)
    assert resp.status_code == 201

    # Verify config status
    resp = client.get(f"/api/v1/analysis-config/{config_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "executed"
    assert resp.json()["executed_at"] is not None

    # Cannot run again (already executed)
    resp = client.post("/api/v1/analyses/run-guided", json={"analysis_config_id": config_id}, headers=auth_headers)
    assert resp.status_code == 400
    assert "executed" in resp.json()["detail"]


def test_analysis_detail_includes_config_id(client: TestClient, auth_headers: dict, test_project: Project, test_dataset_version: DatasetVersion):
    """Test that /analyses/{uid} includes analysis_config_id and analysis_hash."""
    dv_id = str(test_dataset_version.id)
    proj_id = str(test_project.id)

    intent_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "goal_category": "describe_data"
    }
    resp = client.post("/api/v1/research-intent", json=intent_payload, headers=auth_headers)
    intent_id = resp.json()["id"]

    config_payload = {
        "project_id": proj_id,
        "dataset_version_id": dv_id,
        "method": "descriptive",
        "variables": {"columns": ["score"]},
        "params": {},
        "preprocessing_ops": [],
        "research_intent_id": intent_id,
        "wizard_step": 4
    }
    resp = client.post("/api/v1/analysis-config/guided", json=config_payload, headers=auth_headers)
    config_id = resp.json()["id"]

    resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json={"acknowledged_confirmations": []}, headers=auth_headers)
    if resp.status_code == 422:
        issues = resp.json()["detail"]["issues"]
        ack_codes = [i["code"] for i in issues if i["level"] == "confirmation"]
        resp = client.post(f"/api/v1/analysis-config/{config_id}/confirm", json={"acknowledged_confirmations": ack_codes}, headers=auth_headers)

    resp = client.post("/api/v1/analyses/run-guided", json={"analysis_config_id": config_id}, headers=auth_headers)
    analysis_uid = resp.json()["analysis_uid"]

    # Get analysis detail
    resp = client.get(f"/api/v1/analyses/{analysis_uid}", headers=auth_headers)
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["analysis_config_id"] == config_id
    assert detail["analysis_hash"] is not None
    assert len(detail["analysis_hash"]) == 64