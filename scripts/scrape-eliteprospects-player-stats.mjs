/**
 * scrape-eliteprospects-player-stats.mjs
 * Scraper top joueurs (buteurs + assists) pour KHL, NHL, Ligue Magnus.
 * Cible : https://www.eliteprospects.com/league/{slug}/stats/{season}
 * Sortie : data/eliteprospects_player_stats.json
 * Usage : node scripts/scrape-eliteprospects-player-stats.mjs [--season=2026-2027]
 */
import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'eliteprospects_player_stats.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const LEAGUES = [
  { id: 'khl', name: 'KHL', slug: 'khl' },
  { id: 'nhl', name: 'NHL', slug: 'nhl' },
  { id: 'ligue-magnus', name: 'Ligue Magnus', slug: 'ligue-magnus' },
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

function parsePlayerStats(html) {
  const players = [];

  // Trouver le tableau principal
  const tableMatch = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return players;

  const tableHtml = tableMatch[1];
  const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];

  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 8) continue;

    const clean = cells.map((c) => c.replace(/<[^>]+>/g, '').trim());

    const rank = parseInt(clean[0]);
    if (isNaN(rank)) continue;

    // Extraire le nom du joueur depuis la cellule Player
    const playerCell = cells[1];
    const nameMatch = playerCell.match(/>([^<]+)\s*\(/);
    const posMatch = playerCell.match(/\(([^)]+)\)/);
    const linkMatch = playerCell.match(/href="[^"]*\/player\/(\d+)\/([^"]+)"/);

    const name = nameMatch ? nameMatch[1].trim() : clean[1].split('(')[0].trim();
    const position = posMatch ? posMatch[1] : '';
    const playerId = linkMatch ? linkMatch[1] : null;
    const playerSlug = linkMatch ? linkMatch[2] : null;

    // Extraire le drapeau pays
    const flagMatch = playerCell.match(/flags_s\/(\d+)\.png/);
    const flagId = flagMatch ? flagMatch[1] : null;

    // Extraire l'equipe
    const teamCell = cells[2];
    const teamMatch = teamCell.match(/>([^<]+)<\/a>/);
    const teamName = teamMatch ? teamMatch[1].trim() : clean[2];

    // Parser les stats
    const gp = parseInt(clean[3]) || 0;
    const g = parseInt(clean[4]) || 0;
    const a = parseInt(clean[5]) || 0;
    const tp = parseInt(clean[6]) || 0;
    const pgp = parseFloat(clean[7]) || 0;
    const pim = parseInt(clean[8]) || 0;
    const plusMinus = parseInt(clean[9]) || 0;

    // Ignorer les joueurs sans stats
    if (gp === 0 && g === 0 && a === 0 && tp === 0) continue;

    players.push({
      rank,
      name,
      position,
      playerId,
      playerSlug,
      flagId,
      photoUrl: null, // Rempli apres pour les top joueurs
      team: teamName,
      gp,
      g,
      a,
      tp,
      ppg: pgp,
      pim,
      plusMinus,
    });
  }

  return players;
}

async function scrapeLeague(league, season) {
  const url = `https://www.eliteprospects.com/league/${league.slug}/stats/${season}`;
  console.log(`[ep-stats] Fetching ${league.name} from ${url}`);

  try {
    const html = await fetchPage(url);
    console.log(`[ep-stats] ${league.name}: ${html.length} bytes`);

    const players = parsePlayerStats(html);
    console.log(`[ep-stats] ${league.name}: parsed ${players.length} players with stats`);

    // Top 10 buteurs (par G)
    const topScorers = [...players].sort((a, b) => b.g - a.g || b.a - a.a).slice(0, 10);
    // Top 10 assists (par A)
    const topAssists = [...players].sort((a, b) => b.a - a.a || b.g - a.g).slice(0, 10);
    // Top 10 points (par TP)
    const topPoints = [...players].sort((a, b) => b.tp - a.tp || b.g - a.g).slice(0, 10);

    // Fetcher les photos pour les top joueurs uniques
    const uniqueTop = new Map();
    for (const p of [...topScorers, ...topAssists, ...topPoints]) {
      if (p.playerId && !uniqueTop.has(p.playerId)) {
        uniqueTop.set(p.playerId, p);
      }
    }

    console.log(`[ep-stats] ${league.name}: fetching photos for ${uniqueTop.size} top players...`);
    for (const [id, player] of uniqueTop) {
      try {
        const photoUrl = await fetchPlayerPhoto(id, player.playerSlug);
        if (photoUrl) {
          player.photoUrl = photoUrl;
          console.log(`[ep-stats]   ✓ ${player.name}: ${photoUrl}`);
        }
        await sleep(500);
      } catch {
        // Photo indisponible, on continue
      }
    }

    return { players, topScorers, topAssists, topPoints };
  } catch (err) {
    console.error(`[ep-stats] ${league.name} error:`, err.message);
    return { players: [], topScorers: [], topAssists: [], topPoints: [] };
  }
}

async function fetchPlayerPhoto(playerId, playerSlug) {
  if (!playerId || !playerSlug) return null;
  const url = `https://www.eliteprospects.com/player/${playerId}/${playerSlug}`;
  const html = await fetchPage(url);

  // Chercher l'image du joueur (profil headshot)
  // Pattern: <img src="https://files.eliteprospects.com/layout/players/..." alt="...">
  const photoMatch = html.match(/src="(https:\/\/files\.eliteprospects\.com\/layout\/players\/[^"]+)"/);
  return photoMatch ? photoMatch[1] : null;
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
    const data = await scrapeLeague(league, season);
    results.leagues[league.id] = {
      name: league.name,
      season,
      ...data,
    };
    if (LEAGUES.indexOf(league) < LEAGUES.length - 1) {
      await sleep(2000);
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`[ep-stats] Saved to ${OUT}`);

  // Resume
  for (const [id, data] of Object.entries(results.leagues)) {
    console.log(`\n--- ${data.name} ---`);
    if (data.topScorers.length > 0) {
      console.log('  Top Scorers:');
      for (const p of data.topScorers.slice(0, 5)) {
        console.log(`    ${String(p.rank).padStart(2)}. ${p.name.padEnd(25)} ${p.team.padEnd(20)} G:${p.g} A:${p.a} TP:${p.tp}`);
      }
    } else {
      console.log('  No stats available (season not started)');
    }
  }
}

main();
