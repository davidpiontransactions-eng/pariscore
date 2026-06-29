"""Tests unitaires du pipeline UFC/MMA."""
import pytest
import pandas as pd
import numpy as np

# ── Tests EWMA ──

class TestUfcEwma:
    def test_ewma_params_defaults(self):
        from src.features.ufc_pipeline.ewma import UfcEwmaParams, DEFAULT_UFC_EWMA
        assert DEFAULT_UFC_EWMA.alpha_S == 0.30
        assert DEFAULT_UFC_EWMA.alpha_M == 0.15
        assert DEFAULT_UFC_EWMA.alpha_L == 0.05

    def test_ewma_point_in_time_first_fight_is_nan(self):
        from src.features.ufc_pipeline.ewma import _ewma_series_point_in_time
        values = pd.Series([0.5, 0.6, 0.7, 0.8])
        fighter = pd.Series(['F1', 'F1', 'F1', 'F1'])
        result = _ewma_series_point_in_time(values, fighter, alpha=0.3)
        assert pd.isna(result.iloc[0]), "Premier combat doit être NaN"
        assert not pd.isna(result.iloc[1]), "Deuxième combat doit avoir une valeur"

    def test_ewma_multi_window_s_monotonic(self):
        from src.features.ufc_pipeline.ewma import _ewma_series_point_in_time
        values = pd.Series([0.3, 0.5, 0.7, 0.9])
        fighter = pd.Series(["F1", "F1", "F1", "F1"])
        s = _ewma_series_point_in_time(values, fighter, alpha=0.30)
        m = _ewma_series_point_in_time(values, fighter, alpha=0.15)
        l = _ewma_series_point_in_time(values, fighter, alpha=0.05)
        for i in range(1, 4):
            assert s.iloc[i] >= m.iloc[i], f"S({s.iloc[i]}) devrait > M({m.iloc[i]}) au rang {i}"
            assert m.iloc[i] >= l.iloc[i], f"M({m.iloc[i]}) devrait > L({l.iloc[i]}) au rang {i}"

    def test_compute_mma_rolling_metric(self):
        from src.features.ufc_pipeline.ewma import compute_mma_rolling_metric
        df = pd.DataFrame({
            "fighter_id": ["F1"] * 5,
            "fight_date": pd.date_range("2025-01-01", periods=5, freq="30D"),
            "sig_str_landed_per_min": [3.0, 4.0, 5.0, 6.0, 7.0],
        })
        result = compute_mma_rolling_metric(df, value_col="sig_str_landed_per_min")
        assert "sig_str_landed_per_min_S" in result.columns
        assert "sig_str_landed_per_min_M" in result.columns
        assert "sig_str_landed_per_min_L" in result.columns
        assert "sig_str_landed_per_min_RAW" in result.columns
        assert pd.isna(result["sig_str_landed_per_min_S"].iloc[0])
        assert not pd.isna(result["sig_str_landed_per_min_S"].iloc[1])

    def test_ewma_differential(self):
        from src.features.ufc_pipeline.ewma import compute_ewma_differential
        df = pd.DataFrame({
            "match_id": ["U1", "U1"],
            "fighter_id": ["F1", "F2"],
            "fighter_side": ["A", "B"],
            "sig_str_landed_per_min_S": [5.0, 3.0],
        })
        diff = compute_ewma_differential(df, "sig_str_landed_per_min", window="S")
        assert "sig_str_landed_per_min_DIFF_S" in diff.columns
        assert diff["sig_str_landed_per_min_DIFF_S"].iloc[0] == 2.0

    def test_ufc_metrics_list(self):
        from src.features.ufc_pipeline.ewma import UFC_METRICS
        assert len(UFC_METRICS) == 11
        assert "sig_str_landed_per_min" in UFC_METRICS
        assert "td_avg_per_15" in UFC_METRICS

# ── Tests True Talent ──

class TestTrueTalent:
    def test_log_prior_centered(self):
        from src.features.ufc_pipeline.talent import _log_prior
        assert _log_prior(0.0) == 0.0
        assert _log_prior(1.5) > _log_prior(3.0)
        assert _log_prior(1.5) == _log_prior(-1.5)

    def test_log_likelihood_symmetry(self):
        from src.features.ufc_pipeline.talent import _log_likelihood
        ll_a_wins = _log_likelihood(1.0, 0.0, True)
        ll_b_wins = _log_likelihood(1.0, 0.0, False)
        assert ll_a_wins > ll_b_wins, "Favori devrait gagner plus probable"

    def test_estimate_true_talent_defaults(self):
        from src.features.ufc_pipeline.talent import estimate_true_talent_map
        df_fights = pd.DataFrame({
            "opponent_id": ["F2", "F3", "F4"],
            "is_winner": [1, 0, 1],
        })
        rating = estimate_true_talent_map("F1", df_fights)
        assert isinstance(rating, float)

    def test_true_talent_too_few_fights(self):
        from src.features.ufc_pipeline.talent import estimate_true_talent_map
        df_fights = pd.DataFrame({"opponent_id": ["F2"], "is_winner": [1]})
        rating = estimate_true_talent_map("F1", df_fights)
        assert rating == 0.0

    def test_compute_true_talent_batch(self, sample_ufc_long):
        df = sample_ufc_long.copy()
        result = df
        try:
            from src.features.ufc_pipeline.talent import compute_true_talent_batch
            result = compute_true_talent_batch(df)
            assert "true_talent_rating" in result.columns
            assert "opponent_strength" in result.columns
        except ImportError:
            pytest.skip("scipy non disponible")
        finally:
            pass

# ── Tests Context ──

class TestContext:
    def test_reach_advantage(self):
        from src.features.ufc_pipeline.context import compute_reach_advantage
        assert compute_reach_advantage(185, 178) == 7.0
        assert compute_reach_advantage(180, 185) == -5.0
        assert compute_reach_advantage(None, 180) == 0.0

    def test_age_difference(self):
        from src.features.ufc_pipeline.context import compute_age_difference
        assert compute_age_difference(28, 32) == -4.0
        assert compute_age_difference(None, 30) == 0.0

    def test_stance_advantage_southpaw(self):
        from src.features.ufc_pipeline.context import compute_stance_advantage
        assert compute_stance_advantage("southpaw", "orthodox") == 0.15
        assert compute_stance_advantage("orthodox", "southpaw") == -0.15
        assert compute_stance_advantage("orthodox", "orthodox") == 0.0
        assert compute_stance_advantage("switch", "orthodox") == 0.0

    def test_is_short_notice(self):
        from src.features.ufc_pipeline.context import compute_is_short_notice
        assert compute_is_short_notice(7) is True
        assert compute_is_short_notice(21) is False
        assert compute_is_short_notice(0) is False

    def test_streak_batch(self):
        from src.features.ufc_pipeline.context import compute_streak_batch
        df = pd.DataFrame({
            "fighter_id": ["F1", "F1", "F1", "F2", "F2"],
            "fight_date": pd.date_range("2025-01-01", periods=5, freq="30D"),
            "is_winner": [1, 1, 0, 0, 0],
        })
        streaks = compute_streak_batch(df)
        assert streaks.iloc[0] == 0
        assert streaks.iloc[1] == 1
        assert streaks.iloc[2] == 2
        assert streaks.iloc[3] == 0
        assert streaks.iloc[4] == -1

    def test_context_calculator(self, fighters_meta):
        from src.features.ufc_pipeline.context import ContextCalculator
        cc = ContextCalculator()
        meta_a = fighters_meta["F1"]  # 185cm, 28yo, orthodox
        meta_b = fighters_meta["F2"]  # 178cm, 32yo, southpaw
        fights_a = pd.DataFrame({"fight_date": [pd.Timestamp("2025-01-01")], "fighter_id": ["F1"], "is_winner": [1], "is_ko": [0], "is_submission": [0]})
        fights_b = pd.DataFrame({"fight_date": [pd.Timestamp("2025-01-01")], "fighter_id": ["F2"], "is_winner": [0], "is_ko": [0], "is_submission": [0]})
        ctx = cc.compute_all(fights_a, fights_b, meta_a, meta_b)
        assert ctx["reach_advantage_a"] == 7.0
        assert ctx["age_difference_a"] == -4.0
        assert ctx["stance_advantage"] == -0.15  # A orthodox vs B southpaw

# ── Tests Validator ──

class TestValidator:
    def test_first_fight_nan_pass(self):
        from src.features.ufc_pipeline.validator import PointInTimeValidator
        df = pd.DataFrame({
            "fighter_id": ["F1", "F1", "F1"],
            "sig_str_landed_per_min_S": [float("nan"), 5.0, 6.0],
            "sig_str_landed_per_min_M": [float("nan"), 4.0, 5.0],
        })
        v = PointInTimeValidator()
        result = v.validate_ewma_first_fight_nan(df)
        assert result.passed
        assert result.n_violations == 0

    def test_first_fight_nan_fail(self):
        from src.features.ufc_pipeline.validator import PointInTimeValidator
        df = pd.DataFrame({
            "fighter_id": ["F1", "F1"],
            "sig_str_landed_per_min_S": [5.0, 6.0],
        })
        v = PointInTimeValidator()
        result = v.validate_ewma_first_fight_nan(df)
        assert not result.passed
        assert result.n_violations > 0

    def test_no_future_leakage(self):
        from src.features.ufc_pipeline.validator import PointInTimeValidator
        df = pd.DataFrame({
            "fighter_id": ["F1", "F1", "F1"],
            "fight_date": pd.date_range("2025-01-01", periods=3, freq="30D"),
            "sig_str_landed_pct_RAW": [30.0, 50.0, 70.0],
            "sig_str_landed_pct_S": [float("nan"), 30.0, 42.0],
        })
        v = PointInTimeValidator()
        result = v.validate_no_future_leakage(df, metric_col="sig_str_landed_pct_S")
        assert result.passed

    def test_validate_differential_symmetry(self):
        from src.features.ufc_pipeline.validator import PointInTimeValidator
        df = pd.DataFrame({
            "match_id": ["U1"],
            "strike_diff_DIFF_S": [2.0],
            "strike_diff_DIFF_S_mirror": [-2.0],
        })
        v = PointInTimeValidator()
        result = v.validate_differential_symmetry(df)
        assert result.passed

# ── Fixtures ──

@pytest.fixture
def sample_ufc_long():
    """DataFrame UFC synthétique format long (7 combats, 4 combattants)."""
    np.random.seed(42)
    fights = [
        ("U1", "F1", "F2", "2025-01-15", "F1"),
        ("U2", "F3", "F4", "2025-02-10", "F3"),
        ("U3", "F1", "F3", "2025-03-20", "F3"),
        ("U4", "F2", "F4", "2025-04-05", "F2"),
        ("U5", "F1", "F4", "2025-05-18", "F1"),
        ("U6", "F2", "F3", "2025-06-22", "F3"),
        ("U7", "F1", "F2", "2025-07-30", "F1"),
    ]
    rows = []
    for fid, fa, fb, date_str, winner in fights:
        f_a_win = 1 if winner == fa else 0
        for side, f_id, is_win in [("A", fa, f_a_win), ("B", fb, 1 - f_a_win)]:
            opp = fb if side == "A" else fa
            rows.append({
                "fight_id": fid,
                "match_id": fid,
                "fighter_id": f_id,
                "opponent_id": opp,
                "fighter_side": side,
                "is_fighter_a": 1 if side == "A" else 0,
                "fight_date": pd.Timestamp(date_str),
                "is_winner": is_win,
                "is_ko": 1 if np.random.random() < 0.4 else 0,
                "is_submission": 1 if np.random.random() < 0.2 else 0,
                "weight_class": "lightweight",
                "rounds": 3,
                "is_title_fight": 0,
                "sig_str_landed_per_min": round(np.random.uniform(2, 8), 2),
                "sig_str_absorbed_per_min": round(np.random.uniform(1, 6), 2),
                "sig_str_accuracy": round(np.random.uniform(30, 70), 1),
                "sig_str_defense": round(np.random.uniform(40, 80), 1),
                "td_avg_per_15": round(np.random.uniform(0, 5), 2),
                "td_accuracy": round(np.random.uniform(20, 60), 1),
                "td_defense": round(np.random.uniform(50, 90), 1),
                "sub_attempts_per_15": round(np.random.uniform(0, 3), 2),
                "ctrl_time_per_15_sec": round(np.random.uniform(0, 120), 1),
                "knockdowns_per_15": round(np.random.uniform(0, 2), 2),
                "sig_str_landed_pct": round(np.random.uniform(30, 60), 1),
                "opponent_rating": 0.0,
            })
    return pd.DataFrame(rows)


@pytest.fixture
def fighters_meta():
    """Métadonnées des combattants."""
    return {
        "F1": {"fighter_name": "Fighter One", "reach_cm": 185, "age_years": 28,
               "stance": "orthodox", "weight_class": "lightweight"},
        "F2": {"fighter_name": "Fighter Two", "reach_cm": 178, "age_years": 32,
               "stance": "southpaw", "weight_class": "lightweight"},
        "F3": {"fighter_name": "Fighter Three", "reach_cm": 183, "age_years": 30,
               "stance": "orthodox", "weight_class": "lightweight"},
        "F4": {"fighter_name": "Fighter Four", "reach_cm": 180, "age_years": 26,
               "stance": "switch", "weight_class": "lightweight"},
    }


# ── Tests Pipeline Complet ──

class TestUFCPipeline:
    def test_pipeline_run(self, sample_ufc_long, fighters_meta):
        from src.features.ufc_pipeline import UFCPipeline
        pipeline = UFCPipeline(verbose=False)
        result = pipeline.run(sample_ufc_long, fighters_meta)
        assert len(result) == 7
        assert "true_talent_a" in result[0]
        assert "ewma_strike_diff_S" in result[0]
        assert "ewma_td_diff_S" in result[0]
        assert "reach_advantage_a" in result[0]
        assert result[0]["weight_class"] == "lightweight"

    def test_pipeline_min_fights_filter(self, sample_ufc_long):
        from src.features.ufc_pipeline import UFCPipeline
        pipeline = UFCPipeline(min_fights_per_fighter=10)
        result = pipeline.run(sample_ufc_long)
        assert len(result) == 0

    def test_pipeline_validator_runs(self, sample_ufc_long):
        from src.features.ufc_pipeline import UFCPipeline
        pipeline = UFCPipeline(verbose=True)
        result = pipeline.run(sample_ufc_long)
        assert pipeline.validator.last_result is not None
        assert hasattr(pipeline.validator.last_result, "passed")

    def test_pipeline_missing_columns(self):
        from src.features.ufc_pipeline import UFCPipeline
        pipeline = UFCPipeline()
        df_bad = pd.DataFrame({"bad_col": [1, 2]})
        try:
            pipeline.run(df_bad)
            assert False, "Doit lever ValueError"
        except ValueError:
            pass
