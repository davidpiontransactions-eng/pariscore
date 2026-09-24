#!/usr/bin/env node
'use strict';
/**
 * scrape-lnh.js
 * ------------
 * Routine GRATUITE et régulière des données officielles LNH (lnh.fr) pour
 * l'onglet Handball (StarLigue) :
 *
 *   1. calendrier/résultats StarLigue   → data/lnh_calendar.json
 *   2. classement                       → data/lnh_standing.json
 *   3. stats joueurs (champ + gardiens) → data/lnh_players.json
 *   4. stats équipes (attaques/défenses/arrêts/passes/pertes)
 *                                      → data/lnh_teamstats.json
 *
 * SOURCE (repérage 2026-09-24, aucun WAF, robots.txt = 404) :
 *   Les pages lnh.fr sont du SSR « vide » : le tableau est injecté en AJAX par
 *   apps.initPluginFilter() → POST https://www.lnh.fr/ajaxpost1 avec le
 *   formulaire de la page (seasons_id, key, univers, pagination…) + les
 *   paramètres contents_controller / contents_action / cache / cacheKeys.
 *
 *   Contrôleur | action       | page GET                  | sortie
 *   -----------|--------------|---------------------------|--------
 *   sportsPlayersStats | index_ajax | /daikin-starligue/stats/joueurs   | ligne « total buts »
 *   sportsPlayersStats | index_ajax | /daikin-starligue/stats/gardiens  | ligne « total arrêts »
 *   sportsStandings    | index_ajax | /daikin-starligue/classement      | classement
 *   sportsCalendars    | index_ajax | /daikin-starligue/calendrier      | liste des matchs
 *   sportsTeamsStats   | index_ajax | /daikin-starligue/stats/clubs     | stats clubs
 *
 *   Chaque page GET sert aussi à récupérer le `key` (jeton de formulaire) et la
 *   saison active (seasons_id) : on ne fige JAMAIS ces valeurs en dur, le
 *   run reste valide quand la LNH régénère ses pages.
 *
 * STATUT JURIDIQUE (G13 + validation utilisateur du 2026-09-24) :
 *   robots.txt 404 (aucune restriction) + fetch 200 sans WAF, MAIS ToS
 *   propriétaire interdisant la reproduction (L.335-2 CPI) → scraping
 *   VALIDÉ EXPLICITEMENT par l'opérateur pour un usage interne de scores et
 *   statistiques publics de compétition (aucune copie d'article, aucun
 *   contournement technique). Garde-fous respectés ci-dessous :
 *     - rate-limit doux : ≥ 1,5 s entre 2 requêtes, budget 40 pages/run
 *     - User-Agent navigateur réaliste + Referer du site
 *     - 403 / challenge Cloudflare → STOP immédiat (aucun retry de contournement)
 *
 * Sortie (écriture all-or-nothing, idempotente — un run réécrit tout proprement) :
 *   data/lnh_players.json    shape aligné sur data/hbl_players.json
 *                            ({scraped_at, competition:"starligue", season,
 *                              source, total, teams, players:[{name, team,
 *                              competition, position, goals, games, minutes,
 *                              avgGoals, sevenMGoals, shots, rating,
 *                              saves, savePct, goalsAgainst}]})
 *   data/lnh_calendar.json   {…, total, matches:[{id, day, date, home, away,
 *                              status, home_score, away_score, url}]}
 *   data/lnh_standing.json   {…, total, standing:[{rank, team, points, played,
 *                              wins, draws, losses, goals_for, goals_against, …}]}
 *   data/lnh_teamstats.json  {…, metrics, teams:[{team, played, metrics:{…}}]}
 *
 * Usage :
 *   node scripts/scrape-lnh.js                       # run complet
 *   node scripts/scrape-lnh.js --dry-run             # parse + volumes, sans écrire
 *   node scripts/scrape-lnh.js --only=players        # calendar|standing|players|teamstats
 *   node scripts/scrape-lnh.js --only=calendar,standing
 *   node scripts/scrape-lnh.js --season=40           # force une saison LNH
 *   node scripts/scrape-lnh.js --out=/tmp/lnh        # dossier de sortie
 *
 * Cron (ecosystem.config.js → pariscore-cron-lnh, quotidien 21:30 UTC) :
 *   pas de skip-cache → `pm2 restart pariscore-cron-lnh` force un run immédiat.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://www.lnh.fr';
const UNIVERS = 'd1-26623'; // univers LNH « Daikin StarLigue » (issu des formulaires)
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DELAY_MS = 1500; // ≥ 1,5 s entre 2 requêtes (rate-limit doux imposé)
const MAX_REQUESTS = 40; // budget pages par run
const MAX_PLAYER_PAGES = 15; // 15 × 50 = 750 joueurs de champ max
const HTTP_TIMEOUT_MS = 30000;
const RETRIES = 2;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
// DATA_DIR prioritaire (comme la lecture côté Next.js) — sinon data/ du repo.
const DATA_DIR = process.env.DATA_DIR || path.join(REPO_DIR, 'data');

const OUT_FILES = {
  players: 'lnh_players.json',
  calendar: 'lnh_calendar.json',
  standing: 'lnh_standing.json',
  teamstats: 'lnh_teamstats.json',
};

// Métriques clubs récupérées (optgroup « Classements » de /stats/clubs).
const TEAM_METRICS = [
  { order: 'attacks', key: 'goals_for', label: 'buts marqués' },
  { order: 'defenses', key: 'goals_against', label: 'buts encaissés' },
  { order: 'total_stops', key: 'saves', label: 'arrêts' },
  { order: 'total_assists', key: 'assists', label: 'dernières passes' },
  { order: 'total_turnovers', key: 'turnovers', label: 'pertes de balles' },
];

/**
 * Noms canoniques des clubs StarLigue : slug du logo LNH → nom utilisé par les
 * sources de matchs de la popup (flashscore / BetExplorer, ex. data/flashscore_
 * handball.json). Sans ce pont, « Paris » (LNH) ne matche jamais « PSG » ni
 * « Saint-Raphaël » ↔ « St. Raphael » dans teamsMatch (inclusion normalisée).
 * Un club absent de la table prend son titre officiel LNH (calendrier).
 */
const TEAM_NAMES = {
  aix: 'Provence Aix',
  caen: 'Caen',
  'cesson-rennes': 'Cesson Rennes-Metropole',
  chambery: 'Chambery Savoie',
  chartres: 'Chartres',
  dunkerque: 'Dunkerque',
  limoges: 'Limoges',
  montpellier: 'Montpellier',
  nantes: 'Nantes',
  nimes: 'Nimes',
  paris: 'PSG',
  'saint-raphael': 'St. Raphael',
  saran: 'Saran',
  selestat: 'Selestat',
  toulouse: 'Toulouse',
  tremblay: 'Tremblay',
};

const FR_MONTHS = {
  janv: 1,
  'févr': 2,
  fevr: 2,
  mars: 3,
  avr: 4,
  mai: 5,
  juin: 6,
  juil: 7,
  'aout': 8,
  'août': 8,
  sept: 9,
  oct: 10,
  nov: 11,
  'déc': 12,
  dec: 12,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

/** Normalisation insensible accents/casse/ponctuation — miroir de normHandballName. */
function normHandballName(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** slug logo LNH → nom canonique popup (repli : titre officiel, sinon slug). */
function teamFromSlug(slug, officialName) {
  if (TEAM_NAMES[slug]) return TEAM_NAMES[slug];
  if (officialName) return officialName;
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── HTTP (node:https zéro-dép, pattern scrape-hbl-players.js) ───────────────
let _lastCall = 0;
let _calls = 0;

class BudgetError extends Error {}

/** Throttle ≥1,5 s + budget de pages ; lève BudgetError une fois épuisé. */
async function throttle() {
  if (_calls >= MAX_REQUESTS) {
    throw new BudgetError(`budget de ${MAX_REQUESTS} pages/run épuisé`);
  }
  const wait = _lastCall + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  _lastCall = Date.now();
  _calls += 1;
}

function rawRequest(url, { method = 'GET', body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = https.request(
        url,
        {
          method,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/json,*/*',
            'Accept-Language': 'fr-FR,fr;q=0.9',
            ...headers,
          },
        },
        (res) => {
          let s = '';
          res.setEncoding('utf8');
          res.on('data', (d) => {
            s += d;
          });
          res.on('end', () => {
            // STOP strict : bloqué (403/CF/429) → on ne tente aucun contournement.
            if (res.statusCode === 403 || res.statusCode === 429 || res.statusCode === 503) {
              reject(
                new Error(
                  `HTTP ${res.statusCode} sur ${url} — blocage détecté, arrêt du run (aucun contournement)`
                )
              );
              return;
            }
            if (res.statusCode === 200) {
              resolve(s);
              return;
            }
            if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
            reject(new Error(`HTTP ${res.statusCode} sur ${url}`));
          });
        }
      );
      req.on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
        reject(e);
      });
      req.setTimeout(HTTP_TIMEOUT_MS, () => req.destroy(new Error('timeout')));
      if (body) req.write(body);
      req.end();
    };
    attempt(RETRIES);
  });
}

/** GET d'une page LNH (sert de « formulaire source » : key + saison). */
async function getPage(pathname) {
  await throttle();
  return rawRequest(`${BASE}${pathname}`, { headers: { Referer: `${BASE}/accueil` } });
}

/** POST /ajaxpost1 — fragment HTML du tableau demandé. */
async function postAjax(controller, fields, referer) {
  await throttle();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith('__')) continue; // métadonnées internes (saison), pas un champ
    params.append(k, String(v));
  }
  params.append('contents_controller', controller);
  params.append('contents_action', 'index_ajax');
  params.append('cache', 'no');
  params.append(
    'cacheKeys',
    'univers,contents_controller,contents_action,seasons_id,pagination-current,order,type'
  );
  return rawRequest(`${BASE}/ajaxpost1`, {
    method: 'POST',
    body: params.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': BASE,
      'Referer': referer || `${BASE}/daikin-starligue/stats/joueurs`,
    },
  });
}

// ─── Parsing HTML (regex ciblées : le site ne publie pas d'API JSON) ─────────
function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function attrsOf(tag) {
  const out = {};
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = m[2] ?? m[3] ?? m[4];
  return out;
}

/**
 * Extrait les champs (inputs + selects) du formulaire d'une page LNH.
 * Renvoie { fields, seasonId, seasonLabel } — le `key` et la saison sont
 * toujours relus sur la page, jamais codés en dur.
 */
function extractForm(html, idPrefix) {
  const forms = [...html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/gi)];
  const form = forms.find((f) => (attrsOf(f[1]).id || '').startsWith(idPrefix));
  if (!form) throw new Error(`formulaire ${idPrefix}* introuvable`);
  const body = form[2];
  const fields = {};
  let m;
  const inputRe = /<input\b([^>]*)\/?>/gi;
  while ((m = inputRe.exec(body))) {
    const a = attrsOf(m[1]);
    if (a.name) fields[a.name] = a.value === undefined ? '' : a.value;
  }
  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  while ((m = selectRe.exec(body))) {
    const a = attrsOf(m[1]);
    if (!a.name) continue;
    const opts = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
    const sel = opts.find((o) => /(?<![\w-])selected(?![\w-])/i.test(o[1])) || opts[0];
    if (!sel) continue;
    const value = (attrsOf(sel[1]).value ?? '').trim();
    fields[a.name] = value;
    if (a.name === 'seasons_id') {
      fields.__seasonLabel = stripTags(sel[2]);
      fields.__seasonId = value;
    }
  }
  return fields;
}

/** Lignes d'un tableau (cells = texte de chaque <td>). */
function tableRows(html) {
  const rows = [];
  const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = re.exec(html))) {
    const body = m[1];
    if (!/<td\b/i.test(body)) continue;
    rows.push({
      html: body,
      cells: [...body.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1])),
    });
  }
  return rows;
}

/** "25 / 31" → [25, 31] ; "80,65 %" → 80.65 ; "02:05:38" → 125 min. */
function num(s) {
  const m = /(-?\d+(?:[.,]\d+)?)/.exec(String(s ?? ''));
  return m ? Number(m[1].replace(',', '.')) : null;
}
function pair(s) {
  const m = /^(\d+)\s*\/\s*(\d+)/.exec(String(s ?? '').trim());
  return m ? [Number(m[1]), Number(m[2])] : [null, null];
}
function parseHms(s) {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]) + Math.round(Number(m[3]) / 60);
}

// ─── Parsers de surface ──────────────────────────────────────────────────────

/** Stats joueurs (type=joueurs) ou gardiens (type=gardiens) → joueurs normalisés. */
function parsePlayers(html, position) {
  const out = [];
  for (const row of tableRows(html)) {
    const name = /<div class="name">\s*<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i.exec(row.html);
    const slug = /sports_teams\/([a-z0-9-]+?)__logo__/i.exec(row.html);
    if (!name || !slug) continue;
    const player = {
      name: stripTags(name[1]),
      team: teamFromSlug(slug[1]),
      competition: 'starligue',
      position,
      goals: 0,
      games: num(row.cells[10]) ?? 0,
      minutes: parseHms(row.cells[12]),
      rating: num(row.cells[11]) ?? undefined,
    };
    if (player.games < 1) continue; // moyennes inexploitables sans match

    if (position === 'Field') {
      const [goals, shots] = pair(row.cells[1]);
      const [penaltyGoals] = pair(row.cells[7]);
      player.goals = goals ?? 0;
      player.shots = shots ?? undefined;
      player.sevenMGoals = penaltyGoals ?? 0;
      player.avgGoals = player.games > 0 ? round2(player.goals / player.games) : undefined;
    } else {
      const [saves, faced] = pair(row.cells[1]);
      const pct = num(row.cells[2]);
      player.goals = 0;
      player.saves = saves ?? 0;
      player.savePct = pct ?? undefined;
      player.goalsAgainst =
        saves != null && faced != null ? Math.max(0, faced - saves) : undefined;
    }
    out.push(player);
  }
  return out;
}

/** Classement StarLigue (nom canonique via slug du logo, repli = texte de la colonne). */
function parseStanding(html) {
  const out = [];
  for (const row of tableRows(html)) {
    if (row.cells.length < 11) continue;
    const rank = num(row.cells[0]);
    if (rank == null || !row.cells[1]) continue;
    const slug = /sports_teams\/([a-z0-9-]+?)__logo__/i.exec(row.html);
    out.push({
      rank,
      team: teamFromSlug(slug ? slug[1] : '', row.cells[1]),
      points: num(row.cells[2]) ?? 0,
      played: num(row.cells[3]) ?? 0,
      wins: num(row.cells[4]) ?? 0,
      losses: num(row.cells[5]) ?? 0,
      draws: num(row.cells[6]) ?? 0,
      goals_for: num(row.cells[7]) ?? 0,
      goals_against: num(row.cells[8]) ?? 0,
      goal_diff: num(row.cells[9]) ?? 0,
      // Colonnes propriétaires LNH (« part. pts » / « part. goals »), sémantique
      // non documentée → conservées brutes pour ne pas perdre d'information.
      lnh_part_pts: num(row.cells[10]) ?? 0,
      lnh_part_goals: num(row.cells[11]) ?? 0,
    });
  }
  return out;
}

/** Stats clubs (une ligne = un club, 4 colonnes : rang+club, total, moyenne, m.j.). */
function parseTeamStats(html) {
  const out = [];
  for (const row of tableRows(html)) {
    if (row.cells.length < 4) continue;
    const name = /<div class="name">\s*<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i.exec(row.html);
    const slug = /sports_teams\/([a-z0-9-]+?)__logo__/i.exec(row.html);
    const team = teamFromSlug(slug ? slug[1] : '', name ? stripTags(name[1]) : '');
    if (!team) continue;
    out.push({
      team,
      total: num(row.cells[1]) ?? 0,
      avg: num(row.cells[2]) ?? 0,
      played: num(row.cells[3]) ?? 0,
    });
  }
  return out;
}

/**
 * Calendrier/résultats (fragment liste, un bloc par match).
 * Les 5 blocs « 1/2 - Aller / Finale » de fin de saison sont des placeholders
 * (« Quatrième saisons régulière » vs « Premier saison régulière », sans logo)
 * → ignorés : les 240 matchs restants = saison régulière complète (16 × 30 / 2).
 */
function parseCalendar(html, seasonStartYear) {
  const chunks = html.split(/<div class="calendars-listing-item/).slice(1);
  const matches = [];
  for (const chunk of chunks) {
    const id = /\bid="(\d+)"/.exec(chunk)?.[1];
    if (!id) continue;
    const status = /listing-item\s+([a-z-]+)/.exec(chunk)?.[1] ?? 'waiting';
    const comp = /<span class="competition">\s*([\s\S]*?)\s*<\/span>/.exec(chunk)?.[1] ?? '';
    const day = /J(\d+)/.exec(comp);
    const dateRaw = /<br>\s*([\s\S]*?)\s*<\/div>/.exec(chunk)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
    const names = [...chunk.matchAll(/<div class="team-name">\s*([\s\S]*?)\s*<\/div>/g)].map((m) =>
      stripTags(m[1])
    );
    const slugs = [...chunk.matchAll(/sports_teams\/([a-z0-9-]+?)__logo__/gi)].map((m) => m[1]);
    if (names.length < 2 || slugs.length < 2) continue;
    const scoreText = /<div class="scores[^"]*">\s*([\s\S]*?)\s*<\/div>/.exec(chunk)?.[1] ?? '';
    const score = /^(\d+)\s*-\s*(\d+)$/.exec(scoreText.trim());
    const url = /<a class="icon-item" href="([^"]+)"/.exec(chunk)?.[1] ?? '';
    matches.push({
      id: Number(id),
      day: day ? `J${day[1].padStart(2, '0')}` : null,
      day_number: day ? Number(day[1]) : null,
      date: parseFrDate(dateRaw, seasonStartYear),
      date_raw: dateRaw,
      home: teamFromSlug(slugs[0], names[0]),
      away: teamFromSlug(slugs[1], names[1]),
      home_official: names[0],
      away_official: names[1],
      status: status === 'finish' ? 'finished' : status === 'live' ? 'live' : 'scheduled',
      home_score: score ? Number(score[1]) : null,
      away_score: score ? Number(score[2]) : null,
      url: url ? (url.startsWith('http') ? url : `${BASE}/${url}`) : null,
    });
  }
  return matches;
}

/** « ven. 04 sept. 20h00 » → « 2026-09-04T20:00:00 » (UTC non connu → locale). */
function parseFrDate(raw, seasonStartYear) {
  const m = /(\d{1,2})\s+([^\s]+?)\.?\s+(?:\d{4}\s+)?(\d{1,2})h(\d{2})?/.exec(raw || '');
  if (!m) return null;
  const month = FR_MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  const year = month >= 8 ? seasonStartYear : seasonStartYear + 1;
  const hh = String(m[3] ?? '0').padStart(2, '0');
  const mm = String(m[4] ?? '0').padStart(2, '0');
  return `${year}-${String(month).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}T${hh}:${mm}:00`;
}

/** Tri : joueurs de champ par buts, puis gardiens par % d'arrêts (miroir HBL). */
function sortPlayers(players) {
  players.sort((a, b) => {
    if (a.position !== b.position) return a.position === 'Field' ? -1 : 1;
    if (a.position === 'Field') {
      return b.goals - a.goals || a.name.localeCompare(b.name);
    }
    return (b.savePct ?? -1) - (a.savePct ?? -1) || (b.saves || 0) - (a.saves || 0) ||
      a.name.localeCompare(b.name);
  });
  return players;
}

// ─── Collecte par surface ────────────────────────────────────────────────────

async function fetchForm(pathname, prefix) {
  const html = await getPage(pathname);
  return extractForm(html, prefix);
}

async function collectPlayers(seasonOverride) {
  const fieldForm = await fetchForm('/daikin-starligue/stats/joueurs', 'stats-form');
  const gkForm = await fetchForm('/daikin-starligue/stats/gardiens', 'stats-form');
  const seasonId = seasonOverride || fieldForm.__seasonId;
  const season = fieldForm.__seasonLabel || '';

  const base = (form, type, page) => ({
    ...form,
    seasons_id: seasonId,
    type,
    'pagination-items': '50',
    'pagination-current': String(page),
    multi_days_id: 'all',
    multi_teams_id: 'all',
    multi_teams_against: 'all',
  });

  const field = [];
  let page = 1;
  while (page <= MAX_PLAYER_PAGES) {
    const html = await postAjax(
      'sportsPlayersStats',
      base(fieldForm, 'joueurs', page),
      `${BASE}/daikin-starligue/stats/joueurs`
    );
    const rows = parsePlayers(html, 'Field');
    if (!rows.length) break;
    field.push(...rows);
    if (rows.length < 50) break;
    page += 1;
  }

  const gkHtml = await postAjax(
    'sportsPlayersStats',
    base(gkForm, 'gardiens', 1),
    `${BASE}/daikin-starligue/stats/gardiens`
  );
  const gk = parsePlayers(gkHtml, 'GK');
  if (!field.length && !gk.length) throw new Error('0 joueur LNH (saison non démarrée ?)');

  const players = sortPlayers([...field, ...gk]);
  const teams = new Set(players.map((p) => p.team));
  return {
    scraped_at: new Date().toISOString(),
    competition: 'starligue',
    season,
    source:
      'lnh.fr (POST /ajaxpost1 — scraping validé par l\'opérateur le 2026-09-24, ToS propriétaire)',
    total: players.length,
    teams: teams.size,
    players,
    __seasonId: seasonId,
  };
}

async function collectCalendar(seasonOverride, seasonId, seasonLabel) {
  const form = await fetchForm('/daikin-starligue/calendrier', 'calendar-form');
  const sid = seasonOverride || seasonId || form.__seasonId;
  const season = seasonLabel || form.__seasonLabel || '';
  const html = await postAjax(
    'sportsCalendars',
    {
      ...form,
      seasons_id: sid,
      days_id: 'all',
      teams_id: 'all',
      current_month: 'all',
      type: 'all',
      type_id: 'all',
    },
    `${BASE}/daikin-starligue/calendrier`
  );
  const startYear = Number(/^(\d{4})/.exec(season)?.[1]) || new Date().getFullYear();
  const matches = parseCalendar(html, startYear);
  if (!matches.length) throw new Error('0 match LNH parsé depuis le calendrier');
  return {
    scraped_at: new Date().toISOString(),
    competition: 'starligue',
    season,
    source: 'lnh.fr (POST /ajaxpost1, sportsCalendars/index_ajax)',
    total: matches.length,
    matches,
  };
}

async function collectStanding(seasonOverride, seasonId, seasonLabel) {
  const form = await fetchForm('/daikin-starligue/classement', 'standing-form');
  const sid = seasonOverride || seasonId || form.__seasonId;
  const season = seasonLabel || form.__seasonLabel || '';
  const html = await postAjax(
    'sportsStandings',
    { ...form, seasons_id: sid },
    `${BASE}/daikin-starligue/classement`
  );
  const standing = parseStanding(html);
  if (!standing.length) throw new Error('0 ligne de classement parsée');
  return {
    scraped_at: new Date().toISOString(),
    competition: 'starligue',
    season,
    source: 'lnh.fr (POST /ajaxpost1, sportsStandings/index_ajax)',
    total: standing.length,
    standing,
  };
}

async function collectTeamStats(seasonOverride, seasonId, seasonLabel) {
  const form = await fetchForm('/daikin-starligue/stats/clubs', 'stats-form');
  const sid = seasonOverride || seasonId || form.__seasonId;
  const season = seasonLabel || form.__seasonLabel || '';

  const perTeam = new Map();
  const metrics = {};
  for (const metric of TEAM_METRICS) {
    const html = await postAjax(
      'sportsTeamsStats',
      {
        ...form,
        seasons_id: sid,
        order: metric.order,
        type: 'all',
        period: 'all',
        against_id: 'all',
        orderby: 'total',
      },
      `${BASE}/daikin-starligue/stats/clubs`
    );
    const rows = parseTeamStats(html);
    if (!rows.length) throw new Error(`stats clubs vides pour ${metric.order}`);
    metrics[metric.order] = metric;
    for (const row of rows) {
      const entry = perTeam.get(row.team) || { team: row.team, played: row.played, metrics: {} };
      entry.metrics[metric.key] = { total: row.total, avg: row.avg, label: metric.label };
      perTeam.set(row.team, entry);
    }
  }

  return {
    scraped_at: new Date().toISOString(),
    competition: 'starligue',
    season,
    source: 'lnh.fr (POST /ajaxpost1, sportsTeamsStats/index_ajax)',
    total: perTeam.size,
    metrics: TEAM_METRICS.map((m) => ({ order: m.order, key: m.key, label: m.label })),
    teams: [...perTeam.values()].sort((a, b) => a.team.localeCompare(b.team)),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);

function argValue(name) {
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === name && i + 1 < ARGS.length) return ARGS[i + 1];
    if (ARGS[i].startsWith(name + '=')) return ARGS[i].slice(name.length + 1);
  }
  return undefined;
}

const ALL_SECTIONS = ['players', 'calendar', 'standing', 'teamstats'];

function writeJson(dir, file, data) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf-8');
  return target;
}

function report(label, counts) {
  console.log(`[lnh] ${label} : ${counts}`);
}

async function main() {
  const dryRun = ARGS.includes('--dry-run');
  const only = (argValue('--only') || 'all')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const seasonOverride = argValue('--season');
  const outDir = argValue('--out') ? path.resolve(argValue('--out')) : DATA_DIR;
  const sections =
    only.includes('all') ? ALL_SECTIONS : ALL_SECTIONS.filter((s) => only.includes(s));
  if (!sections.length) {
    console.error('[lnh] --only invalide (attendu : calendar|standing|players|teamstats)');
    process.exit(1);
  }

  console.log(
    `[lnh] out=${outDir} sections=${sections.join(',')}${dryRun ? ' (dry-run)' : ''} ` +
      `saison=${seasonOverride || 'auto'} budget=${MAX_REQUESTS} pages`
  );

  // All-or-nothing : toute exception annule le run (aucun fichier écrasé).
  const outputs = {};
  let seasonId = seasonOverride;
  let seasonLabel = '';

  if (sections.includes('players')) {
    const players = await collectPlayers(seasonOverride);
    seasonId = players.__seasonId;
    seasonLabel = players.season;
    delete players.__seasonId;
    outputs.players = players;
    const field = players.players.filter((p) => p.position === 'Field').length;
    const gk = players.players.length - field;
    report('joueurs', `${players.total} (${field} champ / ${gk} gardiens, ${players.teams} équipes)`);
  }
  if (sections.includes('calendar')) {
    outputs.calendar = await collectCalendar(seasonOverride, seasonId, seasonLabel);
    const finished = outputs.calendar.matches.filter((m) => m.status === 'finished').length;
    report('matchs', `${outputs.calendar.total} (${finished} terminés)`);
  }
  if (sections.includes('standing')) {
    outputs.standing = await collectStanding(seasonOverride, seasonId, seasonLabel);
    report('classement', `${outputs.standing.total} clubs`);
  }
  if (sections.includes('teamstats')) {
    outputs.teamstats = await collectTeamStats(seasonOverride, seasonId, seasonLabel);
    report('stats équipes', `${outputs.teamstats.total} clubs × ${TEAM_METRICS.length} métriques`);
  }

  if (dryRun) {
    for (const key of sections) {
      const data = outputs[key];
      const listKey = { players: 'players', calendar: 'matches', standing: 'standing', teamstats: 'teams' }[key];
      console.log(`\n--- ${OUT_FILES[key]} (extrait) ---`);
      console.log(JSON.stringify({ ...data, [listKey]: data[listKey].slice(0, 3) }, null, 2));
    }
    console.log(`\n[lnh] dry-run : ${_calls} requêtes, fichiers NON écrits`);
    return;
  }

  const written = [];
  for (const key of sections) written.push(writeJson(outDir, OUT_FILES[key], outputs[key]));
  console.log(
    `[lnh] ✅ ${written.length} fichiers écrits dans ${outDir} (${_calls} requêtes, rate-limit ${DELAY_MS} ms)`
  );
  for (const f of written) console.log(`[lnh]    - ${path.basename(f)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[lnh] FATAL:', err.message);
    console.error('[lnh] rien écrit (all-or-nothing) — les fichiers existants sont conservés');
    process.exit(1);
  });
}

module.exports = {
  normHandballName,
  teamFromSlug,
  extractForm,
  parsePlayers,
  parseStanding,
  parseTeamStats,
  parseCalendar,
  parseFrDate,
  sortPlayers,
  num,
  pair,
  parseHms,
  TEAM_NAMES,
  TEAM_METRICS,
};
