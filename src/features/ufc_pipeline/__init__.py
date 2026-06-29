"""
UFCPipeline — Pipeline de feature engineering UFC/MMA.

Orchestre les 4 modules du package :
  - ewma.py       : calcul EWMA multi-fenêtres S/M/L
  - talent.py     : estimation True Talent bayésienne MAP
  - context.py    : features contextuelles (reach, age, streak, etc.)
  - validator.py  : validation point-in-time

Entrée  : DataFrame format long (une ligne par combattant par combat)
Sortie  : dict compatible UFCFightFeatures → endpoint POST /predict/pre-match/mma
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

from src.features.ufc_pipeline.ewma import (
    compute_mma_metrics_batch,
    compute_ewma_differential,
    DEFAULT_UFC_EWMA,
    UfcEwmaParams,
    UFC_METRICS,
)
from src.features.ufc_pipeline.talent import (
    compute_true_talent_batch,
    DEFAULT_TT_PARAMS,
    TrueTalentParams,
)
from src.features.ufc_pipeline.context import (
    ContextCalculator,
    compute_streak_batch,
    compute_days_since_last_batch,
)
from src.features.ufc_pipeline.validator import PointInTimeValidator

logger = logging.getLogger("pariscore.ufc_pipeline")


class UFCPipeline:
    """Pipeline de feature engineering UFC/MMA.

    Usage:
        pipeline = UFCPipeline()
        features = pipeline.run(fights_df, fighters_meta)
        # features est une liste de dicts compatibles UFCFightFeatures
    """

    def __init__(
        self,
        ewma_params: UfcEwmaParams = DEFAULT_UFC_EWMA,
        talent_params: TrueTalentParams = DEFAULT_TT_PARAMS,
        min_fights_per_fighter: int = 1,
        verbose: bool = False,
    ):
        self.ewma_params = ewma_params
        self.talent_params = talent_params
        self.min_fights = min_fights_per_fighter
        self.verbose = verbose
        self.validator = PointInTimeValidator(verbose=verbose)
        self.context_calc = ContextCalculator()

    def run(
        self,
        df_fights: pd.DataFrame,
        fighters_meta: Optional[dict[str, dict]] = None,
        weight_class_dfs: Optional[dict[str, pd.DataFrame]] = None,
    ) -> list[dict]:
        """Exécute le pipeline complet.

        Args:
            df_fights: DataFrame des combats en format long
                       (une ligne par combattant par combat).
                       Colonnes requises :
                         - fight_id, match_id
                         - fighter_id, opponent_id
                         - fight_date
                         - is_winner, is_fighter_a (1 = A, 0 = B)
                         - Métriques UFC (sig_str_*, td_*, sub_*, etc.)
                       Optionnelles :
                         - is_ko, is_submission
            fighters_meta: Dict fighter_id -> {reach_cm, age_years, stance, ...}
            weight_class_dfs: Dict weight_class -> DataFrame des combats
                              de cette catégorie (pour avg_finish_rate).

        Returns:
            Liste de dicts compatibles UFCFightFeatures (un par combat).
        """
        df = df_fights.copy()
        log = logger.info if self.verbose else lambda _: None

        # ── Étape 0 : Validation des colonnes ──
        required_cols = ["fight_id", "fighter_id", "opponent_id", "fight_date",
                         "is_winner", "is_fighter_a"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Colonnes requises manquantes : {missing}")

        log("[UFCPipeline] Tri par (fighter_id, fight_date)...")
        df = df.sort_values(["fighter_id", "fight_date"]).copy()

        # ---- Filtre : minimum de combats par combattant ----
        if self.min_fights > 1:
            fighter_counts = df["fighter_id"].value_counts()
            valid_fighters = fighter_counts[fighter_counts >= self.min_fights].index
            n_removed = df.shape[0] - df[df["fighter_id"].isin(valid_fighters)].shape[0]
            df = df[df["fighter_id"].isin(valid_fighters)].copy()
            if n_removed:
                log(f"[UFCPipeline] {n_removed} lignes supprimees")
            if df.empty:
                log("[UFCPipeline] Aucun combattant ne satisfait le minimum")
                return []



        # ── Étape 1 : EWMA multi-fenêtres ──
        log("[UFCPipeline] Calcul EWMA multi-fenêtres S/M/L...")
        df = compute_mma_metrics_batch(
            df,
            metrics=UFC_METRICS,
            fighter_col="fighter_id",
            date_col="fight_date",
            params=self.ewma_params,
        )

        # ── Étape 2 : True Talent Rating ──
        log("[UFCPipeline] Calcul True Talent bayésien MAP...")
        df = compute_true_talent_batch(
            df,
            fighter_col="fighter_id",
            opponent_col="opponent_id",
            win_col="is_winner",
            params=self.talent_params,
        )

        # ── Étape 3 : Streak et jours de repos (point-in-time) ──
        log("[UFCPipeline] Calcul streaks point-in-time...")
        df["streak"] = compute_streak_batch(df)
        df["days_since_last"] = compute_days_since_last_batch(df)

        # ── Étape 4 : Validation point-in-time ──
        log("[UFCPipeline] Validation point-in-time...")
        validation_results = self.validator.run_all(df)
        if not all(r.passed for r in validation_results.values()):
            logger.warning(
                f"Validation PIT : {sum(1 for r in validation_results.values() if not r.passed)} "
                f"tests echoues"
            )

        # ── Étape 5 : Reconstruction format wide (A vs B) ──
        log("[UFCPipeline] Construction des matchups A vs B...")
        matchups = self._build_matchups(df, fighters_meta, weight_class_dfs)

        log(f"[UFCPipeline] [OK] {len(matchups)} matchups générés")
        return matchups

    def _build_matchups(
        self,
        df: pd.DataFrame,
        fighters_meta: Optional[dict[str, dict]] = None,
        weight_class_dfs: Optional[dict[str, pd.DataFrame]] = None,
    ) -> list[dict]:
        """Reconstruit les matchups A vs B à partir du format long.

        Pour chaque fight_id unique, fusionne les features du fighter A
        et du fighter B en un seul dict compatible UFCFightFeatures.
        """
        fighters_meta = fighters_meta or {}
        weight_class_dfs = weight_class_dfs or {}

        matchups = []

        # Lister toutes les colonnes EWMA disponibles
        ewma_cols = [c for c in df.columns
                     if any(c.endswith(s) for s in ("_S", "_M", "_L", "_RAW"))]

        for fight_id in df["fight_id"].unique():
            fight_df = df[df["fight_id"] == fight_id]
            if len(fight_df) < 2:
                logger.warning(f"Fight {fight_id} : {len(fight_df)} lignes (attendu 2)")
                continue

            row_a = fight_df[fight_df["is_fighter_a"] == 1]
            row_b = fight_df[fight_df["is_fighter_a"] == 0]

            if row_a.empty or row_b.empty:
                # Fallback : prendre les 2 premières lignes
                rows = fight_df.iloc[:2]
                row_a = rows.iloc[[0]]
                row_b = rows.iloc[[1]]

            a = row_a.iloc[0]
            b = row_b.iloc[0]

            fighter_a_id = str(a["fighter_id"])
            fighter_b_id = str(b["fighter_id"])
            meta_a = fighters_meta.get(fighter_a_id, {})
            meta_b = fighters_meta.get(fighter_b_id, {})

            # Features contextuelles
            wc = str(meta_a.get("weight_class", meta_b.get("weight_class", "lightweight")))
            wc_df = weight_class_dfs.get(wc)

            context = self.context_calc.compute_all(
                row_a, row_b, meta_a, meta_b, wc_df,
            )

            # Construction du dict de features
            fight_dict = {
                "fight_id": fight_id,
                "fighter_a_id": fighter_a_id,
                "fighter_b_id": fighter_b_id,
                "fighter_a_name": meta_a.get("fighter_name", fighter_a_id),
                "fighter_b_name": meta_b.get("fighter_name", fighter_b_id),
                "weight_class": wc,
                "is_title_fight": bool(a.get("is_title_fight", b.get("is_title_fight", False))),
                "rounds": int(a.get("rounds", b.get("rounds", 3))),

                # True Talent
                "true_talent_a": float(a.get("true_talent_rating", 0.0)),
                "true_talent_b": float(b.get("true_talent_rating", 0.0)),
                "opponent_strength_a": float(a.get("opponent_strength", 0.0)),
                "opponent_strength_b": float(b.get("opponent_strength", 0.0)),

                # EWMA différentiels
                "ewma_strike_diff_S": self._safe_diff(a, b, "sig_str_landed_pct_S"),
                "ewma_td_diff_S": self._safe_diff(a, b, "td_avg_per_15_S"),
                "ewma_defense_diff_S": self._safe_diff(
                    a, b, "sig_str_defense_S", invert_b=True,
                ),

                # Contexte
                "reach_advantage_a": context.get("reach_advantage_a", 0.0),
                "age_difference_a": context.get("age_difference_a", 0.0),
                "days_since_last_a": int(context.get("days_since_last_a", 0)),
                "days_since_last_b": int(context.get("days_since_last_b", 0)),
                "is_short_notice_a": context.get("is_short_notice_a", False),
                "is_short_notice_b": context.get("is_short_notice_b", False),
                "stance_advantage": context.get("stance_advantage", 0.0),
                "weight_class_avg_finish_rate": context.get(
                    "weight_class_avg_finish_rate", 0.5,
                ),

                # Streak
                "fighter_a_streak": int(a.get("streak", 0)),
                "fighter_b_streak": int(b.get("streak", 0)),

                # Angles morts
                "camp_changed_a": context.get("camp_changed_a", False),
                "camp_changed_b": context.get("camp_changed_b", False),
                "weight_cut_concern_a": context.get("weight_cut_concern_a", False),
                "weight_cut_concern_b": context.get("weight_cut_concern_b", False),
                "same_opponent_rematch": a.get("is_rematch", b.get("is_rematch", False)),

                # Cotes (si disponibles dans les données)
                "opening_odds_implied_prob_a": float(
                    a.get("opening_odds_implied_prob", b.get("opening_odds_implied_prob", 0.5))
                ),
                "opening_odds_implied_prob_b": float(
                    b.get("opening_odds_implied_prob", a.get("opening_odds_implied_prob", 0.5))
                ),
            }

            matchups.append(fight_dict)

        return matchups

    @staticmethod
    def _safe_diff(
        row_a: pd.Series,
        row_b: pd.Series,
        col: str,
        invert_b: bool = False,
    ) -> float:
        """Différentiel A − B sécurisé (NaN → 0)."""
        val_a = row_a.get(col, np.nan)
        val_b = row_b.get(col, np.nan)

        if pd.isna(val_a) or pd.isna(val_b):
            return 0.0

        diff = float(val_a) - float(val_b)
        return -diff if invert_b else diff
