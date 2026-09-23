/**
 * scrape-oddspedia-hockey.mjs
 * Scrape oddspedia.com pages ligues hockey (JSON-LD SportsEvent + tableaux classement).
 * Sources : /fr/hockey-sur-glace/{pays}/{slug} — robots.txt: Allow /api/v1/*, pages publiques OK.
 * Sortie : data/hockey_prematch_oddspedia.json (format PrematchPayload — merge via prematch-data.ts)
 * Usage : node scripts/scrape-oddspedia-hockey.mjs [--league=magnus] [--dry-run]
 */
import https from 'node:https';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'hockey_prematch_oddspedia.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const LEAGUES = [
  { id: 'magnus', name: 'Ligue Magnus', path: '/fr/hockey-sur-glace/france/ligue-magnus' },
  { id: 'khl', name: 'KHL', path: '/fr/hockey-sur-glace/russie/khl' },
  { id: 'nhl', name: 'NHL', path: '/fr/hockey-sur-glace/usa/nhl' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9' },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://oddspedia.com' + res.headers.location;
        return resolve(fetchPage(loc));
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode + ' ' + url)); return; }
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout ' + url)); });
    req.on('error', reject);
  });
}

// ─── Parse JSON-LD SportsEvent (fixtures : équipes + date) ──────────────────

function parseFixtures(html) {
  const matches = [];
  const seen = new Set();
  const ldBlocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, raw] of ldBlocks) {
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    const events = Array.isArray(data) ? data : data['@graph'] ?? [data];
    for (const ev of events) {
      if (!ev || ev['@type'] !== 'SportsEvent') continue;
      const competitors = ev.competitor?.map((c) => ({ id: parseInt(String(c.url ?? '').match(/(\d+)/)?.[1] ?? '0'), name: c.name })) ?? [];
      if (competitors.length < 2 || !ev.startDate) continue;
      const key = `${norm(competitors[0].name)}|${norm(competitors[1].name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        team1Id: competitors[0].id || Math.abs(norm(competitors[0].name).split('').reduce((a, c) => a + c.charCodeAt(0), 0)),
        team1Name: competitors[0].name,
        team2Id: competitors[1].id || Math.abs(norm(competitors[1].name).split('').reduce((a, c) => a + c.charCodeAt(0), 0)),
        team2Name: competitors[1].name,
        date: ev.startDate,
        odds1X2: null,
      });
    }
  }
  return matches;
}

// ─── Parse classement (tableau img teams + rang/pts) ─────────────────────────

function parseStandings(html) {
  const standings = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let row;
  while ((row = rowRegex.exec(html)) !== null) {
    const r = row[1];
    const img = r.match(/teams\/small\/2\/(\d+)\.png/);
    const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    if (!img || cells.length < 3) continue;
    const nums = cells.map((c) => parseInt(c, 10)).filter((n) => !isNaN(n));
    if (nums.length < 3) continue;
    const name = (r.match(/alt="([^"]+)"/)?.[1]) || cells.find((c) => /[a-zA-Zéèêàûôç]/.test(c) && !/^\d+$/.test(c)) || `Team ${img[1]}`;
    const [rank, gp, w, l, pts] = [nums[0], nums[1], nums[2], nums[3], nums[nums.length - 1]];
    standings.push({
      rank, name, gp,
      all: { w: w ?? 0, otw: 0, otl: 0, l: l ?? 0, pts: pts ?? 0 },
      home: { w: 0, otw: 0, otl: 0, l: 0, pts: 0 },
      away: { w: 0, otw: 0, otl: 0, l: 0, pts: 0 },
      highlighted: false,
    });
  }
  return standings;
}

async function scrapeLeague(league, dryRun) {
  console.log(`\n=== ${league.name} (${league.path}) ===`);
  const url = `https://oddspedia.com${league.path}`;
  let html;
  try {
    html = await fetchPage(url);
  } catch (err) {
    console.error(`[oddspedia] Fetch error: ${err.message}`);
    return { matches: [], error: err.message };
  }
  const fixtures = parseFixtures(html);
  const standings = parseStandings(html);
  console.log(`[oddspedia] ${fixtures.length} fixtures, ${standings.length} standings`);
  if (dryRun) return { matches: fixtures.map((m) => ({ ...m, h2h: null })) };
  // Attacher les 2 équipes du match au standings du match (comme Annabet h2h)
  const byName = new Map(standings.map((s) => [norm(s.name), s]));
  const matches = fixtures.map((m) => {
    const hs = byName.get(norm(m.team1Name)) ?? null;
    const as = byName.get(norm(m.team2Name)) ?? null;
    return {
      ...m,
      h2h: {
        homeTeam: m.team1Name,
        awayTeam: m.team2Name,
        date: (m.date ?? '').split('T')[0],
        summaryHome: null,
        summaryAway: null,
        h2hStats: null,
        standings: [as, hs].filter(Boolean).map((s) => ({ ...s, highlighted: true })),
      },
    };
  });
  return { matches };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }));
  const dryRun = args['dry-run'] === true;
  const leagueFilter = args.league;

  const output = { updatedAt: new Date().toISOString(), source: 'oddspedia.com', leagues: {} };
  try {
    if (existsSync(OUT)) {
      const prev = JSON.parse(readFileSync(OUT, 'utf-8'));
      if (prev && typeof prev === 'object' && prev.leagues) output.leagues = { ...prev.leagues };
    }
  } catch { /* fichier corrompu → repart de zéro */ }

  for (const league of LEAGUES) {
    if (leagueFilter && league.id !== leagueFilter) continue;
    output.leagues[league.id] = await scrapeLeague(league, dryRun);
    await sleep(3000);
  }
  for (const l of LEAGUES) {
    if (!output.leagues[l.id]) output.leagues[l.id] = { matches: [] };
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\n[oddspedia] Saved to ${OUT}`);
  for (const [id, data] of Object.entries(output.leagues)) {
    console.log(`--- ${id}: ${data.matches.length} matchs ${data.error ? '(err: ' + data.error + ')' : ''}`);
  }
}

main().catch((e) => { console.error('[oddspedia] Fatal:', e.message); process.exit(1); });
