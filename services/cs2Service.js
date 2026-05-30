'use strict';
/**
 * cs2Service.js — CS2 / CSGO data pipeline
 * Primary source : BSD CSGO addon (https://sports.bzzoiro.com/csgo/)
 * Secondary      : HLTV public ranking page (lightweight scraper, fallback-safe)
 */

const https = require('https');

// ─── Constants ───────────────────────────────────────────────────────────────
const ACTIVE_MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2'];
const CS2_BSD_TTL_MS  = 30 * 1000;          // 30 s — live data
const HLTV_TTL_MS     = 10 * 60 * 1000;     // 10 min — rankings change slowly
const HLTV_TIMEOUT_MS = 5000;
const CS2_BSD_BASE    = 'https://sports.bzzoiro.com/csgo';

// ─── Caches ──────────────────────────────────────────────────────────────────
let _cs2Cache  = { ts: 0, data: [] };
let _hltvCache = { ts: 0, rankings: {} };   // teamName.lower() → HLTV rank int

// ─── Native https with timeout ───────────────────────────────────────────────
function _get(url, headers = {}, timeoutMs = HLTV_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname : u.hostname,
      path     : u.pathname + u.search,
      method   : 'GET',
      headers  : {
        'User-Agent': 'Mozilla/5.0 (compatible; PariScore-CS2/1.0)',
        'Accept'    : 'text/html,application/json',
        ...headers
      }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end',  () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

// ─── BSD CSGO fetch with auth token ──────────────────────────────────────────
async function _bsdCs2Get(endpoint, apiKey, retries = 2) {
  const url = `${CS2_BSD_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}tz=Europe/Paris`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await _get(url, { 'Authorization': `Token ${apiKey}` }, 8000);
      if (res.status === 200) {
        try { return { status: 200, data: JSON.parse(res.body) }; }
        catch (e) { return { status: 500, data: null }; }
      }
      if (attempt < retries && (res.status >= 500 || res.status === 429)) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { status: res.status, data: null };
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

// ─── HLTV ranking scraper (best-effort, silent fallback) ─────────────────────
async function _fetchHltvRankings() {
  if (Date.now() - _hltvCache.ts < HLTV_TTL_MS) return _hltvCache;
  try {
    const res = await _get('https://www.hltv.org/ranking/teams/', {
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.hltv.org/'
    }, HLTV_TIMEOUT_MS);

    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

    // Parse: <div class="ranking-header"><span class="position">#N</span>…<span class="name">T</span>
    const rankings = {};
    const re = /<span class="position">#(\d+)<\/span>[\s\S]*?<span class="name">([^<]+)<\/span>/g;
    let m;
    while ((m = re.exec(res.body)) !== null) {
      rankings[m[2].trim().toLowerCase()] = parseInt(m[1], 10);
    }
    if (Object.keys(rankings).length > 3) {
      _hltvCache = { ts: Date.now(), rankings };
      console.log(`[CS2/HLTV] Rankings fetched — ${Object.keys(rankings).length} teams`);
    } else {
      // Fallback: try alternate pattern (HLTV may update their HTML structure)
      const re2 = /<div[^>]+class="[^"]*ranked-team[^"]*"[^>]*>[\s\S]*?#(\d+)[\s\S]*?<div[^>]+class="[^"]*name[^"]*"[^>]*>([^<]+)</g;
      while ((m = re2.exec(res.body)) !== null) {
        rankings[m[2].trim().toLowerCase()] = parseInt(m[1], 10);
      }
      if (Object.keys(rankings).length > 0) {
        _hltvCache = { ts: Date.now(), rankings };
      }
    }
  } catch (e) {
    console.warn('[CS2/HLTV] Unavailable, rankings skipped:', e.message);
  }
  return _hltvCache;
}

// ─── Match normalization (BSD CSGO schema varies by addon version) ────────────
function _normalizeMatch(raw) {
  const team1 = raw.team1 || raw.home_team || raw.player1 || {};
  const team2 = raw.team2 || raw.away_team || raw.player2 || {};

  const statusRaw = (raw.status || '').toLowerCase();
  const isLive = statusRaw === 'inprogress' || statusRaw === 'live' ||
                 statusRaw === '2' || raw.is_live === true;

  // Map / format detection
  const bestOf      = raw.best_of || raw.format || raw.bo || 3;
  const currentMap  = raw.current_map  || raw.map_name || raw.map   || null;
  const mapNumber   = raw.map_number   || raw.current_map_number     || null;

  // Series score (maps won)
  const maps1 = raw.maps_won_team1 ?? raw.map_score_team1 ?? raw.score1_maps ?? null;
  const maps2 = raw.maps_won_team2 ?? raw.map_score_team2 ?? raw.score2_maps ?? null;

  // Round score within current map
  const rounds1 = raw.score_home ?? raw.score1 ?? raw.round_score_team1 ?? raw.ct_score_team1 ?? null;
  const rounds2 = raw.score_away ?? raw.score2 ?? raw.round_score_team2 ?? raw.ct_score_team2 ?? null;

  // Logo helper — append bg=transparent
  const logo = (url) => url ? url + (url.includes('?') ? '&' : '?') + 'bg=transparent' : null;

  return {
    id          : String(raw.id || raw.match_id || `cs2_${Math.random().toString(36).slice(2)}`),
    sport       : 'cs2',
    tournament  : raw.tournament || raw.competition || raw.league_name || raw.league || 'CS2',
    tournament_logo: logo(raw.tournament_logo || raw.competition_logo || null),
    status      : isLive ? 'live' : (statusRaw === 'finished' || statusRaw === 'ft' ? 'finished' : 'prematch'),
    is_live     : isLive,
    scheduled   : raw.scheduled || raw.start_time || raw.commence_time || null,
    best_of     : bestOf,
    current_map : currentMap,
    map_number  : mapNumber,
    team1: {
      name      : String(team1.name || team1.title || 'TBD'),
      logo      : logo(team1.logo || team1.image || team1.logo_url || null),
      country   : team1.country || team1.nationality || null,
      hltv_rank : null   // enriched below
    },
    team2: {
      name      : String(team2.name || team2.title || 'TBD'),
      logo      : logo(team2.logo || team2.image || team2.logo_url || null),
      country   : team2.country || team2.nationality || null,
      hltv_rank : null
    },
    maps_score  : { team1: maps1, team2: maps2 },
    round_score : { team1: rounds1, team2: rounds2 },
    odds        : {
      team1: raw.odds_team1 ?? raw.odds_player1 ?? raw.home_odds ?? raw.odds1 ?? null,
      team2: raw.odds_team2 ?? raw.odds_player2 ?? raw.away_odds ?? raw.odds2 ?? null
    },
    map_advantage: computeMapAdvantage(null, null, currentMap)
  };
}

// ─── Map advantage indicator ──────────────────────────────────────────────────
// mapStats shape: { mirage: 72, inferno: 45, ... } (winrate %)
// Returns null when map not known or no stats.
function computeMapAdvantage(t1MapStats, t2MapStats, currentMap) {
  if (!currentMap) return null;
  const map = currentMap.toLowerCase().replace(/[^a-z]/g, '');
  const t1wr = (t1MapStats || {})[map];
  const t2wr = (t2MapStats || {})[map];
  if (t1wr == null && t2wr == null) return null;
  const t1 = t1wr != null ? t1wr : 50;
  const t2 = t2wr != null ? t2wr : 50;
  const diff = t1 - t2;
  return {
    team1_wr  : t1,
    team2_wr  : t2,
    advantage : diff >= 20 ? 'team1' : diff <= -20 ? 'team2' : 'neutral',
    value_flag: Math.abs(diff) >= 20 ? '✓ Value Map' : null
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {
  ACTIVE_MAPS,
  computeMapAdvantage,

  invalidateCache() { _cs2Cache.ts = 0; },

  async getCs2Matches(apiKey) {
    if (!apiKey) {
      console.warn('[CS2Service] BSD_API_KEY absent — CS2 feed disabled');
      return [];
    }

    // Return from cache if fresh
    if (Date.now() - _cs2Cache.ts < CS2_BSD_TTL_MS) return _cs2Cache.data;

    try {
      // Fetch matches (list live + upcoming)
      const [resList, resPrematch] = await Promise.allSettled([
        _bsdCs2Get('/matches/?status=inprogress', apiKey),
        _bsdCs2Get('/matches/?status=upcoming&limit=50', apiKey)
      ]);

      // Merge results
      const raw = [];
      for (const settled of [resList, resPrematch]) {
        if (settled.status !== 'fulfilled') continue;
        const r = settled.value;
        if (!r || r.status !== 200 || !r.data) continue;
        const items = Array.isArray(r.data)        ? r.data
                    : Array.isArray(r.data.results) ? r.data.results
                    : Array.isArray(r.data.matches) ? r.data.matches
                    : [];
        raw.push(...items);
      }

      // If both status endpoints empty, try generic matches list
      if (raw.length === 0) {
        const res = await _bsdCs2Get('/matches/', apiKey).catch(() => null);
        if (res && res.status === 200 && res.data) {
          const items = Array.isArray(res.data)        ? res.data
                      : Array.isArray(res.data.results) ? res.data.results
                      : [];
          raw.push(...items);
        }
      }

      // Normalize matches
      const matches = raw.map(_normalizeMatch);

      // Attach HLTV rankings (best-effort, non-blocking)
      try {
        const hltv = await _fetchHltvRankings();
        const r = hltv.rankings || {};
        for (const m of matches) {
          m.team1.hltv_rank = r[m.team1.name.toLowerCase()] || null;
          m.team2.hltv_rank = r[m.team2.name.toLowerCase()] || null;
        }
      } catch (_) { /* HLTV fail = silent */ }

      // Sort: live first, then by scheduled time
      matches.sort((a, b) => {
        if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
        if (a.scheduled && b.scheduled) return new Date(a.scheduled) - new Date(b.scheduled);
        return 0;
      });

      _cs2Cache = { ts: Date.now(), data: matches };
      console.log(`[CS2Service] ${matches.length} matches fetched (${matches.filter(m=>m.is_live).length} live)`);
      return matches;

    } catch (e) {
      console.warn('[CS2Service] Fetch error:', e.message);
      return _cs2Cache.data || [];
    }
  }
};
