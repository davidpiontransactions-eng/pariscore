'use strict';
/**
 * footballDataService.js — football-data.org free-tier REST wrapper (bd ParisScorebis-jtsp)
 *
 * Endpoint : https://api.football-data.org/v4
 * Auth     : header `X-Auth-Token: $FOOTBALL_DATA_KEY`
 * Doc      : https://www.football-data.org/documentation/quickstart
 * Free tier: 10 req/min — top leagues EU (PL/PD/SA/BL/FL1/Eredivisie/Primeira/Championship/UCL/ECL)
 *
 * Use case PariScore : cross-validation / fallback API-FOOTBALL sur les ligues EU.
 *                      Retourne matches, standings, équipes, compétitions.
 *
 * Convention identique aux autres services :
 *   - lazy env via process.env.FOOTBALL_DATA_KEY || ''
 *   - enabled() → bool, permet kill-switch dans routes
 *   - cache mémoire _mem (TTL 6h, fallback stale si HTTP fail)
 *   - retourne null si clé absente
 *
 * Zéro dépendance npm — Node 18+ fetch natif.
 */

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || '';
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 6 * 3600 * 1000;  // 6h (données stables pré-match)

// Cache mémoire clé string → { ts, data }. Stale-fallback si HTTP fail.
const _mem = new Map();

function enabled() { return !!FOOTBALL_DATA_KEY; }

async function _httpGet(pathname) {
  if (!enabled()) throw new Error('FOOTBALL_DATA_KEY manquante');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${FOOTBALL_DATA_BASE}${pathname}`, {
      headers: {
        'X-Auth-Token': FOOTBALL_DATA_KEY,
        'Accept': 'application/json',
        'User-Agent': 'PariScore-football-data/1.0',
      },
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      const reset = res.headers.get('X-RequestCounter-Reset') || '60';
      throw new Error(`football-data rate-limited (reset in ${reset}s)`);
    }
    if (res.status === 403) {
      throw new Error(`football-data HTTP 403 (souvent free-tier = ligues EU uniquement, ressource hors quota)`);
    }
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`football-data HTTP ${res.status}: ${txt.slice(0, 200)}`);
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
    if (cached) return cached.data;  // stale fallback
    throw e;
  }
}

/**
 * GET /matches?date=YYYY-MM-DD&status=SCHEDULED|LIVE|FINISHED|...
 * Retourne liste brute football-data (champs : id, utcDate, status, matchday,
 * homeTeam/awayTeam {id,name}, score.fullTime/halfTime, competition, area).
 */
async function fetchMatchesByDate(dateStr) {
  if (!enabled()) return null;
  const cacheKey = `matches:date:${dateStr}`;
  return _getCached(cacheKey, async () => {
    const data = await _httpGet(`/matches?date=${encodeURIComponent(dateStr)}`);
    return Array.isArray(data.matches) ? data.matches : [];
  });
}

/**
 * GET /competitions/{id}/matches?season=YYYY&matchday=N&status=...
 * competitionId ∈ {PL, PD, SA, BL1, FL1, ERED, PPL, ELC, UCL, UECL}
 */
async function fetchCompetitionMatches(competitionId, opts = {}) {
  if (!enabled() || !competitionId) return null;
  const season = opts.season || '';
  const matchday = opts.matchday || '';
  const status = opts.status || '';
  const cacheKey = `comp:${competitionId}:${season}:${matchday}:${status}`;
  return _getCached(cacheKey, async () => {
    const params = [];
    if (season) params.push(`season=${season}`);
    if (matchday) params.push(`matchday=${matchday}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    const data = await _httpGet(`/competitions/${encodeURIComponent(competitionId)}/matches${qs}`);
    return Array.isArray(data.matches) ? data.matches : [];
  });
}

/**
 * GET /teams/{id}
 */
async function fetchTeam(teamId) {
  if (!enabled() || !teamId) return null;
  const cacheKey = `team:${teamId}`;
  return _getCached(cacheKey, () => _httpGet(`/teams/${encodeURIComponent(teamId)}`));
}

/**
 * GET /competitions/{id}/standings
 * Retourne tableau standings[] (TOTAL, HOME, AWAY).
 */
async function fetchStandings(competitionId) {
  if (!enabled() || !competitionId) return null;
  const cacheKey = `standings:${competitionId}`;
  return _getCached(cacheKey, async () => {
    const data = await _httpGet(`/competitions/${encodeURIComponent(competitionId)}/standings`);
    return Array.isArray(data.standings) ? data.standings : [];
  });
}

/**
 * GET /competitions — liste des compétitions dispo free-tier.
 * Cache long (24h) — change 1x/saison.
 */
async function fetchCompetitions() {
  if (!enabled()) return null;
  const cacheKey = `competitions`;
  return _getCached(cacheKey, async () => {
    const data = await _httpGet(`/competitions`);
    return Array.isArray(data.competitions) ? data.competitions : [];
  });
}

/**
 * Convertit un match football-data vers un format compatible PariScore (raw).
 * Champs : id, utcDate, status, homeTeam.name, awayTeam.name, score.fullTime.home/away.
 */
function toPariScoreFormat(fdMatch) {
  if (!fdMatch) return null;
  const score = fdMatch.score && fdMatch.score.fullTime ? fdMatch.score.fullTime : {};
  return {
    source: 'football-data',
    fd_match_id: fdMatch.id,
    utc_date: fdMatch.utcDate || null,
    status: fdMatch.status || null,
    matchday: fdMatch.matchday || null,
    home_team: fdMatch.homeTeam && fdMatch.homeTeam.name || null,
    home_team_id: fdMatch.homeTeam && fdMatch.homeTeam.id || null,
    away_team: fdMatch.awayTeam && fdMatch.awayTeam.name || null,
    away_team_id: fdMatch.awayTeam && fdMatch.awayTeam.id || null,
    home_score: score.home != null ? score.home : null,
    away_score: score.away != null ? score.away : null,
    competition: fdMatch.competition && fdMatch.competition.name || null,
    competition_id: fdMatch.competition && fdMatch.competition.code || null,
    area: fdMatch.area && fdMatch.area.name || null,
  };
}

function _getCacheStatus() {
  return { entries: _mem.size, ttl_ms: CACHE_TTL_MS, enabled: enabled() };
}

module.exports = {
  enabled,
  fetchMatchesByDate,
  fetchCompetitionMatches,
  fetchTeam,
  fetchStandings,
  fetchCompetitions,
  toPariScoreFormat,
  _getCacheStatus,
};