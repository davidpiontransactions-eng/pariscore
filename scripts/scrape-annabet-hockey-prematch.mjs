/**
 * scrape-annabet-hockey-prematch.mjs
 * Scraper les données prematch Annabet (h2h.php) pour NHL, KHL, Ligue Magnus.
 * Sources : ajax_upcoming.php (matchs à venir + IDs) → h2h.php (popup prematch)
 * Sortie : data/annabet_hockey_prematch.json
 * Usage : node scripts/scrape-annabet-hockey-prematch.mjs [--league=khl] [--dry-run]
 */
import https from 'node:https';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'annabet_hockey_prematch.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const LEAGUES = [
  { id: 'nhl', name: 'NHL', serieId: 6 },
  { id: 'khl', name: 'KHL', serieId: 13 },
  { id: 'magnus', name: 'Ligue Magnus', serieId: 40 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROXY_URL = process.env.SCRAPLING_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

function fetchPage(url) {
  // Si proxy configuré, utiliser via proxy HTTP(S)
  if (PROXY_URL) {
    return fetchViaProxy(url, PROXY_URL);
  }
  return fetchDirect(url);
}

function fetchDirect(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://annabet.com' + res.headers.location;
        return resolve(fetchDirect(loc));
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

function fetchViaProxy(url, proxyUrl) {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyUrl);
    const target = new URL(url);

    const req = https.request({
      hostname: proxy.hostname,
      port: proxy.port || 443,
      path: url,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        Host: target.hostname,
      },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://annabet.com' + res.headers.location;
        return resolve(fetchPage(loc));
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode + ' via proxy')); return; }
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('proxy timeout ' + url)); });
    req.on('error', reject);
    req.end();
  });
}

// ─── Parse upcoming matches from AJAX HTML ──────────────────────────────────

function parseUpcoming(html) {
  const matches = [];
  const seen = new Set();

  // 1. Extraire tous les IDs uniques depuis les liens h2h.php
  const idRegex = /team1=(\d+)&(?:amp;)?team2=(\d+)/g;
  let m;
  while ((m = idRegex.exec(html)) !== null) {
    const key = `${m[1]}-${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Extraire les noms des teams depuis le contexte autour du lien
    // Le premier nom est après le 2e lien, le 2e nom est dans le 3e <a>
    const linkPos = m.index;
    const chunk = html.substring(linkPos, linkPos + 500);

    // Trouver les noms: pattern "Team1Name</a></td><td> - </td><td...>Team2Name</a>"
    const nameMatch = chunk.match(/>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>\s*-\s*<\/td>\s*<td[^>]*><a[^>]*>([^<]+)<\/a>/);
    const team1Name = nameMatch ? nameMatch[1].trim() : `Team ${m[1]}`;
    const team2Name = nameMatch ? nameMatch[2].trim() : `Team ${m[2]}`;

    // Extraire les odds (1X2) - 3 cellules apres le 3e lien
    const oddsMatch = chunk.match(/align="center">([\d.]+)/g);
    const odds = oddsMatch ? oddsMatch.map((o) => parseFloat(o.replace(/[^0-9.]/g, ''))) : [];

    matches.push({
      team1Id: parseInt(m[1]),
      team1Name,
      team2Id: parseInt(m[2]),
      team2Name,
      odds1X2: odds.length >= 3 ? { home: odds[0], draw: odds[1], away: odds[2] } : null,
    });
  }
  return matches;
}

// ─── Parse H2H prematch page ────────────────────────────────────────────────

function parseH2H(html) {
  const result = {
    homeTeam: '',
    awayTeam: '',
    date: '',
    h2hStats: null,
    summaryHome: null,
    summaryAway: null,
    standings: [],
  };

  // Title: "Team1 - Team2, League DD.MM.YYYY"
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    const parts = titleMatch[1].split(',');
    if (parts.length >= 2) {
      const teams = parts[0].trim().split(' - ');
      result.homeTeam = teams[0]?.trim() || '';
      result.awayTeam = teams[1]?.trim() || '';
      const datePart = parts[parts.length - 1].trim();
      result.date = datePart.replace(/^.*?(\d{2}\.\d{2}\.\d{4}).*$/, '$1');
    }
  }

  // Extraire les 4 blocs de stats (home last 30, away last 30, h2h all, h2h home/away)
  // Chaque bloc a: 1x2, 12, Total Goals, Goals For/Against, BTTS, Goal Difference, Goal Average
  const blocks = extractStatBlocks(html);
  if (blocks.length >= 2) {
    result.summaryHome = blocks[0]; // Home team last 30
    result.summaryAway = blocks[1]; // Away team last 30
  }
  if (blocks.length >= 3) {
    result.h2hStats = blocks[2]; // H2H all games
  }

  // Standings table (nicelight)
  result.standings = extractStandings(html);

  return result;
}

function extractStatBlocks(html) {
  const blocks = [];
  // Trouver tous les tableaux avec "1x2" rows
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    if (!tableHtml.includes('1x2') || !tableHtml.includes('csgoal')) continue;

    const block = {};

    // 1x2: "3 - 3 - 4" pattern with bullets
    const oneXtwoMatch = tableHtml.match(/<span class="small">1x2<\/span>[\s\S]*?<b>(\d+)\s*-\s*(\d+)<\/b>[\s\S]*?<span class="grey small">(\d+\.?\d*)%\s*-\s*(\d+\.?\d*)%\s*-\s*(\d+\.?\d*)%<\/span>[\s\S]*?<span class="grey small">([\d.]+)\s*-\s*([\d.]+)\s*-\s*([\d.]+)<\/span>/);
    if (oneXtwoMatch) {
      block.oneXtwo = {
        homeWins: parseInt(oneXtwoMatch[1]),
        draws: parseInt(oneXtwoMatch[2]),
        awayWins: parseInt(oneXtwoMatch[3]),
        pcts: [parseFloat(oneXtwoMatch[4]), parseFloat(oneXtwoMatch[5]), parseFloat(oneXtwoMatch[6])],
        odds: [parseFloat(oneXtwoMatch[7]), parseFloat(oneXtwoMatch[8]), parseFloat(oneXtwoMatch[9])],
      };
    }

    // 12 (home/away without draw)
    const twelveMatch = tableHtml.match(/<span class="small">12<\/span>[\s\S]*?<b>(\d+)\s*-\s*(\d+)<\/b>[\s\S]*?<span class="grey small">(\d+\.?\d*)%\s*-\s*(\d+\.?\d*)%<\/span>[\s\S]*?<span class="grey small">([\d.]+)\s*-\s*([\d.]+)<\/span>/);
    if (twelveMatch) {
      block.oneTwo = {
        homeWins: parseInt(twelveMatch[1]),
        awayWins: parseInt(twelveMatch[2]),
        pcts: [parseFloat(twelveMatch[3]), parseFloat(twelveMatch[4])],
        odds: [parseFloat(twelveMatch[5]), parseFloat(twelveMatch[6])],
      };
    }

    // Total Goals Under/Over
    const totalMatch = tableHtml.match(/Total Goals Under - Over <span class="blue">([\d.]+)<\/span>\s*:\s*(\d+)%\s*-\s*(\d+)%/);
    if (totalMatch) {
      block.totalGoals = {
        line: parseFloat(totalMatch[1]),
        underPct: parseInt(totalMatch[2]),
        overPct: parseInt(totalMatch[3]),
      };
    }

    // Goals For distribution (0-6+)
    const gfPcts = [];
    const gfRegex = /<span class="small">(\d+)%<\/span>[\s\S]*?<img[^>]*greybox[^>]*>[\s\S]*?<span class="csgoal">(\d+)\+?&nbsp;/g;
    let gfMatch;
    const gfSection = tableHtml.split('Goals For')[1]?.split('Goals Against')[0] || '';
    while ((gfMatch = gfRegex.exec(gfSection)) !== null) {
      gfPcts.push({ goals: parseInt(gfMatch[2]), pct: parseInt(gfMatch[1]) });
    }

    // Goals Against distribution
    const gaPcts = [];
    const gaSection = tableHtml.split('Goals Against')[1]?.split('Both Teams')[0] || '';
    const gaRegex = /<span class="csgoal">(\d+)\+?&nbsp;[\s\S]*?<img[^>]*greybox[^>]*>[\s\S]*?<span class="small">(\d+)%<\/span>/g;
    let gaMatch;
    while ((gaMatch = gaRegex.exec(gaSection)) !== null) {
      gaPcts.push({ goals: parseInt(gaMatch[1]), pct: parseInt(gaMatch[2]) });
    }

    if (gfPcts.length > 0) block.goalsFor = gfPcts;
    if (gaPcts.length > 0) block.goalsAgainst = gaPcts;

    // Both Teams To Score
    const bttsMatch = tableHtml.match(/Both Teams To Score:\s*(\d+)%/);
    if (bttsMatch) {
      block.btts = parseInt(bttsMatch[1]);
    }

    // Goal Difference distribution
    const gdPcts = [];
    const gdSection = tableHtml.split('Goal difference')[1]?.split('Regulation')[0] || '';
    const gdRegex = /<span class="csgoal">\s*([+-]?\d+)\s*[\s\S]*?<span class="small">(\d+)%<\/span>/g;
    let gdMatch;
    while ((gdMatch = gdRegex.exec(gdSection)) !== null) {
      gdPcts.push({ diff: parseInt(gdMatch[1]), pct: parseInt(gdMatch[2]) });
    }
    if (gdPcts.length > 0) block.goalDiff = gdPcts;

    // Goal Average
    const gaAvgMatch = tableHtml.match(/Goal Average <span class="blue">([\d.]+)\s*-\s*([\d.]+)\s*\(([\d.]+)\)<\/span>/);
    if (gaAvgMatch) {
      block.goalAverage = {
        home: parseFloat(gaAvgMatch[1]),
        away: parseFloat(gaAvgMatch[2]),
        total: parseFloat(gaAvgMatch[3]),
      };
    }

    if (Object.keys(block).length > 0) blocks.push(block);
  }
  return blocks;
}

function extractStandings(html) {
  const teams = [];
  // Trouver la table nicelight
  const tableMatch = html.match(/<table class="nicelight">([\s\S]*?)<\/table>/);
  if (!tableMatch) return teams;

  const tableHtml = tableMatch[1];
  const rows = tableHtml.match(/<tr(?: class="hl")?>([\s\S]*?)<\/tr>/g) || [];

  for (const row of rows) {
    // Skip header rows
    if (row.includes('class="title"')) continue;
    if (row.includes('All Games')) continue;

    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 8) continue;

    const clean = cells.map((c) => c.replace(/<[^>]+>/g, '').trim());
    const rank = parseInt(clean[0]);
    if (isNaN(rank)) continue;

    const isHighlighted = row.includes('class="hl"');

    teams.push({
      rank,
      name: clean[1],
      gp: parseInt(clean[2]) || 0,
      all: {
        w: parseInt(clean[3]) || 0,
        otw: parseInt(clean[4]) || 0,
        otl: parseInt(clean[5]) || 0,
        l: parseInt(clean[6]) || 0,
        pts: parseInt(clean[7]) || 0,
      },
      home: {
        w: parseInt(clean[9]) || 0,
        otw: parseInt(clean[10]) || 0,
        otl: parseInt(clean[11]) || 0,
        l: parseInt(clean[12]) || 0,
        pts: parseInt(clean[13]) || 0,
      },
      away: {
        w: parseInt(clean[15]) || 0,
        otw: parseInt(clean[16]) || 0,
        otl: parseInt(clean[17]) || 0,
        l: parseInt(clean[18]) || 0,
        pts: parseInt(clean[19]) || 0,
      },
      highlighted: isHighlighted,
    });
  }
  return teams;
}

// ─── Summary table (home/away/all percentages) ─────────────────────────────

function extractSummaryTable(html) {
  const summaryMatch = html.match(/<table width="90%" class="summarytbl">([\s\S]*?)<\/table>/);
  if (!summaryMatch) return null;

  const tableHtml = summaryMatch[1];
  const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];

  const result = { overUnderLines: [] };

  for (const row of rows) {
    // Total Goals Under-Over lines
    const lineMatch = row.match(/<span class="blue">([\d.]+)<\/span>\s*goals\s*avg\s*<b>(\d+)%-(\d+)%<\/b>\s*([\d.]+)-([\d.]+)/);
    if (lineMatch) {
      result.overUnderLines.push({
        line: parseFloat(lineMatch[1]),
        underPct: parseInt(lineMatch[2]),
        overPct: parseInt(lineMatch[3]),
        underOdds: parseFloat(lineMatch[4]),
        overOdds: parseFloat(lineMatch[5]),
      });
    }
  }

  return result;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function scrapeLeague(league, dryRun) {
  console.log(`\n=== ${league.name} (serie ${league.serieId}) ===`);

  // 1. Fetch upcoming matches
  const upcomingUrl = `https://annabet.com/en/statistics/ajax_upcoming.php?_language=en&compare=Compare&serie=i%3A${league.serieId}%3B&hockeystats`;
  console.log(`[prematch] Fetching upcoming from ${upcomingUrl}`);

  let upcomingHtml;
  try {
    upcomingHtml = await fetchPage(upcomingUrl);
  } catch (err) {
    console.error(`[prematch] Upcoming fetch error:`, err.message);
    return { matches: [], error: err.message };
  }

  const upcoming = parseUpcoming(upcomingHtml);
  console.log(`[prematch] Found ${upcoming.length} upcoming matches`);

  if (dryRun) {
    console.log('[prematch] Dry run — returning upcoming only');
    return { matches: upcoming.map((m) => ({ ...m, h2h: null })) };
  }

  // 2. Fetch H2H for each match (avec retry)
  const results = [];
  for (const match of upcoming) {
    const h2hUrl = `https://annabet.com/en/hockeystats/h2h.php?team1=${match.team1Id}&team2=${match.team2Id}`;
    console.log(`[prematch] ${match.team1Name} vs ${match.team2Name} → ${h2hUrl}`);

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const h2hHtml = await fetchPage(h2hUrl);
        const h2h = parseH2H(h2hHtml);
        const summary = extractSummaryTable(h2hHtml);
        results.push({ ...match, h2h, summary });
        console.log(`[prematch] OK — ${h2h.summaryHome ? 'has' : 'no'} home stats, ${h2h.standings.length} standings`);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.error(`[prematch] H2H attempt ${attempt}/3 error for ${match.team1Name} vs ${match.team2Name}:`, err.message);
        if (attempt < 3) {
          const backoff = attempt * 5000; // 5s, 10s
          console.log(`[prematch] Retrying in ${backoff / 1000}s...`);
          await sleep(backoff);
        }
      }
    }
    if (lastErr) {
      results.push({ ...match, h2h: null, error: lastErr.message });
    }

    await sleep(3000); // Rate limit — Annabet ban apres ~3 requêtes rapides
  }

  return { matches: results };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }));

  const dryRun = args['dry-run'] === true;
  const leagueFilter = args.league;

  const output = {
    updatedAt: new Date().toISOString(),
    source: 'annabet.com',
    leagues: {},
  };

  for (const league of LEAGUES) {
    if (leagueFilter && league.id !== leagueFilter) continue;
    output.leagues[league.id] = await scrapeLeague(league, dryRun);
    await sleep(2000);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\n[prematch] Saved to ${OUT}`);

  // Resume
  for (const [id, data] of Object.entries(output.leagues)) {
    console.log(`\n--- ${id} ---`);
    console.log(`  Matches: ${data.matches.length}`);
    for (const m of data.matches.slice(0, 3)) {
      const status = m.h2h ? `OK (${m.h2h.standings.length} standings)` : m.error || 'no data';
      console.log(`  ${m.team1Name} vs ${m.team2Name}: ${status}`);
    }
  }
}

main();
