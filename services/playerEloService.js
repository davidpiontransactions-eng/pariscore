'use strict';
/**
 * playerEloService.js — PlayerElo football prediction & Elo API (bd ParisScorebis-5xth)
 *
 * Endpoint : https://data-api.playerelo.football
 * Auth     : `Authorization: Bearer $PLAYERELO_API_KEY`
 * Doc      : https://playerelo.football/api-access
 * Free tier: 500 req/mois, 10 req/min. 78K+ players, 176 ligues.
 *
 * Use case PariScore : branche direct dans les modules Elo existants.
 *   - player Elo ratings individuels (78K joueurs)
 *   - prédictions fixtures upcoming (win prob home/draw/away)
 *   - value-bets signaux (fair odds vs market)
 *   - league/club rankings
 *
 * Convention identique aux autres services :
 *   - lazy env via process.env.PLAYERELO_API_KEY || ''
 *   - enabled() → bool
 *   - cache mémoire _mem (TTL 6h pour ratings, 5min pour prédictions live)
 *
 * Zéro dépendance npm — Node 18+ fetch natif.
 */

const PLAYERELO_BASE = 'https://data-api.playerelo.football';
const PLAYERELO_KEY = process.env.PLAYERELO_API_KEY || '';
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_LONG_MS = 6 * 3600 * 1000;  // 6h ratings
const CACHE_TTL_SHORT_MS = 5 * 60 * 1000;   // 5min prédictions

const _mem = new Map();

function enabled() { return !!PLAYERELO_KEY; }

async function _httpGet(pathname, params = {}) {
  if (!enabled()) throw new Error('PLAYERELO_API_KEY manquante');
  const qs = Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PLAYERELO_BASE}${pathname}${qs}`, {
      headers: {
        'Authorization': `Bearer ${PLAYERELO_KEY}`,
        'Accept': 'application/json',
        'User-Agent': 'PariScore-playerelo/1.0',
      },
      signal: ctrl.signal,
    });
    if (res.status === 429) throw new Error(`playerelo rate-limited (10 req/min sur free)`);
    if (res.status === 401) throw new Error(`playerelo HTTP 401 — clé invalide`);
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`playerelo HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function _getCached(cacheKey, fetcher, ttlMs = CACHE_TTL_LONG_MS) {
  const cached = _mem.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < ttlMs) return cached.data;
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
 * GET /v1/players?limit=N&offset=N — top joueurs par Elo
 */
async function fetchTopPlayers(opts = {}) {
  if (!enabled()) return null;
  const limit = Math.min(opts.limit || 50, 100);
  const offset = opts.offset || 0;
  return _getCached(`players:${limit}:${offset}`, () =>
    _httpGet('/v1/players', { limit, offset })
  );
}

/**
 * GET /v1/players/{id} — joueur individuel (Elo, EAR, rank)
 */
async function fetchPlayer(playerId) {
  if (!enabled() || !playerId) return null;
  return _getCached(`player:${playerId}`, () => _httpGet(`/v1/players/${encodeURIComponent(playerId)}`));
}

/**
 * GET /v1/players/{id}/history — historique Elo match-by-match
 */
async function fetchPlayerHistory(playerId) {
  if (!enabled() || !playerId) return null;
  return _getCached(`history:${playerId}`, () => _httpGet(`/v1/players/${encodeURIComponent(playerId)}/history`));
}

/**
 * GET /v1/players/{id}/trend — mouvement Elo 28 jours
 */
async function fetchPlayerTrend(playerId) {
  if (!enabled() || !playerId) return null;
  return _getCached(`trend:${playerId}`, () => _httpGet(`/v1/players/${encodeURIComponent(playerId)}/trend`));
}

/**
 * GET /v1/predictions — upcoming match predictions (home/draw/away win prob)
 */
async function fetchPredictions() {
  if (!enabled()) return null;
  return _getCached('predictions', () => _httpGet('/v1/predictions'), CACHE_TTL_SHORT_MS);
}

/**
 * GET /v1/fixtures/{id}/prediction — prédiction + scoreline odds pour un fixture
 */
async function fetchFixturePrediction(fixtureId) {
  if (!enabled() || !fixtureId) return null;
  return _getCached(`fxpred:${fixtureId}`, () => _httpGet(`/v1/fixtures/${encodeURIComponent(fixtureId)}/prediction`), CACHE_TTL_SHORT_MS);
}

/**
 * GET /v1/value-bets — value-bets signaux (fair odds vs market)
 */
async function fetchValueBets() {
  if (!enabled()) return null;
  return _getCached('valuebets', () => _httpGet('/v1/value-bets'), CACHE_TTL_SHORT_MS);
}

/**
 * GET /v1/leagues — league strength table
 */
async function fetchLeagues() {
  if (!enabled()) return null;
  return _getCached('leagues', () => _httpGet('/v1/leagues'));
}

/**
 * GET /v1/usage — usage quota (ne compte pas dans quota)
 */
async function fetchUsage() {
  if (!enabled()) return null;
  return _getCached('usage', () => _httpGet('/v1/usage'), 60 * 1000);
}

/**
 * Convertit une prédiction PlayerElo vers format PariScore value-bet.
 * Input réel (vérifié 2026-08-18) :
 *   { fixture_id, kickoff_time, league_name, home_team, away_team,
 *     home_team_elo, away_team_elo, p_home, p_draw, p_away, status }
 * Ancienne spec doc (probabilities.*) gardée en fallback pour rétrocompat.
 */
function toValueBetShape(prediction) {
  if (!prediction) return null;
  // Format réel PlayerElo (flat) : p_home/p_draw/p_away entre 0 et 1 (probas)
  // Ancienne spec hypothétique (nested) : probabilities.{home,draw,away}
  const probHome = prediction.p_home != null ? prediction.p_home
                 : (prediction.probabilities && prediction.probabilities.home != null ? prediction.probabilities.home : null);
  const probDraw = prediction.p_draw != null ? prediction.p_draw
                 : (prediction.probabilities && prediction.probabilities.draw != null ? prediction.probabilities.draw : null);
  const probAway = prediction.p_away != null ? prediction.p_away
                 : (prediction.probabilities && prediction.probabilities.away != null ? prediction.probabilities.away : null);
  const commence = prediction.kickoff_time || prediction.kickoff || prediction.commence_time || null;
  return {
    source: 'playerelo',
    fixture_id: prediction.fixture_id || null,
    home_team: prediction.home_team || null,
    away_team: prediction.away_team || null,
    commence_time: commence,
    prob_home: probHome,
    prob_draw: probDraw,
    prob_away: probAway,
    home_team_elo: prediction.home_team_elo || null,
    away_team_elo: prediction.away_team_elo || null,
    league_name: prediction.league_name || null,
    status: prediction.status || null,
    fair_odds: prediction.fair_odds || null,
    market_odds: prediction.market_odds || null,
    value: prediction.value || null,
  };
}

function _getCacheStatus() {
  return { entries: _mem.size, enabled: enabled() };
}

module.exports = {
  enabled,
  fetchTopPlayers,
  fetchPlayer,
  fetchPlayerHistory,
  fetchPlayerTrend,
  fetchPredictions,
  fetchFixturePrediction,
  fetchValueBets,
  fetchLeagues,
  fetchUsage,
  toValueBetShape,
  _getCacheStatus,
};