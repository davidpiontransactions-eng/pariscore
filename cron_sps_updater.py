"""
cron_sps_updater.py — Surface PowerScore (SPS) automation pipeline

Runs every 12h via cron. For each tennis match scheduled in the next 24-36h:
  1. Fetch upcoming matches (ATP/WTA) from PariScore HTTP API (server.js).
  2. For each player+surface pair, compute 52-week rolling metrics from the
     local SQLite (`tennis_matches_internal`) and merge cached Tennis Abstract
     metrics from `tennis_ta_cache`.
  3. Run `SurfacePowerScoreCalculator.calculate()` per player.
  4. UPSERT result into `player_surface_scores` (PK: player_id+surface+match_id).

Design notes
------------
- Stdlib only (sqlite3, urllib, logging, threading, dataclasses, json, time).
- Adapter pattern: `MatchSource` and `PlayerStatsSource` are pluggable.
- Rate limited via per-host token bucket (default 5 req/s).
- Parallel player fetches via ThreadPoolExecutor (default 4 workers).
- Idempotent: re-runs overwrite previous SPS for the same (player, surface, match).
- Exit codes: 0=success, 1=fatal config error, 2=partial failure (some matches skipped).

Crontab snippet at the bottom of this file.
"""

from __future__ import annotations

import json
import logging
import logging.handlers
import os
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Iterable, Literal, Optional
from urllib import error as urlerr
from urllib import request as urlreq

from surface_powerscore import (
    PlayerMetrics,
    SPSResult,
    SurfacePowerScoreCalculator,
)

# ─── Config ───────────────────────────────────────────────────────────────────

DB_PATH: str = os.environ.get("PARISCORE_DB_PATH", "pariscore.db")
API_URL: str = os.environ.get(
    "PARISCORE_API_URL",
    "http://localhost:3000/api/v1/tennis/upcoming",
)
HTTP_TIMEOUT_S: float = float(os.environ.get("PARISCORE_HTTP_TIMEOUT", "10.0"))
RATE_LIMIT_RPS: float = float(os.environ.get("PARISCORE_RATE_LIMIT_RPS", "5.0"))
DB_RATE_LIMIT_RPS: float = float(os.environ.get("PARISCORE_DB_RATE_LIMIT_RPS", "50.0"))
WORKER_COUNT: int = int(os.environ.get("PARISCORE_WORKERS", "4"))
PENALTY_MODE: Literal["binary", "progressive"] = (
    "progressive"
    if os.environ.get("PARISCORE_SPS_PENALTY", "binary") == "progressive"
    else "binary"
)
WINDOW_DAYS: int = 365  # 52 weeks rolling window
LOOKAHEAD_HOURS_MIN: int = int(os.environ.get("PARISCORE_LOOKAHEAD_MIN", "24"))
LOOKAHEAD_HOURS_MAX: int = int(os.environ.get("PARISCORE_LOOKAHEAD_MAX", "36"))
DRY_RUN: bool = os.environ.get("PARISCORE_SPS_DRY_RUN", "0") not in ("0", "", "false", "False")

LOG_PATH: str = os.environ.get("PARISCORE_LOG_PATH", "logs/sps_updater.log")
LOG_LEVEL: str = os.environ.get("PARISCORE_LOG_LEVEL", "INFO")


# ─── Logging ──────────────────────────────────────────────────────────────────

def _setup_logging() -> logging.Logger:
    """Configure root logger with rotating file handler + stderr stream."""
    log = logging.getLogger("sps_updater")
    log.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    log.propagate = False

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Stderr stream — visible in cron mail / docker logs
    stream = logging.StreamHandler(stream=sys.stderr)
    stream.setFormatter(fmt)
    log.addHandler(stream)

    # Rotating file
    try:
        os.makedirs(os.path.dirname(LOG_PATH) or ".", exist_ok=True)
        rotating = logging.handlers.RotatingFileHandler(
            LOG_PATH, maxBytes=2_000_000, backupCount=5, encoding="utf-8"
        )
        rotating.setFormatter(fmt)
        log.addHandler(rotating)
    except OSError as e:
        log.warning("Cannot open log file %s: %s — stderr only.", LOG_PATH, e)

    return log


logger = _setup_logging()


# ─── Rate limiter ─────────────────────────────────────────────────────────────

class RateLimiter:
    """Thread-safe token-bucket limiter. Blocks acquire() if no token available."""

    def __init__(self, rate_per_second: float) -> None:
        self._min_interval = 1.0 / max(rate_per_second, 0.1)
        self._lock = threading.Lock()
        self._next_slot = 0.0

    def acquire(self) -> None:
        with self._lock:
            now = time.monotonic()
            wait = self._next_slot - now
            if wait > 0:
                time.sleep(wait)
                now = time.monotonic()
            self._next_slot = now + self._min_interval


# Two distinct limiters (W7 fix):
#   _HTTP_LIMITER → external HTTP fetches (server.js API, future TA scrapes)
#   _DB_LIMITER   → local SQLite reads in worker threads (much higher RPS)
_HTTP_LIMITER = RateLimiter(RATE_LIMIT_RPS)
_DB_LIMITER = RateLimiter(DB_RATE_LIMIT_RPS)


# ─── Dataclasses ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class UpcomingMatch:
    match_id: str
    surface: Literal["clay", "grass", "hard"]
    circuit: Literal["ATP", "WTA"]
    player_a_id: str
    player_b_id: str
    kickoff_utc: datetime


@dataclass
class PlayerAggregate:
    """Raw 52-week aggregate from tennis_matches_internal — pre-normalization."""
    matches_played: int = 0
    svpt: int = 0           # service points
    first_in: int = 0
    first_won: int = 0
    second_won: int = 0
    svc_games: int = 0      # service games played
    bp_saved: int = 0
    bp_faced: int = 0
    # Opponent (return-side) view — accumulated from opposite player's svc
    opp_svpt: int = 0
    opp_first_won: int = 0
    opp_second_won: int = 0
    # Match outcome
    wins: int = 0
    losses: int = 0
    # Tie breaks parsed from score string (best-effort)
    tb_won: int = 0
    tb_lost: int = 0


@dataclass(frozen=True)
class PipelineStats:
    matches_seen: int = 0
    players_processed: int = 0
    players_skipped: int = 0
    sps_written: int = 0
    errors: int = 0


# ─── Match source: HTTP API to PariScore server.js ────────────────────────────

class MatchSourceError(RuntimeError):
    pass


def fetch_upcoming_matches(
    api_url: str = API_URL,
    lookahead_min_h: int = LOOKAHEAD_HOURS_MIN,
    lookahead_max_h: int = LOOKAHEAD_HOURS_MAX,
) -> list[UpcomingMatch]:
    """
    Fetch tennis matches scheduled in the next [min_h, max_h] hours.

    Expected JSON schema from server.js:
        { "matches": [
            { "id": "...", "surface": "clay", "tour": "ATP",
              "home_player_id": "...", "away_player_id": "...",
              "commence_time": "2026-05-28T13:00:00Z" }, ... ] }

    Raises MatchSourceError if the API is unreachable or returns invalid data.
    """
    _HTTP_LIMITER.acquire()
    req = urlreq.Request(api_url, headers={"User-Agent": "sps-updater/1.0"})
    try:
        with urlreq.urlopen(req, timeout=HTTP_TIMEOUT_S) as resp:
            if resp.status != 200:
                raise MatchSourceError(f"HTTP {resp.status} from {api_url}")
            payload = json.loads(resp.read().decode("utf-8"))
    except (urlerr.URLError, urlerr.HTTPError, TimeoutError, json.JSONDecodeError) as e:
        raise MatchSourceError(f"Cannot fetch upcoming matches: {e}") from e

    raw_matches = payload.get("matches") if isinstance(payload, dict) else payload
    if not isinstance(raw_matches, list):
        raise MatchSourceError(f"Invalid payload shape from {api_url}")

    now = datetime.now(timezone.utc)
    lo = now + timedelta(hours=lookahead_min_h)
    hi = now + timedelta(hours=lookahead_max_h)

    out: list[UpcomingMatch] = []
    for m in raw_matches:
        try:
            ko = _parse_iso(m["commence_time"])
        except (KeyError, ValueError):
            logger.debug("Skipping match — bad commence_time: %r", m)
            continue
        if not (lo <= ko <= hi):
            continue

        surface = str(m.get("surface", "")).strip().lower()
        if surface not in ("clay", "grass", "hard"):
            logger.debug("Skipping match %s — unknown surface %r", m.get("id"), surface)
            continue

        circuit_raw = str(m.get("tour") or m.get("circuit") or "ATP").upper()
        circuit: Literal["ATP", "WTA"] = "WTA" if circuit_raw == "WTA" else "ATP"

        pa = m.get("home_player_id") or m.get("player_a_id")
        pb = m.get("away_player_id") or m.get("player_b_id")
        if not pa or not pb:
            logger.debug("Skipping match %s — missing player IDs", m.get("id"))
            continue

        out.append(UpcomingMatch(
            match_id=str(m.get("id") or m.get("match_id")),
            surface=surface,  # type: ignore[arg-type]
            circuit=circuit,
            player_a_id=str(pa),
            player_b_id=str(pb),
            kickoff_utc=ko,
        ))
    return out


def _parse_iso(s: str) -> datetime:
    """Parse ISO 8601 with optional Z suffix → aware UTC datetime."""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ─── Player stats source: SQLite rolling aggregator ───────────────────────────

class PlayerStatsSource:
    """Compute 52-week rolling metrics for a given player+surface from SQLite."""

    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path

    def fetch_aggregate(
        self,
        player_id: str,
        surface: str,
        end_date: datetime,
        window_days: int = WINDOW_DAYS,
    ) -> PlayerAggregate:
        """
        Aggregate raw match stats for player_id on `surface` over the past
        `window_days` ending at `end_date`. Returns a PlayerAggregate (raw sums).
        """
        start_ms = int((end_date - timedelta(days=window_days)).timestamp() * 1000)
        end_ms = int(end_date.timestamp() * 1000)
        try:
            player_id_int = int(player_id)
        except ValueError:
            logger.warning("Non-numeric player_id %r — aggregate empty.", player_id)
            return PlayerAggregate()

        agg = PlayerAggregate()

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            # Wins (player was winner)
            cur.execute(
                """
                SELECT w_svpt, w_1stIn, w_1stWon, w_2ndWon, w_SvGms,
                       w_bpSaved, w_bpFaced,
                       l_svpt,  l_1stWon, l_2ndWon, score
                  FROM tennis_matches_internal
                 WHERE winner_player_id = ?
                   AND LOWER(surface) = ?
                   AND match_date BETWEEN ? AND ?
                """,
                (player_id_int, surface.lower(), start_ms, end_ms),
            )
            for row in cur.fetchall():
                agg.wins += 1
                _accumulate_player(agg, row, prefix_player="w", prefix_opp="l")

            # Losses (player was loser)
            cur.execute(
                """
                SELECT l_svpt, l_1stIn, l_1stWon, l_2ndWon, l_SvGms,
                       l_bpSaved, l_bpFaced,
                       w_svpt,  w_1stWon, w_2ndWon, score
                  FROM tennis_matches_internal
                 WHERE loser_player_id = ?
                   AND LOWER(surface) = ?
                   AND match_date BETWEEN ? AND ?
                """,
                (player_id_int, surface.lower(), start_ms, end_ms),
            )
            for row in cur.fetchall():
                agg.losses += 1
                _accumulate_player(agg, row, prefix_player="l", prefix_opp="w")

        agg.matches_played = agg.wins + agg.losses
        return agg

    def fetch_elo(self, player_id: str, circuit: str) -> Optional[float]:
        """Return raw Elo rating for player. None if not found."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT elo_rating FROM tennis_players_elo
                     WHERE player_id = ? AND UPPER(COALESCE(circuit,'')) = ?
                     ORDER BY updated_at DESC LIMIT 1
                    """,
                    (str(player_id), circuit.upper()),
                )
                row = cur.fetchone()
                return float(row[0]) if row and row[0] is not None else None
        except sqlite3.Error as e:
            logger.warning("Elo lookup failed for %s/%s: %s", player_id, circuit, e)
            return None

    def fetch_overall_aggregate(
        self,
        player_id: str,
        end_date: datetime,
        window_days: int = WINDOW_DAYS,
    ) -> tuple[int, int]:
        """Return (wins, total_matches) across ALL surfaces for SDR computation."""
        try:
            player_id_int = int(player_id)
        except ValueError:
            return (0, 0)
        start_ms = int((end_date - timedelta(days=window_days)).timestamp() * 1000)
        end_ms = int(end_date.timestamp() * 1000)
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                  SUM(CASE WHEN winner_player_id = ? THEN 1 ELSE 0 END) AS wins,
                  SUM(CASE WHEN winner_player_id = ? OR loser_player_id = ?
                           THEN 1 ELSE 0 END) AS total
                  FROM tennis_matches_internal
                 WHERE match_date BETWEEN ? AND ?
                """,
                (player_id_int, player_id_int, player_id_int, start_ms, end_ms),
            )
            row = cur.fetchone()
            wins = int(row[0] or 0) if row else 0
            total = int(row[1] or 0) if row else 0
            return (wins, total)


def _accumulate_player(
    agg: PlayerAggregate, row: sqlite3.Row, prefix_player: str, prefix_opp: str
) -> None:
    """Add one match's serve+return stats to a running aggregate."""
    def col(p: str, suffix: str) -> int:
        v = row[f"{p}_{suffix}"]
        return int(v) if v is not None else 0

    agg.svpt          += col(prefix_player, "svpt")
    agg.first_in      += col(prefix_player, "1stIn")
    agg.first_won     += col(prefix_player, "1stWon")
    agg.second_won    += col(prefix_player, "2ndWon")
    agg.svc_games     += col(prefix_player, "SvGms")
    agg.bp_saved      += col(prefix_player, "bpSaved")
    agg.bp_faced      += col(prefix_player, "bpFaced")
    agg.opp_svpt      += col(prefix_opp, "svpt")
    agg.opp_first_won += col(prefix_opp, "1stWon")
    agg.opp_second_won += col(prefix_opp, "2ndWon")

    _parse_tie_breaks(agg, row["score"])


def _parse_tie_breaks(agg: "PlayerAggregate", score: object) -> None:
    """
    Increment agg.tb_won / agg.tb_lost from a tennis score string.
    Handles multiple notations (W4 fix):
      - Standard ATP:           '7-6(4) 6-7(2) 7-6'
      - Slash separator:        '7/6(4)'
      - Retirement suffix:      '6-7(3) ret.'  → counted (TB completed)
      - Match TB final set:     '7-6 [10-8]'    → counted via [...] notation
      - Aussie super-TB final:  '6-4 4-6 10-8'  → '10-8' style accepted
      - Stripped parentheses:   '7-6'           → counted (no mini-score)
    """
    if not score:
        return
    tokens = str(score).replace("/", "-").split()
    for token in tokens:
        clean = token.strip().rstrip(".").rstrip(",")
        if not clean:
            continue
        # Strip mini-score parenthesis or bracket: '7-6(4)' or '[10-8]'
        base = clean
        for opener, closer in (("(", ")"), ("[", "]")):
            if opener in base:
                base = base.split(opener, 1)[0] + base.split(closer, 1)[-1]
        base = base.strip("[]() ")
        if "-" not in base:
            continue
        parts = base.split("-")
        if len(parts) != 2:
            continue
        left, right = parts[0].strip(), parts[1].strip()
        if not (left.isdigit() and right.isdigit()):
            continue
        l_int, r_int = int(left), int(right)
        # Detect tie-break / match-tiebreak:
        #   - Standard set TB:  one side == 7 and the other == 6 (e.g. 7-6, 6-7)
        #     OR explicit mini-score parens which is already stripped above.
        #   - Match TB (super 10): one side >= 10 with margin >= 2, other <= 9
        is_set_tb = ({l_int, r_int} == {7, 6})
        is_match_tb = (
            (l_int >= 10 and r_int <= l_int - 2)
            or (r_int >= 10 and l_int <= r_int - 2)
        )
        if not (is_set_tb or is_match_tb):
            # Also count when explicit parenthesis was present (tracked above by strip)
            # but if neither set-TB nor match-TB pattern matched, skip.
            continue
        if l_int > r_int:
            agg.tb_won += 1
        else:
            agg.tb_lost += 1


# ─── Normalization: raw aggregate → PlayerMetrics 0-100 ───────────────────────

def _safe_pct(num: int, den: int, default: float = 50.0) -> float:
    """Return num/den * 100 clamped to [0, 100], or default if den == 0."""
    if den <= 0:
        return default
    pct = (num / den) * 100.0
    return max(0.0, min(100.0, pct))


def _normalize_elo(elo: Optional[float]) -> float:
    """Map Elo [1200, 2600] → [0, 100] linearly. Fallback 50 if missing."""
    if elo is None:
        return 50.0
    return max(0.0, min(100.0, (elo - 1200.0) / 14.0))


def aggregate_to_metrics(
    agg: PlayerAggregate,
    elo_raw: Optional[float],
    sdr_pct: float,
    ta_cache: dict[str, float] | None = None,
) -> PlayerMetrics:
    """
    Convert raw aggregate + Elo + SDR + cached TA metrics → 0-100 PlayerMetrics.
    `ta_cache` may supply tie_breaks_won / baseline_efficiency overrides
    (typically read from `tennis_ta_cache`).
    """
    ta_cache = ta_cache or {}

    elo_recent = _normalize_elo(elo_raw)

    # Service-side
    second_service_won = _safe_pct(agg.second_won, max(agg.svpt - agg.first_in, 0))
    # Service-games-won proxy: share of svc points won >= 0.55 ≈ holds.
    svc_pts_won = agg.first_won + agg.second_won
    service_games_won = _safe_pct(svc_pts_won, agg.svpt)
    bp_saved = _safe_pct(agg.bp_saved, agg.bp_faced)

    # Return-side: % return points won = 1 - opp_pts_won_on_serve / opp_svpt
    opp_pts_won_serving = agg.opp_first_won + agg.opp_second_won
    return_pts_won = _safe_pct(
        max(agg.opp_svpt - opp_pts_won_serving, 0), agg.opp_svpt
    )

    # Tie-breaks
    tb_total = agg.tb_won + agg.tb_lost
    tie_breaks_won = (
        float(ta_cache["tie_breaks_won"])
        if "tie_breaks_won" in ta_cache
        else _safe_pct(agg.tb_won, tb_total)
    )

    # Baseline efficiency — heuristic if no TA value:
    # blend return_pts_won and service_games_won as a proxy for rally control.
    baseline_efficiency = (
        float(ta_cache["baseline_efficiency"])
        if "baseline_efficiency" in ta_cache
        else max(0.0, min(100.0, (return_pts_won * 0.55) + (service_games_won * 0.45)))
    )

    return PlayerMetrics(
        elo_recent=elo_recent,
        sdr=max(0.0, min(100.0, sdr_pct)),
        return_pts_won=return_pts_won,
        second_service_won=second_service_won,
        service_games_won=service_games_won,
        bp_saved=bp_saved,
        tie_breaks_won=tie_breaks_won,
        baseline_efficiency=baseline_efficiency,
    )


def _ta_cache_lookup(
    db_path: str, player_id: str, surface: str, tour: str
) -> dict[str, float]:
    """Best-effort fetch of Tennis Abstract cached metrics for player+surface."""
    out: dict[str, float] = {}
    try:
        with sqlite3.connect(db_path) as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT take_set_rate, sweep_rate, sample
                  FROM tennis_ta_cache
                 WHERE ta_id = ?
                   AND LOWER(surface) = ?
                   AND UPPER(tour) = ?
                 ORDER BY fetched_at DESC LIMIT 1
                """,
                (str(player_id), surface.lower(), tour.upper()),
            )
            row = cur.fetchone()
            if row:
                # Spec mapping (heuristic — adjust if upstream schema changes):
                # take_set_rate ≈ tie-break-ish dominance; sweep_rate ≈ baseline efficiency.
                if row[0] is not None:
                    out["tie_breaks_won"] = max(0.0, min(100.0, float(row[0]) * 100.0))
                if row[1] is not None:
                    out["baseline_efficiency"] = max(
                        0.0, min(100.0, float(row[1]) * 100.0)
                    )
    except sqlite3.Error as e:
        logger.debug("TA cache lookup failed (%s, %s): %s", player_id, surface, e)
    return out


# ─── SPS persistence store ────────────────────────────────────────────────────

class SPSStore:
    """UPSERT SPS results into `player_surface_scores`."""

    DDL = """
        CREATE TABLE IF NOT EXISTS player_surface_scores (
            player_id        TEXT NOT NULL,
            surface          TEXT NOT NULL,
            match_id         TEXT NOT NULL,
            circuit          TEXT NOT NULL,
            sps              REAL NOT NULL,
            aptitude_score   REAL NOT NULL,
            confidence_full  INTEGER NOT NULL,
            matches_played   INTEGER NOT NULL,
            computed_at      INTEGER NOT NULL,
            PRIMARY KEY (player_id, surface, match_id)
        );
    """
    DDL_IDX = (
        "CREATE INDEX IF NOT EXISTS idx_pss_match "
        "ON player_surface_scores(match_id);"
    )
    # Composite indexes for rolling-window queries on tennis_matches_internal.
    # Required by fetch_aggregate() — without them, EXPLAIN shows full table SCAN.
    # Idempotent IF NOT EXISTS — safe on existing populated DBs.
    DDL_TMI_IDX = """
        CREATE INDEX IF NOT EXISTS idx_tmi_winner_pid_surf_date
          ON tennis_matches_internal(winner_player_id, surface, match_date);
        CREATE INDEX IF NOT EXISTS idx_tmi_loser_pid_surf_date
          ON tennis_matches_internal(loser_player_id, surface, match_date);
    """

    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_schema()
        self._ensure_source_indexes()

    def _init_schema(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(self.DDL + self.DDL_IDX)
            conn.commit()

    def _ensure_source_indexes(self) -> None:
        """Create read-path indexes on tennis_matches_internal if missing.
        Skipped silently if the source table does not exist (e.g. early-stage DB)."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                exists = conn.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' "
                    "AND name='tennis_matches_internal' LIMIT 1"
                ).fetchone()
                if not exists:
                    logger.debug(
                        "tennis_matches_internal absent — skip composite index creation."
                    )
                    return
                conn.executescript(self.DDL_TMI_IDX)
                conn.commit()
                logger.debug("Composite indexes ensured on tennis_matches_internal.")
        except sqlite3.Error as e:
            logger.warning("Cannot ensure source indexes: %s", e)

    def upsert(self, match_id: str, result: SPSResult) -> None:
        """Insert or replace one SPS row. Thread-safe via internal lock."""
        self.upsert_many([(match_id, result)])

    def upsert_many(self, rows: list[tuple[str, SPSResult]]) -> int:
        """
        Batch UPSERT — one DB connection, one transaction, executemany.
        Returns the number of rows written. W2 fix: avoids per-write connection overhead.
        """
        if not rows:
            return 0
        now_ms = int(time.time() * 1000)
        params = [
            (
                r.player_id, r.surface, match_id, r.circuit,
                r.sps, r.aptitude_score,
                1 if r.confidence_full else 0,
                r.matches_played, now_ms,
            )
            for match_id, r in rows
        ]
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO player_surface_scores
                  (player_id, surface, match_id, circuit, sps, aptitude_score,
                   confidence_full, matches_played, computed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                params,
            )
            conn.commit()
        return len(params)

    def write_heartbeat(self, stats: "PipelineStats") -> None:
        """
        R7: write last-run timestamp + summary to `kv` table.
        Used by server.js `/api/v1/sources/health` to detect stale pipelines.
        Best-effort — failures are logged but never raise.
        """
        try:
            payload = json.dumps({
                "ts_ms": int(time.time() * 1000),
                "matches_seen": stats.matches_seen,
                "players_processed": stats.players_processed,
                "sps_written": stats.sps_written,
                "errors": stats.errors,
            })
            with sqlite3.connect(self.db_path) as conn:
                # Match server.js convention: kv(key TEXT PRIMARY KEY, value TEXT)
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)"
                )
                conn.execute(
                    "INSERT OR REPLACE INTO kv(key, value) VALUES (?, ?)",
                    ("sps_last_run", payload),
                )
                conn.commit()
        except sqlite3.Error as e:
            logger.warning("Heartbeat write failed: %s", e)


# ─── Pipeline orchestrator ────────────────────────────────────────────────────

class SPSPipeline:
    """End-to-end orchestration: matches → metrics → SPS → store."""

    def __init__(
        self,
        db_path: str = DB_PATH,
        api_url: str = API_URL,
        penalty_mode: Literal["binary", "progressive"] = PENALTY_MODE,
        workers: int = WORKER_COUNT,
        dry_run: bool = DRY_RUN,
    ) -> None:
        self.db_path = db_path
        self.api_url = api_url
        self.workers = workers
        self.dry_run = dry_run
        self.stats_source = PlayerStatsSource(db_path)
        self.store = SPSStore(db_path)
        self.calculator = SurfacePowerScoreCalculator(penalty_mode=penalty_mode)
        # Batched writes (W2 fix). Collected by worker threads, flushed at end of run().
        self._pending: list[tuple[str, SPSResult]] = []
        self._pending_lock = threading.Lock()

    def run(self) -> PipelineStats:
        t0 = time.monotonic()
        try:
            matches = fetch_upcoming_matches(self.api_url)
        except MatchSourceError as e:
            logger.error("Cannot fetch upcoming matches: %s", e)
            stats = PipelineStats(errors=1)
            self.store.write_heartbeat(stats)
            return stats

        logger.info(
            "Fetched %d upcoming matches.%s",
            len(matches), " [DRY-RUN]" if self.dry_run else "",
        )
        if not matches:
            stats = PipelineStats()
            self.store.write_heartbeat(stats)
            return stats

        jobs: list[tuple[UpcomingMatch, str]] = []
        for m in matches:
            jobs.append((m, m.player_a_id))
            jobs.append((m, m.player_b_id))

        processed = 0
        skipped = 0
        errors = 0

        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {
                pool.submit(self._process_one, m, pid): (m.match_id, pid)
                for m, pid in jobs
            }
            for fut in as_completed(futures):
                match_id, pid = futures[fut]
                try:
                    ok = fut.result()
                    if ok:
                        processed += 1
                    else:
                        skipped += 1
                except Exception as e:  # noqa: BLE001 — log everything
                    errors += 1
                    logger.exception(
                        "Pipeline error for match=%s player=%s: %s", match_id, pid, e
                    )

        # W2: flush all pending writes in a single transaction.
        with self._pending_lock:
            batch = list(self._pending)
            self._pending.clear()
        if self.dry_run:
            written = 0
            logger.info(
                "[DRY-RUN] Skipping %d pending upserts (would have been written).",
                len(batch),
            )
            # Log a sample for visual inspection
            for match_id, result in batch[:5]:
                logger.info(
                    "[DRY-RUN] match=%s player=%s sps=%.2f conf=%s matches=%d",
                    match_id, result.player_id, result.sps,
                    result.confidence_full, result.matches_played,
                )
        else:
            written = self.store.upsert_many(batch)

        elapsed = time.monotonic() - t0
        logger.info(
            "Pipeline done in %.2fs — matches=%d players_ok=%d skipped=%d errors=%d written=%d",
            elapsed, len(matches), processed, skipped, errors, written,
        )
        stats = PipelineStats(
            matches_seen=len(matches),
            players_processed=processed,
            players_skipped=skipped,
            sps_written=written,
            errors=errors,
        )
        self.store.write_heartbeat(stats)
        return stats

    def _process_one(self, match: UpcomingMatch, player_id: str) -> bool:
        """Compute and store SPS for a single (match, player) pair.
        Returns True on successful write, False if skipped."""
        _DB_LIMITER.acquire()  # DB only — HTTP fetch happens once upfront

        agg = self.stats_source.fetch_aggregate(
            player_id, match.surface, match.kickoff_utc
        )

        if agg.matches_played == 0:
            # Allow scoring — confidence penalty already handles low samples.
            logger.debug(
                "No matches on %s for player=%s in window — penalty will apply.",
                match.surface, player_id,
            )

        wins, total = self.stats_source.fetch_overall_aggregate(
            player_id, match.kickoff_utc
        )
        surface_win_rate = (agg.wins / agg.matches_played) if agg.matches_played else 0.0
        overall_win_rate = (wins / total) if total else 0.0
        sdr_pct = (
            (surface_win_rate / overall_win_rate) * 100.0
            if overall_win_rate > 0
            else 50.0
        )

        elo_raw = self.stats_source.fetch_elo(player_id, match.circuit)
        ta_metrics = _ta_cache_lookup(self.db_path, player_id, match.surface, match.circuit)

        metrics = aggregate_to_metrics(agg, elo_raw, sdr_pct, ta_metrics)

        payload = {
            "player_id": player_id,
            "surface": match.surface,
            "circuit": match.circuit,
            "metrics": metrics.to_dict(),
            "matches_played_on_surface": agg.matches_played,
        }
        try:
            result = self.calculator.calculate(payload)
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(
                "Calculator rejected payload for match=%s player=%s: %s",
                match.match_id, player_id, e,
            )
            return False

        with self._pending_lock:
            self._pending.append((match.match_id, result))
        logger.debug(
            "SPS queued | match=%s player=%s sps=%.2f conf=%s",
            match.match_id, player_id, result.sps, result.confidence_full,
        )
        return True


# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> int:
    logger.info("=== SPS updater start === db=%s api=%s", DB_PATH, API_URL)
    pipeline = SPSPipeline()
    stats = pipeline.run()

    logger.info(
        "Summary: matches=%d ok=%d skipped=%d errors=%d",
        stats.matches_seen, stats.players_processed,
        stats.players_skipped, stats.errors,
    )

    if stats.errors > 0:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())


# ─── Crontab ──────────────────────────────────────────────────────────────────
# Run every 12 hours at 05:30 and 17:30 (server local time).
# Adjust the absolute paths to your VPS layout (default OVH PariScore: /home/ubuntu/pariscore).
#
# Recommended (logger handles rotation; no shell redirect — avoids W8 double-write):
#   30 5,17 * * * cd /home/ubuntu/pariscore && /usr/bin/python3 cron_sps_updater.py
#
# With a virtualenv:
#   30 5,17 * * * cd /home/ubuntu/pariscore && /home/ubuntu/pariscore/.venv/bin/python cron_sps_updater.py
#
# Env override examples:
#   # Progressive penalty + verbose:
#   30 5,17 * * * cd /home/ubuntu/pariscore && PARISCORE_SPS_PENALTY=progressive PARISCORE_LOG_LEVEL=DEBUG /usr/bin/python3 cron_sps_updater.py
#   # Dry-run (no DB writes — useful for ETL ramp-up):
#   30 5,17 * * * cd /home/ubuntu/pariscore && PARISCORE_SPS_DRY_RUN=1 /usr/bin/python3 cron_sps_updater.py
#   # Wider lookahead (recompute T+0 to T+48):
#   30 5,17 * * * cd /home/ubuntu/pariscore && PARISCORE_LOOKAHEAD_MIN=0 PARISCORE_LOOKAHEAD_MAX=48 /usr/bin/python3 cron_sps_updater.py
