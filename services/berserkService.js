'use strict';
/**
 * berserkService.js — Berserk League CS2 1v1 duel scraper
 * Source: berserkcs2.org (static HTML, GitHub Pages, updated ~hourly)
 *         Data origin: drafted.gg/berserk-league
 *
 * Format: BO1, MR12, 1v1 duels (not 5v5 team matches)
 * Update: parse berserkcs2.org HTML — no Cloudflare, accessible
 */

'use strict';
const https = require('https');
const http  = require('http');

const BERSERK_BASE     = 'https://berserkcs2.org';
const MATCH_TTL_MS     = 2 * 60 * 1000;   // 2 min — live 1v1 matches change fast
const PLAYERS_TTL_MS   = 30 * 60 * 1000;  // 30 min — player stats stable
const REQUEST_TIMEOUT  = 8000;

let _matchCache   = { ts: 0, data: { recent: [], upcoming: [] } };
let _playersCache = { ts: 0, data: [] };

// ─── HTML fetcher (no auth, no Cloudflare) ────────────────────────────────────
function _fetchHtml(url, timeoutMs = REQUEST_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept'    : 'text/html,*/*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return _fetchHtml(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c  => { body += c; });
      res.on('end',  () => resolve({ status: res.statusCode, html: body }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

// ─── Parse recent + upcoming matches from homepage HTML ───────────────────────
function _parseMatches(html) {
  const recent   = [];
  const upcoming = [];

  // Extract all match blocks — each has a Match # ID
  const matchBlockRe = /Match #(\d+)([\s\S]*?)(?=Match #\d+|$)/g;
  let m;

  // Round scores pattern: 7-13, 13-7 etc.
  const scoreRe = /class="text-lg font-semibold">(\d+)-(\d+)<\/div>/;
  // Date pattern: May 30, 2026, 07:12 PM EST
  const dateRe  = /(\w+ \d+, \d{4}, \d+:\d+ (?:AM|PM) \w+)/;
  // Player names in "vs" blocks
  const playerRe = /class="font-semibold">([A-Za-z0-9_\-]+)<\/span>[\s\S]*?vs[\s\S]*?class="font-semibold">([A-Za-z0-9_\-]+)<\/span>/;

  // Split HTML at "Recent Matches" vs "Upcoming Matches" sections
  const recentIdx   = html.indexOf('Recent Matches');
  const upcomingIdx = html.indexOf('Upcoming Matches');

  function parseSection(sectionHtml, isLive) {
    const results = [];
    const re = /Match #(\d+)([\s\S]{0,1200}?)(?=Match #\d+|Upcoming Matches|Complete Match|$)/g;
    let mx;
    while ((mx = re.exec(sectionHtml)) !== null) {
      const id      = mx[1];
      const block   = mx[2];
      const players = block.match(playerRe);
      const score   = block.match(scoreRe);
      const dateStr = block.match(dateRe);

      if (!players) continue;

      const p1s    = score ? Number(score[1]) : null;
      const p2s    = score ? Number(score[2]) : null;
      const winner = (p1s != null && p2s != null) ? (p1s > p2s ? players[1] : players[2]) : null;

      results.push({
        id         : `berserk_${id}`,
        match_num  : Number(id),
        sport      : 'cs2_1v1',
        format     : 'BO1 MR12',
        tournament : 'Berserk League',
        is_live    : false,
        status     : score ? 'finished' : 'upcoming',
        player1    : players[1],
        player2    : players[2],
        score      : score ? { p1: p1s, p2: p2s } : null,
        winner,
        date       : dateStr ? dateStr[1] : null
      });
    }
    return results;
  }

  // Recent section
  const recentSection = recentIdx >= 0
    ? html.slice(recentIdx, upcomingIdx > recentIdx ? upcomingIdx : undefined)
    : html;
  recent.push(...parseSection(recentSection, false));

  // Upcoming section (no scores, just player names)
  if (upcomingIdx >= 0) {
    const upcomingSection = html.slice(upcomingIdx);
    const upRe = /Match #(\d+)[\s\S]{0,500}?<span class="font-semibold">([A-Za-z0-9_\-]+)<\/span>[\s\S]*?vs[\s\S]*?<span class="font-semibold">([A-Za-z0-9_\-]+)<\/span>/g;
    let um;
    while ((um = upRe.exec(upcomingSection)) !== null) {
      upcoming.push({
        id         : `berserk_${um[1]}`,
        match_num  : Number(um[1]),
        sport      : 'cs2_1v1',
        format     : 'BO1 MR12',
        tournament : 'Berserk League',
        is_live    : false,
        status     : 'upcoming',
        player1    : um[2],
        player2    : um[3],
        score      : null,
        winner     : null,
        date       : null
      });
    }
  }

  return { recent: recent.slice(0, 20), upcoming: upcoming.slice(0, 10) };
}

// ─── Parse player stats from /players page ────────────────────────────────────
function _parsePlayers(html) {
  const players = [];
  // Pattern: player name + stats grid with winrate, games, streak
  const rowRe = /<[^>]+>([A-Za-z0-9_\-]{2,20})<\/[^>]+>[\s\S]{0,2000}?(\d+)%[\s\S]{0,200}?(\d+) games/g;
  // Simpler: look for player name links /players/[name]
  const playerRe = /\/players\/([A-Za-z0-9_\-]{2,20})/g;
  const names = new Set();
  let m;
  while ((m = playerRe.exec(html)) !== null) {
    names.add(m[1]);
  }

  // Extract winrate and game count per player via context around name
  for (const name of names) {
    const idx = html.indexOf(`/players/${name}`);
    if (idx < 0) continue;
    const ctx = html.slice(idx, idx + 1000);
    const winRateM = ctx.match(/(\d+(?:\.\d+)?)\s*%/);
    const gamesM   = ctx.match(/(\d+)\s*(?:games|total)/i);
    const streakM  = ctx.match(/(?:streak|Streak)[^0-9\-]*(-?\d+)/i);
    players.push({
      name,
      winrate: winRateM ? parseFloat(winRateM[1]) : null,
      games  : gamesM   ? parseInt(gamesM[1], 10) : null,
      streak : streakM  ? parseInt(streakM[1], 10) : null
    });
  }

  return players.slice(0, 30);
}

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {

  async getMatches() {
    if (Date.now() - _matchCache.ts < MATCH_TTL_MS) return _matchCache.data;
    try {
      const res = await _fetchHtml(`${BERSERK_BASE}/`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const data = _parseMatches(res.html);
      _matchCache = { ts: Date.now(), data };
      const totalFound = data.recent.length + data.upcoming.length;
      console.log(`[Berserk] ${data.recent.length} recent + ${data.upcoming.length} upcoming matches`);
      return data;
    } catch (e) {
      console.warn('[Berserk]', e.message);
      return _matchCache.data;
    }
  },

  async getPlayers() {
    if (Date.now() - _playersCache.ts < PLAYERS_TTL_MS) return _playersCache.data;
    try {
      const res = await _fetchHtml(`${BERSERK_BASE}/players`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const data = _parsePlayers(res.html);
      _playersCache = { ts: Date.now(), data };
      console.log(`[Berserk] ${data.length} players loaded`);
      return data;
    } catch (e) {
      console.warn('[Berserk/players]', e.message);
      return _playersCache.data;
    }
  }
};
