'use strict';

/**
 * lib/logo-cascade.js — Module partagé : cascade de résolution de logos
 * équipes (football) ET championnats/ligues pour PariScore.
 *
 * Sources ÉQUIPES (fiabilité décroissante, stop au 1er succès) :
 *   1. BSD API        (/teams/?search= → /img/team/{id}/?bg=transparent)
 *   2. TheSportsDB    (searchteams.php → strLogo [clé test "3"] / strTeamBadge [Pro])
 *   3. API-Football   (v3/teams?search= → team.logo CDN)
 *   4. Scraping HTML BSD (page /matches/{id} → img /img/team/{id}/) — optionnel, --match-id
 *   5. Fallback initiales (côté UI, rien ici)
 *
 * Sources CHAMPIONNATS (NOUVEAU — table league_logos) :
 *   1. imagePath BSD direct (si fourni par le flux → bsdImgUrl)
 *   2. TheSportsDB league  (search_all_leagues.php → ID → lookupleague.php → strLogo)
 *   3. null (fallback initiales côté UI)
 *
 * Référence : .agents/skills/ps-scrape-logos/SKILL.md
 * Contrat de cohérence : normalizeTeamName() IDENTIQUE à _normalizeTeamName (server.js:3805).
 * Convention IDs externes : pour sources non-BSD, bsd_id = -1000000 - hash(name) % 900000
 * (range négatif réservé, évite toute collision avec IDs BSD réels > 0).
 *
 * Utilisateurs :
 *   - scripts/scrape-logos.js (CLI wrapper, ancien)
 *   - scripts/enrich-live-logos.js (CLI watch/once, nouveau)
 *   - services/liveLogoEnricher.js (worker serveur)
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ─── better-sqlite3 : require paresseux (ne bloque pas --dry-run/--audit sans build native)
let Database = null;
function loadDatabase() {
  if (Database) return Database;
  try { Database = require('better-sqlite3'); return Database; }
  catch (e) {
    throw new Error(
      "better-sqlite3 introuvable (build native absente sous ce runtime). " +
      "Réinstallez : npm i --no-save --legacy-peer-deps better-sqlite3, " +
      "ou utilisez --dry-run pour tester sans écriture DB."
    );
  }
}

// ─── cheerio : optionnel (scraping HTML BSD). Fallback regex sinon.
let cheerio = null;
function loadCheerio() {
  if (cheerio) return cheerio;
  try { cheerio = require('cheerio'); return cheerio; }
  catch (e) { return null; }
}

// ─── Chargement .env si présent (utile en CLI standalone ; no-op côté serveur déjà chargé)
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (process.env[k] === undefined) {
        process.env[k] = v.replace(/^["']|["']$/g, '');
      }
    }
  } catch (_) { /* pas de .env, on continue avec env courant */ }
}
loadEnvFile();

// ─── Config (env + .env)
const BSD_API_KEY       = process.env.BSD_API_KEY || '';
const BSD_BASE_URL      = (process.env.BSD_BASE_URL || 'https://sports.bzzoiro.com/api').replace(/\/$/, '');
const BSD_ROOT_URL      = (process.env.BSD_ROOT_URL || BSD_BASE_URL.replace(/\/api\/?$/, '') || 'https://sports.bzzoiro.com').replace(/\/$/, '');
const THE_SPORTSDB_KEY  = process.env.THE_SPORTSDB_KEY || '3'; // "3" = clé test publique
const API_FOOTBALL_KEY  = process.env.API_FOOTBALL_KEY || '';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Normalisation IDENTIQUE à _normalizeTeamName (server.js:3805).
 * Clé de cohérence du lookup team_logos / league_logos — NE PAS MODIFIER sans同步iser server.js.
 */
function normalizeTeamName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|ac|ssc|sc|if|ik|kf|ff|afc|asd|cd|club|united|utd|city|sk|ifk|bk|fk|il|tf|vfl|sv|gs|fk|asd|rb|tsg|vfb)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * ID négatif stable pour sources externes (évite collision avec bsd_id > 0).
 * Range réservé : [-1900000 ; -1000001].
 */
function externalId(name) {
  const buf = crypto.createHash('sha1').update(normalizeTeamName(name)).digest();
  const h = buf.readUInt32BE(0); // 4 premiers octets → entier 32 bits
  return -1000000 - (h % 900000);
}

async function httpGet(url, headers = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore-logo-cascade/1.0', ...headers },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = text; }
    return { status: res.status, headers: res.headers, data };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Transforme une URL d'image BSD en ajoutant le paramètre ?bg=transparent.
 * Identique à bsdImgUrl (server.js:1835). No-op pour les URLs déjà query-ées.
 */
function bsdImgUrl(url) {
  return url ? url + (url.includes('?') ? '&' : '?') + 'bg=transparent' : null;
}

// ─── HTML helpers (source 4 scraping BSD) ────────────────────────────────────
function absUrl(u, root) {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return u;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return root.replace(/\/$/, '') + u;
  return u;
}

/**
 * Extraction d'URL logo depuis HTML BSD page match.
 * Pattern BSD réel : <img src="/img/team/{id}/"> (pas de class).
 * Fallback générique : img[class*="team-logo"].
 */
function extractTeamLogoFromHtml(html, rootUrl) {
  const $ = loadCheerio();
  if ($) {
    let found = null;
    $('img[src*="/img/team/"]').each((_, el) => {
      const u = $(el).attr('src') || $(el).attr('data-src');
      if (u) { found = u; return false; }
    });
    if (found) return absUrl(found, rootUrl);
    const candidates = ['img.team-logo', '.team-logo img', 'img[class*="team-logo"]', 'img[class*="team_logo"]'];
    for (const sel of candidates) {
      $(sel).each((_, el) => {
        const u = $(el).attr('src') || $(el).attr('data-src');
        if (u) { found = u; return false; }
      });
      if (found) return absUrl(found, rootUrl);
    }
    return null;
  }
  // Fallback regex (sans cheerio)
  let m;
  const reBsd = /<img\b[^>]*\bsrc\s*=\s*"(\/img\/team\/\d+\/[^"]*)"/i;
  if ((m = reBsd.exec(html))) return absUrl(m[1], rootUrl);
  const reClass = /<img\b[^>]*\bclass\s*=\s*"[^"]*team[-_]?logo[^"]*"[^>]*\bsrc\s*=\s*"([^"]+)"/i;
  if ((m = reClass.exec(html))) return absUrl(m[1], rootUrl);
  const reClass2 = /<img\b[^>]*\bsrc\s*=\s*"([^"]+)"[^>]*\bclass\s*=\s*"[^"]*team[-_]?logo[^"]*"/i;
  if ((m = reClass2.exec(html))) return absUrl(m[1], rootUrl);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DB helpers — team_logos ET league_logos
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ouvre pariscore.db et crée les tables team_logos + league_logos si absentes.
 * Schémas identiques à server.js (team_logos à 6457, league_logos nouveau).
 */
function openDb(dbPath) {
  const Db = loadDatabase();
  const db = new Db(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_logos (
      bsd_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT,
      country TEXT,
      name_norm TEXT NOT NULL,
      logo_url TEXT NOT NULL,
      indexed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_logos_norm ON team_logos(name_norm);
    CREATE INDEX IF NOT EXISTS idx_team_logos_name ON team_logos(name);
    CREATE TABLE IF NOT EXISTS league_logos (
      bsd_league_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_norm TEXT NOT NULL,
      country TEXT,
      sport TEXT,
      logo_url TEXT NOT NULL,
      source TEXT,
      indexed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_league_logos_norm ON league_logos(name_norm);
    CREATE INDEX IF NOT EXISTS idx_league_logos_sport ON league_logos(sport);
  `);
  return db;
}

function upsertTeamLogo(db, { bsd_id, name, short_name, country, name_norm, logo_url }) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO team_logos (bsd_id, name, short_name, country, name_norm, logo_url, indexed_at) VALUES (?,?,?,?,?,?,?)'
  );
  stmt.run(bsd_id, name, short_name || '', country || '', name_norm, logo_url, Date.now());
}

function upsertLeagueLogo(db, { bsd_league_id, name, name_norm, country, sport, logo_url, source }) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO league_logos (bsd_league_id, name, name_norm, country, sport, logo_url, source, indexed_at) VALUES (?,?,?,?,?,?,?,?)'
  );
  stmt.run(bsd_league_id, name, name_norm, country || '', sport || '', logo_url, source || 'unknown', Date.now());
}

/**
 * Lookup cache team_logos (exact puis fuzzy). Miroir de lookupTeamLogo (server.js:3860),
 * mais sans cache mémoire (le caller gère son propre cache in-memory).
 */
function findTeamInCache(db, name) {
  if (!db) return null;
  const norm = normalizeTeamName(name);
  if (!norm) return null;
  let row = db.prepare('SELECT bsd_id, logo_url FROM team_logos WHERE name_norm = ? LIMIT 1').get(norm);
  if (!row && norm.length >= 3) {
    row = db.prepare(
      "SELECT bsd_id, logo_url FROM team_logos WHERE name_norm LIKE ? OR ? LIKE '%' || name_norm || '%' LIMIT 1"
    ).get(norm + '%', norm);
  }
  return row ? { bsd_id: row.bsd_id, logo_url: row.logo_url } : null;
}

/**
 * Lookup cache league_logos (exact puis fuzzy sur name_norm).
 */
function findLeagueInCache(db, { name, sport } = {}) {
  if (!db) return null;
  const norm = normalizeTeamName(name);
  if (!norm) return null;
  // D'abord match exact name_norm, éventuellement filtré par sport
  let row;
  if (sport) {
    row = db.prepare('SELECT bsd_league_id, logo_url FROM league_logos WHERE name_norm = ? AND sport = ? LIMIT 1').get(norm, sport);
  } else {
    row = db.prepare('SELECT bsd_league_id, logo_url FROM league_logos WHERE name_norm = ? LIMIT 1').get(norm);
  }
  if (!row && norm.length >= 3) {
    row = db.prepare(
      "SELECT bsd_league_id, logo_url FROM league_logos WHERE name_norm LIKE ? OR ? LIKE '%' || name_norm || '%' LIMIT 1"
    ).get(norm + '%', norm);
  }
  return row ? { bsd_league_id: row.bsd_league_id, logo_url: row.logo_url } : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASCADE ÉQUIPES (extrait de scripts/scrape-logos.js, identique au contrat testé)
// ═══════════════════════════════════════════════════════════════════════════════

// Source 1 : BSD API
async function sourceBsdApi(name) {
  if (!BSD_API_KEY) return null;
  const url = `${BSD_BASE_URL}/teams/?search=${encodeURIComponent(name)}&tz=Europe/Paris`;
  const res = await httpGet(url, { 'Authorization': `Token ${BSD_API_KEY}` });
  if (res.status !== 200 || !res.data || !Array.isArray(res.data.results)) return null;
  const target = normalizeTeamName(name);
  let best = res.data.find(t => normalizeTeamName(t.name) === target);
  if (!best) best = res.data.find(t => normalizeTeamName(t.name).includes(target) || target.includes(normalizeTeamName(t.name)));
  if (!best && res.data.length === 1) best = res.data[0];
  if (!best || !best.id) return null;
  return {
    bsd_id: best.id,
    name: best.name,
    short_name: best.short_name || '',
    country: best.country || '',
    logo_url: `${BSD_ROOT_URL}/img/team/${best.id}/?bg=transparent`,
    source: 'bsd-api',
  };
}

// Source 2 : TheSportsDB — variantes de nom (suffixe/préfixe strip)
const _CLUB_SUFFIX_RE = /\s+(IF|FF|FK|BK|SK|IK|KF|IFK|FC|CF|AC|SSC|SC|AFC|ASD|CD|UTD|UNITED|CITY)\s*$/i;
const _CLUB_PREFIX_RE = /^(FC|CF|AC|SSC|SC|AFC|ASD|CD|RB|TSG|VfB|VfL|SV|GS|IL|TF)\s+/i;

async function _tryTheSportsDbTeam(query) {
  const url = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(query)}`;
  const res = await httpGet(url);
  if (res.status !== 200) return null;
  const teams = res.data && res.data.teams;
  if (!Array.isArray(teams) || !teams.length) return null;
  const target = normalizeTeamName(query);
  const scored = teams
    .map(t => {
      const badge = t.strTeamBadge || t.strLogo || '';
      const score = badge ? (normalizeTeamName(t.strTeam) === target ? 100 : (normalizeTeamName(t.strTeam).includes(target) ? 50 : 10)) : -1;
      return { t, badge, score };
    })
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || !best.badge) return null;
  return {
    name: best.t.strTeam || query,
    short_name: best.t.strTeamShort || '',
    country: best.t.strCountry || '',
    logo_url: best.badge,
    source: 'thesportsdb',
  };
}

async function sourceTheSportsDb(name) {
  let r = await _tryTheSportsDbTeam(name);
  if (r) return { ...r, bsd_id: externalId(name) };
  await sleep(550);
  const stripped = name.replace(_CLUB_SUFFIX_RE, '');
  if (stripped && stripped.toLowerCase() !== name.toLowerCase()) {
    r = await _tryTheSportsDbTeam(stripped);
    if (r) return { ...r, bsd_id: externalId(name), name };
    await sleep(550);
  }
  const strippedPrefix = name.replace(_CLUB_PREFIX_RE, '');
  if (strippedPrefix && strippedPrefix.toLowerCase() !== name.toLowerCase() && strippedPrefix.toLowerCase() !== stripped.toLowerCase()) {
    r = await _tryTheSportsDbTeam(strippedPrefix);
    if (r) return { ...r, bsd_id: externalId(name), name };
    await sleep(550);
  }
  if (stripped && strippedPrefix && strippedPrefix.toLowerCase() !== stripped.toLowerCase()) {
    const both = stripped.replace(_CLUB_PREFIX_RE, '');
    if (both && both.toLowerCase() !== stripped.toLowerCase() && both.toLowerCase() !== strippedPrefix.toLowerCase()) {
      r = await _tryTheSportsDbTeam(both);
      if (r) return { ...r, bsd_id: externalId(name), name };
    }
  }
  return null;
}

// Source 3 : API-Football (api-sports.io v3)
async function sourceApiFootball(name) {
  if (!API_FOOTBALL_KEY) return null;
  const url = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`;
  const res = await httpGet(url, { 'x-apisports-key': API_FOOTBALL_KEY });
  if (res.status !== 200) return null;
  const arr = res.data && res.data.response;
  if (!Array.isArray(arr) || !arr.length) return null;
  const t = arr[0] && arr[0].team;
  if (!t || !t.logo) return null;
  return {
    bsd_id: externalId(name),
    name: t.name || name,
    short_name: t.code || '',
    country: (arr[0].venue && arr[0].venue.country) || '',
    logo_url: t.logo,
    source: 'api-football',
  };
}

// Source 4 : Scraping HTML BSD (page match publique)
async function sourceBsdScrape(name, matchId) {
  if (!matchId) return null;
  const url = `${BSD_ROOT_URL}/matches/${matchId}`;
  const res = await httpGet(url, { 'Accept': 'text/html,application/xhtml+xml' });
  if (res.status !== 200 || typeof res.data !== 'string') return null;
  const logoUrl = extractTeamLogoFromHtml(res.data, BSD_ROOT_URL);
  if (!logoUrl) return null;
  return {
    bsd_id: externalId(name),
    name, short_name: '', country: '',
    logo_url: logoUrl,
    source: 'bsd-scrape',
  };
}

/**
 * Cascade ÉQUIPES. Essaie les sources dans l'ordre, stop au 1er succès.
 * @param {string} name
 * @param {object} opts { matchId?, verbose? }
 * @returns {Promise<object|null>} row {bsd_id,name,short_name,country,logo_url,source} | null
 */
async function resolveTeamLogo(name, opts = {}) {
  // 1. BSD API (1 req/s)
  try {
    const r = await sourceBsdApi(name);
    if (r) return r;
  } catch (e) { if (opts.verbose) console.warn(`  [bsd-api] ${e.message}`); }
  await sleep(1000);

  // 2. TheSportsDB (2 req/s)
  try {
    const r = await sourceTheSportsDb(name);
    if (r) return r;
  } catch (e) { if (opts.verbose) console.warn(`  [thesportsdb] ${e.message}`); }
  await sleep(500);

  // 3. API-Football (1 req/s)
  try {
    const r = await sourceApiFootball(name);
    if (r) return r;
  } catch (e) { if (opts.verbose) console.warn(`  [api-football] ${e.message}`); }
  await sleep(1000);

  // 4. Scraping BSD HTML (seulement si matchId fourni)
  if (opts.matchId) {
    try {
      const r = await sourceBsdScrape(name, opts.matchId);
      if (r) return r;
    } catch (e) { if (opts.verbose) console.warn(`  [bsd-scrape] ${e.message}`); }
    await sleep(1000);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASCADE CHAMPIONNATS (NOUVEAU)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mapping curaté manuel : top leagues mondiales (name_norm → URL logo CDN TheSportsDB).
 * TheSportsDB free limite search_all_leagues à ~5 leagues/pays, excluant les top leagues
 * européennes. Cette table couvre les championnats majeurs directement (source la plus
 * fiable, comme TV_CHANNEL_LOGOS dans server.js:1994). La cascade TheSportsDB gère le reste.
 * Logos vérifiés sur r2.thesportsdb.com (CDN public, stable).
 */
const TOP_LEAGUE_LOGOS = {
  // England
  premierleague: 'https://r2.thesportsdb.com/images/media/league/logo/vrptxx1615391414.png', // Premier League
  eflchampionship: 'https://r2.thesportsdb.com/images/media/league/logo/qvyywx1421723852.png',
  // Spain
  laliga: 'https://r2.thesportsdb.com/images/media/league/logo/gq4b1r1687707889.png', // La Liga
  // Italy
  seriea: 'https://r2.thesportsdb.com/images/media/league/logo/b0hv7o1719640507.png',
  // Germany
  bundesliga: 'https://r2.thesportsdb.com/images/media/league/logo/99gtlc1694456551.png',
  // France
  ligue1: 'https://r2.thesportsdb.com/images/media/league/logo/pp71fp1719637991.png',
  ligue2: 'https://r2.thesportsdb.com/images/media/league/logo/xuxhmr1607521319.png',
  // Netherlands
  eredivisie: 'https://r2.thesportsdb.com/images/media/league/logo/0fi5f61686600794.png',
  // Portugal
  primeiraliga: 'https://r2.thesportsdb.com/images/media/league/logo/9vwABJ1687710183.png',
  ligaportugal: 'https://r2.thesportsdb.com/images/media/league/logo/9vwABJ1687710183.png',
  // Belgium
  jupilerproleague: 'https://r2.thesportsdb.com/images/media/league/logo/xq31501686611815.png',
  // Turkey
  superlig: 'https://r2.thesportsdb.com/images/media/league/logo/hqisob1605055148.png',
  // Scotland
  scottishpremiership: 'https://r2.thesportsdb.com/images/media/league/logo/2xi5w1615394283.png',
  // UEFA
  championsleague: 'https://r2.thesportsdb.com/images/media/league/logo/6ewreu1673947233.png',
  europaleague: 'https://r2.thesportsdb.com/images/media/league/logo/qck2wi1615394837.png',
  conferenceleague: 'https://r2.thesportsdb.com/images/media/league/logo/spsrpn1615394868.png',
  // Americas
  mls: 'https://r2.thesportsdb.com/images/media/league/logo/tsdryy1507199369.png',
  brasileirao: 'https://r2.thesportsdb.com/images/media/league/logo/o0bc051554366864.png',
  // alias courants
  epl: 'https://r2.thesportsdb.com/images/media/league/logo/vrptxx1615391414.png',
  laligasantander: 'https://r2.thesportsdb.com/images/media/league/logo/gq4b1r1687707889.png',
};

/**
 * Source league 0 : table curatée TOP_LEAGUE_LOGOS.
 * Match direct sur name_norm. Couverture limitée mais 100% fiable.
 */
function sourceTopLeague({ name }) {
  if (!name) return null;
  const norm = normalizeTeamName(name);
  if (!norm) return null;
  const logoUrl = TOP_LEAGUE_LOGOS[norm];
  if (!logoUrl) return null;
  return {
    bsd_league_id: null,
    name,
    name_norm: norm,
    country: '',
    sport: '',
    logo_url: logoUrl,
    source: 'top-league-curate',
  };
}

/**
 * Mapping heuristique sport_key → sport TheSportsDB (pour search_all_leagues.php?s=).
 * TheSportsDB utilise des noms longs : "Soccer", "Rugby League", etc.
 */
const _SPORT_KEY_TO_TSD = {
  soccer: 'Soccer',
  // Odds API sport_key commence par "soccer_<country>_<league>"
};
function tsdSport(sport) {
  if (!sport) return 'Soccer';
  if (typeof sport !== 'string') return 'Soccer';
  const lc = sport.toLowerCase();
  if (lc.startsWith('soccer')) return 'Soccer';
  if (lc.startsWith('rugby')) return 'Rugby League';
  if (lc.startsWith('basket')) return 'Basketball';
  if (lc.startsWith('tennis')) return 'Tennis';
  if (lc.startsWith('baseball')) return 'MLB';
  if (lc.startsWith('icehockey') || lc.startsWith('nhl')) return 'Ice Hockey';
  if (lc.startsWith('americanfootball') || lc.startsWith('nfl') || lc.startsWith('ncaa')) return 'American Football';
  return 'Soccer';
}

/**
 * Source league 1 : imagePath BSD direct.
 * Si le flux BSD fournit déjà league.image_path, on l'utilise directement (wrapper bsdImgUrl).
 * @param {string} imagePath — chemin BSD relatif (ex: "/media/leagues/34.png")
 * @returns {object|null} row ou null
 */
function sourceBsdImagePath({ imagePath, name, country, sport }) {
  if (!imagePath) return null;
  // Si déjà URL absolue → bsdImgUrl ; sinon préfixer BSD_ROOT_URL
  const full = /^https?:\/\//.test(imagePath)
    ? bsdImgUrl(imagePath)
    : bsdImgUrl(`${BSD_ROOT_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`);
  if (!full) return null;
  return {
    bsd_league_id: null, // à caller de fixer
    name: name || '',
    name_norm: normalizeTeamName(name),
    country: country || '',
    sport: sport || '',
    logo_url: full,
    source: 'bsd-image_path',
  };
}

/**
 * Source league 2 : TheSportsDB.
 * Stratégie : search_all_leagues.php?c=<country>&s=<sport> (précis, endpoint par pays)
 * puis fallback ?s=<sport> seul. Match par name_norm avec scoring (préfère match exact
 * dans le bon pays, pénalise les faux positifs du genre "Algerian Ligue 1" pour "Ligue 1").
 * lookupleague.php?id= → strLogo. Le logo league est gratuit (clé test "3" suffit).
 */
async function _searchTsdLeagueId({ name, country, sport }) {
  const sp = tsdSport(sport);
  const target = normalizeTeamName(name);
  if (!target) return null;

  // Helper : score un league candidate. +100 exact name_norm, +50 contient dans le bon sens,
  // +20 bon pays, -30 faux positif (name candidat plus long avec préfixe pays).
  function scoreCandidate(c) {
    const n = normalizeTeamName(c.strLeague);
    if (!n) return -1;
    let score = -1;
    if (n === target) score = 100;
    else if (n.includes(target) || target.includes(n)) {
      // Faux positif : "Algerian Ligue 1" pour "Ligue 1" → préfixe pays + suffixe
      // On pénalise si le candidat est nettement plus long et target court (< 6 chars).
      if (target.length < 6 && n.length > target.length + 4) score = 10;
      else score = 50;
    }
    if (score >= 0 && country && (c.strCountry || '').toLowerCase() === country.toLowerCase()) {
      score += 20;
    }
    return score;
  }

  // Tentative 1 : endpoint par pays (plus précis si country fourni)
  let candidates = [];
  if (country) {
    try {
      const url1 = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTSDB_KEY}/search_all_leagues.php?c=${encodeURIComponent(country)}&s=${encodeURIComponent(sp)}`;
      const res1 = await httpGet(url1);
      if (res1.status === 200) {
        const arr1 = res1.data && res1.data.countries;
        if (Array.isArray(arr1)) candidates = candidates.concat(arr1);
      }
      await sleep(550);
    } catch (_) { /* endpoint pays indispo, on retombe sur ?s= seul */ }
  }

  // Tentative 2 : endpoint par sport seul (si pays n'a rien donné ou absent)
  if (!candidates.length) {
    try {
      const url2 = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTSDB_KEY}/search_all_leagues.php?s=${encodeURIComponent(sp)}`;
      const res2 = await httpGet(url2);
      if (res2.status === 200) {
        const arr2 = res2.data && res2.data.countries;
        if (Array.isArray(arr2)) candidates = candidates.concat(arr2);
      }
    } catch (_) { /* rien à faire */ }
  }

  if (!candidates.length) return null;

  // Score et trie
  const scored = candidates
    .map(c => ({ c, score: scoreCandidate(c) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || !best.c || !best.c.idLeague) return null;
  return best.c;
}

async function sourceTheSportsDbLeague({ name, country, sport }) {
  const league = await _searchTsdLeagueId({ name, country, sport });
  if (!league) return null;
  await sleep(550);
  // 2. lookupleague.php?id= pour le strLogo (HD league logo)
  const url = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTSDB_KEY}/lookupleague.php?id=${league.idLeague}`;
  const res = await httpGet(url);
  if (res.status !== 200) return null;
  const arr = res.data && res.data.leagues;
  const l = Array.isArray(arr) && arr[0];
  if (!l) return null;
  const logoUrl = l.strLogo || l.strBadge || l.strPoster || '';
  if (!logoUrl) return null;
  return {
    bsd_league_id: null,
    name: l.strLeague || name,
    name_norm: normalizeTeamName(name),
    country: l.strCountry || country || '',
    sport: sport || '',
    logo_url: logoUrl,
    source: 'thesportsdb',
  };
}

/**
 * Cascade CHAMPIONNATS. Essaie dans l'ordre :
 *   0. Table curatée TOP_LEAGUE_LOGOS (instantané, top leagues majeures)
 *   1. imagePath BSD direct (si fourni par le flux BSD)
 *   2. TheSportsDB league (search_all_leagues + lookupleague)
 * @param {object} input { name, country?, sport?, bsdLeagueId?, imagePath?, verbose? }
 * @returns {Promise<object|null>} row {bsd_league_id,name,name_norm,country,sport,logo_url,source} | null
 */
async function resolveLeagueLogo(input = {}) {
  const { name, country, sport, bsdLeagueId, imagePath, verbose } = input;
  if (!name) return null;
  const idFor = () => bsdLeagueId != null ? Number(bsdLeagueId) : externalId(name + '|' + (country || '') + '|' + (sport || ''));

  // 0. Table curatée top leagues (instantané, le plus fiable)
  const curated = sourceTopLeague({ name });
  if (curated) return { ...curated, bsd_league_id: idFor(), country: country || '', sport: sport || '' };

  // 1. imagePath BSD direct (si fourni)
  if (imagePath) {
    const r = sourceBsdImagePath({ imagePath, name, country, sport });
    if (r) return { ...r, bsd_league_id: idFor() };
  }

  // 2. TheSportsDB league
  try {
    const r = await sourceTheSportsDbLeague({ name, country, sport });
    if (r) return { ...r, bsd_league_id: idFor() };
  } catch (e) { if (verbose) console.warn(`  [tsd-league] ${e.message}`); }

  return null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Config (exposée pour rapports / debugging)
  config: { BSD_API_KEY, BSD_BASE_URL, BSD_ROOT_URL, THE_SPORTSDB_KEY, API_FOOTBALL_KEY },

  // Utilitaires
  normalizeTeamName,
  externalId,
  httpGet,
  bsdImgUrl,
  sleep,

  // DB
  loadDatabase,
  openDb,
  upsertTeamLogo,
  upsertLeagueLogo,
  findTeamInCache,
  findLeagueInCache,

  // Cascade équipes
  resolveTeamLogo,
  sourceBsdApi,
  sourceTheSportsDb,
  sourceApiFootball,
  sourceBsdScrape,

  // Cascade championnats
  resolveLeagueLogo,
  sourceTopLeague,
  TOP_LEAGUE_LOGOS,
  sourceBsdImagePath,
  sourceTheSportsDbLeague,
};
