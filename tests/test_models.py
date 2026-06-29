"""Tests du modele ML et de la preparation des features."""

import pytest
import numpy as np
import pandas as pd

class TestFeatureColumns:
    def test_feature_columns_defined(self):
        from src.models.train import FEATURE_COLUMNS
        assert len(FEATURE_COLUMNS) == 18
        assert "serve_edge_A" in FEATURE_COLUMNS
        assert "serve_edge_B" in FEATURE_COLUMNS
        assert len(set(FEATURE_COLUMNS)) == len(FEATURE_COLUMNS)

    def test_prepare_features(self, sample_match_df):
        from src.models.train import prepare_features
        for col in ["serve_edge_A", "serve_edge_B", "clutch_A", "clutch_B",
                     "h2h_context_score", "age_30_A", "age_30_B",
                     "motivation_A", "motivation_B", "fatigue_A", "fatigue_B",
                     "public_advantage", "srv_pts_won_pct_S_DIFF", "ret_pts_won_pct_S_DIFF",
                     "srv_pts_won_S_A", "srv_pts_won_S_B", "ret_pts_won_S_A", "ret_pts_won_S_B",
                     "target"]:
            if col not in sample_match_df.columns:
                sample_match_df[col] = 0.5 if "DIFF" not in col and "target" not in col else (
                    np.random.binomial(1, 0.5) if col == "target" else 0.0
                )
        X, y = prepare_features(sample_match_df)
        assert X.shape[1] == 18
        assert len(y) == len(sample_match_df)

class TestModelLoading:
    def test_model_file_exists(self):
        import os
        assert os.path.exists("models/pariscore_rf_v1.joblib"), \
            "Modele non trouve. Entraine d'abord avec: python run.py train"

    def test_model_loads_and_predicts(self, sample_features):
        from src.models.train import load_model, FEATURE_COLUMNS
        import numpy as np

        model = load_model("models/pariscore_rf_v1.joblib")
        assert model is not None

        x = np.array([[sample_features[col] for col in FEATURE_COLUMNS]])
        prob = model.predict_proba(x)[0, 1]
        assert 0 <= prob <= 1
