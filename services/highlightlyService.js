'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//  Highlightly Basketball API — source croisée H2H (WNBA/NBA/340+ ligues)
//
//  STATUT : INERTE sans HIGHLIGHTLY_API_KEY + HIGHLIGHTLY_API_ENABLED=true
//  (pattern rotowireService / tennisApiService : aucun appel, aucun coût).
//
//  Rôle : 2e source de données pour le widget H2H basketball (H2H natif 10
//  dernières rencontres, last-five games, standings) — cross-check du calcul
//  interne ESPN (services/basketballH2HService.js) et alternative au snapshot
//  scrapé basketballstats.net (données incohérentes : PAPG/échantillons).
//
//  Base URL directe : https://basketball.highlightly.net
//  Via RapidAPI     : https://basketball-highlights-api.p.rapidapi.com
//  Headers : x-rapidapi-key (toujours) + x-rapidapi-host (RapidAPI seulement).
//
//  Endpoints (doc 7.2.4) :
//    GET /head-2-head?teamIdOne=..&teamIdTwo=..   → 10 dernières rencontres
//    GET /last-five-games?teamId=..               → 5 derniers matchs finis
//    GET /standings?leagueId=..&season=YYYY       → classement par groupe
//    GET /teams?name=..&limit=..&offset=..        → lookup équipes
//    GET /leagues                                 → lookup ligues
//
//  Config (.env) :
//    HIGHLIGHTLY_API_KEY=...          (obligatoire — https://highlightly.net/login)
//    HIGHLIGHTLY_API_ENABLED=true     (activation explicite)
//    HIGHLIGHTLY_API_HOST=...         (défaut basketbalhighlightly.net ; RapidAPI
//                                      = basketball-highlights-api.p.rapidapi.com)
//    HIGHLIGHTLY_DEBUG=true           (logs)
// ═══════════════════════════════════════════════════════════════════════════════

const https = require('https');

// ── Config (lazy env — server.js parse .env avant le require) ─────────────────
const API_KEY = () => process.env.HIGHLIGHTLY_API_KEY || '';
const HOST    = () => process.env.HIGHLIGHTLY_API_HOST || 'basketball.highlightly.net';
const ENABLED = () => process.env.HIGHLIGHTLY_API_ENABLED === 'true' && !!API_KEY();
const TIMEOUT_MS = 8000;
const DEBUG = String(process.env.HIGHLIGHTLY_DEBUG || 'false').toLowerCase() === 'true';
const _dbg = (...a) => { if (DEBUG) console.log('[Highlightly]', ...a); };

// ── Cache (clé → { data, ts }) ────────────────────────────────────────────────
const _cache = new Map();
const TTL_H2H   = 6 * 3600 * 1000;  // 6h — rencontres finies (stables)
const TTL_FORM  = 6 * 3600 * 1000;  // 6h
const TTL_STAND = 6 * 3600 * 1000;  // 6h — refresh site : jusqu'à 1h post-match
const TTL_META  = 24 * 3600 * 1000; // 24h — équipes/ligues

// ── HTTP GET avec retry (pattern tnnsLiveScraper/tennisApiService) ───────────
function _get(path, retries = 2) {
  return new Promise((resolve) => {
    if (!ENABLED()) return resolve(null);
    const host = HOST();
    const isRapid = host.includes('rapidapi.com');
    const headers = { 'x-rapidapi-key': API_KEY(), 'Accept': 'application/json' };
    if (isRapid) headers['x-rapidapi-host'] = host;
    const opts = {
      hostname: host,
      path: path.startsWith('/') ? path : '/' + path,
      method: 'GET',
      timeout: TIMEOUT_MS,
      headers,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch (_) { _dbg('JSON parse fail', path); resolve(null); }
        } else {
          _dbg(`HTTP ${res.statusCode}`, path);
          resolve(null);
        }
      });
    });
    req.on('error', (e) => {
      _dbg('req error', path, e.message);
      if (retries > 0) setTimeout(() => _get(path, retries - 1).then(resolve), 1000);
      else resolve(null);
    });
    req.on('timeout', () => { req.destroy(); if (retries > 0) setTimeout(() => _get(path, retries - 1).then(resolve), 1000); else resolve(null); });
    req.end();
  });
}

const _cacheGet = (k, ttl) => { const c = _cache.get(k); return c && (Date.now() - c.ts) < ttl ? c.data : null; };
const _cacheSet = (k, d) => { _cache.set(k, { data: d, ts: Date.now() }); };

// ── Normalisation match Highlightly → format interne (miroir basketballH2H) ───
// state.score.current = "105 - 104" ; q1..q4 / overTime optionnels.
function _normalizeMatch(m) {
  if (!m || !m.state || !m.state.score || !m.state.score.current) return null;
  const parts = String(m.state.score.current).split('-').map((s) => parseInt(s.trim(), 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return {
    id: m.id,
    date: m.date,
    stage: m.stage || null,
    status: (m.state.description || '').toLowerCase(),
    home: { id: m.homeTeam && m.homeTeam.id, name: (m.homeTeam && m.homeTeam.name) || '?' },
    away: { id: m.awayTeam && m.awayTeam.id, name: (m.awayTeam && m.awayTeam.name) || '?' },
    homeScore: parts[0],
    awayScore: parts[1],
    league: m.league ? { id: m.league.id, name: m.league.name, season: m.league.season } : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  API publique — jamais throw : toute erreur → null (best-effort)
// ═══════════════════════════════════════════════════════════════════════════════

function enabled() { return ENABLED(); }

function status() {
  return {
    name: 'highlightly',
    enabled: ENABLED(),
    host: HOST(),
    key: API_KEY() ? 'set' : 'missing',
    message: ENABLED() ? 'prêt' : 'HIGHLIGHTLY_API_KEY + HIGHLIGHTLY_API_ENABLED=true requis',
  };
}

async function ping() {
  if (!ENABLED()) return { ok: false, ...status() };
  const res = await _get('/leagues?limit=1', 0);
  return { ok: !!res, ...status(), leagues: res && res.data ? res.data.length : null };
}

/** 10 dernières rencontres H2H entre deux équipes (ordre indifférent). */
async function getHeadToHead(teamIdOne, teamIdTwo) {
  if (!ENABLED()) return null;
  const key = `h2h:${teamIdOne}:${teamIdTwo}`;
  const cached = _cacheGet(key, TTL_H2H);
  if (cached) return cached;
  const res = await _get(`/head-2-head?teamIdOne=${teamIdOne}&teamIdTwo=${teamIdTwo}`);
  if (!res || !Array.isArray(res.data)) return null;
  const out = res.data.map(_normalizeMatch).filter(Boolean);
  _cacheSet(key, out);
  return out;
}

/** 5 derniers matchs finis d'une équipe (form). */
async function getLastFiveGames(teamId) {
  if (!ENABLED()) return null;
  const key = `form:${teamId}`;
  const cached = _cacheGet(key, TTL_FORM);
  if (cached) return cached;
  const res = await _get(`/last-five-games?teamId=${teamId}`);
  if (!res || !Array.isArray(res.data)) return null;
  const out = res.data.map(_normalizeMatch).filter(Boolean);
  _cacheSet(key, out);
  return out;
}

/** Classement d'une ligue/saison → [{ group, standings: [{team, wins, loses, position, gamesPlayed, scoredPoints, receivedPoints}] }] */
async function getStandings(leagueId, season) {
  if (!ENABLED()) return null;
  const key = `standings:${leagueId}:${season}`;
  const cached = _cacheGet(key, TTL_STAND);
  if (cached) return cached;
  const res = await _get(`/standings?leagueId=${leagueId}&season=${season}`);
  if (!res || !res.data || !Array.isArray(res.data.groups)) return null;
  const out = res.data.groups.map((g) => ({
    group: g.name,
    standings: (g.standings || []).map((s) => ({
      team: s.team ? { id: s.team.id, name: s.team.name, logo: s.team.logo } : null,
      wins: s.wins, losses: s.loses, position: s.position,
      gamesPlayed: s.gamesPlayed, scoredPoints: s.scoredPoints, receivedPoints: s.receivedPoints,
    })),
  }));
  _cacheSet(key, out);
  return out;
}

/** Lookup équipes (filtre `name` optionnel) → [{id, name, logo}] */
async function getTeams(opts = {}) {
  if (!ENABLED()) return null;
  const q = [];
  if (opts.name) q.push(`name=${encodeURIComponent(opts.name)}`);
  if (opts.limit) q.push(`limit=${opts.limit}`);
  if (opts.offset) q.push(`offset=${opts.offset}`);
  const qs = q.length ? '?' + q.join('&') : '';
  const key = `teams:${qs}`;
  const cached = _cacheGet(key, TTL_META);
  if (cached) return cached;
  const res = await _get(`/teams${qs}`);
  if (!res || !res.data || !Array.isArray(res.data.data)) return null;
  const out = res.data.data;
  _cacheSet(key, out);
  return out;
}

/** Lookup ligues → [{id, name, logo, country, seasons}] */
async function getLeagues() {
  if (!ENABLED()) return null;
  const cached = _cacheGet('leagues', TTL_META);
  if (cached) return cached;
  const res = await _get('/leagues');
  if (!res || !res.data || !Array.isArray(res.data.data)) return null;
  const out = res.data.data;
  _cacheSet('leagues', out);
  return out;
}

/** Trouve l'id Highlightly d'une ligue par nom (ex. "WNBA") + sa saison courante. */
async function findLeague(name) {
  const leagues = await getLeagues();
  if (!leagues) return null;
  const hit = leagues.find((l) => String(l.name).toLowerCase() === String(name).toLowerCase())
    || leagues.find((l) => String(l.name).toLowerCase().includes(String(name).toLowerCase()));
  if (!hit) return null;
  const seasons = (hit.seasons || []).map((s) => s.season).sort((a, b) => b - a);
  return { id: hit.id, name: hit.name, logo: hit.logo, seasons };
}

/** Trouve l'id Highlightly d'une équipe par nom (ex. "Connecticut Sun"). */
async function findTeam(name) {
  const teams = await getTeams({ name });
  if (!teams) return null;
  const hit = teams.find((t) => String(t.name).toLowerCase() === String(name).toLowerCase())
    || teams.find((t) => String(t.name).toLowerCase().includes(String(name).toLowerCase()));
  return hit ? { id: hit.id, name: hit.name, logo: hit.logo } : null;
}

module.exports = {
  enabled, status, ping,
  getHeadToHead, getLastFiveGames, getStandings,
  getTeams, getLeagues, findLeague, findTeam,
  _get, // exposé pour tests/audit
};