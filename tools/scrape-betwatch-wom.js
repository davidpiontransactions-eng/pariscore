'use strict';
// ─── betwatch.fr Moneyway (Betfair WOM) scraper → data/betwatch_wom.json ──────
// bd 17y6. Passe Cloudflare via le binaire gstack browse (Chromium bundlé) ; un
// simple https Node est 403. Découplé de server.js (qui lit juste le cache JSON).
//
// Usage:
//   node tools/scrape-betwatch-wom.js [YYYY-MM-DD] [+nbJours]
//   node tools/scrape-betwatch-wom.js              # aujourd'hui + demain (UTC)
//   BROWSE_BIN=/path/to/browse node tools/scrape-betwatch-wom.js
//
// ⚠️ TOS : Moneyway = produit payant betwatch. Voir .context/betwatch-wom-analysis.md.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = process.env.BETWATCH_CACHE || path.join(__dirname, '..', 'data', 'betwatch_wom.json');
const HOME = process.env.HOME || process.env.USERPROFILE || '';

function resolveBrowse() {
  const cands = [
    process.env.BROWSE_BIN,
    path.join(process.cwd(), '.claude/skills/gstack/browse/dist/browse.exe'),
    path.join(process.cwd(), '.claude/skills/gstack/browse/dist/browse'),
    path.join(HOME, '.claude/skills/gstack/browse/dist/browse.exe'),
    path.join(HOME, '.claude/skills/gstack/browse/dist/browse'),
  ].filter(Boolean);
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch {} }
  throw new Error('gstack browse binary introuvable (set BROWSE_BIN=...)');
}
const BROWSE = resolveBrowse();

function browse(args, timeoutMs) {
  return execFileSync(BROWSE, args, { encoding: 'utf8', timeout: timeoutMs || 30000, maxBuffer: 32 * 1024 * 1024 });
}
function tryBrowse(args, timeoutMs) { try { return browse(args, timeoutMs); } catch (e) { return null; } }

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// Passe Cloudflare. Note : le mode HEADED (connect) passe CF ; le headless est 403.
// useragent échoue en mode headed (rebuild context) → best-effort.
function warmCloudflare() {
  tryBrowse(['useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36']);
  // Déjà chaud (session CF-cleared en cours) ?
  const host0 = (tryBrowse(['js', 'location.hostname']) || '').trim();
  let title = (tryBrowse(['js', 'document.title']) || '').trim();
  if (/betwatch/i.test(host0) && title && !/moment|Just/i.test(title)) return title;
  for (let attempt = 0; attempt < 3; attempt++) {
    tryBrowse(['goto', 'https://betwatch.fr/'], 40000);
    for (let i = 0; i < 6; i++) {
      sleep(4000);
      title = (tryBrowse(['js', 'document.title']) || '').trim();
      if (title && !/moment|Just/i.test(title)) return title;
    }
    tryBrowse(['connect'], 25000); // warmup headed (passe CF), puis retry goto
  }
  return title;
}

function fetchJSON(urlPath) {
  const expr = "fetch('" + urlPath + "',{headers:{accept:'application/json'}}).then(r=>r.text())";
  const raw = browse(['js', expr], 30000);
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('réponse non-JSON (CF ?): ' + raw.slice(0, 120));
  return JSON.parse(raw.slice(a, b + 1));
}

// Mapping label marché → side 1X2
const SIDE = { '1': 'home', X: 'draw', '2': 'away' };

function normalizeMatch(m) {
  const out = {
    home_team: m.htn, away_team: m.atn, ce: m.ce,
    eventId: m.e, iid: m.iid, league: m.ln, country: m.cn,
    live: m.l === 1, market: m.n || null,
    totalMatched: typeof m.v === 'number' ? Math.round(m.v) : null,
    totalEvent: typeof m.vm === 'number' ? m.vm : null,
    wom: null, money: null, odds: null, open: null, movement: null,
  };
  if (m.n === 'Match Odds' && Array.isArray(m.i)) {
    const money = {}, odds = {}, open = {}, movement = {};
    let sum = 0;
    for (const row of m.i) {
      const side = SIDE[row[0]];
      if (!side) continue;
      const mm = Number(row[1]) || 0, cur = Number(row[2]) || null, opn = Number(row[3]) || null;
      money[side] = Math.round(mm); odds[side] = cur; open[side] = opn;
      movement[side] = (opn && cur) ? (cur < opn ? 'SHORTENING' : cur > opn ? 'DRIFTING' : null) : null;
      sum += mm;
    }
    if (sum > 0 && money.home != null && money.away != null) {
      out.wom = {
        home: parseFloat(((money.home || 0) / sum * 100).toFixed(1)),
        draw: money.draw != null ? parseFloat((money.draw / sum * 100).toFixed(1)) : null,
        away: parseFloat(((money.away || 0) / sum * 100).toFixed(1)),
      };
      out.money = money; out.odds = odds; out.open = open; out.movement = movement;
    }
  }
  return out;
}

function dateStr(d) { return d.toISOString().slice(0, 10); }

(function main() {
  const argDate = process.argv[2];
  const days = Math.max(1, parseInt((process.argv[3] || '+2').replace('+', ''), 10) || 2);
  const base = argDate ? new Date(argDate + 'T00:00:00Z') : new Date(Date.now()); // Date.now ok (script CLI)
  if (isNaN(base.getTime())) { console.error('date invalide:', argDate); process.exit(1); }

  console.log('[betwatch] browse:', BROWSE);
  const title = warmCloudflare();
  if (/moment|Just/i.test(title) || !title) {
    console.error('[betwatch] ÉCHEC Cloudflare — titre="' + title + '". Lance une fois en visible (browse connect) puis relance.');
    process.exit(2);
  }
  console.log('[betwatch] CF OK — "' + title + '"');

  const seen = new Map(); // key → entry (garde plus grosse liquidité)
  let withWom = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const ds = dateStr(d);
    const url = '/football/getMoney?live_only=false&prematch_only=false&finished_only=false&favorite_only=false&utc=2&step=1&date=' + ds + '&order_by_time=false&not_countries=&not_leagues=';
    let json;
    try { json = fetchJSON(url); } catch (e) { console.warn('[betwatch] ' + ds + ' skip — ' + e.message); continue; }
    const data = Array.isArray(json.data) ? json.data : [];
    for (const m of data) {
      const e = normalizeMatch(m);
      if (!e.home_team || !e.away_team) continue;
      const key = e.eventId || (e.home_team + '|' + e.away_team + '|' + e.ce);
      const prev = seen.get(key);
      if (!prev || (e.totalMatched || 0) > (prev.totalMatched || 0)) seen.set(key, e);
    }
    console.log('[betwatch] ' + ds + ' — ' + data.length + ' marchés');
  }
  const matches = [...seen.values()];
  withWom = matches.filter(m => m.wom).length;

  const payload = { ts: Date.now(), date: dateStr(base), source: 'betwatch.fr/getMoney', count: matches.length, with_wom: withWom, matches };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log('[betwatch] écrit ' + OUT + ' — ' + matches.length + ' matchs, ' + withWom + ' avec WOM 1X2');
})();
