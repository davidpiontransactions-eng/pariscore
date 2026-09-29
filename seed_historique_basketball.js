#!/usr/bin/env node
/**
 * seed_historique_basketball.js — Pipeline ETL Historique Basketball
 * ───────────────────────────────────────────────────────────────────
 * Mission: enrichissement bases matchs basketball (suite calendrier basket
 * 2026-09-29). Peuple pariscore.db → table `basketball_match_history`
 * (miroir handball_match_history) consommable par routes/backtests/H2H.
 *
 * SOURCES (validées live 2026-09-29) :
 *  ✓ NBA + WNBA : ESPN site.web.api.espn.com scoreboard ?dates=YYYYMMDD
 *    (1 req/jour — le range "A-B" renvoie 0 ; host réparé le 2026-09-29 :
 *    site.api.espn.com est bloqué 403 par le WAF, site.web passe)
 *  ✓ EuroLeague + EuroCup : api-live.euroleague.net/v2/competitions/{E|U}/
 *    seasons/{S}/games — 1 req/saison-compétition, scores + quart-temps +
 *    codes clubs + utcDate (zero-auth). NB : euroleague_api 0.1.1 (pip)
 *    n'expose PAS EuroLeagueAPI — d'où l'appel HTTP direct.
 *
 * VOLUMES ATTENDUS (~7 000 matchs) :
 *   NBA  3 saisons + pré-saison 2026   ≈ 3 900
 *   WNBA 3 saisons (2024-2026)         ≈   900
 *   EuroLeague E2022→E2026             ≈ 1 800
 *   EuroCup   U2022→U2026              ≈   900
 *
 * USAGE :
 *   node seed_historique_basketball.js                     # tout
 *   node seed_historique_basketball.js --leagues nba,euro  # sous-ensemble
 *   node seed_historique_basketball.js --dry               # comptage sans écriture
 *   node seed_historique_basketball.js --throttle=250      # politesse ESPN
 *
 * NOTES :
 *   - Upser t idempotent (ON CONFLICT(key) DO UPDATE) → re-run sûr.
 *   - Matchs finis uniquement (scores confirmés) — les futurs sont ignorés.
 *   - Quarts conservés en JSON (linescores ESPN / partials EuroLeague).
 */

const path = require('path');
const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────
const DB_FILE = (process.env.DATABASE_PATH || path.join(__dirname, 'pariscore.db'));
const ESPN_HOST = 'site.web.api.espn.com'; // PAS site.api (403 WAF, cf. entry 97)
const EURO_HOST = 'api-live.euroleague.net';
const THROTTLE_MS = argNumber('throttle', 150);
const DRY = process.argv.includes('--dry');
const LEAGUES = (argString('leagues', 'nba,wnba,euro,eurocup').split(',').map(s => s.trim()).filter(Boolean));

// Ranges de jours ESPN (heures US → on balaie large, les jours vides sont gratuits)
const ESPN_RANGES = {
  nba: [
    ['2023-10-01', '2024-07-31'], // saison 2023-24 + playoffs
    ['2024-10-01', '2025-07-31'], // saison 2024-25 + playoffs
    ['2025-10-01', '2026-07-31'], // saison 2025-26 + playoffs
    ['2026-09-15', null],         // pré-saison 2026-27 → aujourd'hui
  ],
  wnba: [
    ['2024-05-01', '2024-10-31'],
    ['2025-05-01', '2025-10-31'],
    ['2026-05-01', null],         // playoffs 2026 en cours → aujourd'hui
  ],
};

// Saison-compétitions EuroLeague (codes = année de DÉBUT de saison)
const EURO_SEASONS = (comp) => [2022, 2023, 2024, 2025, 2026].map(y => `${comp}${y}`);

// ─── CLI helpers ──────────────────────────────────────────────────────────────
function argString(name, def) {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : def;
}
function argNumber(name, def) {
  const v = parseInt(argString(name, ''), 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── HTTP ─────────────────────────────────────────────────────────────────────
function httpsGet(url, headers) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: headers || { 'User-Agent': 'Mozilla/5.0 PariScore', 'Accept': 'application/json', 'Accept-Encoding': 'identity' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, json: null }); }
      });
    });
    req.on('error', () => resolve({ status: 0, json: null }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, json: null }); });
  });
}

// ─── SQLite (bun:sqlite sous bun, better-sqlite3 sous node) ───────────────────
function openDb() {
  try {
    const { Database } = require('bun:sqlite');
    return new Database(DB_FILE);
  } catch {
    const mod = require('better-sqlite3');
    const Database = mod.default || mod;
    return new Database(DB_FILE);
  }
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS basketball_match_history (
      key           TEXT PRIMARY KEY,
      date          TEXT NOT NULL,
      time_utc      TEXT,
      home          TEXT NOT NULL,
      away          TEXT NOT NULL,
      home_key      TEXT NOT NULL,
      away_key      TEXT NOT NULL,
      home_score    INTEGER NOT NULL,
      away_score    INTEGER NOT NULL,
      home_quarters TEXT,
      away_quarters TEXT,
      league        TEXT,
      season        TEXT,
      round         TEXT,
      venue         TEXT,
      winner_key    TEXT,
      src           TEXT NOT NULL,
      first_seen    TEXT NOT NULL,
      last_seen     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bmh_date ON basketball_match_history(date);
    CREATE INDEX IF NOT EXISTS idx_bmh_league ON basketball_match_history(league);
    CREATE INDEX IF NOT EXISTS idx_bmh_league_date ON basketball_match_history(league, date);
  `);
}

const UPSERT = `
  INSERT INTO basketball_match_history
    (key, date, time_utc, home, away, home_key, away_key, home_score, away_score,
     home_quarters, away_quarters, league, season, round, venue, winner_key, src,
     first_seen, last_seen)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    home_score = excluded.home_score, away_score = excluded.away_score,
    home_quarters = excluded.home_quarters, away_quarters = excluded.away_quarters,
    round = excluded.round, venue = excluded.venue, winner_key = excluded.winner_key,
    last_seen = excluded.last_seen
`;

function upsert(db, m) {
  const now = new Date().toISOString();
  db.prepare(UPSERT).run(
    m.key, m.date, m.time_utc, m.home, m.away, m.home_key, m.away_key,
    m.home_score, m.away_score, m.home_quarters, m.away_quarters,
    m.league, m.season, m.round, m.venue, m.winner_key, m.src, now, now,
  );
}

// ─── Dates ────────────────────────────────────────────────────────────────────
function* dayRange(fromStr, toStr) {
  const end = toStr ? new Date(toStr + 'T12:00:00Z') : new Date();
  const d = new Date(fromStr + 'T12:00:00Z');
  while (d <= end) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
const ymd = (isoDate) => isoDate.slice(0, 10);

// ─── Source ESPN (NBA/WNBA) ───────────────────────────────────────────────────
async function seedEspn(league, slug, db, stats) {
  const ranges = ESPN_RANGES[slug];
  const url = `https://${ESPN_HOST}/apis/site/v2/sports/basketball/${slug}/scoreboard?dates=`;
  for (const [from, to] of ranges) {
    for (const day of dayRange(from, to)) {
      stats.days++;
      const { status, json } = await httpsGet(url + day.replaceAll('-', ''));
      if (status !== 200 || !json || !Array.isArray(json.events)) {
        stats.emptyDays++;
        continue;
      }
      for (const ev of json.events) {
        stats.seen++;
        try {
          const comp = (ev.competitions && ev.competitions[0]) || {};
          const cs = comp.competitors || [];
          const home = cs.find(c => c.homeAway === 'home') || cs[0];
          const away = cs.find(c => c.homeAway === 'away') || cs[1];
          if (!home || !away) { stats.skipped++; continue; }
          if (ev.status && ev.status.type && ev.status.type.completed !== true) { stats.skipped++; continue; }
          const hs = parseInt(home.score, 10);
          const as = parseInt(away.score, 10);
          if (!Number.isFinite(hs) || !Number.isFinite(as)) { stats.skipped++; continue; }
          const ls = (c) => Array.isArray(c.linescores) ? JSON.stringify(c.linescores.map(l => l.value)) : null;
          const winner = home.winner ? home.team.abbreviation : (away.winner ? away.team.abbreviation : null);
          stats.stored++;
          if (!DRY) {
            upsert(db, {
              key: `${slug}-${ev.id}`,
              date: ymd(ev.date),
              time_utc: ev.date,
              home: home.team.displayName || home.team.name || '?',
              away: away.team.displayName || away.team.name || '?',
              home_key: (home.team.abbreviation || home.team.displayName || '?').toUpperCase(),
              away_key: (away.team.abbreviation || away.team.displayName || '?').toUpperCase(),
              home_score: hs, away_score: as,
              home_quarters: ls(home), away_quarters: ls(away),
              league, season: String((ev.season && ev.season.year) || ymd(ev.date).slice(0, 4)),
              round: (ev.season && ev.season.type != null) ? `type${ev.season.type}` : null,
              venue: (comp.venue && comp.venue.fullName) || null,
              winner_key: winner ? winner.toUpperCase() : null,
              src: `espn-${slug}`,
            });
          }
        } catch (e) {
          stats.errors++;
          if (stats.errors <= 3) console.warn(`  [${slug}] parse err ${ev && ev.id}: ${e.message}`);
        }
      }
      await sleep(THROTTLE_MS);
    }
  }
}

// ─── Source EuroLeague (E/U) ──────────────────────────────────────────────────
async function seedEuro(compCode, league, db, stats) {
  for (const seasonCode of EURO_SEASONS(compCode)) {
    stats.days++;
    const url = `https://${EURO_HOST}/v2/competitions/${compCode}/seasons/${seasonCode}/games`;
    const { status, json } = await httpsGet(url);
    if (status !== 200 || !json || !Array.isArray(json.data)) {
      stats.emptyDays++;
      continue;
    }
    for (const g of json.data) {
      stats.seen++;
      try {
        const L = g.local || {}, R = g.road || {};
        const lh = L.club || {}, rh = R.club || {};
        // À venir : l'API renvoie score=0 + winner par défaut sur les matchs non
        // joués (594 placeholders détectés en prod 2026-09-29) → un match de
        // basket FINI a toujours un score > 0.
        if (L.score == null || R.score == null) { stats.skipped++; continue; }
        if (!(Number(L.score) > 0 || Number(R.score) > 0)) { stats.skipped++; continue; }
        const partials = (p) => {
          if (!p) return null;
          const arr = [p.partials1, p.partials2, p.partials3, p.partials4];
          const ot = p.extraPeriods;
          if (ot && typeof ot === 'object') for (const k of Object.keys(ot).sort()) arr.push(ot[k]);
          return JSON.stringify(arr);
        };
        stats.stored++;
        if (!DRY) {
          upsert(db, {
            key: `${compCode === 'E' ? 'euro' : 'ucup'}-${seasonCode}-${g.gameCode}`,
            date: ymd(g.utcDate || ''),
            time_utc: g.utcDate || null,
            home: lh.name || '?', away: rh.name || '?',
            home_key: lh.code || '?', away_key: rh.code || '?',
            home_score: L.score, away_score: R.score,
            home_quarters: partials(L.partials), away_quarters: partials(R.partials),
            league, season: seasonCode,
            round: g.round != null ? String(g.round) : null,
            venue: (g.venue && (g.venue.name || g.venue)) || null,
            winner_key: (g.winner && g.winner.code) || (L.score > R.score ? lh.code : rh.code) || null,
            src: 'euroleague-api',
          });
        }
      } catch (e) {
        stats.errors++;
        if (stats.errors <= 3) console.warn(`  [${league}] parse err ${g && g.gameCode}: ${e.message}`);
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`seed_historique_basketball — DB=${DB_FILE}${DRY ? ' [DRY]' : ''} leagues=[${LEAGUES.join(',')}] throttle=${THROTTLE_MS}ms`);
  let db = null;
  if (!DRY) {
    db = openDb();
    db.exec('PRAGMA busy_timeout = 5000');
    ensureSchema(db);
  }

  const mk = () => ({ days: 0, emptyDays: 0, seen: 0, stored: 0, skipped: 0, errors: 0 });

  if (LEAGUES.includes('nba')) { const s = mk(); await seedEspn('NBA', 'nba', db, s); report('NBA', s); }
  if (LEAGUES.includes('wnba')) { const s = mk(); await seedEspn('WNBA', 'wnba', db, s); report('WNBA', s); }
  if (LEAGUES.includes('euro')) { const s = mk(); await seedEuro('E', 'EuroLeague', db, s); report('EuroLeague', s); }
  if (LEAGUES.includes('eurocup')) { const s = mk(); await seedEuro('U', 'EuroCup', db, s); report('EuroCup', s); }

  if (!DRY) {
    const rows = db.prepare('SELECT league, COUNT(*) n, MIN(date) min, MAX(date) max FROM basketball_match_history GROUP BY league ORDER BY league').all();
    console.log('\n─── basketball_match_history ───');
    let total = 0;
    for (const r of rows) { total += r.n; console.log(`  ${(r.league || '?').padEnd(12)} ${String(r.n).padStart(6)}  (${r.min} → ${r.max})`); }
    console.log(`  ${'TOTAL'.padEnd(12)} ${String(total).padStart(6)}`);
    db.close();
  }
}

function report(label, s) {
  console.log(`[${label}] jours=${s.days} (vides=${s.emptyDays}) vus=${s.seen} stockés=${s.stored} ignorés=${s.skipped} erreurs=${s.errors}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e); process.exit(1); });
