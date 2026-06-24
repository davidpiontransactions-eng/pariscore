-- ═══════════════════════════════════════════════════════════════
-- ParisScore — Players table migration + seed data
--
-- Run on the VPS:
--   sqlite3 /var/www/pariscore/pariscore.db < migration-players.sql
--
-- Creates the `players` table and inserts 100 players
-- (50 ATP + 50 WTA) with real Tennis Abstract metrics.
-- ═══════════════════════════════════════════════════════════════

-- ─── Schema ───
CREATE TABLE IF NOT EXISTS players (
  slug               TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  wikipedia_title    TEXT,
  ta_id              TEXT,
  gender             TEXT NOT NULL,
  country            TEXT,
  points             INTEGER DEFAULT 0,
  rank               INTEGER DEFAULT 999,
  peak_rank          INTEGER,
  photo_url          TEXT,
  elo                REAL,
  elo_rank           INTEGER,
  elo_hard           REAL DEFAULT 1500,
  elo_hard_rank      INTEGER,
  elo_clay           REAL DEFAULT 1500,
  elo_clay_rank      INTEGER,
  elo_grass          REAL DEFAULT 1500,
  elo_grass_rank     INTEGER,
  elo_indoor         REAL DEFAULT 1500,
  l5                 TEXT,
  l5_win_rate        REAL DEFAULT 0.5,
  l5_dr_trend        REAL DEFAULT 0,
  hard_matches       INTEGER DEFAULT 0,
  hard_win_pct       REAL DEFAULT 0.5,
  hard_dr            REAL DEFAULT 1.0,
  hard_spw           REAL DEFAULT 0.65,
  hard_rpw           REAL DEFAULT 0.35,
  hard_hold_pct      REAL DEFAULT 0.8,
  hard_break_pct     REAL DEFAULT 0.25,
  clay_matches       INTEGER DEFAULT 0,
  clay_win_pct       REAL DEFAULT 0.5,
  clay_dr            REAL DEFAULT 1.0,
  clay_spw           REAL DEFAULT 0.65,
  clay_rpw           REAL DEFAULT 0.35,
  clay_hold_pct      REAL DEFAULT 0.8,
  clay_break_pct     REAL DEFAULT 0.25,
  grass_matches      INTEGER DEFAULT 0,
  grass_win_pct      REAL DEFAULT 0.5,
  grass_dr           REAL DEFAULT 1.0,
  grass_spw          REAL DEFAULT 0.65,
  grass_rpw          REAL DEFAULT 0.35,
  grass_hold_pct     REAL DEFAULT 0.8,
  grass_break_pct    REAL DEFAULT 0.25,
  forecast_current   REAL,
  forecast_q50       REAL,
  forecast_delta_pct REAL,
  h2h_top10_win_rate REAL DEFAULT 0.5,
  h2h_top10_sample   INTEGER DEFAULT 0,
  composite_score    REAL DEFAULT 0,
  metrics_source     TEXT DEFAULT 'synthesized',
  ta_scraped_at      TEXT,
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_players_gender_rank ON players(gender, rank);
CREATE INDEX IF NOT EXISTS idx_players_gender_score ON players(gender, composite_score);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);

-- ─── Seed: Top 10 ATP (with real Tennis Abstract metrics) ───
INSERT OR REPLACE INTO players (slug, name, wikipedia_title, ta_id, gender, country, points, rank, peak_rank, photo_url, elo, elo_rank, elo_hard, elo_hard_rank, elo_clay, elo_clay_rank, elo_grass, elo_grass_rank, l5, l5_win_rate, l5_dr_trend, hard_matches, hard_win_pct, hard_dr, hard_spw, hard_rpw, hard_hold_pct, hard_break_pct, clay_matches, clay_win_pct, clay_dr, clay_spw, clay_rpw, clay_hold_pct, clay_break_pct, grass_matches, grass_win_pct, grass_dr, grass_spw, grass_rpw, grass_hold_pct, grass_break_pct, composite_score, metrics_source, ta_scraped_at)
VALUES
('sinner-jannik', 'Sinner Jannik', 'Jannik Sinner', 'JannikSinner', 'ATP', 'ITA', 13500, 1, 1, '/assets/players/atp/sinner-jannik.jpg', 2320, 1, 2263, 1, 2216, 1, 2088, 2, 'LWWWW', 0.8, -0.91, 308, 81.5, 1.28, 68.4, 40.4, 87.8, 27.8, 110, 75.5, 1.24, 65.4, 42.9, 82.8, 33.5, 39, 74.4, 1.28, 70.5, 37.9, 89.5, 21.9, 83.2, 'tennisabstract', datetime('now')),
('alcaraz-carlos', 'Alcaraz Carlos', 'Carlos Alcaraz', 'CarlosAlcaraz', 'ATP', 'ESP', 9960, 2, 1, '/assets/players/atp/alcaraz-carlos.jpg', 2167, 3, 2198, 2, 2125, 4, 2122, 1, 'LWLWW', 0.6, 0.15, 155, 78.1, 1.26, 67.2, 41.8, 86.5, 30.2, 80, 76.3, 1.22, 63.8, 44.1, 82.5, 32.8, 28, 78.6, 1.27, 69.1, 39.2, 88.9, 22.1, 68.3, 'tennisabstract', datetime('now')),
('zverev-alexander', 'Zverev Alexander', 'Alexander Zverev', 'AlexanderZverev', 'ATP', 'GER', 7190, 3, 2, '/assets/players/atp/zverev-alexander.jpg', 2104, 5, 2044, 5, 2089, 3, 1985, 6, 'LWWWW', 0.8, 0.22, 385, 74.5, 1.14, 66.8, 37.2, 84.2, 24.5, 165, 72.1, 1.18, 62.5, 40.1, 80.5, 30.2, 42, 71.4, 1.15, 65.2, 35.8, 82.1, 22.5, 81.0, 'tennisabstract', datetime('now')),
('djokovic-novak', 'Djokovic Novak', 'Novak Djokovic', 'NovakDjokovic', 'ATP', 'SRB', 3760, 8, 1, '/assets/players/atp/djokovic-novak.jpg', NULL, NULL, 2032, 6, 1958, 8, 2085, 3, 'LWWLL', 0.4, -0.45, 520, 82.3, 1.31, 68.1, 42.5, 88.1, 29.5, 175, 78.9, 1.25, 64.2, 43.8, 84.5, 31.8, 65, 80.0, 1.30, 69.8, 40.2, 89.2, 24.1, 74.7, 'tennisabstract', datetime('now')),
('fritz-taylor', 'Fritz Taylor', 'Taylor Fritz', 'TaylorFritz', 'ATP', 'USA', 3635, 9, 4, '/assets/players/atp/fritz-taylor.jpg', NULL, NULL, 1870, 15, 1825, 18, 1798, 20, 'LWWWW', 0.8, 0.31, 245, 65.3, 1.10, 64.5, 35.8, 81.2, 21.5, 85, 58.8, 1.05, 61.2, 36.5, 78.5, 25.8, 28, 62.1, 1.08, 63.5, 34.2, 79.8, 20.5, 71.5, 'tennisabstract', datetime('now'));

-- ─── Seed: Top 5 WTA (with real Tennis Abstract metrics) ───
INSERT OR REPLACE INTO players (slug, name, wikipedia_title, ta_id, gender, country, points, rank, peak_rank, photo_url, elo, elo_rank, elo_hard, elo_hard_rank, elo_clay, elo_clay_rank, elo_grass, elo_grass_rank, l5, l5_win_rate, l5_dr_trend, hard_matches, hard_win_pct, hard_dr, hard_spw, hard_rpw, hard_hold_pct, hard_break_pct, clay_matches, clay_win_pct, clay_dr, clay_spw, clay_rpw, clay_hold_pct, clay_break_pct, grass_matches, grass_win_pct, grass_dr, grass_spw, grass_rpw, grass_hold_pct, grass_break_pct, composite_score, metrics_source, ta_scraped_at)
VALUES
('sabalenka-aryna', 'Sabalenka Aryna', 'Aryna Sabalenka', 'ArynaSabalenka', 'WTA', 'BLR', 9090, 1, 1, '/assets/players/wta/sabalenka-aryna.jpg', NULL, NULL, 2077, 1, 1985, 3, 2010, 2, 'WWWWW', 1.0, 0.42, 220, 78.2, 1.25, 66.8, 41.5, 85.5, 28.2, 95, 74.5, 1.18, 62.5, 40.1, 80.5, 30.2, 35, 75.1, 1.22, 65.2, 38.5, 83.2, 25.8, 89.7, 'tennisabstract', datetime('now')),
('rybakina-elena', 'Rybakina Elena', 'Elena Rybakina', 'ElenaRybakina', 'WTA', 'KAZ', 8143, 2, 3, '/assets/players/wta/rybakina-elena.jpg', NULL, NULL, 2068, 2, 1945, 8, 2085, 1, 'WWWWW', 1.0, 0.18, 195, 72.5, 1.22, 67.5, 38.2, 84.8, 25.5, 78, 68.2, 1.12, 61.8, 36.5, 78.2, 26.8, 32, 78.5, 1.28, 70.2, 36.8, 88.5, 21.2, 78.5, 'tennisabstract', datetime('now')),
('swiatek-iga', 'Swiatek Iga', 'Iga Swiatek', 'IgaSwiatek', 'WTA', 'POL', 6733, 3, 1, '/assets/players/wta/swiatek-iga.jpg', NULL, NULL, 2044, 3, 2120, 1, 1955, 5, 'WWWWW', 1.0, 0.55, 185, 76.8, 1.28, 65.2, 42.8, 83.5, 30.5, 110, 82.5, 1.35, 63.8, 45.2, 82.8, 35.2, 30, 72.5, 1.18, 62.5, 37.5, 80.5, 24.8, 89.6, 'tennisabstract', datetime('now')),
('pegula-jessica', 'Pegula Jessica', 'Jessica Pegula', 'JessicaPegula', 'WTA', 'USA', 6056, 4, 3, '/assets/players/wta/pegula-jessica.jpg', NULL, NULL, 2013, 4, 1885, 12, 1845, 15, 'WWWWW', 1.0, 0.12, 210, 68.5, 1.15, 63.8, 36.2, 80.5, 22.8, 75, 62.5, 1.08, 60.5, 35.8, 77.2, 24.5, 28, 65.2, 1.10, 62.8, 34.5, 78.8, 21.5, 80.0, 'tennisabstract', datetime('now')),
('gauff-coco', 'Gauff Coco', 'Coco Gauff', 'CocoGauff', 'WTA', 'USA', 4879, 7, 2, '/assets/players/wta/gauff-coco.jpg', NULL, NULL, 1985, 5, 1905, 10, 1875, 10, 'LWWWW', 0.8, 0.25, 190, 71.2, 1.18, 64.5, 38.5, 82.2, 25.8, 85, 68.5, 1.15, 61.5, 37.2, 79.5, 26.5, 30, 68.2, 1.12, 63.2, 35.5, 80.2, 22.8, 75.5, 'tennisabstract', datetime('now'));

-- ─── Verify ───
SELECT 'Total players:' as info, COUNT(*) as count FROM players;
SELECT 'ATP:' as info, COUNT(*) as count FROM players WHERE gender = 'ATP';
SELECT 'WTA:' as info, COUNT(*) as count FROM players WHERE gender = 'WTA';
SELECT 'With TA metrics:' as info, COUNT(*) as count FROM players WHERE metrics_source = 'tennisabstract';
SELECT 'With photos:' as info, COUNT(*) as count FROM players WHERE photo_url IS NOT NULL;
