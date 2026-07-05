'use strict';
// ─── betwatch.fr — Betfair Weight-of-Money (scraped cache reader) ─────────────
// bd 17y6. Source SHARP secondaire (signal additif). Inerte si le cache absent.
//
// Architecture découplée :
//   tools/scrape-betwatch-wom.js  → écrit data/betwatch_wom.json (via gstack browse,
//                                    seul moyen de passer Cloudflare)
//   betwatchService.js (ici)      → lit le cache (zéro-dep), expose fetchMatchWOM
//                                    au MÊME format que betfairService → réutilise l'UI.
//
// ⚠️ TOS/légal : le Moneyway est le produit PAYANT de betwatch (ils vendent une API).
//   Le scraping dans un produit commercial = violation TOS + exposition légale.
//   Choix utilisateur explicite (bd 17y6). Voie propre = add-on API officiel betwatch.

const fs = require('fs');
const path = require('path');

const CACHE_FILE = () => process.env.BETWATCH_CACHE || path.join(__dirname, 'data', 'betwatch_wom.json');
const FRESH_MS = 6 * 3600 * 1000; // au-delà → considéré périmé (mais reste lisible)

let _cache = null;        // { ts, byKey: Map }
let _cacheMtime = 0;

const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function _load() {
  let st;
  try { st = fs.statSync(CACHE_FILE()); } catch { _cache = null; return null; }
  if (_cache && st.mtimeMs === _cacheMtime) return _cache;
  let raw;
  try { raw = JSON.parse(fs.readFileSync(CACHE_FILE(), 'utf8')); } catch { _cache = null; return null; }
  const byKey = new Map();
  for (const m of (raw.matches || [])) {
    if (!m || !m.home_team || !m.away_team) continue;
    const k = norm(m.home_team) + '__' + norm(m.away_team);
    // garder la plus grosse liquidité si doublon de clé
    const prev = byKey.get(k);
    if (!prev || (m.totalMatched || 0) > (prev.totalMatched || 0)) byKey.set(k, m);
  }
  _cache = { ts: raw.ts || st.mtimeMs, date: raw.date, byKey, count: byKey.size };
  _cacheMtime = st.mtimeMs;
  return _cache;
}

function enabled() {
  return !process.env.BETWATCH_DISABLED && !!_load();
}

// Métadonnées cache (debug / route status)
function status() {
  const c = _load();
  if (!c) return { enabled: false, count: 0, ts: null, stale: null };
  return { enabled: true, count: c.count, ts: c.ts, date: c.date, stale: (Date.now() - c.ts) > FRESH_MS };
}

// Cherche l'entrée WOM pour un match PariScore (match nom normalisé, 2 ordres).
function _find(match) {
  const c = _load();
  if (!c) return null;
  const h = norm(match.home_team || match.player1 || match.p1);
  const a = norm(match.away_team || match.player2 || match.p2);
  if (!h || !a) return null;
  let hit = c.byKey.get(h + '__' + a);
  if (hit) return hit;
  // ordre inversé (au cas où la source liste away-home)
  hit = c.byKey.get(a + '__' + h);
  if (hit) return Object.assign({}, hit, { _reversed: true });
  // fuzzy : includes sur l'une des deux clés
  for (const [k, v] of c.byKey) {
    const [kh, ka] = k.split('__');
    if ((kh.includes(h) || h.includes(kh)) && (ka.includes(a) || a.includes(ka))) return v;
    if ((kh.includes(a) || a.includes(kh)) && (ka.includes(h) || h.includes(ka))) return Object.assign({}, v, { _reversed: true });
  }
  return null;
}

// Retourne le WOM au format betfairService (réutilise le panneau UI déjà câblé).
//   { source:'betwatch', ts, eventId, market, wom:{home,draw,away}%, money:{...}€,
//     odds:{home,draw,away} (current), movement:{...} SHORTENING|DRIFTING, totalMatched }
// Si _reversed, on échange home/away.
function fetchMatchWOM(match) {
  if (!match) return null;
  const e = _find(match);
  if (!e || !e.wom) return null;
  const swap = !!e._reversed;
  const pick = (o, side) => o ? (swap ? (side === 'home' ? o.away : side === 'away' ? o.home : o.draw) : o[side]) : null;
  const wom = { home: pick(e.wom, 'home'), draw: pick(e.wom, 'draw'), away: pick(e.wom, 'away') };
  const odds = { home: pick(e.odds, 'home'), draw: pick(e.odds, 'draw'), away: pick(e.odds, 'away') };
  const money = { home: pick(e.money, 'home'), draw: pick(e.money, 'draw'), away: pick(e.money, 'away') };
  const movement = { home: pick(e.movement, 'home'), draw: pick(e.movement, 'draw'), away: pick(e.movement, 'away') };
  let skew = null;
  if (wom.home != null && wom.away != null) skew = parseFloat(((wom.home - wom.away) / 100).toFixed(3));
  return {
    source: 'exchange', ts: (_cache && _cache.ts) || null,
    eventId: e.eventId, market: e.market || 'Match Odds',
    wom, odds, money, movement, totalMatched: e.totalMatched, totalEvent: e.totalEvent || null, skew,
  };
}

// Row format all_bookmakers pour ancrer le prix exchange (current) dans computeWFV1N2.
// clé 'betfairexchange' → getBookWeight≈3.5. Foot 1X2 seulement.
function fetchMatchRows(match) {
  const d = fetchMatchWOM(match);
  if (!d || !d.odds || !d.odds.home || !d.odds.away) return [];
  const inv = 1 / d.odds.home + (d.odds.draw ? 1 / d.odds.draw : 0) + 1 / d.odds.away;
  return [{
    key: 'betfairexchange', title: 'Betfair Exchange', isANJ: false,
    home: d.odds.home, draw: d.odds.draw || null, away: d.odds.away,
    payout: inv > 0 ? parseFloat((100 / inv).toFixed(1)) : 100,
    _src: 'betwatch', _wom: d.wom,
  }];
}

// Top-N matchs d'un sport classés par € total misé sur Betfair (volume = signal libre ;
// le split par issue peut être paywallé en tennis → on expose wom/money quand dispo, null sinon).
//   sport: 'tennis'|'football'  ·  opts: { live: true|false|null (null=les deux), limit:int }
// bd ab6s. Retourne [] si cache absent.
function topByMatched(sport, opts) {
  const c = _load();
  if (!c) return [];
  const o = opts || {};
  const sp = String(sport || '').toLowerCase();
  const wantLive = (o.live === true || o.live === false) ? o.live : null;
  const limit = Math.max(1, Math.min(50, parseInt(o.limit, 10) || 5));
  const out = [];
  for (const m of c.byKey.values()) {
    if (!m || (sp && String(m.sport || '').toLowerCase() !== sp)) continue;
    if (wantLive === true && !m.live) continue;
    if (wantLive === false && m.live) continue;
    if (!(m.totalMatched > 0)) continue;
    out.push({
      player1: m.home_team, player2: m.away_team,
      tournament: m.league || null, country: m.country || null,
      totalMatched: m.totalMatched, totalEvent: m.totalEvent || null,
      market: m.market || null, live: !!m.live, paywalled: !!m.paywalled,
      start_time: m.ce || null, eventId: m.eventId || null,
      wom: m.wom || null, money: m.money || null,
    });
  }
  out.sort((a, b) => (b.totalMatched || 0) - (a.totalMatched || 0));
  return out.slice(0, limit);
}

function mergeRows(existing, extra) {
  if (!Array.isArray(extra) || !extra.length) return existing || [];
  const base = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(base.map(r => norm(r.key || r.title)));
  for (const r of extra) { const k = norm(r.key || r.title); if (!seen.has(k)) { base.push(r); seen.add(k); } }
  return base;
}

module.exports = { enabled, status, fetchMatchWOM, fetchMatchRows, mergeRows, topByMatched, _find };
