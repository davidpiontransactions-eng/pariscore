/**
 * scrape-frozenpool-nhl.mjs
 * Scrape Frozen Tools (frozenpool.dobbersports.com) — NHL lines + fixtures du jour.
 * Sources gratuites (HORS paywall DFS : frozenpool_props.php = abonnement, NE PAS scraper).
 *   - header_today.php / header_yesterday.php / header_tomorrow.php : JSON purs fixtures/scores
 *   - last3gamelines.php?team={TEAM} : trios EV/PP/SH (TOI, GF, GA, xGF%) → lambdas Poisson
 * Sortie : data/nhl_frozenpool.json
 * Usage : node scripts/scrape-frozenpool-nhl.mjs [--teams=TOR,OTT] [--skip-lines]
 */
import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'nhl_frozenpool.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const TEAMS = ['ANA', 'BOS', 'BUF', 'CGY', 'CAR', 'CHI', 'COL', 'CBJ', 'DAL', 'DET', 'EDM', 'FLA', 'L.A', 'MIN', 'MTL', 'NSH', 'N.J', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'S.J', 'SEA', 'STL', 'T.B', 'TOR', 'UTA', 'VAN', 'VGK', 'WSH', 'WPG'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, timeout: 25000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://frozenpool.dobbersports.com' + res.headers.location;
        return resolve(fetchUrl(loc));
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout ' + url)); });
    req.on('error', reject);
  });
}

// ─── Fixtures : 3 fenêtres JSON ─────────────────────────────────────────────

async function fetchGames(path) {
  try {
    return JSON.parse(await fetchUrl(`https://frozenpool.dobbersports.com/${path}`));
  } catch (e) {
    console.warn(`[frozenpool] ${path}: ${e.message}`);
    return [];
  }
}

// ─── Lines : trios depuis last3gamelines (lignes tabulaires) ────────────────

function parseLines(html) {
  const sections = { ev_forwards: [], ev_defense: [], pp: [], sh: [] };
  const sectionOf = (label) => {
    const l = label.toLowerCase();
    if (l.includes('ev-forwards') || l.includes('ev forwards')) return 'ev_forwards';
    if (l.includes('ev-defense') || l.includes('ev defense')) return 'ev_defense';
    if (l.includes('pp')) return 'pp';
    if (l.includes('sh')) return 'sh';
    return null;
  };
  let current = null;
  const text = html.replace(/<\/tr>/g, '\n').replace(/<\/td>/g, '\t').replace(/<[^>]+>/g, '');
  for (const raw of text.split('\n')) {
    const line = raw.replace(/&nbsp;/g, ' ').trim();
    if (!line) continue;
    const s = sectionOf(line.split('\t')[0] ?? '');
    if (s) { current = s; continue; }
    const cells = line.split('\t').map((c) => c.trim()).filter(Boolean);
    const playerIdx = cells.findIndex((c) => /[A-Z]{2,} [A-Z]/.test(c) && c.includes(' - '));
    if (playerIdx === -1 || !current) continue;
    const players = cells[playerIdx].split(' - ').map((p) => p.trim());
    const nums = cells.map((c) => parseFloat(c)).filter((n) => !isNaN(n));
    sections[current].push({ players, toi: nums[1] ?? null, gf: nums[3] ?? null, ga: nums[4] ?? null, stats: nums });
  }
  return sections;
}

async function scrapeTeamLines(team) {
  try {
    const html = await fetchUrl(`https://frozenpool.dobbersports.com/frozenpool_last3gamelines.php?team=${encodeURIComponent(team)}`);
    const lines = parseLines(html);
    console.log(`[frozenpool] ${team}: ${lines.ev_forwards.length} trios EV`);
    return lines;
  } catch (e) {
    console.warn(`[frozenpool] ${team}: ${e.message}`);
    return { ev_forwards: [], ev_defense: [], pp: [], sh: [], error: e.message };
  }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }));
  const teams = args.teams ? String(args.teams).split(',') : TEAMS;

  const output = {
    updatedAt: new Date().toISOString(),
    source: 'frozenpool.dobbersports.com',
    games: {
      yesterday: await fetchGames('header_yesterday.php'),
      today: await fetchGames('header_today.php'),
      tomorrow: await fetchGames('header_tomorrow.php'),
    },
    lines: {},
  };

  if (!args['skip-lines']) {
    for (const team of teams) {
      output.lines[team] = await scrapeTeamLines(team);
      await sleep(2500); // pacing — site chargé, pas de WAF connu mais politesse
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\n[frozenpool] Saved ${teams.length} équipes → ${OUT}`);
}

main().catch((e) => { console.error('[frozenpool] Fatal:', e.message); process.exit(1); });
