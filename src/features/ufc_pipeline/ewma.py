"""
Module EWMA UFC — calcul multi-fenêtres S/M/L pour les métriques MMA.
Chaque combattant UFC fait ~15-30 combats (vs 200-300 pour le tennis),
donc les alphas sont calibrés plus haut :

  S (court terme,  α=0.30) : ~3 derniers combats
  M (moyen terme,  α=0.15) : ~6 derniers combats
  L (long terme,   α=0.05) : toute la carrière

Strictement point-in-time : pour le combat i, l'EWMA est calculée
sur les combats 0..i-1 uniquement.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


# ── Paramètres EWMA UFC validés ──


@dataclass(frozen=True)
class UfcEwmaParams:
    """Paramètres EWMA pour les métriques UFC."""
    alpha_S: float = 0.30   # court terme  — ~3 combats
    alpha_M: float = 0.15   # moyen terme  — ~6 combats
    alpha_L: float = 0.05   # long terme   — ~carrière
    min_fights: int = 1     # minimum de combats pour calculer


DEFAULT_UFC_EWMA = UfcEwmaParams()

# Colonnes métriques UFC typiques
UFC_METRICS = [
    "sig_str_landed_per_min",
    "sig_str_absorbed_per_min",
    "sig_str_accuracy",
    "sig_str_defense",
    "td_avg_per_15",
    "td_accuracy",
    "td_defense",
    "sub_attempts_per_15",
    "ctrl_time_per_15_sec",
    "knockdowns_per_15",
    "sig_str_landed_pct",
]


# ── Fonctions EWMA ──


def _ewma_series_point_in_time(
    values: pd.Series,
    fighter_id: pd.Series,
    alpha: float,
) -> pd.Series:
    """Calcule l'EWMA point-in-time : pour la i-ème valeur,
    l'EWMA utilise les valeurs 0..i-1 uniquement.

    Méthode : on décale la série d'1 rang, on calcule l'EWMA,
    puis on replace le premier élément à NaN.

    Args:
        values: Série des valeurs brutes (ordonnée).
        fighter_id: Série des IDs combattants (pour groupby).
        alpha: Facteur de lissage.

    Returns:
        Série EWMA point-in-time (NaN pour le premier combat).
    """
    # Shift de 1 pour exclure le combat courant
    shifted = values.groupby(fighter_id).shift(1)

    # EWMA sur les valeurs décalées
    ewma = shifted.ewm(alpha=alpha, adjust=False).mean()

    # Le premier combat de chaque combattant doit être NaN
    first_fight = (
        shifted.groupby(fighter_id).cumcount() == 0
    ) & shifted.isna()
    ewma[first_fight] = np.nan

    return ewma


def compute_mma_rolling_metric(
    df: pd.DataFrame,
    value_col: str,
    fighter_col: str = "fighter_id",
    date_col: str = "fight_date",
    params: UfcEwmaParams = DEFAULT_UFC_EWMA,
) -> pd.DataFrame:
    """Calcule les 3 fenêtres EWMA (S/M/L) + RAW pour une métrique UFC.

    Args:
        df: DataFrame trié par (fighter_col, date_col).
        value_col: Nom de la colonne à lisser.
        fighter_col: Identifiant combattant.
        date_col: Colonne date.
        params: Paramètres EWMA.

    Returns:
        DataFrame avec colonnes ajoutées :
          - {value_col}_RAW
          - {value_col}_S  (court terme)
          - {value_col}_M  (moyen terme)
          - {value_col}_L  (long terme)
    """
    df = df.sort_values([fighter_col, date_col]).copy()

    suffix_S = "_S"
    suffix_M = "_M"
    suffix_L = "_L"
    suffix_RAW = "_RAW"

    # Colonnes brutes
    df[f"{value_col}{suffix_RAW}"] = df[value_col]

    # EWMA point-in-time
    df[f"{value_col}{suffix_S}"] = _ewma_series_point_in_time(
        df[value_col], df[fighter_col], params.alpha_S,
    )
    df[f"{value_col}{suffix_M}"] = _ewma_series_point_in_time(
        df[value_col], df[fighter_col], params.alpha_M,
    )
    df[f"{value_col}{suffix_L}"] = _ewma_series_point_in_time(
        df[value_col], df[fighter_col], params.alpha_L,
    )

    return df


def compute_mma_metrics_batch(
    df: pd.DataFrame,
    metrics: list[str] = UFC_METRICS,
    fighter_col: str = "fighter_id",
    date_col: str = "fight_date",
    params: UfcEwmaParams = DEFAULT_UFC_EWMA,
) -> pd.DataFrame:
    """Calcule les EWMA pour toutes les métriques UFC en batch.

    Args:
        df: DataFrame long (une ligne par combattant par combat).
        metrics: Liste des colonnes métriques à traiter.
        fighter_col: Identifiant combattant.
        date_col: Colonne date.
        params: Paramètres EWMA.

    Returns:
            DataFrame avec toutes les colonnes EWMA ajoutées.
    """
    df = df.sort_values([fighter_col, date_col]).copy()

    for metric in metrics:
        if metric not in df.columns:
            continue
        df = compute_mma_rolling_metric(
            df, value_col=metric,
            fighter_col=fighter_col,
            date_col=date_col,
            params=params,
        )

    return df


def compute_ewma_differential(
    df_long: pd.DataFrame,
    value_col: str,
    window: str = "S",
    match_id_col: str = "match_id",
    suffix: str = "_DIFF",
) -> pd.DataFrame:
    """Calcule le différentiel A − B pour une métrique EWMA.

    Args:
        df_long: DataFrame au format long avec les colonnes
                 match_id, fighter_id, {value_col}_{window}.
        value_col: Nom de base de la métrique (sans suffixe).
        window: Fenêtre EWMA ("S", "M", "L").
        match_id_col: Colonne de jointure.
        suffix: Suffixe pour la colonne résultat.

    Returns:
        DataFrame avec le différentiel par match.
    """
    ewma_col = f"{value_col}_{window}"

    # Format wide : A et B côte à côte
    if "is_fighter_a" not in df_long.columns:
        # On suppose que les 2 premières lignes par match_id sont A puis B
        df_wide = df_long.pivot(
            index=match_id_col,
            columns="fighter_side",
            values=ewma_col,
        ).reset_index()
        val_a = df_wide.get("A", df_wide.get(df_wide.columns[1]))
        val_b = df_wide.get("B", df_wide.get(df_wide.columns[2]))
    else:
        df_a = df_long[df_long["is_fighter_a"] == 1]
        df_b = df_long[df_long["is_fighter_a"] == 0]
        merged = df_a[[match_id_col, ewma_col]].merge(
            df_b[[match_id_col, ewma_col]],
            on=match_id_col,
            suffixes=("_A", "_B"),
        )
        val_a = merged[f"{ewma_col}_A"]
        val_b = merged[f"{ewma_col}_B"]

    diff = pd.DataFrame({match_id_col: df_long[match_id_col].unique()})
    diff[f"{value_col}_DIFF_{window}"] = val_a - val_b
    return diff
