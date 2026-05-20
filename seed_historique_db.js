/**
 * seed_historique_db.js — Pipeline ETL Historique Football
 * ──────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-9je
 * Objectif: peupler une Data Warehouse historique pour l'onglet Historique.
 *
 * STRATEGIE SOURCING (decision finale):
 * ✓ Source primaire: API-Football PRO (deja paye, 7500 req/jour)
 *   → fiable, structured JSON, latence minimale, ToS clean
 * ✓ Source backup: openfootball/football.json (GitHub) pour gap fill
 *   → public domain, JSON deja format, snapshot annuel
 * ✗ Scraper fbref.com → bypass Cloudflare fragile + ToS gris
 * ✗ Kaggle dumps → outdated (souvent 2023 max)
 *
 * ARCHITECTURE:
 *   API-Football fixtures + statistics + odds → historique_football.json
 *   { schema_version, generated_at, leagues: { <league_id>: { season, matches: [...] } } }
 *
 * USAGE:
 *   node seed_historique_db.js                       # tout (default)
 *   node seed_historique_db.js --league 61            # Ligue 1 seul
 *   node seed_historique_db.js --season 2025          # saison specifique
 *   node seed_historique_db.js --sample-pl            # echantillon Premier League pour validation
 *
 * QUOTA-AWARE:
 *   Respecte rate-limit API-Football PRO (7500/jour). Throttle 200ms entre requetes.
 *   Stop early si quota < 100 requests remaining.
 *
 * STATUT: SCAFFOLD initial. Implementation full reste a faire (bd 9je P0).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {
  console.error('[ETL] .env introuvable — abandon');
  process.exit(1);
}

const API_FOOTBALL_KEY = ENV.API_FOOTBALL_KEY;
if (!API_FOOTBALL_KEY) {
  console.error('[ETL] API_FOOTBALL_KEY manquante dans .env — abandon');
  process.exit(1);
}

const OUTPUT_FILE = path.join(__dirname, 'historique_football.json');
const THROTTLE_MS = 200;
const QUOTA_SAFETY_MARGIN = 100;

// Ligues prioritaires (T1 high-value coverage)
const PRIORITY_LEAGUES = [
  { id: 39,  name: 'Premier League',   country: 'England'  },
  { id: 61,  name: 'Ligue 1',          country: 'France'   },
  { id: 78,  name: 'Bundesliga',       country: 'Germany'  },
  { id: 135, name: 'Serie A',          country: 'Italy'    },
  { id: 140, name: 'La Liga',          country: 'Spain'    },
  { id: 88,  name: 'Eredivisie',       country: 'Netherlands' },
  { id: 94,  name: 'Primeira Liga',    country: 'Portugal' },
  { id: 71,  name: 'Brasileirão',      country: 'Brazil'   },
  { id: 2,   name: 'Champions League', country: 'Europe'   },
];

const CURRENT_SEASON = (function () {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
})();

// ── HTTP helper ─────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'x-apisports-key': API_FOOTBALL_KEY }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data),
          });
        } catch (e) {
          reject(new Error('JSON parse: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Quota tracking ──────────────────────────────────────────────────────────
let _quotaRemaining = null;
function readQuota(headers) {
  const r = parseInt(headers['x-ratelimit-requests-remaining'] || headers['x-ratelimit-remaining'], 10);
  if (Number.isFinite(r)) _quotaRemaining = r;
}

// ── Fetch fixtures by league + season ───────────────────────────────────────
async function fetchFixturesByLeague(leagueId, season) {
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&status=FT-AET-PEN`;
  const res = await httpsGet(url);
  readQuota(res.headers);
  if (res.status !== 200) {
    console.warn(`[ETL] League ${leagueId} season ${season}: HTTP ${res.status}`);
    return [];
  }
  return res.data?.response || [];
}

// ── Transform raw fixture → match record ────────────────────────────────────
function transformFixture(raw) {
  if (!raw || !raw.fixture || !raw.teams) return null;
  const home = raw.teams.home;
  const away = raw.teams.away;
  const score = raw.score?.fulltime || raw.goals || {};
  return {
    id: `af_${raw.fixture.id}`,
    source: 'api-football',
    league_id: raw.league?.id,
    league_name: raw.league?.name,
    country: raw.league?.country,
    season: raw.league?.season,
    round: raw.league?.round,
    date: raw.fixture.date,
    timestamp: raw.fixture.timestamp,
    home_team: home?.name,
    home_team_id: home?.id,
    home_logo: home?.logo,
    away_team: away?.name,
    away_team_id: away?.id,
    away_logo: away?.logo,
    home_score: typeof score.home === 'number' ? score.home : null,
    away_score: typeof score.away === 'number' ? score.away : null,
    status: raw.fixture.status?.short,
    venue: raw.fixture.venue?.name,
    referee: raw.fixture.referee,
  };
}

// ── Main ETL ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const sample = args.includes('--sample-pl');
  const leagueArg = args.find(a => a.startsWith('--league'));
  const seasonArg = args.find(a => a.startsWith('--season'));
  const targetLeagueId = leagueArg ? parseInt(leagueArg.split('=')[1] || args[args.indexOf(leagueArg) + 1], 10) : null;
  const targetSeason = seasonArg ? parseInt(seasonArg.split('=')[1] || args[args.indexOf(seasonArg) + 1], 10) : CURRENT_SEASON;

  let leagues = PRIORITY_LEAGUES;
  if (sample) {
    leagues = [PRIORITY_LEAGUES[0]]; // Premier League seule
    console.log('[ETL] Mode sample-pl: Premier League uniquement');
  } else if (targetLeagueId) {
    leagues = PRIORITY_LEAGUES.filter(l => l.id === targetLeagueId);
    if (!leagues.length) {
      console.error('[ETL] League id', targetLeagueId, 'non dans PRIORITY_LEAGUES');
      process.exit(1);
    }
  }

  console.log(`[ETL] Demarrage — ${leagues.length} ligues, saison ${targetSeason}`);
  console.log(`[ETL] Output: ${OUTPUT_FILE}`);

  const existingDB = (() => {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); }
    catch (e) { return { schema_version: 1, generated_at: null, leagues: {} }; }
  })();

  let totalIngested = 0;
  for (const league of leagues) {
    if (_quotaRemaining !== null && _quotaRemaining < QUOTA_SAFETY_MARGIN) {
      console.warn(`[ETL] Quota < ${QUOTA_SAFETY_MARGIN} — arret early. Reprend demain.`);
      break;
    }
    console.log(`[ETL] ${league.name} (id=${league.id}) saison ${targetSeason}...`);
    const rawFixtures = await fetchFixturesByLeague(league.id, targetSeason);
    const transformed = rawFixtures.map(transformFixture).filter(Boolean);
    existingDB.leagues[league.id] = {
      meta: { ...league, season: targetSeason, last_update: new Date().toISOString() },
      matches: transformed,
    };
    totalIngested += transformed.length;
    console.log(`[ETL]   → ${transformed.length} matchs ingere (quota remaining: ${_quotaRemaining ?? 'n/a'})`);
    await sleep(THROTTLE_MS);
  }

  existingDB.generated_at = new Date().toISOString();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingDB, null, 2));
  console.log(`[ETL] OK — ${totalIngested} matchs ingere total — sauvegarde ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('[ETL] ERREUR:', e.message);
    process.exit(1);
  });
}

module.exports = { main, transformFixture, fetchFixturesByLeague };
