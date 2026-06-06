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

// Curated fighter photo "memory" map (slug -> {url} | {sofascore_id}).
// Defensive require: a malformed/missing file must never crash the server.
let FIGHTER_PHOTOS = {};
try { FIGHTER_PHOTOS = require('./mma_fighter_photos.json') || {}; } catch (_) { FIGHTER_PHOTOS = {}; }

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
const CACHE_TTL_ODDS     = 60 * 60 * 1000;  // 1h
const CACHE_TTL_FULL     = 20 * 60 * 1000;  // 20 min
const CACHE_TTL_DRATINGS = 30 * 60 * 1000;  // 30 min

// ─── Caches ───────────────────────────────────────────────────────────────────
const _oddsCache    = { data: null, ts: 0 };
const _dratingsCache = { data: null, ts: 0 }; // Map: "name_a|name_b" → {prob_a, prob_b}
const _fullCache    = { data: null, ts: 0 };
let   _isFetching   = false;

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function _get(urlStr, extraHeaders, timeoutMs = 12000) {
  if (typeof extraHeaders === 'number') { timeoutMs = extraHeaders; extraHeaders = null; }
  return new Promise((resolve, reject) => {
    const u    = new URL(urlStr);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: extraHeaders || { 'Accept': 'application/json', 'User-Agent': 'PariScore/2.0' },
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

// ─── DRatings scraper ─────────────────────────────────────────────────────────
// Source: dratings.com/predictor/ufc-mma-predictions/
// Rows: "[date] [time] [FA] [FB] [%A] [%B] [ML...] ..."
// Returns Map: "fa_lower|fb_lower" → { prob_a, prob_b }
async function _fetchDRatings() {
  if (_dratingsCache.data && (Date.now() - _dratingsCache.ts) < CACHE_TTL_DRATINGS) {
    return _dratingsCache.data;
  }
  const index = {};
  try {
    const res = await _get(
      'https://www.dratings.com/predictor/ufc-mma-predictions/',
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html' },
      12000
    );
    if (!res || res.status !== 200 || typeof res.data !== 'string') return index;

    const html = res.data;
    // Each <tr> row: strip tags → "MM/DD/YYYY HH:MM [AP]M FighterA FighterB X.X% Y.Y% ..."
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = rowRe.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Must contain two percentages
      const pcts = text.match(/(\d{1,3}\.\d)\%/g);
      if (!pcts || pcts.length < 2) continue;
      const probA = parseFloat(pcts[0]) / 100;
      const probB = parseFloat(pcts[1]) / 100;
      // Fighter names: text between datetime and first % — split on date pattern
      const dateRe = /^\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M\s+/;
      const stripped = text.replace(dateRe, '');
      const pctIdx   = stripped.indexOf(pcts[0]);
      if (pctIdx < 2) continue;
      const namePart  = stripped.slice(0, pctIdx).trim();
      // Split name part into two fighter names (heuristic: longest common split)
      // DRatings lists "FighterA FighterB" — split at midpoint of word boundary
      const words = namePart.split(' ').filter(Boolean);
      if (words.length < 2) continue;
      const mid = Math.ceil(words.length / 2);
      const fa  = words.slice(0, mid).join(' ').toLowerCase();
      const fb  = words.slice(mid).join(' ').toLowerCase();
      if (fa && fb) {
        index[`${fa}|${fb}`] = { prob_a: Math.round(probA * 1000) / 1000, prob_b: Math.round(probB * 1000) / 1000 };
        index[`${fb}|${fa}`] = { prob_a: Math.round(probB * 1000) / 1000, prob_b: Math.round(probA * 1000) / 1000 };
      }
    }
    console.log(`[MMA] DRatings: ${Object.keys(index).length / 2} fights indexed`);
  } catch (e) {
    console.warn('[MMA] DRatings fetch:', e.message);
  }
  _dratingsCache.data = index;
  _dratingsCache.ts   = Date.now();
  return index;
}

function _matchDRatings(idx, nameA, nameB) {
  const a = nameA.toLowerCase().trim();
  const b = nameB.toLowerCase().trim();
  // Exact match first
  if (idx[`${a}|${b}`]) return idx[`${a}|${b}`];
  // Fuzzy: try partial last-name match
  const lastA = a.split(' ').pop();
  const lastB = b.split(' ').pop();
  for (const key of Object.keys(idx)) {
    const [ka, kb] = key.split('|');
    if (ka.includes(lastA) && kb.includes(lastB)) return idx[key];
  }
  return null;
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
    const [rawFights, drIdx] = await Promise.all([
      _fetchOdds(apiKey),
      _fetchDRatings(),
    ]);
    const enriched = [];

    for (const ev of rawFights) {
      const nameA = ev.home_team || '';
      const nameB = ev.away_team || '';
      if (!nameA || !nameB) continue;

      const books = ev.bookmakers || [];
      const d     = _devig(books, nameA, nameB);
      const dr    = _matchDRatings(drIdx, nameA, nameB);

      enriched.push({
        fighter_a:      nameA,
        fighter_b:      nameB,
        commence_time:  ev.commence_time || null,
        // Devig consensus probabilities
        prob_a:         d ? d.fair_a : null,
        prob_b:         d ? d.fair_b : null,
        // DRatings model probabilities (independent signal)
        dr_prob_a:      dr ? dr.prob_a : null,
        dr_prob_b:      dr ? dr.prob_b : null,
        // Best odds
        best_odds_a:    d ? d.best_odds_a : null,
        best_odds_b:    d ? d.best_odds_b : null,
        ai_odds_a:      d ? Math.round(1 / d.fair_a * 100) / 100 : null,
        ai_odds_b:      d ? Math.round(1 / d.fair_b * 100) / 100 : null,
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

// ─── Fighter photo resolution ────────────────────────────────────────────────
// Multi-source cascade so regional fighters (Oktagon/KSW/PFL...) get a photo,
// not just notable UFC names on Wikipedia. Order = best quality first:
//   1. curated memory map (mma_fighter_photos.json)
//   2. Sofascore headshot via bzzoiro proxy (when a sofascore_id is mapped)
//   3. Oktagon JSON-LD image (auto-covers the Oktagon roster by slug)
//   4. Wikipedia REST summary thumbnail (direct title, then site search)
//   5. Bright Data SERP image search (dormant — only if BRIGHTDATA_API_KEY set)
// Returns a photo URL string or null. The frontend renders a clean initials
// avatar whenever this is null, so a miss never shows a broken image.

// Fold diacritics (incl. letters NFD leaves intact: ł, ø, đ, ı, ß) then slugify.
function fighterSlug(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[łŁ]/g, 'l').replace(/[øØ]/g, 'o').replace(/[đĐ]/g, 'd')
    .replace(/[ıİ]/g, 'i').replace(/ß/g, 'ss')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Native https POST (Bright Data direct API). Mirrors _get but with a body.
function _post(urlStr, body, headers, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const u    = new URL(urlStr);
    const data = typeof body === 'string' ? body : JSON.stringify(body || {});
    const opts = {
      hostname: u.hostname, port: 443, path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers || {}),
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = chunks.join('');
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch (_) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end(data);
  });
}

// Oktagon is a Next.js site reachable server-side (no Cloudflare block). Its
// per-fighter JSON-LD exposes the canonical fighter image. Slug is predictable.
async function _oktagonPhoto(slug) {
  if (!slug) return null;
  try {
    const res = await _get(`https://oktagonmma.com/en/fighters/${slug}/`,
      { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' }, 10000);
    if (!res || res.status !== 200 || typeof res.data !== 'string') return null;
    const m = res.data.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const j     = JSON.parse(m[1]);
    const graph = Array.isArray(j['@graph']) ? j['@graph'] : [j];
    for (const node of graph) {
      const person = node.mainEntity || (node['@type'] === 'Person' ? node : null);
      if (person && person.image) {
        const im = Array.isArray(person.image) ? person.image[0] : person.image;
        const url = im && (im.contentUrl || im.url || (typeof im === 'string' ? im : null));
        if (url) return url;
      }
      if (node.primaryImageOfPage && node.primaryImageOfPage.contentUrl) {
        return node.primaryImageOfPage.contentUrl;
      }
    }
  } catch (_) {}
  return null;
}

// Wikipedia REST summary thumbnail. Try the naive title first, then resolve via
// the search API (handles diacritics / disambiguation) before giving up.
async function _wikiPhoto(name) {
  const title = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
  try {
    const r = await _get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { 'User-Agent': 'PariScore/2.0 (https://pariscore.io; contact@pariscore.io)', 'Accept': 'application/json' }, 10000);
    if (r && r.status === 200 && r.data && r.data.thumbnail && r.data.thumbnail.source) {
      return r.data.thumbnail.source;
    }
  } catch (_) {}
  // Search fallback: best page match + pageimages thumbnail.
  try {
    const q = encodeURIComponent(`${name} mixed martial artist`);
    const r = await _get(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=200&format=json`,
      { 'User-Agent': 'PariScore/2.0 (https://pariscore.io; contact@pariscore.io)', 'Accept': 'application/json' }, 10000);
    const pages = r && r.data && r.data.query && r.data.query.pages;
    if (pages) {
      for (const k of Object.keys(pages)) {
        const t = pages[k] && pages[k].thumbnail;
        if (t && t.source) return t.source;
      }
    }
  } catch (_) {}
  return null;
}

// Universal web image search via Bright Data SERP API. DORMANT unless
// BRIGHTDATA_API_KEY is set in .env (free tier = 5000 req/mo). Defensive: any
// shape mismatch or error returns null so the cascade falls through to initials.
async function _brightDataPhoto(name) {
  const key  = process.env.BRIGHTDATA_API_KEY;
  if (!key) return null;
  const zone = process.env.BRIGHTDATA_SERP_ZONE || 'serp';
  try {
    const searchUrl = `https://www.google.com/search?tbm=isch&brd_json=1&q=${encodeURIComponent(name + ' mma fighter')}`;
    const r = await _post('https://api.brightdata.com/request',
      { zone, url: searchUrl, format: 'json' },
      { 'Authorization': `Bearer ${key}` }, 15000);
    if (!r || r.status !== 200 || !r.data) return null;
    // brd_json SERP image results land under one of these shapes depending on plan.
    const body    = (typeof r.data.body === 'string') ? safeJson(r.data.body) : r.data;
    const imgs    = (body && (body.images || body.image_results || body.organic_images)) || [];
    for (const it of imgs) {
      const u = it && (it.image || it.original || it.source || it.link || it.url);
      if (typeof u === 'string' && /^https?:\/\//.test(u)) return u;
    }
  } catch (_) {}
  return null;
}

function safeJson(s) { try { return JSON.parse(s); } catch (_) { return null; } }

// Public: resolve one fighter photo URL (or null). Caching lives in the route.
async function getFighterPhoto(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const slug = fighterSlug(name);

  // 1. Curated memory map
  const entry = FIGHTER_PHOTOS[slug];
  if (entry && typeof entry === 'object') {
    if (entry.url) return entry.url;
    if (entry.sofascore_id) return `https://sports.bzzoiro.com/img/team/${entry.sofascore_id}/?bg=transparent`;
  }
  // 2. Oktagon roster (auto by slug)
  const okta = await _oktagonPhoto(slug);
  if (okta) return okta;
  // 3. Wikipedia (notable UFC names)
  const wiki = await _wikiPhoto(name);
  if (wiki) return wiki;
  // 4. Bright Data SERP (dormant hook)
  const bd = await _brightDataPhoto(name);
  if (bd) return bd;

  return null;
}

// ─── Kept for future use when fighter stats source found ─────────────────────
function computeMMAWinProb() { return 0.5; }

function getCacheStatus() {
  return {
    full_age_s:      _fullCache.ts ? Math.round((Date.now() - _fullCache.ts) / 1000) : null,
    odds_cached:     !!_oddsCache.data,
    dratings_cached: !!_dratingsCache.data,
    fights_cached:   _fullCache.data ? _fullCache.data.reduce((n, e) => n + e.fights.length, 0) : 0,
    source:          'the-odds-api + dratings.com',
  };
}

module.exports = { getMMAFights, computeMMAWinProb, getCacheStatus, getFighterPhoto, fighterSlug };
