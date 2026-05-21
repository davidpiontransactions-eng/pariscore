/**
 * seed_historique_tennis.js — Pipeline ETL Historique Tennis
 * ──────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-rxh
 * Objectif: peupler Data Warehouse historique tennis pour onglet Historique.
 *
 * STRATEGIE SOURCING (decision finale):
 * ✓ Source primaire: ESPN public endpoints (/apis/site/v2/sports/tennis/{atp,wta}/scoreboard?dates=YYYYMMDD)
 *   → zero-cost, zero-auth, JSON public stable, deja integre v10.74
 * ✓ Source backup: BSD tennis historical events (deja sub paye)
 *   → pour stats avancees (aces, 1st serve %, break points)
 * ✗ aiscore.com — scraping CF, focus live uniquement
 * ✗ RapidAPI tennis — cost variable, gates dashboard
 *
 * ARCHITECTURE:
 *   ESPN scoreboard {atp,wta} per day → historique_tennis.json
 *   Schema: { schema_version, generated_at,
 *             seasons: { 2024: { atp: [...], wta: [...] }, 2025: {...}, ... } }
 *
 * USAGE:
 *   node seed_historique_tennis.js                       # toutes saisons (2024-2026)
 *   node seed_historique_tennis.js --season 2024         # saison specifique
 *   node seed_historique_tennis.js --tour atp            # ATP only (ou wta)
 *   node seed_historique_tennis.js --from 2024-01-01 --to 2024-03-31  # range
 *   node seed_historique_tennis.js --grand-slams-only    # seulement GS (faster)
 *
 * NOTES VOLUME:
 *   ESPN scoreboard date-range = 1 req/jour/tour
 *   2024+2025+2026 (~1095 jours) × 2 tours (ATP+WTA) = ~2190 req
 *   Throttle 200ms = ~7min scan complet
 *   Tournois OFF-SEASON sont silently empty → no skip needed
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const OUTPUT_FILE = path.join(__dirname, 'historique_tennis.json');
const THROTTLE_MS = 200;
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/tennis';
const TOURS = ['atp', 'wta'];
const DEFAULT_SEASONS = [2024, 2025, 2026];

// Grand Slams date ranges (jours approx — peut overlapper en pratique)
const GRAND_SLAM_RANGES = {
  australian_open:    { start: '01-13', end: '01-28' },  // mi-jan → fin-jan
  french_open:        { start: '05-20', end: '06-09' },  // mai → debut juin
  wimbledon:          { start: '06-30', end: '07-14' },  // fin-juin → mi-juil
  us_open:            { start: '08-25', end: '09-08' },  // fin-aout → debut sept
};

// ── HTTP helper ─────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'PariScore-ETL/1.0 (+https://pariscore.fr)' } }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          // ESPN parfois renvoie HTML error page sur date invalide → ignore
          resolve({ status: res.statusCode, headers: res.headers, data: null });
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Date helpers ────────────────────────────────────────────────────────────
function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function* dateRangeIter(fromDate, toDate) {
  const d = new Date(fromDate.getTime());
  while (d <= toDate) {
    yield new Date(d.getTime());
    d.setDate(d.getDate() + 1);
  }
}

function buildGrandSlamDates(season) {
  const dates = [];
  for (const range of Object.values(GRAND_SLAM_RANGES)) {
    const start = new Date(`${season}-${range.start}T00:00:00Z`);
    const end = new Date(`${season}-${range.end}T00:00:00Z`);
    for (const d of dateRangeIter(start, end)) dates.push(d);
  }
  return dates;
}

function buildSeasonDates(season) {
  const start = new Date(`${season}-01-01T00:00:00Z`);
  const end = new Date(`${season}-12-31T00:00:00Z`);
  return [...dateRangeIter(start, end)];
}

// ── Fetch ESPN scoreboard for one date + tour ───────────────────────────────
async function fetchScoreboardForDate(tour, dateYYYYMMDD) {
  const url = `${ESPN_BASE}/${tour}/scoreboard?dates=${dateYYYYMMDD}`;
  const res = await httpsGet(url);
  if (res.status !== 200 || !res.data) return [];
  const events = res.data.events || res.data.competitions || [];
  return events;
}

// ── Transform ESPN event → match record ─────────────────────────────────────
function transformEspnEvent(raw, tour) {
  if (!raw) return null;
  const competition = (raw.competitions && raw.competitions[0]) || raw;
  if (!competition) return null;
  const competitors = competition.competitors || [];
  if (competitors.length < 2) return null;

  const c1 = competitors[0];
  const c2 = competitors[1];

  // Determine round/tournament from raw notes or competition.notes
  const notes = Array.isArray(competition.notes) && competition.notes.length
    ? competition.notes.map(n => n.headline || n.text || '').join(' · ')
    : '';
  const tournamentName = (raw.tournament && raw.tournament.displayName)
    || (raw.season && raw.season.year && raw.name)
    || raw.shortName
    || notes
    || '';

  // Status FT / cancelled / ongoing
  const status = competition.status?.type?.name || raw.status?.type?.name || 'unknown';
  const isCompleted = /STATUS_FINAL|STATUS_FULL_TIME|FT|completed|final/i.test(status);
  if (!isCompleted) return null; // only ingest finished matches

  // Set scores
  const sets = [];
  const c1Sets = Array.isArray(c1.linescores) ? c1.linescores : [];
  const c2Sets = Array.isArray(c2.linescores) ? c2.linescores : [];
  const nSets = Math.max(c1Sets.length, c2Sets.length);
  for (let i = 0; i < nSets; i++) {
    sets.push({
      p1: c1Sets[i]?.value ?? null,
      p2: c2Sets[i]?.value ?? null,
      p1_tb: c1Sets[i]?.tiebreak ?? null,
      p2_tb: c2Sets[i]?.tiebreak ?? null,
    });
  }

  // Winner
  const p1Won = c1.winner === true;
  const p2Won = c2.winner === true;
  const winner = p1Won ? 'p1' : (p2Won ? 'p2' : null);

  return {
    id: `espn_tennis_${raw.id || competition.id}`,
    source: 'espn-public',
    tour: tour.toUpperCase(),
    sport: 'tennis',
    tournament: tournamentName,
    round: competition.round?.displayName || raw.round?.displayName || null,
    surface: competition.surfaceType || null,
    date: raw.date || competition.date,
    player1: {
      name: c1.athlete?.displayName || c1.team?.displayName || c1.displayName,
      country: c1.athlete?.flag?.alt || null,
      flag: c1.athlete?.flag?.href || null,
      seed: c1.curatedRank?.current || c1.seed || null,
    },
    player2: {
      name: c2.athlete?.displayName || c2.team?.displayName || c2.displayName,
      country: c2.athlete?.flag?.alt || null,
      flag: c2.athlete?.flag?.href || null,
      seed: c2.curatedRank?.current || c2.seed || null,
    },
    sets,
    sets_won_p1: parseInt(c1.score) || null,
    sets_won_p2: parseInt(c2.score) || null,
    winner,
    status,
    _espn_event_id: String(raw.id || competition.id),
  };
}

// ── Main ETL ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const seasonArg = args.find(a => a.startsWith('--season'));
  const tourArg = args.find(a => a.startsWith('--tour'));
  const fromArg = args.find(a => a.startsWith('--from'));
  const toArg = args.find(a => a.startsWith('--to'));
  const grandSlamsOnly = args.includes('--grand-slams-only');

  const targetSeasons = seasonArg
    ? [parseInt(seasonArg.split('=')[1] || args[args.indexOf(seasonArg) + 1], 10)]
    : DEFAULT_SEASONS;
  const targetTours = tourArg
    ? [String(tourArg.split('=')[1] || args[args.indexOf(tourArg) + 1]).toLowerCase()]
    : TOURS;

  console.log(`[ETL Tennis] Demarrage — saisons ${targetSeasons.join(',')} tours ${targetTours.join(',')}${grandSlamsOnly ? ' [GS only]' : ''}`);

  const existingDB = (() => {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); }
    catch (e) { return { schema_version: 1, generated_at: null, seasons: {} }; }
  })();

  let totalIngested = 0;

  // Custom date range overrides season iteration
  if (fromArg && toArg) {
    const fromDate = new Date(String(fromArg.split('=')[1] || args[args.indexOf(fromArg) + 1]));
    const toDate = new Date(String(toArg.split('=')[1] || args[args.indexOf(toArg) + 1]));
    console.log(`[ETL Tennis] Range custom ${fromDate.toISOString().slice(0,10)} → ${toDate.toISOString().slice(0,10)}`);
    const dates = [...dateRangeIter(fromDate, toDate)];
    for (const tour of targetTours) {
      const matchesForTour = [];
      for (const d of dates) {
        const dStr = formatDateYYYYMMDD(d);
        const events = await fetchScoreboardForDate(tour, dStr);
        for (const ev of events) {
          const rec = transformEspnEvent(ev, tour);
          if (rec) matchesForTour.push(rec);
        }
        await sleep(THROTTLE_MS);
      }
      const seasonKey = fromDate.getFullYear();
      existingDB.seasons[seasonKey] = existingDB.seasons[seasonKey] || {};
      existingDB.seasons[seasonKey][tour] = mergeDedupById(existingDB.seasons[seasonKey][tour] || [], matchesForTour);
      totalIngested += matchesForTour.length;
      console.log(`[ETL Tennis] ${tour.toUpperCase()} range → ${matchesForTour.length} matchs ingere`);
    }
  } else {
    // Iterate per season
    for (const season of targetSeasons) {
      const dates = grandSlamsOnly ? buildGrandSlamDates(season) : buildSeasonDates(season);
      console.log(`[ETL Tennis] Saison ${season} — ${dates.length} jours a scanner`);

      for (const tour of targetTours) {
        const matchesForTour = [];
        for (const d of dates) {
          const dStr = formatDateYYYYMMDD(d);
          try {
            const events = await fetchScoreboardForDate(tour, dStr);
            for (const ev of events) {
              const rec = transformEspnEvent(ev, tour);
              if (rec) matchesForTour.push(rec);
            }
          } catch (e) {
            // ESPN rate-limit or transient error → continue
          }
          await sleep(THROTTLE_MS);
        }
        existingDB.seasons[season] = existingDB.seasons[season] || {};
        existingDB.seasons[season][tour] = mergeDedupById(existingDB.seasons[season][tour] || [], matchesForTour);
        totalIngested += matchesForTour.length;
        console.log(`[ETL Tennis] ${tour.toUpperCase()} ${season} → ${matchesForTour.length} matchs ingere`);
      }
    }
  }

  existingDB.generated_at = new Date().toISOString();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingDB, null, 2));
  console.log(`[ETL Tennis] OK — ${totalIngested} matchs ingere total — sauvegarde ${OUTPUT_FILE}`);
}

// ── Merge helper — dedup par id ─────────────────────────────────────────────
function mergeDedupById(existing, incoming) {
  const ids = new Set(existing.map(m => m.id));
  for (const m of incoming) {
    if (!ids.has(m.id)) {
      existing.push(m);
      ids.add(m.id);
    }
  }
  return existing;
}

if (require.main === module) {
  main().catch(e => {
    console.error('[ETL Tennis] ERREUR:', e.message);
    process.exit(1);
  });
}

module.exports = { main, transformEspnEvent, fetchScoreboardForDate };
