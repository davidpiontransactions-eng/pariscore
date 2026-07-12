#!/usr/bin/env node
/**
 * scripts/scrape-logos.js — Scraping logos équipes & championnats football pour PariScore.
 *
 * Implémente la cascade documentée dans .agents/skills/ps-scrape-logos/SKILL.md :
 *   1. BSD API   (/teams/?search=  + /img/team/{id}/?bg=transparent)   — clé BSD_API_KEY
 *   2. TheSportsDB (searchteams.php → strTeamBadge)                     — clé Pro (test "3" = league logos only)
 *   3. API-Football (v3/teams?search= → team.logo)                      — clé API_FOOTBALL_KEY
 *   4. Scraping HTML BSD (page /matches/{id} → img.team-logo)           — public, optionnel (--match-id)
 *   5. Fallback initiales (rien à scraper, marqué non-résolu)
 *
 * Usage :
 *   node scripts/scrape-logos.js "Arsenal,Chelsea,Real Madrid"
 *   node scripts/scrape-logos.js --from-file teams.txt
 *   node scripts/scrape-logos.js "Arsenal" --dry-run            # sans écrire en DB
 *   node scripts/scrape-logos.js "Team X" --match-id 12345      # active source 4 (scraping BSD)
 *   node scripts/scrape-logos.js "Arsenal" --db ./pariscore.db  # DB personnalisée
 *
 * Env (.env chargé si présent) :
 *   BSD_API_KEY         — clé BSD (Token). Sans elle, source 1 sautée.
 *   BSD_BASE_URL        — défaut https://sports.bzzoiro.com/api
 *   BSD_ROOT_URL        — défaut https://sports.bzzoiro.com (pour /img/team/...)
 *   THE_SPORTSDB_KEY    — défaut "3" (test). Badges équipe = clé Pro requise.
 *   API_FOOTBALL_KEY    — clé api-sports.io. Sans elle, source 3 sautée.
 *
 * Sortie : rapport — X logos trouvés (BSD: A, TheSportsDB: B, API-Football: C, scraping: D), Y échecs.
 *
 * Convention IDs externes : pour les sources non-BSD, bsd_id = -1000000 - hash(name) % 900000
 * (range négatif réservé, évite toute collision avec IDs BSD réels > 0).
 */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// better-sqlite3 est une dépendance runtime de pariscore (server.js l'utilise).
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[FATAL] better-sqlite3 introuvable. Installez-le : npm i better-sqlite3');
  process.exit(2);
}

// cheerio installé en dev (--no-save). Requête paresseuse : seulement si scraping HTML activé.
let cheerio = null;
function loadCheerio() {
  if (cheerio) return cheerio;
  try { cheerio = require('cheerio'); return cheerio; }
  catch (e) {
    throw new Error("cheerio introuvable — installer avec : npm i --no-save --legacy-peer-deps cheerio");
  }
}

// ─── Config (env + .env) ──────────────────────────────────────────────────────
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

const BSD_API_KEY       = process.env.BSD_API_KEY || '';
const BSD_BASE_URL      = (process.env.BSD_BASE_URL || 'https://sports.bzzoiro.com/api').replace(/\/$/, '');
const BSD_ROOT_URL      = (process.env.BSD_ROOT_URL || BSD_BASE_URL.replace(/\/api\/?$/, '') || 'https://sports.bzzoiro.com').replace(/\/$/, '');
const THE_SPORTSDB_KEY  = process.env.THE_SPORTSDB_KEY || '3'; // "3" = clé test publique
const API_FOOTBALL_KEY  = process.env.API_FOOTBALL_KEY || '';
const DB_PATH           = path.join(__dirname, '..', 'pariscore.db');

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Normalisation IDENTIQUE à _normalizeTeamName (server.js ligne 3772) — clé de cohérence du lookup.
function normalizeTeamName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|ac|ssc|sc|if|ik|kf|ff|afc|asd|cd|club|united|utd|city|sk|ifk|bk|fk|il|tf|vfl|sv|gs|fk|asd|rb|tsg|vfb)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ID négatif stable pour sources externes (évite collision avec bsd_id > 0).
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
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore-scrape-logos/1.0', ...headers },
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

// ─── DB ───────────────────────────────────────────────────────────────────────
function openDb(dbPath) {
  const db = new Database(dbPath);
  // Crée la table si absente (même schéma que server.js ligne 6424).
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
  `);
  return db;
}

function upsertLogo(db, { bsd_id, name, short_name, country, name_norm, logo_url }) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO team_logos (bsd_id, name, short_name, country, name_norm, logo_url, indexed_at) VALUES (?,?,?,?,?,?,?)'
  );
  stmt.run(bsd_id, name, short_name || '', country || '', name_norm, logo_url, Date.now());
}

function findInCache(db, name) {
  const norm = normalizeTeamName(name);
  if (!norm) return null;
  let row = db.prepare('SELECT bsd_id, logo_url FROM team_logos WHERE name_norm = ? LIMIT 1').get(norm);
  if (!row && norm.length >= 3) {
    row = db.prepare('SELECT bsd_id, logo_url FROM team_logos WHERE name_norm LIKE ? OR ? LIKE "%" || name_norm || "%" LIMIT 1')
      .get(norm + '%', norm);
  }
  return row ? { bsd_id: row.bsd_id, logo_url: row.logo_url } : null;
}

// ─── Source 1 : BSD API ───────────────────────────────────────────────────────
// NB : /teams/?search= ne filtre pas côté BSD (bug connu), donc on récupère la 1ère page
// et on filtre côté client par name_norm. Pour un backfill massif, préférer rebuildTeamLogosIndex()
// côté serveur (pagine les 3604 équipes). Ici on cible 1 équipe précise.
async function sourceBsdApi(name) {
  if (!BSD_API_KEY) return null;
  const url = `${BSD_BASE_URL}/teams/?search=${encodeURIComponent(name)}&tz=Europe/Paris`;
  const res = await httpGet(url, { 'Authorization': `Token ${BSD_API_KEY}` });
  if (res.status !== 200 || !res.data || !Array.isArray(res.data.results)) return null;
  const target = normalizeTeamName(name);
  // Match exact sur name_norm d'abord, sinon contient.
  let best = res.data.find(t => normalizeTeamName(t.name) === target);
  if (!best) best = res.data.find(t => normalizeTeamName(t.name).includes(target) || target.includes(normalizeTeamName(t.name)));
  if (!best && res.data.length === 1) best = res.data[0]; // search qui ne filtre pas mais 1 seul résultat
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

// ─── Source 2 : TheSportsDB ───────────────────────────────────────────────────
// Clé test "3" = publique mais ne retourne PAS strTeamBadge (badges = licence Pro).
// Logos LEAGUE sont gratuits via lookupleague.php (hors scope de ce script axé équipes).
// Documenté : une clé Pro gratuite est dispo sur demande à contact@thesportsdb.com.
async function sourceTheSportsDb(name) {
  const url = `https://www.thesportsdb.com/api/v1/json/${THE_SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(name)}`;
  const res = await httpGet(url);
  if (res.status !== 200) return null;
  const teams = res.data && res.data.teams;
  if (!Array.isArray(teams) || !teams.length) return null;
  const t = teams[0];
  // strTeamBadge est null/vide avec clé test. Si présent (clé Pro), on l'utilise.
  const badge = t.strTeamBadge || t.strLogo || t.strFanart1;
  if (!badge) return null; // clé non-Pro → pas de badge dispo
  return {
    bsd_id: externalId(name),
    name: t.strTeam || name,
    short_name: t.strTeamShort || '',
    country: t.strCountry || '',
    logo_url: badge,
    source: 'thesportsdb',
  };
}

// ─── Source 3 : API-Football (api-sports.io v3) ───────────────────────────────
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
    logo_url: t.logo, // URL CDN media.api-sports.io (HTTPS)
    source: 'api-football',
  };
}

// ─── Source 4 : Scraping HTML BSD (page match publique) ───────────────────────
// Nécessite un matchId BSD où l'équipe apparaît. cherio requis.
async function sourceBsdScrape(name, matchId) {
  if (!matchId) return null;
  loadCheerio();
  const url = `${BSD_ROOT_URL}/matches/${matchId}`;
  const res = await httpGet(url, { 'Accept': 'text/html,application/xhtml+xml' });
  if (res.status !== 200 || typeof res.data !== 'string') return null;
  const $ = cheerio.load(res.data);
  // Plusieurs sélecteurs possibles selon le markup BSD. On essaie les plus courants.
  const candidates = ['img.team-logo', 'img.team-logo img', '.team-logo img', 'img[class*="team-logo"]', 'img[class*="team_logo"]'];
  let logoUrl = null;
  for (const sel of candidates) {
    $(sel).each((_, el) => {
      const u = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-srcset');
      if (u && /^https?:\/\//.test(u)) { logoUrl = u; return false; }
      if (u && u.startsWith('/')) { logoUrl = `${BSD_ROOT_URL}${u}`; return false; }
    });
    if (logoUrl) break;
  }
  if (!logoUrl) return null;
  return {
    bsd_id: externalId(name),
    name, short_name: '', country: '',
    logo_url: logoUrl,
    source: 'bsd-scrape',
  };
}

// ─── Cascade ──────────────────────────────────────────────────────────────────
async function resolveLogo(name, opts = {}) {
  // 1. BSD API (1 req/s)
  try {
    const r = await sourceBsdApi(name);
    if (r) return r;
  } catch (e) { if (opts.verbose) console.warn(`  [bsd-api] ${e.message}`); }
  await sleep(1000);

  // 2. TheSportsDB (2 req/s → on attend 500ms)
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

  // 4. Scraping BSD HTML (seulement si --match-id fourni pour ce nom)
  if (opts.matchId) {
    try {
      const r = await sourceBsdScrape(name, opts.matchId);
      if (r) return r;
    } catch (e) { if (opts.verbose) console.warn(`  [bsd-scrape] ${e.message}`); }
    await sleep(1000);
  }

  // 5. Fallback initiales (rien à scraper)
  return null;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { names: [], fromFile: null, dryRun: false, dbPath: DB_PATH, matchIds: {}, verbose: false, listSources: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from-file') { out.fromFile = argv[++i]; continue; }
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--db') { out.dbPath = argv[++i]; continue; }
    if (a === '--verbose' || a === '-v') { out.verbose = true; continue; }
    if (a === '--list-sources') { out.listSources = true; continue; }
    if (a === '--match-id') {
      // Format : --match-id "Team Name=12345" ou --match-id 12345 (applique au dernier nom)
      const v = argv[++i];
      const eq = v.indexOf('=');
      if (eq > 0) out.matchIds[v.slice(0, eq).trim()] = v.slice(eq + 1).trim();
      else if (out.names.length) out.matchIds[out.names[out.names.length - 1]] = v;
      continue;
    }
    if (a.startsWith('--')) { console.warn(`Option inconnue : ${a}`); continue; }
    // Positionnel : liste séparée par virgules
    for (const n of String(a).split(',').map(s => s.trim()).filter(Boolean)) out.names.push(n);
  }
  if (out.fromFile) {
    try {
      const lines = fs.readFileSync(out.fromFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      out.names.push(...lines);
    } catch (e) {
      console.error(`[FATAL] Lecture ${out.fromFile} impossible : ${e.message}`);
      process.exit(2);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.listSources || !opts.names.length) {
    console.log('ps-scrape-logos — cascade de sources logos équipes PariScore');
    console.log('');
    console.log('Sources activées dans cette exécution :');
    console.log(`  1. BSD API          : ${BSD_API_KEY ? 'ACTIVE (BSD_API_KEY présente)' : 'SKIP (pas de BSD_API_KEY)'}`);
    console.log(`  2. TheSportsDB      : ${THE_SPORTSDB_KEY === '3' ? 'clé test "3" (badges team = Pro requis, league logos OK)' : `clé ${THE_SPORTSDB_KEY}`}`);
    console.log(`  3. API-Football     : ${API_FOOTBALL_KEY ? 'ACTIVE (API_FOOTBALL_KEY présente)' : 'SKIP (pas de API_FOOTBALL_KEY)'}`);
    console.log(`  4. Scraping BSD HTML: ${Object.keys(opts.matchIds).length ? 'ACTIVE (--match-id fourni)' : 'SKIP (utilisez --match-id "Team=12345")'}`);
    console.log(`  5. Fallback initiales : toujours (marque comme non-résolu)`);
    console.log('');
    if (!opts.names.length) {
      console.log('Usage :');
      console.log('  node scripts/scrape-logos.js "Arsenal,Chelsea,Real Madrid"');
      console.log('  node scripts/scrape-logos.js --from-file teams.txt');
      console.log('  node scripts/scrape-logos.js "Arsenal" --dry-run');
      console.log('  node scripts/scrape-logos.js "Team X" --match-id "Team X=12345"');
      process.exit(0);
    }
  }

  const db = opts.dryRun ? null : openDb(opts.dbPath);

  // Pour le dry-run on simule quand même le cache lookup via une DB ouverte en lecture seule.
  const stats = { found: 0, failed: 0, sources: { 'bsd-api': 0, 'thesportsdb': 0, 'api-football': 0, 'bsd-scrape': 0, 'cache': 0 }, results: [] };

  console.log(`\n[${new Date().toISOString()}] Début scraping — ${opts.names.length} équipe(s). ${opts.dryRun ? '[DRY-RUN : pas d écriture DB]' : `[DB: ${path.relative(process.cwd(), opts.dbPath)}]`}\n`);

  for (const name of opts.names) {
    process.stdout.write(`• ${name.padEnd(28)} `);

    // Cache d'abord (sauf dry-run sans DB)
    if (db) {
      const cached = findInCache(db, name);
      if (cached) {
        console.log(`CACHE  → bsd_id=${cached.bsd_id}  ${cached.logo_url}`);
        stats.found++; stats.sources.cache++;
        stats.results.push({ name, status: 'cache', ...cached });
        continue;
      }
    }

    const r = await resolveLogo(name, { verbose: opts.verbose, matchId: opts.matchIds[name] });
    if (r) {
      console.log(`OK[${r.source.padEnd(12)}] → ${r.logo_url}`);
      stats.found++; stats.sources[r.source] = (stats.sources[r.source] || 0) + 1;
      if (db) {
        try {
          upsertLogo(db, { ...r, name_norm: normalizeTeamName(name) });
        } catch (e) {
          console.warn(`        (écriture DB échouée : ${e.message})`);
        }
      }
      stats.results.push({ name, status: r.source, bsd_id: r.bsd_id, logo_url: r.logo_url });
    } else {
      console.log('FAIL  → cascade épuisée, fallback initiales');
      stats.failed++;
      stats.results.push({ name, status: 'failed', bsd_id: null, logo_url: null });
    }
  }

  if (db) db.close();

  // ─── Rapport ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(78));
  console.log('  RAPPORT SCRAPE-LOGOS');
  console.log('═'.repeat(78));
  console.log(`  Total équipes   : ${opts.names.length}`);
  console.log(`  Logos trouvés   : ${stats.found}`);
  console.log(`  Échecs          : ${stats.failed}`);
  console.log('  Par source      :');
  console.log(`    cache (DB)    : ${stats.sources.cache}`);
  console.log(`    BSD API       : ${stats.sources['bsd-api']}`);
  console.log(`    TheSportsDB   : ${stats.sources.thesportsdb}     (note : badges team = clé Pro requise)`);
  console.log(`    API-Football  : ${stats.sources['api-football']}`);
  console.log(`    Scraping BSD  : ${stats.sources['bsd-scrape']}`);
  console.log('─'.repeat(78));
  const cfg = [
    BSD_API_KEY ? 'BSD_API_KEY' : null,
    THE_SPORTSDB_KEY === '3' ? 'THE_SPORTSDB_KEY=test(3)' : 'THE_SPORTSDB_KEY=Pro',
    API_FOOTBALL_KEY ? 'API_FOOTBALL_KEY' : 'API_FOOTBALL_KEY(absente)',
  ].filter(Boolean).join(', ');
  console.log(`  Config clés     : ${cfg}`);
  console.log(`  Mode            : ${opts.dryRun ? 'DRY-RUN (rien écrit)' : 'DB mise à jour'}`);
  console.log('═'.repeat(78) + '\n');
}

main().catch(e => {
  console.error('[FATAL]', e.stack || e.message);
  process.exit(1);
});
