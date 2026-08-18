'use strict';
/**
 * sportmonksService.js — Sportmonks Football API v3 (bd ParisScorebis-d8md)
 *
 * Endpoint : https://api.sportmonks.com/v3/football
 * Auth     : query param `?api_token=$SPORTMONKS_API_KEY`
 * Doc      : https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints.md
 * Free tier: 180 req/h sur plan basique — backtesting + standings détaillés.
 *
 * Use case PariScore : historique complet + standings détaillés + TV channels —
 *                      backtesting stratégies. Couvre trous API-FOOTBALL.
 *
 * Endpoints utilisés :
 *   GET /fixtures/by-date/{date}              — fixtures d'une date
 *   GET /fixtures/{id}                        — détail fixture
 *   GET /fixtures/{id}?include=statistics     — stats détaillées
 *   GET /standings/latest/{league_id}         — classement à jour
 *   GET /teams/{id}                           — équipe
 *   GET /leagues                              — liste ligues
 *   GET /livescores/inplay                    — live scores
 *
 * Convention identique aux autres services :
 *   - lazy env via process.env.SPORTMONKS_API_KEY || ''
 *   - enabled() → bool
 *   - cache mémoire _mem (TTL 6h pour data stable, 60s pour live)
 *
 * Zéro dépendance npm — Node 18+ fetch natif.
 */

const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_LONG_MS = 6 * 3600 * 1000;  // 6h
const CACHE_TTL_LIVE_MS = 60 * 1000;        // 60s

const _mem = new Map();

function enabled() { return !!SPORTMONKS_KEY; }

async function _httpGet(pathname, params = {}, includeParam = null) {
  if (!enabled()) throw new Error('SPORTMONKS_API_KEY manquante');
  const allParams = { api_token: SPORTMONKS_KEY, ...params };
  if (includeParam) allParams.include = includeParam;
  const qs = '?' + new URLSearchParams(allParams).toString();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SPORTMONKS_BASE}${pathname}${qs}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore-sportmonks/1.0' },
      signal: ctrl.signal,
    });
    if (res.status === 429) throw new Error(`sportmonks rate-limited (180 req/h sur free)`);
    if (res.status === 401) throw new Error(`sportmonks HTTP 401 — clé invalide`);
    if (res.status === 402) throw new Error(`sportmonks HTTP 402 — endpoint hors plan free`);
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`sportmonks HTTP ${res.status}: ${txt.slice(0, 200)}`);
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
 * GET /fixtures/between/{from}/{to}?include=participants,league
 * (Endpoint "by-date" n'existe pas — on utilise between avec from=to=date)
 */
async function fetchFixturesByDate(dateStr, opts = {}) {
  if (!enabled() || !dateStr) return [];
  const include = opts.include || 'participants;league';
  const cacheKey = `fx:${dateStr}:${include}`;
  return _getCached(cacheKey, () =>
    _httpGet(`/fixtures/between/${encodeURIComponent(dateStr)}/${encodeURIComponent(dateStr)}`, {}, include)
  ).then(d => Array.isArray(d && d.data) ? d.data : []);
}

/**
 * GET /fixtures/{id}?include=statistics;participants;league
 */
async function fetchFixture(fixtureId, opts = {}) {
  if (!enabled() || !fixtureId) return null;
  const include = opts.include || 'statistics;participants;league';
  const cacheKey = `fx:${fixtureId}:${include}`;
  return _getCached(cacheKey, () =>
    _httpGet(`/fixtures/${encodeURIComponent(fixtureId)}`, {}, include)
  ).then(d => d && d.data ? d.data : null);
}

/**
 * GET /standings/latest/{league_id}
 */
async function fetchStandings(leagueId) {
  if (!enabled() || !leagueId) return [];
  return _getCached(`std:${leagueId}`, () =>
    _httpGet(`/standings/latest/${encodeURIComponent(leagueId)}`)
  ).then(d => d && d.data && Array.isArray(d.data.standings) ? d.data.standings : []);
}

/**
 * GET /teams/{id}?include=coach;players
 */
async function fetchTeam(teamId, opts = {}) {
  if (!enabled() || !teamId) return null;
  const include = opts.include || 'coach';
  const cacheKey = `team:${teamId}:${include}`;
  return _getCached(cacheKey, () =>
    _httpGet(`/teams/${encodeURIComponent(teamId)}`, {}, include)
  ).then(d => d && d.data ? d.data : null);
}

/**
 * GET /leagues — toutes les ligues (paginé)
 */
async function fetchLeagues(opts = {}) {
  if (!enabled()) return [];
  const page = opts.page || 1;
  const cacheKey = `leagues:${page}`;
  return _getCached(cacheKey, () =>
    _httpGet('/leagues', { page })
  ).then(d => d && d.data ? d.data : []);
}

/**
 * GET /livescores/inplay — scores live (60s TTL)
 */
async function fetchLiveScores() {
  if (!enabled()) return [];
  return _getCached('live', () =>
    _httpGet('/livescores/inplay')
  , CACHE_TTL_LIVE_MS).then(d => d && d.data ? d.data : []);
}

/**
 * Convertit un fixture Sportmonks vers format PariScore (raw).
 */
function toPariScoreFormat(fx) {
  if (!fx) return null;
  const home = fx.participants && fx.participants.find(p => p.meta && p.meta.location === 'home');
  const away = fx.participants && fx.participants.find(p => p.meta && p.meta.location === 'away');
  const score = fx.scores && Array.isArray(fx.scores) ? fx.scores : [];
  const cur = score.find(s => s && (s.description === 'CURRENT' || s.type === 'overall')) || score[0] || {};
  return {
    source: 'sportmonks',
    sm_fixture_id: fx.id,
    commence_time: fx.starting_at || null,
    status: fx.state || null,
    home_team: home ? home.name : null,
    home_team_id: home ? home.id : null,
    away_team: away ? away.name : null,
    away_team_id: away ? away.id : null,
    home_score: cur.score_home != null ? cur.score_home : null,
    away_score: cur.score_away != null ? cur.score_away : null,
    league: fx.league ? fx.league.name : null,
    league_id: fx.league_id || (fx.league ? fx.league.id : null),
    season_id: fx.season_id || null,
  };
}

function _getCacheStatus() {
  return { entries: _mem.size, enabled: enabled() };
}

module.exports = {
  enabled,
  fetchFixturesByDate,
  fetchFixture,
  fetchStandings,
  fetchTeam,
  fetchLeagues,
  fetchLiveScores,
  toPariScoreFormat,
  _getCacheStatus,
};