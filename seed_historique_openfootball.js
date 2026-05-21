/**
 * seed_historique_openfootball.js — ETL via openfootball/football.json
 * ────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-6du6 — Alternative legal safe vs API-Football quota
 *
 * SOURCE: https://github.com/openfootball/football.json
 *   - Repo CC0 / ODbL — commercial use OK avec attribution
 *   - Couverture: Big5 European leagues + UCL/UEL, depuis 2010+
 *   - Format: JSON par saison + ligue
 *   - Raw URLs: https://raw.githubusercontent.com/openfootball/football.json/master/<season>/<league>.json
 *
 * USAGE:
 *   node seed_historique_openfootball.js                       # default seasons + leagues
 *   node seed_historique_openfootball.js --season 2024-25      # saison specifique
 *   node seed_historique_openfootball.js --league en.1         # PL only
 *   node seed_historique_openfootball.js --all-seasons         # 2020-25 backlog
 *
 * OUTPUT: historique_openfootball.json compatible loadHistory v12.26
 *
 * LICENSE: pas de quota API. Single GitHub raw fetch per league/season.
 * ATTRIBUTION dans UI Historique tab "Source: openfootball/football.json (ODbL)".
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const OUTPUT_FILE = path.join(__dirname, 'historique_openfootball.json');
const RAW_BASE = 'https://raw.githubusercontent.com/openfootball/football.json/master';
const THROTTLE_MS = 200;

// Ligues officiellement supportees par openfootball
const LEAGUES = [
  { id: 'en.1', name: 'Premier League',   country: 'England'     },
  { id: 'en.2', name: 'Championship',     country: 'England'     },
  { id: 'es.1', name: 'La Liga',          country: 'Spain'       },
  { id: 'de.1', name: 'Bundesliga',       country: 'Germany'     },
  { id: 'de.2', name: 'Bundesliga 2',     country: 'Germany'     },
  { id: 'it.1', name: 'Serie A',          country: 'Italy'       },
  { id: 'fr.1', name: 'Ligue 1',          country: 'France'      },
  { id: 'nl.1', name: 'Eredivisie',       country: 'Netherlands' },
  { id: 'pt.1', name: 'Primeira Liga',    country: 'Portugal'    },
  { id: 'champions-league', name: 'UEFA Champions League', country: 'Europe' },
  { id: 'europa-league',    name: 'UEFA Europa League',    country: 'Europe' },
];

const DEFAULT_SEASONS = ['2024-25', '2023-24', '2022-23', '2021-22', '2020-21'];

// ── HTTP helper ─────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'PariScore-ETL/1.0 (+https://pariscore.fr)' } }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode === 404) return resolve({ status: 404, data: null });
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null });
        }
      });
    }).on('error', reject);
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Fetch league + season ───────────────────────────────────────────────────
async function fetchLeagueSeason(leagueId, season) {
  // Format URL: /<season>/<league>.json — eg /2024-25/en.1.json
  const url = `${RAW_BASE}/${season}/${leagueId}.json`;
  const res = await httpsGet(url);
  if (res.status !== 200 || !res.data) return null;
  return res.data;
}

// ── Transform openfootball match → unified record ───────────────────────────
function transformOpenfootballMatch(raw, leagueMeta, season) {
  if (!raw || !raw.team1 || !raw.team2) return null;
  // openfootball "match" shape: { date, team1, team2, score: { ft: [h, a], ht: [h, a] }, ... }
  const t1 = typeof raw.team1 === 'string' ? raw.team1 : (raw.team1?.name || raw.team1?.key);
  const t2 = typeof raw.team2 === 'string' ? raw.team2 : (raw.team2?.name || raw.team2?.key);
  const score = raw.score || {};
  const ft = score.ft || [];
  const ht = score.ht || [];
  const homeScore = typeof ft[0] === 'number' ? ft[0] : null;
  const awayScore = typeof ft[1] === 'number' ? ft[1] : null;
  const hasResult = (homeScore != null && awayScore != null);

  return {
    id: `of_${season}_${leagueMeta.id}_${(t1 || '').replace(/\s+/g, '_')}_vs_${(t2 || '').replace(/\s+/g, '_')}_${raw.date || ''}`,
    source: 'openfootball',
    league_id: leagueMeta.id,
    league_name: leagueMeta.name,
    country: leagueMeta.country,
    season: season,
    round: raw.round || raw.matchday || null,
    date: raw.date,
    home_team: t1,
    away_team: t2,
    home_score: homeScore,
    away_score: awayScore,
    halftime_score: { home: ht[0] ?? null, away: ht[1] ?? null },
    status: hasResult ? 'finished' : 'scheduled',
    _attribution: 'openfootball/football.json (ODbL)',
  };
}

// ── Main ETL ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const seasonArg = args.find(a => a.startsWith('--season'));
  const leagueArg = args.find(a => a.startsWith('--league'));
  const allSeasons = args.includes('--all-seasons');

  const targetSeasons = seasonArg
    ? [String(seasonArg.split('=')[1] || args[args.indexOf(seasonArg) + 1])]
    : (allSeasons ? DEFAULT_SEASONS : ['2024-25']);
  const targetLeagues = leagueArg
    ? LEAGUES.filter(l => l.id === String(leagueArg.split('=')[1] || args[args.indexOf(leagueArg) + 1]))
    : LEAGUES;

  console.log(`[ETL openfootball] Demarrage — saisons [${targetSeasons.join(', ')}] × ligues [${targetLeagues.map(l => l.id).join(', ')}]`);
  console.log(`[ETL openfootball] Output: ${OUTPUT_FILE}`);

  const existingDB = (() => {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); }
    catch (e) { return { schema_version: 1, generated_at: null, source: 'openfootball/football.json', license: 'ODbL', leagues: {} }; }
  })();

  let totalIngested = 0;

  for (const season of targetSeasons) {
    for (const league of targetLeagues) {
      try {
        const data = await fetchLeagueSeason(league.id, season);
        if (!data) {
          console.log(`[ETL openfootball]   ${league.id} ${season} → not found (skip)`);
          await sleep(THROTTLE_MS);
          continue;
        }
        // openfootball shape: { name, matches: [...] } OR sometimes { rounds: [{matches:[]}, ...] }
        let matches = [];
        if (Array.isArray(data.matches)) {
          matches = data.matches;
        } else if (Array.isArray(data.rounds)) {
          for (const r of data.rounds) {
            if (Array.isArray(r.matches)) matches.push(...r.matches.map(m => ({ ...m, round: r.name })));
          }
        }

        const transformed = matches.map(m => transformOpenfootballMatch(m, league, season)).filter(Boolean);
        const key = `${league.id}_${season}`;
        existingDB.leagues[key] = {
          meta: { ...league, season, last_update: new Date().toISOString() },
          matches: transformed,
        };
        totalIngested += transformed.length;
        console.log(`[ETL openfootball]   ${league.id} ${season} → ${transformed.length} matchs`);
      } catch (e) {
        console.warn(`[ETL openfootball]   ${league.id} ${season} erreur: ${e.message}`);
      }
      await sleep(THROTTLE_MS);
    }
  }

  existingDB.generated_at = new Date().toISOString();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingDB, null, 2));
  console.log(`[ETL openfootball] OK — ${totalIngested} matchs ingere — sauvegarde ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('[ETL openfootball] ERREUR:', e.message);
    process.exit(1);
  });
}

module.exports = { main, transformOpenfootballMatch, fetchLeagueSeason };
