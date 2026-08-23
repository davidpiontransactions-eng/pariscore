#!/usr/bin/env node
'use strict';
/**
 * scrape-oddalerts.js
 * -------------------
 * Scraper zéro-dépendance (hors better-sqlite3) des pages ligues OddAlerts.
 *
 * Source : https://www.oddalerts.com/leagues/{country}/{slug}
 * Données extraites par page :
 *   - Hero        : nom ligue, pays, logo (CDN SportMonks), saisons disponibles
 *   - General     : GP, Home Wins %, Draws %, Away Wins %, Total Goals + avg
 *   - Over/Under  : Over X.5 Goals (count, %)
 *   - Half        : 1H/2H goals (count, avg), overs 1H/2H, splits home/away
 *   - Cards       : totaux, home/away (avg), overs X.5 cartons (%)
 *   - BTTS        : BTTS %, BTTS & 2.5+, BTTS or 2.5+
 *   - Corners     : totaux, home/away (avg), overs X.5 corners (%)
 *   - Fixtures    : prochains matchs avec cotes 1X2 best price (si dispo)
 *
 * Écriture : table SQLite `league_season_stats` dans pariscore.db (même DB que
 * l'app Next.js ; DDL aligné sur le modèle Prisma LeagueSeasonStats — le db push
 * du pipeline de déploiement crée la table, le CREATE TABLE IF NOT EXISTS ici
 * permet aussi les runs standalone hors pipeline).
 *
 * Usage :
 *   node scripts/scrape-oddalerts.js                        # full pass (1892 ligues)
 *   node scripts/scrape-oddalerts.js --country=england      # un pays
 *   node scripts/scrape-oddalerts.js --only=england/premier-league
 *   node scripts/scrape-oddalerts.js --limit=10             # smoke test
 *   node scripts/scrape-oddalerts.js --force                # ignore le cache 20h
 *   node scripts/scrape-oddalerts.js --dry-run              # parse sans écrire en DB
 *
 * Cron VPS : pm2 `pariscore-cron-oddalerts`, quotidien 04:30 UTC (ecosystem.config.js).
 *
 * Cloudflare / VPS : depuis une IP datacenter (OVH), OddAlerts est derrière un
 * challenge "Just a moment". Le scraper bascule alors automatiquement sur
 * FlareSolverr (conteneur Docker local au VPS, http://127.0.0.1:8191) : il
 * crée FLARE_SESSIONS sessions navigateur réutilisées (~1s/page, pass complet
 * ≈ 15-25 min). Sur une IP résidentielle le chemin direct https est utilisé
 * (~2 min). Variables : FLARESOLVERR_URL, FLARESOLVERR_ENABLED=0 pour forcer
 * le direct, FLARE_SESSIONS (défaut 2).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Constantes ───────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.oddalerts.com';
const LEAGUES_INDEX = '/leagues';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HTTP_TIMEOUT_MS = 30000;
const DEFAULT_DELAY_MS = 350; // politesse : délai entre requêtes d'un même worker
const DEFAULT_CONCURRENCY = 5;
const FRESH_TTL_MS = 20 * 60 * 60 * 1000; // skip si rafraîchi il y a < 20h
const RETRIES = 3;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const FAILED_FILE = path.join(REPO_DIR, 'data', 'oddalerts-failed.json');

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}
const ONLY = typeof args.only === 'string' ? args.only : null;
const COUNTRY = typeof args.country === 'string' ? args.country : null;
const LIMIT = args.limit ? parseInt(args.limit, 10) : 0;
const FORCE = !!args.force;
const DRY_RUN = !!args['dry-run'];
const DELAY_MS = args.delay ? parseInt(args.delay, 10) : DEFAULT_DELAY_MS;
const CONCURRENCY = args.concurrency ? parseInt(args.concurrency, 10) : DEFAULT_CONCURRENCY;

// ─── FlareSolverr (bypass Cloudflare sur IP datacenter) ──────────────────────
// Depuis le VPS (IP OVH), Cloudflare renvoie un challenge "Just a moment" (403).
// Le conteneur FlareSolverr local au VPS (http://127.0.0.1:8191/v1) résout le
// challenge une fois via un vrai Chrome ; on récupère alors son cookie
// cf_clearance + son User-Agent exacts, et toutes les requêtes suivantes passent
// en direct (rapide). Fallback : si une page repasse en 403, on la fetch via
// FlareSolverr (lent, ~2-5s/page) plutôt que d'échouer.
const FLARE_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';
const FLARE_ENABLED = process.env.FLARESOLVERR_ENABLED !== '0';
const flareState = { userAgent: null, cookieHeader: null, bootstrapped: false };

async function flareRequest(urlOrBody) {
  const body =
    typeof urlOrBody === 'string'
      ? { cmd: 'request.get', url: urlOrBody, maxTimeout: 60000 }
      : urlOrBody;
  const res = await fetch(FLARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`FlareSolverr HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok' || !json.solution) {
    throw new Error(`FlareSolverr: ${json.message || 'réponse invalide'}`);
  }
  return json.solution;
}

/** Résout le challenge via FlareSolverr et mémorise cookies + UA pour le direct. */
async function bootstrapViaFlare(url) {
  console.log(`[oddalerts] FlareSolverr: résolution du challenge via ${url}`);
  const solution = await flareRequest(url);
  flareState.userAgent = solution.userAgent || USER_AGENT;
  const cookies = (solution.cookies || [])
    .filter((c) => /(^|\.)oddalerts\.com$/.test(c.domain || ''))
    .map((c) => `${c.name}=${c.value}`);
  flareState.cookieHeader = cookies.length ? cookies.join('; ') : null;
  flareState.bootstrapped = true;
  console.log(
    `[oddalerts] FlareSolverr: OK (${cookies.length} cookies, UA ${flareState.userAgent.slice(0, 40)}…)`
  );
}

// ─── Mode sessions FlareSolverr (VPS derrière Cloudflare strict) ─────────────
// Le cookie cf_clearance est lié à la fingerprint TLS du navigateur qui a
// résolu : réutilisé depuis Node https, Cloudflare re-challenge (403). Sur une
// IP datacenter, TOUTES les requêtes passent donc par FlareSolverr. On crée
// FLARE_SESSIONS sessions navigateur réutilisées (≈1s/page vs 2-4s sans).
const FLARE_SESSION_COUNT = process.env.FLARE_SESSIONS
  ? parseInt(process.env.FLARE_SESSIONS, 10)
  : 2;
const flareSessions = new Set(); // ids créés (cleanup en fin de run)

function sessionId(worker) {
  return `oddalerts-w${worker}`;
}

async function ensureFlareSession(worker) {
  const id = sessionId(worker);
  if (flareSessions.has(id)) return id;
  const res = await fetch(FLARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'sessions.create', session: id }),
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(`sessions.create: ${json.message}`);
  flareSessions.add(id);
  console.log(`[oddalerts] session FlareSolverr créée: ${id}`);
  return id;
}

async function fetchViaFlareSession(url, worker) {
  const session = await ensureFlareSession(worker);
  const solution = await flareRequest({ cmd: 'request.get', url, session, maxTimeout: 60000 });
  return { status: solution.status, html: solution.response || '' };
}

async function destroyFlareSessions() {
  for (const id of [...flareSessions]) {
    try {
      await fetch(FLARE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: 'sessions.destroy', session: id }),
        signal: AbortSignal.timeout(15000),
      });
      flareSessions.delete(id);
    } catch { /* best-effort */ }
  }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────
// NB : le module https de Node passe le WAF d'OddAlerts depuis une IP
// résidentielle ; depuis une IP datacenter (VPS), Cloudflare challenge → on
// réutilise alors les cookies cf_clearance obtenus via FlareSolverr, avec le
// User-Agent EXACT du navigateur qui a résolu (le cookie y est lié).
function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': flareState.userAgent || USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (flareState.cookieHeader) headers.Cookie = flareState.cookieHeader;
    const req = https.get(url, { headers, timeout: HTTP_TIMEOUT_MS }, (res) => {
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        res.resume();
        return resolve(fetchOnce(new URL(res.headers.location, url).href));
      }
      let html = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { html += c; });
      res.on('end', () => resolve({ status: res.statusCode, html }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

let USE_FLARE_SESSIONS = false; // bascule définitive dès qu'on détecte un re-challenge

async function fetchText(url, worker = 0) {
  // 0) Mode sessions FlareSolverr actif (VPS) → pas de tentative directe.
  if (FLARE_ENABLED && USE_FLARE_SESSIONS) {
    const res = await fetchViaFlareSession(url, worker);
    if (res.status === 404) return { status: 404, html: null };
    if (res.status !== 200) throw new Error(`HTTP ${res.status} (via FlareSolverr session)`);
    return res;
  }
  // 1) Direct (IP résidentielle ou cookies FlareSolverr valides)
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetchOnce(url);
      if (res.status === 404) return { status: 404, html: null };
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      const is403 = /HTTP 403/.test(err.message);
      if (!is403 && attempt < RETRIES) {
        await sleep(1000 * attempt * attempt);
      } else {
        break; // 403 → tenter le chemin FlareSolverr tout de suite
      }
    }
  }
  // 2) Fallback Cloudflare : bootstrap cookies puis direct ; si re-challenge
  //    (cookie lié à la fingerprint TLS du navigateur) → mode sessions.
  if (FLARE_ENABLED) {
    try {
      if (!flareState.bootstrapped) {
        await bootstrapViaFlare(BASE_URL + LEAGUES_INDEX);
        const res = await fetchOnce(url);
        if (res.status === 200) return res;
        if (res.status === 404) return { status: 404, html: null };
      }
      USE_FLARE_SESSIONS = true; // les cookies ne suffisent pas sur cette IP
      console.log('[oddalerts] re-challenge Cloudflare malgré cf_clearance → mode sessions FlareSolverr');
      const res = await fetchViaFlareSession(url, worker);
      if (res.status === 404) return { status: 404, html: null };
      if (res.status === 200) return res;
      throw new Error(`HTTP ${res.status} (via FlareSolverr session)`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Helpers parsing ──────────────────────────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function toNum(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).replace('%', '').replace(',', '.').trim();
  if (t === '' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Parse le bloc hero (nom, pays, sport, logo, saisons). */
function parseHero(html) {
  const heroMatch = html.match(/<header class="competition-hero">([\s\S]*?)<\/header>/);
  if (!heroMatch) return null;
  const hero = heroMatch[1];
  const h1 = hero.match(/<h1>([^<]+)<\/h1>/);
  const eyebrow = hero.match(/__eyebrow">([^<]+)</);
  const logo = hero.match(/<img src="([^"]+)"[^>]*alt="[^"]*logo"/);
  const seasons = [...hero.matchAll(/<option\s+value="([^"]*)"[^>]*>\s*([^<]+?)\s*<\/option>/g)].map(
    (m) => ({ url: m[1], label: decodeEntities(m[2]).replace(/\s*\(Current\)\s*$/, ''), current: /selected/.test(m[0]) })
  );
  const name = h1 ? decodeEntities(h1[1]).replace(/\s+Stats$/, '') : null;
  const eyebrowTxt = eyebrow ? decodeEntities(eyebrow[1]) : '';
  const parts = eyebrowTxt.split(/\s+/);
  const sport = parts.length > 1 ? parts[parts.length - 1] : 'football';
  const countryName = parts.slice(0, -1).join(' ');
  return { name, countryName, sport, logoUrl: logo ? logo[1] : null, seasons };
}

/** Découpe une section competition-card en items {label, value, pct, avg}. */
function parseStatGrid(sectionHtml) {
  const items = [];
  const labelRe = /<span class="competition-stat__label">([^<]+)<\/span>/g;
  const marks = [];
  let lm;
  while ((lm = labelRe.exec(sectionHtml))) {
    marks.push({ idx: lm.index, end: labelRe.lastIndex, label: decodeEntities(lm[1]) });
  }
  for (let i = 0; i < marks.length; i++) {
    const chunkEnd = i + 1 < marks.length ? marks[i + 1].idx : sectionHtml.length;
    const chunk = sectionHtml.slice(marks[i].end, chunkEnd);
    const valRe = /class="competition-stat__value(?:\s+competition-stat__value--(value|per|avg))?"[^>]*>\s*([-\d.,%]+?)\s*</g;
    const entry = { key: slugifyKey(marks[i].label), label: marks[i].label, value: null, pct: null, avg: null };
    let vm;
    while ((vm = valRe.exec(chunk))) {
      const kind = vm[1] || 'value';
      const n = toNum(vm[2]);
      if (kind === 'per') entry.pct = n;
      else if (kind === 'avg') entry.avg = n;
      else entry.value = n;
    }
    if (entry.value !== null || entry.pct !== null || entry.avg !== null) items.push(entry);
  }
  return items;
}

function slugifyKey(label) {
  return label
    .toLowerCase()
    .replace(/[&+/]/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Parse toutes les sections stats d'une page ligue. */
function parseSections(html) {
  const sections = [];
  const re = /<section class="competition-card">([\s\S]*?)<\/section>/g;
  let m;
  while ((m = re.exec(html))) {
    const titleMatch = m[1].match(/<h2>([^<]+)<\/h2>/);
    const title = titleMatch ? decodeEntities(titleMatch[1]) : null;
    if (!title || title === 'Explore') continue;
    if (/^Upcoming fixtures$/i.test(title)) continue; // traité à part
    const items = parseStatGrid(m[1]);
    if (items.length) {
      sections.push({
        id: title === 'General Stats' ? 'general'
          : title === 'Over/Under' ? 'over_under'
          : title === 'Goals by Half' ? 'halves'
          : title === 'Card Stats' ? 'cards'
          : title === 'BTTS Stats' ? 'btts'
          : title === 'Corner Stats' ? 'corners'
          : slugifyKey(title),
        title,
        items,
      });
    }
  }
  return sections;
}

/** Parse les prochains matchs avec cotes 1X2. */
function parseFixtures(html) {
  const out = [];
  const re = /<article class="competition-fixture ?([^"]*)">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(html))) {
    const block = m[2];
    const time = block.match(/__time">\s*([^<]+?)\s*</);
    const teams = [...block.matchAll(/__team">\s*(?:<img src="([^"]*)"[^>]*>)?\s*<span>([^<]*)<\/span>/g)];
    const prices = [...block.matchAll(/<span class="competition-price">([12X])\s+([\d.,]+)<\/span>/g)];
    if (teams.length < 2) continue;
    const odds = {};
    for (const p of prices) {
      const k = p[1] === '1' ? 'home' : p[1] === 'X' ? 'draw' : 'away';
      odds[k] = toNum(p[2]);
    }
    out.push({
      kickoffText: time ? decodeEntities(time[1]) : null,
      live: (m[1] || '').includes('live'),
      home: { name: decodeEntities(teams[0][2]), badge: teams[0][1] || null },
      away: { name: decodeEntities(teams[1][2]), badge: teams[1][1] || null },
      odds: prices.length === 3 ? odds : null,
    });
  }
  return out;
}

/** Parse l'index /leagues → [{uid, country, slug, name}].
 * Tolérant aux deux sérialisations d'attributs : le HTML source utilise des
 * guillemets simples (<a class='league-link' ...>), mais une page récupérée
 * via FlareSolverr/Chrome est resérialisée en guillemets doubles. */
function parseIndex(html) {
  const seen = new Set();
  const out = [];
  const anchorRe = /<a\b([^>]*\bclass=["']league-link["'][^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = anchorRe.exec(html))) {
    const attrs = m[1];
    const slugMatch = attrs.match(/href=["']\/leagues\/([a-z0-9-]+)\/([a-z0-9-]+)["']/);
    if (!slugMatch) continue;
    const key = `${slugMatch[1]}/${slugMatch[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      uid: (attrs.match(/data-uid=["']([^"']*)["']/) || [])[1] || '',
      country: slugMatch[1],
      slug: slugMatch[2],
      name: decodeEntities(m[2].replace(/<[^>]+>/g, '')),
    });
  }
  return out;
}

// ─── DB (better-sqlite3, aligné modèle Prisma LeagueSeasonStats) ─────────────
const SQLITE_FILE =
  process.env.DATABASE_PATH || path.join(process.cwd(), 'pariscore.db');

function openDb() {
  const Database = require('better-sqlite3');
  const db = new Database(SQLITE_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS "league_season_stats" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "country" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "leagueName" TEXT NOT NULL,
      "logoUrl" TEXT,
      "sport" TEXT NOT NULL DEFAULT 'football',
      "seasonLabel" TEXT,
      "seasonsJson" TEXT,
      "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
      "statsJson" TEXT NOT NULL DEFAULT '{}',
      "fixturesJson" TEXT,
      "sourceUrl" TEXT,
      "source" TEXT NOT NULL DEFAULT 'oddalerts',
      "updatedAt" DATETIME NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "league_season_stats_country_slug_key"
      ON "league_season_stats"("country", "slug");
  `);
  return db;
}

const upsertStmt = (db) => db.prepare(`
  INSERT INTO "league_season_stats"
    ("id","country","slug","leagueName","logoUrl","sport","seasonLabel","seasonsJson",
     "gamesPlayed","statsJson","fixturesJson","sourceUrl","source","updatedAt")
  VALUES (@id,@country,@slug,@leagueName,@logoUrl,@sport,@seasonLabel,@seasonsJson,
          @gamesPlayed,@statsJson,@fixturesJson,@sourceUrl,'oddalerts',datetime('now'))
  ON CONFLICT("id") DO UPDATE SET
    "leagueName"=excluded."leagueName",
    "logoUrl"=excluded."logoUrl",
    "sport"=excluded."sport",
    "seasonLabel"=excluded."seasonLabel",
    "seasonsJson"=excluded."seasonsJson",
    "gamesPlayed"=excluded."gamesPlayed",
    "statsJson"=excluded."statsJson",
    "fixturesJson"=excluded."fixturesJson",
    "sourceUrl"=excluded."sourceUrl",
    "updatedAt"=datetime('now')
`);

// ─── Pipeline ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[oddalerts] démarrage — dryRun=${DRY_RUN} only=${ONLY || '-'} country=${COUNTRY || '-'} limit=${LIMIT || '-'}`);

  // 1) Index des ligues
  const idx = await fetchText(BASE_URL + LEAGUES_INDEX);
  if (idx.status !== 200) throw new Error(`index /leagues HTTP ${idx.status}`);
  let leagues = parseIndex(idx.html);
  console.log(`[oddalerts] index : ${leagues.length} ligues`);
  if (ONLY) {
    const [c, s] = ONLY.split('/');
    leagues = leagues.filter((l) => l.country === c && l.slug === s);
  } else if (COUNTRY) {
    leagues = leagues.filter((l) => l.country === COUNTRY);
  }
  if (LIMIT > 0) leagues = leagues.slice(0, LIMIT);
  if (!leagues.length) {
    console.log('[oddalerts] aucune ligue après filtres — rien à faire.');
    return;
  }

  // 2) Ouverture DB + cache fraîcheur
  let db = null;
  let upsert = null;
  let freshSet = new Set();
  if (!DRY_RUN) {
    db = openDb();
    upsert = upsertStmt(db);
    const rows = db.prepare(`SELECT "id" FROM "league_season_stats" WHERE "updatedAt" >= datetime('now', '-20 hours')`).all();
    freshSet = new Set(rows.map((r) => r.id));
    if (!FORCE && freshSet.size) {
      const before = leagues.length;
      leagues = leagues.filter((l) => !freshSet.has(`${l.country}/${l.slug}`));
      console.log(`[oddalerts] cache : ${before - leagues.length}/${before} déjà frais (<20h) — skip (--force pour ignorer)`);
    }
  }
  if (!leagues.length) {
    console.log('[oddalerts] tout est déjà à jour.');
    return;
  }

  // 3) Scraping concurrent avec délai par worker
  let done = 0;
  let okCount = 0;
  let skip404 = 0;
  const failed = [];
  const total = leagues.length;
  const queue = leagues.map((l, i) => ({ ...l, pos: i }));

  async function worker(workerIndex) {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      const url = `${BASE_URL}/leagues/${job.country}/${job.slug}`;
      try {
        const res = await fetchText(url, workerIndex);
        if (res.status === 404) {
          skip404++;
          done++;
          continue;
        }
        const hero = parseHero(res.html);
        const sections = parseSections(res.html);
        const fixtures = parseFixtures(res.html);
        const general = sections.find((s) => s.id === 'general');
        const gpItem = general && general.items.find((i) => i.key === 'games_played');
        const row = {
          id: `${job.country}/${job.slug}`,
          country: job.country,
          slug: job.slug,
          leagueName: (hero && hero.name) || job.name,
          logoUrl: hero ? hero.logoUrl : null,
          sport: (hero && hero.sport) || 'football',
          seasonLabel: hero && hero.seasons.find((s) => s.current) ? hero.seasons.find((s) => s.current).label : hero && hero.seasons[0] ? hero.seasons[0].label : null,
          seasonsJson: hero ? JSON.stringify(hero.seasons) : null,
          gamesPlayed: gpItem && gpItem.value != null ? gpItem.value : 0,
          statsJson: JSON.stringify(sections),
          fixturesJson: fixtures.length ? JSON.stringify(fixtures) : null,
          sourceUrl: url,
        };
        if (!DRY_RUN) upsert.run(row);
        okCount++;
      } catch (err) {
        failed.push({ id: `${job.country}/${job.slug}`, error: String(err.message || err) });
      }
      done++;
      if (done % 50 === 0 || done === total) {
        console.log(`[oddalerts] progression ${done}/${total} (ok=${okCount} 404=${skip404} fail=${failed.length})`);
      }
      await sleep(DELAY_MS);
    }
  }

  // En mode sessions FlareSolverr, la concurrence utile = nb de sessions
  const effectiveConcurrency = USE_FLARE_SESSIONS
    ? Math.min(FLARE_SESSION_COUNT, CONCURRENCY)
    : CONCURRENCY;
  await Promise.all(
    Array.from({ length: Math.min(effectiveConcurrency, leagues.length) }, (_, i) => worker(i))
  );
  if (flareSessions.size) await destroyFlareSessions();

  // 4) Bilan
  console.log(`[oddalerts] terminé : ok=${okCount} 404=${skip404} fail=${failed.length} (total=${total})`);
  if (failed.length) {
    fs.mkdirSync(path.dirname(FAILED_FILE), { recursive: true });
    fs.writeFileSync(FAILED_FILE, JSON.stringify({ at: new Date().toISOString(), failed }, null, 1));
    console.log(`[oddalerts] échecs écrits dans ${FAILED_FILE}`);
  }
  if (db) {
    const count = db.prepare('SELECT COUNT(*) AS n FROM league_season_stats').get();
    console.log(`[oddalerts] table league_season_stats : ${count.n} lignes`);
    db.close();
  }
}

main().catch((err) => {
  console.error('[oddalerts] ERREUR FATALE:', err);
  process.exit(1);
});
