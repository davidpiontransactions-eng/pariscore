"""
Context Calculator UFC — calcul des features contextuelles pré-combat.

Produit les features non-EWMA nécessaires à la prédiction :
  - Reach advantage
  - Age difference
  - Stance advantage (southpaw vs orthodox)
  - Days since last fight / short notice
  - Win/loss streak
  - Finish rate (KO + SUB rate carrière)
  - weight_class_avg_finish_rate
  - Camp change / weight cut concerns (à partir de métadonnées)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional


# ── Reach & Anthropometry ──


def compute_reach_advantage(
    reach_a_cm: Optional[float],
    reach_b_cm: Optional[float],
) -> float:
    """Calcule l'avantage de reach du fighter A.

    Args:
        reach_a_cm: Envergure fighter A en cm (None si inconnu).
        reach_b_cm: Envergure fighter B en cm (None si inconnu).

    Returns:
        Différence A − B en cm (0.0 si une des deux est inconnue).
    """
    if reach_a_cm is None or reach_b_cm is None:
        return 0.0
    return float(reach_a_cm - reach_b_cm)


def compute_age_difference(
    age_a_years: Optional[float],
    age_b_years: Optional[float],
) -> float:
    """Calcule la différence d'âge (A − B). Négatif = A plus jeune = avantage.

    Args:
        age_a_years: Âge du fighter A en années.
        age_b_years: Âge du fighter B en années.

    Returns:
        Différence A − B en années (0.0 si une des deux est inconnue).
    """
    if age_a_years is None or age_b_years is None:
        return 0.0
    return float(age_a_years - age_b_years)


def compute_stance_advantage(
    stance_a: str = "orthodox",
    stance_b: str = "orthodox",
) -> float:
    """Calcule l'avantage de stance.

    Southpaw vs Orthodox donne un avantage temporaire au southpaw
    (les combattants ont moins d expérience contre les southpaws).
    Switch stance = neutre.

    Returns:
        0.15 si A southpaw et B orthodox,
        -0.15 si B southpaw et A orthodox,
        0.0 sinon.
    """
    a = stance_a.lower().strip()
    b = stance_b.lower().strip()

    if a == "southpaw" and b == "orthodox":
        return 0.15
    elif a == "orthodox" and b == "southpaw":
        return -0.15
    else:
        return 0.0


# ── Rest & Recuperation ──


def compute_days_since_last_fight(
    fight_dates: pd.Series,
    fighter_id: pd.Series,
    current_idx: int,
) -> int:
    """Calcule le nombre de jours depuis le dernier combat du combattant.

    Args:
        fight_dates: Série des dates de combats.
        fighter_id: Série des IDs combattants.
        current_idx: Index du combat courant.

    Returns:
        Nombre de jours (0 si pas de combat précédent).
    """
    if current_idx == 0:
        return 0

    # Trouver le dernier combat du même combattant
    current_fighter = fighter_id.iloc[current_idx]
    current_date = fight_dates.iloc[current_idx]

    # Parcourir les combats précédents du même combattant
    for i in range(current_idx - 1, -1, -1):
        if fighter_id.iloc[i] == current_fighter:
            last_date = fight_dates.iloc[i]
            delta = (current_date - last_date).days
            return max(0, delta)

    return 0


def compute_days_since_last_batch(
    df: pd.DataFrame,
    fighter_col: str = "fighter_id",
    date_col: str = "fight_date",
) -> pd.Series:
    """Calcule les jours depuis le dernier combat pour chaque ligne.

    Args:
        df: DataFrame trié par (fighter_col, date_col).
        fighter_col: Colonne identifiant combattant.
        date_col: Colonne date.

    Returns:
        Série du nombre de jours depuis le dernier combat (0 si premier).
    """
    df = df.sort_values([fighter_col, date_col]).copy()
    days = df.groupby(fighter_col)[date_col].diff().dt.days.fillna(0).astype(int)
    return days


def compute_is_short_notice(
    days_since_last: int,
    threshold_days: int = 14,
) -> bool:
    """Détermine si un combattant combat en short notice.

    Args:
        days_since_last: Jours depuis le dernier combat.
        threshold_days: Seuil pour short notice (défaut: 14 jours).

    Returns:
        True si short notice.
    """
    return 0 < days_since_last < threshold_days


# ── Streak ──


def compute_win_streak(
    df_fighter: pd.DataFrame,
    win_col: str = "is_winner",
) -> int:
    """Calcule la streak actuelle (positive = victoires, négative = défaites).

    Regarde le dernier combat uniquement, et compte la série
    de résultats identiques consécutifs.

    Args:
        df_fighter: DataFrame des combats d un seul combattant,
                    trié par date.
        win_col: Colonne booléenne (1 = gagné, 0 = perdu).

    Returns:
        Streak : +3 = 3 victoires consécutives, -2 = 2 défaites consécutives.
    """
    if df_fighter.empty:
        return 0

    last_result = df_fighter[win_col].iloc[-1]
    streak = 0

    for result in df_fighter[win_col]:
        if result == last_result:
            streak += 1 if last_result else -1
        else:
            break

    return streak


def compute_streak_batch(
    df: pd.DataFrame,
    fighter_col: str = "fighter_id",
    win_col: str = "is_winner",
    date_col: str = "fight_date",
) -> pd.Series:
    """Calcule la streak avant chaque combat (point-in-time).

    Pour chaque combat, la streak est calculée sur les combats
    AVANT ce combat uniquement.

    Args:
        df: DataFrame long trié par (fighter_col, date_col).
        fighter_col: Colonne combattant.
        win_col: Colonne victoire.
        date_col: Colonne date.

    Returns:
        Série des streaks (point-in-time).
    """
    df = df.sort_values([fighter_col, date_col]).copy()
    result = pd.Series(index=df.index, dtype=int)

    for fighter in df[fighter_col].unique():
        mask = df[fighter_col] == fighter
        idx = df.index[mask]
        fighter_df = df.loc[idx]

        for i, row_idx in enumerate(idx):
            if i == 0:
                result[row_idx] = 0  # Premier combat : pas de streak
                continue

            # Combats avant celui-ci
            past_fights = fighter_df.iloc[:i]
            streak = 0
            if not past_fights.empty:
                last_result = past_fights[win_col].iloc[-1]
                for _, row in past_fights.iterrows():
                    if row[win_col] == last_result:
                        streak += 1 if last_result else -1
                    else:
                        break

            result[row_idx] = streak

    return result


# ── Finish Rate ──


def compute_finish_rate(
    df_fighter: pd.DataFrame,
    ko_col: str = "is_ko",
    sub_col: str = "is_submission",
    win_col: str = "is_winner",
) -> tuple[float, float, float]:
    """Calcule les taux de finish, KO et SUB pour un combattant.

    Args:
        df_fighter: DataFrame des combats d un combattant.
        ko_col: Colonne booléenne KO/TKO.
        sub_col: Colonne booléenne soumission.
        win_col: Colonne booléenne victoire.

    Returns:
        Tuple (finish_rate, ko_rate, sub_rate) sur la carrière.
    """
    total_wins = df_fighter[win_col].sum()
    if total_wins == 0:
        return 0.0, 0.0, 0.0

    kos = df_fighter[ko_col].sum()
    subs = df_fighter[sub_col].sum()
    finishes = kos + subs

    return (
        float(finishes / total_wins),
        float(kos / total_wins),
        float(subs / total_wins),
    )


def compute_weight_class_avg_finish_rate(
    df_weight_class: pd.DataFrame,
    ko_col: str = "is_ko",
    sub_col: str = "is_submission",
) -> float:
    """Calcule le taux de finish moyen d une catégorie de poids.

    Les catégories lourdes (HW, LHW) ont plus de KO.
    Les catégories légères (SW, FW) ont plus de submissions.

    Args:
        df_weight_class: DataFrame de tous les combats dans la catégorie.
        ko_col: Colonne booléenne KO/TKO.
        sub_col: Colonne booléenne soumission.

    Returns:
        Taux de finish moyen (0.0 si pas de combats).
    """
    if df_weight_class.empty:
        return 0.0
    finishes = (df_weight_class[ko_col] | df_weight_class[sub_col]).sum()
    return float(finishes / len(df_weight_class))


# ── Aggrégateur de contexte ──

class ContextCalculator:
    """Calcule toutes les features contextuelles pour un matchup UFC.

    Utilisation :
        cc = ContextCalculator()
        context = cc.compute_all(df_fighter_a, df_fighter_b, metadata)
    """

    def __init__(self):
        self._cache: dict = {}

    def compute_all(
        self,
        fights_a: pd.DataFrame,
        fights_b: pd.DataFrame,
        meta_a: dict,
        meta_b: dict,
        weight_class_df: Optional[pd.DataFrame] = None,
    ) -> dict:
        """Calcule toutes les features contextuelles pour un matchup.

        Args:
            fights_a: Historique des combats du fighter A (format long).
            fights_b: Historique des combats du fighter B.
            meta_a: Métadonnées fighter A (reach, age, stance, ...).
            meta_b: Métadonnées fighter B.
            weight_class_df: DataFrame de tous les combats de la catégorie.

        Returns:
            Dictionnaire des features contextuelles.
        """
        context = {}

        # Anthropométrie
        context["reach_advantage_a"] = compute_reach_advantage(
            meta_a.get("reach_cm"), meta_b.get("reach_cm"),
        )
        context["age_difference_a"] = compute_age_difference(
            meta_a.get("age_years"), meta_b.get("age_years"),
        )
        context["stance_advantage"] = compute_stance_advantage(
            meta_a.get("stance", "orthodox"),
            meta_b.get("stance", "orthodox"),
        )

        # Repos
        days_a = compute_days_since_last_fight(
            fights_a["fight_date"], fights_a["fighter_id"],
            len(fights_a) - 1,
        )
        days_b = compute_days_since_last_fight(
            fights_b["fight_date"], fights_b["fighter_id"],
            len(fights_b) - 1,
        )
        context["days_since_last_a"] = days_a
        context["days_since_last_b"] = days_b
        context["is_short_notice_a"] = compute_is_short_notice(days_a)
        context["is_short_notice_b"] = compute_is_short_notice(days_b)

        # Streak
        context["fighter_a_streak"] = compute_win_streak(fights_a)
        context["fighter_b_streak"] = compute_win_streak(fights_b)

        # Finish rates
        finish_rate_a, ko_rate_a, sub_rate_a = compute_finish_rate(fights_a)
        finish_rate_b, ko_rate_b, sub_rate_b = compute_finish_rate(fights_b)
        context["ko_rate_career_a"] = ko_rate_a
        context["ko_rate_career_b"] = ko_rate_b
        context["sub_rate_career_a"] = sub_rate_a
        context["sub_rate_career_b"] = sub_rate_b
        context["finish_rate_a"] = finish_rate_a
        context["finish_rate_b"] = finish_rate_b

        # Weight class avg finish rate
        if weight_class_df is not None:
            context["weight_class_avg_finish_rate"] = (
                compute_weight_class_avg_finish_rate(weight_class_df)
            )
        else:
            context["weight_class_avg_finish_rate"] = 0.5

        # Drapeaux (à remplir par métadonnées supplémentaires)
        context["camp_changed_a"] = meta_a.get("camp_changed", False)
        context["camp_changed_b"] = meta_b.get("camp_changed", False)
        context["weight_cut_concern_a"] = meta_a.get("weight_cut_concern", False)
        context["weight_cut_concern_b"] = meta_b.get("weight_cut_concern", False)

        return context
