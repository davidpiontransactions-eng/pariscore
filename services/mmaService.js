'use strict';
/**
 * mmaService.js — MMA/UFC data pipeline (bd 8gz3)
 *
 * Source: The Odds API — sport key: mma_mixed_martial_arts (existing ODDS_API_KEY)
 * ufcstats.com dropped: Cloudflare JS challenge blocks server-side scraping.
 *
 * Model: devigged consensus probability from market (Shin-Hurley-style normalization)
 * EV: fair_prob vs best available book odds.
 */

const https = require('https');

// ─── Static UFC event names (keyed by YYYY-MM-DD) ────────────────────────────
// Source: ufc.com/events — refresh each month
const UFC_EVENT_NAMES = {
  '2026-06-05': 'UFC Fight Night',
  '2026-06-06': 'UFC Fight Night: Muhammad vs Bonfim',
  '2026-06-14': 'UFC Freedom 250',
  '2026-06-20': 'UFC Fight Night: Kape vs Horiguchi',
  '2026-06-27': 'UFC Fight Night: Fiziev vs Torres',
  '2026-07-11': 'UFC 329: McGregor vs Holloway 2',
  '2026-07-18': 'UFC Fight Night',
  '2026-07-25': 'UFC Fight Night: Ankalaev vs Rountree Jr.',
  '2026-08-01': 'UFC Fight Night: Medic vs Rodriguez',
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CACHE_TTL_ODDS = 60 * 60 * 1000;  // 1h
const CACHE_TTL_FULL = 20 * 60 * 1000;  // 20 min

// ─── Caches ───────────────────────────────────────────────────────────────────
const _oddsCache = { data: null, ts: 0 };
const _fullCache = { data: null, ts: 0 };
let   _isFetching = false;

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function _get(urlStr, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const u    = new URL(urlStr);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore/2.0' },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(chunks.join('')) }); }
        catch (_) { resolve({ status: res.statusCode, headers: res.headers, data: chunks.join('') }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ─── Devig ────────────────────────────────────────────────────────────────────
// For each bookmaker: fair_a = (1/odds_a) / (1/odds_a + 1/odds_b)
// Consensus = mean across books that have both sides priced.
function _devig(bookmakers, nameA, nameB) {
  const nA = nameA.toLowerCase().trim();
  const nB = nameB.toLowerCase().trim();
  const fairAs = [];
  const bestOddsA = [];
  const bestOddsB = [];

  for (const bk of bookmakers) {
    let oA = null, oB = null;
    for (const mkt of (bk.markets || [])) {
      if (mkt.key !== 'h2h') continue;
      for (const out of (mkt.outcomes || [])) {
        const n = out.name.toLowerCase().trim();
        if (n === nA) oA = out.price;
        else if (n === nB) oB = out.price;
      }
    }
    if (oA && oB && oA > 1 && oB > 1) {
      const pA = 1 / oA;
      const pB = 1 / oB;
      fairAs.push(pA / (pA + pB));
      bestOddsA.push(oA);
      bestOddsB.push(oB);
    }
  }

  if (!fairAs.length) return null;

  const fairA = fairAs.reduce((a, b) => a + b, 0) / fairAs.length;
  const fairB = 1 - fairA;
  const bestA = Math.max(...bestOddsA);
  const bestB = Math.max(...bestOddsB);

  const evA = fairA * (bestA - 1) - fairB;
  const evB = fairB * (bestB - 1) - fairA;

  return {
    fair_a:   Math.round(fairA * 1000) / 1000,
    fair_b:   Math.round(fairB * 1000) / 1000,
    best_odds_a: Math.round(bestA * 100) / 100,
    best_odds_b: Math.round(bestB * 100) / 100,
    ev_a_pct: Math.round(evA * 1000) / 10,
    ev_b_pct: Math.round(evB * 1000) / 10,
    bet_a:    evA > 0.05,
    bet_b:    evB > 0.05,
    books:    fairAs.length,
  };
}

// ─── Fetch Odds API ───────────────────────────────────────────────────────────
async function _fetchOdds(apiKey) {
  if (!apiKey) return [];
  if (_oddsCache.data && (Date.now() - _oddsCache.ts) < CACHE_TTL_ODDS) return _oddsCache.data;

  try {
    const params = new URLSearchParams({
      apiKey, regions: 'eu', markets: 'h2h', oddsFormat: 'decimal', dateFormat: 'iso',
    });
    const res = await _get(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?${params}`
    );
    if (!res || res.status !== 200 || !Array.isArray(res.data)) return _oddsCache.data || [];

    // Track quota
    if (res.headers && res.headers['x-requests-remaining']) {
      const rem = parseInt(res.headers['x-requests-remaining'], 10);
      if (!isNaN(rem) && rem < 50) {
        console.warn(`[MMA] Odds API quota low: ${rem} remaining`);
      }
    }

    _oddsCache.data = res.data;
    _oddsCache.ts   = Date.now();
    return res.data;
  } catch (e) {
    console.warn('[MMA] Odds API fetch:', e.message);
    return _oddsCache.data || [];
  }
}

// ─── Group fights by date ─────────────────────────────────────────────────────
function _groupByDate(fights) {
  const byDate = {};
  for (const f of fights) {
    const date = (f.commence_time || '').slice(0, 10);
    if (!date) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(f);
  }
  // Sort dates ascending
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, fights]) => ({
      event_date: date,
      event_name: UFC_EVENT_NAMES[date] || `UFC Event — ${date}`,
      fights,
    }));
}

// ─── Public: getMMAFights ─────────────────────────────────────────────────────
async function getMMAFights(apiKey) {
  if (_fullCache.data && (Date.now() - _fullCache.ts) < CACHE_TTL_FULL) {
    return _fullCache.data;
  }
  if (_isFetching) return _fullCache.data || [];
  _isFetching = true;

  try {
    const rawFights = await _fetchOdds(apiKey);
    const enriched  = [];

    for (const ev of rawFights) {
      const nameA = ev.home_team || '';
      const nameB = ev.away_team || '';
      if (!nameA || !nameB) continue;

      const books = ev.bookmakers || [];
      const d     = _devig(books, nameA, nameB);

      enriched.push({
        fighter_a:      nameA,
        fighter_b:      nameB,
        commence_time:  ev.commence_time || null,
        // Probabilities from devig
        prob_a:         d ? d.fair_a : null,
        prob_b:         d ? d.fair_b : null,
        // Best odds
        best_odds_a:    d ? d.best_odds_a : null,
        best_odds_b:    d ? d.best_odds_b : null,
        // AI odds = same as fair (no stats model yet)
        ai_odds_a:      d ? Math.round(1 / d.fair_a * 100) / 100 : null,
        ai_odds_b:      d ? Math.round(1 / d.fair_b * 100) / 100 : null,
        // Vegas = best available
        vegas_odds_a:   d ? d.best_odds_a : null,
        vegas_odds_b:   d ? d.best_odds_b : null,
        // EV
        ev_a_pct:       d ? d.ev_a_pct : null,
        ev_b_pct:       d ? d.ev_b_pct : null,
        bet_a:          d ? d.bet_a : false,
        bet_b:          d ? d.bet_b : false,
        // Meta
        vegas_books:    d ? d.books : 0,
        weight_class:   '',
        is_title:       false,
        stats_a:        null,
        stats_b:        null,
      });
    }

    const events = _groupByDate(enriched);
    _fullCache.data = events;
    _fullCache.ts   = Date.now();
    return events;
  } catch (e) {
    console.error('[MMA] getMMAFights:', e.message);
    return _fullCache.data || [];
  } finally {
    _isFetching = false;
  }
}

// ─── Kept for future use when fighter stats source found ─────────────────────
function computeMMAWinProb() { return 0.5; }

function getCacheStatus() {
  return {
    full_age_s:    _fullCache.ts ? Math.round((Date.now() - _fullCache.ts) / 1000) : null,
    odds_cached:   !!_oddsCache.data,
    fights_cached: _fullCache.data ? _fullCache.data.reduce((n, e) => n + e.fights.length, 0) : 0,
    source:        'the-odds-api/mma_mixed_martial_arts',
  };
}

module.exports = { getMMAFights, computeMMAWinProb, getCacheStatus };
