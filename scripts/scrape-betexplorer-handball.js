#!/usr/bin/env node
'use strict';
/**
 * scrape-betexplorer-handball.js
 * ------------------------------
 * Scores mi-temps + H2H/forme handball depuis BetExplorer (Livesport/OddsPortal).
 *
 * Sources (100% gratuites, HTML public) :
 *   GET /handball/results/?year&month&day   → résultats récents + partials (MT)
 *   GET /handball/<c>/<l>/                  → « Next matches » (fixtures)
 *   GET /handball/<c>/<l>/results/          → résultats de la ligue (sans partial)
 *   GET /handball/<c>/<l>/<slug>/<ID>/      → page match : score, js-partial, token H2H
 *   GET /gres/ajax/mutual-matches.php?par=  → tableau H2H (token injecté par la page match)
 *
 * Format mi-temps BetExplorer — VÉRIFIÉ empiriquement (2026-09-24) :
 *   « 28:29 (14:14, 14:15) » = (1re mi-temps, 2e mi-temps) et NON score cumulé :
 *   14+14=28, 14+15=29 ✓ — confirmé sur Alpla Hard 34:27 (17:16, 17:11) et
 *   Stuttgart-Erlangen 22:17 (7:9, 15:8) (7+15=22, 9+8=17 ✓).
 *   Un 3e bloc = prolongation (ex. « 30:38 (13:11, 16:18, 1:9) ») → ignoré.
 *   Le score MT = PREMIER bloc de la parenthèse.
 *
 * Sortie : data/betexplorer_handball.json
 *   { scraped_at, source, leagues:[{slug,name,matches:[{home,away,league,date,
 *     status:"FT"|"NS",score,halftime,url}]}], recent:[...pool global FT avec MT],
 *     h2h:[{home,away,meeting_date,league,score,halftime,url}] }
 *
 * Usage :
 *   node scripts/scrape-betexplorer-handball.js --dry-run
 *   node scripts/scrape-betexplorer-handball.js --league=germany/bundesliga --limit=3
 *   node scripts/scrape-betexplorer-handball.js --days=3 --limit=6 --write
 *
 *   --dry-run     parse + résumé console, n'écrit PAS le JSON (défaut : écrit)
 *   --write       force l'écriture (sinon écriture par défaut hors dry-run)
 *   --league=X    restreint aux ligues cibles (slug « country/ligue » ou « country-ligue »)
 *   --limit=N     nb max de matchs upcoming à enrichir en H2H (défaut 4)
 *   --days=N      nb de pages /handball/results/ (3 jours/page, défaut 7 →
 *                 21 jours d'historique, nécessaires pour croiser les MT
 *                 des ligues cibles : domestiques J-4 (week-end) et EHF CL
 *                 J-7 (mercredi). Clamp max 8 (budget 30 pages/run).
 *   --no-h2h      n'enrichit pas les H2H (fixture/results seuls)
 *
 * Vecteur réseau : fetch direct https (UA Chrome) — OK depuis la locale (probe
 * 2026-09-24, HTTP 200 sans challenge CF). Fallback FlareSolverr (VPS) :
 *   FLARE_URL=http://51.75.21.239:8191/v1 node scripts/scrape-betexplorer-handball.js
 *   (POST {"cmd":"request.get",...} → JSON .solution.response = HTML).
 *
 * Rate-limit : 1 requête / 1.5 s, budget 30 pages/run (au-delà : on livre
 * ce qui a été scrapé, sans erreur fatale).
 * Aucune dépendance npm (node:https natif, comme les autres scrapers).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE = 'https://www.betexplorer.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DELAY_MS = 1500;
const MAX_PAGES = 30;
const HTTP_TIMEOUT_MS = 25000;
const FLARE_TIMEOUT_MS = 80000;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_OUT = path.join(REPO_DIR, 'data', 'betexplorer_handball.json');
const SNAPSHOT_FILE = path.join(REPO_DIR, 'data', 'flashscore_handball.json');

/** Ligues cibles (slugs BetExplorer) — liste en dur configurable. */
const TARGET_LEAGUES = [
  { slug: 'germany/bundesliga', label: 'Germany: Bundesliga' },
  { slug: 'france/starligue', label: 'France: Starligue' },
  { slug: 'spain/liga-asobal', label: 'Spain: Liga ASOBAL' },
  { slug: 'europe/champions-league', label: 'Europe: Champions League' },
];

// ─── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    dryRun: false,
    write: false,
    h2h: true,
    league: null,
    limit: 4,
    days: 7,
    out: DEFAULT_OUT,
  };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--write') args.write = true;
    else if (a === '--no-h2h') args.h2h = false;
    else if (a.startsWith('--league=')) args.league = a.slice('--league='.length);
    else if (a.startsWith('--limit=')) args.limit = Math.max(0, parseInt(a.slice(8), 10) || 0);
    else if (a.startsWith('--days=')) args.days = Math.min(8, Math.max(1, parseInt(a.slice(7), 10) || 7));
    else if (a.startsWith('--out=')) args.out = a.slice(6);
  }
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── HTTP ────────────────────────────────────────────────────────────────────
const state = { pages: 0, budgetHit: false };

function requestDirect(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: HTTP_TIMEOUT_MS,
      },
      (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, u).toString();
          return resolve(requestDirect(next, redirectsLeft - 1));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          if (code !== 200) {
            reject(new Error(`HTTP ${code} pour ${url}`));
            return;
          }
          if (/just a moment|cf-browser-verification|challenge-platform/i.test(body.slice(0, 8000))) {
            reject(new Error(`Challenge Cloudflare sur ${url} — utiliser FLARE_URL`));
            return;
          }
          resolve(body);
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`timeout ${url}`)));
    req.on('error', reject);
    req.end();
  });
}

/** Fallback FlareSolverr (VPS) : POST /v1 → .solution.response = HTML. */
function requestFlare(url) {
  const flare = process.env.FLARE_URL;
  const u = new URL(flare);
  const payload = JSON.stringify({ cmd: 'request.get', url, maxTimeout: FLARE_TIMEOUT_MS });
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: FLARE_TIMEOUT_MS + 5000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            if (j.status !== 'success' || !j.solution || typeof j.solution.response !== 'string') {
              reject(new Error(`FlareSolverr échec pour ${url} : ${j.status || 'inconnu'}`));
              return;
            }
            resolve(j.solution.response);
          } catch (e) {
            reject(new Error(`FlareSolverr réponse illisible (${e.message})`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`timeout flare ${url}`)));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** GET avec rate-limit 1.5 s et budget 30 pages (au-delà → null, sans throw). */
async function fetchHtml(url) {
  if (state.pages >= MAX_PAGES) {
    state.budgetHit = true;
    return null;
  }
  await sleep(DELAY_MS);
  state.pages += 1;
  try {
    const html = process.env.FLARE_URL ? await requestFlare(url) : await requestDirect(url);
    return normalizeAttrQuotes(html);
  } catch (e) {
    console.error(`  ! ${e.message}`);
    return null;
  }
}

// ─── Parsers (tolérants guillemets simples/doubles — HTML Livesport) ─────────
/**
 * Livesport alterne ' et " selon la version de cache du CDN : on force les
 * doubles sur les attributs simples sans quote interne. Les valeurs avec
 * apostrophe (JS inline) ne sont pas touchées → nos regex d'attributs voient
 * toujours `name="…"`.
 */
function normalizeAttrQuotes(html) {
  return html.replace(/(\s[a-zA-Z][\w-]*)='([^']*)'/g, '$1="$2"');
}

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Retire les tags et décode les entités. */
function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Attr brut `name="value"` ou `name='value'` dans un bloc. */
function attr(block, name) {
  const m = block.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
  if (!m) return null;
  return m[2] ?? m[3] ?? null;
}

/** "Home - Away" → [home, away] (le favori est en <strong>, on strippe). */
function splitTeams(text) {
  const t = stripTags(text);
  const i = t.indexOf(' - ');
  if (i < 0) {
    const j = t.lastIndexOf(' - ');
    if (j < 0) return [t.trim(), ''];
    return [t.slice(0, j).trim(), t.slice(j + 3).trim()];
  }
  return [t.slice(0, i).trim(), t.slice(i + 3).trim()];
}

/** "28:29" → {home,away} ; sinon null. */
function parseScore(text) {
  const m = stripTags(text).match(/(\d+)\s*:\s*(\d+)/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

/**
 * "(14:14, 14:15)" → PREMIER bloc = score mi-temps (H1) → {home,away}.
 * 3e bloc = prolongation → ignoré. Voir en-tête du script (mapping vérifié).
 */
function parseHalftime(text) {
  const t = stripTags(text);
  const m = t.match(/\(\s*(\d+)\s*:\s*(\d+)\s*,/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

/** data-dt="18,9,2026,18,00" → "2026-09-18T18:00:00" (heure murale locale site). */
function parseDataDt(v) {
  if (!v) return null;
  const p = String(v).split(',').map((x) => parseInt(x, 10));
  if (p.length < 3 || p.some((n) => !Number.isFinite(n))) return null;
  const [d, mo, y, h = 0, mi = 0] = p;
  const pad = (n) => String(n).padStart(2, '0');
  if (p.length >= 5) return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00`;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** "18.09." ou "18.09.2026" → date (année courante ajustée ±200 j). */
function parseDotDate(text, now = new Date()) {
  const m = stripTags(text).match(/(\d{1,2})\.(\d{1,2})\.?(?:(\d{4}))?/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  let y = m[3] ? parseInt(m[3], 10) : now.getFullYear();
  if (!m[3]) {
    const guess = new Date(y, mo - 1, d);
    const delta = guess.getTime() - now.getTime();
    if (delta > 200 * 86400000) y -= 1;
    else if (delta < -200 * 86400000) y += 1;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** "26.09. 17:00" → "2026-09-26T17:00:00". */
function parseFixtureDate(text, now = new Date()) {
  const t = stripTags(text);
  const m = t.match(/(\d{1,2})\.(\d{1,2})\.?\s*(\d{1,2}):(\d{2})/);
  if (!m) return parseDotDate(t, now);
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const h = parseInt(m[3], 10);
  const mi = parseInt(m[4], 10);
  let y = now.getFullYear();
  const guess = new Date(y, mo - 1, d, h, mi);
  const delta = guess.getTime() - now.getTime();
  if (delta > 200 * 86400000) y -= 1;
  else if (delta < -200 * 86400000) y += 1;
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00`;
}

/** Chemin d'URL relatif → clé d'index (path, sans query). */
function urlKey(url) {
  if (!url) return '';
  try {
    return new URL(url, BASE).pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

// ─── Parsing des pages ───────────────────────────────────────────────────────
/**
 * Table de résultats globale (/handball/results/) OU table de la ligue
 * (mêmes classes, colonnes identiques) : lignes <tr data-dt> avec
 * td.table-main__tt (noms + lien), td.table-main__result (score),
 * td.table-main__partial (mi-temps, si présent).
 */
function parseResultsRows(html) {
  const rows = [];
  if (!html) return rows;
  // En-tête de tournoi = ligne courante (pays: ligue)
  const tourneyRe = /<tr[^>]*class="[^"]*js-tournament[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  const rowRe = /<tr[^>]*data-dt="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g;

  // Indexe les positions des en-têtes pour attribuer la ligue courante
  const marks = [];
  let tm;
  while ((tm = tourneyRe.exec(html))) {
    const link = tm[1].match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*table-main__tournament[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    marks.push({
      at: tm.index,
      league: link ? stripTags(link[2]) : '',
      leagueUrl: link ? link[1] : '',
    });
  }

  let rm;
  while ((rm = rowRe.exec(html))) {
    const block = rm[2];
    const dt = rm[1];
    const tt = block.match(/<td[^>]*class="[^"]*table-main__tt[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    const res = block.match(/<td[^>]*class="[^"]*table-main__result[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    const partial = block.match(/<td[^>]*class="[^"]*table-main__partial[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    if (!tt) continue;
    const href = tt[1].match(/<a[^>]*href="([^"]+)"/);
    const url = href ? href[1] : '';
    if (!url || !/\/handball\/.+\/.+\/[A-Za-z0-9_-]+\/?$/.test(url)) continue;
    // La cellule tt contient aussi <span class="table-main__time">04:30</span>
    // → on ne splitte QUE l'intérieur du lien, sinon le home = "04:30Kazakhstan".
    const inner = tt[1].match(/<a[^>]*>([\s\S]*?)<\/a>/);
    const [home, away] = splitTeams(inner ? inner[1] : tt[1]);
    if (!home || !away) continue;

    // ligue courante = dernier en-tête avant cette ligne
    let league = '';
    for (const mk of marks) {
      if (mk.at < rm.index) league = mk.league;
      else break;
    }

    const score = res ? parseScore(res[1]) : null;
    rows.push({
      url,
      home,
      away,
      league,
      date: parseDataDt(dt),
      status: score ? 'FT' : 'NS',
      score,
      halftime: partial ? parseHalftime(partial[1]) : null,
    });
  }
  return rows;
}

/** Table de fixtures d'une page ligue (table-main--leaguefixtures). */
function parseLeagueFixtures(html) {
  const out = [];
  if (!html) return out;
  const table = html.match(/<table[^>]*class="[^"]*table-main--leaguefixtures[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!table) return out;
  // Livesport n'affiche la date qu'en tête de round : les lignes suivantes
  // ont &nbsp; → on propage la dernière date vue.
  let lastDate = null;
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rm;
  while ((rm = rowRe.exec(table[1]))) {
    const block = rm[1];
    const a = block.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*in-match[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const [home, away] = splitTeams(a[2]);
    if (!home || !away) continue;
    // « Next matches » (home ligue) : date en h-text-right ;
    // page /fixtures/ (saison complète) : 1re colonne table-main__datetime.
    const dateCell = block.match(
      /<td[^>]*class="[^"]*(?:table-main__datetime|h-text-right)[^"]*"[^>]*>([\s\S]*?)<\/td>/
    );
    const date = dateCell ? parseFixtureDate(dateCell[1]) : null;
    if (date) lastDate = date;
    out.push({
      url: a[1],
      home,
      away,
      date: date || lastDate,
      status: 'NS',
      score: null,
      halftime: null,
    });
  }
  return out;
}

/** Page /handball/<c>/<l>/results/ : lignes in-match + colonne date simple. */
function parseLeagueResults(html) {
  const rows = parseResultsRows(html);
  if (rows.length) return rows;
  // Variante sans data-dt (colonne « 18.09. » seule)
  const out = [];
  if (!html) return out;
  const rowRe = /<tr[^>]*>\s*<td[^>]*class="[^"]*h-text-left[^"]*"[^>]*>([\s\S]*?)<\/td>([\s\S]*?)<\/tr>/g;
  let rm;
  while ((rm = rowRe.exec(html))) {
    const a = rm[1].match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*in-match[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const [home, away] = splitTeams(a[2]);
    const scoreCell = rm[2].match(/<td[^>]*class="[^"]*h-text-center[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    const dateCell = rm[2].match(/<td[^>]*class="[^"]*h-text-right[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    const score = scoreCell ? parseScore(scoreCell[1]) : null;
    if (!home || !away || !score) continue;
    out.push({
      url: a[1],
      home,
      away,
      league: '',
      date: dateCell ? parseDotDate(dateCell[1]) : null,
      status: 'FT',
      score,
      halftime: null,
    });
  }
  return out;
}

/** Page match : équipes, score, js-partial, date, token H2H (load_mutual). */
function parseMatchPage(html) {
  if (!html) return null;
  const teams = [];
  const teamRe = /<h2[^>]*class="[^"]*list-details__item__title[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/g;
  let t;
  while ((t = teamRe.exec(html))) teams.push(stripTags(t[1]));

  const scoreEl = html.match(/<p[^>]*id="js-score"[^>]*>([\s\S]*?)<\/p>/);
  const partialEl = html.match(/<div[^>]*id="js-partial"[^>]*>([\s\S]*?)<\/div>/);
  const dateEl = html.match(/<p[^>]*id="match-date"[^>]*data-dt="([^"]*)"/);
  const finEl = html.match(/<input[^>]*id="isFinished"[^>]*>/);
  const finished = !!finEl && /value="1"/.test(finEl[0]);
  const mut = html.match(/load_mutual\('([^']+)'\)/);

  const score = scoreEl ? parseScore(scoreEl[1]) : null;
  return {
    home: teams[0] || '',
    away: teams[1] || '',
    date: parseDataDt(dateEl ? dateEl[1] : null),
    status: finished && score ? 'FT' : 'NS',
    score,
    halftime: partialEl ? parseHalftime(partialEl[1]) : null,
    // token complet = « <id>&old=true&bt=1x2&lang=en » ; PHP lit $_GET['par']
    // = <id> seul (le reste devient des params séparés) → on ne garde que l'id.
    mutualToken: mut ? mut[1].split('&')[0] : null,
  };
}

/** HTML de /gres/ajax/mutual-matches.php → rencontres H2H triées (source order). */
function parseMutualTable(html) {
  const out = [];
  if (!html) return out;
  let league = '';
  const re = /<tr[^>]*(?:class="head-to-head__header"[^>]*>|[^>]*data-dt="([^"]*)"[^>]*>)([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    const block = m[2];
    if (m[1] === undefined || !m[1]) {
      // En-tête de ligue
      const h = block.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (h) league = stripTags(h[2]);
      continue;
    }
    const cells = [...block.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 3) continue;
    const link = cells[2].match(/<a[^>]*href="([^"]+)"/);
    const score = parseScore(cells[2]);
    if (!score || !link) continue;
    out.push({
      url: link[1],
      home: stripTags(cells[0]),
      away: stripTags(cells[1]),
      meeting_date: parseDataDt(m[1]),
      league,
      score,
      halftime: null,
    });
  }
  return out;
}

// ─── Matching noms (même règles que normHandballName côté TS) ───────────────
function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Égalité normalisée ou inclusion réciproque (garde-fou : min 4 car.). */
function namesMatch(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 4) return false;
  return x.includes(y) || y.includes(x);
}

// ─── Snapshot flashscore (matchs upcoming à enrichir) ───────────────────────
function loadFlashscoreUpcoming() {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    const matches = Array.isArray(data.matches) ? data.matches : [];
    return matches.filter(
      (m) => m && m.home && m.away && !m.isFinished && !m.isLive
    );
  } catch {
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();

  let targets = TARGET_LEAGUES;
  if (args.league) {
    const want = args.league.replace(/^-+|-+$/g, '').replace(/-/g, '/');
    targets = TARGET_LEAGUES.filter(
      (l) => l.slug === args.league || l.slug === want || l.slug.replace(/\//g, '-') === args.league
    );
    if (!targets.length) {
      console.error(`Ligue inconnue : ${args.league} (connues : ${TARGET_LEAGUES.map((l) => l.slug).join(', ')})`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`BetExplorer handball — ${targets.length} ligue(s), days=${args.days}, limit=${args.limit}, h2h=${args.h2h}`);
  console.log(`Vecteur : ${process.env.FLARE_URL ? 'FlareSolverr ' + process.env.FLARE_URL : 'fetch direct https'}`);

  // 1) Résultats récents globaux (partials = scores mi-temps) ────────────────
  const recent = [];
  const byUrl = new Map();
  for (let d = 0; d < args.days; d++) {
    const dt = new Date(now.getTime() - d * 86400000);
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const url = `${BASE}/handball/results/?year=${y}&month=${mo}&day=${day}`;
    const html = await fetchHtml(url);
    const rows = parseResultsRows(html);
    console.log(`results ${y}-${mo}-${day} : ${rows.length} matchs (${rows.filter((r) => r.halftime).length} avec MT)`);
    for (const r of rows) {
      const k = urlKey(r.url);
      if (!byUrl.has(k)) {
        byUrl.set(k, r);
        recent.push(r);
      } else if (!byUrl.get(k).halftime && r.halftime) {
        byUrl.get(k).halftime = r.halftime;
      }
    }
  }

  // 2) Ligues cibles : fixtures (upcoming) + résultats (FT historiques) ──────
  const leagues = [];
  const fixtures = [];
  for (const lg of targets) {
    // fixtures/ = saison complète (260+ matchs) > « Next matches » de la home
    // (5 prochains) : couvre les upcoming du snapshot flashscore sur J+7.
    const fixHtml = await fetchHtml(`${BASE}/handball/${lg.slug}/fixtures/`);
    const fx = parseLeagueFixtures(fixHtml);
    const resHtml = await fetchHtml(`${BASE}/handball/${lg.slug}/results/`);
    const fromTable = parseResultsRows(resHtml);
    const rows = fromTable.length ? fromTable : parseLeagueResults(resHtml);

    // Merge : FT en priorité, NS (fixtures) ajoutés, halftime par croisement URL
    const seen = new Map();
    for (const r of rows) {
      const k = urlKey(r.url);
      const prev = seen.get(k);
      if (prev) {
        if (!prev.halftime && r.halftime) prev.halftime = r.halftime;
        if (prev.status === 'NS' && r.status === 'FT') Object.assign(prev, r);
      } else {
        seen.set(k, { ...r, league: r.league || lg.label });
      }
    }
    for (const f of fx) {
      const k = urlKey(f.url);
      if (!seen.has(k)) seen.set(k, { ...f, league: lg.label });
      else if (seen.get(k).status === 'NS' && f.date) seen.get(k).date = f.date;
    }
    // Complète les MT depuis l'index global (mêmes URLs)
    for (const [k, m] of seen) {
      if (!m.halftime && byUrl.has(k) && byUrl.get(k).halftime) m.halftime = byUrl.get(k).halftime;
      if (m.status === 'FT' && !m.halftime && byUrl.has(k)) m.halftime = byUrl.get(k).halftime;
    }

    const matches = [...seen.values()].sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || ''))
    );
    leagues.push({ slug: lg.slug, name: lg.label, matches });
    fixtures.push(...matches.filter((m) => m.status === 'NS'));
    console.log(
      `ligue ${lg.slug} : ${matches.length} matchs (${matches.filter((m) => m.status === 'FT').length} FT, ${matches.filter((m) => m.halftime).length} avec MT, ${matches.filter((m) => m.status === 'NS').length} NS)`
    );
  }

  // 3) H2H : upcoming du snapshot ↔ fixtures BetExplorer → page match → mutual
  const h2h = [];
  let h2hPairs = 0;
  if (args.h2h && args.limit > 0) {
    const upcoming = loadFlashscoreUpcoming();
    const todo = [];
    for (const f of fixtures) {
      if (todo.length >= args.limit) break;
      const hit = upcoming.find(
        (u) => namesMatch(u.home, f.home) && namesMatch(u.away, f.away)
      );
      if (hit) todo.push({ flash: hit, fixture: f });
    }
    console.log(`H2H : ${todo.length} paire(s) upcoming à enrichir (snapshot ${upcoming.length} upcoming)`);
    for (const { flash, fixture } of todo) {
      const abs = new URL(fixture.url, BASE).toString();
      const page = await fetchHtml(abs);
      const info = parseMatchPage(page);
      if (!info || !info.mutualToken) {
        console.log(`  ! pas de token H2H pour ${fixture.home} - ${fixture.away}`);
        continue;
      }
      const mutualUrl = `${BASE}/gres/ajax/mutual-matches.php?par=${info.mutualToken}`;
      const mutualHtml = await fetchHtml(mutualUrl);
      const meetings = parseMutualTable(mutualHtml);
      // Complète les MT des meetings via l'index global (mêmes URLs)
      for (const mtg of meetings) {
        const k = urlKey(mtg.url);
        if (byUrl.has(k) && byUrl.get(k).halftime) mtg.halftime = byUrl.get(k).halftime;
        h2h.push({
          home: mtg.home,
          away: mtg.away,
          meeting_date: mtg.meeting_date,
          league: mtg.league,
          score: mtg.score,
          halftime: mtg.halftime,
          url: mtg.url,
          pair_home: flash.home,
          pair_away: flash.away,
        });
      }
      h2hPairs += 1;
      console.log(`  H2H ${flash.home} - ${flash.away} : ${meetings.length} rencontres`);
    }
  }

  // 4) Tri H2H date desc (par paire) + dédoublonnage ─────────────────────────
  h2h.sort((a, b) => String(b.meeting_date || '').localeCompare(String(a.meeting_date || '')));

  const snapshot = {
    scraped_at: now.toISOString(),
    source: 'betexplorer',
    base: BASE,
    days: args.days,
    leagues,
    recent: recent.slice(0, 400),
    h2h,
  };

  const counts = {
    recent: recent.length,
    recentMT: recent.filter((r) => r.halftime).length,
    leagues: leagues.length,
    leagueMatches: leagues.reduce((n, l) => n + l.matches.length, 0),
    leagueFT: leagues.reduce((n, l) => n + l.matches.filter((m) => m.status === 'FT').length, 0),
    leagueMT: leagues.reduce((n, l) => n + l.matches.filter((m) => m.halftime).length, 0),
    h2hPairs,
    h2h: h2h.length,
    h2hMT: h2h.filter((x) => x.halftime).length,
    pages: state.pages,
  };
  console.log('RÉSUMÉ', JSON.stringify(counts));
  if (state.budgetHit) console.log(`! budget ${MAX_PAGES} pages atteint — résultat partiel livré`);

  const stut = h2h.filter((x) => /stuttgart|erlangen/i.test(x.home + x.away));
  console.log(`Stuttgart/Erlangen dans h2h : ${stut.length}`);

  if (args.dryRun) {
    console.log('--dry-run : aucun fichier écrit');
    const sample = leagues[0] && leagues[0].matches.filter((m) => m.halftime).slice(0, 3);
    console.log('échantillon MT:', JSON.stringify(sample || []));
    return;
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(snapshot, null, 1), 'utf8');
  console.log(`Écrit : ${args.out}`);
}

// Utilitaires purs exportés pour les tests (src/lib/__tests__ — bun:test) :
// main() ne s'exécute que si le script est lancé directement.
module.exports = {
  parseHalftime,
  parseScore,
  parseResultsRows,
  parseLeagueFixtures,
  parseLeagueResults,
  parseMatchPage,
  parseMutualTable,
  splitTeams,
  parseDataDt,
  parseDotDate,
  parseFixtureDate,
  namesMatch,
  normName,
  decodeEntities,
  normalizeAttrQuotes,
};

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL', e && e.stack ? e.stack : e);
    process.exitCode = 1;
  });
}
