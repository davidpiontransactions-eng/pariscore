"""Schémas Pydantic pour les données de matchs, joueurs et features."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# NOTE: N'importez PAS MatchFeatures — il est déprécié avec des noms divergents.
# Utilisez les features brutes / dict envoyé à predict/pre-match.

# ──────────────────────────────────────────────
# Entités de base
# ──────────────────────────────────────────────

class Player(BaseModel):
    """Joueur ATP."""
    player_id: str = Field(..., description="Identifiant unique (Sackmann)")
    player_name: str = Field(..., description="Nom complet")
    nationality: Optional[str] = Field(None, description="Nationalité (code ISO)")
    birth_date: Optional[date] = Field(None, description="Date de naissance")
    height_cm: Optional[int] = Field(None, ge=100, le=250, description="Taille en cm")
    hand: Optional[str] = Field(None, pattern="^(L|R|U)$", description="Main dominante")


class Tournament(BaseModel):
    """Tournoi."""
    tourney_id: str = Field(..., description="Identifiant unique")
    tourney_name: str = Field(..., description="Nom du tournoi")
    surface: str = Field(..., pattern="^(Hard|Clay|Grass|Carpet)$")
    tourney_level: str = Field(..., pattern="^(G|M|A|F|D)$")
    tourney_date: date = Field(..., description="Date de début")
    tourney_country: Optional[str] = Field(None)
    tourney_lat: Optional[float] = Field(None, ge=-90, le=90)
    tourney_lon: Optional[float] = Field(None, ge=-180, le=180)


class Match(BaseModel):
    """Match ATP complet."""
    match_id: str = Field(..., description="Identifiant unique")
    tourney_id: str
    tourney_name: str
    surface: str
    tourney_date: date
    round: str = Field(..., pattern="^(RR|R128|R64|R32|R16|QF|SF|F)$")
    player_a_id: str
    player_b_id: str
    winner_id: str
    score: Optional[str] = Field(None, description="Score textuel")

    # Stats de match (brutes)
    srv_pts_won_pct: Optional[float] = Field(None, ge=0, le=100)
    ret_pts_won_pct: Optional[float] = Field(None, ge=0, le=100)
    bp_converted_pct: Optional[float] = Field(None, ge=0, le=100)
    bp_saved_pct: Optional[float] = Field(None, ge=0, le=100)
    tb_won_pct: Optional[float] = Field(None, ge=0, le=100)
    ace_count: Optional[int] = Field(None, ge=0)
    df_count: Optional[int] = Field(None, ge=0)
    first_in_pct: Optional[float] = Field(None, ge=0, le=100)
    first_won_pct: Optional[float] = Field(None, ge=0, le=100)
    second_won_pct: Optional[float] = Field(None, ge=0, le=100)

    # Métadonnées
    minutes: Optional[int] = Field(None, ge=0)
    is_grand_slam: bool = Field(False)

    @field_validator("surface")
    @classmethod
    def normalize_surface(cls, v: str) -> str:
        mapping = {
            "Hard": "hard", "Clay": "clay", "Grass": "grass", "Carpet": "carpet",
        }
        return mapping.get(v, v.lower())


# ──────────────────────────────────────────────
# Features calculées
# ──────────────────────────────────────────────

class EwmaFeatures(BaseModel):
    """Features EWMA pour un joueur sur un match."""
    # SRV_PTS_WON
    srv_pts_won_S: Optional[float] = None
    srv_pts_won_L: Optional[float] = None
    srv_pts_won_MOM: Optional[float] = None
    # RET_PTS_WON
    ret_pts_won_S: Optional[float] = None
    ret_pts_won_L: Optional[float] = None
    ret_pts_won_MOM: Optional[float] = None
    # BP_CONV
    bp_conv_S: Optional[float] = None
    # BP_SAVED
    bp_saved_S: Optional[float] = None
    # TB_WINRATE
    tb_winrate_S: Optional[float] = None


class MatchFeatures(BaseModel):
    """⚠️ DÉPRÉCIÉ — Ne pas utiliser.

    Les noms de champs ci-dessous ne correspondent PAS à FEATURE_COLUMNS
    (train.py). Cette classe n'est plus utilisée par le pipeline actif.
    Utilisez les dictionnaires bruts envoyés à /predict/pre-match à la place.
    Voir FEATURE_COLUMNS dans src/models/train.py pour les noms exacts.
    """
    match_id: str

    # Noyau dur
    srv_edge_A: Optional[float] = None
    srv_edge_B: Optional[float] = None
    clutch_factor_A: Optional[float] = None
    clutch_factor_B: Optional[float] = None
    h2h_context_score: Optional[float] = None
    age_30_A: Optional[float] = None
    age_30_B: Optional[float] = None
    atp_points_6m_A: Optional[int] = None
    atp_points_6m_B: Optional[int] = None

    # EWMA différentiel A − B
    srv_pts_won_DIFF: Optional[float] = None
    ret_pts_won_DIFF: Optional[float] = None

    # Angles morts
    motivation_A: Optional[float] = None
    motivation_B: Optional[float] = None
    fatigue_A: Optional[float] = None
    fatigue_B: Optional[float] = None
    public_advantage: Optional[float] = None  # 1.0 = A à domicile


class PredictionResponse(BaseModel):
    """Réponse de prédiction pour un match."""
    match_id: str
    player_a_id: str
    player_b_id: str
    player_a_name: Optional[str] = None
    player_b_name: Optional[str] = None
    prob_a: float = Field(..., ge=0, le=1)
    prob_b: float = Field(..., ge=0, le=1)
    confidence: Optional[float] = Field(None, ge=0, le=1)
    key_factors: list[dict] = Field(default_factory=list)
    model_version: str = "pariscore-v1.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
