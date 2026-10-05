/**
 * scrape-annabet-hockey-prematch.mjs
 * Scraper les données prematch Annabet (h2h.php) pour NHL, KHL, Ligue Magnus.
 * Sources : ajax_upcoming.php (matchs à venir + IDs) → h2h.php (popup prematch)
 * Sortie : data/hockey_prematch_annabet.json (merge API prematch)
 * Usage : node scripts/scrape-annabet-hockey-prematch.mjs [--league=khl] [--dry-run]
 */
import http from 'node:http';
import https from 'node:https';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'hockey_prematch_annabet.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const FLARE_HOST = process.env.FLARE_HOST || 'localhost';
const FLARE_PORT = process.env.FLARE_PORT || '8191';
const HTTP_TIMEOUT = 30000;

/**
 * Delai minimum entre deux requetes Annabet, et son plafond de backoff.
 *
 * Mesure : le 2026-10-05, `ajax_upcoming` KHL a repondu 200 en 332 ms puis, apres
 * ~28 requetes en rafale (1 upcoming + 9 h2h + 3 retries par echec), TOUTES les
 * requetes suivantes ont repondu ECONNREFUSED. Le ban existe deja dans ce fichier
 * (« Annabet ban apres ~3 requetes rapides ») mais n'etait applique que comme un
 * `sleep(3000)` fixe, qui ne resiste pas aux retries.
 */
const REQUEST_DELAY_MS = 8000;
const BACKOFF_BASE_MS = 10000;
const BACKOFF_MAX_MS = 90000;

/** Cache disque des pages h2h : evite de reinterroger les memes paires a chaque run. */
const CACHE_DIR = join(ROOT, 'data', 'hockey-h2h-cache');
const CACHE_TTL_MS = 20 * 60 * 60 * 1000;

/**
 * Classe une erreur reseau pour decider quoi faire — et surtout distinguer un
 * BAN du site d'une panne locale.
 *
 * `ECONNREFUSED` est ambigu : c'est aussi ce que rend FlareSolverr quand il
 * n'ecoute pas en local. D'ou la regle : cette fonction ne s'applique QU'AUX
 * erreurs de `fetchDirect` (le site). Les erreurs de FlareSolverr sont locais et
 * se traitent en amont.
 */
function classifyError(err) {
  const code = err && err.code;
  const msg = String(err && err.message || '');

  if (code === 'BAN' || code === 'RATE') return 'ban';
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'ETIMEDOUT') return 'ban';
  if (/HTTP 403|HTTP 429|HTTP 401/.test(msg)) return 'ban';
  if (/timeout/.test(msg)) return 'transient';
  if (code === 'ECONNABORTED' || code === 'EAI_AGAIN') return 'transient';
  return 'fatal';
}

/** Erreur de ban : signalee pour interrompre toute la chaine, pas pour retry. */
class BanError extends Error {
  constructor(detail) {
    super(`Annabet bloque l'IP (${detail}) — chaine interrompue`);
    this.name = 'BanError';
    this.isBan = true;
  }
}

/** Backoff exponentiel avec jitter : evite que 2 workers se synchronisent. */
function backoffDelay(attempt) {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_MAX_MS);
  return base + Math.floor(Math.random() * 3000);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Derniere requete horodatee, pour garantir l'intervalle minimal. */
let lastRequestAt = 0;
async function respectDelay() {
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

// ─── Cache disque h2h ───────────────────────────────────────────────────────

function cachePath(team1Id, team2Id) {
  // La paire est ordonnee : h2h?team1=155&team2=175 === h2h?team1=175&team2=155
  const [a, b] = [Number(team1Id), Number(team2Id)].sort((x, y) => x - y);
  return join(CACHE_DIR, `${a}-${b}.json`);
}

function readCache(team1Id, team2Id) {
  const p = cachePath(team1Id, team2Id);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, 'utf-8'));
    if (!j || typeof j.html !== 'string' || !j.fetchedAt) return null;
    if (Date.now() - j.fetchedAt > CACHE_TTL_MS) return null;
    return j;
  } catch {
    return null; // cache corrompu → on refetch, pas de crash
  }
}

function writeCache(team1Id, team2Id, html) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath(team1Id, team2Id), JSON.stringify({ fetchedAt: Date.now(), html }));
  } catch (e) {
    // Le cache est une optimisation : son echec ne doit pas tuer le scrape.
    console.warn(`[prematch] cache ecrit impossible (${e.message}) — scrape continue`);
  }
}

const LEAGUES = [
  { id: 'nhl', name: 'NHL', serieId: 6 },
  { id: 'khl', name: 'KHL', serieId: 13 },
  { id: 'magnus', name: 'Ligue Magnus', serieId: 40 },
];

function flareSolverrGet(url) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ cmd: 'request.get', url, maxTimeout: HTTP_TIMEOUT });
    const opts = {
      hostname: FLARE_HOST, port: parseInt(FLARE_PORT, 10), path: '/v1', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: HTTP_TIMEOUT + 10000,
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (json.status === 'ok' && json.solution?.response) resolve(json.solution.response);
          else reject(new Error(`FlareSolverr: ${json.message || 'status ' + json.status}`));
        } catch (e) { reject(new Error(`FlareSolverr parse: ${e.message}`)); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`FlareSolverr timeout ${url}`)); });
    req.write(body); req.end();
  });
}

function fetchPage(url) {
  // FlareSolverr d'abord (VPS derrière Cloudflare). En local il n'écoute pas :
  // son ECONNREFUSED est LOCAL, donc on l'ignore sans le confondre avec un ban.
  return flareSolverrGet(url)
    .then((r) => (typeof r === 'string' ? r : fetchDirect(url)))
    .catch(() => fetchDirect(url));
}

function fetchDirect(url) {
  return new Promise((resolve, reject) => {
    respectDelay().then(() => {
      const req = https.get(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 25000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://annabet.com' + res.headers.location;
          return resolve(fetchDirect(loc));
        }
        if (res.statusCode !== 200) {
          res.resume();
          const err = new Error('HTTP ' + res.statusCode + ' ' + url);
          // `code` rend la classification fiable (pas de parsing de message).
          if (res.statusCode === 403 || res.statusCode === 429 || res.statusCode === 401) err.code = 'BAN';
          reject(err);
          return;
        }
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout ' + url)); });
      req.on('error', reject);
    });
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

  // Each line = 2 consecutive rows: perc row + odds row
  let i = 0;
  while (i < rows.length) {
    const percRow = rows[i];
    const lineMatch = percRow.match(/<span class="blue">([\d.]+)<\/span>\s*goals\s*avg\s*<b>(\d+)%-(\d+)%<\/b>\s*([\d.]+)-([\d.]+)/);
    if (lineMatch) {
      // Parse 7 columns from perc row
      const percCols = [...percRow.matchAll(/<td class="(?:perc|hdr)">(.*?)<\/td>/g)].map((m) => m[1].trim());
      
      const line = parseFloat(lineMatch[1]);
      const underPct = parseInt(lineMatch[2]);
      const overPct = parseInt(lineMatch[3]);
      const underOdds = parseFloat(lineMatch[4]);
      const overOdds = parseFloat(lineMatch[5]);

      // Parse odds row if exists
      let underOddsHome = null, underOddsAway = null, underOddsAll = null;
      let overOddsHome = null, overOddsAway = null, overOddsAll = null;
      if (i + 1 < rows.length) {
        const oddsRow = rows[i + 1];
        const oddsCols = [...oddsRow.matchAll(/<td class="odds">(.*?)<\/td>/g)].map((m) => m[1].trim());
        // Odds cols: [underH, underA, underAll, empty, overH, overA, overAll]
        if (oddsCols.length >= 7) {
          const parseOdds = (s) => { const n = parseFloat(s); return isNaN(n) ? null : n; };
          underOddsHome = parseOdds(oddsCols[0]);
          underOddsAway = parseOdds(oddsCols[1]);
          underOddsAll = parseOdds(oddsCols[2]);
          overOddsHome = parseOdds(oddsCols[4]);
          overOddsAway = parseOdds(oddsCols[5]);
          overOddsAll = parseOdds(oddsCols[6]);
        }
      }

      // Build home/away/all percentages from percCols
      // percCols: [homeUnder, awayUnder, allUnder, lineCell, homeOver, awayOver, allOver]
      const parsePerc = (s) => { const m = s.match(/(\d+)-(\d+)/); return m ? { under: parseInt(m[1]), over: parseInt(m[2]) } : null; };
      
      const homeUnderPct = percCols[0] ? parsePerc(percCols[0]) : null;
      const awayUnderPct = percCols[1] ? parsePerc(percCols[1]) : null;
      const allUnderPct = percCols[2] ? parsePerc(percCols[2]) : null;
      const homeOverPct = percCols[4] ? parsePerc(percCols[4]) : null;
      const awayOverPct = percCols[5] ? parsePerc(percCols[5]) : null;
      const allOverPct = percCols[6] ? parsePerc(percCols[6]) : null;

      result.overUnderLines.push({
        line,
        underPct,
        overPct,
        underOdds,
        overOdds,
        underOddsHome,
        underOddsAway,
        underOddsAll,
        overOddsHome,
        overOddsAway,
        overOddsAll,
        homeUnderPct,
        awayUnderPct,
        allUnderPct,
        homeOverPct,
        awayOverPct,
        allOverPct,
      });
    }
    i += 2; // Skip to next line (2 rows per line)
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
    const kind = classifyError(err);
    // Même traitement que le h2h : un ban ici doit remonter et interrompre la
    // chaîne. Sans cela le run sollicitait les 3 ligues alors que l'IP était
    // déjà coupée — mesuré : 3 requêtes, 87 s, pour rien.
    if (kind === 'ban') throw new BanError(err.message.slice(0, 80));
    console.error(`[prematch] Upcoming fetch ${kind}:`, err.message);
    return { matches: [], error: `${kind}: ${err.message}` };
  }

  const upcoming = parseUpcoming(upcomingHtml);
  console.log(`[prematch] Found ${upcoming.length} upcoming matches`);

  if (dryRun) {
    console.log('[prematch] Dry run — returning upcoming only');
    return { matches: upcoming.map((m) => ({ ...m, h2h: null })) };
  }

  // 2. Fetch H2H for each match (backoff exponentiel + cache disque)
  const results = [];
  let caches = 0;
  for (const match of upcoming) {
    const h2hUrl = `https://annabet.com/en/hockeystats/h2h.php?team1=${match.team1Id}&team2=${match.team2Id}`;

    // Le cache évite de reinterroger une paire déjà connue : c'est le levier le
    // plus efficace contre le ban, puisqu'il réduit le nombre de requêtes.
    const cached = readCache(match.team1Id, match.team2Id);
    if (cached) {
      const h2h = parseH2H(cached.html);
      const summary = extractSummaryTable(cached.html);
      results.push({ ...match, h2h, summary, fromCache: true });
      caches++;
      console.log(`[prematch] ${match.team1Name} vs ${match.team2Name} — CACHE (${h2h.standings.length} standings)`);
      continue;
    }

    console.log(`[prematch] ${match.team1Name} vs ${match.team2Name} → ${h2hUrl}`);

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const h2hHtml = await fetchPage(h2hUrl);
        writeCache(match.team1Id, match.team2Id, h2hHtml);
        const h2h = parseH2H(h2hHtml);
        const summary = extractSummaryTable(h2hHtml);
        results.push({ ...match, h2h, summary });
        console.log(`[prematch] OK — ${h2h.summaryHome ? 'has' : 'no'} home stats, ${h2h.standings.length} standings`);
        lastErr = null;
        break;
      } catch (err) {
        const kind = classifyError(err);
        lastErr = err;

        // Ban = l'IP est coupée. Tout retry ne ferait qu'aggraver : on remonte
        // l'erreur pour interrompre TOUTE la chaîne, ligues suivantes comprises.
        if (kind === 'ban') {
          throw new BanError(err.message.slice(0, 80));
        }

        console.error(`[prematch] H2H ${kind} attempt ${attempt}/3 for ${match.team1Name} vs ${match.team2Name}:`, err.message);
        if (attempt < 3) {
          const wait = backoffDelay(attempt);
          console.log(`[prematch] Backoff ${Math.round(wait / 1000)}s`);
          await sleep(wait);
        }
      }
    }
    if (lastErr) {
      results.push({ ...match, h2h: null, error: lastErr.message });
    }
  }

  if (caches) console.log(`[prematch] ${caches} match(s) servis depuis le cache`);

  return { matches: results };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }));

  const dryRun = args['dry-run'] === true;
  const leagueFilter = args.league;

  // Merge avec le fichier existant pour ne pas écraser les autres ligues
  const output = {
    updatedAt: new Date().toISOString(),
    source: 'annabet.com',
    leagues: {},
  };
  try {
    if (existsSync(OUT)) {
      const prev = JSON.parse(readFileSync(OUT, 'utf-8'));
      if (prev && typeof prev === 'object' && prev.leagues) {
        output.leagues = { ...prev.leagues };
      }
    }
  } catch {
    // fichier corrompu → repart de zéro
  }

  for (const league of LEAGUES) {
    if (leagueFilter && league.id !== leagueFilter) continue;
    try {
      output.leagues[league.id] = await scrapeLeague(league, dryRun);
    } catch (err) {
      if (!err.isBan) throw err;
      // Ban : on interrompt TOUTE la chaîne. Interroger la ligue suivante
      // n'aggraverait que le blocage, et les 3 ligues partagent la même IP.
      console.error(`\n[prematch] ⛔ ${err.message}`);
      console.error(`[prematch] Interrupt sur ${league.name} — ligues restantes non sollicitées.`);
      output.banned = { league: league.id, at: new Date().toISOString(), reason: err.message };
      // La ligue fautive ET les suivantes n'ont pas été scrapées. On écrase
      // l'erreur issue du merge : sans ça, le payload affichait l'erreur
      // PÉRIMÉE du run précédent (mesuré : « ECONNREFUSED » sur les 3 ligues
      // alors qu'une seule avait été contactée) — une trace qui mentait sur ce
      // qui a réellement été tenté.
      const reste = LEAGUES.slice(LEAGUES.indexOf(league));
      for (const l of reste) {
        output.leagues[l.id] = {
          matches: [],
          error: l.id === league.id
            ? `IP bloquée par Annabet — ${err.message}`
            : 'non sollicité — IP déjà bloquée par Annabet',
        };
      }
      break;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // Toujours writer les 3 clés même si absentes du merge (évite UI vide)
  for (const l of LEAGUES) {
    if (!output.leagues[l.id]) {
      output.leagues[l.id] = { matches: [], error: output.banned ? 'non sollicité — IP bloquée par Annabet' : 'non scrape' };
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\n[prematch] Saved to ${OUT}`);

  // Resume
  for (const [id, data] of Object.entries(output.leagues)) {
    console.log(`\n--- ${id} ---`);
    console.log(`  Matches: ${data.matches.length}${data.error ? `  (${data.error})` : ''}`);
    const caches = data.matches.filter((m) => m.fromCache).length;
    if (caches) console.log(`  dont ${caches} depuis le cache`);
    for (const m of data.matches.slice(0, 3)) {
      const status = m.h2h ? `OK (${m.h2h.standings.length} standings${m.fromCache ? ', cache' : ''})` : m.error || 'no data';
      console.log(`  ${m.team1Name} vs ${m.team2Name}: ${status}`);
    }
  }
}

main();
