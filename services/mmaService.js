'use strict';
/**
 * mmaService.js — MMA/UFC data pipeline (bd 8gz3)
 *
 * Data sources:
 *   ufcstats.com  — upcoming events + fighter stats (throttled 1 req/2s)
 *   The Odds API  — sport key: mma_mixed_martial_arts (existing ODDS_API_KEY)
 *
 * Model: logistic regression on fighter differential features
 * Target: 68-72% accuracy (aligned w/ literature, mma-ai.net 71%)
 *
 * Recalibrate coefficients via: node tools/train-mma-model.js (jansen88 dataset)
 */

const https = require('https');
const http  = require('http');

// ─── Constants ────────────────────────────────────────────────────────────────
const UFCSTATS_BASE      = 'http://ufcstats.com';
const CACHE_TTL_EVENTS   = 30 * 60 * 1000;   // 30 min
const CACHE_TTL_FIGHTER  = 6 * 60 * 60 * 1000; // 6h
const CACHE_TTL_ODDS     = 60 * 60 * 1000;   // 1h
const CACHE_TTL_FULL     = 20 * 60 * 1000;   // 20 min full response
const THROTTLE_MS        = 2200;              // ufcstats rate limit
const MAX_EVENTS         = 3;                 // upcoming events to enrich

// ─── Model coefficients ───────────────────────────────────────────────────────
// Logistic regression on fighter differentials (A - B).
// Positive = favours fighter A. Calibrate with jansen88 dataset.
const MMA_COEFS = {
  intercept:         0.02,
  slpm:              0.18,   // sig strikes landed/min
  str_acc:           0.90,   // strike accuracy (0-1)
  str_def:           0.80,   // strike defense (0-1)
  td_avg:            0.08,   // takedowns avg per 15min
  td_acc:            0.50,   // takedown accuracy (0-1)
  td_def:            0.40,   // takedown defense (0-1)
  sub_avg:           0.12,   // submission avg per 15min
  reach_cm:          0.005,  // reach differential in cm
  age:              -0.018,  // age (older = slight disadvantage)
  finish_proxy:      0.22,   // (slpm/5) proxy for finishing ability
};

// ─── In-memory caches ─────────────────────────────────────────────────────────
const _eventsCache  = { data: null, ts: 0 };
const _fighterCache = new Map();             // name.lower → { data, ts }
const _oddsCache    = { data: null, ts: 0 };
const _fullCache    = { data: null, ts: 0 };
let   _lastFetchTs  = 0;
let   _isFetching   = false;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function _get(urlStr, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const u    = new URL(urlStr);
    const mod  = u.protocol === 'https:' ? https : http;
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PariScore/1.0)',
        'Accept': 'text/html,application/json,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    const req = mod.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: chunks.join('') }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function _throttledGet(url) {
  const gap = THROTTLE_MS - (Date.now() - _lastFetchTs);
  if (gap > 0) await new Promise(r => setTimeout(r, gap));
  _lastFetchTs = Date.now();
  return _get(url);
}

// ─── HTML parse helpers ───────────────────────────────────────────────────────
function _extractLinks(html, prefix) {
  const re    = new RegExp(`href="(${prefix.replace(/\//g, '/')}[^"]+)"`, 'gi');
  const links = new Set();
  let m;
  while ((m = re.exec(html)) !== null) links.add(m[1]);
  return [...links];
}

function _pf(s) {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 1000) / 1000;
}

function _pct(s) {
  // "75%" → 0.75, "0.75" → 0.75
  if (!s) return 0;
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return s.includes('%') ? n / 100 : n;
}

// ─── Fighter page parser ──────────────────────────────────────────────────────
function _parseFighterPage(html, name) {
  // ufcstats.com fighter page: stats in <li> blocks "Label: value"
  const statMap = {};
  const re = /<li[^>]*b-list__box-list-item[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text  = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const colon = text.indexOf(':');
    if (colon > 0) {
      const k = text.slice(0, colon).trim().toLowerCase();
      const v = text.slice(colon + 1).trim();
      statMap[k] = v;
    }
  }

  const get = (...keys) => keys.reduce((acc, k) => acc || statMap[k] || '', '');

  // Height → cm
  function heightCm(s) {
    const h = s.match(/(\d+)'(\d+)"/);
    if (!h) return 175;
    return Math.round(parseInt(h[1]) * 30.48 + parseInt(h[2]) * 2.54);
  }

  // Reach → cm (given in inches on ufcstats)
  function reachCm(s) {
    const n = parseFloat(s);
    return isNaN(n) ? 175 : Math.round(n * 2.54);
  }

  // Age from DOB
  function calcAge(s) {
    if (!s || s === '--') return 28;
    const d = new Date(s);
    if (isNaN(d.getTime())) return 28;
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  }

  // Win record
  const recMatch = html.match(/(\d+)-(\d+)-(\d+)/);
  const wins   = recMatch ? parseInt(recMatch[1]) : 0;
  const losses = recMatch ? parseInt(recMatch[2]) : 0;
  const draws  = recMatch ? parseInt(recMatch[3]) : 0;

  return {
    name,
    slpm:     _pf(get('slpm', 'sig. str. landed')),
    str_acc:  _pct(get('str. acc.', 'str. acc', 'striking accuracy')),
    sapm:     _pf(get('sapm', 'sig. str. absorbed')),
    str_def:  _pct(get('str. def', 'str. def.', 'striking defence')),
    td_avg:   _pf(get('td avg.', 'td avg', 'takedown avg')),
    td_acc:   _pct(get('td acc.', 'td acc', 'takedown accuracy')),
    td_def:   _pct(get('td def.', 'td def', 'takedown defence')),
    sub_avg:  _pf(get('sub. avg.', 'sub. avg', 'submission avg')),
    reach_cm: reachCm(get('reach')),
    height_cm: heightCm(get('height')),
    age:      calcAge(get('dob', 'date of birth')),
    wins,
    losses,
    draws,
    total_fights: wins + losses + draws,
  };
}

function _emptyFighter(name) {
  return {
    name, slpm: 0, str_acc: 0, sapm: 0, str_def: 0,
    td_avg: 0, td_acc: 0, td_def: 0, sub_avg: 0,
    reach_cm: 175, height_cm: 175, age: 28,
    wins: 0, losses: 0, draws: 0, total_fights: 0,
  };
}

async function _fetchFighterStats(name, urlHint) {
  const key = name.toLowerCase();
  const hit  = _fighterCache.get(key);
  if (hit && (Date.now() - hit.ts) < CACHE_TTL_FIGHTER) return hit.data;

  try {
    let fighterUrl = urlHint;
    if (!fighterUrl) {
      const sr = await _throttledGet(
        `${UFCSTATS_BASE}/statistics/fighters?action=SherdogSearch&query=${encodeURIComponent(name)}`
      );
      if (!sr || sr.status !== 200) return _emptyFighter(name);
      const links = _extractLinks(sr.body, 'http://ufcstats.com/fighter-details/');
      if (!links.length) return _emptyFighter(name);
      fighterUrl = links[0];
    }

    const res = await _throttledGet(fighterUrl);
    if (!res || res.status !== 200) return _emptyFighter(name);

    const data = _parseFighterPage(res.body, name);
    _fighterCache.set(key, { data, ts: Date.now() });
    return data;
  } catch (e) {
    console.warn(`[MMA] fighter fetch: ${name} — ${e.message}`);
    return _emptyFighter(name);
  }
}

// ─── Predictive model ─────────────────────────────────────────────────────────
function computeMMAWinProb(fa, fb) {
  const finA = fa.slpm > 0 ? Math.min(0.9, fa.slpm / 5) : 0;
  const finB = fb.slpm > 0 ? Math.min(0.9, fb.slpm / 5) : 0;

  const logit = MMA_COEFS.intercept
    + MMA_COEFS.slpm         * (fa.slpm    - fb.slpm)
    + MMA_COEFS.str_acc      * (fa.str_acc - fb.str_acc)
    + MMA_COEFS.str_def      * (fa.str_def - fb.str_def)
    + MMA_COEFS.td_avg       * (fa.td_avg  - fb.td_avg)
    + MMA_COEFS.td_acc       * (fa.td_acc  - fb.td_acc)
    + MMA_COEFS.td_def       * (fa.td_def  - fb.td_def)
    + MMA_COEFS.sub_avg      * (fa.sub_avg - fb.sub_avg)
    + MMA_COEFS.reach_cm     * (fa.reach_cm - fb.reach_cm)
    + MMA_COEFS.age          * (fa.age     - fb.age)
    + MMA_COEFS.finish_proxy * (finA       - finB);

  const p = 1 / (1 + Math.exp(-logit));
  return Math.round(p * 1000) / 1000;
}

function _decimalOdds(p) {
  if (p <= 0.02 || p >= 0.98) return null;
  return Math.round((1 / p) * 100) / 100;
}

function _ev(prob, odds) {
  if (!odds || odds <= 1) return null;
  return Math.round((prob * (odds - 1) - (1 - prob)) * 1000) / 10;
}

// ─── Upcoming events ──────────────────────────────────────────────────────────
async function _fetchUpcomingEvents() {
  if (_eventsCache.data && (Date.now() - _eventsCache.ts) < CACHE_TTL_EVENTS) {
    return _eventsCache.data;
  }

  try {
    const res = await _throttledGet(`${UFCSTATS_BASE}/statistics/events/upcoming`);
    if (!res || res.status !== 200) return [];

    const links = _extractLinks(res.body, 'http://ufcstats.com/event-details/');
    const events = [];
    const rowRe = /<tr[^>]*class="b-statistics__table-row"[^>]*>([\s\S]*?)<\/tr>/gi;
    let row;
    let i = 0;

    while ((row = rowRe.exec(res.body)) !== null && i < links.length) {
      const h = row[1];
      const nameM = h.match(/href="[^"]*event-details[^"]*">([^<]+)</i);
      const dateM = h.match(/([A-Z][a-z]+ \d+, \d{4})/);
      if (nameM) {
        events.push({
          name:     nameM[1].trim(),
          date:     dateM ? dateM[1] : '',
          url:      links[i],
          event_id: links[i].split('/').pop(),
        });
        i++;
      }
    }

    _eventsCache.data = events;
    _eventsCache.ts   = Date.now();
    return events;
  } catch (e) {
    console.warn('[MMA] events fetch:', e.message);
    return _eventsCache.data || [];
  }
}

async function _fetchEventFights(eventUrl) {
  try {
    const res = await _throttledGet(eventUrl);
    if (!res || res.status !== 200) return [];

    const fights = [];
    // ufcstats: fight rows use js-fight-details-click class or table rows in fight details table
    const rowRe = /<tr[^>]*class="b-fight-details__table-row[^"]*js-fight-details-click[^"]*"[^>]*data-link="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;

    while ((m = rowRe.exec(res.body)) !== null) {
      const fightUrl = m[1];
      const h        = m[2];

      // Fighter names via fighter-details links
      const linkRe = /href="(http:\/\/ufcstats\.com\/fighter-details\/[^"]+)"[^>]*>\s*([^<]+)\s*<\/a>/gi;
      const fighters = [];
      let lm;
      while ((lm = linkRe.exec(h)) !== null && fighters.length < 2) {
        fighters.push({ url: lm[1], name: lm[2].trim() });
      }

      // Weight class from belt/title img or text
      const wcM = h.match(/class="b-fight-details__fight-title"[^>]*>([^<]+)</i);
      const isTitleM = /<img[^>]*img-belt[^>]*>/i.test(h);

      if (fighters.length >= 2) {
        fights.push({
          fighter_a:     fighters[0].name,
          fighter_b:     fighters[1].name,
          fighter_a_url: fighters[0].url,
          fighter_b_url: fighters[1].url,
          weight_class:  wcM ? wcM[1].trim() : '',
          is_title:      isTitleM,
        });
      }
    }

    return fights;
  } catch (e) {
    console.warn('[MMA] event fights:', e.message);
    return [];
  }
}

// ─── Odds API ─────────────────────────────────────────────────────────────────
async function _fetchMMAOdds(oddsApiKey) {
  if (!oddsApiKey) return {};
  if (_oddsCache.data && (Date.now() - _oddsCache.ts) < CACHE_TTL_ODDS) return _oddsCache.data;

  try {
    const params = new URLSearchParams({
      apiKey:      oddsApiKey,
      regions:     'eu',
      markets:     'h2h',
      oddsFormat:  'decimal',
      dateFormat:  'iso',
    });
    const res = await _get(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?${params}`
    );
    if (!res || res.status !== 200) return {};

    let data;
    try { data = JSON.parse(res.body); } catch (_) { return {}; }
    if (!Array.isArray(data)) return {};

    const index = {};
    for (const ev of data) {
      if (!ev.home_team || !ev.away_team) continue;
      const fa = ev.home_team.toLowerCase().trim();
      const fb = ev.away_team.toLowerCase().trim();
      const oddsA = [], oddsB = [];

      for (const bk of (ev.bookmakers || [])) {
        for (const mkt of (bk.markets || [])) {
          if (mkt.key !== 'h2h') continue;
          for (const out of (mkt.outcomes || [])) {
            const n = out.name.toLowerCase().trim();
            if (n === fa)      oddsA.push(out.price);
            else if (n === fb) oddsB.push(out.price);
          }
        }
      }

      const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100 : null;
      index[`${fa}|${fb}`] = {
        commence_time:     ev.commence_time || null,
        odds_a:            avg(oddsA),
        odds_b:            avg(oddsB),
        bookmakers_count:  (ev.bookmakers || []).length,
      };
    }

    _oddsCache.data = index;
    _oddsCache.ts   = Date.now();
    return index;
  } catch (e) {
    console.warn('[MMA] odds API:', e.message);
    return _oddsCache.data || {};
  }
}

function _findOdds(idx, nameA, nameB) {
  const a = nameA.toLowerCase().trim();
  const b = nameB.toLowerCase().trim();
  return idx[`${a}|${b}`] || idx[`${b}|${a}`] || null;
}

// ─── Public: getMMAFights ─────────────────────────────────────────────────────
async function getMMAFights(oddsApiKey) {
  if (_fullCache.data && (Date.now() - _fullCache.ts) < CACHE_TTL_FULL) {
    return _fullCache.data;
  }
  if (_isFetching) return _fullCache.data || [];
  _isFetching = true;

  try {
    const [events, oddsIdx] = await Promise.all([
      _fetchUpcomingEvents(),
      _fetchMMAOdds(oddsApiKey),
    ]);

    const result = [];
    for (const event of events.slice(0, MAX_EVENTS)) {
      const fights = await _fetchEventFights(event.url);
      const enriched = [];

      for (const fight of fights) {
        const [fa, fb] = await Promise.all([
          _fetchFighterStats(fight.fighter_a, fight.fighter_a_url),
          _fetchFighterStats(fight.fighter_b, fight.fighter_b_url),
        ]);

        const probA = computeMMAWinProb(fa, fb);
        const probB = Math.round((1 - probA) * 1000) / 1000;

        const vegas  = _findOdds(oddsIdx, fight.fighter_a, fight.fighter_b);
        const vOddsA = vegas ? vegas.odds_a : null;
        const vOddsB = vegas ? vegas.odds_b : null;

        const evA = _ev(probA, vOddsA);
        const evB = _ev(probB, vOddsB);

        enriched.push({
          fighter_a:      fight.fighter_a,
          fighter_b:      fight.fighter_b,
          weight_class:   fight.weight_class,
          is_title:       fight.is_title,
          prob_a:         probA,
          prob_b:         probB,
          ai_odds_a:      _decimalOdds(probA),
          ai_odds_b:      _decimalOdds(probB),
          vegas_odds_a:   vOddsA,
          vegas_odds_b:   vOddsB,
          vegas_books:    vegas ? vegas.bookmakers_count : 0,
          ev_a_pct:       evA,
          ev_b_pct:       evB,
          bet_a:          evA !== null && evA > 5,
          bet_b:          evB !== null && evB > 5,
          commence_time:  vegas ? vegas.commence_time : null,
          stats_a:        fa,
          stats_b:        fb,
        });
      }

      result.push({
        event_name:     event.name,
        event_date:     event.date,
        event_id:       event.event_id,
        fights:         enriched,
        fights_count:   enriched.length,
      });
    }

    _fullCache.data = result;
    _fullCache.ts   = Date.now();
    return result;
  } catch (e) {
    console.error('[MMA] getMMAFights:', e.message);
    return _fullCache.data || [];
  } finally {
    _isFetching = false;
  }
}

function getCacheStatus() {
  return {
    full_age_s:      _fullCache.ts ? Math.round((Date.now() - _fullCache.ts) / 1000) : null,
    events_cached:   !!_eventsCache.data,
    fighters_cached: _fighterCache.size,
    odds_cached:     !!_oddsCache.data,
  };
}

module.exports = { getMMAFights, computeMMAWinProb, getCacheStatus };
