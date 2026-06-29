"""
Pipeline de feature engineering Pariscore.

Orchestre le calcul de TOUTES les features validées (Session 3)
à partir d'un DataFrame brut normalisé.

Usage:
    pipeline = FeaturePipeline()
    features = pipeline.run(matches_df)  # → DataFrame avec ~34 features
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.features.ewma import compute_rolling_metric, compute_differential
from src.features.calculators import (
    calc_srv_pts_won,
    calc_ret_pts_won,
    calc_serve_edge,
    calc_clutch_factor,
    calc_h2h_context_score,
    calc_motivation,
    calc_fatigue,
    calc_public,
)

# Graine déterministe pour le shuffle (reproductibilité)
_RNG = np.random.default_rng(42)


class FeaturePipeline:
    """Pipeline complet de feature engineering Sprint 1.

    Valide et gelé en Session 3 (18 Juin 2026).
    ~34 features en sortie.
    """

    def __init__(self, min_matches_per_player: int = 20):
        self.min_matches = min_matches_per_player
        self._player_cache: dict = {}

    def run(self, df: pd.DataFrame) -> pd.DataFrame:
        """Exécute le pipeline complet sur un DataFrame normalisé.

        Args:
            df: DataFrame Sackmann normalisé (une ligne par joueur par match).

        Returns:
            DataFrame avec toutes les features calculées.
        """
        df = df.copy()
        df = df.sort_values(["player_id", "match_date"])

        # ── Étape 1: Filtrer les joueurs avec suffisamment de matchs ──
        player_counts = df["player_id"].value_counts()
        valid_players = player_counts[player_counts >= self.min_matches].index
        df = df[df["player_id"].isin(valid_players)].copy()

        # ── Étape 2: Feature individuelles EWMA ──
        print("[Pipeline] Calcul SRV_PTS_WON...")
        df = calc_srv_pts_won(df)

        print("[Pipeline] Calcul RET_PTS_WON...")
        df = calc_ret_pts_won(df)

        print("[Pipeline] Calcul CLUTCH_FACTOR...")
        df = calc_clutch_factor(df)

        # ── Étape 3: AGE.30 ── (gratuit, colonne calculable si birth_date dispo)
        if "birth_date" in df.columns:
            bd = pd.to_datetime(df["birth_date"], errors="coerce")
            df["age_30"] = (df["match_date"].dt.year - bd.dt.year).abs() - 30
        else:
            df["age_30"] = 0.0  # fallback si pas de date naissance

        # ── Étape 4: Angles morts Sprint 1 ──
        print("[Pipeline] Calcul MOTIVATION...")
        df["motivation"] = calc_motivation(df)

        print("[Pipeline] Calcul FATIGUE...")
        if "tourney_lat" in df.columns and "tourney_lon" in df.columns:
            df["fatigue"] = calc_fatigue(df)
        else:
            df["fatigue"] = 0.0

        # ── Étape 5: Agrégation par match (joueur A + joueur B → matchup) ──
        print("[Pipeline] Construction des matchups...")
        match_features = self._build_match_features(df)

        # ── Étape 6: PUBLIC (après merge, on a les deux joueurs) ──
        print("[Pipeline] Calcul PUBLIC...")
        if all(c in match_features.columns for c in ["player_a_nationality", "player_b_nationality", "tourney_country"]):
            match_features["public_advantage"] = calc_public(
                match_features,
                player_a_nat_col="player_a_nationality",
                player_b_nat_col="player_b_nationality",
            )
        else:
            match_features["public_advantage"] = 0.5

        # ── Étape 7: H2H_CONTEXT_SCORE ──
        print("[Pipeline] Calcul H2H_CONTEXT_SCORE...")
        match_features = calc_h2h_context_score(match_features)

        # ── Étape 7: SERVE_EDGE ──
        print("[Pipeline] Calcul SERVE_EDGE...")
        edge = calc_serve_edge(
            df_srv_a=df[df["is_winner"] == 1].copy(),
            df_srv_b=df[df["is_winner"] == 0].copy(),
            df_ret_a=df[df["is_winner"] == 1].copy(),
            df_ret_b=df[df["is_winner"] == 0].copy(),
        )
        match_features = match_features.merge(edge, on="match_id", how="left")


        # -- Safety: retirer les matchups corrompus (meme joueur A et B) --
        before_safe = len(match_features)
        match_features = match_features[
            match_features["player_a_id"] != match_features["player_b_id"]
        ].copy()
        if len(match_features) < before_safe:
            removed_count = before_safe - len(match_features)
            print(f"[Pipeline] [WARN] Retire {removed_count} matchups corrompus (player_a == player_b)")

        # ── Étape 8: Différentiels ──
        print("[Pipeline] Calcul differentiels A - B...")
        diff_srv = compute_differential(
            df[df["is_winner"] == 1],
            df[df["is_winner"] == 0],
            value_col="srv_pts_won_pct_S",
        )
        diff_ret = compute_differential(
            df[df["is_winner"] == 1],
            df[df["is_winner"] == 0],
            value_col="ret_pts_won_pct_S",
        )
        match_features = match_features.merge(diff_srv, on="match_id", how="left")
        match_features = match_features.merge(diff_ret, on="match_id", how="left")

        print(f"[Pipeline] [OK] Termine - {len(match_features)} matchups, "
              f"{len(match_features.columns)} features")
        return match_features

    def _build_match_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Construit un DataFrame un match par ligne avec features A et B.

        Pour l'entraînement, on randomise l'ordre A/B (50/50)
        et on ajoute une colonne 'target' (1 = A gagne, 0 = B gagne).
        """
        df_a = df[df["is_winner"] == 1].copy()
        df_b = df[df["is_winner"] == 0].copy()

        # Mapping des colonnes joueur
        def _player_cols(prefix: str, suffix: str) -> dict:
            return {
                "match_id": "match_id",
                "player_id": f"player_{prefix}_id",
                "player_name": f"player_{prefix}_name",
                "age_30": f"age_30_{suffix}",
                "motivation": f"motivation_{suffix}",
                "fatigue": f"fatigue_{suffix}",
                "srv_pts_won_pct_S": f"srv_pts_won_S_{suffix}",
                "ret_pts_won_pct_S": f"ret_pts_won_S_{suffix}",
                "clutch_factor": f"clutch_{suffix}",
            }

        # Colonnes additionnelles
        extra = [
            "tourney_id", "tourney_name", "surface", "tourney_date",
            "round", "tourney_country", "tourney_lat", "tourney_lon",
            "player_nationality",
        ]

        # Fusion winner + loser, puis random swap
        all_matchups = []
        for match_id in df_a["match_id"].unique():
            match_a = df_a[df_a["match_id"] == match_id]
            match_b = df_b[df_b["match_id"] == match_id]
            if match_a.empty or match_b.empty:
                continue  # un des deux joueurs filtré par min_matches
            row_w = match_a.iloc[0]
            row_l = match_b.iloc[0]

            # Random swap 50%
            swap = _RNG.random() < 0.5

            if swap:
                a_row, b_row = row_l, row_w
                target = 0  # A = loser
            else:
                a_row, b_row = row_w, row_l
                target = 1  # A = winner

            entry = {"match_id": match_id, "target": target}
            for prefix, row in [("a", a_row), ("b", b_row)]:
                entry[f"player_{prefix}_id"] = row["player_id"]
                entry[f"player_{prefix}_name"] = row["player_name"]
                entry[f"age_30_{prefix.upper()}"] = row["age_30"]
                entry[f"motivation_{prefix.upper()}"] = row["motivation"]
                entry[f"fatigue_{prefix.upper()}"] = row["fatigue"]
                entry[f"srv_pts_won_S_{prefix.upper()}"] = row["srv_pts_won_pct_S"]
                entry[f"ret_pts_won_S_{prefix.upper()}"] = row["ret_pts_won_pct_S"]
                entry[f"clutch_{prefix.upper()}"] = row["clutch_factor"]
                entry[f"player_{prefix}_nationality"] = row.get("player_nationality", "UNK")
                for c in extra:
                    if c in row.index:
                        entry[c] = row[c]

            all_matchups.append(entry)

        result = pd.DataFrame(all_matchups)
        result["winner_id"] = result.apply(
            lambda r: r["player_a_id"] if r["target"] == 1 else r["player_b_id"], axis=1
        )
        return result
