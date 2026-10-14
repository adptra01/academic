"""Pre-flight analysis v2: unified validation for both Guided and Manual modes.

Input: df, method, variables, params, dataset_version_id
Logic: calls MA rules + METHOD_CONTRACTS assumptions
Output: {blockers: [], confirmations: [], warnings: []} - same for guided & manual

Severity levels:
- blocker: variabel required tidak ada, tipe salah, n < minimum, konstanta
- confirmation: missing >5%, ID duplicate, versi dataset beda dari yang dipilih
- warning: asumsi terlanggar (normality, homogeneity), outlier IQR >5%, Likert detected, low expected freq
"""
from __future__ import annotations

import pandas as pd
import yaml
from pathlib import Path

from app.services.advice.rules import advise, Issue as AdviceIssue

# Load method contracts from YAML files
CONTRACTS_DIR = Path(__file__).parent.parent.parent.parent / "docs" / "ar-02-implementation" / "METHOD_CONTRACTS"

_CONTRACT_CACHE: dict[str, dict] = {}


def _load_contract(method_id: str) -> dict | None:
    """Load method contract from YAML file."""
    if method_id in _CONTRACT_CACHE:
        return _CONTRACT_CACHE[method_id]

    yaml_path = CONTRACTS_DIR / f"{method_id}.yaml"
    if not yaml_path.exists():
        return None

    with open(yaml_path, "r") as f:
        contract = yaml.safe_load(f)
    _CONTRACT_CACHE[method_id] = contract
    return contract


def _check_method_contracts(df: pd.DataFrame, method: str, variables: dict, params: dict) -> list[dict]:
    """Check assumptions from METHOD_CONTRACTS YAML files."""
    issues = []
    contract = _load_contract(method)
    if not contract:
        return issues

    assumptions = contract.get("assumptions", [])
    for assumption in assumptions:
        name = assumption.get("name", "")
        check = assumption.get("check", "")
        warning_if_failed = assumption.get("warning_if_failed", False)
        fallback = assumption.get("fallback", "")

        if "normality" in name.lower():
            issues.append({
                "level": "warning" if warning_if_failed else "confirmation",
                "code": f"NORMALITY_CHECK_{method.upper()}",
                "key": "normality",
                "message": f"Asumsi normalitas: {check}",
                "fix": f"Jika gagal, pertimbangkan {fallback}" if fallback else "Periksa distribusi data",
                "details": {"assumption": name, "check": check, "fallback": fallback}
            })
        elif "homogeneity" in name.lower() or "variance" in name.lower() or "homoscedasticity" in name.lower():
            issues.append({
                "level": "warning" if warning_if_failed else "confirmation",
                "code": f"HOMOGENEITY_CHECK_{method.upper()}",
                "key": "homogeneity",
                "message": f"Asumsi homogenitas varians: {check}",
                "fix": f"Jika gagal, pertimbangkan {fallback}" if fallback else "Periksa varians per grup",
                "details": {"assumption": name, "check": check, "fallback": fallback}
            })
        elif "linearity" in name.lower():
            issues.append({
                "level": "warning",
                "code": f"LINEARITY_CHECK_{method.upper()}",
                "key": "linearity",
                "message": f"Asumsi linearitas: {check}",
                "fix": "Periksa scatter plot; pertimbangkan transformasi atau model non-linear",
                "details": {"assumption": name, "check": check}
            })
        elif "expected_frequency" in name.lower() or "expected frequency" in check.lower():
            issues.append({
                "level": "warning" if warning_if_failed else "confirmation",
                "code": f"EXPECTED_FREQ_CHECK_{method.upper()}",
                "key": "expected_frequency",
                "message": f"Frekuensi harapan: {check}",
                "fix": "Gabungkan kategori atau perbesar sampel",
                "details": {"assumption": name, "check": check}
            })
        elif "multicollinearity" in name.lower() or "vif" in check.lower():
            issues.append({
                "level": "warning" if warning_if_failed else "confirmation",
                "code": f"MULTICOLLINEARITY_CHECK_{method.upper()}",
                "key": "multicollinearity",
                "message": f"Multikolinearitas: {check}",
                "fix": "Hapus/centering prediktor berkorelasi tinggi; pertimbangkan ridge/lasso",
                "details": {"assumption": name, "check": check}
            })
        elif "independence" in name.lower():
            # Can't auto-check; just informational
            issues.append({
                "level": "confirmation",
                "code": f"INDEPENDENCE_CHECK_{method.upper()}",
                "key": "independence",
                "message": f"Asumsi independensi: {check}. {assumption.get('note', '')}",
                "fix": "Pastikan desain penelitian menjamin independensi observasi",
                "details": {"assumption": name, "check": check}
            })
        elif "symmetry" in name.lower():
            issues.append({
                "level": "warning" if warning_if_failed else "confirmation",
                "code": f"SYMMETRY_CHECK_{method.upper()}",
                "key": "symmetry",
                "message": f"Asumsi simetris: {check}",
                "fix": "Jika gagal, pertimbangkan Sign Test",
                "details": {"assumption": name, "check": check, "fallback": fallback}
            })
        elif "bivariate_normal" in name.lower():
            issues.append({
                "level": "warning" if warning_if_failed else "confirmation",
                "code": f"BIVARIATE_NORMALITY_{method.upper()}",
                "key": "bivariate_normality",
                "message": f"Asumsi bivariat normal: {check}",
                "fix": "Jika gagal, pertimbangkan Spearman",
                "details": {"assumption": name, "check": check, "fallback": fallback}
            })
        elif "monotonic" in name.lower():
            issues.append({
                "level": "warning",
                "code": f"MONOTONIC_CHECK_{method.upper()}",
                "key": "monotonic",
                "message": f"Asumsi hubungan monotonik: {check}",
                "fix": "Periksa scatter plot",
                "details": {"assumption": name, "check": check}
            })
        elif "n_vs_k" in name.lower() or "n vs k" in check.lower():
            issues.append({
                "level": "warning",
                "code": f"SAMPLE_SIZE_CHECK_{method.upper()}",
                "key": "sample_size",
                "message": f"Ukuran sampel: {check}",
                "fix": "Perbesar sampel atau kurangi jumlah prediktor",
                "details": {"assumption": name, "check": check}
            })

    return issues


def _is_numeric_col(s: pd.Series) -> bool:
    return bool(pd.api.types.is_numeric_dtype(s.dtype))


def _check_col_kind(df: pd.DataFrame, col: str, kind: str) -> str | None:
    """Return error message if column doesn't match kind."""
    if col not in df.columns:
        return f"kolom '{col}' tidak ada di dataset"

    s = df[col]

    if kind == "numeric" and not _is_numeric_col(s):
        return f"kolom '{col}' bukan numerik"

    if kind in ("categorical", "group") and _is_numeric_col(s):
        return f"kolom '{col}' numerik — butuh kolom kategorikal untuk pengelompokan"

    if kind == "text" and not (s.dtype == object or str(s.dtype) in ("string", "category")):
        return f"kolom '{col}' bukan teks"

    return None


def _check_constant_columns(df: pd.DataFrame, variables: dict) -> list[dict]:
    """Check for constant columns in selected variables."""
    issues = []
    for key, col in variables.items():
        if isinstance(col, list):
            for c in col:
                if c in df.columns:
                    s = df[c]
                    if pd.api.types.is_numeric_dtype(s):
                        if s.nunique(dropna=True) <= 1:
                            issues.append({
                                "level": "blocker",
                                "code": "CONSTANT_COLUMN",
                                "key": key,
                                "message": f"Kolom '{c}' bernilai konstan (hanya 1 nilai unik) — tidak bisa dianalisis",
                                "fix": "Pilih kolom lain yang memiliki variasi"
                            })
        elif isinstance(col, str) and col in df.columns:
            s = df[col]
            if pd.api.types.is_numeric_dtype(s):
                if s.nunique(dropna=True) <= 1:
                    issues.append({
                        "level": "blocker",
                        "code": "CONSTANT_COLUMN",
                        "key": key,
                        "message": f"Kolom '{col}' bernilai konstan (hanya 1 nilai unik) — tidak bisa dianalisis",
                        "fix": "Pilih kolom lain yang memiliki variasi"
                    })
    return issues


def _check_min_sample_size(df: pd.DataFrame, method: str, variables: dict) -> list[dict]:
    """Check minimum sample size requirements per method."""
    issues = []

    # Determine the main outcome column
    outcome_col = None
    group_col = None

    # Common patterns for finding outcome/group columns
    for key, col in variables.items():
        if isinstance(col, str):
            if key in ("column", "x", "y", "col1", "col2", "target"):
                outcome_col = col
            elif key in ("group", "xs", "columns", "features"):
                if isinstance(col, list):
                    pass
                else:
                    group_col = col
        elif isinstance(col, list) and col:
            if key in ("columns", "features", "xs"):
                # Multiple features
                pass

    n_rows = len(df)

    # Method-specific minimum n checks
    if method in ("ttest_1samp", "normality", "descriptive"):
        if outcome_col and outcome_col in df.columns:
            n_valid = df[outcome_col].notna().sum()
            if n_valid < 3:
                issues.append({
                    "level": "blocker",
                    "code": "INSUFFICIENT_SAMPLE",
                    "key": "column",
                    "message": f"Hanya {n_valid} baris valid untuk kolom '{outcome_col}' — minimum 3",
                    "fix": "Pilih kolom dengan lebih banyak data valid atau perbaiki missing values"
                })
    elif method in ("ttest_ind", "mannwhitney", "anova_oneway", "kruskal"):
        if outcome_col and outcome_col in df.columns and group_col and group_col in df.columns:
            n_valid = df[[outcome_col, group_col]].dropna().shape[0]
            if method in ("ttest_ind", "mannwhitney"):
                n_groups = df[group_col].nunique(dropna=True)
                if n_groups < 2:
                    issues.append({
                        "level": "blocker",
                        "code": "INSUFFICIENT_GROUPS",
                        "key": "group",
                        "message": f"Kolom '{group_col}' hanya punya {n_groups} grup — butuh minimal 2",
                        "fix": "Pilih kolom pengelompok dengan minimal 2 grup"
                    })
                min_per_group = df.groupby(group_col)[outcome_col].apply(lambda x: x.notna().sum()).min()
                if min_per_group < 2:
                    issues.append({
                        "level": "blocker",
                        "code": "INSUFFICIENT_PER_GROUP",
                        "key": "group",
                        "message": f"Salah satu grup hanya punya {min_per_group} observasi valid — butuh minimal 2 per grup",
                        "fix": "Pastikan setiap grup punya minimal 2 observasi valid"
                    })
            elif method in ("anova_oneway", "kruskal"):
                n_groups = df[group_col].nunique(dropna=True)
                if n_groups < 3:
                    issues.append({
                        "level": "blocker",
                        "code": "INSUFFICIENT_GROUPS",
                        "key": "group",
                        "message": f"Kolom '{group_col}' hanya punya {n_groups} grup — {method} butuh minimal 3",
                        "fix": "Pilih kolom pengelompok dengan minimal 3 grup atau gunakan ttest_ind/mannwhitney"
                    })
                min_per_group = df.groupby(group_col)[outcome_col].apply(lambda x: x.notna().sum()).min()
                if min_per_group < 2:
                    issues.append({
                        "level": "blocker",
                        "code": "INSUFFICIENT_PER_GROUP",
                        "key": "group",
                        "message": f"Salah satu grup hanya punya {min_per_group} observasi valid — butuh minimal 2 per grup",
                        "fix": "Pastikan setiap grup punya minimal 2 observasi valid"
                    })
    elif method in ("ttest_paired", "wilcoxon", "pearson", "spearman", "linreg_simple"):
        # Paired or bivariate - need complete pairs
        cols = []
        for key, col in variables.items():
            if isinstance(col, str):
                cols.append(col)
            elif isinstance(col, list):
                cols.extend(col)
        if cols:
            valid = df[cols].dropna().shape[0]
            if valid < 3:
                issues.append({
                    "level": "blocker",
                    "code": "INSUFFICIENT_SAMPLE",
                    "key": "variables",
                    "message": f"Hanya {valid} baris lengkap untuk analisis — minimum 3",
                    "fix": "Perbaiki missing values pada kolom yang dipilih"
                })
    elif method == "linreg_multiple":
        # Need n >= k + 2
        xs = variables.get("xs", [])
        if isinstance(xs, list) and len(xs) >= 2:
            cols = xs + [variables.get("y")]
            valid = df[cols].dropna().shape[0] if cols[-1] in df.columns else 0
            k = len(xs)
            if valid < k + 2:
                issues.append({
                    "level": "blocker",
                    "code": "INSUFFICIENT_SAMPLE_REGRESSION",
                    "key": "xs",
                    "message": f"Regresi berganda butuh n ≥ k+2 = {k+2}, tersedia {valid} baris lengkap",
                    "fix": "Perbesar sampel atau kurangi jumlah prediktor"
                })
    elif method == "chi2_independence":
        col1 = variables.get("col1")
        col2 = variables.get("col2")
        if col1 and col2 and col1 in df.columns and col2 in df.columns:
            valid = df[[col1, col2]].dropna().shape[0]
            if valid < 5:
                issues.append({
                    "level": "blocker",
                    "code": "INSUFFICIENT_SAMPLE",
                    "key": "variables",
                    "message": f"Hanya {valid} baris lengkap untuk uji chi-kuadrat — minimum 5",
                    "fix": "Perbaiki missing values atau pilih kolom lain"
                })

    return issues


def preflight(
    df: pd.DataFrame,
    spec: dict,
    variables: dict,
    params: dict | None = None,
    dataset_version_id: str | None = None,
) -> dict:
    """Unified pre-flight v2 returning {blockers, confirmations, warnings}.

    Used by both Guided (Step 4 confirm) and Manual (live validation).
    """
    params = params or {}
    blockers = []
    confirmations = []
    warnings = []

    col_specs: dict = spec.get("variables") or {}
    param_specs: dict = spec.get("params") or {}

    # --- Required columns check ---
    for key, cs in col_specs.items():
        label = cs.get("label", key)
        raw = variables.get(key)

        if cs.get("multi"):
            chosen = [c for c in (raw or []) if c]
            if not chosen:
                blockers.append({
                    "level": "blocking", "key": key,
                    "message": f"{label}: belum ada kolom yang dipilih",
                    "fix": "pilih minimal satu kolom",
                    "code": "MISSING_REQUIRED_COLUMN"
                })
            for c in chosen:
                if c not in df.columns:
                    blockers.append({
                        "level": "blocking", "key": key,
                        "message": f"{label}: kolom '{c}' tidak ada di dataset",
                        "fix": f"pilih kolom yang ada. tersedia: {', '.join(map(str, list(df.columns)[:6]))}…",
                        "code": "COLUMN_NOT_FOUND"
                    })
                else:
                    err = _check_col_kind(df, c, cs.get("kind", "any"))
                    if err:
                        blockers.append({
                            "level": "blocking", "key": key, "message": f"{label}: {err}",
                            "fix": "pilih kolom dengan jenis yang sesuai",
                            "code": "WRONG_COLUMN_TYPE"
                        })
        else:
            chosen = (raw or "").strip() if isinstance(raw, str) else ""
            if not chosen:
                blockers.append({
                    "level": "blocking", "key": key,
                    "message": f"{label}: belum diisi",
                    "fix": "pilih satu kolom",
                    "code": "MISSING_REQUIRED_COLUMN"
                })
            elif chosen not in df.columns:
                blockers.append({
                    "level": "blocking", "key": key,
                    "message": f"{label}: kolom '{chosen}' tidak ada di dataset",
                    "fix": f"pilih kolom yang ada. tersedia: {', '.join(map(str, list(df.columns)[:6]))}…",
                    "code": "COLUMN_NOT_FOUND"
                })
            else:
                err = _check_col_kind(df, chosen, cs.get("kind", "any"))
                if err:
                    blockers.append({
                        "level": "blocking", "key": key, "message": f"{label}: {err}",
                        "fix": "pilih kolom dengan jenis yang sesuai",
                        "code": "WRONG_COLUMN_TYPE"
                    })

    # --- Required parameters check ---
    for key, ps in param_specs.items():
        if not ps.get("required"):
            continue
        if key in ("alpha",):
            continue
        label = ps.get("label", key)
        val = params.get(key)
        if val is None or (isinstance(val, str) and not val.strip()):
            blockers.append({
                "level": "blocking", "key": key,
                "message": f"{label}: belum diisi (wajib)",
                "fix": "isi nilai parameter ini",
                "code": "MISSING_REQUIRED_PARAM"
            })

    # --- Group column level checks ---
    for key, cs in col_specs.items():
        if cs.get("kind") != "group":
            continue
        raw = variables.get(key)
        chosen = raw if isinstance(raw, str) else ""
        if chosen and chosen in df.columns:
            n_levels = int(df[chosen].nunique(dropna=True))
            if n_levels < 2:
                blockers.append({
                    "level": "blocking", "key": key,
                    "message": f"Kolom '{chosen}' hanya punya {n_levels} nilai unik — tidak bisa membagi kelompok",
                    "fix": "pilih kolom pengelompok yang punya minimal 2 kelompok",
                    "code": "INSUFFICIENT_GROUP_LEVELS"
                })

    # --- Constant columns check ---
    blockers.extend(_check_constant_columns(df, variables))

    # --- Minimum sample size checks ---
    blockers.extend(_check_min_sample_size(df, spec.get("method", ""), variables))

    # --- Dataset version mismatch check (confirmation) ---
    # This would be checked at config level; here we just note it
    if dataset_version_id:
        confirmations.append({
            "level": "confirmation",
            "code": "DATASET_VERSION_BINDING",
            "key": "dataset_version_id",
            "message": f"Analisis terikat pada dataset version ID: {dataset_version_id}. Pastikan ini versi yang diinginkan.",
            "fix": "Konfirmasi bahwa versi dataset sudah benar sebelum melanjutkan",
            "details": {"dataset_version_id": dataset_version_id}
        })

    # --- Missing data check (confirmation if >5%) ---
    for key, cs in col_specs.items():
        raw = variables.get(key)
        if cs.get("multi"):
            chosen = [c for c in (raw or []) if c]
        else:
            chosen = [raw] if isinstance(raw, str) and raw else []

        for c in chosen:
            if c in df.columns:
                s = df[c]
                n_total = len(s)
                n_missing = int(s.isna().sum())
                if n_total > 0:
                    pct = 100.0 * n_missing / n_total
                    if pct > 5.0:
                        confirmations.append({
                            "level": "confirmation",
                            "code": "HIGH_MISSING",
                            "key": key,
                            "message": f"Kolom '{c}' punya {pct:.1f}% missing ({n_missing}/{n_total}) — n efektif akan turun",
                            "fix": "Isi missing values atau pilih kolom lain",
                            "details": {"missing_pct": pct, "missing_count": n_missing, "total": n_total}
                        })

    # --- MA rules (advice) - these are warnings ---
    try:
        ma_issues = advise(spec.get("method", ""), df, variables, params)
        for issue in ma_issues:
            level = "warning" if issue.get("level") == "warn" else "confirmation"
            warnings.append({
                "level": level,
                "code": issue.get("id", "MA_RULE"),
                "key": issue.get("field", ""),
                "message": issue.get("message", ""),
                "fix": issue.get("fix", ""),
                "details": {"switch_to": issue.get("switch_to")}
            })
    except Exception:
        # Never fail preflight due to advice errors
        pass

    # --- Method contract assumptions ---
    contract_issues = _check_method_contracts(df, spec.get("method", ""), variables, params)
    for issue in contract_issues:
        level = issue["level"]
        if level == "warning":
            warnings.append(issue)
        elif level == "confirmation":
            confirmations.append(issue)

    # --- Outlier check (warning) ---
    # Already covered by MA-05 but also check generally
    for key, cs in col_specs.items():
        if cs.get("kind") != "numeric":
            continue
        raw = variables.get(key)
        if cs.get("multi"):
            chosen = [c for c in (raw or []) if c]
        else:
            chosen = [raw] if isinstance(raw, str) and raw else []

        for c in chosen:
            if c in df.columns and pd.api.types.is_numeric_dtype(df[c]):
                v = df[c].dropna()
                if len(v) >= 5:
                    q1, q3 = v.quantile(0.25), v.quantile(0.75)
                    iqr = q3 - q1
                    if iqr > 0:
                        low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                        n_out = int(((v < low) | (v > high)).sum())
                        pct = 100.0 * n_out / len(v)
                        if pct > 5.0:
                            warnings.append({
                                "level": "warning",
                                "code": "OUTLIER_IQR",
                                "key": key,
                                "message": f"Kolom '{c}': {pct:.1f}% nilai di luar pagar IQR ({n_out} dari {len(v)} baris)",
                                "fix": "Tinjau outlier; pertimbangkan metode robust (Mann-Whitney, Spearman, Wilcoxon)",
                                "details": {"outlier_pct": pct, "outlier_count": n_out, "total": len(v)}
                            })

    # --- Likert detection (warning) ---
    for key, cs in col_specs.items():
        raw = variables.get(key)
        if cs.get("multi"):
            chosen = [c for c in (raw or []) if c]
        else:
            chosen = [raw] if isinstance(raw, str) and raw else []

        for c in chosen:
            if c in df.columns and pd.api.types.is_numeric_dtype(df[c]):
                v = df[c].dropna()
                if len(v) >= 5:
                    uniq = v.unique()
                    if (len(uniq) <= 7 and
                        bool((v == v.round()).all()) and
                        bool(v.between(1, 5).all())):
                        warnings.append({
                            "level": "warning",
                            "code": "LIKERT_DETECTED",
                            "key": key,
                            "message": f"Kolom '{c}' terdeteksi sebagai skala Likert (bilangan bulat 1-5, {len(uniq)} nilai unik)",
                            "fix": "Set tipe kolom menjadi Ordinal di panel Variabel untuk analisis non-parametrik",
                            "details": {"unique_values": sorted(float(u) for u in uniq)}
                        })

    # Build response
    ok = len(blockers) == 0

    return {
        "ok": ok,
        "issues": {
            "blockers": blockers,
            "confirmations": confirmations,
            "warnings": warnings
        }
    }


def preflight_legacy(
    df: pd.DataFrame,
    spec: dict,
    variables: dict,
    params: dict | None = None,
) -> list[dict]:
    """Legacy format for backward compatibility with existing /analyses/preflight."""
    result = preflight(df, spec, variables, params)
    # Flatten to old format
    flat = []
    for level in ("blockers", "confirmations", "warnings"):
        for issue in result["issues"].get(level, []):
            flat.append({
                "level": "blocking" if level == "blockers" else "warn",
                "key": issue.get("key", ""),
                "message": issue.get("message", ""),
                "fix": issue.get("fix", "")
            })
    return flat