/**
 * USAGE:
 *   node seed_historique_bsd_corners.js          # tout (toutes ligues, 3 saisons)
 *   node seed_historique_bsd_corners.js --dry   # dry run (log uniquement, pas d'insert)
 *   node seed_historique_bsd_corners.js --league 1 # une seule league BSD ID
 *
 * ÉTAPE ETL : extrait les coins (corner_kicks) depuis l'API BSD pour 3 saisons
 * et les stocke dans la table SQLite corner_history.
 *
 * Saisons crawlées : 2023-2024, 2024-2025, 2025-2026
 * Ligues : toutes celles définies dans bsd_config.json mapping
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const Database = require('better-sqlite3');

// ── Config ────────────────────────────────────────────────────────────────────
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {
  console.error('[CORNERS-ETL] .env introuvable — abandon');
  process.exit(1);
}

const BSD_API_KEY = ENV.BSD_API_KEY;
const BSD_BASE_URL = 'https://sports.bzzoiro.com/api';
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'pariscore.db');
const THROTTLE_MS = 300;

// Ligues BSD depuis bsd_config.json (bsd_to_config keys triées)
const BSD_LEAGUE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 17, 18, 19, 20,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  32, 33, 34, 35, 36, 38, 39, 40, 41, 42,
  43, 44, 46, 47, 48, 49, 50, 51, 52, 53,
  54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
  64, 65, 66, 67, 68, 69
];

// Saisons à crawler
const SEASONS = [
  { start: '2023-08-01', end: '2024-07-31', label: '2023-2024' },
  { start: '2024-08-01', end: '2025-07-31', label: '2024-2025' },
  { start: '2025-08-01', end: '2026-07-31', label: '2025-2026' },
];

// ── CLI args ──────────────────────────────────────────────────────────────────
const isDry = process.argv.includes('--dry');
const leagueArg = process.argv.find(a => a.startsWith('--league'));
const targetLeague = leagueArg ? parseInt(leagueArg.split('=')[1], 10) : null;

const leaguesToProcess = targetLeague !== null
  ? [targetLeague]
  : BSD_LEAGUE_IDS;

if (targetLeague !== null) {
  console.log(`[CORNERS-ETL] Mode single league — BSD ID ${targetLeague} uniquement`);
}
if (isDry) {
  console.log('[CORNERS-ETL] Mode DRY RUN — aucune insertion en base');
}

// ── BSD Fetch ────────────────────────────────────────────────────────────────
function bsdFetch(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${BSD_BASE_URL}${endpoint}`;
    const req = https.get(url, {
      headers: {
        'Authorization': `Token ${BSD_API_KEY}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // BSD API wrappe dans { data: { results: [...] } }
          resolve(parsed);
        } catch (e) {
          reject(new Error('JSON parse error: ' + e.message + ' | data: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ── Pause utilitaire ─────────────────────────────────────────────────────────
const pause = ms => new Promise(r => setTimeout(r, ms));

// ── Main ETL ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('[CORNERS-ETL] Démarrage — ligues:', leaguesToProcess.length, '| saisons:', SEASONS.length);
  console.log('[CORNERS-ETL] DB:', DB_PATH);

  const db = new Database(DB_PATH);

  // Crée la table si pas existante
  db.exec(`CREATE TABLE IF NOT EXISTS corner_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bsd_event_id TEXT UNIQUE NOT NULL,
    bsd_league_id TEXT NOT NULL,
    match_date TEXT NOT NULL,
    season TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_corners INTEGER,
    away_corners INTEGER,
    total_corners INTEGER,
    fetched_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  // Index pour requêtes rapides par équipe / date / saison
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ch_team ON corner_history(home_team, away_team)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ch_date ON corner_history(match_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ch_season ON corner_history(season)`);

  const insertStmt = db.prepare(`INSERT OR IGNORE INTO corner_history
    (bsd_event_id, bsd_league_id, match_date, season, home_team, away_team, home_corners, away_corners, total_corners)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const leagueId of leaguesToProcess) {
    for (const season of SEASONS) {
      try {
        const params = new URLSearchParams({
          date_from: season.start,
          date_to: season.end,
          league: String(leagueId),
          status: 'finished'
        });
        const endpoint = `/events/?${params.toString()}`;
        console.log(`[CORNERS-ETL] League ${leagueId} | ${season.label} — fetch...`);

        const res = await bsdFetch(endpoint);

        // Navigation flexible : BSD peut répondre { data: { results } } ou { results } directement
        const results = res?.data?.results ?? res?.results ?? [];

        if (!results.length) {
          console.log(`[CORNERS-ETL]   League ${leagueId} | ${season.label} : 0 matchs`);
          await pause(THROTTLE_MS);
          continue;
        }

        let count = 0;
        for (const event of results) {
          // Vérifie que les données de coins existent
          const homeStats = event.live_stats?.home;
          const awayStats = event.live_stats?.away;

          if (!homeStats?.corner_kicks) {
            totalSkipped++;
            continue;
          }

          const homeCorners = homeStats.corner_kicks ?? 0;
          const awayCorners = awayStats?.corner_kicks ?? 0;
          const totalCorners = homeCorners + awayCorners;

          // Extraction propre de la date ISO (YYYY-MM-DD) — bd sc0o: event.date
          // était vide sur les payloads BSD réels (2178 rows match_date='') →
          // chaîne défensive sur les champs date connus BSD.
          const rawDate = event.date || event.event_date || event.start_time || event.start_at || '';
          const matchDate = rawDate ? String(rawDate).split('T')[0] : '';

          if (isDry) {
            console.log(`  [DRY] ${event.id} | ${matchDate} | ${event.home_team} vs ${event.away_team} → ${homeCorners}A${awayCorners} (total: ${totalCorners})`);
          } else {
            insertStmt.run(
              String(event.id),
              String(leagueId),
              matchDate,
              season.label,
              event.home_team || '',
              event.away_team || '',
              homeCorners,
              awayCorners,
              totalCorners
            );
          }
          count++;
          totalInserted++;
        }

        console.log(`[CORNERS-ETL]   League ${leagueId} | ${season.label} : ${count} matchs avec corners`);
        await pause(THROTTLE_MS);

      } catch (e) {
        totalErrors++;
        console.error(`[CORNERS-ETL]   League ${leagueId} | ${season.label} ERROR: ${e.message}`);
        await pause(THROTTLE_MS);
      }
    }
  }

  console.log('\n[CORNERS-ETL] === RÉSULTAT FINAL ===');
  console.log(`[CORNERS-ETL] Insertions : ${totalInserted}`);
  console.log(`[CORNERS-ETL] Skipped (pas de corners) : ${totalSkipped}`);
  console.log(`[CORNERS-ETL] Erreurs : ${totalErrors}`);
  console.log(`[CORNERS-ETL] Terminé`);

  db.close();
}

main().catch(e => {
  console.error('[CORNERS-ETL] FATAL:', e.message);
  process.exit(1);
});