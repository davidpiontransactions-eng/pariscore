'use strict';
// ─── betwatch.fr Moneyway (Betfair WOM) scraper → data/betwatch_wom.json ──────
// bd 17y6. LOCAL/VPS-ONLY (gitignored, jamais committé — TOS). Passe Cloudflare.
// Découplé de server.js (qui lit le cache via wom.local.js).
//
// Transport (auto):
//   FLARESOLVERR_URL set  → FlareSolverr (VPS headless, conteneur docker :8191)
//   sinon                 → binaire gstack browse (local, mode headed)
//
// Sports:
//   football → /football/getMoney            (FREE — i rempli)
//   tennis   → /tennis/getMoney sinon /unauthorized/tennis/getMoney
//              ⚠️ Tennis = "Extra Sports" PAYANT. Sans session abonnée, i nullé.
//
// Usage:
//   node tools/scrape-betwatch-wom.js [YYYY-MM-DD] [+nbJours]
//   FLARESOLVERR_URL=http://localhost:8191 node tools/scrape-betwatch-wom.js   # VPS
//
// ⚠️ TOS : Moneyway = produit payant betwatch. Voir .context/betwatch-wom-analysis.md.

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');

// .env minimal (DISCORD_*_WEBHOOK_URL) — script standalone, server.js parse .env de son côté.
(function loadEnv() {
  try {
    const t = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of t.split(/\r?\n/)) {
      const mt = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (mt && process.env[mt[1]] === undefined) process.env[mt[1]] = mt[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
})();

const OUT = process.env.BETWATCH_CACHE || path.join(__dirname, '..', 'data', 'betwatch_wom.json');
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const FS_URL = (process.env.FLARESOLVERR_URL || '').replace(/\/$/, '');
const ORIGIN = 'https://betwatch.fr';

const SPORTS = [
  { key: 'football', paths: ['/football/getMoney'] },
  { key: 'tennis', paths: ['/tennis/getMoney', '/unauthorized/tennis/getMoney'] },
];

// ── Transport browse (local) ──────────────────────────────────────────────────
function resolveBrowse() {
  const cands = [
    process.env.BROWSE_BIN,
    path.join(process.cwd(), '.claude/skills/gstack/browse/dist/browse.exe'),
    path.join(process.cwd(), '.claude/skills/gstack/browse/dist/browse'),
    path.join(HOME, '.claude/skills/gstack/browse/dist/browse.exe'),
    path.join(HOME, '.claude/skills/gstack/browse/dist/browse'),
  ].filter(Boolean);
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch {} }
  throw new Error('gstack browse binary introuvable (set BROWSE_BIN= ou FLARESOLVERR_URL=)');
}
const BROWSE = FS_URL ? null : resolveBrowse();

function browse(args, timeoutMs) {
  return execFileSync(BROWSE, args, { encoding: 'utf8', timeout: timeoutMs || 30000, maxBuffer: 32 * 1024 * 1024 });
}
function tryBrowse(args, timeoutMs) { try { return browse(args, timeoutMs); } catch (e) { return null; } }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function warmCloudflareBrowse() {
  tryBrowse(['useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36']);
  const host0 = (tryBrowse(['js', 'location.hostname']) || '').trim();
  let title = (tryBrowse(['js', 'document.title']) || '').trim();
  if (/betwatch/i.test(host0) && title && !/moment|Just/i.test(title)) return title;
  for (let attempt = 0; attempt < 3; attempt++) {
    tryBrowse(['goto', ORIGIN + '/'], 40000);
    for (let i = 0; i < 6; i++) {
      sleep(4000);
      title = (tryBrowse(['js', 'document.title']) || '').trim();
      if (title && !/moment|Just/i.test(title)) return title;
    }
    tryBrowse(['connect'], 25000);
  }
  return title;
}
function fetchBrowse(urlPath) {
  const expr = "fetch('" + urlPath + "',{headers:{accept:'application/json'}}).then(r=>r.text())";
  const raw = browse(['js', expr], 30000);
  return raw;
}

// ── Transport FlareSolverr (VPS) ──────────────────────────────────────────────
function fsRequest(fullUrl) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ cmd: 'request.get', url: fullUrl, maxTimeout: 70000 });
    const u = new URL(FS_URL + '/v1');
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 95000,
    }, res => { let b = ''; res.on('data', c => (b += c)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('flaresolverr timeout')));
    req.end(body);
  });
}
async function fetchFS(urlPath) {
  const j = await fsRequest(ORIGIN + urlPath);
  if (!j || j.status !== 'ok' || !j.solution) throw new Error('FS ' + ((j && j.message) || 'no solution'));
  return j.solution.response || '';
}

// ── Fetch unifié : renvoie le JSON parsé ──────────────────────────────────────
async function fetchJSON(urlPath) {
  const raw = FS_URL ? await fetchFS(urlPath) : fetchBrowse(urlPath);
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('non-JSON (paywall/redirect/CF): ' + String(raw).slice(0, 80));
  return JSON.parse(raw.slice(a, b + 1));
}

const SIDE = { '1': 'home', X: 'draw', '2': 'away' };

function normalizeMatch(m, sport) {
  const out = {
    sport, home_team: m.htn, away_team: m.atn, ce: m.ce,
    eventId: m.e, iid: m.iid, league: m.ln, country: m.cn,
    live: m.l === 1, market: m.n || null,
    totalMatched: typeof m.v === 'number' ? Math.round(m.v) : null,
    totalEvent: typeof m.vm === 'number' && m.vm > 0 ? m.vm : null,
    wom: null, money: null, odds: null, open: null, movement: null, paywalled: false,
  };
  if (m.n === 'Match Odds' && Array.isArray(m.i)) {
    const money = {}, odds = {}, open = {}, movement = {};
    let sum = 0, anyNull = false;
    for (const row of m.i) {
      const side = SIDE[row[0]];
      if (!side) continue;
      if (row[1] == null) { anyNull = true; continue; }
      const mm = Number(row[1]) || 0, cur = Number(row[2]) || null, opn = Number(row[3]) || null;
      money[side] = Math.round(mm); odds[side] = cur; open[side] = opn;
      movement[side] = (opn && cur) ? (cur < opn ? 'SHORTENING' : cur > opn ? 'DRIFTING' : null) : null;
      sum += mm;
    }
    if (anyNull && sum === 0) { out.paywalled = true; return out; }
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

// ── Discord : alerte évolution WOM entre 2 scrapes ────────────────────────────
function _eur(n) { return (n == null) ? '?' : Math.round(n).toLocaleString('fr-FR') + ' €'; }
function _sideLabel(m, side) { return side === 'home' ? m.home_team : side === 'away' ? m.away_team : 'Nul'; }
function detectEvolution(prevMatches, newMatches) {
  const prev = new Map((prevMatches || []).filter(m => m && m.wom && m.eventId).map(m => [m.eventId, m]));
  const DELTA = Number(process.env.WOM_ALERT_DELTA || 8);     // points de % minimum
  const MINE  = Number(process.env.WOM_ALERT_MIN_EUR || 3000); // liquidité minimum
  const MAX   = Number(process.env.WOM_ALERT_MAX || 6);
  const out = [];
  for (const m of newMatches) {
    if (!m.wom || !m.eventId || (m.totalMatched || 0) < MINE) continue;
    const p = prev.get(m.eventId);
    if (!p || !p.wom) continue;
    let maxD = 0, side = null;
    for (const k of ['home', 'draw', 'away']) {
      const a = m.wom[k], b = p.wom[k];
      if (a == null || b == null) continue;
      const dd = a - b;
      if (Math.abs(dd) > Math.abs(maxD)) { maxD = dd; side = k; }
    }
    if (side && Math.abs(maxD) >= DELTA) out.push({ m, p, side, maxD });
  }
  out.sort((a, b) => Math.abs(b.maxD) - Math.abs(a.maxD));
  return out.slice(0, MAX);
}
function buildDiscordMsg(evo) {
  const lines = evo.map(e => {
    const arrow = e.maxD > 0 ? '📈' : '📉';
    const lbl = _sideLabel(e.m, e.side);
    const np = e.m.wom[e.side], pp = e.p.wom[e.side];
    const nm = e.m.money && e.m.money[e.side], pm = e.p.money && e.p.money[e.side];
    const sign = e.maxD > 0 ? '+' : '';
    return `${arrow} **${e.m.home_team} – ${e.m.away_team}** · ${lbl}: ${pp}%→**${np}%** (${sign}${e.maxD.toFixed(1)}) | ${_eur(pm)}→${_eur(nm)} | total ${_eur(e.m.totalMatched)}`;
  });
  return '💰 **Évolution WOM Betfair** (' + evo.length + ')\n' + lines.join('\n');
}
function postDiscord(webhook, content) {
  return new Promise(resolve => {
    try {
      const u = new URL(webhook);
      const body = JSON.stringify({ content: content.slice(0, 1900), username: 'PariScore WOM', allowed_mentions: { parse: [] } });
      const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 }, r => { r.on('data', () => {}); r.on('end', () => resolve(r.statusCode < 300)); });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end(body);
    } catch { resolve(false); }
  });
}

(async function main() {
  const argDate = process.argv[2];
  const days = Math.max(1, parseInt((process.argv[3] || '+2').replace('+', ''), 10) || 2);
  const base = argDate ? new Date(argDate + 'T00:00:00Z') : new Date(Date.now());
  if (isNaN(base.getTime())) { console.error('date invalide:', argDate); process.exit(1); }

  console.log('[betwatch] transport:', FS_URL ? ('flaresolverr ' + FS_URL) : ('browse ' + BROWSE));
  if (!FS_URL) {
    const title = warmCloudflareBrowse();
    if (/moment|Just/i.test(title) || !title) { console.error('[betwatch] ÉCHEC Cloudflare (browse) — "' + title + '"'); process.exit(2); }
    console.log('[betwatch] CF OK — "' + title + '"');
  }

  const seen = new Map();
  const stats = {};
  for (const sp of SPORTS) {
    stats[sp.key] = { markets: 0, wom: 0, paywalled: 0 };
    for (let i = 0; i < days; i++) {
      const ds = dateStr(new Date(base.getTime() + i * 86400000));
      const qs = '?live_only=false&prematch_only=false&finished_only=false&favorite_only=false&utc=2&step=1&date=' + ds + '&order_by_time=false&not_countries=&not_leagues=';
      let json = null;
      for (const p of sp.paths) {
        try { json = await fetchJSON(p + qs); if (json && Array.isArray(json.data)) break; } catch (e) { json = null; }
      }
      if (!json || !Array.isArray(json.data)) { console.warn('[betwatch] ' + sp.key + ' ' + ds + ' skip'); continue; }
      for (const m of json.data) {
        const e = normalizeMatch(m, sp.key);
        if (!e.home_team || !e.away_team) continue;
        stats[sp.key].markets++;
        if (e.wom) stats[sp.key].wom++;
        if (e.paywalled) stats[sp.key].paywalled++;
        const key = (sp.key + ':') + (e.eventId || (e.home_team + '|' + e.away_team + '|' + e.ce));
        const prev = seen.get(key);
        if (!prev || (e.totalMatched || 0) > (prev.totalMatched || 0)) seen.set(key, e);
      }
    }
    const s = stats[sp.key];
    console.log('[betwatch] ' + sp.key + ' — ' + s.markets + ' marchés, ' + s.wom + ' WOM' + (s.paywalled ? ', ' + s.paywalled + ' PAYWALLÉS' : ''));
  }

  const matches = [...seen.values()];

  // ── Discord : évolution WOM vs scrape précédent (avant d'écraser le cache) ──
  try {
    let prevMatches = [];
    try { prevMatches = JSON.parse(fs.readFileSync(OUT, 'utf8')).matches || []; } catch {}
    const evo = detectEvolution(prevMatches, matches);
    const wh = process.env.DISCORD_WOM_WEBHOOK_URL || process.env.DISCORD_FOOT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '';
    if (evo.length && wh) { const ok = await postDiscord(wh, buildDiscordMsg(evo)); console.log('[betwatch] Discord WOM: ' + evo.length + ' évolutions ' + (ok ? 'postées' : 'ÉCHEC')); }
    else if (evo.length) console.log('[betwatch] ' + evo.length + ' évolutions WOM (pas de webhook Discord)');
    else console.log('[betwatch] pas d\'évolution WOM notable');
  } catch (e) { console.warn('[betwatch] discord skip — ' + e.message); }

  const payload = {
    ts: Date.now(), date: dateStr(base), source: 'betwatch.fr/getMoney',
    count: matches.length, with_wom: matches.filter(m => m.wom).length, stats, matches,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log('[betwatch] écrit ' + OUT + ' — ' + matches.length + ' matchs, ' + payload.with_wom + ' avec WOM');
})().catch(e => { console.error('[betwatch] FATAL', e && e.message || e); process.exit(1); });
