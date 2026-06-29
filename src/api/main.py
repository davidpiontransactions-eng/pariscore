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

import sys
from pathlib import Path

# Ensure project root is on sys.path (works even when uvicorn spawns a child)
_root = str(Path(__file__).resolve().parent.parent.parent)
if _root not in sys.path:
    sys.path.insert(0, _root)

import logging
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .routes.tennis import router as tennis_router

from src.schema.match import PredictionResponse
from src.schema.ufc import UFCPredictionResponse, UFCFightFeatures
from src.features.pipeline import FeaturePipeline
from src.models.train import FEATURE_COLUMNS
from src.models.registry import MODEL_REGISTRY, ModelEntry
from src.strategies.engine import BacktestEngine
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
        self.generated_df: pd.DataFrame | None = None

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


@app.post("/predict/batch")
async def predict_batch(matchups: list[dict]):
    """Prédiction vectorisée sur N matchups en un seul appel.

    Au lieu de N appels individuels à predict_proba (≈3s/req),
    on construit une matrice N×18 et on appelle predict_proba une seule fois.
    """
    if not matchups:
        raise HTTPException(status_code=400, detail="Liste de matchups vide")

    missing = set(state.feature_columns) - set(matchups[0].keys())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Colonnes manquantes: {missing}. "
                   "Générez d'abord les features via /features/generate",
        )

    # Construction de la matrice N×18
    cols = state.feature_columns if state.feature_columns else FEATURE_COLUMNS
    X = np.array([
        [m.get(col, 0.0) for col in cols]
        for m in matchups
    ])

    # Appel unique à predict_proba — c'est ici que sklearn vectorise
    probas = state.model.predict_proba(X)[:, 1]

    results = []
    for i, m in enumerate(matchups):
        prob_a = float(probas[i])
        results.append({
            "match_id": m.get("match_id", f"batch_{i}"),
            "player_a_id": m.get("player_a_id", ""),
            "player_b_id": m.get("player_b_id", ""),
            "player_a_name": m.get("player_a_name"),
            "player_b_name": m.get("player_b_name"),
            "prob_a": round(prob_a, 4),
            "prob_b": round(1.0 - prob_a, 4),
            "confidence": round(float(2 * abs(prob_a - 0.5)), 4),
        })

    return {
        "total": len(results),
        "results": results,
        "batch_version": "vectorized_v1",
    }


REQUIRED_SACKMANN_COLS = {"player_id", "match_date", "is_winner",
                         "player_name", "tourney_id", "tourney_name",
                         "surface", "round", "tourney_date"}


@app.post("/features/generate")
async def generate_features(data: dict):
    missing = REQUIRED_SACKMANN_COLS - set(data.keys())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Format de données invalide. L'endpoint /features/generate attend "
                   f"des données de matchs brutes au format Sackmann (une ligne par "
                   f"joueur par match), PAS des features déjà calculées. "
                   f"Colonnes Sackmann manquantes: {sorted(missing)}. "
                   f"Exemple: player_id, match_date, is_winner, player_name, "
                   f"tourney_id, surface, round, score, etc. "
                   f"Utilisez /predict/pre-match si vous avez déjà les features.",
        )
    df = pd.DataFrame([data])
    try:
        result = state.pipeline.run(df)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Erreur lors de la génération des features: {e}. "
                   f"Vérifiez que les données sont au format Sackmann "
                   f"avec les colonnes requises: player_id, match_date, is_winner, ...",
        )
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


# ── Match history & upcoming endpoints ──

GENERATED_FEATURES_PATH = Path("data/generated_features.csv")


def _load_generated_df() -> pd.DataFrame:
    if state.generated_df is not None:
        return state.generated_df
    if not GENERATED_FEATURES_PATH.exists():
        raise HTTPException(status_code=404, detail="Fichier generated_features.csv introuvable")
    df = pd.read_csv(GENERATED_FEATURES_PATH)
    state.generated_df = df
    return df


def _safe_val(v) -> float | None:
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return float(v)


@app.get("/matches/recent")
async def matches_recent():
    if not state.model_loaded:
        raise HTTPException(status_code=503, detail="Modèle non chargé")

    df = _load_generated_df()
    recent = df.tail(20).copy()

    cols = state.feature_columns if state.feature_columns else FEATURE_COLUMNS
    X = recent[cols].fillna(0.0).values
    probas = state.model.predict_proba(X)[:, 1]

    matches = []
    for i, (_, row) in enumerate(recent.iterrows()):
        prob_a = float(probas[i])
        target = int(row.get("target", -1))
        matches.append({
            "match_id": str(row.get("match_id", "")),
            "player_a_name": str(row.get("player_a_name", "")),
            "player_b_name": str(row.get("player_b_name", "")),
            "tourney_name": str(row.get("tourney_name", "")),
            "surface": str(row.get("surface", "")),
            "round": str(row.get("round", "")),
            "tourney_date": str(row.get("tourney_date", "")),
            "prob_a": round(prob_a, 4),
            "prob_b": round(1.0 - prob_a, 4),
            "confidence": round(float(2 * abs(prob_a - 0.5)), 4),
            "target": target,
            "correct": bool((prob_a >= 0.5) == (target == 1)),
            "features": {col: _safe_val(row.get(col)) for col in cols},
        })

    return {"matches": matches, "total": len(matches), "source": "generated_features"}


@app.get("/matches/upcoming")
async def matches_upcoming():
    if not state.model_loaded:
        raise HTTPException(status_code=503, detail="Modèle non chargé")

    df = _load_generated_df()

    df_sorted = df.sort_values("tourney_date", ascending=False)
    df_filtered = df_sorted[df_sorted["target"] == 1].head(20).copy()

    cols = state.feature_columns if state.feature_columns else FEATURE_COLUMNS
    X = df_filtered[cols].fillna(0.0).values
    probas = state.model.predict_proba(X)[:, 1]

    matches = []
    for i, (_, row) in enumerate(df_filtered.iterrows()):
        prob_a = float(probas[i])
        matches.append({
            "match_id": str(row.get("match_id", "")),
            "player_a_name": str(row.get("player_a_name", "")),
            "player_b_name": str(row.get("player_b_name", "")),
            "tourney_name": str(row.get("tourney_name", "")),
            "surface": str(row.get("surface", "")),
            "round": str(row.get("round", "")),
            "tourney_date": str(row.get("tourney_date", "")),
            "prob_a": round(prob_a, 4),
            "prob_b": round(1.0 - prob_a, 4),
            "confidence": round(float(2 * abs(prob_a - 0.5)), 4),
            "status": "upcoming",
            "features": {col: _safe_val(row.get(col)) for col in cols},
        })

    return {"matches": matches, "total": len(matches), "source": "generated_features"}


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

    engine = BacktestEngine(model=state.model)
    result = engine.run_on_real_data(
        strategy=strategy,
        threshold=threshold,
        bankroll=bankroll,
        min_odds=min_odds,
        max_odds=max_odds,
    )
    return result


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


# ── TennisExplorer scraper endpoints ──
app.include_router(tennis_router)


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

