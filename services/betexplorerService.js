'use strict';
/**
 * betexplorerService.js — Tennis Dropping Odds (BetExplorer, JS-natif, zero-dep)
 *
 * Source: BetExplorer dropping-odds page (/tennis/dropping-odds/)
 * Content: Tennis matches with falling odds — signal for sharp bookie action.
 * No API key needed — public page, no auth.
 *
 * Cache: 15 min TTL (same as oddspapi.js).
 * Lazy env reads (server.js parses .env before requiring this module).
 */

const https = require('https');

// ── Config (lazy env) ─────────────────────────────────────────────────────────
const ENABLED  = () => process.env.BETEXPLORER_ENABLED === 'true';
const HOST     = () => process.env.BETEXPLORER_HOST    || 'www.betexplorer.com';
const BASE_URL = () => 'https://' + HOST();
const PATH     = () => process.env.BETEXPLORER_PATH    || '/tennis/dropping-odds/';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

// ── Cache ───────────────────────────────────────────────────────────────────────
const _cache = { ts: 0, data: null };

// ── Helpers ────────────────────────────────────────────────────────────────────

function enabled() { return ENABLED(); }

function httpsGet(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host, path, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('BetExplorer HTTP ' + res.statusCode));
        resolve(b);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('BetExplorer timeout')); });
    req.end();
  });
}

// ── HTML Parsers ───────────────────────────────────────────────────────────────

/**
 * Parse dropping-odds HTML → array of match objects.
 * Each match: { time, players[], tournament, dropPct, odds[], bestBet, bookmakerCount, matchUrl }
 */
function parseDroppingOddsHTML(html) {
  const matches = [];
  let currentDate = null;

  // Split into lines for easier processing
  const lines = html.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Date separator: <th colspan="6" class="table-main__date">DD.MM.YYYY</th>
    const dateMatch = line.match(/class="table-main__date">(\d{2}\.\d{2}\.\d{4})/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    // Match row: <tr> containing table-main__tt
    if (!line.includes('table-main__tt')) continue;

    // Gather full <tr> block (may span multiple lines)
    let tr = line;
    // If the closing </tr> is not in this line, collect more lines
    if (!tr.includes('</tr>')) {
      for (let j = i + 1; j < lines.length && !lines[j].includes('</tr>'); j++) {
        tr += '\n' + lines[j];
        i = j;
      }
    }

    const match = parseMatchRow(tr, currentDate);
    if (match) matches.push(match);
  }

  return matches;
}

/**
 * Parse a single match <tr> block.
 * Returns null if not a valid match row (e.g., tournament header row).
 */
function parseMatchRow(tr, date) {
  // ── Heure ─────────────────────────────────────────
  // <span class="table-main__time">05:00</span> dans .table-main__tt
  const timeMatch = tr.match(/<span class="table-main__time">(\d{2}:\d{2})/);
  if (!timeMatch) return null;
  const time = timeMatch[1];

  // ── Joueurs ──────────────────────────────────────
  // UN seul <a> avec "Nom1 - Nom2" à l'intérieur de .table-main__tt
  const playerBlockMatch = tr.match(/class="table-main__tt"[^>]*>([\s\S]*?)<\/td>/);
  if (!playerBlockMatch) return null;
  const playerBlock = playerBlockMatch[1];
  const bothPlayersMatch = playerBlock.match(/<a[^>]*>([^<]+?\s*-\s*[^<]+?)<\/a>/);
  if (!bothPlayersMatch) return null;
  const bothNames = bothPlayersMatch[1].trim();
  const players = bothNames.split(/\s*-\s*/).map(p => p.trim());
  if (players.length !== 2) return null;
  const matchUrlMatch = playerBlock.match(/href="(\/tennis\/[^"]+)"/);
  const matchUrl = matchUrlMatch ? matchUrlMatch[1] : null;

  // ── Drop % ────────────────────────────────────────
  // <td class="table-main__drop">...<span>XX%</span>
  const dropMatch = tr.match(/class="table-main__drop"[^>]*>[\s\S]*?(\d+)%/);
  const dropPct = dropMatch ? parseInt(dropMatch[1], 10) : null;
  if (dropPct === null || isNaN(dropPct)) return null;

  // ── Cotes (data-oid / data-odd sur les enfants <a>/<button>) ──
  const odds = [];
  const oddMatches = tr.matchAll(/data-oid="([^"]*)"[^>]*data-odd="([^"]*)"|data-odd="([^"]*)"[^>]*data-oid="([^"]*)"/g);
  for (const m of oddMatches) {
    const oid = m[1] || m[4];
    const odd = m[2] || m[3];
    if (oid && odd) {
      const f = parseFloat(odd);
      if (!isNaN(f) && f > 0) odds.push({ outcomeId: oid, odds: f });
    }
  }

  // ── BestBet ───────────────────────────────────────
  const bestBetOddMatch = tr.match(/class="bestbet-odd"[^>]*data-odd="([^"]*)"/);
  const bestBetOdds = bestBetOddMatch ? parseFloat(bestBetOddMatch[1]) : null;
  const bestBetBookieMatch = tr.match(/class="bestbet-logo"[^>]*title="([^"]*)"/);
  const bestBetBookie = bestBetBookieMatch ? bestBetBookieMatch[1].trim() : null;

  // ── Nombre de bookmakers ──────────────────────────
  // Dans le sous-bloc .list-tags__window--drop → "B's: XX% (N/M)"
  const tagsWindowMatch = tr.match(/class="list-tags__window list-tags__window--drop"[^>]*>([\s\S]*?)<\/div>/);
  let bookmakerCount = null;
  if (tagsWindowMatch) {
    const countMatch = tagsWindowMatch[1].match(/B's:\s*(\d+)%\s*\((\d+)\/(\d+)\)/);
    if (countMatch) {
      bookmakerCount = {
        pct: parseInt(countMatch[1], 10),
        count: parseInt(countMatch[2], 10),
        total: parseInt(countMatch[3], 10),
      };
    }
  }

  // ── Tournoi ──────────────────────────────────────
  const tournamentMatch = tr.match(/class="table-main__tournament"[^>]*>([\s\S]*?)<\/td>/);
  let tournament = '';
  if (tournamentMatch) {
    tournament = tournamentMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    time,
    date,
    players,
    playerUrls: [],
    tournament,
    dropPct,
    odds,
    bestBet: bestBetOdds !== null ? { odds: bestBetOdds, bookmaker: bestBetBookie } : null,
    bookmakerCount,
    matchUrl,
    matchUrlAbs: matchUrl ? BASE_URL() + matchUrl : null,
  };
}

// ── Data Fetch ────────────────────────────────────────────────────────────────

async function _fetchDroppingOdds() {
  if (Date.now() - _cache.ts < CACHE_TTL_MS && _cache.data) {
    return _cache.data;
  }
  const html = await httpsGet(HOST(), PATH());
  const matches = parseDroppingOddsHTML(html);
  _cache = { ts: Date.now(), data: matches };
  return matches;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get all tennis matches with dropping odds.
 * @returns {Promise<Array>} Array of match objects, newest first.
 */
async function getDroppingOdds() {
  if (!enabled()) return [];
  return _fetchDroppingOdds();
}

/**
 * Get dropping odds filtered by minimum drop %.
 * @param {number} minDropPct - Minimum drop percentage (e.g. 20 for 20%)
 * @returns {Promise<Array>}
 */
async function getDroppingOddsFiltered(minDropPct) {
  const all = await getDroppingOdds();
  if (!minDropPct) return all;
  return all.filter(m => m.dropPct >= minDropPct);
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = { enabled, getDroppingOdds, getDroppingOddsFiltered };