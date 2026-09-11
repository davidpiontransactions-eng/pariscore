'use strict';
/**
 * scrape-hockeystats-projections.mjs
 * Scraper NHL Standings Projections depuis hockeystats.com (HTML statique, HTTPS natif, zero-dep).
 * Cible : https://hockeystats.com/playoff-odds (redirige depuis /projections)
 * Sortie : data/hockeystats_nhl_projections.json
 * Usage : node scripts/scrape-hockeystats-projections.mjs
 */
import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'hockeystats_nhl_projections.json');
const URL = 'https://hockeystats.com/playoff-odds';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://hockeystats.com' + res.headers.location;
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

/**
 * Extrait un pourcentage depuis le HTML en cherchant le titre specifique a l'equipe.
 * Format: title="Team Name Win Round 1 Odds: XX%"
 */
function extractOdds(html, teamName, round) {
  const patterns = {
    r1: teamName + ' Win Round 1 Odds: ',
    r2: teamName + ' Win Round 2 Odds: ',
    final: teamName + ' Make Stanley Cup Final Odds: ',
    cup: teamName + ' Stanley Cup Odds: ',
  };
  const needle = patterns[round];
  if (!needle) return 0;
  const idx = html.indexOf(needle);
  if (idx < 0) return 0;
  const after = html.substring(idx + needle.length, idx + needle.length + 10);
  const m = after.match(/(\d+)%/);
  return m ? parseInt(m[1]) : 0;
}

function parseProjections(html) {
  const teams = [];

  const TEAM_MAP = {
    'VGK': { name: 'Vegas Golden Knights', conf: 'west', div: 'PAC' },
    'EDM': { name: 'Edmonton Oilers', conf: 'west', div: 'PAC' },
    'ANA': { name: 'Anaheim Ducks', conf: 'west', div: 'PAC' },
    'COL': { name: 'Colorado Avalanche', conf: 'west', div: 'CEN' },
    'DAL': { name: 'Dallas Stars', conf: 'west', div: 'CEN' },
    'MIN': { name: 'Minnesota Wild', conf: 'west', div: 'CEN' },
    'UTA': { name: 'Utah Mammoth', conf: 'west', div: 'WC' },
    'L.A': { name: 'Los Angeles Kings', conf: 'west', div: 'WC' },
    'CAR': { name: 'Carolina Hurricanes', conf: 'east', div: 'MET' },
    'PIT': { name: 'Pittsburgh Penguins', conf: 'east', div: 'MET' },
    'PHI': { name: 'Philadelphia Flyers', conf: 'east', div: 'MET' },
    'BUF': { name: 'Buffalo Sabres', conf: 'east', div: 'ATL' },
    'T.B': { name: 'Tampa Bay Lightning', conf: 'east', div: 'ATL' },
    'MTL': { name: 'Montreal Canadiens', conf: 'east', div: 'ATL' },
    'BOS': { name: 'Boston Bruins', conf: 'east', div: 'WC' },
    'OTT': { name: 'Ottawa Senators', conf: 'east', div: 'WC' },
  };

  for (const [abbr, meta] of Object.entries(TEAM_MAP)) {
    // Verifier que l'abreviation existe dans le HTML
    const abbrText = '>' + abbr + '<';
    if (html.indexOf(abbrText) < 0) continue;

    const winR1 = extractOdds(html, meta.name, 'r1');
    const winR2 = extractOdds(html, meta.name, 'r2');
    const makeFinal = extractOdds(html, meta.name, 'final');
    const winCup = extractOdds(html, meta.name, 'cup');

    teams.push({
      id: abbr,
      abbr,
      name: meta.name,
      logoUrl: 'https://hockeystats.com/logos/nhl/' + abbr + '.svg',
      conf: meta.conf,
      div: meta.div,
      winR1,
      winR2,
      makeFinal,
      winCup,
    });
  }

  return teams;
}

async function main() {
  console.log('[hockeystats] Fetching projections from', URL);
  try {
    const html = await fetchPage(URL);
    console.log('[hockeystats] Received', html.length, 'bytes');

    const teams = parseProjections(html);
    console.log('[hockeystats] Parsed', teams.length, 'teams');

    const west = teams.filter(t => t.conf === 'west');
    const east = teams.filter(t => t.conf === 'east');

    const payload = {
      updatedAt: new Date().toISOString(),
      source: 'hockeystats.com',
      season: '2026-27',
      conferences: {
        west: west.sort((a, b) => b.winCup - a.winCup),
        east: east.sort((a, b) => b.winCup - a.winCup),
      },
      teams,
    };

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(payload, null, 2));
    console.log('[hockeystats] Saved to', OUT);

    for (const t of teams.sort((a, b) => b.winCup - a.winCup)) {
      console.log('  ' + t.abbr.padEnd(4) + t.name.padEnd(28) + ' R1:' + t.winR1 + '% R2:' + t.winR2 + '% Final:' + t.makeFinal + '% Cup:' + t.winCup + '%');
    }
  } catch (err) {
    console.error('[hockeystats] Error:', err.message);
    process.exit(1);
  }
}

main();
