"""Tests des strategies de paris et du backtesting."""

import pytest
import numpy as np

class TestStrategyEngine:
    def test_engine_imports(self):
        from src.strategies.engine import BacktestEngine
        assert BacktestEngine is not None

    def test_generate_matches(self):
        from src.data.synthetic import generate_dataset
        df = generate_dataset(n_matches=50)
        assert len(df) > 0
        assert df["match_id"].nunique() == 50

    def test_backtest_value_betting_no_model(self):
        from src.strategies.engine import BacktestEngine
        engine = BacktestEngine(model=None)
        with pytest.raises((ValueError, TypeError, AttributeError)):
            engine.run(strategy="value_betting", bankroll=10000)

class TestStrategies:
    def test_value_betting_logic(self):
        from src.strategies.engine import BacktestEngine
        bet = BacktestEngine._value_betting(
            prob_a=0.75, prob_b=0.25,
            odds_a=1.50, odds_b=3.00,
            threshold=1.10, min_odds=1.20, max_odds=5.00,
            idx=0, bankroll=10000,
        )
        assert bet is not None
        assert bet["side"] == "A"
        assert bet["stake"] == 200.0

    def test_kelly_criterion(self):
        from src.strategies.engine import BacktestEngine
        bet = BacktestEngine._kelly_criterion(
            prob_a=0.60, prob_b=0.40,
            odds_a=1.80, odds_b=2.20,
            threshold=1.0, min_odds=1.20, max_odds=5.00,
            idx=0, bankroll=10000,
        )
        assert bet is not None
        assert bet["side"] == "A"
        assert bet["stake"] > 0

    def test_contrarien_no_bet_when_fav_undervalued(self):
        from src.strategies.engine import BacktestEngine
        bet = BacktestEngine._contrarien(
            prob_a=0.80, prob_b=0.20,
            odds_a=1.25, odds_b=4.00,
            threshold=1.0, min_odds=1.20, max_odds=5.00,
            idx=0,
        )
        assert bet is None
