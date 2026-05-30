'use strict';
/**
 * liquipediaService.js — Liquipedia CS2 tier 3 match scraper
 * API: liquipedia.net/counterstrike/api.php (MediaWiki, requires gzip)
 * Coverage: FRAG TAP Reloaded, Exort Series, Eternity League, Winners Series, etc.
 *
 * Rate limit: Liquipedia requests ~1 req/2s for bots
 * Cache: 5 min for matches, 1h for tournament list
 */

const https = require('https');
const zlib  = require('zlib');

const LIQUIPEDIA_BASE  = 'https://liquipedia.net/counterstrike';
const MATCHES_TTL_MS   = 5 * 60 * 1000;   // 5 min
const TOURN_TTL_MS     = 60 * 60 * 1000;   // 1 h
const REQUEST_TIMEOUT  = 12000;

// Tracked CS2 tier 3 tournaments on 1xBet — update as needed
const TRACKED_PAGES = [
  { name: 'FRAG TAP Reloaded 2026', page: 'FRAG/2026/Philadelphia' },
  { name: 'Exort Series',           page: 'Exort_Series/25' },
  // Add new ones as they appear on 1xBet
];

let _matchesCache = { ts: 0, data: [] };
let _toursCache   = { ts: 0, data: [] };

// ─── Liquipedia API fetch (gzip required) ─────────────────────────────────────
function _liquiGet(params, timeoutMs = REQUEST_TIMEOUT) {
  const qs  = new URLSearchParams({ ...params, format: 'json', utf8: '1' }).toString();
  const url = `${LIQUIPEDIA_BASE}/api.php?${qs}`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        'User-Agent'     : 'PariScore/1.0 (betting analytics; contact@pariscore.fr)',
        'Accept-Encoding': 'gzip, deflate',
        'Accept'         : 'application/json'
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const enc = res.headers['content-encoding'] || '';
        const decompress = enc.includes('gzip')    ? zlib.gunzip
                         : enc.includes('deflate') ? zlib.inflate
                         : null;
        if (decompress) {
          decompress(buf, (err, decoded) => {
            if (err) return reject(err);
            try { resolve({ status: res.statusCode, data: JSON.parse(decoded.toString()) }); }
            catch (e) { reject(e); }
          });
        } else {
          try { resolve({ status: res.statusCode, data: JSON.parse(buf.toString()) }); }
          catch (e) { reject(e); }
        }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('liquipedia timeout')); });
    req.on('error', reject);
    req.end();
  });
}

// ─── Parse match rows from Liquipedia tournament HTML ─────────────────────────
// Liquipedia match tables: wikitable matchlist or bracket tables
function _parseMatchesFromHtml(html, tournamentName) {
  const matches = [];

  // Pattern 1: matchlist rows  <td>Team A</td><td>X:Y</td><td>Team B</td>
  // Liquipedia uses <td class="team-left">...</td> and <td class="team-right">...</td>
  const matchRe = /<tr[^>]*class="[^"]*match[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = matchRe.exec(html)) !== null) {
    const row = m[1];
    // Extract team names from td cells
    const teams = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(row)) !== null) {
      const cell = td[1].replace(/<[^>]+>/g, '').trim();
      if (cell && cell.length > 1 && cell.length < 50 && !/^\d+$/.test(cell)) {
        teams.push(cell);
      }
    }
    if (teams.length >= 2) {
      const scoreM = row.match(/(\d+)\s*[-:]\s*(\d+)/);
      matches.push({
        id         : `lp_${tournamentName.replace(/\s/g,'_')}_${matches.length}`,
        sport      : 'cs2',
        tournament : tournamentName,
        team1      : teams[0],
        team2      : teams[1],
        score      : scoreM ? { team1: Number(scoreM[1]), team2: Number(scoreM[2]) } : null,
        status     : scoreM ? 'finished' : 'upcoming',
        is_live    : false,
        source     : 'liquipedia'
      });
    }
  }

  // Pattern 2: bracket/results table — simpler regex
  if (matches.length === 0) {
    // Generic: look for team name patterns near score patterns
    const broadRe = /<span[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    const tnames = [];
    let bt;
    while ((bt = broadRe.exec(html)) !== null) {
      const name = bt[1].replace(/<[^>]+>/g, '').trim();
      if (name && name.length > 1 && name.length < 50) tnames.push(name);
    }
    // Pair them up
    for (let i = 0; i + 1 < tnames.length; i += 2) {
      matches.push({
        id         : `lp_${tournamentName.replace(/\s/g,'_')}_${i}`,
        sport      : 'cs2',
        tournament : tournamentName,
        team1      : tnames[i],
        team2      : tnames[i + 1],
        score      : null,
        status     : 'unknown',
        is_live    : false,
        source     : 'liquipedia'
      });
    }
  }

  return matches;
}

// ─── Extract team list + results from Liquipedia page ─────────────────────────
function _extractTeamsAndResults(html, tournamentName) {
  const results = [];

  // Look for match result blocks: "TeamA 2 – 0 TeamB" style
  const resultRe = /([A-Za-z0-9\s&'.!-]{2,40})\s+(\d)\s*[–\-]\s*(\d)\s+([A-Za-z0-9\s&'.!-]{2,40})/g;
  let rm;
  while ((rm = resultRe.exec(html)) !== null) {
    const t1 = rm[1].trim();
    const t2 = rm[4].trim();
    if (t1.length < 2 || t2.length < 2) continue;
    if (/class|style|href|div|span/i.test(t1)) continue;
    results.push({
      id         : `lp_${results.length}`,
      sport      : 'cs2',
      tournament : tournamentName,
      team1      : t1,
      team2      : t2,
      maps_score : { team1: Number(rm[2]), team2: Number(rm[3]) },
      status     : 'finished',
      is_live    : false,
      source     : 'liquipedia'
    });
  }

  return results.slice(0, 30);
}

// ─── Fetch one tournament page ─────────────────────────────────────────────────
async function _fetchTournamentPage(page, name) {
  try {
    const res = await _liquiGet({ action: 'parse', page, prop: 'text' });
    if (res.status !== 200 || !res.data?.parse?.text?.['*']) {
      console.warn(`[Liquipedia] ${name}: HTTP ${res.status}`);
      return [];
    }
    const html = res.data.parse.text['*'];
    let matches = _extractTeamsAndResults(html, name);
    if (!matches.length) matches = _parseMatchesFromHtml(html, name);
    console.log(`[Liquipedia] ${name}: ${matches.length} matches`);
    return matches;
  } catch (e) {
    console.warn(`[Liquipedia] ${name}: ${e.message}`);
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {

  async getMatches() {
    if (Date.now() - _matchesCache.ts < MATCHES_TTL_MS) return _matchesCache.data;
    try {
      const all = [];
      for (const t of TRACKED_PAGES) {
        const matches = await _fetchTournamentPage(t.page, t.name);
        all.push(...matches);
        // Rate limit: 2s between requests
        await new Promise(r => setTimeout(r, 2000));
      }
      _matchesCache = { ts: Date.now(), data: all };
      console.log(`[Liquipedia] Total: ${all.length} matches across ${TRACKED_PAGES.length} tournaments`);
      return all;
    } catch (e) {
      console.warn('[Liquipedia]', e.message);
      return _matchesCache.data || [];
    }
  },

  // Add a new tournament to track dynamically
  addTournament(name, page) {
    const exists = TRACKED_PAGES.find(t => t.page === page);
    if (!exists) {
      TRACKED_PAGES.push({ name, page });
      _matchesCache.ts = 0; // invalidate cache
      console.log(`[Liquipedia] Added tournament: ${name} (${page})`);
    }
  },

  getTrackedTournaments() { return TRACKED_PAGES.slice(); }
};
