"""
surface_powerscore.py — Surface PowerScore (SPS) Calculator
ATP/WTA tennis aptitude indicator per surface at a given point in the season.

Metrics are normalized [0, 100] over the past 52 weeks on the target surface.
Output SPS is a float in [0, 100], rounded to 2 decimal places at serialization.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

Circuit = Literal["ATP", "WTA"]
Surface = Literal["clay", "grass", "hard"]
PenaltyMode = Literal["binary", "progressive"]

_MIN_MATCHES_FULL_CONFIDENCE = 5
_CONFIDENCE_PENALTY = 0.15  # 15% malus when sample < MIN_MATCHES

logger = logging.getLogger("sps")  # opt-in observability — no handler by default

# ─── Coefficient tables ────────────────────────────────────────────────────────
# Each metric maps to (ATP_weight, WTA_weight).
# WTA rule: +0.05 on return-side metric, -0.05 on service-side metric.
# All rows verified to sum to 1.00 for both circuits.
#
#   Clay  → return/baseline dominance (long rallies)
#   Grass → serve-heavy (fast surface)
#   Hard  → balanced (SDR + baseline efficiency)
# ──────────────────────────────────────────────────────────────────────────────
_SURFACE_WEIGHTS: dict[Surface, dict[str, tuple[float, float]]] = {
    "clay": {
        #                            ATP    WTA   (sum ATP=1.00, WTA=1.00)
        "return_pts_won":           (0.35, 0.40),  # WTA +0.05 — return priority on clay
        "bp_saved":                 (0.25, 0.25),
        "second_service_won":       (0.25, 0.20),  # WTA -0.05 — serve less decisive
        "baseline_efficiency":      (0.15, 0.15),
    },
    "grass": {
        #                            ATP    WTA   (sum ATP=1.00, WTA=1.00)
        "service_games_won":        (0.40, 0.35),  # WTA -0.05 — serve less dominant
        "bp_saved":                 (0.25, 0.25),
        "sdr":                      (0.20, 0.25),  # WTA +0.05 — surface dominance proxy
        "tie_breaks_won":           (0.15, 0.15),
    },
    "hard": {
        #                            ATP    WTA   (sum ATP=1.00, WTA=1.00)
        "sdr":                      (0.35, 0.40),  # WTA +0.05 — broader dominance signal
        "baseline_efficiency":      (0.30, 0.30),
        "elo_recent":               (0.20, 0.20),
        "service_games_won":        (0.15, 0.10),  # WTA -0.05
    },
}

# Ordered set of all metric keys used across any surface.
_ALL_METRIC_KEYS: tuple[str, ...] = (
    "elo_recent", "sdr", "return_pts_won", "second_service_won",
    "service_games_won", "bp_saved", "tie_breaks_won", "baseline_efficiency",
)


# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PlayerMetrics:
    """Normalized [0, 100] statistics over the last 52 weeks on the target surface."""
    elo_recent: float           # General Elo (last 3 months)
    sdr: float                  # Surface Dominance Ratio
    return_pts_won: float       # % return points won
    second_service_won: float   # % points won on 2nd serve
    service_games_won: float    # % service games held
    bp_saved: float             # % break points saved
    tie_breaks_won: float       # % tie-breaks won
    baseline_efficiency: float  # Baseline rally efficiency

    def to_dict(self) -> dict[str, float]:
        """Explicit field extraction — safe against future dataclass changes."""
        return {
            "elo_recent":          self.elo_recent,
            "sdr":                 self.sdr,
            "return_pts_won":      self.return_pts_won,
            "second_service_won":  self.second_service_won,
            "service_games_won":   self.service_games_won,
            "bp_saved":            self.bp_saved,
            "tie_breaks_won":      self.tie_breaks_won,
            "baseline_efficiency": self.baseline_efficiency,
        }


@dataclass(frozen=True)
class SPSResult:
    """Full output of a Surface PowerScore calculation. Stores raw (unrounded) floats."""
    player_id: str
    surface: Surface
    circuit: Circuit
    aptitude_score: float   # Intermediate surface-specific weighted score (raw)
    sps: float              # Final Surface PowerScore (raw, clamp [0,100])
    confidence_full: bool   # True when matches_played >= MIN_MATCHES_FULL_CONFIDENCE
    matches_played: int

    def serialize(self) -> dict:
        """Return a JSON-serializable dict. Rounding to 2 decimals happens only here."""
        return {
            "player_id":       self.player_id,
            "surface":         self.surface,
            "circuit":         self.circuit,
            "aptitude_score":  round(self.aptitude_score, 2),
            "sps":             round(self.sps, 2),
            "confidence_full": self.confidence_full,
            "matches_played":  self.matches_played,
        }


# ─── Calculator ───────────────────────────────────────────────────────────────

class SurfacePowerScoreCalculator:
    """
    Compute the Surface PowerScore (SPS) for a tennis player on a given surface.

    SPS formula
    -----------
    aptitude  = weighted sum of surface-specific metrics (weights in _SURFACE_WEIGHTS)
    SPS_raw   = (aptitude × 0.70) + (elo_recent × 0.30)
    SPS_final = SPS_raw × (1 - penalty)   if matches_played < MIN_MATCHES

    Confidence penalty modes
    ------------------------
    - 'binary'      (default): full 15% malus once matches < 5, else 0.
                    Backward compatible with v1.0 behavior — DG-arbitrated default.
    - 'progressive': linear ramp `penalty = max(0, (MIN-matches)/MIN) × 0.15`.
                    Smoother edge (4 matches gets less malus than 0 matches).

    When matches_played < 5 the penalty is applied to SPS_raw *as a whole*
    (including the elo_recent component). This means a player with thin surface history
    is penalized holistically — we are less confident in the entire estimate, not just
    the surface-specific component. elo_recent does not act as a hard floor; it merely
    ensures the score does not collapse to zero for players new to a surface.

    Note on hard surface: `elo_recent` contributes to BOTH the aptitude term
    (weight 0.20) AND the final blend (weight 0.30). On hard surface the effective
    elo weight is therefore 0.20 × 0.70 + 0.30 = 0.44 vs 0.30 on clay/grass.
    This is a deliberate spec choice — hard surface is the most "generalist" of
    the three, so general Elo carries more signal there.
    """

    MIN_MATCHES: int = _MIN_MATCHES_FULL_CONFIDENCE
    CONFIDENCE_PENALTY: float = _CONFIDENCE_PENALTY

    def __init__(self, penalty_mode: PenaltyMode = "binary") -> None:
        if penalty_mode not in ("binary", "progressive"):
            raise ValueError(
                f"penalty_mode must be 'binary' or 'progressive', got {penalty_mode!r}."
            )
        self.penalty_mode: PenaltyMode = penalty_mode

    def _compute_penalty_factor(self, matches_played: int) -> float:
        """Return the multiplier applied to SPS_raw given the current penalty mode."""
        if matches_played >= self.MIN_MATCHES:
            return 1.0
        if self.penalty_mode == "binary":
            return 1.0 - self.CONFIDENCE_PENALTY
        # progressive: linear ramp from full malus at 0 matches to 0 malus at MIN
        ramp = (self.MIN_MATCHES - matches_played) / self.MIN_MATCHES
        return 1.0 - (self.CONFIDENCE_PENALTY * ramp)

    # ── Input validation ───────────────────────────────────────────────────────

    @staticmethod
    def _coerce_input(data: object) -> dict:
        """Accept plain dict or Pydantic model (model_dump). Raises TypeError otherwise."""
        if isinstance(data, dict):
            return data
        if hasattr(data, "model_dump"):          # Pydantic v2
            return data.model_dump()
        if hasattr(data, "dict"):                # Pydantic v1
            return data.dict()
        raise TypeError(
            f"Expected dict or Pydantic model, got {type(data).__name__}."
        )

    @staticmethod
    def _validate_metrics(raw: object) -> dict[str, float]:
        """
        Validate and coerce the metrics sub-dict.
        - All 8 keys must be present.
        - All values must be numeric and in [0, 100].
        """
        if not isinstance(raw, dict):
            raise TypeError(f"'metrics' must be a dict, got {type(raw).__name__}.")

        result: dict[str, float] = {}
        for key in _ALL_METRIC_KEYS:
            if key not in raw:
                raise KeyError(f"Missing required metric key: '{key}'.")
            val = raw[key]
            if val is None:
                raise ValueError(f"Metric '{key}' is None; must be a float in [0, 100].")
            try:
                val = float(val)
            except (TypeError, ValueError):
                raise ValueError(
                    f"Metric '{key}' = {raw[key]!r} cannot be converted to float."
                )
            if not (0.0 <= val <= 100.0):
                raise ValueError(
                    f"Metric '{key}' = {val} is out of range. Expected [0, 100]."
                )
            result[key] = val
        return result

    def _parse_input(
        self, data: object
    ) -> tuple[str, Surface, Circuit, PlayerMetrics, int]:
        """Validate and unpack input (dict or Pydantic model) into typed components."""
        data = self._coerce_input(data)

        # Surface — normalize to lowercase for case-insensitive callers
        if "surface" not in data:
            raise KeyError("Missing required key: 'surface'.")
        surface_str = str(data["surface"]).strip().lower()
        if surface_str not in _SURFACE_WEIGHTS:
            raise ValueError(
                f"Unknown surface '{surface_str}'. Valid values: clay, grass, hard."
            )
        surface: Surface = surface_str  # type: ignore[assignment]

        # Circuit — normalize to uppercase; default ATP
        circuit_raw = str(data.get("circuit", "ATP")).strip().upper()
        if circuit_raw not in ("ATP", "WTA"):
            raise ValueError(
                f"Unknown circuit '{circuit_raw}'. Valid values: ATP, WTA."
            )
        circuit: Circuit = circuit_raw  # type: ignore[assignment]

        # Metrics
        metrics_raw = data.get("metrics")
        coerced = self._validate_metrics(metrics_raw)
        metrics = PlayerMetrics(
            elo_recent=coerced["elo_recent"],
            sdr=coerced["sdr"],
            return_pts_won=coerced["return_pts_won"],
            second_service_won=coerced["second_service_won"],
            service_games_won=coerced["service_games_won"],
            bp_saved=coerced["bp_saved"],
            tie_breaks_won=coerced["tie_breaks_won"],
            baseline_efficiency=coerced["baseline_efficiency"],
        )

        # Matches played
        try:
            matches_played = int(data.get("matches_played_on_surface", 0))
        except (TypeError, ValueError):
            raise ValueError(
                f"'matches_played_on_surface' must be an integer, "
                f"got {data.get('matches_played_on_surface')!r}."
            )
        if matches_played < 0:
            raise ValueError(
                f"'matches_played_on_surface' must be >= 0, got {matches_played}."
            )

        player_id = str(data.get("player_id", "unknown"))
        return player_id, surface, circuit, metrics, matches_played

    # ── Core computation ───────────────────────────────────────────────────────

    @staticmethod
    @lru_cache(maxsize=1024)
    def _compute_aptitude_cached(
        surface: Surface,
        circuit: Circuit,
        metrics: PlayerMetrics,
    ) -> float:
        """
        Pure cached core — keyed on (surface, circuit, frozen metrics).
        PlayerMetrics is a frozen dataclass → hashable, safe as lru_cache key.
        """
        weight_idx = 0 if circuit == "ATP" else 1
        metric_dict = metrics.to_dict()
        return sum(
            metric_dict[key] * weights[weight_idx]
            for key, weights in _SURFACE_WEIGHTS[surface].items()
        )

    def _compute_aptitude(
        self, surface: Surface, metrics: PlayerMetrics, circuit: Circuit
    ) -> float:
        """
        Apply the surface-specific weighted formula.
        Returns the raw aptitude score (not rounded, not blended with elo).
        Memoized via _compute_aptitude_cached for repeated payloads.
        """
        return self._compute_aptitude_cached(surface, circuit, metrics)

    # ── Public API ─────────────────────────────────────────────────────────────

    def calculate(self, data: object) -> SPSResult:
        """
        Full calculation returning an SPSResult with raw intermediate values.

        Args:
            data: Input dict or Pydantic model matching the module schema.

        Returns:
            SPSResult — call .serialize() for a JSON-ready dict,
            or access .sps for the raw float.
        """
        player_id, surface, circuit, metrics, matches_played = self._parse_input(data)

        aptitude = self._compute_aptitude(surface, metrics, circuit)

        # Blend surface aptitude (70%) with global Elo form (30%).
        sps_raw = (aptitude * 0.70) + (metrics.elo_recent * 0.30)

        # Confidence penalty (mode-aware — see class docstring).
        confidence_full = matches_played >= self.MIN_MATCHES
        penalty_factor = self._compute_penalty_factor(matches_played)
        sps_raw *= penalty_factor

        sps = min(max(sps_raw, 0.0), 100.0)   # clamp; rounding deferred to serialize()

        logger.debug(
            "SPS calc | player=%s surface=%s circuit=%s matches=%d "
            "aptitude=%.4f sps_raw=%.4f penalty=%.4f sps=%.4f mode=%s",
            player_id, surface, circuit, matches_played,
            aptitude, sps_raw / penalty_factor if penalty_factor else 0.0,
            penalty_factor, sps, self.penalty_mode,
        )

        return SPSResult(
            player_id=player_id,
            surface=surface,
            circuit=circuit,
            aptitude_score=aptitude,           # raw, unrounded
            sps=sps,                           # raw, unrounded
            confidence_full=confidence_full,
            matches_played=matches_played,
        )

    def calculate_score(self, data: object) -> float:
        """
        Convenience method — returns only the final SPS float, rounded to 2 decimals.

        Args:
            data: Input dict or Pydantic model matching the module schema.

        Returns:
            SPS as a float in [0, 100], rounded to 2 decimal places.
        """
        return round(self.calculate(data).sps, 2)


# ─── Demo ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    calc = SurfacePowerScoreCalculator()

    BASE_METRICS = {
        "elo_recent": 78.5,
        "sdr": 82.0,
        "return_pts_won": 68.0,
        "second_service_won": 60.0,
        "service_games_won": 75.0,
        "bp_saved": 70.0,
        "tie_breaks_won": 55.0,
        "baseline_efficiency": 72.0,
    }

    scenarios = [
        ("ATP - Clay  (full confidence)",   "clay",  12, "ATP"),
        ("ATP - Grass (low  confidence)",   "grass",  3, "ATP"),
        ("ATP - Hard  (full confidence)",   "hard",  20, "ATP"),
        ("WTA - Clay  (full confidence)",   "clay",  10, "WTA"),
        ("WTA - Grass (low  confidence)",   "grass",  2, "WTA"),
        ("WTA - Hard  (full confidence)",   "hard",  15, "WTA"),
        # Case-insensitivity smoke tests
        ("ATP - Clay  (uppercase SURFACE)", "CLAY",  12, "ATP"),
        ("WTA - Hard  (lowercase circuit)", "hard",  15, "wta"),
    ]

    col = f"{'Scenario':<46} {'Aptitude':>10} {'SPS':>8} {'Conf':>8} {'Matches':>8}"
    print(col)
    print("-" * len(col))

    for label, surface, matches, circuit in scenarios:
        payload = {
            "player_id": "12345",
            "surface": surface,
            "circuit": circuit,
            "metrics": BASE_METRICS,
            "matches_played_on_surface": matches,
        }
        result = calc.calculate(payload)
        conf_label = "Full ok" if result.confidence_full else "Low  !!"
        print(
            f"{label:<46} {result.aptitude_score:>10.2f} {result.sps:>8.2f}"
            f" {conf_label:>8} {result.matches_played:>8}"
        )

    # Serialization demo
    print("\n--- Serialized output (WTA / Clay / full confidence) ---")
    payload = {
        "player_id": "12345",
        "surface": "clay",
        "circuit": "WTA",
        "metrics": BASE_METRICS,
        "matches_played_on_surface": 10,
    }
    print(json.dumps(calc.calculate(payload).serialize(), indent=2))
