"""M-18 Text: TF-IDF/BoW + LDA topic modeling (sklearn saja, tanpa download data eksternal).
Deterministik (random_state=42).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.decomposition import LatentDirichletAllocation
from app.services.stats import clean, METHOD_NAMES

ID_STOP = ["dan", "atau", "yang", "di", "ke", "dari", "ini", "itu", "dengan", "untuk", "pada", "adalah", "sebagai", "tidak", "ada", "akan", "telah", "sudah", "juga", "sangat", "lebih", "dalam", "oleh", "karena", "jika", "saat", "serta", "dapat"]


def _docs(df: pd.DataFrame, col: str) -> list[str]:
    if col not in df.columns:
        raise ValueError(f"Kolom '{col}' tidak ada")
    docs = df[col].dropna().astype(str).str.strip()
    docs = docs[docs.str.len() > 0].tolist()
    if len(docs) < 5:
        raise ValueError(f"Butuh minimal 5 dokumen non-kosong (dapat {len(docs)})")
    return docs


def run_tfidf(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col = variables.get("column")
    mode = variables.get("mode", params.get("mode", "tfidf"))
    max_feat = int(params.get("max_features", variables.get("max_features", 200)))
    ngram_max = int(params.get("ngram_max", variables.get("ngram_max", 2)))
    if not col:
        raise ValueError("text_tfidf butuh 'variables.column'")
    if mode not in ("tfidf", "bow"):
        raise ValueError("mode harus tfidf|bow")
    if not 10 <= max_feat <= 5000 or ngram_max not in (1, 2, 3):
        raise ValueError("max_features 10..5000, ngram_max 1..3")
    docs = _docs(df, col)
    Vec = TfidfVectorizer if mode == "tfidf" else CountVectorizer
    vec = Vec(max_features=max_feat, ngram_range=(1, ngram_max), stop_words=ID_STOP, lowercase=True)
    try:
        X = vec.fit_transform(docs)
    except ValueError as e:
        raise ValueError(f"Vektorisasi gagal: {e}")
    terms = vec.get_feature_names_out().tolist()
    mean_w = np.asarray(X.mean(axis=0)).ravel()
    top = sorted(zip(terms, mean_w.tolist()), key=lambda t: t[1], reverse=True)[:20]
    return {
        "method": "text_tfidf", "method_name": METHOD_NAMES["text_tfidf"], "alpha": alpha, "n": int(len(docs)),
        "statistics": {"mode": mode, "vocab_size": int(len(terms)), "ngram_range": [1, ngram_max], "matrix_shape": [int(X.shape[0]), int(X.shape[1])], "top_terms": [{"term": t, "weight": clean(float(w))} for t, w in top]},
        "assumptions": [{"name": "preprocessing teks", "passed": None, "note": "lowercase + stopwords ID bawaan; stemming di luar MVP — bersihkan dulu via preprocessing bila perlu"}],
        "formula_latex": r"\mathrm{tfidf}(t,d)=\mathrm{tf}(t,d)\times\log\frac{N}{\mathrm{df}(t)}",
        "parameters": {"column": col, "mode": mode, "max_features": max_feat, "ngram_max": ngram_max},
        "calculation": [f"{len(docs)} dokumen → matriks {X.shape[0]}×{X.shape[1]} ({mode})", f"Top term: {top[0][0]} ({top[0][1]:.4f})" if top else "kosong"],
        "decision": None, "effect_size": None,
        "interpretation": f"Vektorisasi {mode} '{col}': {len(docs)} dokumen, {len(terms)} term. Top: {', '.join(t for t, _ in top[:5])}.",
        "warnings": [] if len(terms) >= 10 else ["Vokabular kecil — tambah dokumen atau longgarkan max_features"],
    }


def run_lda(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    col = variables.get("column")
    n_topics = int(params.get("n_topics", variables.get("n_topics", 3)))
    max_feat = int(params.get("max_features", variables.get("max_features", 500)))
    if not col:
        raise ValueError("text_lda butuh 'variables.column'")
    if not 2 <= n_topics <= 10:
        raise ValueError("n_topics harus 2..10")
    docs = _docs(df, col)
    if len(docs) < n_topics * 3:
        raise ValueError(f"Dokumen ({len(docs)}) terlalu sedikit untuk {n_topics} topik (min {n_topics * 3})")
    vec = CountVectorizer(max_features=max_feat, ngram_range=(1, 1), stop_words=ID_STOP, lowercase=True, min_df=2)
    try:
        X = vec.fit_transform(docs)
    except ValueError as e:
        raise ValueError(f"Vektorisasi gagal: {e}")
    if X.shape[1] < n_topics:
        raise ValueError(f"Vokabular ({X.shape[1]}) lebih kecil dari n_topics")
    lda = LatentDirichletAllocation(n_components=n_topics, random_state=42, max_iter=20)
    lda.fit(X)
    terms = vec.get_feature_names_out().tolist()
    topics = []
    for i, comp in enumerate(lda.components_):
        idx = comp.argsort()[::-1][:10]
        topics.append({"topic": i, "top_words": [{"word": terms[j], "weight": clean(float(comp[j]))} for j in idx]})
    perp = clean(float(lda.perplexity(X)))
    return {
        "method": "text_lda", "method_name": METHOD_NAMES["text_lda"], "alpha": alpha, "n": int(len(docs)),
        "statistics": {"n_topics": n_topics, "vocab_size": int(len(terms)), "perplexity_bound": perp, "topics": topics},
        "assumptions": [{"name": "bag-of-words", "passed": None, "note": "urutan kata diabaikan; topik = distribusi kata"}],
        "formula_latex": r"p(w\mid d)=\sum_z p(w\mid z)\,p(z\mid d)",
        "parameters": {"column": col, "n_topics": n_topics, "max_features": max_feat},
        "calculation": [f"{len(docs)} dokumen, {len(terms)} term → {n_topics} topik", f"perplexity bound={perp}"],
        "decision": None, "effect_size": None,
        "interpretation": f"LDA {n_topics} topik dari '{col}' (n={len(docs)}). " + " ".join(f"Topik {t['topic']}: {', '.join(w['word'] for w in t['top_words'][:4])}." for t in topics),
        "warnings": [],
    }
