"""Check tennis DB schema for rank columns."""
import sqlite3

conn = sqlite3.connect("/home/ubuntu/pariscore/pariscore.db")
cur = conn.cursor()

cur.execute("PRAGMA table_info(tennis_matches)")
print("=== tennis_matches columns ===")
for c in cur.fetchall():
    print(f"  {c[1]:30s} {c[2]:20s} nullable={c[3]}")

cur.execute("SELECT COUNT(*) FROM tennis_matches WHERE winner_rank IS NOT NULL AND winner_rank > 0")
print(f"\nwinner_rank filled: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM tennis_matches WHERE loser_rank IS NOT NULL AND loser_rank > 0")
print(f"loser_rank filled:  {cur.fetchone()[0]}")

cur.execute("SELECT winner_rank, winner_name FROM tennis_matches WHERE winner_rank IS NOT NULL ORDER BY winner_rank ASC LIMIT 5")
print("\nSample winner ranks:")
for r in cur.fetchall():
    print(f"  #{r[0]} {r[1]}")

cur.execute("SELECT COUNT(*) FROM tennis_matches")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(DISTINCT winner_name) FROM tennis_matches WHERE winner_rank IS NOT NULL")
print(f"\nTotal matches: {total}")
print(f"Unique winners with rank: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(DISTINCT loser_name) FROM tennis_matches WHERE loser_rank IS NOT NULL")
print(f"Unique losers with rank:  {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(DISTINCT name) FROM (SELECT winner_name AS name FROM tennis_matches WHERE winner_rank IS NOT NULL UNION SELECT loser_name AS name FROM tennis_matches WHERE loser_rank IS NOT NULL)")
print(f"Unique players with a rank: {cur.fetchone()[0]}")

conn.close()
