"""
timesfm_forecast.py — TimesFM integration for PariScore
======================================================
CLI tool that builds time series from the Pariscore database
and runs TimesFM zero-shot forecasting to produce trend predictions
with confidence intervals.

Usage:
  python tools/timesfm_forecast.py build-tennis      # Forecast tennis Elo trends (top 50)
  python tools/timesfm_forecast.py build-tennis --all # All players with 10+ matches
  python tools/timesfm_forecast.py build-football     # Forecast football xG trends
  python tools/timesfm_forecast.py build-all          # Run both
  python tools/timesfm_forecast.py list [sport]       # Show stored forecasts
  python tools/timesfm_forecast.py status             # Model & DB status
"""

import sqlite3, sys, os, json, math, time, logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("timesfm")

DB_PATH = Path(__file__).resolve().parents[1] / "pariscore.db"
MAX_SERIES_LEN = 512  # max context for TimesFM

# ── TimesFM model (lazy singleton) ──────────────────────────────────────────

_model = None
_model_config = None


def get_model():
    global _model, _model_config
    if _model is not None:
        return _model, _model_config
    try:
        import timesfm
    except ImportError:
        log.error("timesfm not installed. Run: pip install timesfm[torch]")
        sys.exit(1)

    log.info("Loading TimesFM 2.5 200M (PyTorch)")
    t0 = time.time()
    model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
        "google/timesfm-2.5-200m-pytorch", torch_compile=False,
    )
    fc = timesfm.ForecastConfig(
        max_context=512,
        max_horizon=128,  # multiples of 128 (output patch size)
        per_core_batch_size=16,
        use_continuous_quantile_head=True,
        force_flip_invariance=True,
        infer_is_positive=True,
        fix_quantile_crossing=True,
        normalize_inputs=True,
    )
    model.compile(fc)
    log.info(f"Model loaded and compiled in {time.time()-t0:.1f}s")
    _model = model
    _model_config = fc
    return model, fc


# ── Database helpers ────────────────────────────────────────────────────────

def db_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def ensure_timesfm_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS timesfm_forecasts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            sport           TEXT NOT NULL,
            entity_type     TEXT NOT NULL,
            entity_id       TEXT NOT NULL,
            entity_label    TEXT,
            context         TEXT,
            series_label    TEXT,
            horizon         INTEGER NOT NULL,
            forecast_raw    TEXT NOT NULL,
            quantile_labels TEXT,
            input_tail      TEXT,
            forecast_ts     INTEGER NOT NULL,
            expires_at      INTEGER,
            UNIQUE(sport, entity_type, entity_id, context, series_label)
        );
        CREATE INDEX IF NOT EXISTS idx_timesfm_sport_entity
            ON timesfm_forecasts(sport, entity_type, entity_id);
    """)
    conn.commit()


# ── Tennis: Elo time series ───────────────────────────────────────────────

def get_player_matches(conn, player_name, tour, surface):
    """Fetch matches for a player using UNION (uses indexes efficiently)."""
    if surface and surface.upper() != "ALL":
        surf_clause = "AND upper(surface) = upper(?)"
        surf_param = (surface,)
    else:
        surf_clause = ""
        surf_param = ()

    rows = conn.execute(
        f"SELECT tourney_date, winner_name, loser_name FROM tennis_matches "
        f"WHERE tour = ? AND winner_name = ? {surf_clause} ORDER BY tourney_date ASC",
        (tour, player_name) + surf_param,
    ).fetchall()

    rows += conn.execute(
        f"SELECT tourney_date, winner_name, loser_name FROM tennis_matches "
        f"WHERE tour = ? AND loser_name = ? {surf_clause} ORDER BY tourney_date ASC",
        (tour, player_name) + surf_param,
    ).fetchall()

    # Sort merged list by date
    rows.sort(key=lambda r: r["tourney_date"])
    return rows


def build_elo_series(rows, player_name, K=32, base=1500.0):
    """Build an Elo time series from match rows."""
    elo = base
    series = []
    for r in rows:
        opp = base
        if r["winner_name"] == player_name:
            expected = 1.0 / (1.0 + 10.0 ** ((opp - elo) / 400.0))
            elo += K * (1.0 - expected)
        else:
            expected = 1.0 / (1.0 + 10.0 ** ((opp - elo) / 400.0))
            elo += K * (0.0 - expected)
        series.append(round(elo, 2))
    return np.array(series[-MAX_SERIES_LEN:], dtype=np.float32)



def forecast_tennis(conn, top_n=50):
    """Forecast Elo trends for top tennis players (per tour/surface).
    Batch: collect all series -> one forecast() call -> truncate & store.
    """
    model, fc = get_model()
    surfaces = ["ALL", "Hard", "Clay", "Grass"]
    batch_horizon = fc.max_horizon

    players = conn.execute(
        """SELECT player_id, player_name, tour FROM tennis_elo
           GROUP BY player_name, tour ORDER BY MAX(elo) DESC LIMIT ?""",
        (top_n * 2,),
    ).fetchall()

    # Phase 1: collect all series
    batch_meta = []
    batch_inputs = []

    for p in players:
        name, pid, tour = p["player_name"], p["player_id"], p["tour"]
        for surface in surfaces:
            rows = get_player_matches(conn, name, tour, surface)
            if len(rows) < 10:
                continue
            x = build_elo_series(rows, name)
            horizon = min(24, len(x) // 2)
            batch_meta.append((name, pid, tour, surface, horizon))
            batch_inputs.append(x)

    if not batch_inputs:
        log.info("No tennis players with enough matches")
        return 0

    log.info(f"Tennis batch: {len(batch_inputs)} series, horizon={batch_horizon}")

    # Phase 2: single batch forecast
    t0 = time.time()
    try:
        all_points, all_quantiles = model.forecast(batch_horizon, batch_inputs)
    except Exception as e:
        log.error(f"Tennis batch forecast failed: {e}")
        return 0
    elapsed = time.time() - t0
    log.info(f"Tennis inference: {elapsed:.1f}s ({elapsed/len(batch_inputs)*1000:.0f}ms/series)")

    # Phase 3: truncate & store
    now = int(time.time())
    stored = 0
    for idx, (name, pid, tour, surface, horizon) in enumerate(batch_meta):
        pts = all_points[idx][:horizon]
        qtl = all_quantiles[idx][:horizon]
        conn.execute(
            """INSERT OR REPLACE INTO timesfm_forecasts
               (sport, entity_type, entity_id, entity_label, context,
                series_label, horizon, forecast_raw, quantile_labels,
                input_tail, forecast_ts, expires_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                "tennis", "player", str(pid), name,
                f"{tour} {surface}", "elo", horizon,
                json.dumps([pts.tolist(), qtl.tolist()]),
                json.dumps(["mean","q10","q20","q30","q40","q50","q60","q70","q80","q90"]),
                json.dumps(batch_inputs[idx][-10:].tolist()),
                now, now + 86400,
            ),
        )
        stored += 1

    conn.commit()
    total_players = len(set(m[0] for m in batch_meta))
    log.info(f"Tennis: {stored} forecasts ({total_players} players)")
    return stored

def forecast_football(conn, top_leagues=None):
    """Forecast xG trends for football teams (batch)."""
    model, fc = get_model()
    query = """SELECT home_team AS team, bsd_league_id, COUNT(*) AS cnt
               FROM match_stats_history GROUP BY home_team, bsd_league_id
               HAVING cnt >= 10 ORDER BY cnt DESC"""
    if top_leagues:
        ph = ",".join("?" for _ in top_leagues)
        query += f" AND bsd_league_id IN ({ph})"
    teams = conn.execute(query, top_leagues or []).fetchall()
    batch_horizon = fc.max_horizon

    batch_meta = []
    batch_inputs = []
    for row in teams:
        team, league = row["team"], row["bsd_league_id"]
        matches = conn.execute(
            "SELECT home_xg FROM match_stats_history WHERE home_team = ? ORDER BY match_date ASC",
            (team,),
        ).fetchall()
        vals = [float(m["home_xg"]) for m in matches if m["home_xg"] is not None]
        if len(vals) < 10:
            continue
        x = np.array(vals[-MAX_SERIES_LEN:], dtype=np.float32)
        horizon = min(12, len(x) // 3)
        batch_meta.append((team, league, horizon))
        batch_inputs.append(x)

    if not batch_inputs:
        log.info("No football teams with enough matches")
        return 0

    log.info(f"Football batch: {len(batch_inputs)} teams, horizon={batch_horizon}")

    t0 = time.time()
    try:
        all_points, all_quantiles = model.forecast(batch_horizon, batch_inputs)
    except Exception as e:
        log.error(f"Football batch forecast failed: {e}")
        return 0
    elapsed = time.time() - t0
    log.info(f"Football inference: {elapsed:.1f}s ({elapsed/len(batch_inputs)*1000:.0f}ms/team)")

    now = int(time.time())
    stored = 0
    for idx, (team, league, horizon) in enumerate(batch_meta):
        pts = all_points[idx][:horizon]
        qtl = all_quantiles[idx][:horizon]
        conn.execute(
            """INSERT OR REPLACE INTO timesfm_forecasts
               (sport, entity_type, entity_id, entity_label, context,
                series_label, horizon, forecast_raw, quantile_labels,
                input_tail, forecast_ts, expires_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                "football", "team", team, team,
                f"league_{league}", "home_xg", horizon,
                json.dumps([pts.tolist(), qtl.tolist()]),
                json.dumps(["mean","q10","q20","q30","q40","q50","q60","q70","q80","q90"]),
                json.dumps(batch_inputs[idx][-10:].tolist()),
                now, now + 86400,
            ),
        )
        stored += 1
        if stored % 20 == 0:
            log.info(f"[{stored}/{len(batch_meta)}] processed")

    conn.commit()
    log.info(f"Football: {stored} forecasts stored")
    return stored
def cmd_status():
    conn = db_conn()
    try:
        rc = conn.execute("SELECT COUNT(*) FROM timesfm_forecasts").fetchone()[0]
        log.info(f"  timesfm_forecasts: {rc} rows")
    except Exception:
        log.info("  timesfm_forecasts: table does not exist")
    for tbl, label in [("tennis_matches", "tennis_matches"), ("tennis_elo", "tennis_elo"),
                        ("match_stats_history", "match_stats_history")]:
        rc = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        log.info(f"  {label}: {rc:,}")
    conn.close()
    try:
        import timesfm; log.info(f"  timesfm: installed")
    except ImportError:
        log.info("  timesfm: NOT INSTALLED")


def cmd_build_tennis():
    all_flag = "--all" in sys.argv
    conn = db_conn()
    ensure_timesfm_tables(conn)
    forecast_tennis(conn, top_n=9999 if all_flag else 50)
    conn.close()


def cmd_build_football():
    conn = db_conn()
    ensure_timesfm_tables(conn)
    forecast_football(conn)
    conn.close()


def cmd_build_all():
    conn = db_conn()
    ensure_timesfm_tables(conn)
    forecast_tennis(conn, top_n=50)
    forecast_football(conn)
    conn.close()


def cmd_list():
    sport = sys.argv[2] if len(sys.argv) > 2 else None
    conn = db_conn()
    try:
        if sport:
            rows = conn.execute("SELECT sport,entity_label,context,series_label,horizon,forecast_ts FROM timesfm_forecasts WHERE sport=? ORDER BY forecast_ts DESC LIMIT 30", (sport,)).fetchall()
        else:
            rows = conn.execute("SELECT sport,entity_label,context,series_label,horizon,forecast_ts FROM timesfm_forecasts ORDER BY forecast_ts DESC LIMIT 30").fetchall()
        log.info(f"{'sport':<8} {'entity':<25} {'context':<16} {'series':<10} {'horizon':<8} {'at':<12}")
        log.info("-"*80)
        for r in rows:
            ts = datetime.fromtimestamp(r["forecast_ts"]).strftime("%H:%M")
            log.info(f"{r['sport']:<8} {r['entity_label']:<25} {r['context']:<16} {r['series_label']:<10} {r['horizon']:<8} {ts:<12}")
    except Exception as e:
        log.info(f"No forecasts: {e}")
    conn.close()


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cmds = {"status": cmd_status, "build-tennis": cmd_build_tennis,
            "build-football": cmd_build_football, "build-all": cmd_build_all, "list": cmd_list}
    c = sys.argv[1]
    if c not in cmds:
        print(f"Unknown: {c}. Available: {', '.join(cmds)}"); sys.exit(1)
    cmds[c]()


if __name__ == "__main__":
    main()
