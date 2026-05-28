#!/usr/bin/env python3
"""
CatBoost Phase 1 — Batch inference script for PariScore.

Reads  stdin : { "features": [ { "id", "home_team", "away_team", "league",
                                  "commence_time", "poisson", "fair" }, ... ] }
Writes stdout: { "predictions": { matchId: { home, draw, away, over25, btts } } }

All 3 models are loaded once at process start.
Any spawn error or non-zero exit → Node.js falls back to Poisson automatically.
"""
from __future__ import annotations

import json
import math
import sys
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"

# ── Feature schema — MUST match train_catboost.py exactly ─────────────────────
FEATURE_NAMES: list[str] = [
    "p_home_win", "p_draw", "p_away_win",
    "p_over25", "p_over15", "p_btts",
    "p_cs00",
    "fair_home", "fair_draw", "fair_away",
    "month", "hour", "dow",
    "league", "home_team", "away_team",
]
CAT_FEATURE_INDICES: list[int] = [
    FEATURE_NAMES.index("league"),
    FEATURE_NAMES.index("home_team"),
    FEATURE_NAMES.index("away_team"),
]

# ── Load all 3 models once at process start (amortised across batch) ──────────
try:
    from catboost import CatBoostClassifier
    import numpy as np

    _m1x2 = CatBoostClassifier()
    _m1x2.load_model(str(MODELS_DIR / "catboost_football_1x2_v1.cbm"))

    _mo25 = CatBoostClassifier()
    _mo25.load_model(str(MODELS_DIR / "catboost_football_over25_v1.cbm"))

    _mbtts = CatBoostClassifier()
    _mbtts.load_model(str(MODELS_DIR / "catboost_football_btts_v1.cbm"))

except Exception as exc:
    print(json.dumps({"error": f"Model load failed: {exc}", "predictions": {}}))
    sys.exit(1)


# ── Feature extraction ────────────────────────────────────────────────────────

def _safe_float(val: Any, default: float) -> float:
    try:
        v = float(val)
        return v if math.isfinite(v) else default
    except (TypeError, ValueError):
        return default


def build_row(feat: dict[str, Any]) -> list[Any]:
    """Convert match feature dict → ordered feature vector (matches FEATURE_NAMES)."""
    ct: str = feat.get("commence_time") or ""
    try:
        dt = datetime.fromisoformat(ct.replace("Z", "+00:00"))
        month, hour, dow = dt.month, dt.hour, dt.weekday()
    except Exception:
        month, hour, dow = 6, 20, 5

    po: dict = feat.get("poisson") or {}
    fair: dict = feat.get("fair") or {}

    return [
        _safe_float(po.get("homeWin"), 33.0),
        _safe_float(po.get("draw"),    33.0),
        _safe_float(po.get("awayWin"), 33.0),
        _safe_float(po.get("over25"),  50.0),
        _safe_float(po.get("over15"),  70.0),
        _safe_float(po.get("btts"),    45.0),
        _safe_float(po.get("cs00"),     5.0),
        _safe_float(fair.get("home"),  0.33) * 100.0,
        _safe_float(fair.get("draw"),  0.33) * 100.0,
        _safe_float(fair.get("away"),  0.33) * 100.0,
        month,
        hour,
        dow,
        str(feat.get("league") or "unknown"),
        str(feat.get("home_team") or "unknown"),
        str(feat.get("away_team") or "unknown"),
    ]


# ── Batch inference ───────────────────────────────────────────────────────────

def predict_batch(
    features: list[dict[str, Any]],
) -> dict[str, dict[str, float]]:
    """
    Run batch prediction on all features.
    Returns dict keyed by match id: { matchId: { home, draw, away, over25, btts } }.
    """
    rows = [build_row(f) for f in features]
    X = np.array(rows, dtype=object)

    proba_1x2  = _m1x2.predict_proba(X)        # (n, 3) — [p_home, p_draw, p_away]
    proba_o25  = _mo25.predict_proba(X)[:, 1]   # (n,)   — P(over25=1)
    proba_btts = _mbtts.predict_proba(X)[:, 1]  # (n,)   — P(btts=1)

    result: dict[str, dict[str, float]] = {}
    for i, feat in enumerate(features):
        mid = feat.get("id")
        if not mid:
            continue
        result[str(mid)] = {
            "home":   round(float(proba_1x2[i, 0]), 4),
            "draw":   round(float(proba_1x2[i, 1]), 4),
            "away":   round(float(proba_1x2[i, 2]), 4),
            "over25": round(float(proba_o25[i]),    4),
            "btts":   round(float(proba_btts[i]),   4),
        }
    return result


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    raw = sys.stdin.read().strip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"stdin JSON parse failed: {exc}", "predictions": {}}))
        sys.exit(1)

    features: list[dict] = payload.get("features") or []
    if not features:
        print(json.dumps({"predictions": {}}))
        sys.exit(0)

    try:
        preds = predict_batch(features)
        print(json.dumps({"predictions": preds}))
    except Exception as exc:
        print(json.dumps({"error": str(exc), "predictions": {}}))
        sys.exit(1)


if __name__ == "__main__":
    main()
