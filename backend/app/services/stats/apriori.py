"""M-19 Association Rule Mining (Apriori) — modul tersendiri, tanpa dependensi baru.
Input: kolom-kolom biner/kategorikal (one-hot otomatis) → tiap baris = transaksi.
Output glass-box: itemset + support + confidence + lift + antecedent + consequent
+ rule count + min_support/min_confidence/min_lift/max_length + traceability penuh.
"""
from __future__ import annotations
import itertools
import pandas as pd
from app.services.stats import clean, METHOD_NAMES


def _baskets(df: pd.DataFrame, columns: list[str]) -> tuple[list[frozenset], list[str]]:
    for c in columns:
        if c not in df.columns:
            raise ValueError(f"Kolom '{c}' tidak ada. Tersedia: {list(df.columns)}")
    sub = df[columns].copy()
    dummies = pd.get_dummies(sub, prefix_sep="=", dtype=int)
    items = dummies.columns.tolist()
    baskets = [frozenset(items[i] for i, v in enumerate(row) if v) for row in dummies.to_numpy()]
    baskets = [b for b in baskets if b]
    if not baskets:
        raise ValueError("Tidak ada transaksi berisi item (semua baris kosong setelah encoding)")
    return baskets, items


def _frequent(baskets: list[frozenset], min_support: float, max_length: int) -> dict[frozenset, float]:
    n = len(baskets)
    freq: dict[frozenset, float] = {}
    level = {frozenset([it]) for b in baskets for it in b}
    level = {s for s in level if sum(1 for b in baskets if s <= b) / n >= min_support}
    k = 1
    while level and k <= max_length:
        for s in sorted(level, key=lambda x: sorted(x)):
            freq[s] = sum(1 for b in baskets if s <= b) / n
        k += 1
        if k > max_length:
            break
        prev = sorted(level, key=lambda x: sorted(x))
        cand = set()
        for i in range(len(prev)):
            for j in range(i + 1, len(prev)):
                u = prev[i] | prev[j]
                if len(u) == k and all(frozenset(c) in freq for c in itertools.combinations(sorted(u), k - 1)):
                    cand.add(u)
        level = {s for s in cand if sum(1 for b in baskets if s <= b) / n >= min_support}
    return freq


def run(df: pd.DataFrame, variables: dict, alpha: float, params: dict) -> dict:
    columns = variables.get("columns")
    min_support = float(params.get("min_support", variables.get("min_support", 0.2)))
    min_confidence = float(params.get("min_confidence", variables.get("min_confidence", 0.6)))
    min_lift = float(params.get("min_lift", variables.get("min_lift", 1.0)))
    max_length = int(params.get("max_length", variables.get("max_length", 3)))
    if not columns or not isinstance(columns, list):
        raise ValueError("apriori butuh 'variables.columns' (list kolom item/biner/kategorikal)")
    if not 0 < min_support <= 1:
        raise ValueError("min_support harus 0 < s ≤ 1")
    if not 0 <= min_confidence <= 1:
        raise ValueError("min_confidence harus 0..1")
    if min_lift < 0:
        raise ValueError("min_lift harus ≥ 0")
    if not 2 <= max_length <= 6:
        raise ValueError("max_length harus 2..6")
    baskets, items = _baskets(df, columns)
    n = len(baskets)
    freq = _frequent(baskets, min_support, max_length)
    rules = []
    for itemset, sup in freq.items():
        if len(itemset) < 2:
            continue
        for r in range(1, len(itemset)):
            for ant in itertools.combinations(sorted(itemset), r):
                ant_s, con_s = frozenset(ant), itemset - frozenset(ant)
                sup_ant = freq.get(ant_s)
                if not sup_ant:
                    continue
                conf = sup / sup_ant
                sup_con = freq.get(con_s, sum(1 for b in baskets if con_s <= b) / n)
                lift = conf / sup_con if sup_con else 0.0
                if conf >= min_confidence and lift >= min_lift:
                    rules.append({"antecedent": sorted(ant_s), "consequent": sorted(con_s), "support": clean(sup), "confidence": clean(conf), "lift": clean(lift)})
    rules.sort(key=lambda r: (-r["lift"], -r["confidence"]))
    itemsets = [{"items": sorted(s), "support": clean(v)} for s, v in sorted(freq.items(), key=lambda kv: (-kv[1], sorted(kv[0])))]
    warnings = []
    if not rules:
        warnings.append("Tidak ada rule lolos filter — turunkan min_support/min_confidence/min_lift atau naikkan max_length")
    top = rules[0] if rules else None
    return {
        "method": "apriori", "method_name": METHOD_NAMES["apriori"], "alpha": alpha, "n": int(n),
        "statistics": {
            "algorithm": "apriori", "n_transactions": int(n), "n_items": int(len(items)),
            "rule_count": int(len(rules)), "frequent_itemset_count": int(len(freq)),
            "frequent_itemsets": itemsets[:50], "rules": rules[:100],
        },
        "assumptions": [{"name": "representasi transaksi", "passed": None, "note": "tiap baris = 1 transaksi; kolom kategorikal di-one-hot otomatis (kolom=nilai)"}],
        "formula_latex": r"\mathrm{supp}(A\to B)=\frac{|A\cap B|}{N},\ \mathrm{conf}=\frac{\mathrm{supp}(A\cup B)}{\mathrm{supp}(A)},\ \mathrm{lift}=\frac{\mathrm{conf}}{\mathrm{supp}(B)}",
        "parameters": {"columns": columns, "min_support": min_support, "min_confidence": min_confidence, "min_lift": min_lift, "max_length": max_length},
        "calculation": [f"{n} transaksi, {len(items)} item unik", f"{len(freq)} frequent itemset (support ≥ {min_support}), {len(rules)} rule lolos"] + ([f"Top: {{{', '.join(top['antecedent'])}}} → {{{', '.join(top['consequent'])}}}: supp={top['support']:.3f}, conf={top['confidence']:.3f}, lift={top['lift']:.3f}"] if top else []),
        "decision": None,
        "effect_size": {"rule_count": int(len(rules)), "top_lift": clean(top["lift"]) if top else None},
        "interpretation": ("Tidak ada pola asosiasi yang lolos filter." if not rules else f"Ditemukan {len(rules)} rule. Terkuat: {', '.join(top['antecedent'])} → {', '.join(top['consequent'])} (support={top['support']:.2f}, confidence={top['confidence']:.2f}, lift={top['lift']:.2f}) — lift>1 berarti asosiasi positif."),
        "warnings": warnings,
    }
