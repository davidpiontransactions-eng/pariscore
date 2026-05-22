'use strict';
// ─── odds-apifootball.js — Adaptateur API-Football → format PariScore (bd zia) ─
//
// Migration cible bd `zia` (P2 Consolidation P3) :
//   Réutiliser le plan API-Football pour les cotes 1X2, au lieu de The Odds
//   API (500 req/mois, saturé). Source unique stats+odds.
//
// Endpoint : GET https://v3.football.api-sports.io/odds?date=YYYY-MM-DD
//            GET https://v3.football.api-sports.io/odds?fixture={id}
//            GET https://v3.football.api-sports.io/odds?league={id}&season={year}
//   IMPORTANT : `/odds?date=` ne retourne PAS les noms d'équipes — il faut
//   un join avec `/fixtures?date=` pour mapper fixture_id → home/away names.
//   `/odds?league=&season=` est restreint sur plan Free (saisons 2022-2024 only).
// Auth     : header `x-apisports-key: $API_FOOTBALL_KEY`
// Doc      : https://www.api-football.com/documentation-v3#tag/Odds
//
// Format réponse /odds :
//   {
//     response: [{
//       fixture: { id, date, timezone, timestamp },
//       league : { id, season, name, country, ... },
//       update : '2026-...',
//       bookmakers: [{
//         id, name,
//         bets: [{
//           id, name,          // id=1 name='Match Winner' (1X2)
//           values: [
//             { value: 'Home',  odd: '1.55' },
//             { value: 'Draw',  odd: '3.80' },
//             { value: 'Away',  odd: '5.50' },
//           ],
//         }]
//       }]
//     }]
//   }
//
// MARKET IDS API-Football :
//   1  = Match Winner (1X2)
//   5  = Goals Over/Under
//   8  = Both Teams To Score
//   12 = Double Chance
//
// Format de sortie (identique adapter odds-rapidapi.js / The Odds API) :
//   [{ key, title, markets: [{ key:'h2h', outcomes:[{name, price}] }] }]
//
// Sécurité :
//   - Header x-apisports-key jamais exposé client (module backend pur)
//   - Clé lue lazy via process.env.API_FOOTBALL_KEY (bypass AF_REMOVED stats)
//   - Cache mémoire 6h _mem (TTL par clé)
//
// Zéro dépendance npm — Node.js natif (https).

const https = require('https');

const HOST = 'v3.football.api-sports.io';
const BET_ID_MATCH_WINNER = 1;       // 1X2 market id
const TTL_MS = 6 * 3600 * 1000;      // 6h cache cotes pré-match stables
const REQUEST_TIMEOUT_MS = 12000;
// Rate-limit Free plan ~10 req/min ; on espace si AF_ODDS_THROTTLE_MS défini.
// Plan Pro 7500/jour autorise burst → laisser à 0 par défaut.
const THROTTLE_MS = (() => {
  const v = Number(process.env.AF_ODDS_THROTTLE_MS);
  return Number.isFinite(v) && v >= 0 ? v : 0;
})();
const PAGE_CAP = 60;  // hard-cap 60 pages × 10 fixtures = 600 entrées max/date

// Bookmakers EU pertinents (filtre soft : si vide, on prend tous). Reflète
// l'écosystème EU/FR pour comparaison équitable avec ODDS_API_KEY (regions=eu).
const EU_BOOKMAKER_REGEX = /(pinnacle|bet365|unibet|betfair|williamhill|william hill|10bet|betsson|nordicbet|betclic|winamax|parionssport|zebet|netbet|betway|marathonbet|tipico|interwetten|stoiximan|bwin|sbobet|1xbet|leovegas|bet[\- ]?victor|paddy[\- ]?power)/i;

// In-process cache mémoire (clé string → {ts, data}).
const _mem = new Map();

let _lastReqTs = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _key() {
  // Lecture lazy : bypass kill-switch AF_REMOVED de server.js pour activer
  // les cotes sans réactiver les stats AF globalement.
  return process.env.API_FOOTBALL_KEY || '';
}

function enabled() { return !!_key(); }

function _normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function _throttle() {
  if (!THROTTLE_MS) return;
  const wait = THROTTLE_MS - (Date.now() - _lastReqTs);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastReqTs = Date.now();
}

function _httpGetJSON(pathname) {
  return new Promise((resolve, reject) => {
    const k = _key();
    if (!k) return reject(new Error('API_FOOTBALL_KEY manquante'));
    const req = https.request({
      host: HOST,
      path: pathname,
      method: 'GET',
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'x-apisports-key': k,
        'Accept': 'application/json',
      },
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`api-football HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try { resolve({ data: JSON.parse(body), headers: res.headers }); }
        catch (e) { reject(new Error('api-football JSON parse: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('api-football timeout')));
    req.end();
  });
}

async function _get(pathname) {
  await _throttle();
  return _httpGetJSON(pathname);
}

// ─── Parsing réponse /odds entry → meilleures cotes 1X2 ──────────────────────
function parseEntry(entry, opts = {}) {
  if (!entry || !Array.isArray(entry.bookmakers) || entry.bookmakers.length === 0) return null;
  const filterEU = !!opts.filterEU;
  let bestH = 0, bestHbk = '';
  let bestN = 0, bestNbk = '';
  let bestA = 0, bestAbk = '';
  const booksWithMW = new Set();

  for (const bk of entry.bookmakers) {
    const bkTitle = bk && bk.name ? String(bk.name) : '';
    if (!bkTitle) continue;
    if (filterEU && !EU_BOOKMAKER_REGEX.test(bkTitle)) continue;

    const bets = Array.isArray(bk.bets) ? bk.bets : [];
    const mw = bets.find(b => b && Number(b.id) === BET_ID_MATCH_WINNER);
    if (!mw || !Array.isArray(mw.values)) continue;
    booksWithMW.add(bkTitle);

    for (const v of mw.values) {
      if (!v || v.odd == null) continue;
      const price = Number(v.odd);
      if (!Number.isFinite(price) || price <= 1) continue;
      const lbl = String(v.value || '').toLowerCase();
      if ((lbl === 'home' || lbl === '1') && price > bestH) { bestH = price; bestHbk = bkTitle; }
      else if ((lbl === 'draw' || lbl === 'x') && price > bestN) { bestN = price; bestNbk = bkTitle; }
      else if ((lbl === 'away' || lbl === '2') && price > bestA) { bestA = price; bestAbk = bkTitle; }
    }
  }

  if (!bestH || !bestA) return null;

  return {
    home: bestH,
    draw: bestN || null,
    away: bestA,
    bookmakers: { home: bestHbk, draw: bestNbk, away: bestAbk },
    bookmakers_count: booksWithMW.size,
  };
}

// Conversion vers format bookmakers The Odds API attendu par computeEdge().
function oddsToBookmakerEntry(homeTeam, awayTeam, parsed) {
  if (!parsed) return [];
  const map = new Map();
  const add = (bkTitle, name, price) => {
    if (!bkTitle || !price) return;
    if (!map.has(bkTitle)) {
      map.set(bkTitle, {
        key: bkTitle.toLowerCase().replace(/[^a-z0-9]/g, ''),
        title: bkTitle,
        markets: [{ key: 'h2h', outcomes: [] }],
      });
    }
    map.get(bkTitle).markets[0].outcomes.push({ name, price });
  };
  add(parsed.bookmakers.home, homeTeam, parsed.home);
  if (parsed.draw) add(parsed.bookmakers.draw, 'Draw', parsed.draw);
  add(parsed.bookmakers.away, awayTeam, parsed.away);
  return [...map.values()];
}

// ─── Fetch primitives ────────────────────────────────────────────────────────

async function fetchOddsByFixture(fixtureId, opts = {}) {
  if (!enabled() || !fixtureId) return null;
  const cacheKey = `af_odds_fx:${fixtureId}`;
  const cached = _mem.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < TTL_MS) return cached.data;

  let parsed = null;
  try {
    const { data } = await _get(`/odds?fixture=${encodeURIComponent(fixtureId)}`);
    const list = Array.isArray(data && data.response) ? data.response : [];
    if (list.length > 0) parsed = parseEntry(list[0], opts);
  } catch (e) {
    console.warn(`[OddsAF] fixture=${fixtureId} → ${e.message}`);
    parsed = null;
  }
  _mem.set(cacheKey, { ts: Date.now(), data: parsed });
  return parsed;
}

/**
 * Récupère toutes les cotes d'une date (YYYY-MM-DD). Schéma API-Football :
 *   /odds?date= retourne entries sans noms d'équipes → join avec /fixtures?date=
 *   pour matcher fixture_id → noms.
 * Retourne Map keyé par `normHome|normAway`. Cache 6h.
 */
async function fetchOddsByDate(dateStr, opts = {}) {
  if (!enabled() || !dateStr) return new Map();
  const cacheKey = `af_odds_date:${dateStr}`;
  const cached = _mem.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < TTL_MS) return cached.data;

  const out = new Map();
  try {
    // 1. /fixtures?date= → fxId → {home, away}
    const fxResult = await _get(`/fixtures?date=${encodeURIComponent(dateStr)}`);
    const fixMap = new Map();
    for (const entry of (fxResult.data && fxResult.data.response) || []) {
      const fxId = entry.fixture && entry.fixture.id;
      const teams = entry.teams;
      if (fxId && teams && teams.home && teams.away) {
        fixMap.set(Number(fxId), { home: teams.home.name, away: teams.away.name });
      }
    }
    if (fixMap.size === 0) {
      _mem.set(cacheKey, { ts: Date.now(), data: out });
      return out;
    }
    // 2. /odds?date= paginé
    let page = 1, totalPages = 1;
    do {
      const { data } = await _get(`/odds?date=${encodeURIComponent(dateStr)}&page=${page}`);
      const list = Array.isArray(data && data.response) ? data.response : [];
      totalPages = (data && data.paging && Number(data.paging.total)) || 1;
      for (const entry of list) {
        const parsed = parseEntry(entry, opts);
        if (!parsed) continue;
        const fxId = entry.fixture && Number(entry.fixture.id);
        const fxInfo = fixMap.get(fxId);
        if (!fxInfo) continue;
        const key = `${_normName(fxInfo.home)}|${_normName(fxInfo.away)}`;
        out.set(key, { ...parsed, _fixture_id: fxId, _home: fxInfo.home, _away: fxInfo.away });
      }
      page++;
    } while (page <= totalPages && page <= PAGE_CAP);
  } catch (e) {
    console.warn(`[OddsAF] date=${dateStr} → ${e.message}`);
  }
  _mem.set(cacheKey, { ts: Date.now(), data: out });
  return out;
}

async function fetchOddsByLeague(leagueId, season, opts = {}) {
  if (!enabled() || !leagueId) return new Map();
  const cacheKey = `af_odds_lg:${leagueId}:${season}`;
  const cached = _mem.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < TTL_MS) return cached.data;

  const out = new Map();
  try {
    let page = 1, totalPages = 1;
    do {
      const { data } = await _get(`/odds?league=${leagueId}&season=${season}&page=${page}`);
      const list = Array.isArray(data && data.response) ? data.response : [];
      totalPages = (data && data.paging && Number(data.paging.total)) || 1;
      // Cas plan Free : errors.plan = "..." → 0 results, on sort.
      if (data && data.errors && data.errors.plan) break;
      for (const entry of list) {
        const parsed = parseEntry(entry, opts);
        if (!parsed) continue;
        const fxId = entry.fixture && Number(entry.fixture.id);
        // /odds?league= n'expose pas non plus teams → fallback fx:id key
        out.set(`fx:${fxId}`, { ...parsed, _fixture_id: fxId });
      }
      page++;
    } while (page <= totalPages && page <= PAGE_CAP);
  } catch (e) {
    console.warn(`[OddsAF] league=${leagueId} season=${season} → ${e.message}`);
  }
  _mem.set(cacheKey, { ts: Date.now(), data: out });
  return out;
}

/** Saison d'une date : convention API-Football aout→juillet → year. */
function _seasonForLeague(commenceIso) {
  const d = commenceIso ? new Date(commenceIso) : new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 7 ? y : y - 1;
}

/**
 * Récupère les cotes pour un match PariScore (format raw).
 * Stratégie : fixture_id direct si dispo, sinon date+name matching.
 */
async function fetchOddsForMatch(raw, opts = {}) {
  if (!enabled() || !raw) return null;
  const fxId = raw.api_football_fixture_id || raw._af_fixture_id;
  if (fxId) {
    const p = await fetchOddsByFixture(fxId, opts);
    if (p) return p;
  }
  if (raw.commence_time && raw.home_team && raw.away_team) {
    const ds = new Date(raw.commence_time).toISOString().slice(0, 10);
    const m = await fetchOddsByDate(ds, opts);
    const k = `${_normName(raw.home_team)}|${_normName(raw.away_team)}`;
    return m.get(k) || null;
  }
  return null;
}

// ─── Enrichissement en lot (appelée depuis fetchOdds() server.js) ────────────
async function enrichWithOdds(rawMatches, opts = {}) {
  if (!enabled() || !Array.isArray(rawMatches) || rawMatches.length === 0) {
    return { enriched: 0, skipped: rawMatches ? rawMatches.length : 0 };
  }
  const filterEU = opts.filterEU !== false;
  const overwrite = !!opts.overwrite;

  // Batch par DATE : 1 req /odds?date + 1 req /fixtures?date = 2 req pour
  // tous les matchs de la journée (vs 1 req/league × N).
  const byDate = new Map();
  const noDate = [];
  for (const r of rawMatches) {
    if (!overwrite && _hasUsableH2H(r)) continue;
    if (!r.commence_time) { noDate.push(r); continue; }
    const ds = new Date(r.commence_time).toISOString().slice(0, 10);
    if (!byDate.has(ds)) byDate.set(ds, []);
    byDate.get(ds).push(r);
  }

  let enriched = 0;
  let skipped = 0;

  for (const [dateStr, list] of byDate) {
    const oddsMap = await fetchOddsByDate(dateStr, { filterEU });
    if (oddsMap.size === 0) { skipped += list.length; continue; }
    for (const r of list) {
      const key = `${_normName(r.home_team)}|${_normName(r.away_team)}`;
      const p = oddsMap.get(key);
      if (!p) { skipped++; continue; }
      _injectOdds(r, p);
      enriched++;
    }
  }

  // Fallback fixture-id direct (cas rare sans commence_time)
  const FIX_BUDGET = 20;
  let fixBudget = FIX_BUDGET;
  for (const r of noDate) {
    if (fixBudget <= 0) { skipped++; continue; }
    const fxId = r.api_football_fixture_id || r._af_fixture_id;
    if (!fxId) { skipped++; continue; }
    const p = await fetchOddsByFixture(fxId, { filterEU });
    fixBudget--;
    if (!p) { skipped++; continue; }
    _injectOdds(r, p);
    enriched++;
  }

  return { enriched, skipped };
}

function _hasUsableH2H(raw) {
  if (raw && raw.bsd_odds && raw.bsd_odds.home && raw.bsd_odds.away) return true;
  if (!Array.isArray(raw && raw.bookmakers)) return false;
  return raw.bookmakers.some(b =>
    (b && Array.isArray(b.markets)) && b.markets.some(mk =>
      mk && mk.key === 'h2h' && Array.isArray(mk.outcomes) && mk.outcomes.length >= 2
    )
  );
}

function _injectOdds(raw, parsed) {
  raw.bookmakers = oddsToBookmakerEntry(raw.home_team, raw.away_team, parsed);
  raw._odds_source = 'api-football';
  raw._af_odds_books_count = parsed.bookmakers_count || 0;
}

module.exports = {
  enabled,
  fetchOddsByFixture,
  fetchOddsByDate,
  fetchOddsByLeague,
  fetchOddsForMatch,
  enrichWithOdds,
  oddsToBookmakerEntry,
  parseEntry,
  _normName,
  _seasonForLeague,
  EU_BOOKMAKER_REGEX,
};
