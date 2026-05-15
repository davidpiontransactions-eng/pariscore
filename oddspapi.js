'use strict';
// ─── OddsPapi (RapidAPI) — adaptateur Comparateur ─────────────────────────────
// Source secondaire de cotes. Inerte si ODDSPAPI_KEY absent (zéro impact).
// Endpoint prix RapidAPI non confirmé publiquement → chemin configurable via
// ODDSPAPI_ODDS_PATH. Tant qu'il est faux, fetchTournamentOdds() renvoie [] et
// la table reste alimentée par The Odds API (fallback silencieux).
const https = require('https');

// Lecture lazy : server.js parse .env (loadEnv) APRÈS le require de ce module.
// Capturer en const au load donnerait des valeurs vides → on lit à l'appel.
const KEY  = () => process.env.ODDSPAPI_KEY || '';
const HOST = () => process.env.ODDSPAPI_HOST || 'odds-api1.p.rapidapi.com';
// NON confirmé (doc native: /v4/odds-by-tournaments). Ajustable sans code :
// ODDSPAPI_ODDS_PATH=... ; défensif → [] si réponse inattendue.
const PATH_ODDS = () => process.env.ODDSPAPI_ODDS_PATH || 'odds-by-tournaments';

const CACHE_TTL_MS = 15 * 60 * 1000;
const _cache = new Map(); // key → { ts, rows }

// Books agréés ANJ France (slugs OddsPapi observés en test /bookmakers).
const ANJ = ['winamax', 'betclic', 'unibet', 'pmu', 'parionssport', 'fdj',
  'zebet', 'netbet', 'bwin', 'genybet', 'vbet', 'circusbet', 'feelingbet',
  'pokerstars', 'fairpari'];

function enabled() { return !!KEY(); }

function getJSON(pathname, params) {
  return new Promise((resolve, reject) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const h = HOST();
    const req = https.request({
      host: h, path: '/' + pathname + qs, method: 'GET',
      headers: { 'x-rapidapi-host': h, 'x-rapidapi-key': KEY(), 'Content-Type': 'application/json' },
      timeout: 12000,
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('OddsPapi HTTP ' + res.statusCode + ' ' + b.slice(0, 120)));
        try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('OddsPapi timeout')); });
    req.end();
  });
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const isANJ = slug => { const k = norm(slug); return ANJ.some(a => k.includes(a)); };

// Normalise une réponse OddsPapi odds-by-* vers le schéma `all_bookmakers`
// attendu par le Comparateur (rows {key,title,isANJ,home,draw,away,payout,
// over25,under25,bttsYes,bttsNo,...}). Défensif : toute forme inattendue → [].
function normalizeToBookmakers(raw, homeTeam, awayTeam) {
  if (!raw) return [];
  const fixtures = Array.isArray(raw) ? raw : (raw.fixtures || raw.data || []);
  if (!Array.isArray(fixtures)) return [];
  const byBook = new Map();
  const pick = (bk, k, v) => {
    if (v == null || isNaN(v)) return;
    if (!byBook.has(bk)) byBook.set(bk, { key: norm(bk), title: bk, isANJ: isANJ(bk) });
    byBook.get(bk)[k] = Number(v);
  };
  for (const fx of fixtures) {
    const odds = fx.odds || fx.markets || [];
    const list = Array.isArray(odds) ? odds : Object.values(odds);
    for (const o of list) {
      const bk = o.bookmaker || o.bookmakerSlug || o.book || o.bookmakerName;
      if (!bk) continue;
      const mid = o.marketId != null ? Number(o.marketId) : null;
      const mt = String(o.marketType || o.market || '').toLowerCase();
      const outs = o.outcomes || o.prices || [];
      const val = nm => {
        const x = (Array.isArray(outs) ? outs : []).find(e =>
          String(e.outcomeName || e.name || e.outcomeId) .toLowerCase() === String(nm).toLowerCase());
        return x ? (x.price ?? x.odds ?? x.value) : null;
      };
      if (mid === 101 || mt === '1x2') {
        pick(bk, 'home', val('1')); pick(bk, 'draw', val('X')); pick(bk, 'away', val('2'));
      } else if (mid === 104 || mt.includes('bothteams') || mt === 'btts') {
        pick(bk, 'bttsYes', val('Yes')); pick(bk, 'bttsNo', val('No'));
      } else if (mid === 106 || mt === 'totals') {
        pick(bk, 'over25', val('Over')); pick(bk, 'under25', val('Under'));
      }
    }
  }
  const rows = [...byBook.values()];
  for (const r of rows) {
    if (r.home && r.away) {
      const inv = 1 / r.home + (r.draw ? 1 / r.draw : 0) + 1 / r.away;
      r.payout = inv > 0 ? parseFloat((100 / inv).toFixed(1)) : null;
    }
    if (r.over25 && r.under25) r.payoutOU = parseFloat((100 / (1 / r.over25 + 1 / r.under25)).toFixed(1));
    if (r.bttsYes && r.bttsNo) r.payoutBTTS = parseFloat((100 / (1 / r.bttsYes + 1 / r.bttsNo)).toFixed(1));
    r._src = 'oddspapi';
  }
  return rows;
}

// Récupère + normalise les cotes OddsPapi pour un match (cache 15 min).
// Best-effort : toute erreur → [] (le Comparateur garde The Odds API).
async function fetchMatchRows(match) {
  if (!enabled() || !match || !match.id) return [];
  const ck = 'm:' + match.id;
  const c = _cache.get(ck);
  if (c && (Date.now() - c.ts) < CACHE_TTL_MS) return c.rows;
  let rows = [];
  try {
    const tournamentId = match.oddspapi_tournament_id || match.tournamentId;
    let raw;
    if (tournamentId) {
      raw = await getJSON(PATH_ODDS(), { tournamentIds: tournamentId, oddsFormat: 'decimal' });
    } else if (match.oddspapi_fixture_id) {
      raw = await getJSON(PATH_ODDS(), { fixtureId: match.oddspapi_fixture_id, oddsFormat: 'decimal' });
    } else {
      _cache.set(ck, { ts: Date.now(), rows: [] });
      return [];
    }
    rows = normalizeToBookmakers(raw, match.home_team, match.away_team);
  } catch (e) {
    console.warn('[OddsPapi] skip ' + match.id + ' — ' + e.message);
    rows = [];
  }
  _cache.set(ck, { ts: Date.now(), rows });
  return rows;
}

// Fusionne les rows OddsPapi dans un tableau all_bookmakers existant
// (dédup par clé book ; OddsPapi en complément, n'écrase pas Odds API).
function mergeRows(existing, extra) {
  if (!Array.isArray(extra) || !extra.length) return existing || [];
  const base = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(base.map(r => norm(r.key || r.title)));
  for (const r of extra) if (!seen.has(norm(r.key || r.title))) { base.push(r); seen.add(norm(r.key || r.title)); }
  return base;
}

module.exports = { enabled, getJSON, normalizeToBookmakers, fetchMatchRows, mergeRows, isANJ };
