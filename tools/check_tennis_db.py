"""Check tennis DB metrics state on VPS."""
import sqlite3, datetime

DB = "/home/ubuntu/pariscore/pariscore.db"

conn = sqlite3.connect(DB)
cur = conn.cursor()

print("=== TABLES ===")
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
for t in cur.fetchall():
    print(" ", t[0])

print("\n=== player_surface_scores ===")
cur.execute("SELECT COUNT(*) FROM player_surface_scores")
print(f"  Total rows: {cur.fetchone()[0]}")
cur.execute("SELECT surface, COUNT(*), ROUND(AVG(sps),1), MIN(sps), MAX(sps) FROM player_surface_scores GROUP BY surface ORDER BY surface")
for r in cur.fetchall():
    print(f"  {r[0]}: count={r[1]}, avg_sps={r[2]}, min={r[3]}, max={r[4]}")
cur.execute("SELECT MAX(computed_at) FROM player_surface_scores")
ts = cur.fetchone()[0]
if ts:
    dt = datetime.datetime.fromtimestamp(ts/1000, tz=datetime.timezone.utc)
    print(f"  Last computed_at: {dt.strftime('%Y-%m-%d %H:%M:%S UTC')}")

# PID matching check: Sinner PIDs in tennis_players_elo vs player_surface_scores
print("\n=== PID matching: Jannik Sinner ===")
cur2 = sqlite3.connect("/home/ubuntu/pariscore/pariscore.db")
c2 = cur2.cursor()
c2.execute("SELECT player_id FROM tennis_players_elo WHERE LOWER(player_name)='jannik sinner'")
pids = [r[0] for r in c2.fetchall()]
print(f"  tennis_players_elo: {pids}")
for pid in pids:
    c2.execute("SELECT DISTINCT player_id, surface, sps FROM player_surface_scores WHERE player_id = ?", (str(pid),))
    rows = c2.fetchall()
    print(f"  pss (str '{pid}'): {len(rows)} rows")
    for r in rows: print(f"    surface={r[1]} sps={r[2]}")
    c2.execute("SELECT DISTINCT player_id, surface, sps FROM player_surface_scores WHERE CAST(player_id AS INTEGER) = ?", (int(pid),))
    rows = c2.fetchall()
    print(f"  pss (int {int(pid)}): {len(rows)} rows")
    for r in rows: print(f"    surface={r[1]} sps={r[2]}")

# Show a few pss PIDs as sample
c2.execute("SELECT DISTINCT CAST(player_id AS INTEGER) as pid FROM player_surface_scores LIMIT 10")
print(f"  sample PIDs in pss: {[r[0] for r in c2.fetchall()]}")
c2.execute("SELECT DISTINCT player_id FROM player_surface_scores WHERE player_id GLOB '[0-9]*' LIMIT 10")
print(f"  sample PIDs in pss (string): {[r[0] for r in c2.fetchall()]}")
cur2.close()

print("\n=== tennis_players_elo ===")
cur.execute("SELECT COUNT(*) FROM tennis_players_elo")
print(f"  Total rows: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(DISTINCT player_id) FROM tennis_players_elo")
print(f"  Unique players: {cur.fetchone()[0]}")
cur.execute("SELECT UPPER(COALESCE(circuit,'')), COUNT(*) FROM tennis_players_elo GROUP BY 1")
for r in cur.fetchall():
    print(f"  circuit={r[0]!r}: {r[1]}")

print("\n=== tennis_elo ===")
try:
    cur.execute("SELECT COUNT(*) FROM tennis_elo")
    print(f"  Total rows: {cur.fetchone()[0]}")
    cur.execute("SELECT surface, COUNT(*), ROUND(AVG(elo),1) FROM tennis_elo GROUP BY surface")
    for r in cur.fetchall():
        print(f"  {r[0]}: count={r[1]}, avg_elo={r[2]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== tennis_ta_cache ===")
try:
    cur.execute("SELECT COUNT(*) FROM tennis_ta_cache")
    print(f"  Total rows: {cur.fetchone()[0]}")
    cur.execute("SELECT surface, COUNT(*) FROM tennis_ta_cache GROUP BY surface")
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== tennis_matches_internal ===")
cur.execute("SELECT COUNT(*) FROM tennis_matches_internal")
print(f"  Total rows: {cur.fetchone()[0]}")
cur.execute("SELECT MIN(match_date), MAX(match_date) FROM tennis_matches_internal")
r = cur.fetchone()
if r and r[0]:
    print(f"  Date range: {r[0]} to {r[1]}")

print("\n=== SPS top 10 (ATP Hard) ===")
try:
    cur.execute("""
        SELECT p.player_name, p.elo_rating, p.atp_rank, s.sps, s.aptitude_score,
               s.confidence_full, s.matches_played
        FROM player_surface_scores s
        JOIN tennis_players_elo p ON p.player_id = s.player_id
        WHERE s.surface = 'hard' AND UPPER(COALESCE(p.circuit,'')) = 'ATP'
          AND p.elo_rating IS NOT NULL
        GROUP BY s.player_id
        HAVING MAX(s.computed_at)
        ORDER BY s.sps DESC LIMIT 10
    """)
    for r in cur.fetchall():
        print(f"  {r[0]:25s} Elo={r[1]:5.0f} Rank=#{r[2]}  SPS={r[3]:6.2f} Apt={r[4]:6.2f} Conf={r[5]} Matches={r[6]}")
except Exception as e:
    print(f"  Error: {e}")

conn.close()
