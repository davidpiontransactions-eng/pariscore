/**
 * scrape-eliteprospects-hockey.mjs
 * Scraper KHL + Ligue Magnus standings depuis eliteprospects.com (HTML statique, zero-dep).
 * Cibles :
 *   - https://www.eliteprospects.com/league/khl/standings/2026-2027
 *   - https://www.eliteprospects.com/league/ligue-magnus/standings/2026-2027
 * Sortie : data/eliteprospects_hockey_standings.json
 * Usage : node scripts/scrape-eliteprospects-hockey.mjs [--season=2026-2027]
 */
import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'eliteprospects_hockey_standings.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const LEAGUES = [
  { id: 'khl', name: 'KHL', slug: 'khl', country: 'Russia', confLabels: ['Eastern Conference', 'Western Conference'] },
  { id: 'ligue-magnus', name: 'Ligue Magnus', slug: 'ligue-magnus', country: 'France', confLabels: [] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://www.eliteprospects.com' + res.headers.location;
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
 * Parse le HTML eliteprospects pour extraire les standings.
 * Structure: <table> avec lignes <tr> contenant <td> pour chaque colonne.
 * Les en-tetes de conference sont des lignes avec colspan.
 */
function parseStandings(html, league) {
  const teams = [];
  let currentConf = '';

  // Trouver le tableau principal (celui avec les standings)
  // Pattern: <table class="table ..."> ... </table>
  const tableMatch = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return teams;

  const tableHtml = tableMatch[1];

  // Extraire toutes les lignes <tr>
  const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];

  for (const row of rows) {
    // Ligne de conference (colspan)
    const confMatch = row.match(/colspan[^>]*>([^<]*(?:Conference)[^<]*)</i);
    if (confMatch) {
      currentConf = confMatch[1].trim();
      continue;
    }

    // Ligne d'equipe: extraire les <td>
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 10) continue;

    // Nettoyer le HTML de chaque cellule
    const cleanCells = cells.map((c) => {
      const text = c.replace(/<[^>]+>/g, '').trim();
      return text;
    });

    // Colonne # = rank, Team = nom avec lien, puis stats
    const rank = parseInt(cleanCells[0]);
    if (isNaN(rank)) continue;

    // Extraire le nom de l'equipe depuis la cellule Team (cellule 1)
    const teamCell = cells[1];
    const teamNameMatch = teamCell.match(/>([^<]+)<\/a>/);
    const teamName = teamNameMatch ? teamNameMatch[1].trim() : cleanCells[1];

    // Extraire le slug/ID de l'equipe depuis le lien
    const teamLinkMatch = teamCell.match(/href="[^"]*\/team\/(\d+)\/([^"]+)"/);
    const teamId = teamLinkMatch ? teamLinkMatch[1] : null;
    const teamSlug = teamLinkMatch ? teamLinkMatch[2] : null;

    // Parser les stats (GP, W, T, L, OTW, OTL, GF, GA, +/-, TP, PPG)
    const stats = cleanCells.slice(2).map((s) => {
      if (s === '-' || s === '' || s === '\\-') return null;
      return s;
    });

    teams.push({
      rank,
      name: teamName,
      teamId,
      teamSlug,
      conf: currentConf,
      gp: parseInt(stats[0]) || 0,
      w: parseInt(stats[1]) || 0,
      t: parseInt(stats[2]) || 0,
      l: parseInt(stats[3]) || 0,
      otw: parseInt(stats[4]) || 0,
      otl: parseInt(stats[5]) || 0,
      gf: parseInt(stats[6]) || 0,
      ga: parseInt(stats[7]) || 0,
      plusMinus: parseInt(stats[8]) || 0,
      tp: parseInt(stats[9]) || 0,
      ppg: parseFloat(stats[10]) || 0,
    });
  }

  return teams;
}

async function scrapeLeague(league, season) {
  const url = `https://www.eliteprospects.com/league/${league.slug}/standings/${season}`;
  console.log(`[ep] Fetching ${league.name} from ${url}`);

  try {
    const html = await fetchPage(url);
    console.log(`[ep] ${league.name}: ${html.length} bytes`);

    const teams = parseStandings(html, league);
    console.log(`[ep] ${league.name}: parsed ${teams.length} teams`);

    return teams;
  } catch (err) {
    console.error(`[ep] ${league.name} error:`, err.message);
    return [];
  }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }));

  const season = args.season || '2026-2027';

  const results = {
    updatedAt: new Date().toISOString(),
    source: 'eliteprospects.com',
    season,
    leagues: {},
  };

  for (const league of LEAGUES) {
    const teams = await scrapeLeague(league, season);
    results.leagues[league.id] = {
      name: league.name,
      country: league.country,
      season,
      teams,
    };
    if (LEAGUES.indexOf(league) < LEAGUES.length - 1) {
      await sleep(2000); // rate limit
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`[ep] Saved to ${OUT}`);

  // Resume
  for (const [leagueId, leagueData] of Object.entries(results.leagues)) {
    console.log(`\n--- ${leagueData.name} (${leagueData.teams.length} teams) ---`);
    for (const t of leagueData.teams.slice(0, 5)) {
      console.log(`  ${String(t.rank).padStart(2)}. ${t.name.padEnd(30)} GP:${t.gp} TP:${t.tp} PPG:${t.ppg}`);
    }
    if (leagueData.teams.length > 5) {
      console.log(`  ... and ${leagueData.teams.length - 5} more`);
    }
  }
}

main();
