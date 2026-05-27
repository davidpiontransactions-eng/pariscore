"""
test_surface_powerscore.py — Pytest suite for SurfacePowerScoreCalculator
Run: python -m pytest test_surface_powerscore.py -v
"""

import pytest
from surface_powerscore import (
    SurfacePowerScoreCalculator,
    PlayerMetrics,
    SPSResult,
    _SURFACE_WEIGHTS,
    _MIN_MATCHES_FULL_CONFIDENCE,
    _CONFIDENCE_PENALTY,
)

calc = SurfacePowerScoreCalculator()

BASE_METRICS: dict = {
    "elo_recent": 78.5,
    "sdr": 82.0,
    "return_pts_won": 68.0,
    "second_service_won": 60.0,
    "service_games_won": 75.0,
    "bp_saved": 70.0,
    "tie_breaks_won": 55.0,
    "baseline_efficiency": 72.0,
}

BASE_PAYLOAD: dict = {
    "player_id": "12345",
    "surface": "clay",
    "circuit": "ATP",
    "metrics": BASE_METRICS,
    "matches_played_on_surface": 12,
}


# ═══════════════════════════════════════════════════════════════════════════════
# 1. WEIGHT TABLE INTEGRITY
# ═══════════════════════════════════════════════════════════════════════════════

class TestWeightTableIntegrity:
    """All weight tables must sum to 1.00 for both ATP and WTA."""

    @pytest.mark.parametrize("surface", ["clay", "grass", "hard"])
    @pytest.mark.parametrize("circuit_idx,circuit", [(0, "ATP"), (1, "WTA")])
    def test_weights_sum_to_one(self, surface, circuit_idx, circuit):
        total = sum(w[circuit_idx] for w in _SURFACE_WEIGHTS[surface].values())
        assert abs(total - 1.0) < 1e-9, (
            f"{circuit} {surface}: weights sum to {total:.6f}, expected 1.0"
        )

    def test_all_surfaces_defined(self):
        for s in ("clay", "grass", "hard"):
            assert s in _SURFACE_WEIGHTS


# ═══════════════════════════════════════════════════════════════════════════════
# 2. FORMULA CORRECTNESS — surface by surface
# ═══════════════════════════════════════════════════════════════════════════════

class TestClayFormulaATP:
    """ATP Clay: 0.35×return + 0.25×bp_saved + 0.25×2nd_srv + 0.15×baseline"""

    def test_aptitude_exact(self):
        # 0.35*68 + 0.25*70 + 0.25*60 + 0.15*72 = 23.8+17.5+15+10.8 = 67.1
        result = calc.calculate(BASE_PAYLOAD)
        assert pytest.approx(result.aptitude_score, abs=1e-6) == 67.1

    def test_sps_exact(self):
        # SPS = 67.1*0.70 + 78.5*0.30 = 46.97 + 23.55 = 70.52
        result = calc.calculate(BASE_PAYLOAD)
        assert pytest.approx(result.sps, abs=1e-6) == 70.52

    def test_confidence_full(self):
        result = calc.calculate(BASE_PAYLOAD)
        assert result.confidence_full is True


class TestGrassFormulaATP:
    """ATP Grass: 0.40×srv_games + 0.25×bp_saved + 0.20×sdr + 0.15×tb_won"""

    def test_aptitude_exact(self):
        # 0.40*75 + 0.25*70 + 0.20*82 + 0.15*55 = 30+17.5+16.4+8.25 = 72.15
        payload = {**BASE_PAYLOAD, "surface": "grass"}
        result = calc.calculate(payload)
        assert pytest.approx(result.aptitude_score, abs=1e-6) == 72.15

    def test_sps_full_confidence(self):
        # SPS = 72.15*0.70 + 78.5*0.30 = 50.505 + 23.55 = 74.055
        payload = {**BASE_PAYLOAD, "surface": "grass"}
        result = calc.calculate(payload)
        assert pytest.approx(result.sps, abs=1e-6) == 74.055


class TestHardFormulaATP:
    """ATP Hard: 0.35×sdr + 0.30×baseline + 0.20×elo + 0.15×srv_games"""

    def test_aptitude_exact(self):
        # 0.35*82 + 0.30*72 + 0.20*78.5 + 0.15*75 = 28.7+21.6+15.7+11.25 = 77.25
        payload = {**BASE_PAYLOAD, "surface": "hard"}
        result = calc.calculate(payload)
        assert pytest.approx(result.aptitude_score, abs=1e-6) == 77.25

    def test_sps_full_confidence(self):
        # SPS = 77.25*0.70 + 78.5*0.30 = 54.075 + 23.55 = 77.625
        payload = {**BASE_PAYLOAD, "surface": "hard"}
        result = calc.calculate(payload)
        assert pytest.approx(result.sps, abs=1e-6) == 77.625


# ═══════════════════════════════════════════════════════════════════════════════
# 3. CONFIDENCE PENALTY
# ═══════════════════════════════════════════════════════════════════════════════

class TestConfidencePenalty:

    def test_penalty_applied_below_5_matches(self):
        payload = {**BASE_PAYLOAD, "matches_played_on_surface": 3}
        result = calc.calculate(payload)
        assert result.confidence_full is False
        # 70.52 * 0.85 = 59.942
        assert pytest.approx(result.sps, abs=1e-6) == 70.52 * (1 - _CONFIDENCE_PENALTY)

    def test_no_penalty_at_exactly_5_matches(self):
        payload = {**BASE_PAYLOAD, "matches_played_on_surface": 5}
        assert calc.calculate(payload).confidence_full is True

    def test_penalty_at_4_matches(self):
        payload = {**BASE_PAYLOAD, "matches_played_on_surface": 4}
        assert calc.calculate(payload).confidence_full is False

    def test_penalty_at_0_matches(self):
        payload = {**BASE_PAYLOAD, "matches_played_on_surface": 0}
        result = calc.calculate(payload)
        assert result.confidence_full is False
        assert result.sps > 0  # elo floor keeps score > 0

    def test_penalized_score_lower_than_full(self):
        full = calc.calculate(BASE_PAYLOAD).sps
        low  = calc.calculate({**BASE_PAYLOAD, "matches_played_on_surface": 2}).sps
        assert low < full

    def test_penalty_magnitude(self):
        full = calc.calculate(BASE_PAYLOAD).sps
        low  = calc.calculate({**BASE_PAYLOAD, "matches_played_on_surface": 2}).sps
        assert pytest.approx(low / full, abs=1e-6) == (1 - _CONFIDENCE_PENALTY)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. WTA CIRCUIT ADJUSTMENTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestWTAAdjustments:

    def test_wta_clay_aptitude_differs_from_atp(self):
        atp = calc.calculate(BASE_PAYLOAD).aptitude_score
        wta = calc.calculate({**BASE_PAYLOAD, "circuit": "WTA"}).aptitude_score
        assert atp != wta

    def test_wta_clay_aptitude_exact(self):
        # WTA clay: 0.40*68 + 0.25*70 + 0.20*60 + 0.15*72 = 27.2+17.5+12+10.8 = 67.5
        result = calc.calculate({**BASE_PAYLOAD, "circuit": "WTA"})
        assert pytest.approx(result.aptitude_score, abs=1e-6) == 67.5

    def test_wta_grass_aptitude_differs_from_atp(self):
        payload = {**BASE_PAYLOAD, "surface": "grass"}
        atp = calc.calculate(payload).aptitude_score
        wta = calc.calculate({**payload, "circuit": "WTA"}).aptitude_score
        assert atp != wta

    def test_wta_hard_aptitude_exact(self):
        # WTA hard: 0.40*82 + 0.30*72 + 0.20*78.5 + 0.10*75 = 32.8+21.6+15.7+7.5 = 77.6
        payload = {**BASE_PAYLOAD, "surface": "hard", "circuit": "WTA"}
        result = calc.calculate(payload)
        assert pytest.approx(result.aptitude_score, abs=1e-6) == 77.6

    def test_wta_sps_in_valid_range(self):
        for surface in ("clay", "grass", "hard"):
            payload = {**BASE_PAYLOAD, "surface": surface, "circuit": "WTA"}
            sps = calc.calculate(payload).sps
            assert 0.0 <= sps <= 100.0, f"SPS {sps} out of range for WTA {surface}"


# ═══════════════════════════════════════════════════════════════════════════════
# 5. CASE SENSITIVITY (fixes: HIGH bugs)
# ═══════════════════════════════════════════════════════════════════════════════

class TestCaseSensitivity:

    @pytest.mark.parametrize("surface_input", ["Clay", "CLAY", "cLaY"])
    def test_surface_case_insensitive(self, surface_input):
        payload = {**BASE_PAYLOAD, "surface": surface_input}
        result = calc.calculate(payload)
        assert result.surface == "clay"
        assert result.sps > 0

    @pytest.mark.parametrize("circuit_input", ["wta", "Wta", "WTA"])
    def test_circuit_case_insensitive(self, circuit_input):
        payload = {**BASE_PAYLOAD, "circuit": circuit_input}
        result = calc.calculate(payload)
        assert result.circuit == "WTA"

    def test_atp_lowercase_accepted(self):
        payload = {**BASE_PAYLOAD, "circuit": "atp"}
        result = calc.calculate(payload)
        assert result.circuit == "ATP"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. INPUT VALIDATION (fixes: HIGH bugs + MEDIUM bounds check)
# ═══════════════════════════════════════════════════════════════════════════════

class TestInputValidation:

    def test_invalid_surface_raises(self):
        with pytest.raises(ValueError, match="surface"):
            calc.calculate({**BASE_PAYLOAD, "surface": "carpet"})

    def test_invalid_circuit_raises(self):
        with pytest.raises(ValueError, match="circuit"):
            calc.calculate({**BASE_PAYLOAD, "circuit": "ITF"})

    def test_negative_matches_raises(self):
        with pytest.raises(ValueError, match="matches_played_on_surface"):
            calc.calculate({**BASE_PAYLOAD, "matches_played_on_surface": -1})

    def test_missing_surface_key_raises(self):
        payload = {k: v for k, v in BASE_PAYLOAD.items() if k != "surface"}
        with pytest.raises(KeyError):
            calc.calculate(payload)

    def test_missing_metric_key_raises(self):
        m = {k: v for k, v in BASE_METRICS.items() if k != "elo_recent"}
        with pytest.raises(KeyError, match="elo_recent"):
            calc.calculate({**BASE_PAYLOAD, "metrics": m})

    def test_none_metric_value_raises(self):
        m = {**BASE_METRICS, "elo_recent": None}
        with pytest.raises(ValueError, match="elo_recent"):
            calc.calculate({**BASE_PAYLOAD, "metrics": m})

    def test_out_of_range_high_raises(self):
        m = {**BASE_METRICS, "elo_recent": 150.0}
        with pytest.raises(ValueError, match="range"):
            calc.calculate({**BASE_PAYLOAD, "metrics": m})

    def test_out_of_range_negative_raises(self):
        m = {**BASE_METRICS, "sdr": -5.0}
        with pytest.raises(ValueError, match="range"):
            calc.calculate({**BASE_PAYLOAD, "metrics": m})

    def test_metric_value_100_accepted(self):
        m = {**BASE_METRICS, "elo_recent": 100.0}
        result = calc.calculate({**BASE_PAYLOAD, "metrics": m})
        assert result.sps <= 100.0

    def test_metric_value_0_accepted(self):
        m = {k: 0.0 for k in BASE_METRICS}
        result = calc.calculate({**BASE_PAYLOAD, "metrics": m})
        assert result.sps == 0.0

    def test_metrics_is_none_raises(self):
        with pytest.raises(TypeError, match="metrics"):
            calc.calculate({**BASE_PAYLOAD, "metrics": None})

    def test_non_numeric_metric_raises(self):
        m = {**BASE_METRICS, "bp_saved": "seventy"}
        with pytest.raises(ValueError, match="bp_saved"):
            calc.calculate({**BASE_PAYLOAD, "metrics": m})

    def test_string_numeric_metric_accepted(self):
        # "68.5" should be coerced to float
        m = {**BASE_METRICS, "elo_recent": "78.5"}
        result = calc.calculate({**BASE_PAYLOAD, "metrics": m})
        assert result.sps > 0


# ═══════════════════════════════════════════════════════════════════════════════
# 7. PYDANTIC-LIKE INPUT (duck-typing via model_dump)
# ═══════════════════════════════════════════════════════════════════════════════

class TestPydanticDuckTyping:

    def test_model_dump_v2_coercion(self):
        class FakePydanticV2:
            def model_dump(self):
                return BASE_PAYLOAD

        result = calc.calculate(FakePydanticV2())
        assert result.sps > 0

    def test_dict_v1_coercion(self):
        class FakePydanticV1:
            def dict(self):
                return BASE_PAYLOAD

        result = calc.calculate(FakePydanticV1())
        assert result.sps > 0

    def test_invalid_type_raises(self):
        with pytest.raises(TypeError, match="Expected dict"):
            calc.calculate([1, 2, 3])


# ═══════════════════════════════════════════════════════════════════════════════
# 8. SERIALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestSerialization:

    def test_serialize_keys_present(self):
        s = calc.calculate(BASE_PAYLOAD).serialize()
        assert set(s.keys()) == {
            "player_id", "surface", "circuit",
            "aptitude_score", "sps", "confidence_full", "matches_played"
        }

    def test_serialize_types(self):
        s = calc.calculate(BASE_PAYLOAD).serialize()
        assert isinstance(s["player_id"],      str)
        assert isinstance(s["surface"],        str)
        assert isinstance(s["circuit"],        str)
        assert isinstance(s["aptitude_score"], float)
        assert isinstance(s["sps"],            float)
        assert isinstance(s["confidence_full"],bool)
        assert isinstance(s["matches_played"], int)

    def test_serialize_rounds_to_2_decimals(self):
        s = calc.calculate(BASE_PAYLOAD).serialize()
        # repr trick: round(x, 2) should have at most 2 decimal places
        str_sps = str(s["sps"]).rstrip("0")
        decimal_places = len(str_sps.split(".")[-1]) if "." in str_sps else 0
        assert decimal_places <= 2

    def test_sps_bounded_0_100(self):
        s = calc.calculate(BASE_PAYLOAD).serialize()
        assert 0.0 <= s["sps"] <= 100.0

    def test_calculate_score_equals_serialized_sps(self):
        s = calc.calculate(BASE_PAYLOAD).serialize()
        score = calc.calculate_score(BASE_PAYLOAD)
        assert score == s["sps"]

    def test_double_rounding_idempotent(self):
        # Rounding an already-2-decimal float again must not change value
        result = calc.calculate(BASE_PAYLOAD)
        s1 = result.serialize()
        s2 = result.serialize()
        assert s1["sps"] == s2["sps"]


# ═══════════════════════════════════════════════════════════════════════════════
# 9. BOUNDARY / EXTREME VALUES
# ═══════════════════════════════════════════════════════════════════════════════

class TestBoundaryValues:

    def test_all_metrics_max_sps_at_most_100(self):
        m = {k: 100.0 for k in BASE_METRICS}
        for surface in ("clay", "grass", "hard"):
            payload = {**BASE_PAYLOAD, "surface": surface, "metrics": m}
            sps = calc.calculate(payload).sps
            assert sps <= 100.0, f"SPS {sps} > 100 for {surface}"

    def test_all_metrics_zero_sps_is_zero(self):
        m = {k: 0.0 for k in BASE_METRICS}
        for surface in ("clay", "grass", "hard"):
            payload = {**BASE_PAYLOAD, "surface": surface, "metrics": m}
            assert calc.calculate(payload).sps == 0.0

    def test_player_id_preserved(self):
        payload = {**BASE_PAYLOAD, "player_id": "abc-999"}
        assert calc.calculate(payload).player_id == "abc-999"

    def test_missing_player_id_defaults(self):
        payload = {k: v for k, v in BASE_PAYLOAD.items() if k != "player_id"}
        result = calc.calculate(payload)
        assert result.player_id == "unknown"

    def test_missing_circuit_defaults_to_atp(self):
        payload = {k: v for k, v in BASE_PAYLOAD.items() if k != "circuit"}
        result = calc.calculate(payload)
        assert result.circuit == "ATP"


# ═══════════════════════════════════════════════════════════════════════════════
# 11. PENALTY MODE — binary (default) vs progressive (opt-in W4 fix)
# ═══════════════════════════════════════════════════════════════════════════════

class TestPenaltyMode:
    """Confidence penalty: binary (default, v1.0 behavior) vs progressive (linear ramp)."""

    def test_default_mode_is_binary(self):
        c = SurfacePowerScoreCalculator()
        assert c.penalty_mode == "binary"

    def test_invalid_penalty_mode_raises(self):
        with pytest.raises(ValueError, match="penalty_mode must be"):
            SurfacePowerScoreCalculator(penalty_mode="quadratic")  # type: ignore[arg-type]

    @pytest.mark.parametrize("matches", [0, 1, 2, 3, 4])
    def test_binary_applies_full_malus_below_threshold(self, matches):
        c = SurfacePowerScoreCalculator(penalty_mode="binary")
        payload = {**BASE_PAYLOAD, "matches_played_on_surface": matches}
        assert c._compute_penalty_factor(matches) == pytest.approx(0.85)
        result = c.calculate(payload)
        assert not result.confidence_full

    @pytest.mark.parametrize("matches", [5, 6, 12, 100])
    def test_binary_no_malus_at_or_above_threshold(self, matches):
        c = SurfacePowerScoreCalculator(penalty_mode="binary")
        assert c._compute_penalty_factor(matches) == 1.0

    @pytest.mark.parametrize(
        "matches,expected_factor",
        [
            (0, 0.85),   # full malus at 0 matches
            (1, 0.88),   # 1.0 - 0.15 * (4/5) = 0.88
            (2, 0.91),   # 1.0 - 0.15 * (3/5) = 0.91
            (3, 0.94),   # 1.0 - 0.15 * (2/5) = 0.94
            (4, 0.97),   # 1.0 - 0.15 * (1/5) = 0.97
            (5, 1.00),   # full confidence at threshold
            (12, 1.00),  # full confidence above threshold
        ],
    )
    def test_progressive_linear_ramp(self, matches, expected_factor):
        c = SurfacePowerScoreCalculator(penalty_mode="progressive")
        assert c._compute_penalty_factor(matches) == pytest.approx(expected_factor)

    def test_progressive_softer_than_binary_for_4_matches(self):
        binary = SurfacePowerScoreCalculator(penalty_mode="binary")
        progressive = SurfacePowerScoreCalculator(penalty_mode="progressive")
        payload = {**BASE_PAYLOAD, "matches_played_on_surface": 4}
        # 4 matches: progressive should yield higher SPS than binary (softer penalty)
        assert progressive.calculate(payload).sps > binary.calculate(payload).sps


# ═══════════════════════════════════════════════════════════════════════════════
# 12. LRU CACHE on aptitude computation (R5 fix)
# ═══════════════════════════════════════════════════════════════════════════════

class TestAptitudeCache:
    """_compute_aptitude_cached memoizes by (surface, circuit, frozen PlayerMetrics)."""

    def test_cache_hit_on_repeated_call(self):
        # Reset cache to start clean
        SurfacePowerScoreCalculator._compute_aptitude_cached.cache_clear()
        for _ in range(5):
            calc.calculate(BASE_PAYLOAD)
        info = SurfacePowerScoreCalculator._compute_aptitude_cached.cache_info()
        # 1 miss (first call), 4 hits (repeats)
        assert info.misses == 1
        assert info.hits == 4

    def test_cache_distinct_keys_per_surface_circuit(self):
        SurfacePowerScoreCalculator._compute_aptitude_cached.cache_clear()
        for surface in ("clay", "grass", "hard"):
            for circuit in ("ATP", "WTA"):
                calc.calculate({**BASE_PAYLOAD, "surface": surface, "circuit": circuit})
        info = SurfacePowerScoreCalculator._compute_aptitude_cached.cache_info()
        # 6 distinct keys → 6 misses, 0 hits
        assert info.misses == 6
        assert info.hits == 0

    def test_player_metrics_is_hashable(self):
        """Frozen dataclass must be hashable for use as lru_cache key."""
        pm = PlayerMetrics(**BASE_METRICS)
        # Should not raise
        hash(pm)
        # Same content → same hash
        assert hash(pm) == hash(PlayerMetrics(**BASE_METRICS))


# ═══════════════════════════════════════════════════════════════════════════════
# 13. LOGGING hook (W3 fix)
# ═══════════════════════════════════════════════════════════════════════════════

class TestLoggingHook:
    """Module-level 'sps' logger emits DEBUG record per calculation."""

    def test_logger_emits_debug_record(self, caplog):
        import logging
        with caplog.at_level(logging.DEBUG, logger="sps"):
            calc.calculate(BASE_PAYLOAD)
        assert any("SPS calc" in rec.message for rec in caplog.records)

    def test_logger_quiet_by_default(self, caplog):
        """No log handler attached by default → caplog only sees records when level set."""
        import logging
        with caplog.at_level(logging.WARNING, logger="sps"):
            calc.calculate(BASE_PAYLOAD)
        # No WARNING-level records emitted by the module
        sps_records = [r for r in caplog.records if r.name == "sps"]
        assert not sps_records


# ═══════════════════════════════════════════════════════════════════════════════
# 14. DEMO smoke test (W2 fix)
# ═══════════════════════════════════════════════════════════════════════════════

class TestDemoSmoke:
    """Ensure `python surface_powerscore.py` __main__ block runs without error."""

    def test_demo_block_runs_clean(self):
        import subprocess
        import sys
        result = subprocess.run(
            [sys.executable, "surface_powerscore.py"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        assert result.returncode == 0, f"Demo failed: {result.stderr}"
        # Sanity: header present, all 8 scenarios printed
        assert "Scenario" in result.stdout
        assert "ATP - Clay" in result.stdout
        assert "WTA - Hard" in result.stdout
        # Serialization block printed
        assert "Serialized output" in result.stdout
