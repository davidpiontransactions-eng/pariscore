#!/usr/bin/env python3
"""
CatBoost Phase 1 — Training script for PariScore (football).

Data source : SQLite kv['history_matches'] — verified archived matches
              with Poisson predictions + real scores.

Meta-learner design: CatBoost corrects Poisson miscalibration using
team/league categorical context (ordered target encoding, zero preprocessing).

Features: Poisson probs (0-100) + fair odds + temporal + categorical.
Labels  : 1X2 from realScore, over25 binary, btts binary.

Output (stdout, single JSON line):
  { sport, n_total, n_train, n_val, trained_at, models: { 1x2: {path, rps, ...}, ... } }
All other output → stderr.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from catboost import CatBoostClassifier, Pool
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
DB_DEFAULT = ROOT / "pariscore.db"
MODELS_DIR = ROOT / "models"

# ── Feature schema — order MUST match infer_catboost.py exactly ───────────────
FEATURE_NAMES: list[str] = [
    "p_home_win", "p_draw", "p_away_win",   # Poisson 1X2 (0-100)
    "p_over25", "p_over15", "p_btts",        # Poisson markets (0-100)
    "p_cs00",                                 # Poisson clean sheet (0-100)
    "fair_home", "fair_draw", "fair_away",    # No-vig fair probs (0-100 scaled)
    "month", "hour", "dow",                   # Temporal
    "league", "home_team", "away_team",       # Categorical (ordered encoding)
]
CAT_FEATURE_INDICES: list[int] = [
    FEATURE_NAMES.index("league"),
    FEATURE_NAMES.index("home_team"),
    FEATURE_NAMES.index("away_team"),
]


# ── RPS (Ranked Probability Score) — lower is better, range [0, 1] ────────────
def ranked_probability_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    RPS for ordered 3-class outcomes (home=0, draw=1, away=2).
    Formula: RPS_i = (1/2) * sum_{k=0}^{1} (cum_pred_k - cum_outcome_k)^2
    """
    n = len(y_true)
    total = 0.0
    for i in range(n):
        cls = int(y_true[i])
        # Cumulative outcome: 1 at all ranks >= cls
        cum_o = [1.0 if cls <= k else 0.0 for k in range(2)]
        cum_p = [float(y_pred[i, 0]), float(y_pred[i, 0] + y_pred[i, 1])]
        total += 0.5 * sum((cp - co) ** 2 for cp, co in zip(cum_p, cum_o))
    return total / n


def _safe_float(val: Any, default: float) -> float:
    try:
        v = float(val)
        import math
        return v if math.isfinite(v) else default
    except (TypeError, ValueError):
        return default


# ── Data loading ──────────────────────────────────────────────────────────────

def load_history(db_path: Path) -> list[dict[str, Any]]:
    """Read history_matches JSON array from SQLite kv table."""
    conn = sqlite3.connect(str(db_path))
    try:
        row = conn.execute(
            "SELECT value FROM kv WHERE key = 'history_matches'"
        ).fetchone()
        return json.loads(row[0]) if row else []
    finally:
        conn.close()


def extract_features(
    records: list[dict[str, Any]],
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Build feature matrix + label vectors from verified history records.

    Returns (X, y_1x2, y_over25, y_btts).
    Accepts records with or without poisson_snapshot:
    - With snapshot: all 16 features populated (meta-learner mode).
    - Without snapshot: Poisson/fair features = NaN (CatBoost handles natively,
      falls back to categorical+temporal signal only).
    Tennis records are excluded (football model only).
    """
    X_rows: list[list[Any]] = []
    y_1x2: list[int] = []
    y_over25: list[int] = []
    y_btts: list[int] = []

    NAN = float("nan")

    for r in records:
        if not r.get("verified") or not r.get("realScore"):
            continue

        # Football only — exclude tennis IDs and leagues
        sport_id: str = str(r.get("id") or "")
        league: str = str(r.get("league") or "")
        if "tennis" in sport_id.lower() or "tennis" in league.lower():
            continue

        predicted = r.get("predicted") or {}
        ps: dict = predicted.get("poisson_snapshot") or {}
        fair: dict = predicted.get("fair") or {}
        score: dict = r["realScore"]

        # Guard against corrupt score data (e.g. negative goals from bad ETL)
        try:
            h_goals = max(0, int(score.get("home") or 0))
            a_goals = max(0, int(score.get("away") or 0))
        except (TypeError, ValueError):
            continue

        # --- Labels ---
        if h_goals > a_goals:
            result_1x2 = 0  # home win
        elif h_goals == a_goals:
            result_1x2 = 1  # draw
        else:
            result_1x2 = 2  # away win

        # --- Temporal features ---
        ct: str = r.get("commence_time") or ""
        try:
            dt = datetime.fromisoformat(ct.replace("Z", "+00:00"))
            month, hour, dow = dt.month, dt.hour, dt.weekday()
        except Exception:
            month, hour, dow = 6, 20, 5

        # --- Poisson/fair features — NaN when absent (CatBoost handles missing) ---
        has_ps = bool(ps and ps.get("homeWin") is not None)
        has_fair = bool(fair and fair.get("home") is not None)

        row: list[Any] = [
            _safe_float(ps.get("homeWin"), NAN) if has_ps else NAN,
            _safe_float(ps.get("draw"),    NAN) if has_ps else NAN,
            _safe_float(ps.get("awayWin"), NAN) if has_ps else NAN,
            _safe_float(ps.get("over25"),  NAN) if has_ps else NAN,
            _safe_float(ps.get("over15"),  NAN) if has_ps else NAN,
            _safe_float(ps.get("btts"),    NAN) if has_ps else NAN,
            _safe_float(ps.get("cs00"),    NAN) if has_ps else NAN,
            _safe_float(fair.get("home"),  NAN) * 100.0 if has_fair else NAN,
            _safe_float(fair.get("draw"),  NAN) * 100.0 if has_fair else NAN,
            _safe_float(fair.get("away"),  NAN) * 100.0 if has_fair else NAN,
            month,
            hour,
            dow,
            str(r.get("league") or "unknown"),
            str(r.get("home_team") or "unknown"),
            str(r.get("away_team") or "unknown"),
        ]

        X_rows.append(row)
        y_1x2.append(result_1x2)
        y_over25.append(1 if (h_goals + a_goals) > 2.5 else 0)
        y_btts.append(1 if (h_goals > 0 and a_goals > 0) else 0)

    if not X_rows:
        return (
            np.empty((0, len(FEATURE_NAMES)), dtype=object),
            np.array([], dtype=np.int32),
            np.array([], dtype=np.int32),
            np.array([], dtype=np.int32),
        )

    return (
        np.array(X_rows, dtype=object),
        np.array(y_1x2, dtype=np.int32),
        np.array(y_over25, dtype=np.int32),
        np.array(y_btts, dtype=np.int32),
    )


# ── Training ──────────────────────────────────────────────────────────────────

def train_1x2(
    X_tr: np.ndarray, y_tr: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
) -> tuple[CatBoostClassifier, float]:
    """Train 1X2 multiclass model. Returns (model, rps_on_val)."""
    model = CatBoostClassifier(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        loss_function="MultiClass",
        eval_metric="MultiClass",
        random_seed=42,
        verbose=0,
        cat_features=CAT_FEATURE_INDICES,
        l2_leaf_reg=3.0,
        nan_mode="Min",
        use_best_model=True,
        early_stopping_rounds=50,
    )
    val_pool = Pool(X_val, y_val, cat_features=CAT_FEATURE_INDICES)
    model.fit(X_tr, y_tr, eval_set=val_pool)
    rps = ranked_probability_score(y_val, model.predict_proba(X_val))
    return model, rps


def train_binary(
    X_tr: np.ndarray, y_tr: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
) -> tuple[CatBoostClassifier, float]:
    """Train binary (over25 / btts) model. Returns (model, accuracy_on_val)."""
    model = CatBoostClassifier(
        iterations=300,
        learning_rate=0.05,
        depth=5,
        loss_function="Logloss",
        eval_metric="AUC",
        random_seed=42,
        verbose=0,
        cat_features=CAT_FEATURE_INDICES,
        l2_leaf_reg=3.0,
        nan_mode="Min",
        use_best_model=True,
        early_stopping_rounds=40,
    )
    val_pool = Pool(X_val, y_val, cat_features=CAT_FEATURE_INDICES)
    model.fit(X_tr, y_tr, eval_set=val_pool)
    y_pred = (model.predict_proba(X_val)[:, 1] >= 0.5).astype(int)
    acc = float(np.mean(y_pred == y_val))
    return model, acc


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Train CatBoost models for PariScore")
    parser.add_argument("--db", default=str(DB_DEFAULT))
    parser.add_argument("--models-dir", default=str(MODELS_DIR))
    parser.add_argument("--test-size", type=float, default=0.20)
    args = parser.parse_args()

    db_path = Path(args.db)
    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    if not db_path.exists():
        print(json.dumps({"error": f"DB not found: {db_path}"}))
        sys.exit(1)

    records = load_history(db_path)
    n_raw = len(records)
    X, y_1x2, y_over25, y_btts = extract_features(records)
    n_usable = len(X) if X is not None and len(X) > 0 else 0

    # Count records that have full Poisson features vs NaN-only (categorical fallback)
    n_with_poisson = 0
    if n_usable > 0:
        import math as _math
        n_with_poisson = int(sum(
            1 for row in X if not _math.isnan(float(row[0])) if row[0] is not None
        ))

    MIN_SAMPLES = 50
    if n_usable < MIN_SAMPLES:
        print(json.dumps({
            "error": f"Insufficient data: {n_raw} records, {n_usable} usable (min {MIN_SAMPLES})",
            "n_raw": n_raw,
            "n_usable": n_usable,
        }))
        sys.exit(1)

    # Stratified split (preserve class balance)
    idx = np.arange(len(X))
    idx_tr, idx_val = train_test_split(
        idx, test_size=args.test_size, random_state=42, stratify=y_1x2
    )
    X_tr, X_val = X[idx_tr], X[idx_val]

    result: dict[str, Any] = {
        "sport": "football",
        "n_total": len(X),
        "n_with_poisson": n_with_poisson,
        "n_categorical_only": len(X) - n_with_poisson,
        "n_train": len(idx_tr),
        "n_val": len(idx_val),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "models": {},
    }

    # --- 1X2 ---
    m_1x2, rps_score = train_1x2(X_tr, y_1x2[idx_tr], X_val, y_1x2[idx_val])
    p_1x2 = str(models_dir / "catboost_football_1x2_v1.cbm")
    m_1x2.save_model(p_1x2)
    result["models"]["1x2"] = {
        "path": p_1x2,
        "rps": round(rps_score, 6),
        "rps_poisson_baseline": 0.2082,
        "rps_improvement_pct": round((0.2082 - rps_score) / 0.2082 * 100, 2),
    }

    # --- Over 2.5 ---
    m_o25, acc_o25 = train_binary(X_tr, y_over25[idx_tr], X_val, y_over25[idx_val])
    p_o25 = str(models_dir / "catboost_football_over25_v1.cbm")
    m_o25.save_model(p_o25)
    result["models"]["over25"] = {"path": p_o25, "accuracy": round(acc_o25, 4)}

    # --- BTTS ---
    m_btts, acc_btts = train_binary(X_tr, y_btts[idx_tr], X_val, y_btts[idx_val])
    p_btts = str(models_dir / "catboost_football_btts_v1.cbm")
    m_btts.save_model(p_btts)
    result["models"]["btts"] = {"path": p_btts, "accuracy": round(acc_btts, 4)}

    # Feature importance (top 5 — logged to stderr only)
    try:
        fi = m_1x2.get_feature_importance(prettified=True)
        top5 = fi.head(5)[["Feature Id", "Importances"]].to_dict("records")
        print(f"[CatBoost] Feature importance top-5: {top5}", file=sys.stderr)
    except Exception:
        pass

    print(json.dumps(result))


if __name__ == "__main__":
    main()
