"""Guided mode router: 7 endpoints for wizard flow (US-030..036)."""
import uuid
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.models import (
    Project, Dataset, DatasetVersion, User,
    ResearchIntent, AnalysisConfig, Analysis, AnalysisResult, ResearchLog
)
from app.services.stats import (
    METHOD_IDS, METHOD_NAMES, get_visible_methods,
    new_uid as make_uid, result_hash, run_analysis, compute_analysis_hash
)
from app.services.stats.preflight import preflight
from app.services.version_io import load_version_df
from app.services.advice.rules import advise

router = APIRouter(prefix="/api/v1", tags=["guided"])


# ============================================================
# Pydantic Models
# ============================================================

class ResearchIntentCreate(BaseModel):
    project_id: uuid.UUID
    dataset_version_id: uuid.UUID
    goal_category: str  # compare_groups, test_association, predict_outcome, explore_structure, describe_data, custom
    design_hints: dict = Field(default_factory=dict)
    user_question: str | None = None


class ResearchIntentUpdate(BaseModel):
    goal_category: str | None = None
    design_hints: dict | None = None
    user_question: str | None = None


class ResearchIntentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    dataset_version_id: uuid.UUID
    goal_category: str
    design_hints: dict
    user_question: str | None
    created_at: datetime
    updated_at: datetime


class VariableMapping(BaseModel):
    """Maps method variable roles to dataset columns."""
    mapping: dict[str, str]


class RecommendationItem(BaseModel):
    method_id: str
    confidence: float
    variable_mapping: dict[str, str]
    assumptions_check: dict[str, str] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)


class MethodRecommendRequest(BaseModel):
    research_intent_id: uuid.UUID
    dataset_profile_id: uuid.UUID | None = None  # Optional: specific profile version


class MethodRecommendResponse(BaseModel):
    recommendations: list[RecommendationItem]
    fallback: str


class PreprocessingOp(BaseModel):
    op: str
    column: str | None = None
    params: dict = Field(default_factory=dict)


class AnalysisConfigCreateGuided(BaseModel):
    project_id: uuid.UUID
    dataset_version_id: uuid.UUID
    method: str
    variables: dict
    params: dict
    preprocessing_ops: list[PreprocessingOp] = Field(default_factory=list)
    research_intent_id: uuid.UUID
    wizard_step: int = Field(default=4, ge=1, le=5)


class AnalysisConfigCreateManual(BaseModel):
    project_id: uuid.UUID
    dataset_version_id: uuid.UUID
    method: str
    variables: dict
    params: dict
    preprocessing_ops: list[PreprocessingOp] = Field(default_factory=list)


class ConfigConfirmRequest(BaseModel):
    acknowledged_confirmations: list[str] = Field(default_factory=list)


class ConfigConfirmResponse(BaseModel):
    config: dict
    preflight: dict


class RunInGuided(BaseModel):
    analysis_config_id: uuid.UUID


class RunOut(BaseModel):
    analysis_uid: str
    method: str
    result: dict
    result_hash: str
    warnings: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


# ============================================================
# Helper: Method Recommender
# ============================================================

GOAL_TO_DESIGN_MAP = {
    "compare_groups": ["between_subjects", "within_subjects", "mixed"],
    "test_association": ["test_association", "categorical_categorical", "one_categorical"],
    "predict_outcome": ["predict_outcome"],
    "explore_structure": ["explore_structure"],
    "describe_data": ["describe_data", "explore_structure"],
    "custom": [],
}

METHOD_DESIGNS = {
    "descriptive": ["describe_data", "explore_structure"],
    "normality": ["test_assumption", "explore_structure"],
    "pearson": ["test_association", "explore_structure"],
    "spearman": ["test_association", "explore_structure"],
    "ttest_1samp": ["compare_groups", "test_assumption"],
    "ttest_ind": ["between_subjects", "two_groups"],
    "ttest_paired": ["within_subjects", "two_conditions", "paired_design"],
    "anova_oneway": ["between_subjects", "three_plus_groups"],
    "chi2_independence": ["test_association", "categorical_categorical"],
    "chi2_gof": ["test_assumption", "one_categorical"],
    "mannwhitney": ["between_subjects", "two_groups", "nonparametric"],
    "wilcoxon": ["within_subjects", "two_conditions", "paired_design", "nonparametric"],
    "kruskal": ["between_subjects", "three_plus_groups", "nonparametric"],
    "linreg_simple": ["predict_outcome", "test_association"],
    "linreg_multiple": ["predict_outcome", "test_association"],
    "ml_classify": ["predict_outcome"],
    "ml_cluster": ["explore_structure"],
    "text_tfidf": ["explore_structure"],
    "text_lda": ["explore_structure"],
    "apriori": ["explore_structure"],
}


def _score_method(method: str, goal_category: str, design_hints: dict) -> float:
    """Score method based on goal and design hints."""
    score = 0.0
    designs = METHOD_DESIGNS.get(method, [])
    goal_designs = GOAL_TO_DESIGN_MAP.get(goal_category, [])

    # Match goal category to method designs
    for d in designs:
        if d in goal_designs:
            score += 1.0

    # Design hints matching
    design = design_hints.get("design", "")
    if design and design in designs:
        score += 0.5

    groups = design_hints.get("groups", 0)
    paired = design_hints.get("paired", False)
    outcome_type = design_hints.get("outcome_type", "")

    # Group-based matching
    if groups == 2:
        if method in ("ttest_ind", "ttest_paired", "mannwhitney", "wilcoxon", "chi2_independence"):
            score += 0.3
        if paired and method in ("ttest_paired", "wilcoxon"):
            score += 0.5
        elif not paired and method in ("ttest_ind", "mannwhitney"):
            score += 0.3
    elif groups >= 3:
        if method in ("anova_oneway", "kruskal"):
            score += 0.5

    # Outcome type matching
    if outcome_type == "continuous" and method in ("ttest_ind", "ttest_paired", "anova_oneway", "pearson", "spearman", "linreg_simple", "linreg_multiple"):
        score += 0.2
    elif outcome_type in ("binary", "ordinal", "nominal") and method in ("chi2_independence", "chi2_gof", "mannwhitney", "wilcoxon", "kruskal", "ml_classify"):
        score += 0.2
    elif outcome_type == "count" and method in ("apriori",):
        score += 0.2

    # Predict outcome
    if goal_category == "predict_outcome" and method in ("linreg_simple", "linreg_multiple", "ml_classify"):
        score += 0.5

    # Explore structure
    if goal_category == "explore_structure" and method in ("ml_cluster", "text_lda", "apriori", "descriptive"):
        score += 0.5

    # Describe data
    if goal_category == "describe_data" and method == "descriptive":
        score += 1.0

    return score


def _infer_variable_mapping(df: pd.DataFrame, method: str, design_hints: dict) -> dict[str, str]:
    """Auto-infer variable mapping from dataset columns and method spec."""
    from app.routers.analyses import METHOD_SPEC

    spec = METHOD_SPEC.get(method, {})
    variables_spec = spec.get("variables", {})
    mapping = {}

    # Identify column types in dataset
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]

    for var_key, var_spec in variables_spec.items():
        kind = var_spec.get("kind", "any")

        if kind == "numeric" and numeric_cols:
            mapping[var_key] = numeric_cols[0]
        elif kind in ("categorical", "group") and categorical_cols:
            mapping[var_key] = categorical_cols[0]
        elif kind == "text":
            text_cols = [c for c in df.columns if df[c].dtype == object or str(df[c].dtype) in ("string", "category")]
            if text_cols:
                mapping[var_key] = text_cols[0]
        elif kind == "any" and numeric_cols:
            mapping[var_key] = numeric_cols[0]

    return mapping


# ============================================================
# Helpers
# ============================================================

def _verify_project_and_version(db: Session, user: User, project_id: uuid.UUID, dataset_version_id: uuid.UUID) -> tuple[Project, DatasetVersion, Dataset]:
    """Verify project ownership and dataset version belongs to project."""
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project tidak ditemukan")

    dv = db.query(DatasetVersion).join(Dataset).filter(
        DatasetVersion.id == dataset_version_id,
        Dataset.project_id == project_id
    ).first()
    if not dv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset version tidak ditemukan di project ini")

    ds = db.query(Dataset).filter(Dataset.id == dv.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan")

    return proj, dv, ds


def _build_config_response(config: AnalysisConfig) -> dict:
    """Build standardized config response."""
    return {
        "id": str(config.id),
        "project_id": str(config.project_id),
        "research_intent_id": str(config.research_intent_id) if config.research_intent_id else None,
        "dataset_version_id": str(config.dataset_version_id),
        "method": config.method,
        "variables": config.variables,
        "params": config.params,
        "preprocessing_ops": config.preflight_result,
        "status": config.status,
        "source_mode": config.source_mode,
        "wizard_step": config.wizard_step,
        "preflight_result": config.preflight_result,
        "created_at": config.created_at.isoformat() if config.created_at else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        "confirmed_at": config.confirmed_at.isoformat() if config.confirmed_at else None,
        "executed_at": config.executed_at.isoformat() if config.executed_at else None,
    }


def _validate_goal_category(category: str) -> None:
    valid_categories = ["compare_groups", "test_association", "predict_outcome", "explore_structure", "describe_data", "custom"]
    if category not in valid_categories:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"goal_category tidak valid. Pilihan: {valid_categories}")


# ============================================================
# Endpoints
# ============================================================

@router.post("/research-intent", response_model=ResearchIntentResponse, status_code=status.HTTP_201_CREATED)
def create_research_intent(body: ResearchIntentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ResearchIntentResponse:
    """POST /api/v1/research-intent - Save research intent (Step 2)."""
    _verify_project_and_version(db, user, body.project_id, body.dataset_version_id)
    _validate_goal_category(body.goal_category)

    intent = ResearchIntent(
        project_id=body.project_id,
        dataset_version_id=body.dataset_version_id,
        goal_category=body.goal_category,
        design_hints=body.design_hints or {},
        user_question=body.user_question,
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)

    return ResearchIntentResponse(
        id=intent.id,
        project_id=intent.project_id,
        dataset_version_id=intent.dataset_version_id,
        goal_category=intent.goal_category,
        design_hints=intent.design_hints,
        user_question=intent.user_question,
        created_at=intent.created_at,
        updated_at=intent.updated_at,
    )


@router.get("/research-intent/{intent_id}", response_model=ResearchIntentResponse)
def get_research_intent(intent_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ResearchIntentResponse:
    """GET /api/v1/research-intent/{id} - Get research intent."""
    intent = db.query(ResearchIntent).join(Project).filter(
        ResearchIntent.id == intent_id,
        Project.user_id == user.id
    ).first()
    if not intent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research intent tidak ditemukan")

    return ResearchIntentResponse(
        id=intent.id,
        project_id=intent.project_id,
        dataset_version_id=intent.dataset_version_id,
        goal_category=intent.goal_category,
        design_hints=intent.design_hints,
        user_question=intent.user_question,
        created_at=intent.created_at,
        updated_at=intent.updated_at,
    )


@router.patch("/research-intent/{intent_id}", response_model=ResearchIntentResponse)
def update_research_intent(intent_id: uuid.UUID, body: ResearchIntentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ResearchIntentResponse:
    """PATCH /api/v1/research-intent/{id} - Update research intent."""
    intent = db.query(ResearchIntent).join(Project).filter(
        ResearchIntent.id == intent_id,
        Project.user_id == user.id
    ).first()
    if not intent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research intent tidak ditemukan")

    if body.goal_category is not None:
        _validate_goal_category(body.goal_category)
        intent.goal_category = body.goal_category
    if body.design_hints is not None:
        intent.design_hints = body.design_hints
    if body.user_question is not None:
        intent.user_question = body.user_question

    intent.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(intent)

    return ResearchIntentResponse(
        id=intent.id,
        project_id=intent.project_id,
        dataset_version_id=intent.dataset_version_id,
        goal_category=intent.goal_category,
        design_hints=intent.design_hints,
        user_question=intent.user_question,
        created_at=intent.created_at,
        updated_at=intent.updated_at,
    )


@router.post("/methods/recommend", response_model=MethodRecommendResponse)
def recommend_methods(body: MethodRecommendRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MethodRecommendResponse:
    """POST /api/v1/methods/recommend - Get method recommendations from intent + profile (Step 2→3)."""
    # Get intent
    intent = db.query(ResearchIntent).join(Project).filter(
        ResearchIntent.id == body.research_intent_id,
        Project.user_id == user.id
    ).first()
    if not intent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research intent tidak ditemukan")

    # Get dataset version
    dv = db.query(DatasetVersion).filter(DatasetVersion.id == intent.dataset_version_id).first()
    if not dv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset version tidak ditemukan")

    # Load dataset
    ds = db.query(Dataset).filter(Dataset.id == dv.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan")

    df = load_version_df(ds, dv)

    # Score all visible methods
    visible = get_visible_methods()
    scored = []
    for mid in visible:
        score = _score_method(mid, intent.goal_category, intent.design_hints)
        if score > 0:
            var_mapping = _infer_variable_mapping(df, mid, intent.design_hints)
            # Quick assumption check
            assumptions = {}
            if mid in ("ttest_ind", "anova_oneway", "pearson", "linreg_simple", "linreg_multiple"):
                assumptions["normality"] = "unknown"
                assumptions["homogeneity"] = "unknown"
            elif mid in ("ttest_paired", "wilcoxon"):
                assumptions["normality_of_differences"] = "unknown"

            scored.append((score, mid, var_mapping, assumptions))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    # Take top 3
    recommendations = []
    for score, mid, var_mapping, assumptions in scored[:3]:
        # Check if mapping is complete
        from app.routers.analyses import METHOD_SPEC
        spec = METHOD_SPEC.get(mid, {})
        vars_needed = set(spec.get("variables", {}).keys())
        vars_mapped = set(var_mapping.keys())
        missing = vars_needed - vars_mapped

        warnings = []
        if missing:
            warnings.append(f"Mapping otomatis tidak lengkap untuk: {', '.join(missing)}")

        # Alternatives
        alternatives = []
        if mid == "ttest_ind":
            alternatives = ["mannwhitney", "anova_oneway"]
        elif mid == "ttest_paired":
            alternatives = ["wilcoxon"]
        elif mid == "anova_oneway":
            alternatives = ["kruskal", "ttest_ind"]
        elif mid == "pearson":
            alternatives = ["spearman"]
        elif mid == "linreg_simple":
            alternatives = ["linreg_multiple", "spearman"]

        recommendations.append(RecommendationItem(
            method_id=mid,
            confidence=min(score / 3.0, 1.0),  # Normalize
            variable_mapping=var_mapping,
            assumptions_check=assumptions,
            warnings=warnings,
            alternatives=alternatives,
        ))

    fallback = "descriptive"

    return MethodRecommendResponse(recommendations=recommendations, fallback=fallback)


@router.post("/analysis-config/guided", status_code=status.HTTP_201_CREATED)
def create_analysis_config_guided(body: AnalysisConfigCreateGuided, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """POST /api/v1/analysis-config/guided - Create analysis config from guided wizard (Step 4)."""
    _verify_project_and_version(db, user, body.project_id, body.dataset_version_id)

    # Verify research intent
    intent = db.query(ResearchIntent).filter(
        ResearchIntent.id == body.research_intent_id,
        ResearchIntent.project_id == body.project_id
    ).first()
    if not intent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research intent tidak ditemukan")

    # Validate method
    visible = get_visible_methods()
    if body.method not in visible:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Method '{body.method}' tidak dikenal atau tersembunyi (Phase 2)")

    # Validate variables match method spec
    from app.routers.analyses import METHOD_SPEC
    spec = METHOD_SPEC.get(body.method, {})
    if not spec:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Spec method '{body.method}' tidak ditemukan")

    # Convert preprocessing ops
    preprocessing_ops = [op.model_dump() for op in body.preprocessing_ops]

    config = AnalysisConfig(
        project_id=body.project_id,
        research_intent_id=body.research_intent_id,
        dataset_version_id=body.dataset_version_id,
        method=body.method,
        variables=body.variables,
        params=body.params,
        preprocessing_ops=preprocessing_ops,
        status="draft",
        source_mode="guided",
        wizard_step=body.wizard_step,
    )
    db.add(config)
    db.commit()
    db.refresh(config)

    return _build_config_response(config)


@router.get("/analysis-config/{config_id}")
def get_analysis_config(config_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """GET /api/v1/analysis-config/{id} - Get analysis config for review (Step 4)."""
    config = db.query(AnalysisConfig).join(Project).filter(
        AnalysisConfig.id == config_id,
        Project.user_id == user.id
    ).first()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis config tidak ditemukan")

    return _build_config_response(config)


@router.post("/analysis-config/{config_id}/confirm", response_model=ConfigConfirmResponse)
def confirm_analysis_config(config_id: uuid.UUID, body: ConfigConfirmRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ConfigConfirmResponse:
    """POST /api/v1/analysis-config/{id}/confirm - Confirm config & run pre-flight v2 (Step 4→5)."""
    config = db.query(AnalysisConfig).join(Project).filter(
        AnalysisConfig.id == config_id,
        Project.user_id == user.id
    ).first()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis config tidak ditemukan")

    if config.status in ("executed", "archived"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Config sudah {config.status}, tidak bisa dikonfirmasi ulang")

    # Load dataset
    dv = db.query(DatasetVersion).filter(DatasetVersion.id == config.dataset_version_id).first()
    if not dv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset version tidak ditemukan")

    ds = db.query(Dataset).filter(Dataset.id == dv.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan")

    df = load_version_df(ds, dv)

    # Apply preprocessing ops for preflight
    df_processed = df.copy()
    for op in config.preprocessing_ops:
        if op["op"] == "drop_missing" and op["column"]:
            df_processed = df_processed.dropna(subset=[op["column"]])
        elif op["op"] == "fill_missing" and op["column"]:
            fill_val = op["params"].get("value", 0)
            df_processed[op["column"]] = df_processed[op["column"]].fillna(fill_val)
        elif op["op"] == "remove_outlier_iqr" and op["column"] and op["column"] in df_processed.columns:
            if pd.api.types.is_numeric_dtype(df_processed[op["column"]]):
                v = df_processed[op["column"]].dropna()
                q1, q3 = v.quantile(0.25), v.quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                    df_processed = df_processed[(df_processed[op["column"]] >= low) & (df_processed[op["column"]] <= high)]

    # Build spec for preflight
    from app.routers.analyses import METHOD_SPEC
    spec = METHOD_SPEC.get(config.method, {})
    spec = {**spec, "method": config.method}

    # Run preflight v2
    pf_result = preflight(
        df=df_processed,
        spec=spec,
        variables=config.variables,
        params=config.params,
        dataset_version_id=str(config.dataset_version_id),
    )

    # Check blockers
    blockers = pf_result["issues"]["blockers"]
    if blockers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Pre-flight blocking issues ditemukan — perbaiki sebelum konfirmasi",
                "issues": blockers
            }
        )

    # Check if all confirmations acknowledged
    confirmations = pf_result["issues"]["confirmations"]
    unacknowledged = [c for c in confirmations if c["code"] not in body.acknowledged_confirmations]

    if unacknowledged:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Konfirmasi diperlukan untuk melanjutkan",
                "issues": unacknowledged
            }
        )

    # All good - update config status to confirmed
    config.status = "confirmed"
    config.confirmed_at = datetime.now(timezone.utc)
    config.preflight_result = pf_result
    config.wizard_step = max(config.wizard_step, 4)
    db.commit()

    return ConfigConfirmResponse(config=_build_config_response(config), preflight=pf_result)


@router.post("/analyses/run-guided", response_model=RunOut, status_code=status.HTTP_201_CREATED)
def run_guided_analysis(body: RunInGuided, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> RunOut:
    """POST /api/v1/analyses/run-guided - Run analysis from confirmed config (Step 5→Result)."""
    config = db.query(AnalysisConfig).join(Project).filter(
        AnalysisConfig.id == body.analysis_config_id,
        Project.user_id == user.id
    ).first()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis config tidak ditemukan")

    if config.status != "confirmed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Config harus status 'confirmed' (sekarang: {config.status})")

    if config.executed_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Config sudah dieksekusi sebelumnya")

    # Load dataset
    dv = db.query(DatasetVersion).filter(DatasetVersion.id == config.dataset_version_id).first()
    if not dv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset version tidak ditemukan")

    ds = db.query(Dataset).filter(Dataset.id == dv.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset tidak ditemukan")

    df = load_version_df(ds, dv)

    # Apply preprocessing ops
    for op in config.preprocessing_ops:
        if op["op"] == "drop_missing" and op["column"]:
            df = df.dropna(subset=[op["column"]])
        elif op["op"] == "fill_missing" and op["column"]:
            fill_val = op["params"].get("value", 0)
            df[op["column"]] = df[op["column"]].fillna(fill_val)
        elif op["op"] == "remove_outlier_iqr" and op["column"] and op["column"] in df.columns:
            if pd.api.types.is_numeric_dtype(df[op["column"]]):
                v = df[op["column"]].dropna()
                q1, q3 = v.quantile(0.25), v.quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                    df = df[(df[op["column"]] >= low) & (df[op["column"]] <= high)]

    # Re-run preflight for safety (on preprocessed data)
    from app.routers.analyses import METHOD_SPEC
    spec = METHOD_SPEC.get(config.method, {})
    spec = {**spec, "method": config.method}

    pf_result = preflight(
        df=df,
        spec=spec,
        variables=config.variables,
        params=config.params,
        dataset_version_id=str(config.dataset_version_id),
    )

    blockers = pf_result["issues"]["blockers"]
    if blockers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Pre-flight blocking issues pada data terproses", "issues": blockers}
        )

    # Run analysis
    try:
        result = run_analysis(df, config.method, config.variables, config.params or {})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    uid = make_uid()
    h = result_hash(result)
    ts = datetime.now(timezone.utc)

    # Compute extended analysis_hash
    a_hash = compute_analysis_hash(
        method=config.method,
        variables=config.variables,
        params=config.params or {},
        dataset_version_id=config.dataset_version_id,
        project_id=config.project_id,
        preprocessing_ops=config.preprocessing_ops,
        engine_version=settings.software_version,
        missing_policy="listwise",  # default
        random_seeds={},
    )

    # Save Analysis
    analysis = Analysis(
        project_id=config.project_id,
        dataset_version_id=config.dataset_version_id,
        analysis_config_id=config.id,
        analysis_uid=uid,
        method=config.method,
        variables=config.variables,
        params=config.params or {},
        status="done",
        analysis_hash=a_hash,
    )
    db.add(analysis)
    db.flush()

    db.add(AnalysisResult(
        analysis_id=analysis.id,
        result=result,
        result_hash=h,
        software_version=settings.software_version,
    ))
    db.add(ResearchLog(
        analysis_id=analysis.id,
        dataset_version_id=config.dataset_version_id,
        method=config.method,
        variables=config.variables,
        params=config.params or {},
        software_version=settings.software_version,
        timestamp=ts,
    ))

    # Update config
    config.status = "executed"
    config.executed_at = ts
    db.commit()

    return RunOut(
        analysis_uid=uid,
        method=config.method,
        result=result,
        result_hash=h,
        warnings=result.get("warnings", []),
        notes=result.get("notes", []),
    )