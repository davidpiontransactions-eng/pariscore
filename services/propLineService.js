'use strict';
/**
 * propLineService.js — PropLine player props odds API (bd ParisScorebis-grwl)
 *
 * Endpoint : https://api.prop-line.com/v1
 * Auth     : `?apiKey=$PROPLINE_API_KEY` query param
 * Doc      : https://api.prop-line.com/docs  /  https://prop-line.com/docs
 * Free tier: 1,000 req/day — 19 books + 6 exchanges (Kalshi, Polymarket, ...)
 *
 * Use case PariScore : nouvelle verticale player-props (PariScore n'a PAS cette
 *                      feature → différenciation vs concurrents). 60+ marchés,
 *                      54 sports dont 28 ligues soccer, NBA, MLB, NHL, UFC, tennis.
 *
 * Convention identique aux autres services :
 *   - lazy env via process.env.PROPLINE_API_KEY || ''
 *   - enabled() → bool
 *   - cache mémoire _mem (TTL 60s — refresh 60s/30s in-progress)
 *   - retourne [] si pas de résultat
 *
 * Zéro dépendance npm — Node 18+ fetch natif.
 */

const PROPLINE_BASE = 'https://api.prop-line.com/v1';
const PROPLINE_KEY = process.env.PROPLINE_API_KEY || '';
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60 * 1000;  // 60s — refresh toutes les 60s

const _mem = new Map();

function enabled() { return !!PROPLINE_KEY; }

async function _httpGet(pathname, params = {}) {
  if (!enabled()) throw new Error('PROPLINE_API_KEY manquante');
  const allParams = { apiKey: PROPLINE_KEY, ...params };
  const qs = '?' + new URLSearchParams(allParams).toString();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PROPLINE_BASE}${pathname}${qs}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore-propline/1.0' },
      signal: ctrl.signal,
    });
    if (res.status === 429) throw new Error(`propline rate-limited (1000 req/day sur free)`);
    if (res.status === 401) throw new Error(`propline HTTP 401 — clé invalide`);
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`propline HTTP ${res.status}: ${txt.slice(0, 200)}`);
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
 * GET /sports/{sport_key}/events
 * Sport keys: baseball_mlb, basketball_nba, basketball_wnba, americanfootball_nfl,
 *             icehockey_nhl, soccer_epl, soccer_uefa_champs_league, mma_mixed_martial_arts,
 *             tennis_atp, tennis_wta, boxing_boxing, golf_pga, soccer_efl_champ, ...
 */
async function fetchEventsBySport(sportKey) {
  if (!enabled() || !sportKey) return [];
  const cacheKey = `events:${sportKey}`;
  return _getCached(cacheKey, async () => {
    const data = await _httpGet(`/sports/${encodeURIComponent(sportKey)}/events`);
    return Array.isArray(data) ? data : (Array.isArray(data.events) ? data.events : []);
  });
}

/**
 * GET /sports/{sport_key}/events/{event_id}/odds?markets=player_points,player_rebounds&period=q1
 * markets ∈ {player_points, player_rebounds, player_assists, player_threes, pitcher_strikeouts,
 *             anytime_goalscorer, fight_winner, fight_goes_distance, ...}
 */
async function fetchEventOdds(sportKey, eventId, opts = {}) {
  if (!enabled() || !sportKey || !eventId) return null;
  const params = {};
  if (Array.isArray(opts.markets)) params.markets = opts.markets.join(',');
  if (opts.period) params.period = opts.period;
  if (opts.bookmakers) params.bookmakers = opts.bookmakers;
  const cacheKey = `odds:${sportKey}:${eventId}:${JSON.stringify(params)}`;
  return _getCached(cacheKey, () =>
    _httpGet(`/sports/${encodeURIComponent(sportKey)}/events/${encodeURIComponent(eventId)}/odds`, params)
  );
}

/**
 * GET /sports — liste des sports disponibles
 */
async function fetchSports() {
  if (!enabled()) return [];
  return _getCached('sports', async () => {
    const data = await _httpGet('/sports');
    return Array.isArray(data) ? data : (Array.isArray(data.sports) ? data.sports : []);
  });
}

/**
 * Convertit une cote américaine (int ±100) en décimale (1.XX).
 * US +150 → 2.50 ; US −122 → 1.82. Décimale reste inchangée.
 */
function _americanToDecimal(price) {
  const p = Number(price);
  if (!isFinite(p) || p === 0) return null;
  // Heuristique: cotes décimales sont 1.01..50 cotes US sont ±100..±10000
  // Si dans [1.01, 50], c'est déjà décimale.
  if (Math.abs(p) >= 1 && Math.abs(p) < 50 && p > 0) return Math.round(p * 10000) / 10000;
  if (p > 0) return Math.round((1 + p / 100) * 10000) / 10000;   // +150 → 2.50
  if (p < 0) return Math.round((1 + 100 / Math.abs(p)) * 10000) / 10000;  // −122 → 1.82
  return null;
}

/**
 * Normalise une cote (US → décimale si détecté). Retourne number ou null.
 */
function _normalizePrice(price) {
  return _americanToDecimal(price);
}

/**
 * Convertit un odds payload propline vers format bookmaker PariScore
 * (alignement the-odds-api pour computeEdge()).
 *
 * Props incluses :
 *   - Conversion automatique cotes US → décimales (PropLine renvoie US)
 *   - Filtrage options avec price=null (outcomes vides)
 *   - Conservation de tous les markets (h2h, spreads, totals, player_*)
 */
function toBookmakerShape(proplineOdds) {
  if (!proplineOdds || !Array.isArray(proplineOdds.bookmakers)) return [];
  return proplineOdds.bookmakers.map(bk => ({
    key: bk.key || (bk.title || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    title: bk.title || bk.key || 'unknown',
    last_update: bk.last_update || null,
    markets: (Array.isArray(bk.markets) ? bk.markets : []).map(m => ({
      key: m.key,
      last_update: m.last_update || null,
      period: m.period || null,
      outcomes: (Array.isArray(m.outcomes) ? m.outcomes : [])
        .map(o => {
          if (!o) return null;
          const price = _normalizePrice(o.price);
          if (price == null) return null;
          return {
            name: o.name || null,
            description: o.description || '',
            price,
            point: o.point != null ? o.point : null,
          };
        })
        .filter(Boolean),
    })).filter(m => m.outcomes.length > 0),
  })).filter(b => b.markets.length > 0);
}

function _getCacheStatus() {
  return { entries: _mem.size, ttl_ms: CACHE_TTL_MS, enabled: enabled() };
}

module.exports = {
  enabled,
  fetchSports,
  fetchEventsBySport,
  fetchEventOdds,
  toBookmakerShape,
  _americanToDecimal,
  _normalizePrice,
  _getCacheStatus,
};