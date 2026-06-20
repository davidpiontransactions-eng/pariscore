"""Fixtures de test Pariscore."""
import pytest
import pandas as pd
import numpy as np

@pytest.fixture
def sample_features():
    """Sample feature vector matching FEATURE_COLUMNS."""
    return {
        "serve_edge_A": 0.12, "serve_edge_B": -0.08,
        "clutch_A": 0.28, "clutch_B": 0.11,
        "h2h_context_score": 0.35,
        "age_30_A": 1, "age_30_B": 0,
        "motivation_A": 0.85, "motivation_B": 0.92,
        "fatigue_A": 0.35, "fatigue_B": 0.20,
        "public_advantage": 0.15,
        "srv_pts_won_pct_S_DIFF": 0.04,
        "ret_pts_won_pct_S_DIFF": 0.02,
        "srv_pts_won_S_A": 0.72, "srv_pts_won_S_B": 0.68,
        "ret_pts_won_S_A": 0.38, "ret_pts_won_S_B": 0.42,
    }

@pytest.fixture
def sample_match_df():
    """Small properly-structured DataFrame for pipeline testing.

    Each match_id appears twice (winner + loser), matching real data layout.
    """
    n_matches = 20
    n = n_matches * 2
    np.random.seed(42)
    rng = np.random.default_rng(42)

    match_ids = [f"m{i}" for i in range(n_matches)]
    surfaces = rng.choice(["Hard", "Clay", "Grass"], n_matches)
    tourney_names = rng.choice(
        ["Australian Open", "Roland Garros", "Wimbledon"], n_matches
    )
    match_dates = pd.date_range("2025-01-01", periods=n_matches, freq="14D")

    rows = []
    for i, mid in enumerate(match_ids):
        p_a = f"P{rng.integers(0, 6)}"
        p_b = f"P{rng.integers(0, 6)}"
        while p_b == p_a:
            p_b = f"P{rng.integers(0, 6)}"
        winner = rng.integers(0, 2)
        for is_win, pname in [(winner, p_a), (1 - winner, p_b)]:
            rows.append({
                "match_id": mid,
                "player_id": pname,
                "player_name": f"Player_{pname}",
                "match_date": match_dates[i],
                "srv_pts_won_pct": rng.uniform(55, 75),
                "ret_pts_won_pct": rng.uniform(30, 50),
                "bp_converted_pct": rng.uniform(30, 50),
                "bp_saved_pct": rng.uniform(50, 70),
                "tb_won_pct": rng.uniform(40, 60),
                "is_winner": is_win,
                "surface": surfaces[i],
                "tourney_name": tourney_names[i],
                "tourney_date": match_dates[i],
                "round": rng.choice(["R32", "R16", "QF", "SF", "F"]),
                "tourney_country": rng.choice(["AUS", "FRA", "GBR"]),
                "tourney_lat": rng.uniform(40, 55),
                "tourney_lon": rng.uniform(-10, 10),
                "birth_date": pd.Timestamp("1995-06-01"),
                "player_nationality": rng.choice(["SRB", "ESP", "ITA", "GER"]),
            })
    return pd.DataFrame(rows)
