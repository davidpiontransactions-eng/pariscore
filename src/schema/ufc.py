"""Schémas Pydantic UFC — module indépendant du schéma tennis.

Ce fichier contient tous les types Pydantic spécifiques à l'UFC/MMA.
Aucune dépendance vers le module tennis existant (src/schema/match.py).
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Enums ──

class Stance(str, Enum):
    """Garde du combattant."""
    orthodox = "orthodox"
    southpaw = "southpaw"
    switch = "switch"


class WeightClass(str, Enum):
    """Catégories de poids UFC."""
    strawweight = "strawweight"
    flyweight = "flyweight"
    bantamweight = "bantamweight"
    featherweight = "featherweight"
    lightweight = "lightweight"
    welterweight = "welterweight"
    middleweight = "middleweight"
    light_heavyweight = "light_heavyweight"
    heavyweight = "heavyweight"


class FightMethod(str, Enum):
    """Méthode de victoire."""
    ko_tko = "ko_tko"
    submission = "submission"
    decision_unanimous = "decision_unanimous"
    decision_split = "decision_split"
    decision_majority = "decision_majority"
    draw = "draw"
    no_contest = "no_contest"


class FighterStyle(str, Enum):
    """Style principal du combattant (déduit des stats)."""
    striker = "striker"
    grappler = "grappler"
    brawler = "brawler"
    all_rounder = "all_rounder"


# ── Entités de base ──

class UFCFighter(BaseModel):
    """Combattant UFC — données biographiques et carrière."""
    fighter_id: str = Field(..., description="Identifiant unique (UFCStats / Tapology)")
    fighter_name: str = Field(..., min_length=1, description="Nom complet")
    nickname: Optional[str] = Field(None, description="Surnom")
    nationality: Optional[str] = Field(None, pattern="^[A-Z]{2}$", description="Code ISO pays (ex: BR, US)")
    birth_date: Optional[date] = Field(None, description="Date de naissance")
    height_cm: Optional[int] = Field(None, ge=120, le=250, description="Taille en cm")
    reach_cm: Optional[int] = Field(None, ge=120, le=250, description="Envergure en cm")
    weight_class: WeightClass
    stance: Stance = Stance.orthodox
    record_wins: int = Field(..., ge=0, description="Nombre de victoires")
    record_losses: int = Field(..., ge=0, description="Nombre de défaites")
    record_draws: int = Field(0, ge=0, description="Nombre de matchs nuls")
    fighter_style: FighterStyle = FighterStyle.all_rounder

    @property
    def record_str(self) -> str:
        return f"{self.record_wins}-{self.record_losses}-{self.record_draws}"

    @property
    def win_rate(self) -> float:
        total = self.record_wins + self.record_losses
        return self.record_wins / total if total > 0 else 0.0


class UFCEvent(BaseModel):
    """Event UFC (une soirée de combats)."""
    event_id: str = Field(..., description="Identifiant unique")
    event_name: str = Field(..., description="Nom de l'event (ex: UFC 314)")
    event_date: date
    venue: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = Field(None, pattern="^[A-Z]{2}$")


class UFCFight(BaseModel):
    """Combat UFC — toutes les données avant et après combat."""
    fight_id: str = Field(..., description="Identifiant unique")
    event_id: str
    event_name: str
    event_date: date
    weight_class: WeightClass
    is_title_fight: bool = False
    is_main_event: bool = False
    is_interim: bool = False
    rounds: int = Field(3, ge=3, le=5, description="3 rounds (standard) ou 5 (main event / title)")
    fighter_a_id: str
    fighter_b_id: str
    winner_id: Optional[str] = Field(None, description="ID du vainqueur (None si pré-fight)")
    method: Optional[FightMethod] = Field(None, description="Méthode de victoire")
    round_finished: Optional[int] = Field(None, ge=1, le=5, description="Round de fin")
    time_finished_sec: Optional[int] = Field(None, ge=0, le=900, description="Temps de fin en secondes")

    # Cotes
    opening_odds_a: Optional[float] = Field(None, ge=1.0, description="Cote ouverture fighter A (décimal)")
    opening_odds_b: Optional[float] = Field(None, ge=1.0, description="Cote ouverture fighter B (décimal)")
    closing_odds_a: Optional[float] = Field(None, ge=1.0, description="Cote fermeture fighter A (décimal)")
    closing_odds_b: Optional[float] = Field(None, ge=1.0, description="Cote fermeture fighter B (décimal)")


# ── Features EWMA ──

class UFCEwmaFeatures(BaseModel):
    """Features EWMA calculées pour un combattant avant un combat.

    Les fenêtres EWMA :
      S (court terme, τ=0.30) : ~3 derniers combats
      M (moyen terme, τ=0.15) : ~6 derniers combats
      L (long terme,  τ=0.05) : toute la carrière
    """
    # Significant Strikes
    sig_str_landed_pct_S: Optional[float] = Field(None, ge=0, le=100)
    sig_str_landed_pct_M: Optional[float] = Field(None, ge=0, le=100)
    sig_str_landed_pct_L: Optional[float] = Field(None, ge=0, le=100)
    sig_str_absorbed_pct_S: Optional[float] = Field(None, ge=0, le=100)
    sig_str_defense_S: Optional[float] = Field(None, ge=0, le=100)

    # Takedowns
    td_avg_per_15_S: Optional[float] = Field(None, ge=0, description="TD/15min")
    td_accuracy_S: Optional[float] = Field(None, ge=0, le=100)
    td_defense_S: Optional[float] = Field(None, ge=0, le=100)
    td_avg_per_15_M: Optional[float] = Field(None, ge=0)

    # Submission & Control
    sub_attempts_per_15_S: Optional[float] = Field(None, ge=0)
    ctrl_time_per_15_sec_S: Optional[float] = Field(None, ge=0)

    # Taux carrière
    ko_rate_career: Optional[float] = Field(None, ge=0, le=1)
    sub_rate_career: Optional[float] = Field(None, ge=0, le=1)
    dec_rate_career: Optional[float] = Field(None, ge=0, le=1)

    # Volume
    sig_str_landed_per_min_S: Optional[float] = Field(None, ge=0)
    sig_str_absorbed_per_min_S: Optional[float] = Field(None, ge=0)
    strike_differential_S: Optional[float] = Field(None, description="Landed - Absorbed")


# ── Match Features (vecteur complet) ──

class UFCFightFeatures(BaseModel):
    """Feature vector complet pour un combat UFC pré-fight.

    Ce vecteur est l'entrée du modèle de prédiction.
    Toutes les features doivent être calculées AVANT le combat (point-in-time).
    """
    fight_id: str
    fighter_a_id: str
    fighter_b_id: str
    fighter_a_name: str = ""
    fighter_b_name: str = ""
    weight_class: WeightClass = WeightClass.lightweight
    is_title_fight: bool = False
    rounds: int = 3

    # True Talent Rating (bayésien)
    true_talent_a: Optional[float] = Field(None, description="TT rating fighter A")
    true_talent_b: Optional[float] = Field(None, description="TT rating fighter B")
    opponent_strength_a: Optional[float] = Field(None, description="SOS fighter A")
    opponent_strength_b: Optional[float] = Field(None, description="SOS fighter B")

    # EWMA différentiel A − B
    ewma_strike_diff_S: Optional[float] = Field(None, description="strike_landed_A - strike_absorbed_B (S)")
    ewma_td_diff_S: Optional[float] = Field(None, description="td_avg_A - td_defense_B (S)")
    ewma_defense_diff_S: Optional[float] = Field(None, description="defense_A - offense_B")

    # Features contextuelles
    reach_advantage_a: Optional[float] = Field(None, description="reach_A - reach_B (cm)")
    age_difference_a: Optional[float] = Field(None, description="age_A - age_B")
    days_since_last_a: Optional[int] = Field(None, ge=0)
    days_since_last_b: Optional[int] = Field(None, ge=0)
    is_short_notice_a: bool = False
    is_short_notice_b: bool = False
    stance_advantage: Optional[float] = Field(None, description="+1 si southpaw vs orthodox")
    weight_class_avg_finish_rate: Optional[float] = Field(None, ge=0, le=1)

    # Cotes d'ouverture (features d'entrée uniquement, jamais les cotes de fermeture)
    opening_odds_implied_prob_a: Optional[float] = Field(None, ge=0, le=1)
    opening_odds_implied_prob_b: Optional[float] = Field(None, ge=0, le=1)

    # Cotes de fermeture (pour value betting uniquement, jamais utilisées par le modèle)
    closing_odds_a: Optional[float] = Field(None, ge=1.0, description="Cote fermeture fighter A (décimal)")
    closing_odds_b: Optional[float] = Field(None, ge=1.0, description="Cote fermeture fighter B (décimal)")
    closing_odds_implied_prob_a: Optional[float] = Field(None, ge=0, le=1, description="Prob implicite fermeture A")
    closing_odds_implied_prob_b: Optional[float] = Field(None, ge=0, le=1, description="Prob implicite fermeture B")

    # Angles morts
    camp_changed_a: bool = False
    camp_changed_b: bool = False
    weight_cut_concern_a: bool = False
    weight_cut_concern_b: bool = False
    same_opponent_rematch: bool = False
    fighter_a_streak: Optional[int] = Field(None, description="pos=win streak, neg=loss streak")
    fighter_b_streak: Optional[int] = Field(None)


# ── Prédiction (réponse API) ──

class UFCKeyFactor(BaseModel):
    """Facteur clé d'une prédiction UFC — affiché dans l'UI."""
    label: str
    fighter_a_value: float | str
    fighter_b_value: float | str
    advantage: str = "neutral"  # "a" | "b" | "neutral"
    weight: float = Field(0.0, ge=0, le=1)
    icon: str = ""


class ValueAlert(BaseModel):
    """Alerte de value betting détectée."""
    market_prob: float = Field(..., ge=0, le=1)
    model_prob: float = Field(..., ge=0, le=1)
    ratio: float = Field(..., ge=1.0)
    kelly_fraction: float = Field(..., ge=0)
    expected_value: float = Field(..., description="EV en décimal (ex: 0.17 = +17%)")
    recommendation: str = "no_bet"  # "bet_a" | "bet_b" | "no_bet"


class UFCPredictionResponse(BaseModel):
    """Réponse de prédiction pour un combat UFC."""
    fight_id: str
    fighter_a_id: str
    fighter_b_id: str
    fighter_a_name: str
    fighter_b_name: str
    weight_class: WeightClass
    is_title_fight: bool = False
    prob_a: float = Field(..., ge=0, le=1, description="Probabilité calibrée fighter A gagne")
    prob_b: float = Field(..., ge=0, le=1)
    confidence: Optional[float] = Field(None, ge=0, le=1, description="Confiance 0-1")
    key_factors: list[UFCKeyFactor] = Field(default_factory=list)
    value_alert: Optional[ValueAlert] = None
    model_version: str = "pariscore-ufc-v1.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
