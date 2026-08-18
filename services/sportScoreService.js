'use strict';
/**
 * sportScoreService.js — SportScore.com multi-sport live data (bd ParisScorebis-43g0)
 *
 * Endpoint : https://sportscore.com/api/v1/  (attendu — non vérifié à 100%)
 * Auth     : None (no-auth per public-apis)
 * Free     : oui, attribution link requis vers sportscore.com
 *
 * Use case PariScore : couverture tennis/NBA live + fixtures, complète le trou
 *                      API-FOOTBALL. Endpoint exact à valider après signup.
 *
 * Convention identique aux autres services :
 *   - enabled() → bool (toujours true ici, pas de clé)
 *   - cache mémoire _mem (TTL 5 min — live data)
 *   - retourne [] si pas de résultat
 *
 * Zéro dépendance npm — Node 18+ fetch natif.
 *
 * NOTE: structure endpoint exacte à confirmer (TODO) avec un curl initial
 * une fois le compte créé. En attendant, les endpoints sont best-effort.
 */

const SPORTSCORE_BASE = 'https://sportscore.com/api/v1';
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 min — live data

const _mem = new Map();

function enabled() { return true; }  // pas de clé

async function _httpGet(pathname) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SPORTSCORE_BASE}${pathname}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore-sportscore/1.0' },
      signal: ctrl.signal,
    });
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`sportscore HTTP ${res.status}: ${txt.slice(0, 200)}`);
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
 * GET /feeds — liste des feeds disponibles (football, basketball, cricket, tennis).
 * À valider : endpoint peut être /sports ou /leagues selon version API.
 */
async function fetchFeeds() {
  return _getCached('feeds', async () => {
    try {
      const data = await _httpGet('/feeds');
      return Array.isArray(data.feeds) ? data.feeds : (Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('[SportScore] feeds non disponible — endpoint à valider:', e.message);
      return [];
    }
  });
}

/**
 * GET /events?sport=tennis|basketball|cricket|football&date=YYYY-MM-DD
 * Retourne événements live + upcoming.
 */
async function fetchEvents(sport, opts = {}) {
  if (!sport) return [];
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const cacheKey = `events:${sport}:${date}`;
  return _getCached(cacheKey, async () => {
    try {
      const params = new URLSearchParams({ sport, date });
      const data = await _httpGet(`/events?${params.toString()}`);
      return Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(`[SportScore] events sport=${sport} → ${e.message}`);
      return [];
    }
  });
}

/**
 * GET /event/:id — détail d'un événement (scores, stats).
 */
async function fetchEvent(eventId) {
  if (!eventId) return null;
  const cacheKey = `event:${eventId}`;
  return _getCached(cacheKey, async () => {
    try {
      return await _httpGet(`/event/${encodeURIComponent(eventId)}`);
    } catch (e) {
      console.warn(`[SportScore] event ${eventId} → ${e.message}`);
      return null;
    }
  });
}

function _getCacheStatus() {
  return { entries: _mem.size, ttl_ms: CACHE_TTL_MS, enabled: enabled() };
}

module.exports = {
  enabled,
  fetchFeeds,
  fetchEvents,
  fetchEvent,
  _getCacheStatus,
};