"""
Moteur EWMA (Exponentially Weighted Moving Average) — Cœur du feature engineering.

Validé en Session 1/3:
  - Court terme: α=0.18, fenêtre ~5 matchs (réactivité)
  - Long terme:  α=0.05, fenêtre ~20 matchs (stabilité)
  - Différentiel: court − long → momentum individuel
  - Matchup: diff joueurA − joueurB
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


# ──────────────────────────────────────────────
# Paramètres EWMA validés
# ──────────────────────────────────────────────

@dataclass(frozen=True)
class EwmaParams:
    """Paramètres EWMA pour une métrique donnée."""
    alpha_short: float = 0.18   # court terme — réactivité
    alpha_long: float = 0.05    # long terme — stabilité
    window_short: int = 5       # fenêtre approximative court terme
    window_long: int = 20       # fenêtre approximative long terme


# Paramètres par défaut — utilisés pour TOUTES les métriques roulantes
DEFAULT_EWMA = EwmaParams()


# ──────────────────────────────────────────────
# Calculs EWMA
# ──────────────────────────────────────────────

def ewma_series(values: pd.Series, alpha: float) -> pd.Series:
    """Calcule l'EWMA d'une série temporelle.

    Args:
        values: Série de valeurs (ordonnée du plus ancien au plus récent).
        alpha: Facteur de lissage (0 < alpha <= 1).
               α=0.18 → réactif, α=0.05 → stable.

    Returns:
        Série EWMA de même longueur.
    """
    return values.ewm(alpha=alpha, adjust=False).mean()


def compute_rolling_metric(
    df: pd.DataFrame,
    value_col: str,
    player_col: str = "player_id",
    date_col: str = "match_date",
    alpha_short: float = DEFAULT_EWMA.alpha_short,
    alpha_long: float = DEFAULT_EWMA.alpha_long,
) -> pd.DataFrame:
    """Calcule les métriques EWMA court terme, long terme, et différentiel
    pour un joueur donné sur une série de matchs ordonnée par date.

    Args:
        df: DataFrame contenant les colonnes player_id, match_date, value_col.
        value_col: Nom de la colonne contenant la valeur à lisser.
        player_col: Nom de la colonne identifiant le joueur.
        date_col: Nom de la colonne date.
        alpha_short: Alpha court terme.
        alpha_long: Alpha long terme.

    Returns:
        DataFrame avec colonnes ajoutées:
          - {value_col}_S: EWMA court terme
          - {value_col}_L: EWMA long terme
          - {value_col}_MOM: Différentiel (court − long)
          - {value_col}_RAW: Valeur brute (non lissée)
    """
    df = df.sort_values([player_col, date_col]).copy()
    suffix_S = "_S"
    suffix_L = "_L"
    suffix_MOM = "_MOM"
    suffix_RAW = "_RAW"

    # Initialiser les colonnes
    df[f"{value_col}{suffix_RAW}"] = df[value_col]
    df[f"{value_col}{suffix_S}"] = np.nan
    df[f"{value_col}{suffix_L}"] = np.nan
    df[f"{value_col}{suffix_MOM}"] = np.nan

    for player in df[player_col].unique():
        mask = df[player_col] == player
        player_vals = df.loc[mask, value_col]

        df.loc[mask, f"{value_col}{suffix_S}"] = ewma_series(player_vals, alpha_short).values
        df.loc[mask, f"{value_col}{suffix_L}"] = ewma_series(player_vals, alpha_long).values

    # Différentiel court − long = momentum individuel
    df[f"{value_col}{suffix_MOM}"] = (
        df[f"{value_col}{suffix_S}"] - df[f"{value_col}{suffix_L}"]
    )

    return df


def compute_differential(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    match_id_col: str = "match_id",
    value_col: str = "value",
    suffix: str = "_DIFF",
) -> pd.DataFrame:
    """Calcule le différentiel joueurA − joueurB pour une métrique donnée
    sur un même match.

    Args:
        df_a: Features du joueur A (une ligne par match).
        df_b: Features du joueur B (une ligne par match).
        match_id_col: Colonne de jointure.
        value_col: Colonne contenant la feature à différentier.
        suffix: Suffixe pour la colonne résultat.

    Returns:
        DataFrame avec le différentiel A − B par match.
    """
    merged = df_a[[match_id_col, value_col]].merge(
        df_b[[match_id_col, value_col]],
        on=match_id_col,
        suffixes=("_A", "_B"),
    )
    diff = pd.DataFrame()
    diff[match_id_col] = merged[match_id_col]
    diff[f"{value_col}{suffix}"] = merged[f"{value_col}_A"] - merged[f"{value_col}_B"]
    return diff


def compute_winning_derivative(
    df: pd.DataFrame,
    win_col: str = "is_winner",
    player_col: str = "player_id",
    date_col: str = "match_date",
    window: int = 10,
) -> pd.Series:
    """Calcule la dérivée du taux de victoire sur fenêtre glissante.

    ⚠️ GARDE-FOU: Lag = 1 match — le match courant n'est jamais inclus.
    Validé Session 3 — Parieur gardien.

    Args:
        df: DataFrame des matchs du joueur, ordonné par date.
        win_col: Colonne booléenne (1 = gagné, 0 = perdu).
        player_col: Colonne identifiant le joueur.
        date_col: Colonne date.
        window: Fenêtre fixe de N matchs (validé: 10).

    Returns:
        Série: dérivée = (win_rate_window_n − win_rate_window_n-1)
    """
    df = df.sort_values([player_col, date_col]).copy()
    result = pd.Series(index=df.index, dtype=float)

    for player in df[player_col].unique():
        mask = df[player_col] == player
        idx = df.index[mask]

        for i, row_idx in enumerate(idx):
            if i < window + 1:
                # Pas assez de données
                result[row_idx] = 0.0
                continue

            # Lag = 1: on prend la fenêtre AVANT le match courant
            prev_window = df.loc[idx[i - window - 1]: idx[i - 1], win_col]
            curr_window = df.loc[idx[i - window]: idx[i - 1], win_col]

            win_rate_prev = prev_window.mean()
            win_rate_curr = curr_window.mean()

            result[row_idx] = win_rate_curr - win_rate_prev

    return result
