'use strict';
/**
 * dinoMarketsService.js — Dino.markets Kalshi + Polymarket aggregator (bd ParisScorebis-c8rj)
 *
 * Endpoint : https://api.dino.markets
 * Auth     : header `Authorization: Bearer $DINO_MARKETS_API_KEY`
 * Free tier: 10 000 req/mois, 10 req/sec + 1 WebSocket curated `sample` channel
 * Doc      : https://dino.markets + Python SDK archi github.com/dino-markets/dino-markets-python
 *
 * ⚠️  Endpoint paths validés via le SDK Python officiel (archivé 2026-08-10 mais
 *     specs à jour) — les curls directs sur dino.markets renvoient 404 (anti-bot),
 *     mais l'API est fonctionnelle depuis tout client authentifié.
 *
 * Use case PariScore : ouvre verticale prediction-market — Kalshi sports +
 *                      Polymarket + cross-venue ARBITRAGE confirmé (la valeur
 *                      ajoutée principale de Dino, unique sur le marché).
 *
 * Endpoints implémentés (depuis le SDK Python) :
 *   GET /v2/markets?sport=&league=&status=&signal=&sort=&include=&market_type=&game_id=&limit=
 *       → matched cross-venue catalog (signal=spread|candidates pour filtrer)
 *   GET /v2/pairs/{market_id}             → single market (id=dino_<uuid> or bare uuid)
 *   GET /v2/pairs/{market_id}/history     → per-outcome price history
 *   GET /v2/leagues                       → leagues in season + lifecycle counts
 *   GET /v2/arbitrage?sport=&limit=       → ⭐ confirmed cross-venue Opportunities
 *   POST /v2/report-bad-arb               → flag mauvaise arb (au moins 1 champ)
 *   POST /v1/stream/token                 → WebSocket connect ticket
 *
 * Convention identique aux autres services :
 *   - lazy env via process.env.DINO_MARKETS_API_KEY || ''
 *   - enabled() → bool
 *   - cache mémoire _mem (TTL 5 min — prediction-market dynamique)
 *
 * Zéro dépendance npm — Node 18+ fetch natif.
 */

const DINO_BASE = 'https://api.dino.markets';
const DINO_KEY = process.env.DINO_MARKETS_API_KEY || '';
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 min

const _mem = new Map();

function enabled() { return !!DINO_KEY; }

async function _httpGet(pathname, params = {}) {
  if (!enabled()) throw new Error('DINO_MARKETS_API_KEY manquante');
  const qs = Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${DINO_BASE}${pathname}${qs}`, {
      headers: {
        'Authorization': `Bearer ${DINO_KEY}`,
        'Accept': 'application/json',
        'User-Agent': 'PariScore-dino/1.0',
      },
      signal: ctrl.signal,
    });
    if (res.status === 401) throw new Error(`dino HTTP 401 — clé invalide ou révoquée`);
    if (res.status === 429) throw new Error(`dino rate-limited (10 req/sec sur free)`);
    if (res.status === 402) throw new Error(`dino HTTP 402 — endpoint hors plan free`);
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`dino HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function _post(pathname, body) {
  if (!enabled()) throw new Error('DINO_MARKETS_API_KEY manquante');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${DINO_BASE}${pathname}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DINO_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'PariScore-dino/1.0',
      },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    if (res.status === 401) throw new Error(`dino HTTP 401 — clé invalide ou révoquée`);
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`dino HTTP ${res.status}: ${txt.slice(0, 200)}`);
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
 * GET /v2/markets — matched cross-venue catalog (Kalshi + Polymarket)
 * Paramètres utiles : sport, league, status (open/live/closed), signal (spread/candidates),
 *                     sort, include, market_type, game_id, limit (1-1000, default 500)
 */
async function fetchMarkets(opts = {}) {
  if (!enabled()) return { markets: [], _meta: 'disabled' };
  const cacheKey = `markets:${JSON.stringify(opts)}`;
  return _getCached(cacheKey, () => {
    const params = {};
    ['sport', 'league', 'status', 'signal', 'sort', 'include', 'market_type', 'game_id', 'limit'].forEach(k => {
      if (opts[k] != null) params[k] = String(opts[k]);
    });
    return _httpGet('/v2/markets', params);
  });
}

/**
 * GET /v2/pairs/{market_id} — detail d'un marché (canonical Kalshi vs Polymarket pair)
 * market_id accepte 'dino_<uuid>' ou bare uuid.
 */
async function fetchMarket(marketId) {
  if (!enabled() || !marketId) return null;
  const cacheKey = `pair:${marketId}`;
  return _getCached(cacheKey, () => _httpGet(`/v2/pairs/${encodeURIComponent(marketId)}`));
}

/**
 * GET /v2/pairs/{market_id}/history — historique prix par outcome (arbitrage backtest)
 */
async function fetchMarketHistory(marketId) {
  if (!enabled() || !marketId) return null;
  const cacheKey = `history:${marketId}`;
  return _getCached(cacheKey, () => _httpGet(`/v2/pairs/${encodeURIComponent(marketId)}/history`));
}

/**
 * GET /v2/leagues — ligues en saison avec lifecycle counts
 */
async function fetchLeagues() {
  if (!enabled()) return null;
  return _getCached('leagues', () => _httpGet('/v2/leagues'));
}

/**
 * GET /v2/arbitrage — ⭐ KILLER FEATURE : confirmed cross-venue Opportunities
 * Retourne enveloppe `{ opportunities: [{title, roi_pct, fee_model, max_wager_usd, legs: [...]}] }`
 * Use case PariScore : détecter arb Kalshi↔Polymarket, ROI > 0 = bet garanti (hors frais).
 */
async function fetchArbitrage(opts = {}) {
  if (!enabled()) return { opportunities: [] };
  const params = {};
  if (opts.sport) params.sport = opts.sport;
  if (opts.limit) params.limit = String(opts.limit);
  const cacheKey = `arb:${JSON.stringify(opts)}`;
  return _getCached(cacheKey, () => _httpGet('/v2/arbitrage', params));
}

/**
 * POST /v2/report-bad-arb — flag une opportunity douteuse (au moins 1 champ requis)
 */
async function reportBadArb(opts) {
  if (!enabled()) return null;
  const body = {};
  ['opp_id', 'reason', 'sport', 'market', 'detail'].forEach(k => {
    if (opts && opts[k]) body[k] = opts[k];
  });
  if (Object.keys(body).length === 0) {
    throw new Error('reportBadArb: au moins un champ (opp_id, reason, sport, market, detail) requis');
  }
  return _post('/v2/report-bad-arb', body);
}

/**
 * POST /v1/stream/token — mint un ticket WebSocket court (free → curated `sample` channel)
 */
async function mintStreamToken() {
  if (!enabled()) return null;
  return _post('/v1/stream/token', {});
}

function _getCacheStatus() {
  return { entries: _mem.size, ttl_ms: CACHE_TTL_MS, enabled: enabled() };
}

module.exports = {
  enabled,
  fetchMarkets,
  fetchMarket,
  fetchMarketHistory,
  fetchLeagues,
  fetchArbitrage,
  reportBadArb,
  mintStreamToken,
  _getCacheStatus,
};