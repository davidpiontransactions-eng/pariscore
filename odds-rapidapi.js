'use strict';
// ─── odds-rapidapi.js — Adaptateur RapidAPI odds-api1 → format PariScore ─────
//
// Interroge https://odds-api1.p.rapidapi.com/ et retourne les cotes au format
// attendu par buildMatchRecord() / computeEdge() :
//   { home: float, draw: float, away: float,
//     bookmakers: { home: string, draw: string, away: string } }
//
// Clé requise : RAPIDAPI_KEY dans .env (déjà configurée — shared avec tennis/free-football)
// Fallback gracieux : retourne null si API indisponible ou clé absente.
// Zéro dépendance npm — Node.js natif uniquement.
//
// NOTE ARCHITECTURE :
//   Ce module cohabite avec oddspapi.js (adaptateur Comparateur all_bookmakers).
//   Celui-ci est orienté intégration directe dans buildMatchRecord() comme
//   source de cotes principale (fallback après BSD/ESPN).
//
// INTÉGRATION server.js (voir section 6 du rapport) :
//   1. require('./odds-rapidapi') en tête de server.js
//   2. Dans fetchOdds(), après L1 BSD, avant L3 ESPN :
//      const rapidOdds = await oddsRapidApi.enrichWithOdds(allRawMatches);
//      (voir commentaire inline dans la fonction enrichWithOdds ci-dessous)

const https = require('https');

// ─── Configuration (lazy, lue après loadEnv de server.js) ────────────────────
const KEY  = () => process.env.RAPIDAPI_KEY || process.env.ODDSPAPI_KEY || '';
const HOST = 'odds-api1.p.rapidapi.com';

// Cache interne — TTL 15 minutes (évite quotas inutiles sur polls fréquents)
const CACHE_TTL_MS = 15 * 60 * 1000;
const _cache = new Map();

// ─── Identifiants de tournois odds-api1 → mappage ligues PariScore ───────────
// IDs confirmés via endpoint /tournaments (sportId=10 = football).
// Même table que oddspapi.js LEAGUE_TOURNAMENTS — synchroniser si besoin.
const LEAGUE_MAP = {
  // The Odds API sport_key → tournamentId odds-api1
  'soccer_france_ligue1':          34,
  'soccer_epl':                    17,
  'soccer_spain_la_liga':           8,
  'soccer_germany_bundesliga':     35,
  'soccer_italy_serie_a':          23,
  'soccer_uefa_champs_league':      7,
  'soccer_uefa_europa_league':    679,
  // Aliases BSD sport keys
  'soccer_bsd':                  null,  // BSd ne fournit pas de tournamentId uniforme
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enabled() { return !!KEY(); }

/** Requête HTTPS native vers odds-api1 — retourne un objet JSON. */
function getJSON(pathname, params) {
  return new Promise((resolve, reject) => {
    const k = KEY();
    if (!k) return reject(new Error('RAPIDAPI_KEY manquante'));
    const qs = params && Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString()
      : '';
    const req = https.request({
      host: HOST,
      path: '/' + pathname + qs,
      method: 'GET',
      timeout: 12000,
      headers: {
        'x-rapidapi-host': HOST,
        'x-rapidapi-key': k,
        'Content-Type': 'application/json',
      },
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`odds-api1 HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('odds-api1 JSON parse: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('odds-api1 timeout')));
    req.end();
  });
}

// ─── Normalisation nom équipe (miroir de server.js normName) ─────────────────
const norm = s => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '');

/** Résolution du tournamentId à partir du sport_key ou league du match. */
function resolveTournamentId(match) {
  if (!match) return null;
  // ID direct transmis par oddspapi.js ou un enrichisseur
  if (match.oddspapi_tournament_id) return match.oddspapi_tournament_id;
  // Lookup par sport_key (The Odds API format)
  if (match.sport_key && LEAGUE_MAP[match.sport_key] != null) return LEAGUE_MAP[match.sport_key];
  // Lookup partiel par league name
  const candidates = Object.keys(LEAGUE_MAP);
  const normLeague = norm(match.league || match.sport_key || '');
  const hit = candidates.find(k => {
    const nk = norm(k);
    return nk === normLeague || nk.includes(normLeague) || normLeague.includes(nk);
  });
  return hit ? LEAGUE_MAP[hit] : null;
}

// ─── Parseur de réponse odds-api1 ─────────────────────────────────────────────
//
// Format observé (endpoint v4/odds-by-tournaments, mode RapidAPI) :
// [
//   {
//     "fixtureId": 12345,
//     "home": "PSG", "away": "Lyon",
//     "startDate": "2026-05-22T19:00:00Z",
//     "bookmakerOdds": {
//       "winamax": {
//         "markets": {
//           "101": {          // marketId 101 = 1X2
//             "outcomes": {
//               "101": { "price": 1.55 },   // Home
//               "102": { "price": 3.80 },   // Draw
//               "103": { "price": 5.50 }    // Away
//             }
//           }
//         }
//       },
//       "betclic": { ... }
//     }
//   }
// ]
//
// Schéma cible (identique à computeEdge input attendu dans server.js) :
// {
//   home: 1.55,          // meilleure cote home sur tous bookmakers
//   draw: 3.80,
//   away: 5.50,
//   bookmakers: { home: 'winamax', draw: 'betclic', away: 'unibet' }
// }

const OUT_IDS = { 101: 'home', 102: 'draw', 103: 'away' };

/**
 * Extrait les meilleures cotes 1X2 d'un objet fixture brut odds-api1.
 * @param {object} fixture - un élément du tableau retourné par l'API
 * @returns {{ home, draw, away, bookmakers } | null}
 */
function parseFixture(fixture) {
  if (!fixture) return null;

  let bestH = null, bestHbk = '';
  let bestN = null, bestNbk = '';
  let bestA = null, bestAbk = '';

  const bo = fixture.bookmakerOdds || fixture.bookmaker_odds || {};
  for (const [bkSlug, bkData] of Object.entries(bo)) {
    const markets = bkData && (bkData.markets || bkData.odds);
    if (!markets) continue;

    // Trouver le market 1X2 (marketId 101)
    let market1x2 = null;
    if (Array.isArray(markets)) {
      market1x2 = markets.find(m => Number(m.marketId || m.id) === 101);
    } else {
      // Objet { "101": {...}, "106": {...} }
      market1x2 = markets['101'] || null;
      if (!market1x2) {
        // Fallback: chercher un key qui contient "101" ou "1x2"
        const k = Object.keys(markets).find(k => k === '101' || String(k).toLowerCase().includes('1x2'));
        if (k) market1x2 = markets[k];
      }
    }
    if (!market1x2) continue;

    const outcomes = market1x2.outcomes || market1x2.prices || {};
    const outList = Array.isArray(outcomes)
      ? outcomes
      : Object.entries(outcomes).map(([oid, o]) => ({ outcomeId: Number(oid), ...o }));

    for (const o of outList) {
      const oid = Number(o.outcomeId || o.id);
      const price = o.price != null ? Number(o.price) : (o.odds != null ? Number(o.odds) : null);
      if (!price || isNaN(price) || price <= 1) continue;
      const field = OUT_IDS[oid];
      if (field === 'home'  && price > (bestH || 0)) { bestH = price; bestHbk = bkSlug; }
      if (field === 'draw'  && price > (bestN || 0)) { bestN = price; bestNbk = bkSlug; }
      if (field === 'away'  && price > (bestA || 0)) { bestA = price; bestAbk = bkSlug; }
    }

    // Fallback par label si IDs absents
    if (!bestH || !bestA) {
      for (const o of outList) {
        const lbl = String(o.outcomeName || o.name || '').toLowerCase();
        const price = o.price != null ? Number(o.price) : (o.odds != null ? Number(o.odds) : null);
        if (!price || isNaN(price) || price <= 1) continue;
        if ((lbl === '1' || lbl === 'home' || lbl === 'домашняя') && price > (bestH || 0)) { bestH = price; bestHbk = bkSlug; }
        if ((lbl === 'x' || lbl === 'draw' || lbl === 'ничья')   && price > (bestN || 0)) { bestN = price; bestNbk = bkSlug; }
        if ((lbl === '2' || lbl === 'away' || lbl === 'гостевая') && price > (bestA || 0)) { bestA = price; bestAbk = bkSlug; }
      }
    }
  }

  if (!bestH || !bestA) return null;

  return {
    home: bestH,
    draw: bestN,
    away: bestA,
    bookmakers: { home: bestHbk, draw: bestNbk, away: bestAbk },
  };
}

// ─── Matching fixture ↔ match PariScore ──────────────────────────────────────
// Compare noms d'équipe normalisés + tolérance horaire ±3h.
function fixtureMatchesRecord(fixture, record) {
  const fh = norm(fixture.home || fixture.homeTeam || fixture.home_team || '');
  const fa = norm(fixture.away || fixture.awayTeam || fixture.away_team || '');
  const rh = norm(record.home_team || '');
  const ra = norm(record.away_team || '');

  // Matching strict ou partiel (premier mot ≥ 4 chars)
  const sameTeam = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const w = a.slice(0, 6);
    return w.length >= 4 && (b.includes(w) || a.includes(b.slice(0, 6)));
  };

  if (!sameTeam(fh, rh) || !sameTeam(fa, ra)) return false;

  // Vérification temporelle ±3h
  if (fixture.startDate && record.commence_time) {
    const diff = Math.abs(
      new Date(fixture.startDate).getTime() - new Date(record.commence_time).getTime()
    );
    if (diff > 3 * 60 * 60 * 1000) return false;
  }
  return true;
}

// ─── API publique principale ──────────────────────────────────────────────────

/**
 * Récupère les cotes pour un seul match depuis odds-api1.
 * Utilise le cache 15min. Retourne null si pas de données disponibles.
 *
 * @param {object} match - objet match PariScore (home_team, away_team, sport_key, league, commence_time)
 * @returns {Promise<{home, draw, away, bookmakers} | null>}
 */
async function fetchOddsForMatch(match) {
  if (!enabled()) return null;
  if (!match || !match.home_team || !match.away_team) return null;

  const cacheKey = `m:${norm(match.home_team)}:${norm(match.away_team)}`;
  const cached = _cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.data;

  const tournamentId = resolveTournamentId(match);
  if (!tournamentId) {
    _cache.set(cacheKey, { ts: Date.now(), data: null });
    return null;
  }

  let result = null;
  try {
    const raw = await getJSON('v4/odds-by-tournaments', {
      tournamentIds: tournamentId,
      oddsFormat: 'decimal',
    });

    // L'API retourne un tableau de fixtures
    const fixtures = Array.isArray(raw) ? raw : (raw.fixtures || raw.data || []);
    const fx = fixtures.find(f => fixtureMatchesRecord(f, match));
    if (fx) result = parseFixture(fx);
  } catch (e) {
    console.warn(`[OddsRapidAPI] skip ${match.home_team} vs ${match.away_team} — ${e.message}`);
    result = null;
  }

  _cache.set(cacheKey, { ts: Date.now(), data: result });
  return result;
}

/**
 * Enrichit en masse un tableau de matchs raw (avant buildMatchRecord) avec des
 * cotes odds-api1 là où les cotes BSD/ESPN sont absentes.
 *
 * Usage dans fetchOdds() de server.js (après L1 BSD, avant L3 ESPN) :
 *
 *   if (oddsRapidApi.enabled()) {
 *     let enriched = 0;
 *     for (const raw of allRawMatches) {
 *       const hasOdds = Array.isArray(raw.bookmakers) && raw.bookmakers.some(b =>
 *         (b.markets || []).some(mk => mk.key === 'h2h' && (mk.outcomes || []).length >= 2));
 *       if (!hasOdds) {
 *         const odds = await oddsRapidApi.fetchOddsForMatch(raw);
 *         if (odds) {
 *           // Inject dans le format h2h attendu par computeEdge()
 *           raw.bookmakers = oddsRapidApi.oddsToBookmakerEntry(raw.home_team, raw.away_team, odds);
 *           raw._odds_source = 'odds-api1';
 *           enriched++;
 *         }
 *       }
 *     }
 *     if (enriched) console.log(`  [Routing] ✓ odds-api1 : ${enriched} matchs enrichis (cotes).`);
 *   }
 *
 * @param {Array} rawMatches - tableau de matchs bruts (format pre-buildMatchRecord)
 * @returns {Promise<Array>} - même tableau muté (les matchs sans cotes sont enrichis)
 */
async function enrichWithOdds(rawMatches) {
  if (!enabled() || !Array.isArray(rawMatches)) return rawMatches;

  let enriched = 0;
  for (const raw of rawMatches) {
    // Vérifier si des cotes h2h exploitables sont déjà présentes
    const hasOdds = (raw.bsd_odds && raw.bsd_odds.home && raw.bsd_odds.away)
      || (Array.isArray(raw.bookmakers) && raw.bookmakers.some(b =>
          (b.markets || []).some(mk => mk.key === 'h2h' && (mk.outcomes || []).length >= 2)));
    if (hasOdds) continue;

    const odds = await fetchOddsForMatch(raw);
    if (odds) {
      raw.bookmakers = oddsToBookmakerEntry(raw.home_team, raw.away_team, odds);
      raw._odds_source = 'odds-api1';
      enriched++;
    }
  }

  if (enriched > 0) {
    console.log(`  [OddsRapidAPI] ✓ ${enriched} match(s) enrichi(s) avec cotes odds-api1.`);
  }
  return rawMatches;
}

/**
 * Convertit le résultat { home, draw, away, bookmakers } en tableau au format
 * The Odds API attendu par computeEdge() dans server.js :
 * [{ title: 'winamax', markets: [{ key: 'h2h', outcomes: [{name, price}] }] }]
 *
 * @param {string} homeTeam - nom de l'équipe domicile
 * @param {string} awayTeam - nom de l'équipe extérieur
 * @param {{ home, draw, away, bookmakers }} odds
 * @returns {Array} - tableau au format bookmakers The Odds API
 */
function oddsToBookmakerEntry(homeTeam, awayTeam, odds) {
  if (!odds) return [];

  // Grouper par bookmaker (home bk, draw bk, away bk peuvent être différents)
  const bookMap = new Map();
  const add = (bkTitle, name, price) => {
    if (!bkTitle || !price) return;
    if (!bookMap.has(bkTitle)) {
      bookMap.set(bkTitle, { title: bkTitle, markets: [{ key: 'h2h', outcomes: [] }] });
    }
    bookMap.get(bkTitle).markets[0].outcomes.push({ name, price });
  };

  add(odds.bookmakers.home, homeTeam, odds.home);
  add(odds.bookmakers.draw, 'Draw',   odds.draw);
  add(odds.bookmakers.away, awayTeam, odds.away);

  return [...bookMap.values()];
}

/**
 * Récupère les tournois disponibles pour un sport donné.
 * Utile pour mettre à jour LEAGUE_MAP si de nouveaux tournois sont ajoutés.
 * Appel manuel uniquement (diagnostic).
 *
 * @param {number} [sportId=10] - 10 = football
 * @returns {Promise<Array>}
 */
async function listTournaments(sportId = 10) {
  if (!enabled()) throw new Error('RAPIDAPI_KEY manquante');
  return getJSON('v4/tournaments', { sportId });
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  enabled,
  fetchOddsForMatch,
  enrichWithOdds,
  oddsToBookmakerEntry,
  listTournaments,
  // Exposés pour tests unitaires
  parseFixture,
  resolveTournamentId,
  fixtureMatchesRecord,
};
