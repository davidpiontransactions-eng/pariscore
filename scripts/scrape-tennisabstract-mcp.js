#!/usr/bin/env node
'use strict';
/**
 * scrape-tennisabstract-mcp.js
 * ----------------------------
 * Routine : leaderboards serve/retour Match Charting Project (Tennis Abstract).
 *
 * Pourquoi : SPW/RPW (serve/return points won %) alimentent le moteur
 * (serveHold, over215 Markov, PowerScore, badges, radar, heatmap). Les pages
 * MCP donnent Unret%/RiP W% (serve) et RiP%/RiP W% (return) dont on dérive :
 *   SPW = Unret + (1-Unret) × RiP_W   (serve)
 *   RPW = RiP × RiP_W                 (return)
 * Pages : mcp_leaders_{serve,return}_{men,women}_last52.html (4 requêtes).
 * Robots.txt : /reports/ autorisé (seuls jsfrags/jsmatches/jsplayers exclus).
 *
 * Sortie : data/ta-mcp.json { updatedAt, source, players: { normName: {
 *   name, serve, return, matches, tour } } }, consommé par
 *   /api/tennis/strategy-top10 (fallback leaderboard si clé absente).
 * Clés = même normalisation que normPlayerName (tennis-top5.ts).
 *
 * Usage :
 *   node scripts/scrape-tennisabstract-mcp.js
 *   node scripts/scrape-tennisabstract-mcp.js --dry-run
 *   node scripts/scrape-tennisabstract-mcp.js --out=path
 *
 * Cron VPS : pm2 `pariscore-cron-ta-mcp`, quotidien 06:30 UTC
 * (données last52 lentes → TTL conso 8 j). ~4 requêtes HTTP, délai 1 s.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE = 'https://www.tennisabstract.com/reports';
const PAGES = [
  { file: 'mcp_leaders_serve_men_last52.html', kind: 'serve', tour: 'atp' },
  { file: 'mcp_leaders_return_men_last52.html', kind: 'return', tour: 'atp' },
  { file: 'mcp_leaders_serve_women_last52.html', kind: 'serve', tour: 'wta' },
  { file: 'mcp_leaders_return_women_last52.html', kind: 'return', tour: 'wta' },
];
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const HTTP_TIMEOUT_MS = 25000;
const DELAY_MS = 1000;
const RETRIES = 2;
// FlareSolverr (VPS, port 8191) : repli si Cloudflare bloque l'IP datacenter.
const FLARE_URL = process.env.FLARE_URL || 'http://127.0.0.1:8191/v1';

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_OUT = path.join(REPO_DIR, 'data', 'ta-mcp.json');

/** Même normalisation que normPlayerName (src/lib/tennis-top5.ts). */
function normPlayerName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fetchPage(file) {
  const url = `${BASE}/${file}`;
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = https.get(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      }, (res) => {
        let s = '';
        res.on('data', (d) => { s += d; });
        res.on('end', async () => {
          if (res.statusCode === 200 && s.includes('id="reportable"')) return resolve(s);
          // 403 Cloudflare (challenge JS, typique IP datacenter) → FlareSolverr.
          if (res.statusCode === 403) {
            try {
              console.log(`[ta-mcp] 403 ${file} → repli FlareSolverr`);
              const via = await fetchViaFlare(url);
              if (via.includes('id="reportable"')) return resolve(via);
            } catch (e) {
              console.error(`[ta-mcp] flare KO ${file}: ${e.message}`);
            }
          }
          if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
          reject(new Error(`HTTP ${res.statusCode} ${file}`));
        });
      });
      req.on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
        reject(e);
      });
      req.setTimeout(HTTP_TIMEOUT_MS, () => { req.destroy(new Error(`timeout ${file}`)); });
    };
    attempt(RETRIES);
  });
}

/** Repli FlareSolverr : résout le challenge Cloudflare via Chromium (VPS). */
function flareCmd(payload) {
  const target = new URL(FLARE_URL);
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      host: target.hostname,
      port: target.port || 80,
      path: target.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 90000,
    }, (res) => {
      let s = '';
      res.on('data', (d) => { s += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(s)); }
        catch (e) { reject(new Error(`flare parse: ${s.slice(0, 120)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('flare timeout')); });
    req.write(body);
    req.end();
  });
}

async function fetchViaFlare(url) {
  const session = `ta-mcp-${Date.now()}`;
  try {
    await flareCmd({ cmd: 'sessions.create', session });
    for (let i = 0; i < 3; i++) {
      const g = await flareCmd({ cmd: 'request.get', session, url, maxTimeout: 60000 });
      const html = (g.solution || {}).response || '';
      if (html.includes('id="reportable"')) return html;
      await sleep(8000);
    }
    throw new Error('challenge non résolu après 3 essais');
  } finally {
    try { await flareCmd({ cmd: 'sessions.destroy', session }); } catch { /* ignore */ }
  }
}

function pct(raw) {
  if (raw == null) return null;
  const m = /([\d.]+)\s*%/.exec(String(raw).replace(/&nbsp;?/g, ' '));
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v / 100 : null;
}

/** Parse table#reportable → [{ name, cells[] }] (lignes avec lien joueur). */
function parseRows(html) {
  const rows = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tr = m[1];
    const link = /<a[^>]*>([^<]+)<\/a>/i.exec(tr);
    if (!link) continue;
    const name = link[1].replace(/&nbsp;?/g, ' ').replace(/\s+/g, ' ').trim();
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let c;
    while ((c = tdRe.exec(tr)) !== null) {
      cells.push(c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
    if (name && cells.length > 2) rows.push({ name, cells });
  }
  return rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const outArg = (() => {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--out' && i + 1 < args.length) return args[i + 1];
      if (args[i].startsWith('--out=')) return args[i].slice(6);
    }
    return undefined;
  })();
  const outPath = outArg ? path.resolve(outArg) : DEFAULT_OUT;
  console.log(`[ta-mcp] out=${outPath}${dryRun ? ' (dry-run)' : ''}`);

  /** normName → { name, serve?, return?, matches, tour } */
  const players = new Map();
  const upsert = (name, tour, patch) => {
    const key = normPlayerName(name);
    if (!key) return;
    const prev = players.get(key) || { name, tour, matches: 0 };
    players.set(key, { ...prev, name: prev.name || name, tour: prev.tour || tour, ...patch });
  };

  for (let i = 0; i < PAGES.length; i++) {
    if (i > 0) await sleep(DELAY_MS);
    const { file, kind, tour } = PAGES[i];
    let html = '';
    try {
      html = await fetchPage(file);
    } catch (err) {
      console.error(`[ta-mcp] ${file} KO: ${err.message}`);
      continue;
    }
    const rows = parseRows(html);
    let kept = 0;
    for (const { name, cells } of rows) {
      // Col 0 = nom (lien), col 1 = Matches, col 2/3/4 = métriques overall.
      const matches = parseInt((cells[1] || '').replace(/\D/g, ''), 10) || 0;
      if (kind === 'serve') {
        const unret = pct(cells[2]);
        const ripW = pct(cells[4]);
        if (unret == null || ripW == null) continue;
        const spw = (unret + (1 - unret) * ripW) * 100;
        upsert(name, tour, { serve: Math.round(spw * 10) / 10, matches });
      } else {
        const rip = pct(cells[2]);
        const ripW = pct(cells[3]);
        if (rip == null || ripW == null) continue;
        const rpw = rip * ripW * 100;
        upsert(name, tour, { return: Math.round(rpw * 10) / 10, matches });
      }
      kept += 1;
    }
    console.log(`[ta-mcp] ${file}: ${rows.length} lignes (${kept} retenues)`);
  }

  const out = {
    updatedAt: new Date().toISOString(),
    source: 'tennisabstract-mcp-last52',
    players: Object.fromEntries(players),
  };
  console.log(`[ta-mcp] total: ${players.size} joueurs`);
  if (dryRun) {
    const sample = Object.entries(out.players).slice(0, 3);
    console.log(JSON.stringify(Object.fromEntries(sample), null, 1));
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`[ta-mcp] écrit: ${outPath}`);
}

if (require.main === module) {
  main().catch((err) => { console.error('[ta-mcp] FATAL:', err.message); process.exit(1); });
}

module.exports = { parseRows, pct, normPlayerName };
