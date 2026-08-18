'use strict';
/**
 * theRundownService.js — TheRundown aggregator odds+scores+stats (bd ParisScorebis-3lr3)
 *
 * Endpoint : https://api.therundown.io/api/v1 (validé 2026-08-18)
 * Auth     : header `Authorization: Bearer $THERUNDOWN_API_KEY` ET `?api_key=`
 *            → les deux fonctionnent (test curl 200 sur les deux modes)
 * Free tier: 20k datapoints/day, 3 books (Pinnacle, Bookmaker, BetDSI)
 *
 * Use case PariScore : source unique odds+scores+stats multi-books (alternative/
 *                      complement The Odds API saturé à 500 req/mois).
 *
 * ⚠️  Endpoints validés par curl direct sur la clé (réponse JSON sports[] avec
 *     sport_id, sport_name). Paths /events et /odds à valider (scaffolded encore).
 *
 * Convention identique aux autres services :
 *   - lazy env via process.env.THERUNDOWN_API_KEY || ''
 *   - enabled() → bool
 *   - cache mémoire _mem (TTL 5 min)
 *
 * Zéro dépendance npm — Node 18+ fetch natif.
 */

const THERUNDOWN_BASE = 'https://api.therundown.io/api/v1';
const THERUNDOWN_KEY = process.env.THERUNDOWN_API_KEY || '';
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 min

const _mem = new Map();

function enabled() { return !!THERUNDOWN_KEY; }

async function _httpGet(pathname, params = {}) {
  if (!enabled()) throw new Error('THERUNDOWN_API_KEY manquante');
  const qs = Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Auth mode 1 (Bearer) — fallback à ajuster si erreur 401
    const res = await fetch(`${THERUNDOWN_BASE}${pathname}${qs}`, {
      headers: {
        'Authorization': `Bearer ${THERUNDOWN_KEY}`,
        'Accept': 'application/json',
        'User-Agent': 'PariScore-therundown/1.0',
      },
      signal: ctrl.signal,
    });
    if (res.status === 401) throw new Error(`therundown HTTP 401 — vérifier mode auth (Bearer vs ?api_key=)`);
    if (res.status === 429) throw new Error(`therundown rate-limited`);
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`therundown HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function _getCached(cacheKey, fetcher) {
  const cached = _mem.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.data;
  try {
    const data = await fetcher();
    _mem.set(cacheKey, { ts: Date.now(), data });
    return data;
  } catch (e) {
    if (cached) return cached.data;
    throw e;
  }
}

/**
 * GET /sports — liste des sports (soccer, basketball, baseball, ...)
 * ⚠️ TODO: confirmer endpoint exact après signup (peut être /v2/sports)
 */
async function fetchSports() {
  if (!enabled()) return [];
  return _getCached('sports', async () => {
    try {
      const data = await _httpGet('/sports');
      return Array.isArray(data.sports) ? data.sports : (Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('[TheRundown] /sports non disponible:', e.message);
      return [];
    }
  });
}

/**
 * GET /sports/:sport_id/events?sport=...&date=YYYY-MM-DD
 * ⚠️ 2026-08-18: returns 301 → redirect marketing. Endpoints events/odds
 *    apparemment gated derrière un plan payant (à confirmer avec le support).
 *    Code conservé pour rétrocompat — retourne [] gracieusement.
 */
async function fetchEvents(sportId, opts = {}) {
  if (!enabled() || !sportId) return [];
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const cacheKey = `events:${sportId}:${date}`;
  return _getCached(cacheKey, async () => {
    try {
      const data = await _httpGet(`/sports/${encodeURIComponent(sportId)}/events`, { date });
      return Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
    } catch (e) {
      // Endpoint gated derrière plan payant (vérifié 2026-08-18). Silencieux pour ne pas spammer.
      return [];
    }
  });
}

/**
 * GET /sports/:sport_id/events/:event_id/odds
 * ⚠️ Mêmes restrictions que fetchEvents — voir commentaire ci-dessus.
 */
async function fetchEventOdds(sportId, eventId) {
  if (!enabled() || !sportId || !eventId) return null;
  const cacheKey = `odds:${sportId}:${eventId}`;
  return _getCached(cacheKey, async () => {
    try {
      return await _httpGet(`/sports/${encodeURIComponent(sportId)}/events/${encodeURIComponent(eventId)}/odds`);
    } catch (e) {
      return null;
    }
  });
}

/**
 * GET /affiliates — liste des bookmakers/affiliates TheRundown (VALIDÉ 200, 2026-08-18)
 * Retourne : [{affiliate_id, affiliate_name, affiliate_url, status}]
 * Le seul endpoint "data" dispo en free tier avec /sports.
 */
async function fetchAffiliates() {
  if (!enabled()) return [];
  return _getCached('affiliates', async () => {
    const data = await _httpGet('/affiliates');
    return Array.isArray(data.affiliates) ? data.affiliates : [];
  });
}

function _getCacheStatus() {
  return { entries: _mem.size, ttl_ms: CACHE_TTL_MS, enabled: enabled() };
}

module.exports = {
  enabled,
  fetchSports,
  fetchEvents,
  fetchEventOdds,
  fetchAffiliates,
  _getCacheStatus,
};