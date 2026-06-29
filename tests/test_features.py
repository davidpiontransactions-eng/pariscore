"""Tests du feature engineering: EWMA, calculateurs, pipeline."""

import pytest
import pandas as pd
import numpy as np

class TestEwma:
    def test_ewma_series(self):
        from src.features.ewma import ewma_series
        values = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        result = ewma_series(values, alpha=0.5)
        assert len(result) == 5
        assert not result.isna().any()
        assert result.std() < values.std()

    def test_compute_rolling_metric(self):
        from src.features.ewma import compute_rolling_metric
        df = pd.DataFrame({
            "player_id": ["P1"] * 10,
            "match_date": pd.date_range("2025-01-01", periods=10, freq="7D"),
            "value": np.linspace(0.5, 0.7, 10),
        })
        result = compute_rolling_metric(df, value_col="value")
        assert "value_S" in result.columns
        assert "value_L" in result.columns
        assert "value_MOM" in result.columns
        assert not result["value_S"].isna().all()

    def test_compute_differential(self):
        from src.features.ewma import compute_differential
        df_a = pd.DataFrame({"match_id": ["m1", "m2"], "value": [0.8, 0.7]})
        df_b = pd.DataFrame({"match_id": ["m1", "m2"], "value": [0.6, 0.5]})
        result = compute_differential(df_a, df_b, value_col="value")
        assert "value_DIFF" in result.columns
        assert result["value_DIFF"].iloc[0] == pytest.approx(0.2)

class TestCalculators:
    def test_calc_serve_edge(self, sample_match_df):
        from src.features.calculators import calc_serve_edge
        df_a = sample_match_df[sample_match_df["is_winner"] == 1].copy()
        df_b = sample_match_df[sample_match_df["is_winner"] == 0].copy()
        if len(df_a) < 2 or len(df_b) < 2:
            pytest.skip("Pas assez de donnees pour le test")
        for df in [df_a, df_b]:
            df["srv_pts_won_pct_S"] = df["srv_pts_won_pct"] / 100
            df["ret_pts_won_pct_S"] = df["ret_pts_won_pct"] / 100
        result = calc_serve_edge(df_a, df_b, df_a, df_b)
        assert "serve_edge_A" in result.columns

    def test_calc_motivation(self, sample_match_df):
        from src.features.calculators import calc_motivation
        result = calc_motivation(sample_match_df)
        assert len(result) == len(sample_match_df)
        assert result.min() >= 0
        assert result.max() <= 1

    def test_calc_fatigue(self, sample_match_df):
        from src.features.calculators import calc_fatigue
        result = calc_fatigue(sample_match_df)
        assert len(result) == len(sample_match_df)
        assert result.min() >= 0
        assert result.max() <= 1

    def test_calc_public(self):
        from src.features.calculators import calc_public
        df = pd.DataFrame({
            "player_a_nationality": ["FRA", "SRB", "FRA"],
            "player_b_nationality": ["SRB", "ESP", "FRA"],
            "tourney_country": ["FRA", "FRA", "FRA"],
        })
        result = calc_public(df)
        assert result.iloc[0] == 1.0  # A at home only
        assert result.iloc[1] == 0.5  # neither at home
        assert result.iloc[2] == 0.5  # both at home

class TestPipeline:
    def test_pipeline_init(self):
        from src.features.pipeline import FeaturePipeline
        pipeline = FeaturePipeline(min_matches_per_player=5)
        assert pipeline is not None
        assert pipeline.min_matches == 5

    def test_pipeline_run_synthetic(self):
        from src.data.synthetic import generate_dataset
        from src.features.pipeline import FeaturePipeline
        df = generate_dataset(n_matches=100, seed=42)
        pipeline = FeaturePipeline(min_matches_per_player=5)
        result = pipeline.run(df)
        assert len(result) > 0
        assert "serve_edge_A" in result.columns
        assert "serve_edge_B" in result.columns
