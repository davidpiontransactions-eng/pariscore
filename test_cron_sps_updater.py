"""
test_cron_sps_updater.py — Pytest suite for cron_sps_updater.py
Run: python -m pytest test_cron_sps_updater.py -v

Covers:
- Normalization helpers (_safe_pct, _normalize_elo)
- Tie-break parser (_parse_tie_breaks) including W4 extended formats
- Aggregation (_accumulate_player, aggregate_to_metrics)
- HTTP fetch (fetch_upcoming_matches) against mock httpd
- SPSStore upsert_many idempotence + heartbeat
- RateLimiter throttling
- SPSPipeline dry-run mode
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import sqlite3
import tempfile
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Iterator

import pytest

from cron_sps_updater import (
    DRY_RUN,
    MatchSourceError,
    PipelineStats,
    PlayerAggregate,
    PlayerStatsSource,
    RateLimiter,
    SPSPipeline,
    SPSStore,
    _accumulate_player,
    _normalize_elo,
    _parse_iso,
    _parse_tie_breaks,
    _safe_pct,
    aggregate_to_metrics,
    fetch_upcoming_matches,
)
from surface_powerscore import PlayerMetrics, SPSResult


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def temp_db() -> Iterator[str]:
    """Throwaway SQLite DB seeded with empty tennis_matches_internal + tennis_players_elo."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        with sqlite3.connect(path) as conn:
            conn.executescript("""
                CREATE TABLE tennis_matches_internal (
                  source TEXT, source_id TEXT, tour TEXT,
                  tourney_name TEXT, tourney_id INTEGER,
                  surface TEXT, tourney_date INTEGER, match_date INTEGER,
                  winner_name TEXT, loser_name TEXT,
                  winner_player_id INTEGER, loser_player_id INTEGER,
                  score TEXT, sets_winner INTEGER, sets_loser INTEGER,
                  best_of INTEGER, round TEXT, status TEXT, minutes INTEGER,
                  imported_at INTEGER,
                  w_ace INTEGER, w_df INTEGER, w_svpt INTEGER,
                  w_1stIn INTEGER, w_1stWon INTEGER, w_2ndWon INTEGER,
                  w_SvGms INTEGER, w_bpSaved INTEGER, w_bpFaced INTEGER,
                  l_ace INTEGER, l_df INTEGER, l_svpt INTEGER,
                  l_1stIn INTEGER, l_1stWon INTEGER, l_2ndWon INTEGER,
                  l_SvGms INTEGER, l_bpSaved INTEGER, l_bpFaced INTEGER,
                  winner_rank INTEGER, winner_rank_points INTEGER,
                  loser_rank INTEGER, loser_rank_points INTEGER,
                  winner_hand TEXT, loser_hand TEXT,
                  winner_ioc TEXT, loser_ioc TEXT,
                  winner_age REAL, loser_age REAL
                );
                CREATE TABLE tennis_players_elo (
                  player_id TEXT, player_name TEXT, elo_rating REAL,
                  matches_played INTEGER, last_match_at INTEGER,
                  atp_rank INTEGER, wta_rank INTEGER, circuit TEXT,
                  created_at INTEGER, updated_at INTEGER
                );
                CREATE TABLE tennis_ta_cache (
                  name_key TEXT, tour TEXT, surface TEXT, ta_id TEXT,
                  ta_url TEXT, take_set_rate REAL, sweep_rate REAL,
                  sample INTEGER, source TEXT, fetched_at INTEGER
                );
            """)
            conn.commit()
        yield path
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


@pytest.fixture
def mock_server() -> Iterator[tuple[str, dict]]:
    """Spin up an HTTP server on an ephemeral port. Yield (base_url, payloads_dict)."""
    payloads: dict[str, tuple[int, bytes]] = {}

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args, **kwargs) -> None: pass  # silence
        def do_GET(self) -> None:
            code, body = payloads.get(self.path, (404, b"nope"))
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

    srv = socketserver.TCPServer(("127.0.0.1", 0), H)
    port = srv.server_address[1]
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        yield (f"http://127.0.0.1:{port}", payloads)
    finally:
        srv.shutdown()
        srv.server_close()


# ─── 1. Normalization helpers ─────────────────────────────────────────────────

class TestSafePct:
    @pytest.mark.parametrize("num,den,expected", [
        (70, 100, 70.0),
        (0, 100, 0.0),
        (100, 100, 100.0),
        (150, 100, 100.0),  # clamp upper
        (-5, 100, 0.0),     # clamp lower (num implicitly negative)
        (50, 0, 50.0),      # div by zero → default
        (0, -1, 50.0),      # negative den → default
    ])
    def test_safe_pct(self, num, den, expected):
        assert _safe_pct(num, den) == expected

    def test_custom_default(self):
        assert _safe_pct(0, 0, default=42.0) == 42.0


class TestNormalizeElo:
    @pytest.mark.parametrize("elo,expected", [
        (1200, 0.0),
        (1900, 50.0),
        (2600, 100.0),
        (800, 0.0),         # clamp
        (3000, 100.0),      # clamp
        (None, 50.0),       # missing
    ])
    def test_normalize_elo(self, elo, expected):
        assert _normalize_elo(elo) == pytest.approx(expected, abs=0.5)


# ─── 2. Tie-break parser (W4 fix) ────────────────────────────────────────────

class TestTieBreakParser:
    @pytest.mark.parametrize("score,won,lost", [
        ("7-6(4) 6-7(2) 7-6(5)", 2, 1),
        ("7/6(4) 4-6 6-4", 1, 0),       # slash separator
        ("6-7(3) ret.", 0, 1),           # retirement suffix
        ("6-4 4-6 10-8", 1, 0),          # match TB (super-10)
        ("4-6 6-4 8-10", 0, 1),          # match TB lost
        ("7-6 [10-8]", 1, 0),            # only [10-8] counts (no parens on 7-6)
        ("6-4 6-4", 0, 0),               # no TBs
        ("", 0, 0),
        ("7-6(garbage)", 1, 0),          # parens with non-numeric content
        ("7-6(0)", 1, 0),
        ("6-7(15)", 0, 1),
    ])
    def test_parse_all_formats(self, score, won, lost):
        agg = PlayerAggregate()
        _parse_tie_breaks(agg, score)
        assert agg.tb_won == won
        assert agg.tb_lost == lost

    def test_none_score(self):
        agg = PlayerAggregate()
        _parse_tie_breaks(agg, None)
        assert (agg.tb_won, agg.tb_lost) == (0, 0)

    def test_accumulates_across_calls(self):
        agg = PlayerAggregate()
        _parse_tie_breaks(agg, "7-6(4) 6-3")
        _parse_tie_breaks(agg, "6-7(2) 6-4 7-6(8)")
        assert agg.tb_won == 2
        assert agg.tb_lost == 1


# ─── 3. _accumulate_player ────────────────────────────────────────────────────

class TestAccumulatePlayer:
    def _row(self, **overrides) -> dict:
        base = {
            "w_svpt": 100, "w_1stIn": 60, "w_1stWon": 45, "w_2ndWon": 20,
            "w_SvGms": 15, "w_bpSaved": 8, "w_bpFaced": 12,
            "l_svpt": 100, "l_1stIn": 55, "l_1stWon": 40, "l_2ndWon": 18,
            "l_SvGms": 14, "l_bpSaved": 6, "l_bpFaced": 10,
            "score": "6-4 6-3",
        }
        base.update(overrides)
        return base

    def test_winner_accumulates_to_player_side(self):
        agg = PlayerAggregate()
        _accumulate_player(agg, self._row(), prefix_player="w", prefix_opp="l")
        assert agg.svpt == 100
        assert agg.first_won == 45
        assert agg.opp_svpt == 100
        assert agg.opp_first_won == 40

    def test_loser_accumulates_from_l_side(self):
        agg = PlayerAggregate()
        _accumulate_player(agg, self._row(), prefix_player="l", prefix_opp="w")
        assert agg.svpt == 100
        assert agg.first_won == 40
        assert agg.opp_svpt == 100
        assert agg.opp_first_won == 45

    def test_handles_none_columns(self):
        agg = PlayerAggregate()
        _accumulate_player(
            agg, self._row(w_svpt=None, w_bpFaced=None),
            prefix_player="w", prefix_opp="l",
        )
        assert agg.svpt == 0
        assert agg.bp_faced == 0


# ─── 4. aggregate_to_metrics ──────────────────────────────────────────────────

class TestAggregateToMetrics:
    def test_empty_aggregate_yields_defaults(self):
        m = aggregate_to_metrics(PlayerAggregate(), elo_raw=None, sdr_pct=50.0)
        for key in ("elo_recent", "sdr", "return_pts_won", "second_service_won",
                    "service_games_won", "bp_saved"):
            assert getattr(m, key) == 50.0

    def test_full_aggregate_returns_pct(self):
        agg = PlayerAggregate(
            matches_played=10, svpt=600, first_in=400, first_won=300,
            second_won=80, svc_games=85, bp_saved=40, bp_faced=55,
            opp_svpt=580, opp_first_won=290, opp_second_won=75,
            wins=7, losses=3, tb_won=4, tb_lost=2,
        )
        m = aggregate_to_metrics(agg, elo_raw=1900.0, sdr_pct=85.0)
        assert m.elo_recent == pytest.approx(50.0, abs=0.5)
        assert m.sdr == 85.0
        assert m.return_pts_won == pytest.approx(37.07, abs=0.1)
        assert m.bp_saved == pytest.approx(72.73, abs=0.1)
        assert m.tie_breaks_won == pytest.approx(66.67, abs=0.1)

    def test_ta_cache_overrides(self):
        agg = PlayerAggregate(matches_played=1, tb_won=1, tb_lost=0)
        m = aggregate_to_metrics(
            agg, elo_raw=1900.0, sdr_pct=85.0,
            ta_cache={"tie_breaks_won": 42.5, "baseline_efficiency": 88.0},
        )
        assert m.tie_breaks_won == 42.5
        assert m.baseline_efficiency == 88.0

    def test_sdr_clamped(self):
        m = aggregate_to_metrics(PlayerAggregate(), elo_raw=None, sdr_pct=999.0)
        assert m.sdr == 100.0
        m2 = aggregate_to_metrics(PlayerAggregate(), elo_raw=None, sdr_pct=-50.0)
        assert m2.sdr == 0.0


# ─── 5. _parse_iso ────────────────────────────────────────────────────────────

class TestParseIso:
    @pytest.mark.parametrize("s", [
        "2026-05-28T10:00:00Z",
        "2026-05-28T10:00:00+00:00",
        "2026-05-28T12:00:00+02:00",
    ])
    def test_valid(self, s):
        dt = _parse_iso(s)
        assert dt.tzinfo is not None

    def test_naive_assumed_utc(self):
        dt = _parse_iso("2026-05-28T10:00:00")
        assert dt.tzinfo == timezone.utc


# ─── 6. fetch_upcoming_matches HTTP ───────────────────────────────────────────

class TestFetchUpcoming:
    def _future_iso(self, hours: int) -> str:
        return (datetime.now(timezone.utc) + timedelta(hours=hours)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )

    def test_empty_matches(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"matches": []}).encode())
        assert fetch_upcoming_matches(f"{base}/u") == []

    def test_missing_matches_key_raises(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"foo": 1}).encode())
        with pytest.raises(MatchSourceError):
            fetch_upcoming_matches(f"{base}/u")

    def test_malformed_json_raises(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, b"<<not json>>")
        with pytest.raises(MatchSourceError):
            fetch_upcoming_matches(f"{base}/u")

    def test_http_500_raises(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (500, b"oops")
        with pytest.raises(MatchSourceError):
            fetch_upcoming_matches(f"{base}/u")

    def test_valid_match_in_window(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"matches": [{
            "id": "m1",
            "surface": "clay",
            "tour": "ATP",
            "home_player_id": "1",
            "away_player_id": "2",
            "commence_time": self._future_iso(30),
        }]}).encode())
        out = fetch_upcoming_matches(f"{base}/u")
        assert len(out) == 1
        assert out[0].match_id == "m1"
        assert out[0].surface == "clay"
        assert out[0].circuit == "ATP"

    def test_match_out_of_window_filtered(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"matches": [{
            "id": "m_far",
            "surface": "clay",
            "tour": "ATP",
            "home_player_id": "1",
            "away_player_id": "2",
            "commence_time": self._future_iso(100),
        }]}).encode())
        assert fetch_upcoming_matches(f"{base}/u") == []

    def test_bad_surface_filtered(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"matches": [{
            "id": "m1", "surface": "sand", "tour": "ATP",
            "home_player_id": "1", "away_player_id": "2",
            "commence_time": self._future_iso(30),
        }]}).encode())
        assert fetch_upcoming_matches(f"{base}/u") == []

    def test_missing_players_filtered(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"matches": [{
            "id": "m1", "surface": "clay", "tour": "ATP",
            "commence_time": self._future_iso(30),
        }]}).encode())
        assert fetch_upcoming_matches(f"{base}/u") == []

    def test_wta_circuit_normalized(self, mock_server):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"matches": [{
            "id": "m1", "surface": "hard", "tour": "wta",
            "home_player_id": "1", "away_player_id": "2",
            "commence_time": self._future_iso(30),
        }]}).encode())
        out = fetch_upcoming_matches(f"{base}/u")
        assert out[0].circuit == "WTA"


# ─── 7. SPSStore — upsert + batch + heartbeat ─────────────────────────────────

class TestSPSStore:
    def test_init_creates_table(self, temp_db):
        SPSStore(temp_db)
        with sqlite3.connect(temp_db) as conn:
            row = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name='player_surface_scores'"
            ).fetchone()
            assert row is not None

    def test_init_creates_composite_indexes(self, temp_db):
        SPSStore(temp_db)
        with sqlite3.connect(temp_db) as conn:
            idx = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' "
                "AND name IN ('idx_tmi_winner_pid_surf_date', 'idx_tmi_loser_pid_surf_date')"
            ).fetchall()
            assert len(idx) == 2

    def test_upsert_single(self, temp_db):
        store = SPSStore(temp_db)
        r = SPSResult("p1", "clay", "ATP", 70.0, 72.5, True, 10)
        store.upsert("M1", r)
        with sqlite3.connect(temp_db) as conn:
            cnt = conn.execute(
                "SELECT COUNT(*) FROM player_surface_scores"
            ).fetchone()[0]
            assert cnt == 1

    def test_upsert_many_batch(self, temp_db):
        store = SPSStore(temp_db)
        rows = [
            (f"M{i}", SPSResult(f"p{i}", "clay", "ATP", 70.0, 72.0, True, 10))
            for i in range(50)
        ]
        n = store.upsert_many(rows)
        assert n == 50
        with sqlite3.connect(temp_db) as conn:
            assert conn.execute(
                "SELECT COUNT(*) FROM player_surface_scores"
            ).fetchone()[0] == 50

    def test_upsert_many_idempotent_replace(self, temp_db):
        store = SPSStore(temp_db)
        r1 = SPSResult("p1", "clay", "ATP", 70.0, 72.0, True, 10)
        r2 = SPSResult("p1", "clay", "ATP", 80.0, 85.0, True, 20)
        store.upsert_many([("M1", r1), ("M1", r2)])
        with sqlite3.connect(temp_db) as conn:
            row = conn.execute(
                "SELECT sps, matches_played FROM player_surface_scores "
                "WHERE player_id='p1' AND surface='clay' AND match_id='M1'"
            ).fetchone()
            # last write wins
            assert row[0] == 85.0
            assert row[1] == 20

    def test_upsert_many_empty_list_returns_zero(self, temp_db):
        store = SPSStore(temp_db)
        assert store.upsert_many([]) == 0

    def test_write_heartbeat(self, temp_db):
        store = SPSStore(temp_db)
        store.write_heartbeat(PipelineStats(
            matches_seen=3, players_processed=5, sps_written=5, errors=0,
        ))
        with sqlite3.connect(temp_db) as conn:
            row = conn.execute(
                "SELECT value FROM kv WHERE key='sps_last_run'"
            ).fetchone()
            assert row is not None
            payload = json.loads(row[0])
            assert payload["matches_seen"] == 3
            assert payload["sps_written"] == 5
            assert "ts_ms" in payload


# ─── 8. RateLimiter ───────────────────────────────────────────────────────────

class TestRateLimiter:
    def test_throttles_to_configured_rate(self):
        rl = RateLimiter(20.0)  # 50ms min interval
        t0 = time.monotonic()
        for _ in range(4):
            rl.acquire()
        elapsed = time.monotonic() - t0
        # 4 acquires at 20rps => ~150ms minimum (first is immediate)
        assert elapsed >= 0.13, f"Expected >= 130ms, got {elapsed*1000:.0f}ms"

    def test_thread_safe(self):
        rl = RateLimiter(50.0)
        count = [0]
        lock = threading.Lock()

        def worker() -> None:
            for _ in range(10):
                rl.acquire()
                with lock:
                    count[0] += 1

        threads = [threading.Thread(target=worker) for _ in range(4)]
        t0 = time.monotonic()
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        elapsed = time.monotonic() - t0
        # 40 total acquires at 50rps => >= 780ms minimum
        assert count[0] == 40
        assert elapsed >= 0.7, f"Expected >= 700ms, got {elapsed*1000:.0f}ms"


# ─── 9. SPSPipeline — dry-run + no-match flow ────────────────────────────────

class TestSPSPipeline:
    def test_unreachable_api_returns_error_stats(self, temp_db):
        # Use a port we expect to be closed. 127.0.0.1:1 typically refuses.
        p = SPSPipeline(
            db_path=temp_db, api_url="http://127.0.0.1:1/no-such", dry_run=False,
        )
        stats = p.run()
        assert stats.errors == 1
        assert stats.sps_written == 0

    def test_empty_matches_returns_clean_stats(self, mock_server, temp_db):
        base, payloads = mock_server
        payloads["/u"] = (200, json.dumps({"matches": []}).encode())
        p = SPSPipeline(db_path=temp_db, api_url=f"{base}/u", dry_run=False)
        stats = p.run()
        assert stats.errors == 0
        assert stats.matches_seen == 0
        assert stats.sps_written == 0

    def test_dry_run_skips_writes(self, mock_server, temp_db):
        base, payloads = mock_server
        future = (datetime.now(timezone.utc) + timedelta(hours=30)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        payloads["/u"] = (200, json.dumps({"matches": [{
            "id": "m1", "surface": "clay", "tour": "ATP",
            "home_player_id": "1", "away_player_id": "2",
            "commence_time": future,
        }]}).encode())
        p = SPSPipeline(db_path=temp_db, api_url=f"{base}/u", dry_run=True)
        stats = p.run()
        # Players processed but nothing written
        assert stats.matches_seen == 1
        assert stats.players_processed == 2
        assert stats.sps_written == 0
        with sqlite3.connect(temp_db) as conn:
            cnt = conn.execute(
                "SELECT COUNT(*) FROM player_surface_scores"
            ).fetchone()[0]
            assert cnt == 0

    def test_heartbeat_written_on_error_path(self, temp_db):
        p = SPSPipeline(
            db_path=temp_db, api_url="http://127.0.0.1:1/no-such", dry_run=False,
        )
        p.run()
        with sqlite3.connect(temp_db) as conn:
            row = conn.execute(
                "SELECT value FROM kv WHERE key='sps_last_run'"
            ).fetchone()
            assert row is not None
            assert json.loads(row[0])["errors"] >= 1
