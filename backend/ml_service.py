import hashlib
import json
from collections import OrderedDict

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler

N_CLUSTERS = 5

# Keywords used to assign human-readable names to clusters post-fit.
# Ordered by priority — first category to exceed 0 hits wins; ties broken
# by whichever keyword list has the most matches.
_CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Subscriptions", ["netflix", "spotify", "hulu", "prime", "digital", "premium", "plus"]),
    ("Transport", ["uber", "lyft", "trip", "shell", "gas", "fuel", "oil", "atm", "withdrawal"]),
    ("Food & Dining", ["eats", "starbucks", "coffee", "food", "doordash", "grubhub", "restaurant"]),
    ("Shopping", ["amazon", "amzn", "target", "whole foods", "wfm", "cvs", "pharmacy", "mktp"]),
    ("Entertainment & Health", ["steam", "valve", "game", "fitness", "planet", "gym", "sport"]),
]

# ---------------------------------------------------------------------------
# Result cache
# ---------------------------------------------------------------------------
# Clustering is deterministic (random_state=42) and depends only on the
# vendor/amount/date of the rows — never on manual_category. We therefore
# memoise the cluster assignment keyed on a content hash of *just* those
# fields. Two big wins:
#   1. Toggling a manual override (the most common edit) does NOT recompute
#      K-Means, since the override is not part of the key.
#   2. Repeated reads of unchanged data (page reloads, multiple tabs, the
#      re-fetch that follows every mutation) are served from memory.
# This preserves the "ML always runs on raw data, never persisted" design:
# the cache is a pure-function memo, invalidated automatically whenever the
# underlying data changes (the hash changes).
_CACHE_MAXSIZE = 16
_assignment_cache: "OrderedDict[str, dict[str, tuple[int, str]]]" = OrderedDict()


def _cache_key(transactions: list[dict]) -> str:
    payload = [
        [t.get("transaction_id"), t.get("date"), t.get("vendor"), t.get("amount")]
        for t in transactions
    ]
    blob = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()


def _best_label(combined: str) -> str:
    """Single best category for an aggregated vendor string (used for tiny sets)."""
    best_label, best_score = "Uncategorized", 0
    for label, keywords in _CATEGORY_KEYWORDS:
        score = sum(kw in combined for kw in keywords)
        if score > best_score:
            best_label, best_score = label, score
    return best_label


def _next_misc(used: set[str]) -> str:
    i = 0
    while True:
        name = "Misc" if i == 0 else f"Misc {i}"
        if name not in used:
            return name
        i += 1


def _name_clusters(df: pd.DataFrame, k: int) -> dict[int, str]:
    """
    Score every cluster against every category, then greedily assign labels
    highest-score-first so no two clusters share a name. Clusters with no
    keyword signal at all fall back to a numbered Misc slot instead of
    borrowing an unrelated category name.
    """
    scored: list[tuple[int, list[tuple[int, str]]]] = []
    for cluster_id in range(k):
        mask = df["cluster_id"] == cluster_id
        combined = " ".join(v.lower() for v in df.loc[mask, "vendor"].tolist() if v)
        ranking = sorted(
            ((sum(kw in combined for kw in kws), label) for label, kws in _CATEGORY_KEYWORDS),
            reverse=True,
        )
        scored.append((cluster_id, ranking))

    # Process clusters with the strongest keyword signal first.
    scored.sort(key=lambda x: x[1][0][0], reverse=True)

    used: set[str] = set()
    names: dict[int, str] = {}
    for cluster_id, ranking in scored:
        chosen = None
        for score, label in ranking:
            if score > 0 and label not in used:
                chosen = label
                break
        if chosen is None:
            chosen = _next_misc(used)
        names[cluster_id] = chosen
        used.add(chosen)
    return names


def _compute_assignments(transactions: list[dict]) -> dict[str, tuple[int, str]]:
    """Run the full clean → vectorize → cluster → label pipeline."""
    df = pd.DataFrame(transactions)
    n = len(df)
    k = max(1, min(N_CLUSTERS, n))

    # ------------------------------------------------------------------ #
    # 1. Data Cleaning                                                     #
    # ------------------------------------------------------------------ #
    df["amount"] = pd.to_numeric(df.get("amount"), errors="coerce")
    median_amount = df["amount"].median()
    if pd.isna(median_amount):  # every amount was null/NaN
        median_amount = 0.0
    df["amount"] = df["amount"].fillna(median_amount)

    df["vendor"] = df.get("vendor").fillna("Unknown")
    df["vendor"] = df["vendor"].replace(r"^\s*$", "Unknown", regex=True)

    # Too few rows to separate — single keyword-labeled bucket.
    if k == 1:
        combined = " ".join(v.lower() for v in df["vendor"].tolist() if v)
        label = _best_label(combined)
        return {t["transaction_id"]: (0, label) for t in transactions}

    # ------------------------------------------------------------------ #
    # 2. Feature Engineering                                               #
    # ------------------------------------------------------------------ #
    # Character n-gram TF-IDF: robust to noisy vendor strings and
    # abbreviations (e.g. "AMZN Mktp" ≈ "Amazon", "UBER *TRIP" ≈ "Uber Trip").
    tfidf = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),
        max_features=60,
        sublinear_tf=True,
    )
    vendor_matrix = tfidf.fit_transform(df["vendor"])  # sparse (n, ≤60)

    scaler = StandardScaler()
    amount_scaled = scaler.fit_transform(df[["amount"]])  # dense (n, 1)

    features = np.hstack([vendor_matrix.toarray(), amount_scaled])

    # ------------------------------------------------------------------ #
    # 3. K-Means Clustering                                                #
    # ------------------------------------------------------------------ #
    kmeans = KMeans(n_clusters=k, random_state=42, n_init="auto")
    df["cluster_id"] = kmeans.fit_predict(features)

    # ------------------------------------------------------------------ #
    # 4. Human-Readable Cluster Labels (unique per cluster)               #
    # ------------------------------------------------------------------ #
    cluster_names = _name_clusters(df, k)

    return {
        t["transaction_id"]: (int(cid), cluster_names[int(cid)])
        for t, cid in zip(transactions, df["cluster_id"].tolist())
    }


def cluster_transactions(transactions: list[dict]) -> list[dict]:
    """
    Clean raw transaction dicts, engineer features, run K-Means clustering,
    and return the original records augmented with `cluster_id` and
    `cluster_name`. Results are memoised on a content hash of the raw data so
    identical inputs (and override-only edits) are served without recomputing.

    Every returned row is guaranteed to carry `cluster_id` and `cluster_name`,
    regardless of dataset size, so the frontend never has to defend against a
    missing label.
    """
    if not transactions:
        return []

    key = _cache_key(transactions)
    assignments = _assignment_cache.get(key)
    if assignments is None:
        assignments = _compute_assignments(transactions)
        _assignment_cache[key] = assignments
        while len(_assignment_cache) > _CACHE_MAXSIZE:
            _assignment_cache.popitem(last=False)
    _assignment_cache.move_to_end(key)

    result = []
    for t in transactions:
        enriched = dict(t)
        cid, cname = assignments.get(t["transaction_id"], (0, "Uncategorized"))
        enriched["cluster_id"] = cid
        enriched["cluster_name"] = cname
        result.append(enriched)
    return result
