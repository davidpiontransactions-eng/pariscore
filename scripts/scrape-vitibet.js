#!/usr/bin/env node
'use strict';
/**
 * scrape-vitibet.js
 * -----------------
 * Scraper zéro-dépendance (hors better-sqlite3) des pronostics handball Vitibet.
 *
 * Source : https://www.vitibet.com/index.php?clanek=quicktips&sekce=hazena&lang=en
 * Données extraites par match (table `vitibet_tips`, schéma §4 du plan
 * .context/plan-vitibet-handball-scraping.md) :
 *   - Horaire (data-time ISO local), équipes, logos (team_{id}.png)
 *   - Tip vainqueur : 1 / X / 2 (NULL si carte sans prédiction "–")
 *   - INDEX (float signé, rapport de force), probabilités 1/X/2 (%)
 *   - Score prédit, statut (scheduled | live | finished), score réel FT
 *
 * Structure HTML réelle (validée le 2026-09-25) :
 *   - Listing quotidien : <a class='livescore-match-row [no-tip-row]'
 *     data-status='…' href='…fixture_id=F&league_id=L' id='match-F'>
 *     avec <span class='local-time' data-time='AAAA-MM-JJ HH:MM:SS'>,
 *     <span class='livescore-team-name'>, INDEX dans .idx-val,
 *     probas dans .prob-itemPct, tip dans .tip-indicator-circle,
 *     score prédit dans .livescore-match-score-col, score réel FT dans
 *     .livescore-match-actual-col (.act-score-line) + badge mobile 'FT d:e'.
 *   - Onglets de date : paramètre d'URL `?date=AAAA-MM-JJ` (GET direct,
 *     page complète — découvert via la fonction JS changeDate()).
 *   - Détail match (fallback --only=fixture) : JSON-LD SportsEvent
 *     ("Mathematical model forecast: Score d:e (Probabilities: …)") +
 *     bloc .analytics-header-row (INDEX + probas ; zéros = pas de prédiction).
 *   - Pages ligues (/handball/tips/{slug}/{country}/{id}/) : classement
 *     uniquement, aucun champ du schéma → non fetchées en run standard.
 *
 * Conformité robots.txt vitibet.com : Allow explicite sur /*clanek=quicktips ;
 * URL interdites (*tables, *tab=, *sort, *results, *teams, *odehrano) jamais
 * requêtées. UA identifié : PariscoreBot (+https://pariscore.fr).
 *
 * Usage :
 *   node scripts/scrape-vitibet.js                       # fenêtre J→J+3
 *   node scripts/scrape-vitibet.js --sport=hazena        # défaut
 *   node scripts/scrape-vitibet.js --only=league/34      # une ligue
 *   node scripts/scrape-vitibet.js --only=fixture/197642 # un match
 *   node scripts/scrape-vitibet.js --date=2026-09-26     # un seul jour
 *   node scripts/scrape-vitibet.js --limit=10            # smoke test
 *   node scripts/scrape-vitibet.js --dry-run             # parse sans écrire
 *   node scripts/scrape-vitibet.js --force               # ignore le cache 20h
 *
 * Cron VPS prévu : pm2 `pariscore-cron-vitibet`, 05:30 et 12:00 UTC.
 */
'use strict';

const path = require('path');
const https = require('https');

// ─── Constantes ───────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.vitibet.com';
const USER_AGENT = 'PariscoreBot (+https://pariscore.fr)';
const HTTP_TIMEOUT_MS = 30000;
const DEFAULT_DELAY_MS = 1000; // politesse : ~1 req/s
const FRESH_TTL_MS = 20 * 60 * 60 * 1000; // skip-cache < 20h
const RETRIES = 3;
const DATE_WINDOW_DAYS = 4; // J → J+3

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}
const SPORT = typeof args.sport === 'string' ? args.sport : 'hazena';
const ONLY = typeof args.only === 'string' ? args.only : null;
const LIMIT = args.limit ? parseInt(args.limit, 10) : 0;
const FORCE = !!args.force;
const DRY_RUN = !!args['dry-run'];
const DATE_ARG = typeof args.date === 'string' ? args.date : null;
const DELAY_MS = args.delay ? parseInt(args.delay, 10) : DEFAULT_DELAY_MS;

// --only=league/34 | fixture/197642 (variante fixture/197642/34 = id explicite)
let onlyLeagueId = null;
let onlyFixtureId = null;
let onlyFixtureLeagueId = null;
if (ONLY) {
  const [kind, id, extra] = ONLY.split('/');
  if (kind === 'league' && /^\d+$/.test(id || '')) onlyLeagueId = parseInt(id, 10);
  else if (kind === 'fixture' && /^\d+$/.test(id || '')) {
    onlyFixtureId = parseInt(id, 10);
    if (/^\d+$/.test(extra || '')) onlyFixtureLeagueId = parseInt(extra, 10);
  } else {
    console.error(`[vitibet] --only invalide: ${ONLY} (attendu league/ID ou fixture/ID)`);
    process.exit(1);
  }
}
if (DATE_ARG && !/^\d{4}-\d{2}-\d{2}$/.test(DATE_ARG)) {
  console.error(`[vitibet] --date invalide: ${DATE_ARG} (attendu AAAA-MM-JJ)`);
  process.exit(1);
}

// ─── HTTP (module https natif, retry 3× avec backoff) ─────────────────────────
function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: HTTP_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
          res.resume();
          return resolve(fetchOnce(new URL(res.headers.location, url).href));
        }
        let html = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { html += c; });
        res.on('end', () => resolve({ status: res.statusCode, html }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetchOnce(url);
      if (res.status === 404) return { status: 404, html: null };
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) await sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s, 4s
    }
  }
  throw lastErr;
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

/** Float signé tolérant : "+8.96", "-21.82", "1,65", "65%" → number | null. */
function toNum(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).replace('%', '').replace(',', '.').trim();
  if (t === '' || t === '-' || t === '?' || t === '–') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toInt(s) {
  const n = toNum(s);
  return n === null ? null : Math.trunc(n);
}

/** Heure "HH:MM" depuis data-time "AAAA-MM-JJ HH:MM:SS". */
function heureFrom(dataTime) {
  return dataTime && dataTime.length >= 16 ? dataTime.slice(11, 16) : null;
}

// ─── Parser listing quotidien (source de vérité du schéma) ────────────────────
/**
 * Parse toutes les cartes match d'une page quicktips.
 * Tolérant aux guillemets simples/doubles (HTML source vs resérialisation).
 * Champs non prédits (carte "–" / no-tip-row) → tip/index/probs/score_predit
 * restent NULL : jamais inventés.
 */
function parseListing(html) {
  const rows = [];
  const rowRe = /<a\b([^>]*\blivescore-match-row[^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const attrs = m[1];
    const body = m[2];
    const href = (attrs.match(/href=["']([^"']+)["']/) || [])[1] || '';
    const fixtureId = toInt((href.match(/fixture_id=(\d+)/) || [])[1]);
    const leagueId = toInt((href.match(/league_id=(\d+)/) || [])[1]);
    if (fixtureId === null || leagueId === null) continue;
    const statusRaw = ((attrs.match(/data-status=["']([^"']+)["']/) || [])[1] || 'scheduled').toLowerCase();
    const statut = ['scheduled', 'live', 'finished'].includes(statusRaw) ? statusRaw : 'scheduled';

    const dataTime = (body.match(/data-time=["']([^"']+)["']/) || [])[1] || '';
    const dateMatch = dataTime.slice(0, 10) || null;

    const teams = [...body.matchAll(/livescore-team-name["'][^>]*>([^<]*)</g)].map((t) => decodeEntities(t[1]));
    if (teams.length < 2) continue;

    // Tip : .tip-indicator-circle contient '1' | 'X' | '2' (absent si "–")
    const tipRaw = ((body.match(/tip-indicator-circle["'][^>]*>([^<]*)</) || [])[1] || '').trim();
    const tip = /^[12X]$/.test(tipRaw) ? tipRaw : null;

    // INDEX : .idx-val ("+8.96" / "-21.82") — absent si pas de prédiction
    const indexValue = toNum((body.match(/idx-val["'][^>]*>\s*([+\-\d.,]+?)\s*</) || [])[1]);

    // Probabilités : blocs .prob-itemPct avec têtes 1 / X / 2
    const probs = { 1: null, X: null, 2: null };
    const probRe = /prob-itemPct[\s\S]*?prob-head["'][^>]*>\s*([1X2])\s*<[\s\S]*?prob-val["'][^>]*>\s*(\d+)\s*%/g;
    let pm;
    while ((pm = probRe.exec(body))) probs[pm[1]] = toInt(pm[2]);

    // Score prédit : 2 lignes .livescore-score-line ("-" ou "–" = absent)
    const scoreLines = [...body.matchAll(/livescore-score-line["'][^>]*>([^<]*)</g)].map((s) => toInt(s[1]));

    // Score réel : .act-score-line dans .livescore-match-actual-col, sinon
    // badge mobile "FT 34:35" / "LIVE 12:10"
    const actualCol = (body.match(/livescore-match-actual-col["'][^>]*>([\s\S]*?)(?=<div class=["']livescore-match-prob-col|<div class=["']livescore-match-tip-badge-col|$)/) || [])[1] || '';
    let reelD = null;
    let reelE = null;
    // Tolère les classes supplémentaires (ex. "act-score-line text-ft" des scores FT)
    const actLines = [...actualCol.matchAll(/act-score-line[^>]*>(\d+)</g)].map((s) => toInt(s[1]));
    if (actLines.length >= 2) {
      reelD = actLines[0];
      reelE = actLines[1];
    } else {
      const badge = actualCol.match(/(?:FT|LIVE)[^\d<]{0,10}(\d+)\s*:\s*(\d+)/);
      if (badge) {
        reelD = toInt(badge[1]);
        reelE = toInt(badge[2]);
      }
    }

    // Cohérence "ne jamais inventer" : prédiction présente ⟺ INDEX non-null
    const hasPrediction = indexValue !== null;
    rows.push({
      fixture_id: fixtureId,
      league_id: leagueId,
      sport: SPORT,
      date_match: dateMatch,
      heure: heureFrom(dataTime),
      equipe_dom: teams[0],
      equipe_ext: teams[1],
      tip: hasPrediction ? tip : null,
      index_value: hasPrediction ? indexValue : null,
      prob_home: hasPrediction ? probs['1'] : null,
      prob_draw: hasPrediction ? probs['X'] : null,
      prob_away: hasPrediction ? probs['2'] : null,
      score_predit_d: hasPrediction ? scoreLines[0] : null,
      score_predit_e: hasPrediction ? scoreLines[1] : null,
      statut: statut,
      score_reel_d: reelD,
      score_reel_e: reelE,
      scraped_at: new Date().toISOString(),
    });
  }
  return rows;
}

/** Dates des onglets (changeDate('AAAA-MM-JJ')) depuis la page listing. */
function parseTabDates(html) {
  const out = [];
  const re = /changeDate\(["'](\d{4}-\d{2}-\d{2})["']/g;
  let m;
  while ((m = re.exec(html))) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out.sort();
}

// ─── Parser page détail (fallback --only=fixture) ─────────────────────────────
/**
 * Parse une page ?clanek={sport}-match-detail. La page détail ne reflète pas
 * l'état FT (scoreboard reste "? : ?") → statut déduit du JSON-LD uniquement.
 * Probas à zéros + INDEX 0 = pas de prédiction → NULL (jamais 0).
 */
function parseDetail(html) {
  // JSON-LD SportsEvent : nom, date, statut, forecast machine-readable
  const ldBlock = (html.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?"@type":\s*"SportsEvent"[\s\S]*?\})\s*<\/script>/) || [])[1];
  let ld = null;
  try { ld = ldBlock ? JSON.parse(ldBlock) : null; } catch { ld = null; }

  const name = (ld && ld.name) || '';
  const nameParts = name.split(/\s+vs\.?\s+/i);
  const equipeDom = nameParts.length > 1 ? decodeEntities(nameParts[0]) : null;
  const equipeExt = nameParts.length > 1 ? decodeEntities(nameParts.slice(1).join(' vs ')) : null;

  // startDate "2026-09-25T19:30:00+02:00" → date_match + heure locaux
  const start = (ld && ld.startDate) || '';
  const dateMatch = /^\d{4}-\d{2}-\d{2}/.test(start) ? start.slice(0, 10) : null;
  const heure = /T\d{2}:\d{2}/.test(start) ? start.slice(11, 16) : null;

  // Statut : "https://schema.org/EventScheduled" | EventInProgress | EventCompleted
  const evStatus = ((ld && ld.eventStatus) || '').toLowerCase();
  const statut = evStatus.includes('completed') ? 'finished'
    : evStatus.includes('inprogress') || evStatus.includes('in_progress') ? 'live'
    : 'scheduled';

  // Forecast : "Mathematical model forecast: Score 28:27 (Probabilities: Home 50%, Draw 7%, Away 43%)."
  const desc = (ld && ld.description) || '';
  const fc = desc.match(/forecast:\s*Score\s+(\d+)\s*:\s*(\d+)\s*\(Probabilities:\s*Home\s+(\d+)%,\s*Draw\s+(\d+)%,\s*Away\s+(\d+)%\)/i);
  let scorePreditD = null;
  let scorePreditE = null;
  let probHome = null;
  let probDraw = null;
  let probAway = null;
  if (fc) {
    scorePreditD = toInt(fc[1]);
    scorePreditE = toInt(fc[2]);
    probHome = toInt(fc[3]);
    probDraw = toInt(fc[4]);
    probAway = toInt(fc[5]);
  }

  // INDEX : bloc .analytics-index-box ("0" + probas nulles = pas de prédiction,
  // distingué par l'absence de forecast dans le JSON-LD)
  const idxMatch = html.match(/analytics-index-box["'][^>]*>[\s\S]*?font-weight:\s*900;["'][^>]*>([+\-\d.,]+)</);
  const indexRaw = toNum(idxMatch ? idxMatch[1] : null);
  const hasPrediction = fc !== null || (indexRaw !== null && indexRaw !== 0);
  const indexValue = hasPrediction ? indexRaw : null;

  // Tip : non affiché tel quel sur la page détail → déduit de la proba max
  // (cohérent avec le tip du listing ; égalité tranchée 1 > X > 2, déterministe)
  let tip = null;
  if (hasPrediction && probHome !== null) {
    const cands = [['1', probHome], ['X', probDraw || 0], ['2', probAway || 0]];
    cands.sort((a, b) => b[1] - a[1]);
    if (cands[0][1] > 0) tip = cands[0][0];
  }

  // Score réel : la page détail ne l'affiche pas de façon fiable → NULL
  // (le listing est la source FT de référence)
  return {
    fixture_id: null, // complété par l'appelant (URL / listing)
    league_id: null,
    sport: SPORT,
    date_match: dateMatch,
    heure: heure,
    equipe_dom: equipeDom,
    equipe_ext: equipeExt,
    tip: hasPrediction ? tip : null,
    index_value: indexValue,
    prob_home: hasPrediction ? probHome : null,
    prob_draw: hasPrediction ? probDraw : null,
    prob_away: hasPrediction ? probAway : null,
    score_predit_d: hasPrediction ? scorePreditD : null,
    score_predit_e: hasPrediction ? scorePreditE : null,
    statut: statut,
    score_reel_d: null,
    score_reel_e: null,
    scraped_at: new Date().toISOString(),
  };
}

/** Nom de ligue (barre supérieure détail) → id via liens sidebar /handball/tips/. */
function resolveLeagueIdFromDetail(html) {
  const navName = ((html.match(/top-nav-bar["'][^>]*>[\s\S]*?font-weight:\s*800;[^>]*>([^<]+)</) || [])[1] || '').trim().toLowerCase();
  if (!navName) return null;
  const slug = navName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const linkRe = /href=["'][^"']*\/tips\/([a-z0-9-]+)\/([a-z0-9-]+)\/(\d+)\/["']/g;
  let m;
  const candidates = [];
  while ((m = linkRe.exec(html))) {
    if (m[1] === slug || m[1] === navName.replace(/\s+/g, '-')) candidates.push(parseInt(m[3], 10));
  }
  return candidates.length === 1 ? candidates[0] : null;
}

// ─── DB (better-sqlite3, DDL exact plan §4) ───────────────────────────────────
const SQLITE_FILE =
  process.env.DATABASE_PATH || path.join(process.cwd(), 'pariscore.db');

function openDb() {
  const Database = require('better-sqlite3');
  const db = new Database(SQLITE_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS vitibet_tips (
      fixture_id     INTEGER NOT NULL,
      league_id      INTEGER NOT NULL,
      sport          TEXT DEFAULT 'hazena',
      date_match     TEXT,
      heure          TEXT,
      equipe_dom     TEXT,
      equipe_ext     TEXT,
      tip            TEXT,
      index_value    REAL,
      prob_home      INTEGER,
      prob_draw      INTEGER,
      prob_away      INTEGER,
      score_predit_d INTEGER,
      score_predit_e INTEGER,
      statut         TEXT,
      score_reel_d   INTEGER,
      score_reel_e   INTEGER,
      scraped_at     TEXT,
      PRIMARY KEY (fixture_id, league_id, date_match)
    );
  `);
  return db;
}

const upsertStmt = (db) => db.prepare(`
  INSERT OR REPLACE INTO vitibet_tips
    (fixture_id, league_id, sport, date_match, heure, equipe_dom, equipe_ext,
     tip, index_value, prob_home, prob_draw, prob_away,
     score_predit_d, score_predit_e, statut, score_reel_d, score_reel_e, scraped_at)
  VALUES (@fixture_id, @league_id, @sport, @date_match, @heure, @equipe_dom, @equipe_ext,
          @tip, @index_value, @prob_home, @prob_draw, @prob_away,
          @score_predit_d, @score_predit_e, @statut, @score_reel_d, @score_reel_e, @scraped_at)
`);

// ─── Pipeline ─────────────────────────────────────────────────────────────────
function logQa(rows) {
  // Compteurs QA (plan §6) : alerte si couverture anormalement basse
  const predicted = rows.filter((r) => r.index_value !== null);
  const leagues = new Set(rows.map((r) => r.league_id));
  console.log(`[vitibet] QA : ${rows.length} matchs, ${predicted.length} prédits, ${leagues.size} ligues`);
  if (predicted.length) {
    const weak = predicted.filter((r) =>
      [r.tip, r.index_value, r.prob_home, r.prob_draw, r.prob_away, r.score_predit_d, r.score_predit_e, r.date_match]
        .filter((v) => v !== null && v !== undefined).length < 8
    );
    if (weak.length) {
      console.warn(`[vitibet] QA : ${weak.length}/${predicted.length} matchs prédits avec < 8 champs non-null (refonte HTML ?)`);
    }
    const noTip = predicted.filter((r) => r.tip === null);
    if (noTip.length) {
      console.warn(`[vitibet] QA : ${noTip.length} matchs avec INDEX mais tip NULL — incohérent`);
    }
  }
}

async function scrapeListingDays() {
  // 1) Page du jour : découvre les dates d'onglets (J→J+3)
  const listingUrl = `${BASE_URL}/index.php?clanek=quicktips&sekce=${SPORT}&lang=en`;
  console.log(`[vitibet] listing : ${listingUrl}`);
  const first = await fetchText(listingUrl);
  let dates = parseTabDates(first.html);
  if (!dates.length) {
    // Fallback : fenêtre locale J→J+3
    dates = [];
    const today = new Date();
    for (let i = 0; i < DATE_WINDOW_DAYS; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
    }
    console.log('[vitibet] aucun onglet de date trouvé — fenêtre locale J→J+3 utilisée');
  }
  if (DATE_ARG) dates = dates.filter((d) => d === DATE_ARG);
  if (!dates.length) dates = [DATE_ARG].filter(Boolean);
  console.log(`[vitibet] dates : ${dates.join(', ')}`);

  // 2) Une requête par date (~1 req/s)
  const allRows = new Map(); // clé fixture/league → ligne unique (tip explicite gagne)
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const url = i === 0 && date === parseTabDates(first.html)[0]
      ? listingUrl
      : `${BASE_URL}/index.php?clanek=quicktips&sekce=${SPORT}&lang=en&date=${date}`;
    const res = i === 0 && url === listingUrl ? first : await fetchText(url);
    const rows = parseListing(res.html);
    console.log(`[vitibet] ${date} : ${rows.length} matchs`);
    for (const r of rows) {
      const key = `${r.fixture_id}/${r.league_id}`;
      const prev = allRows.get(key);
      if (!prev || (prev.tip === null && r.tip !== null)) allRows.set(key, r);
    }
    if (i < dates.length - 1) await sleep(DELAY_MS);
  }
  return [...allRows.values()];
}

async function scrapeSingleFixture(fixtureId, hintLeagueId) {
  // 1) Privilégier le listing (tip explicite + statut FT de référence)
  const rows = await scrapeListingDays();
  const found = rows.find((r) => r.fixture_id === fixtureId);
  if (found) return found;

  // 2) Fallback page détail (hors fenêtre) — league_id : hint, puis sidebar
  await sleep(DELAY_MS);
  const url = `${BASE_URL}/index.php?clanek=${SPORT}-match-detail&sekce=${SPORT}&lang=en&fixture_id=${fixtureId}` +
    (hintLeagueId ? `&league_id=${hintLeagueId}` : '');
  console.log(`[vitibet] fixture ${fixtureId} absente du listing — page détail : ${url}`);
  const res = await fetchText(url);
  const row = parseDetail(res.html);
  row.fixture_id = fixtureId;
  row.league_id = hintLeagueId || resolveLeagueIdFromDetail(res.html);
  if (row.league_id === null) {
    throw new Error(
      `league_id introuvable pour fixture ${fixtureId} — utiliser --only=fixture/${fixtureId}/LEAGUE_ID`
    );
  }
  return row;
}

async function main() {
  console.log(`[vitibet] démarrage — sport=${SPORT} only=${ONLY || '-'} date=${DATE_ARG || '-'} limit=${LIMIT || '-'} dryRun=${DRY_RUN} force=${FORCE}`);

  let rows;
  if (onlyFixtureId !== null) {
    rows = [await scrapeSingleFixture(onlyFixtureId, onlyFixtureLeagueId)];
  } else {
    rows = await scrapeListingDays();
    if (onlyLeagueId !== null) rows = rows.filter((r) => r.league_id === onlyLeagueId);
    rows.sort((a, b) => (a.date_match || '').localeCompare(b.date_match || '') || (a.heure || '').localeCompare(b.heure || ''));
    if (LIMIT > 0) rows = rows.slice(0, LIMIT);
  }

  if (!rows.length) {
    console.log('[vitibet] aucun match après filtres — rien à faire.');
    return;
  }
  logQa(rows);

  // ─── Dry-run : JSON complet, aucune écriture ────────────────────────────────
  if (DRY_RUN) {
    console.log(JSON.stringify(rows, null, 1));
    console.log(`[vitibet] dry-run : ${rows.length} matchs parsés, aucune écriture.`);
    return;
  }

  // ─── Invariant schéma : tip non-null ⟺ index_value non-null ─────────────────
  // (tip déduit de la proba max si le listing ne l'a pas rendu explicite)
  for (const r of rows) {
    if (r.index_value === null) {
      r.tip = null;
    } else if (r.tip === null && r.prob_home !== null) {
      const cands = [['1', r.prob_home], ['X', r.prob_draw || 0], ['2', r.prob_away || 0]];
      cands.sort((a, b) => b[1] - a[1]);
      if (cands[0][1] > 0) r.tip = cands[0][0];
    }
  }

  // ─── Skip-cache : ligne fraîche < 20h sauf statut 'scheduled' (transition
  //     vers 'finished' possible) — --force ignore tout ────────────────────────
  const db = openDb();
  const upsert = upsertStmt(db);
  const existing = new Map();
  for (const r of db.prepare('SELECT fixture_id, league_id, date_match, statut, scraped_at FROM vitibet_tips').all()) {
    existing.set(`${r.fixture_id}/${r.league_id}/${r.date_match}`, r);
  }
  const now = Date.now();
  let written = 0;
  let skipped = 0;
  for (const row of rows) {
    const prev = existing.get(`${row.fixture_id}/${row.league_id}/${row.date_match}`);
    if (!FORCE && prev && prev.scraped_at) {
      const age = now - new Date(prev.scraped_at).getTime();
      if (age < FRESH_TTL_MS && prev.statut !== 'scheduled') {
        skipped++;
        continue; // frais et statut terminal (ou live) → skip
      }
    }
    upsert.run(row);
    written++;
  }
  console.log(`[vitibet] terminé : écrits=${written} skip-cache=${skipped} (total=${rows.length})`);
  const count = db.prepare('SELECT COUNT(*) AS n FROM vitibet_tips').get();
  console.log(`[vitibet] table vitibet_tips : ${count.n} lignes`);
  db.close();
}

main().catch((err) => {
  console.error('[vitibet] ERREUR FATALE:', err);
  process.exit(1);
});
