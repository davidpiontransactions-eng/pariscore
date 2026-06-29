"""
Générateur de données synthétiques pour développement et test.

Produit un DataFrame normalisé compatible avec le pipeline
pour permettre le développement sans télécharger les données Sackmann.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


RNG = np.random.default_rng(42)

PLAYERS = [
    "Djokovic", "Alcaraz", "Sinner", "Medvedev", "Zverev",
    "Rublev", "Hurkacz", "Rune", "Tsitsipas", "Fritz",
    "Auger-Aliassime", "Paul", "Khachanov", "De Minaur", "Tiafoe",
]

SURFACES = ["Hard", "Clay", "Grass"]

SURFACE_PCT = {
    "Hard": (0.66, 0.34),
    "Clay": (0.58, 0.42),
    "Grass": (0.72, 0.28),
}

TOURNAMENTS = {
    "Australian Open": "Hard",
    "Roland Garros": "Clay",
    "Wimbledon": "Grass",
    "US Open": "Hard",
    "Indian Wells": "Hard",
    "Monte Carlo": "Clay",
    "Rome": "Clay",
    "Cincinnati": "Hard",
}


def generate_dataset(
    n_matches: int = 2000,
    n_players: int = 30,
    seed: int = 42,
) -> pd.DataFrame:
    """Génère un dataset synthétique de matches.

    Structure normalisée: une ligne par (joueur, match),
    donc 2 lignes par match (winner + loser).

    Args:
        n_matches: Nombre de matchs à générer.
        n_players: Nombre de joueurs uniques.
        seed: Graine aléatoire.

    Returns:
        DataFrame normalisé.
    """
    rng = np.random.default_rng(seed)
    player_names = PLAYERS[:n_players] + [
        f"Player_{i}" for i in range(len(PLAYERS), n_players)
    ]

    rows = []
    match_ids = []

    # Générer les joueurs (birth_date)
    players_info = {}
    for p in player_names:
        birth_year = int(rng.integers(1985, 2005))
        players_info[p] = f"{birth_year}-{rng.integers(1,13):02d}-{rng.integers(1,28):02d}"

    for midx in range(n_matches):
        match_id = f"SYNTH_{midx:06d}"
        match_ids.append(match_id)

        # Sélection des joueurs
        pA, pB = rng.choice(player_names, size=2, replace=False)

        # Surface et tournoi
        tourney_name = rng.choice(list(TOURNAMENTS.keys()))
        surface = TOURNAMENTS[tourney_name]

        # Date (progressive)
        year = 2020 + midx // 500
        month = 1 + (midx % 12)
        match_date = f"{year}-{month:02d}-15"

        # Score
        sets_won_a = rng.choice([3, 2, 2, 1, 0], p=[0.15, 0.35, 0.10, 0.25, 0.15])
        sets_won_b = 3 - sets_won_a if sets_won_a < 3 else rng.integers(0, 3)
        is_winner = sets_won_a > sets_won_b

        # Stats brutes (corrélées au résultat)
        serve_pct_a = rng.normal(0.63, 0.04) + (0.03 if is_winner else -0.02)
        serve_pct_b = rng.normal(0.63, 0.04) + (0.03 if not is_winner else -0.02)

        first_serve_won_a = rng.normal(0.73, 0.03) + (0.04 if is_winner else -0.03)
        first_serve_won_b = rng.normal(0.73, 0.03) + (0.04 if not is_winner else -0.03)

        second_serve_won_a = rng.normal(0.52, 0.03) + (0.02 if is_winner else -0.02)
        second_serve_won_b = rng.normal(0.52, 0.03) + (0.02 if not is_winner else -0.02)

        bp_saved_a = rng.beta(6, 4) + (0.03 if is_winner else -0.02)
        bp_saved_b = rng.beta(6, 4) + (0.03 if not is_winner else -0.02)

        bp_conv_a = rng.beta(5, 5) + (0.04 if is_winner else -0.03)
        bp_conv_b = rng.beta(5, 5) + (0.04 if not is_winner else -0.03)

        # Métriques composites synthétiques (pour test)
        srv_pts_won_pct_a = 0.4 * serve_pct_a + 0.4 * first_serve_won_a + 0.2 * second_serve_won_a
        srv_pts_won_pct_b = 0.4 * serve_pct_b + 0.4 * first_serve_won_b + 0.2 * second_serve_won_b

        ret_pts_won_pct_a = 1.0 - srv_pts_won_pct_b
        ret_pts_won_pct_b = 1.0 - srv_pts_won_pct_a

        aces_a = int(rng.poisson(8) + (3 if is_winner else 0))
        aces_b = int(rng.poisson(8) + (3 if not is_winner else 0))

        dfs_a = int(rng.poisson(3) + (1 if not is_winner else 0))
        dfs_b = int(rng.poisson(3) + (1 if is_winner else 0))

        for is_winner_flag, pname, srv_pct, fs_won, ss_won, bp_s, bp_c, srv_w, ret_w, aces, dfs in [
            (1, pA, serve_pct_a, first_serve_won_a, second_serve_won_a,
             bp_saved_a, bp_conv_a, srv_pts_won_pct_a, ret_pts_won_pct_a, aces_a, dfs_a),
            (0, pB, serve_pct_b, first_serve_won_b, second_serve_won_b,
             bp_saved_b, bp_conv_b, srv_pts_won_pct_b, ret_pts_won_pct_b, aces_b, dfs_b),
        ]:
            rows.append({
                "match_id": match_id,
                "tourney_id": f"SYNTH_T{midx:04d}",
                "tourney_name": tourney_name,
                "surface": surface,
                "tourney_date": match_date,
                "match_date": match_date,
                "round": rng.choice(["R64", "R32", "R16", "QF", "SF", "F"]),
                "player_id": pname,
                "player_name": pname,
                "birth_date": players_info[pname],
                "player_nationality": rng.choice(["SRB", "ESP", "ITA", "RUS", "GER", "USA", "CAN", "FRA", "GRE", "AUS"]),
                "tourney_country": rng.choice(["AUS", "FRA", "GBR", "USA", "ESP", "ITA", "USA"]),
                "is_winner": is_winner_flag,
                "sets_won": sets_won_a if is_winner_flag else sets_won_b,
                "sets_lost": sets_won_b if is_winner_flag else sets_won_a,
                "serve_pct": srv_pct,
                "first_serve_won_pct": fs_won,
                "second_serve_won_pct": ss_won,
                "bp_saved_pct": bp_s,
                "bp_converted_pct": bp_c,
                "tb_won_pct": rng.uniform(0.4, 0.7),
                "srv_pts_won_pct": srv_w,
                "ret_pts_won_pct": ret_w,
                "ace_count": aces,
                "df_count": dfs,
                "tourney_lat": rng.uniform(33.0, 52.0),
                "tourney_lon": rng.uniform(-120.0, 4.0),
            })

    df = pd.DataFrame(rows)
    df["match_date"] = pd.to_datetime(df["match_date"])
    df["tourney_date"] = pd.to_datetime(df["tourney_date"])
    df = df.sort_values(["match_date", "match_id"]).reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = generate_dataset(n_matches=500)
    print(f"Généré: {len(df)} lignes ({len(df) // 2} matchs)")
    print(f"Joueurs: {df['player_id'].nunique()}")
    print(f"Période: {df['match_date'].min().date()} → {df['match_date'].max().date()}")
    print(f"Colonnes: {list(df.columns)}")
    print(df.head(10))
