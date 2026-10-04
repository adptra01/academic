"""M-16 Klasifikasi: Naive Bayes, Logistic Regression, Decision Tree, Random Forest, SVM.
Deterministik: random_state=42, split stratified bila memungkinkan.
Metrics: accuracy, precision/recall/F1 macro, per-class, confusion matrix, ROC-AUC (biner/OvR).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix, roc_auc_score
from sklearn.model_selection import cross_val_score
from app.services.stats import clean, METHOD_NAMES

ALGORITHMS = {
    "naive_bayes": ("Gaussian Naive Bayes", lambda: GaussianNB()),
    "logistic_regression": ("Logistic Regression", lambda: LogisticRegression(max_iter=1000)),
    "decision_tree": ("Decision Tree", lambda: DecisionTreeClassifier(random_state=42)),
    "random_forest": ("Random Forest", lambda: RandomForestClassifier(n_estimators=200, random_state=42)),
    "svm": ("Support Vector Machine", lambda: SVC(probability=True, random_state=42)),
}

FORMULA = r"\mathrm{acc}=\frac{TP+TN}{N},\quad F_1=2\frac{PR}{P+R}"


def run(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    feats = variables.get("features")
    target = variables.get("target")
    algo_id = variables.get("algorithm", params.get("algorithm", "random_forest"))
    test_size = float(params.get("test_size", variables.get("test_size", 0.25)))
    if not feats or not isinstance(feats, list) or not target:
        raise ValueError("ml_classify butuh 'variables.features' (list) dan 'variables.target'")
    if algo_id not in ALGORITHMS:
        raise ValueError(f"algorithm harus salah satu {sorted(ALGORITHMS)}")
    if not 0.05 <= test_size <= 0.5:
        raise ValueError("test_size harus 0.05..0.5")
    for c in [*feats, target]:
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada")
    sub = pd.DataFrame({c: pd.to_numeric(df[c], errors="coerce") for c in feats} | {"__y": df[target].astype(str)}).dropna()
    if len(sub) < 10:
        raise ValueError(f"Butuh minimal 10 baris bersih (dapat {len(sub)})")
    X, y = sub[feats].to_numpy(), sub["__y"].to_numpy()
    labels = sorted(np.unique(y).tolist())
    if len(labels) < 2:
        raise ValueError(f"Target harus punya ≥2 kelas (dapat {labels})")
    strat = y if min((y == lv).sum() for lv in labels) >= 2 else None
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=test_size, random_state=42, stratify=strat)
    name, _make = ALGORITHMS[algo_id]
    clf = _make()
    clf.fit(Xtr, ytr)
    pred = clf.predict(Xte)
    acc = float(accuracy_score(yte, pred))
    prec, rec, f1, sup = precision_recall_fscore_support(yte, pred, labels=labels, zero_division=0)
    cm = confusion_matrix(yte, pred, labels=labels).tolist()
    per_class = {lv: {"precision": clean(float(prec[i])), "recall": clean(float(rec[i])), "f1": clean(float(f1[i])), "support": int(sup[i])} for i, lv in enumerate(labels)}
    auc = None
    viz_roc = None
    try:
        from sklearn.metrics import roc_curve

        if hasattr(clf, "predict_proba"):
            proba = clf.predict_proba(Xte)
            if len(labels) == 2:
                if auc is None:
                    auc = float(roc_auc_score((yte == labels[1]).astype(int), proba[:, 1]))
                fpr, tpr, _ = roc_curve((yte == labels[1]).astype(int), proba[:, 1])
                viz_roc = {"mode": "binary", "positive_class": labels[1], "fpr": clean(fpr.tolist()), "tpr": clean(tpr.tolist())}
            else:
                from sklearn.preprocessing import label_binarize

                Yb = label_binarize(yte, classes=labels)
                curves = {}
                for i, lv in enumerate(labels[:5]):
                    fpr, tpr, _ = roc_curve(Yb[:, i], proba[:, i])
                    curves[lv] = {"fpr": clean(fpr[:: max(1, len(fpr) // 200)].tolist()), "tpr": clean(tpr[:: max(1, len(tpr) // 200)].tolist())}
                viz_roc = {"mode": "ovr", "per_class": curves}
    except Exception:
        viz_roc = None
    cv_mean, cv_std, model_params, importances = None, None, {}, None
    try:
        from sklearn.base import clone as _clone

        cv_scores = cross_val_score(_clone(clf), X, y, cv=5)
        cv_mean, cv_std = float(cv_scores.mean()), float(cv_scores.std())
    except Exception:
        pass
    try:
        raw = clf.get_params()
        model_params = {k: clean(v) for k, v in raw.items() if k in ("C", "kernel", "n_estimators", "max_depth", "max_iter", "random_state")}
        model_params["random_state"] = 42
    except Exception:
        model_params = {"random_state": 42}
    try:
        if hasattr(clf, "feature_importances_"):
            importances = {f: clean(float(v)) for f, v in zip(feats, clf.feature_importances_)}
        elif hasattr(clf, "coef_"):
            importances = {f: clean(float(v)) for f, v in zip(feats, np.abs(clf.coef_).ravel()[: len(feats)])}
    except Exception:
        importances = None
    warnings = []
    if acc < 0.6:
        warnings.append(f"Akurasi rendah ({acc:.3f}) — fitur kurang diskriminatif atau perlu preprocessing/ tuning")
    if strat is None:
        warnings.append("Split tanpa stratifikasi (ada kelas <2 sampel train)")
    return {
        "method": "ml_classify", "method_name": METHOD_NAMES["ml_classify"], "alpha": alpha, "n": int(len(sub)),
        "statistics": {
            "algorithm": name, "classes": labels, "n_train": int(len(Xtr)), "n_test": int(len(Xte)),
            "accuracy": clean(acc),
            "precision_macro": clean(float(np.mean(prec))), "recall_macro": clean(float(np.mean(rec))), "f1_macro": clean(float(np.mean(f1))),
            "cv_accuracy_mean": clean(cv_mean), "cv_accuracy_std": clean(cv_std),
            "model_params": model_params, "feature_importances": importances,
            "per_class": per_class, "confusion_matrix": cm, "roc_auc": clean(auc),
        },
        "visualization": {"roc": viz_roc, "meta": {"analysis_method": "ml_classify", "note": "ECharts-ready: plot fpr vs tpr"}},
        "assumptions": [{"name": "train/test split stratified 75/25 (random_state=42)", "passed": strat is not None, "note": "evaluasi jujur butuh data test terpisah; tidak ada leakage bila preprocessing di-fit di train"}],
        "formula_latex": FORMULA,
        "parameters": {"features": feats, "target": target, "algorithm": algo_id, "test_size": test_size},
        "calculation": [f"n={len(sub)}, train={len(Xtr)}, test={len(Xte)}, kelas={labels}", f"acc={acc:.4f}, P-macro={np.mean(prec):.4f}, R-macro={np.mean(rec):.4f}, F1-macro={np.mean(f1):.4f}" + (f", ROC-AUC={auc:.4f}" if auc is not None else ""), "Confusion matrix tersimpan (lihat grafik/table)"],
        "decision": None,
        "effect_size": {"accuracy": clean(acc), "f1_macro": clean(float(np.mean(f1)))},
        "interpretation": f"Klasifikasi {name} target '{target}' (test n={len(Xte)}): akurasi={acc:.3f}, F1-macro={np.mean(f1):.3f}. " + ("Model layak dipakai dengan validasi lanjutan." if acc >= 0.8 else "Model lemah — perbaiki fitur atau coba algoritma lain."),
        "warnings": warnings,
    }
