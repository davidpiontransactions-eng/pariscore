"""
API Pariscore — Prédiction sportive (Tennis ATP + UFC MMA).

Endpoints:
  GET   /health                 → Healthcheck
  POST  /predict/pre-match      → Prédiction tennis pré-match
  GET   /predict/pre-match/{match_id}  → Prédiction tennis depuis cache
  POST  /predict/pre-match/mma  → Prédiction UFC/MMA pré-match
  POST  /features/generate      → Génération features tennis
  POST  /strategy/simulate      → Simulation stratégie tennis

Stack: FastAPI + scikit-learn + Pydantic + SportModelRegistry.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.schema.match import PredictionResponse
from src.schema.ufc import UFCPredictionResponse, UFCFightFeatures
from src.features.pipeline import FeaturePipeline
from src.models.train import FEATURE_COLUMNS
from src.models.registry import MODEL_REGISTRY, ModelEntry
from src.features.ufc_pipeline import UFCPipeline
from src.models.mma import UfcBaselineModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pariscore")

app = FastAPI(
    title="Pariscore API",
    description="Prédiction sportive — Top 10 ATP & UFC MMA",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AppState:
    def __init__(self):
        self.model = None
        self.pipeline = FeaturePipeline()
        self.feature_cache: dict = {}
        self.model_loaded = False
        self.model_meta: dict = {}
        self.feature_columns: list[str] = []

state = AppState()


@app.get("/health")
async def health():
    registry_summary = MODEL_REGISTRY.summary()
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "model_loaded": state.model_loaded,
        "version": "1.1.0",
        "registry": registry_summary,
    }


# ── Tennis endpoints (inchangés, compat asc) ──

@app.get("/predict/pre-match/{match_id}")
async def predict_match(match_id: str):
    if match_id not in state.feature_cache:
        raise HTTPException(
            status_code=404,
            detail=f"Match {match_id} non trouvé dans le cache. "
                   "Utilisez POST /predict/pre-match avec les features complètes.",
        )
    features = state.feature_cache[match_id]
    prob_a = _predict(features)
    return PredictionResponse(
        match_id=match_id,
        player_a_id=features.get("player_a_id", ""),
        player_b_id=features.get("player_b_id", ""),
        player_a_name=features.get("player_a_name"),
        player_b_name=features.get("player_b_name"),
        prob_a=round(float(prob_a), 4),
        prob_b=round(1.0 - float(prob_a), 4),
        confidence=_compute_confidence(prob_a),
        key_factors=_extract_key_factors(features),
    )


@app.post("/predict/pre-match")
async def predict_prematch(features: dict):
    missing = set(state.feature_columns) - set(features.keys())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Colonnes manquantes: {missing}. "
                   "Générez d'abord les features via /features/generate",
        )
    prob_a = _predict(features)
    return PredictionResponse(
        match_id=features.get("match_id", "unknown"),
        player_a_id=features.get("player_a_id", ""),
        player_b_id=features.get("player_b_id", ""),
        player_a_name=features.get("player_a_name"),
        player_b_name=features.get("player_b_name"),
        prob_a=round(float(prob_a), 4),
        prob_b=round(1.0 - float(prob_a), 4),
        confidence=_compute_confidence(prob_a),
        key_factors=_extract_key_factors(features),
    )


@app.post("/features/generate")
async def generate_features(data: dict):
    df = pd.DataFrame([data])
    result = state.pipeline.run(df)
    if result.empty:
        raise HTTPException(
            status_code=400,
            detail="Impossible de générer les features. Vérifiez les données d'entrée.",
        )
    feature_row = result.iloc[0].to_dict()
    match_id = feature_row.get("match_id", "generated")
    state.feature_cache[match_id] = feature_row
    return {
        "match_id": match_id,
        "status": "features_generated",
        "feature_count": len(state.feature_columns) if state.model_loaded else len(feature_row),
        "features": feature_row,
    }


@app.post("/strategy/simulate")
async def simulate_strategy(
    model_type: str = "random_forest",
    strategy: str = "value_betting",
    threshold: float = 1.10,
    bankroll: float = 10000.0,
    min_odds: float = 1.50,
    max_odds: float = 5.00,
):
    if not state.model_loaded:
        raise HTTPException(status_code=503, detail="Modèle non chargé")
    return {
        "strategy": strategy,
        "model": model_type,
        "bankroll_initial": bankroll,
        "bankroll_final": bankroll * 1.05,
        "roi_percent": 5.0,
        "sharpe_ratio": 0.8,
        "max_drawdown_percent": -12.0,
        "total_bets": 0,
        "status": "simulation_placeholder",
        "note": "Backtesting complet à implémenter après Session 4",
    }


# ── UFC/MMA endpoints ──

@app.post("/predict/pre-match/mma")
async def predict_ufc(features: UFCFightFeatures):
    sport = "ufc"
    entry = MODEL_REGISTRY.get(sport)

    if not entry or not entry.model_loaded:
        prob_a = 0.5
        confidence = 0.0
        key_factors = _extract_ufc_factors(features.model_dump())
    else:
        prob_a = MODEL_REGISTRY.predict(sport, features.model_dump())
        confidence = float(2 * abs(prob_a - 0.5))
        key_factors = _extract_ufc_factors(features.model_dump())

    value_alert = None
        # Compute implied probabilities from closing decimal odds
    closing_prob_a = 1.0 / features.closing_odds_a if features.closing_odds_a and features.closing_odds_a > 0 else None
    closing_prob_b = 1.0 / features.closing_odds_b if features.closing_odds_b and features.closing_odds_b > 0 else None
    if closing_prob_a is not None and closing_prob_b is not None:
        # Normalize to remove overround
        total = closing_prob_a + closing_prob_b
        closing_prob_a /= total
        closing_prob_b /= total
            # Pack closing probs onto features for value alert
    if closing_prob_a is not None and closing_prob_b is not None:
        features.closing_odds_implied_prob_a = closing_prob_a
        features.closing_odds_implied_prob_b = closing_prob_b
    value_alert = _compute_value_alert(prob_a, features)

    return UFCPredictionResponse(
        fight_id=features.fight_id,
        fighter_a_id=features.fighter_a_id,
        fighter_b_id=features.fighter_b_id,
        fighter_a_name=features.fighter_a_name or features.fighter_a_id,
        fighter_b_name=features.fighter_b_name or features.fighter_b_id,
        weight_class=features.weight_class,
        is_title_fight=features.is_title_fight,
        prob_a=round(float(prob_a), 4),
        prob_b=round(1.0 - float(prob_a), 4),
        confidence=round(float(confidence), 4),
        key_factors=key_factors,
        value_alert=value_alert,
        model_version=entry.model_version if entry else "pariscore-ufc-v0.1",
    )


# ── Fonctions internes tennis ──

def _predict(features: dict) -> float:
    if not state.model_loaded:
        return 0.5
    cols = state.feature_columns if state.feature_columns else FEATURE_COLUMNS
    x = np.array([[
        features.get(col, 0.0)
        for col in cols
    ]])
    return state.model.predict_proba(x)[0, 1]


def _compute_confidence(prob: float) -> float:
    return float(2 * abs(prob - 0.5))


def _extract_key_factors(features: dict) -> list[dict]:
    factors = [
        {"name": "Service Edge", "value_A": features.get("serve_edge_A"),
         "value_B": features.get("serve_edge_B"), "weight": 0.25},
        {"name": "Clutch Factor", "value_A": features.get("clutch_A"),
         "value_B": features.get("clutch_B"), "weight": 0.20},
        {"name": "H2H", "value": features.get("h2h_context_score"), "weight": 0.15},
        {"name": "Forme récente", "value_A": features.get("srv_pts_won_pct_S_DIFF"),
         "value_B": features.get("ret_pts_won_pct_S_DIFF"), "weight": 0.20},
        {"name": "Motivation", "value_A": features.get("motivation_A"),
         "value_B": features.get("motivation_B"), "weight": 0.10},
        {"name": "Fatigue", "value_A": features.get("fatigue_A"),
         "value_B": features.get("fatigue_B"), "weight": 0.10},
    ]
    return [f for f in factors if f.get("value") is not None
            or f.get("value_A") is not None]


# ── Fonctions internes UFC ──

def _extract_ufc_factors(features: dict) -> list[dict]:
    factors = []
    if features.get("true_talent_a") is not None and features.get("true_talent_b") is not None:
        factors.append({
            "label": "True Talent Rating",
            "fighter_a_value": round(features["true_talent_a"], 2),
            "fighter_b_value": round(features["true_talent_b"], 2),
            "advantage": "a" if features["true_talent_a"] > features["true_talent_b"] else "b",
            "weight": 0.30, "icon": "📊",
        })
    if features.get("ewma_strike_diff_S") is not None:
        v = features["ewma_strike_diff_S"]
        factors.append({
            "label": "Striking Differential (S)",
            "fighter_a_value": f"{v:+.3f}",
            "fighter_b_value": f"{-v:+.3f}",
            "advantage": "a" if v > 0 else "b",
            "weight": 0.20, "icon": "👊",
        })
    if features.get("ewma_td_diff_S") is not None:
        v = features["ewma_td_diff_S"]
        factors.append({
            "label": "Takedown Differential (S)",
            "fighter_a_value": f"{v:+.3f}",
            "fighter_b_value": f"{-v:+.3f}",
            "advantage": "a" if v > 0 else "b",
            "weight": 0.15, "icon": "🤼",
        })
    if features.get("reach_advantage_a") is not None:
        v = features["reach_advantage_a"]
        factors.append({
            "label": "Reach Advantage",
            "fighter_a_value": f"{v:+.0f} cm",
            "fighter_b_value": f"{-v:+.0f} cm",
            "advantage": "a" if v > 0 else "b",
            "weight": 0.10, "icon": "📏",
        })
    if features.get("age_difference_a") is not None:
        v = features["age_difference_a"]
        factors.append({
            "label": "Age Difference",
            "fighter_a_value": f"{v:+.0f} yrs",
            "fighter_b_value": f"{-v:+.0f} yrs",
            "advantage": "a" if v < 0 else "b",
            "weight": 0.10, "icon": "🎂",
        })
    if features.get("opening_odds_implied_prob_a") is not None:
        factors.append({
            "label": "Market Opening",
            "fighter_a_value": f"{features['opening_odds_implied_prob_a']*100:.0f}%",
            "fighter_b_value": f"{features['opening_odds_implied_prob_b']*100:.0f}%",
            "advantage": "a" if features["opening_odds_implied_prob_a"] > features["opening_odds_implied_prob_b"] else "b",
            "weight": 0.15, "icon": "💰",
        })
    return factors


def _compute_value_alert(prob_a: float, features: UFCFightFeatures) -> dict | None:
    market_prob_a = features.closing_odds_implied_prob_a or 0.5
    market_prob_b = features.closing_odds_implied_prob_b or 0.5
    ratio_a = prob_a / market_prob_a if market_prob_a > 0 else 1.0
    ratio_b = (1.0 - prob_a) / market_prob_b if market_prob_b > 0 else 1.0
    if ratio_a > 1.15:
        kelly = (prob_a * 1.0 - (1.0 - prob_a)) / 1.0
        return {
            "market_prob": round(market_prob_a, 4),
            "model_prob": round(prob_a, 4),
            "ratio": round(ratio_a, 3),
            "kelly_fraction": round(max(0, kelly * 0.25), 4),
            "expected_value": round(ratio_a - 1.0, 4),
            "recommendation": "bet_a",
        }
    elif ratio_b > 1.15:
        return {
            "market_prob": round(market_prob_b, 4),
            "model_prob": round(1.0 - prob_a, 4),
            "ratio": round(ratio_b, 3),
            "kelly_fraction": 0.0,
            "expected_value": round(ratio_b - 1.0, 4),
            "recommendation": "bet_b",
        }
    return None


@app.on_event("startup")
async def startup():
    model_path = Path("models/pariscore_rf_v1.joblib")
    if model_path.exists():
        try:
            from src.models.train import load_model
            state.model = load_model(model_path)
            state.model_loaded = True
            state.feature_columns = FEATURE_COLUMNS.copy()
            MODEL_REGISTRY.register("tennis", ModelEntry(
                sport="tennis",
                model=state.model,
                feature_columns=FEATURE_COLUMNS.copy(),
                model_loaded=True,
                model_version="1.0.0",
                loaded_at=datetime.utcnow(),
            ))
            logger.info(f"[OK] Modele tennis charge depuis {model_path}")

        except Exception as e:
            logger.warning(f"[!!] Impossible de charger le modele tennis: {e}")

    # ---- UFC/MMA registration ----
    ufc_pipeline = UFCPipeline(min_fights_per_fighter=3)
    MODEL_REGISTRY.register("ufc", ModelEntry(
        sport="ufc",
        pipeline=ufc_pipeline,
        model=UfcBaselineModel(),
        feature_columns=["ewma_strike_diff_S", "ewma_td_diff_S", "true_talent_a"],
        model_loaded=True,
        model_version="pariscore-ufc-v0.1",
        loaded_at=datetime.utcnow(),
    ))
    logger.info("[OK] Modele UFC enregistre (baseline EWMA)")
    logger.info("[i] API Pariscore v1.1.0 prete")
    logger.info("[i] API Pariscore v1.1.0 prete — Tennis + UFC MMA")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
