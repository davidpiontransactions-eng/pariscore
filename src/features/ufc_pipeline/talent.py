"""
True Talent Estimator — Estimation bayésienne MAP du niveau d'un combattant UFC.

Méthode:
  Prior : gaussien N(0, σ²=1.5)
  Likelihood : modèle de Bradley-Terry (logistique) sur le résultat du combat :
      P(A gagne | skill_A, skill_B) = inv_logit(skill_A - skill_B)
  Estimation MAP : scipy.optimize.minimize_scalar sur la log-posterior

Le rating True Talent permet de comparer des combattants de différentes époques
et sert de feature #1 dans le modèle de prédiction.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Optional

try:
    from scipy.optimize import minimize_scalar
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


@dataclass(frozen=True)
class TrueTalentParams:
    """Paramètres du True Talent estimator."""
    prior_sigma: float = 1.5     # Écart-type du prior gaussien
    min_fights: int = 3          # Minimum de combats pour estimer
    initial_guess: float = 0.0   # Valeur initiale pour l'optimisation


DEFAULT_TT_PARAMS = TrueTalentParams()


def _log_prior(skill: float, sigma: float = 1.5) -> float:
    """Log prior gaussien N(0, sigma)."""
    return -0.5 * (skill / sigma) ** 2


def _log_likelihood(
    skill_a: float,
    skill_b: float,
    a_won: bool,
) -> float:
    """Log vraisemblance : P(resultat | skill_A, skill_B).

    Utilise la fonction logistique : P(A gagne) = 1 / (1 + exp(-(skill_A - skill_B)))
    """
    diff = skill_a - skill_b
    if a_won:
        # log( inv_logit(diff) )
        return -np.log(1.0 + np.exp(-diff))
    else:
        # log( 1 - inv_logit(diff) ) = log( inv_logit(-diff) )
        return -np.log(1.0 + np.exp(diff))


def estimate_true_talent_map(
    fighter_id: str,
    df_fights: pd.DataFrame,
    params: TrueTalentParams = DEFAULT_TT_PARAMS,
) -> float:
    """Estime le True Talent rating MAP d'un combattant.

    Args:
        fighter_id: ID du combattant.
        df_fights: DataFrame des combats du combattant (format long).
                   Doit contenir : opponent_id, is_winner.
        params: Paramètres du prior.

    Returns:
        Rating True Talent MAP estimé.
        Retourne 0.0 si pas assez de combats ou scipy indisponible.
    """
    if not HAS_SCIPY or len(df_fights) < params.min_fights:
        return 0.0

    # Extraire les paires (opponent_skill, result)
    fights_data = []
    for _, fight in df_fights.iterrows():
        opp_id = fight.get("opponent_id")
        is_winner = fight.get("is_winner", 0)
        fights_data.append((opp_id, bool(is_winner)))

    def _neg_log_posterior(skill: float) -> float:
        """Log posterior négatif à minimiser."""
        lp = _log_prior(skill, params.prior_sigma)
        for opp_skill, a_won in fights_data:
            # Si l'adversaire a un rating connu, on l'utilise
            # Sinon on suppose skill_adversaire = 0 (joueur moyen)
            opp_rating = opponent_skills.get(opp_id, 0.0)
            lp += _log_likelihood(skill, opp_rating, a_won)
        return -lp  # minimiseur → négatif

    # Dictionnaire partagé des ratings adverses (sera rempli itérativement)
    opponent_skills: dict[str, float] = {}

    # Optimisation MAP
    result = minimize_scalar(
        _neg_log_posterior,
        bounds=(-5.0, 5.0),
        method="bounded",
        options={"xatol": 1e-6},
    )

    return float(result.x) if result.success else 0.0


def compute_true_talent_batch(
    df: pd.DataFrame,
    fighter_col: str = "fighter_id",
    opponent_col: str = "opponent_id",
    win_col: str = "is_winner",
    params: TrueTalentParams = DEFAULT_TT_PARAMS,
    max_iterations: int = 3,
) -> pd.DataFrame:
    """Calcule les True Talent ratings pour tous les combattants.

    Utilise un algorithme itératif : on estime le rating de chaque combattant
    en utilisant les ratings des adversaires de l'itération précédente.
    Convergence typique en 3 itérations.

    Args:
        df: DataFrame des combats (format long).
        fighter_col: Colonne identifiant le combattant.
        opponent_col: Colonne identifiant l'adversaire.
        win_col: Colonne victoire (1 = gagné).
        params: Paramètres TrueTalent.
        max_iterations: Nombre d'itérations pour la convergence.

    Returns:
        DataFrame avec colonnes ajoutées :
          - true_talent_rating : rating MAP final
          - opponent_strength  : SOS (moyenne des ratings adverses rencontrés)
    """
    if not HAS_SCIPY:
        df = df.copy()
        df["true_talent_rating"] = 0.0
        df["opponent_strength"] = 0.0
        return df

    df = df.sort_values([fighter_col, "fight_date"] if "fight_date" in df.columns else [fighter_col]).copy()

    # Initialisation : tous les ratings à 0
    ratings: dict[str, float] = {f: 0.0 for f in df[fighter_col].unique()}

    for iteration in range(max_iterations):
        new_ratings: dict[str, float] = {}
        for fighter in ratings:
            f_mask = df[fighter_col] == fighter
            f_fights = df[f_mask].copy()
            f_fights["opponent_rating"] = f_fights[opponent_col].map(ratings).fillna(0.0)

            if len(f_fights) < params.min_fights:
                new_ratings[fighter] = 0.0
                continue

            def _neg_log_posterior_iter(skill: float) -> float:
                lp = _log_prior(skill, params.prior_sigma)
                for _, row in f_fights.iterrows():
                    opp_rating = row["opponent_rating"]
                    lp += _log_likelihood(skill, opp_rating, bool(row[win_col]))
                return -lp

            result = minimize_scalar(
                _neg_log_posterior_iter,
                bounds=(-5.0, 5.0),
                method="bounded",
                options={"xatol": 1e-6},
            )
            new_ratings[fighter] = float(result.x) if result.success else 0.0

        ratings = new_ratings

    # Ajouter les ratings au DataFrame
    df["true_talent_rating"] = df[fighter_col].map(ratings).fillna(0.0)

    # Opponent strength = moyenne des ratings des adversaires rencontrés
    df["opponent_strength"] = df[opponent_col].map(ratings).fillna(0.0)

    return df


def compute_true_talent_differential(
    df_wide: pd.DataFrame,
    talent_col: str = "true_talent_rating",
) -> pd.DataFrame:
    """Calcule le différentiel True Talent A − B pour un matchup.

    Args:
        df_wide: DataFrame wide avec _A / _B.
        talent_col: Nom de la colonne rating.

    Returns:
        DataFrame avec colonne true_talent_diff ajoutée.
    """
    df = df_wide.copy()
    col_a = f"{talent_col}_A" if f"{talent_col}_A" in df.columns else f"{talent_col}_a"
    col_b = f"{talent_col}_B" if f"{talent_col}_B" in df.columns else f"{talent_col}_b"

    # Chercher les colonnes avec différents patterns
    candidates_a = [c for c in df.columns if talent_col in c and c.endswith(("_A", "_a"))]
    candidates_b = [c for c in df.columns if talent_col in c and c.endswith(("_B", "_b"))]

    if candidates_a and candidates_b:
        df["true_talent_diff"] = df[candidates_a[0]] - df[candidates_b[0]]
    else:
        df["true_talent_diff"] = 0.0

    return df
