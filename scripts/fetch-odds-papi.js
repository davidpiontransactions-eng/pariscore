#!/usr/bin/env node
'use strict';
/**
 * fetch-odds-papi.js
 * -------------------
 * Cotes handball OddsPapi (oddspapi.io) → data/odds_handball_papi.json
 *
 * Finding G6-2 : le feed Flashscore livre `"odds": []` → 2/3 bets prédictifs
 * handball tournent en "prob seule". Ce script branche la source OddsPapi
 * (293 tournois handball, Pinnacle inclus, free tier 250 req/mois).
 *
 * ─── Budget free tier (250 req/mois) — calcul ───────────────────────────────
 *   Par run quotidien :
 *     1 req  GET /v4/fixtures?sportId=22 (J..J+7, statusId=0, noms participants)
 *     1 req  GET /v4/odds-by-tournaments?tournamentIds=… (BATCH : toutes les
 *            ligues cibles en UNE seule requête, doc v4 : tournamentIds =
 *            liste CSV) → pas de req par ligue ni par match.
 *     0 req  GET /v4/account (endpoint "unmetered" doc requests-and-quota)
 *     → 2 req/jour × 30 = 60 req/mois = 24 % du quota.
 *   Worst case (hedges 400/param sur les 2 endpoints) : 4 req/run
 *     → 120 req/mois, toujours ≤ 250. Garde-fou MAX_BILLABLE_ATTEMPTS = 4.
 *   Découverte : les tournamentIds sont relus à chaque run dans la réponse
 *     /fixtures → zéro appel /tournaments ou /sports.
 *
 * ─── Clé API ────────────────────────────────────────────────────────────────
 *   ODDSPAPI_V4_KEY (convention server.js legacy) ou ODDSPAPI_KEY (oddspapi.js),
 *   lue depuis process.env puis .env. JAMAIS de clé en dur, jamais loguée.
 *   Absente → mode dégradé : message clair, exit 0 en --dry-run, exit 1 réel.
 *
 * ─── Sélection des bookmakers ───────────────────────────────────────────────
 *   Une seule liste pour fixtures+odds : pinnacle (marché 221 2 voies avec
 *   prolongations) + soft books (marché 223 1X2 temps régulier). Le "winner"
 *   retenu suit la règle : consensus (moyenne ≥2 books sur 223) → pinnacle →
 *   premier book de la liste. Voir buildWinner().
 *
 * Usage :
 *   node scripts/fetch-odds-papi.js --dry-run   # parse + affiche, n'écrit pas
 *   node scripts/fetch-odds-papi.js             # run réel (skip-cache <20h)
 *   node scripts/fetch-odds-papi.js --force     # ignore le skip-cache
 *
 * Cron VPS : pm2 `pariscore-cron-odds-papi`, quotidien 04:40 UTC.
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://api.oddspapi.io/v4';
const SPORT_HANDBALL = 22; // sportId handball OddsPapi (blog officiel handball-odds-api)
const WINDOW_DAYS = 7; // doc fixtures : from/to < 10 jours avec sportId
const MAX_TOURNAMENTS = 12; // plafond de ligues batchées par req odds
const MAX_BILLABLE_ATTEMPTS = 4; // garde-fou budget local (voir calcul ci-dessus)
const SKIP_FRESH_MS = 20 * 3_600_000; // skip-cache <20h (pattern oddalerts)
const HTTP_TIMEOUT_MS = 30000;
const BOOKMAKERS = 'pinnacle,bwin,unibet,bet365,1xbet,betmgm,draftkings';
// Marchés handball (catalogue officiel, blog oddspapi) :
//   223 = 1X2 temps régulier (outcomes 223/224/225) — soft books
//   221 = vainqueur 2 voies avec P.R. (outcomes 221/222) — Pinnacle
//   10208 = 1X2 mi-temps (best-effort, outcomes 10208/10209/10210)
const MKT_1X2 = '223';
const MKT_2WAY = '221';
const MKT_HT = '10208';
const KEY_1X2 = { 223: 'home', 224: 'draw', 225: 'away' };
const KEY_2WAY = { 221: 'home', 222: 'away' };
const KEY_HT = { 10208: 'home', 10209: 'draw', 10210: 'away' };

// ─── Ligues cibles (priorité G6-2) — match sur tournamentName/tournamentName ─
// Les noms OddsPapi diffèrent de Flashscore ("Starligue" vs "LNH Division 1")
// → regex tolérantes, femmes dépriorisées (hors périmètre de la boucle).
function priorityScore(name) {
  const n = String(name || '');
  if (/women|female|\bf\b/i.test(n)) return 99;
  if (/^bundesliga$/i.test(n)) return 0; // Bundesliga DE (hors "2. Bundesliga")
  if (/dhb\s*-?\s*pokal/i.test(n)) return 1; // DHB-Pokal
  if (/starligue|\blnh\b/i.test(n)) return 2; // StarLigue / LNH Division 1 FR
  if (/asobal/i.test(n)) return 3; // Liga ASOBAL ES
  if (/ehf|champions league|european (league|cup)/i.test(n)) return 4; // coupes EHF
  return 50; // reste du monde (couvre si des slots restent)
}

// ─── .env (pattern vault-daily-summary.js) ──────────────────────────────────
const ROOT = path.join(__dirname, '..');
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  envContent.split('\n').forEach((line) => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch {
  // .env absent : on retombe sur process.env uniquement
}

function apiKey() {
  return process.env.ODDSPAPI_V4_KEY || process.env.ODDSPAPI_KEY ||
    ENV.ODDSPAPI_V4_KEY || ENV.ODDSPAPI_KEY || '';
}

// ─── HTTP ────────────────────────────────────────────────────────────────────
let billableUsed = 0; // req comptées (fixtures + odds-by-tournaments)

async function billable(url) {
  if (billableUsed >= MAX_BILLABLE_ATTEMPTS) {
    throw new Error(`budget local atteint (${MAX_BILLABLE_ATTEMPTS} tentatives billables)`);
  }
  billableUsed += 1;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body.slice(0, 140)}`);
  }
  return res.json();
}

/** GET /v4/account — endpoint unmetered (0 req) : quota réel si disponible. */
async function fetchAccount() {
  try {
    const res = await fetch(`${BASE}/account?apiKey=${encodeURIComponent(apiKey())}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const limit = d?.request_limit ?? d?.subscription?.request_limit;
    const used = d?.request_count ?? d?.subscription?.request_count;
    if (Number.isFinite(limit) && Number.isFinite(used)) {
      return { limit, used, remaining: Math.max(0, limit - used) };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Parsing des marchés d'une réponse bookmakerOdds ─────────────────────────
function readPrice(outcome) {
  const players = outcome && outcome.players;
  if (!players || typeof players !== 'object') return null;
  const pl = players['0'] ?? (Array.isArray(players) ? players[0] : null);
  if (!pl || pl.active === false) return null;
  const p = Number(pl.price);
  return Number.isFinite(p) && p > 1 ? p : null;
}

function selectionOf(outcome) {
  const pl = outcome?.players?.['0'];
  const b = String(pl?.bookmakerOutcomeId ?? '').toLowerCase();
  if (b === 'home') return 'home';
  if (b === 'draw') return 'draw';
  if (b === 'away') return 'away';
  return null;
}

/** Normalise markets (objet ou tableau) → objet {id: market}. */
function asMarketMap(markets) {
  if (!markets) return {};
  if (Array.isArray(markets)) {
    const out = {};
    for (const m of markets) {
      const id = m?.marketId ?? m?.id;
      if (id != null) out[String(id)] = m;
    }
    return out;
  }
  return markets;
}

/** 1X2 d'un book : marché "223" d'abord, sinon tout marché home/draw/away. */
function extract1x2(rawMarkets) {
  const markets = asMarketMap(rawMarkets);
  const scan = (mid, keyMap) => {
    const m = markets[mid];
    if (!m?.outcomes) return null;
    const acc = {};
    for (const [oid, o] of Object.entries(m.outcomes)) {
      const sel = selectionOf(o) || keyMap[Number(oid)] || null;
      if (!sel) continue;
      const price = readPrice(o);
      if (price != null) acc[sel] = price;
    }
    return acc.home != null && acc.away != null ? acc : null;
  };
  const primary = scan(MKT_1X2, KEY_1X2);
  if (primary) return primary;
  for (const mid of Object.keys(markets)) {
    if (mid === MKT_1X2) continue;
    const hit = scan(mid, null);
    if (hit) return hit;
  }
  return null;
}

/** Vainqueur 2 voies (marché 221, Pinnacle) : home/away seulement. */
function extract2way(rawMarkets) {
  const markets = asMarketMap(rawMarkets);
  const m = markets[MKT_2WAY];
  if (!m?.outcomes) return null;
  const acc = {};
  for (const [oid, o] of Object.entries(m.outcomes)) {
    const sel = selectionOf(o) || KEY_2WAY[Number(oid)] || null;
    if (!sel || sel === 'draw') continue;
    const price = readPrice(o);
    if (price != null) acc[sel] = price;
  }
  return acc.home != null && acc.away != null ? acc : null;
}

/** Totaux d'un book : boi "55.5/over" | "62.5/under" → Map(line → côtés). */
function extractTotalsByBook(rawMarkets) {
  const markets = asMarketMap(rawMarkets);
  const byLine = new Map();
  for (const m of Object.values(markets)) {
    if (!m?.outcomes) continue;
    for (const o of Object.values(m.outcomes)) {
      const pl = o?.players?.['0'];
      const boi = String(pl?.bookmakerOutcomeId ?? '');
      const mm = /^(\d+(?:\.\d+)?)\/(over|under)$/i.exec(boi);
      if (!mm) continue;
      const price = readPrice(o);
      if (price == null) continue;
      const line = parseFloat(mm[1]);
      const side = mm[2].toLowerCase();
      if (!byLine.has(line)) byLine.set(line, { over: [], under: [], quotes: 0 });
      const entry = byLine.get(line);
      entry[side].push(price);
      entry.quotes += 1;
    }
  }
  return byLine;
}

/**
 * Handicap d'un book : boi "-4.5/home" / "+4.5/away" (lignes opposées).
 * Si Papi n'expose pas la ligne dans bookmakerOutcomeId → null (dégradé
 * honnête, signalé au rapport — pas de heuristique sur les ids internes).
 */
function extractHandicapByBook(rawMarkets) {
  const markets = asMarketMap(rawMarkets);
  const RE = /^([+-]?\d+(?:\.\d+)?)\/(home|away)$/i;
  for (const m of Object.values(markets)) {
    if (!m?.outcomes) continue;
    const found = { home: null, away: null, homeLine: null, mainLine: false };
    for (const o of Object.values(m.outcomes)) {
      const pl = o?.players?.['0'];
      const mm = RE.exec(String(pl?.bookmakerOutcomeId ?? ''));
      if (!mm) continue;
      const price = readPrice(o);
      if (price == null) continue;
      const side = mm[2].toLowerCase();
      if (found[side] == null) {
        found[side] = price;
        found[side === 'home' ? 'homeLine' : 'awayLine'] = parseFloat(mm[1]);
      }
      if (pl?.mainLine === true) found.mainLine = true;
    }
    if (
      found.home != null && found.away != null &&
      found.homeLine != null && found.awayLine != null &&
      Math.abs(found.homeLine + found.awayLine) < 1e-9
    ) {
      return {
        line: found.homeLine,
        home: found.home,
        away: found.away,
        mainLine: found.mainLine,
      };
    }
  }
  return null;
}

/** 1X2 mi-temps (marché 10208, best-effort) → {home,draw,away} | null. */
function extractHt(rawMarkets) {
  const markets = asMarketMap(rawMarkets);
  const m = markets[MKT_HT];
  if (!m?.outcomes) return null;
  const acc = {};
  for (const [oid, o] of Object.entries(m.outcomes)) {
    const sel = selectionOf(o) || KEY_HT[Number(oid)] || null;
    if (!sel) continue;
    const price = readPrice(o);
    if (price != null) acc[sel] = price;
  }
  return acc.home != null && acc.away != null ? acc : null;
}

function mean(list) {
  if (!list.length) return undefined;
  return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 1000) / 1000;
}

/**
 * Winner retenu — règle du brief : consensus (moyenne ≥2 books sur 223),
 * sinon Pinnacle (223 si dispo, sinon 2-way 221 avec P.R.), sinon premier
 * book de BOOKMAKERS. Le 2-way Pinnacle n'alimente PAS le consensus (marché
 * sémantiquement différent : prolongations incluses) → draw reste undefined.
 */
function buildWinner(bookEntries) {
  const x12 = [];
  let pin2way = null;
  for (const bk of BOOKMAKERS.split(',')) {
    const entry = bookEntries.get(bk);
    if (!entry) continue;
    const x = extract1x2(entry.markets);
    if (x) x12.push({ slug: bk, ...x });
    else if (bk === 'pinnacle') pin2way = extract2way(entry.markets);
  }
  const aggregate = (rows) => ({
    home: mean(rows.map((r) => r.home).filter((v) => v != null)),
    draw: mean(rows.map((r) => r.draw).filter((v) => v != null)),
    away: mean(rows.map((r) => r.away).filter((v) => v != null)),
  });
  if (x12.length >= 2) return { bookmaker: 'consensus', ...aggregate(x12), sources: x12.map((r) => r.slug) };
  const pin = x12.find((r) => r.slug === 'pinnacle');
  if (pin) return { bookmaker: 'pinnacle', home: pin.home, draw: pin.draw, away: pin.away, sources: ['pinnacle'] };
  if (pin2way) return { bookmaker: 'pinnacle', home: pin2way.home, away: pin2way.away, sources: ['pinnacle'] };
  if (x12.length === 1) {
    const only = x12[0];
    return { bookmaker: only.slug, home: only.home, draw: only.draw, away: only.away, sources: [only.slug] };
  }
  return null;
}

/** Agrège les totaux de tous les books → [{line, over?, under?, quotes}]. */
function aggregateTotals(bookEntries) {
  const acc = new Map(); // line → {over:[], under:[], quotes}
  for (const entry of bookEntries.values()) {
    for (const [line, sides] of extractTotalsByBook(entry.markets)) {
      if (!acc.has(line)) acc.set(line, { over: [], under: [], quotes: 0 });
      const t = acc.get(line);
      t.over.push(...sides.over);
      t.under.push(...sides.under);
      t.quotes += sides.quotes;
    }
  }
  const rows = [...acc.entries()]
    .map(([line, t]) => ({
      line,
      over: t.over.length ? mean(t.over) : undefined,
      under: t.under.length ? mean(t.under) : undefined,
      quotes: t.quotes,
    }))
    .sort((a, b) => a.line - b.line);
  return rows;
}

/** Meilleure paire over/under (couverture max, tie → ligne la plus basse). */
function pickTotalPair(totals) {
  const pairs = totals.filter((t) => t.over != null && t.under != null);
  if (!pairs.length) return null;
  pairs.sort((a, b) => (b.quotes ?? 0) - (a.quotes ?? 0) || a.line - b.line);
  const best = pairs[0];
  return { line: best.line, over: best.over, under: best.under };
}

/** Handicap agrégé : ligne mainLine d'abord, sinon |line| la plus proche. */
function aggregateHandicap(bookEntries) {
  const rows = [];
  for (const entry of bookEntries.values()) {
    const h = extractHandicapByBook(entry.markets);
    if (h) rows.push(h);
  }
  if (!rows.length) return null;
  rows.sort((a, b) => Number(b.mainLine) - Number(a.mainLine) || Math.abs(a.line) - Math.abs(b.line));
  const ref = rows[0];
  const sameLine = rows.filter((r) => Math.abs(Math.abs(r.line) - Math.abs(ref.line)) < 1e-9);
  return {
    line: ref.line,
    home: mean(sameLine.map((r) => r.home)),
    away: mean(sameLine.map((r) => r.away)),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const FORCE = ARGS.includes('--force');

function isoDate(d) {
  return d.toISOString();
}

async function main() {
  const outPath = path.join(ROOT, 'data', 'odds_handball_papi.json');

  // ── Mode dégradé : clé absente ──
  const key = apiKey();
  if (!key) {
    console.error('[odds-papi] ODDSPAPI_V4_KEY / ODDSPAPI_KEY absente (process.env + .env).');
    console.error('[odds-papi] Inscription requise sur https://oddspapi.io (free tier 250 req/mois),');
    console.error('[odds-papi] puis ajouter ODDSPAPI_V4_KEY=<clé> au .env.');
    if (DRY_RUN) {
      console.log('[odds-papi] dry-run sans clé → rien à fetcher, exit 0.');
      process.exit(0);
    }
    process.exit(1);
  }

  // ── Skip-cache (<20h) sauf --force / --dry-run ──
  if (!FORCE && !DRY_RUN) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const age = Date.now() - Date.parse(prev.scraped_at);
      if (Number.isFinite(age) && age < SKIP_FRESH_MS) {
        console.log(`[odds-papi] snapshot déjà frais (${Math.round(age / 3600000)}h < 20h) → skip (utilise --force)`);
        process.exit(0);
      }
    } catch {
      // pas de snapshot précédent → on continue
    }
  }

  // ── Req 1 (billable) : fixtures handball à venir (noms + tournamentIds) ──
  const from = new Date(Date.now() - 24 * 3600 * 1000);
  const to = new Date(Date.now() + WINDOW_DAYS * 24 * 3600 * 1000);
  const fxUrl = `${BASE}/fixtures?apiKey=${encodeURIComponent(key)}` +
    `&sportId=${SPORT_HANDBALL}&from=${encodeURIComponent(isoDate(from))}` +
    `&to=${encodeURIComponent(isoDate(to))}&statusId=0&language=en`;
  console.log(`[odds-papi] fixtures ${isoDate(from)} → ${isoDate(to)} (statusId=0)`);
  let fixtures = await billable(fxUrl);
  if (!Array.isArray(fixtures)) fixtures = [];

  // ── Sélection des ligues : priorité G6-2, plafond MAX_TOURNAMENTS ──
  const tourById = new Map();
  for (const fx of fixtures) {
    if (!fx?.fixtureId || fx.statusId !== 0) continue;
    const id = fx.tournamentId;
    if (id == null || tourById.has(id)) continue;
    tourById.set(id, {
      id,
      name: fx.tournamentName || '',
      score: priorityScore(fx.tournamentName),
    });
  }
  const selected = [...tourById.values()]
    .sort((a, b) => a.score - b.score || a.id - b.id)
    .slice(0, MAX_TOURNAMENTS);
  const selectedIds = new Set(selected.map((t) => t.id));
  console.log(`[odds-papi] ${fixtures.length} fixtures, ${tourById.size} ligues → ${selectedIds.size} batchées : ` +
    selected.map((t) => `${t.name}(${t.score})`).join(', '));
  if (!selectedIds.size) {
    console.log('[odds-papi] aucune fixture à venir → sortie sans req odds.');
    await writeSnapshot(outPath, [], 0);
    return;
  }

  // ── Req 2 (billable) : odds pour TOUTES les ligues en une requête (batch) ──
  const ids = [...selectedIds].join(',');
  let oddsUrl = `${BASE}/odds-by-tournaments?apiKey=${encodeURIComponent(key)}` +
    `&tournamentIds=${ids}&bookmakers=${encodeURIComponent(BOOKMAKERS)}&oddsFormat=decimal`;
  let oddsRows;
  try {
    oddsRows = await billable(oddsUrl);
  } catch (err) {
    // Hedge : la doc v4 montre aussi le param singulier `bookmaker` — 1 retry.
    console.warn(`[odds-papi] odds-by-tournaments KO (${err.message}) → retry param singulier`);
    oddsUrl = `${BASE}/odds-by-tournaments?apiKey=${encodeURIComponent(key)}` +
      `&tournamentIds=${ids}&bookmaker=${encodeURIComponent(BOOKMAKERS)}&oddsFormat=decimal`;
    oddsRows = await billable(oddsUrl);
  }
  if (!Array.isArray(oddsRows)) oddsRows = [];

  // ── Assemblage fixture ↔ odds (jointure par fixtureId) ──
  const oddsByFx = new Map();
  for (const row of oddsRows) {
    if (row?.fixtureId && row.bookmakerOdds) oddsByFx.set(row.fixtureId, row.bookmakerOdds);
  }
  const events = [];
  for (const fx of fixtures) {
    if (!fx?.fixtureId || fx.statusId !== 0 || !selectedIds.has(fx.tournamentId)) continue;
    if (!fx.participant1Name || !fx.participant2Name) continue;
    const books = oddsByFx.get(fx.fixtureId);
    if (!books) continue;

    const bookEntries = new Map();
    for (const [slug, bdata] of Object.entries(books)) {
      if (bdata && bdata.markets) bookEntries.set(slug.toLowerCase(), bdata);
    }
    const winner = buildWinner(bookEntries);
    if (!winner) continue; // sans 1X2 ni 2-way → event non exploitable

    const totals = aggregateTotals(bookEntries);
    const handicap = aggregateHandicap(bookEntries);
    const htList = [];
    for (const entry of bookEntries.values()) {
      const ht = extractHt(entry.markets);
      if (ht) htList.push(ht);
    }

    events.push({
      home: fx.participant1Name,
      away: fx.participant2Name,
      league: fx.tournamentName || '',
      country: fx.categoryName || '',
      kickoff: fx.startTime || '',
      fixtureId: fx.fixtureId,
      bookmaker: winner.bookmaker,
      winner: { home: winner.home, draw: winner.draw, away: winner.away },
      total: pickTotalPair(totals),
      totals,
      ht: htList.length
        ? {
            home: mean(htList.map((h) => h.home).filter((v) => v != null)),
            draw: mean(htList.map((h) => h.draw).filter((v) => v != null)),
            away: mean(htList.map((h) => h.away).filter((v) => v != null)),
          }
        : null,
      handicap,
    });
  }
  events.sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
  console.log(`[odds-papi] ${events.length} events avec cotes (${oddsByFx.size} fixtures cotes reçues)`);

  await writeSnapshot(outPath, events, billableUsed);
}

async function writeSnapshot(outPath, events, requestsUsed) {
  // Budget : /v4/account est unmetered → reste réel si dispo, sinon estimation
  // doc free tier 250 − consommé (champ nommé *_estimate pour rester honnête).
  const account = await fetchAccount();
  const budget = {
    requests_used: requestsUsed,
    free_tier_remaining_estimate:
      account && account.remaining != null ? account.remaining : Math.max(0, 250 - requestsUsed),
    ...(account ? { free_tier_limit: account.limit, free_tier_used: account.used } : {}),
  };
  const snapshot = {
    scraped_at: new Date().toISOString(),
    source: 'oddspapi',
    budget,
    events,
  };

  if (DRY_RUN) {
    console.log(JSON.stringify({ ...snapshot, events: events.slice(0, 3) }, null, 2));
    console.log(`[odds-papi] dry-run → ${events.length} events, non écrit (budget: ${budget.requests_used} req)`);
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`[odds-papi] OK ${events.length} events -> ${outPath} ` +
    `(${budget.requests_used} req, reste ~${budget.free_tier_remaining_estimate})`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[odds-papi] FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = {
  priorityScore,
  extract1x2,
  extract2way,
  extractTotalsByBook,
  extractHandicapByBook,
  buildWinner,
  aggregateTotals,
  pickTotalPair,
};
