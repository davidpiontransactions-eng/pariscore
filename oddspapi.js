'use strict';
// ─── OddsPapi — adaptateur Comparateur (dual-mode native / RapidAPI) ──────────
// Source secondaire de cotes. Inerte si ODDSPAPI_KEY absent (zéro impact).
//
// Mode "native" (DÉFAUT, recommandé) : api.oddspapi.io, auth ?apiKey=, endpoint
//   documenté v4/odds-by-tournaments, structure prix connue (bookmakerOdds).
// Mode "rapidapi" : odds-api1.p.rapidapi.com, headers x-rapidapi-*, endpoint
//   prix non confirmé (playground) → ODDSPAPI_ODDS_PATH ajustable.
// Bascule via ODDSPAPI_MODE=native|rapidapi.
const https = require('https');

// Lecture lazy : server.js parse .env (loadEnv) APRÈS le require de ce module.
const MODE = () => (process.env.ODDSPAPI_MODE || 'native').toLowerCase();
const KEY  = () => process.env.ODDSPAPI_KEY || '';
const HOST = () => process.env.ODDSPAPI_HOST ||
  (MODE() === 'rapidapi' ? 'odds-api1.p.rapidapi.com' : 'api.oddspapi.io');
const PATH_ODDS = () => process.env.ODDSPAPI_ODDS_PATH ||
  (MODE() === 'rapidapi' ? 'odds-by-tournaments' : 'v4/odds-by-tournaments');
const PATH_TOURNAMENTS = () => process.env.ODDSPAPI_TOURNAMENTS_PATH ||
  (MODE() === 'rapidapi' ? 'tournaments' : 'v4/tournaments');

const CACHE_TTL_MS = 15 * 60 * 1000;
const _cache = new Map(); // key → { ts, rows }

// Books agréés ANJ France (slugs OddsPapi observés en test /bookmakers).
const ANJ = ['winamax', 'betclic', 'unibet', 'pmu', 'parionssport', 'fdj',
  'zebet', 'netbet', 'bwin', 'genybet', 'vbet', 'circusbet', 'feelingbet',
  'pokerstars', 'fairpari'];

function enabled() { return !!KEY(); }

function getJSON(pathname, params) {
  return new Promise((resolve, reject) => {
    const h = HOST();
    const rapid = MODE() === 'rapidapi';
    const p = Object.assign({}, params || {});
    if (!rapid) p.apiKey = KEY(); // natif : auth en query param
    const qs = Object.keys(p).length ? '?' + new URLSearchParams(p).toString() : '';
    const headers = rapid
      ? { 'x-rapidapi-host': h, 'x-rapidapi-key': KEY(), 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
    const req = https.request({
      host: h, path: '/' + pathname + qs, method: 'GET',
      headers, timeout: 12000,
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
  // outcomeId → champ row (catalogue OddsPapi : 101-103 1X2, 104/105 BTTS,
  // 106/107 Totals 2.5). Fallback par libellé pour formes alternatives.
  const OUT = { 101: 'home', 102: 'draw', 103: 'away', 104: 'bttsYes',
    105: 'bttsNo', 106: 'over25', 107: 'under25' };
  const priceOf = o => {
    if (o == null) return null;
    if (o.price != null) return o.price;
    if (o.odds != null) return o.odds;
    if (o.value != null) return o.value;
    if (Array.isArray(o.players) && o.players[0]) return o.players[0].price ?? o.players[0].odds;
    return null;
  };
  const byLabel = (outs, nm) => {
    const arr = Array.isArray(outs) ? outs : Object.values(outs || {});
    const x = arr.find(e => String(e.outcomeName || e.name || '').toLowerCase() === nm.toLowerCase());
    return priceOf(x);
  };
  for (const fx of fixtures) {
    // ── Forme NATIVE : fixture.bookmakerOdds{slug}.markets{mid}.outcomes{oid} ──
    const bo = fx.bookmakerOdds || fx.bookmaker_odds;
    if (bo && typeof bo === 'object') {
      for (const [bk, bdata] of Object.entries(bo)) {
        const mkts = bdata && (bdata.markets || bdata.odds);
        if (!mkts) continue;
        const mlist = Array.isArray(mkts) ? mkts : Object.entries(mkts).map(([mid, m]) =>
          Object.assign({ marketId: Number(mid) }, m));
        for (const m of mlist) {
          const mid = Number(m.marketId != null ? m.marketId : m.id);
          const outs = m.outcomes || m.prices || {};
          const oentries = Array.isArray(outs)
            ? outs.map(o => [o.outcomeId, o]) : Object.entries(outs);
          for (const [oid, o] of oentries) {
            const field = OUT[Number(oid)] || OUT[Number(o && o.outcomeId)];
            if (field) pick(bk, field, priceOf(o));
          }
          // garde-fou libellé si IDs absents
          if (mid === 101) { pick(bk,'home',byLabel(outs,'1')); pick(bk,'draw',byLabel(outs,'X')); pick(bk,'away',byLabel(outs,'2')); }
          else if (mid === 104) { pick(bk,'bttsYes',byLabel(outs,'Yes')); pick(bk,'bttsNo',byLabel(outs,'No')); }
          else if (mid === 106) { pick(bk,'over25',byLabel(outs,'Over')); pick(bk,'under25',byLabel(outs,'Under')); }
        }
      }
      continue;
    }
    // ── Forme alternative : liste d'objets {bookmaker, marketId, outcomes[]} ──
    const odds = fx.odds || fx.markets || [];
    const list = Array.isArray(odds) ? odds : Object.values(odds);
    for (const o of list) {
      const bk = o.bookmaker || o.bookmakerSlug || o.book || o.bookmakerName;
      if (!bk) continue;
      const mid = o.marketId != null ? Number(o.marketId) : null;
      const mt = String(o.marketType || o.market || '').toLowerCase();
      const outs = o.outcomes || o.prices || [];
      const val = nm => byLabel(outs, nm);
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

// Mapping ligues PariScore → tournamentId OddsPapi (relevé live /tournaments
// sportId=10 ; IDs partagés natif/RapidAPI). Étendre au besoin.
const LEAGUE_TOURNAMENTS = {
  'ligue1': 34, 'frenchligue1': 34, 'soccerfranceligue1': 34,
  'premierleague': 17, 'epl': 17, 'soccerepl': 17, 'englishpremierleague': 17,
  'laliga': 8, 'spainlaliga': 8, 'soccerspainlaliga': 8,
  'bundesliga': 35, 'germanybundesliga': 35, 'soccergermanybundesliga': 35,
  'seriea': 23, 'italyseriea': 23, 'socceritalyseriea': 23,
  'championsleague': 7, 'uefachampionsleague': 7, 'socceruefachampsleague': 7,
  'europaleague': 679, 'uefaeuropaleague': 679, 'socceruefaeuropaleague': 679,
};
function resolveTournamentId(match) {
  if (!match) return null;
  if (match.oddspapi_tournament_id || match.tournamentId) {
    return match.oddspapi_tournament_id || match.tournamentId;
  }
  for (const v of [match.league, match.sport]) {
    const k = norm(v);
    if (!k) continue;
    if (LEAGUE_TOURNAMENTS[k]) return LEAGUE_TOURNAMENTS[k];
    const hit = Object.keys(LEAGUE_TOURNAMENTS).find(t => k.includes(t) || t.includes(k));
    if (hit) return LEAGUE_TOURNAMENTS[hit];
  }
  return null;
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
    const tournamentId = resolveTournamentId(match);
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

module.exports = { enabled, getJSON, normalizeToBookmakers, fetchMatchRows, mergeRows, isANJ, resolveTournamentId };
