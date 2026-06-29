"""
Calculators individuels pour chaque métrique validée en Session 3.

Chaque fonction prend un DataFrame de matchs bruts et retourne
une série de features calculées avec les paramètres validés.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.features.ewma import (
    compute_rolling_metric,
    compute_winning_derivative,
)


# ──────────────────────────────────────────────
# NOYAU DUR — Sprint 1
# ──────────────────────────────────────────────

def calc_srv_pts_won(
    df: pd.DataFrame,
    player_col: str = "player_id",
    date_col: str = "match_date",
) -> pd.DataFrame:
    """SRV_PTS_WON_S — % points service gagnés, EWMA 5 matchs α=0.18.

    Validé: LOFO −4.0 pts, métrique #1 des deux expertises.
    Source: Sackmann + calcul interne.
    """
    return compute_rolling_metric(
        df, value_col="srv_pts_won_pct",
        player_col=player_col, date_col=date_col,
    )


def calc_ret_pts_won(
    df: pd.DataFrame,
    player_col: str = "player_id",
    date_col: str = "match_date",
) -> pd.DataFrame:
    """RET_PTS_WON_S — % points retour gagnés, EWMA 5 matchs α=0.18.

    Validé: LOFO −3.5 pts, symétrique de SRV_PTS_WON_S.
    Source: Sackmann + calcul interne.
    """
    return compute_rolling_metric(
        df, value_col="ret_pts_won_pct",
        player_col=player_col, date_col=date_col,
    )


def calc_serve_edge(
    df_srv_a: pd.DataFrame,
    df_srv_b: pd.DataFrame,
    df_ret_a: pd.DataFrame,
    df_ret_b: pd.DataFrame,
    match_id_col: str = "match_id",
    surface_col: str = "surface",
) -> pd.DataFrame:
    """SERVE_EDGE = (SRV_PTS_WON_S − RET_PTS_WON_OPP_S) × SURFACE_WEIGHT

    Validé Session 3 — composée #1.
    Retourne un DataFrame avec une colonne 'serve_edge' par match.
    """
    weights = {"hard": 1.0, "clay": 0.8, "grass": 1.2, "carpet": 1.0}

    # Récupérer les EWMA court terme et renommer pour éviter les confusions
    srv_a = df_srv_a[[match_id_col, "srv_pts_won_pct_S", surface_col]].copy()
    ret_b = df_ret_b[[match_id_col, "ret_pts_won_pct_S", surface_col]].copy()
    ret_b = ret_b.rename(columns={"ret_pts_won_pct_S": "ret_pts_won_pct_S_opp"})

    srv_b = df_srv_b[[match_id_col, "srv_pts_won_pct_S", surface_col]].copy()
    ret_a = df_ret_a[[match_id_col, "ret_pts_won_pct_S", surface_col]].copy()
    ret_a = ret_a.rename(columns={"ret_pts_won_pct_S": "ret_pts_won_pct_S_opp"})

    # Différentiel: SRV joueur A − RET joueur B = edge serveur A dans ce matchup
    edge_a = srv_a.merge(ret_b, on=match_id_col, suffixes=("", "_opp"))
    edge_a["raw_edge"] = (
        edge_a["srv_pts_won_pct_S"] - edge_a["ret_pts_won_pct_S_opp"]
    )
    edge_a["serve_edge"] = edge_a.apply(
        lambda r: r["raw_edge"] * weights.get(r["surface"].lower(), 1.0), axis=1
    )
    edge_a = edge_a[[match_id_col, "serve_edge"]].rename(
        columns={"serve_edge": "serve_edge_A"}
    )

    edge_b = srv_b.merge(ret_a, on=match_id_col, suffixes=("", "_opp"))
    edge_b["raw_edge"] = (
        edge_b["srv_pts_won_pct_S"] - edge_b["ret_pts_won_pct_S_opp"]
    )
    edge_b["serve_edge"] = edge_b.apply(
        lambda r: r["raw_edge"] * weights.get(r["surface"].lower(), 1.0), axis=1
    )
    edge_b = edge_b[[match_id_col, "serve_edge"]].rename(
        columns={"serve_edge": "serve_edge_B"}
    )

    result = edge_a.merge(edge_b, on=match_id_col)
    return result


def calc_clutch_factor(
    df: pd.DataFrame,
    player_col: str = "player_id",
    date_col: str = "match_date",
) -> pd.DataFrame:
    """CLUTCH_FACTOR = (BP_CONV_S × BP_SAVED_S × TB_WINRATE_S)^(1/3)

    Validé Session 3 — composée #2.
    Toutes les sous-métriques utilisent EWMA long (α=0.05) car trop volatiles
    en court terme (argument Parieur validé).

    Retourne: bp_conv_S, bp_saved_S, tb_winrate_S, clutch_factor.
    """
    # BP_CONV — EWMA long
    bp = compute_rolling_metric(
        df, value_col="bp_converted_pct",
        player_col=player_col, date_col=date_col,
        alpha_long=0.05, alpha_short=0.05,
    )

    # BP_SAVED — EWMA long
    saved = compute_rolling_metric(
        df, value_col="bp_saved_pct",
        player_col=player_col, date_col=date_col,
        alpha_long=0.05, alpha_short=0.05,
    )

    # TB_WINRATE — EWMA long
    tb = compute_rolling_metric(
        df, value_col="tb_won_pct",
        player_col=player_col, date_col=date_col,
        alpha_long=0.05, alpha_short=0.05,
    )

    # Moyenne géométrique
    df = df.copy()
    df["bp_conv_S"] = bp["bp_converted_pct_S"]
    df["bp_saved_S"] = saved["bp_saved_pct_S"]
    df["tb_winrate_S"] = tb["tb_won_pct_S"]

    df["clutch_factor"] = (
        df["bp_conv_S"] * df["bp_saved_S"] * df["tb_winrate_S"]
    ) ** (1 / 3)

    return df


def calc_h2h_context_score(
    df_matches: pd.DataFrame,
    h2h_surface_weight: float = 0.40,
    h2h_temporal_weight: float = 0.30,
    h2h_base_weight: float = 0.20,
    h2h_context_weight: float = 0.10,
    surface_decay_years: int = 2,
) -> pd.DataFrame:
    """H2H_CONTEXT_SCORE — Score composé de face-à-face.

    Validé Session 3 — composée #3.
    Poids: 40% surface + 30% temporel + 20% base + 10% contexte.

    Args:
        df_matches: DataFrame avec matchs, colonnes nécessaires:
            player_a_id, player_b_id, surface, tourney_date,
            tourney_name, round, winner_id.
        h2h_surface_weight: Poids du H2H par surface.
        h2h_temporal_weight: Poids du H2H temporel (matchs récents > anciens).
        h2h_base_weight: Poids du H2H brut toutes surfaces.
        h2h_context_weight: Poids du contexte (tournoi, round).
        surface_decay_years: Fenêtre pour H2H_SURFACE.

    Returns:
        DataFrame avec colonne 'h2h_context_score'.
    """
    df = df_matches.copy()

    # H2H_BASE — toutes surfaces, illimité
    h2h_base = _compute_h2h_base(df)

    # H2H_SURFACE — même surface, 2 ans
    h2h_surface = _compute_h2h_surface(df, max_years=surface_decay_years)

    # H2H_TEMPOREL — poids décroissant
    h2h_temporal = _compute_h2h_temporal(df)

    # H2H_CONTEXT — contexte du match (finale = +poids)
    h2h_context = _compute_h2h_context(df)

    df = df.merge(h2h_base, on="match_id", how="left")
    df = df.merge(h2h_surface, on="match_id", how="left")
    df = df.merge(h2h_temporal, on="match_id", how="left")
    df = df.merge(h2h_context, on="match_id", how="left")

    # Remplir les NaN (pas de H2H) avec 0.50 (neutre)
    for col in ["h2h_base", "h2h_surface", "h2h_temporal"]:
        df[col] = df[col].fillna(0.50)

    df["h2h_context_score"] = (
        h2h_surface_weight * df["h2h_surface"]
        + h2h_temporal_weight * df["h2h_temporal"]
        + h2h_base_weight * df["h2h_base"]
        + h2h_context_weight * df["h2h_context"].fillna(1.0)
    )

    return df


def _compute_h2h_base(df: pd.DataFrame) -> pd.DataFrame:
    """H2H_BASE — ratio victoires joueur A vs joueur B, toutes surfaces."""
    h2h = df.groupby(["player_a_id", "player_b_id"]).agg(
        total_matches=("match_id", "count"),
        a_wins=("winner_id", lambda x: (x == df.loc[x.index, "player_a_id"]).sum()),
    ).reset_index()
    h2h["ratio"] = np.where(
        h2h["total_matches"] > 0,
        h2h["a_wins"] / h2h["total_matches"],
        0.50,
    )
    result = df[["match_id", "player_a_id", "player_b_id"]].merge(
        h2h[["player_a_id", "player_b_id", "ratio"]],
        on=["player_a_id", "player_b_id"],
        how="left",
    )
    result = result.rename(columns={"ratio": "h2h_base"})
    return result[["match_id", "h2h_base"]]


def _compute_h2h_surface(df: pd.DataFrame, max_years: int = 2) -> pd.DataFrame:
    """H2H_SURFACE — ratio sur même surface, fenêtre max_years."""
    ref_date = df["tourney_date"].max()

    # Filtrer les matchs passés sur la même surface dans la fenêtre
    df_past = df.merge(
        df[["match_id", "player_a_id", "player_b_id", "surface", "tourney_date",
            "winner_id"]],
        on=["player_a_id", "player_b_id", "surface"],
        suffixes=("", "_past"),
    )
    mask = (
        (df_past["tourney_date_past"] < df_past["tourney_date"])
        & (df_past["tourney_date"] - df_past["tourney_date_past"]
           <= pd.Timedelta(days=365 * max_years))
    )
    df_past = df_past[mask]

    h2h = df_past.groupby("match_id").agg(
        surface_matches=("match_id_past", "count"),
        a_wins_surface=(
            "winner_id_past",
            lambda x: (x == df_past.loc[x.index, "player_a_id"]).sum(),
        ),
    ).reset_index()
    h2h["ratio"] = np.where(
        h2h["surface_matches"] > 0,
        h2h["a_wins_surface"] / h2h["surface_matches"],
        0.50,
    )
    result = df[["match_id"]].merge(
        h2h[["match_id", "ratio"]], on="match_id", how="left"
    )
    result = result.rename(columns={"ratio": "h2h_surface"})
    return result[["match_id", "h2h_surface"]]


def _compute_h2h_temporal(df: pd.DataFrame) -> pd.DataFrame:
    """H2H_TEMPOREL — poids exponentiel décroissant sur les matchs H2H."""
    df_past = df.merge(
        df[["match_id", "player_a_id", "player_b_id", "tourney_date", "winner_id"]],
        on=["player_a_id", "player_b_id"],
        suffixes=("", "_past"),
    )
    mask = df_past["tourney_date_past"] < df_past["tourney_date"]
    df_past = df_past[mask]
    df_past["days_ago"] = (
        df_past["tourney_date"] - df_past["tourney_date_past"]
    ).dt.days
    # Poids exponentiel: plus récent = plus de poids
    # Demi-vie de 180 jours
    df_past["weight"] = np.exp(-df_past["days_ago"] / 180)
    df_past["a_won"] = (
        df_past["winner_id_past"] == df_past["player_a_id"]
    ).astype(float)

    weighted = df_past.groupby("match_id").apply(
        lambda g: np.average(g["a_won"], weights=g["weight"])
        if g["weight"].sum() > 0 else 0.50,
        include_groups=False,
    ).reset_index(name="h2h_temporal")

    return weighted


def _compute_h2h_context(df: pd.DataFrame) -> pd.DataFrame:
    """H2H_CONTEXT — facteur multiplicatif basé sur le contexte du match.

    Un joueur d'expérience (Djokovic, Nadal) monte en finale.
    Un joueur plus jeune peut craquer.
    Facteur: 1.0 = neutre, >1.0 = avantage au joueur A.
    """
    ctx = df[["match_id", "round", "player_a_id", "player_b_id",
              "tourney_name"]].copy()

    # Grand Chelem et finales = avantage à l'expérience
    is_grand_slam = ctx["tourney_name"].str.contains(
        "Wimbledon|Roland Garros|Australian Open|US Open", na=False
    ).astype(int)

    is_final = (ctx["round"] == "F").astype(int)

    # Bonus contexte simple
    ctx["h2h_context"] = 1.0 + 0.10 * is_grand_slam + 0.05 * is_final

    return ctx[["match_id", "h2h_context"]]


# ──────────────────────────────────────────────
# ANGLES MORTS — Sprint 1
# ──────────────────────────────────────────────

def calc_motivation(
    df: pd.DataFrame,
    player_col: str = "player_id",
    date_col: str = "match_date",
    tourney_col: str = "tourney_name",
    round_col: str = "round",
) -> pd.Series:
    """MOTIVATION — Score de motivation basé sur:
    - Dernière performance (victoire récente = confiance)
    - Statut du tournoi (Grand Chelem > ATP 250)
    - Proximité d'une défaite surprenante

    Retourne: score entre 0 (démotivé) et 1 (hyper motivé).
    """
    grand_slams = {"Wimbledon", "Roland Garros", "Australian Open", "US Open"}

    df = df.copy()
    # Le joueur vient-il de gagner?
    df["last_match_won"] = df.groupby(player_col)[player_col].shift(1).notna()

    # Score: 0.5 base
    motivation = pd.Series(0.5, index=df.index)

    # Bonus Grand Chelem
    major = df[tourney_col].isin(grand_slams).astype(float)
    motivation += 0.15 * major

    # Bonus tour avancé
    late_rounds = df[round_col].isin({"QF", "SF", "F"}).astype(float)
    motivation += 0.10 * late_rounds

    # Malus: défaite surprenante au tour précédent (last_match_won = False)
    recent_loss = (df["last_match_won"] == False).astype(float) * 0.10
    motivation -= recent_loss

    return motivation.clip(0, 1)


def calc_fatigue(
    df: pd.DataFrame,
    player_col: str = "player_id",
    date_col: str = "match_date",
    lat_col: str = "tourney_lat",
    lon_col: str = "tourney_lon",
) -> pd.Series:
    """FATIGUE — Score de fatigue basé sur:
    - Distance géographique parcourue depuis le dernier tournoi
    - Jours de repos depuis le dernier match
    - Décalage horaire (proxy par longitude)

    Retourne: score entre 0 (reposé) et 1 (épuisé).
    """
    df = df.sort_values([player_col, date_col]).copy()

    # Jours depuis le dernier match
    df["days_since_last"] = df.groupby(player_col)[date_col].diff().dt.days

    # Distance géographique (approximation par coordonnées)
    df["prev_lat"] = df.groupby(player_col)[lat_col].shift(1)
    df["prev_lon"] = df.groupby(player_col)[lon_col].shift(1)

    # Distance de Manhattan normalisée (max ~200 pour traverser l'Atlantique)
    df["geo_dist"] = (
        (df[lat_col] - df["prev_lat"]).abs()
        + (df[lon_col] - df["prev_lon"]).abs()
    )

    # Score: combiné jours de repos + distance
    fatigue = pd.Series(0.0, index=df.index)

    # Moins de 3 jours = fatigue élevée
    low_rest = (df["days_since_last"] < 3)
    fatigue += 0.4 * low_rest.astype(float)

    # Grande distance = fatigue de voyage
    far_travel = (df["geo_dist"] > 50)
    fatigue += 0.3 * far_travel.astype(float)

    # Les deux combinés = fatigue max
    both = (low_rest & far_travel)
    fatigue += 0.3 * both.astype(float)

    return fatigue.clip(0, 1)


def calc_public(
    df: pd.DataFrame,
    player_a_nat_col: str = "player_a_nationality",
    player_b_nat_col: str = "player_b_nationality",
    tourney_country_col: str = "tourney_country",
) -> pd.Series:
    """PUBLIC — Avantage joueur jouant dans son pays.

    Retourne:
      1.0 = joueur A joue dans son pays, pas B
      0.5 = les deux ou aucun
      0.0 = joueur B joue dans son pays, pas A
    """
    a_home = (df[player_a_nat_col] == df[tourney_country_col]).astype(float)
    b_home = (df[player_b_nat_col] == df[tourney_country_col]).astype(float)

    public = pd.Series(0.5, index=df.index)
    public[(a_home == 1) & (b_home == 0)] = 1.0
    public[(a_home == 0) & (b_home == 1)] = 0.0

    return public
