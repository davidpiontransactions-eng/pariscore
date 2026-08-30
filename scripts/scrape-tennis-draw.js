#!/usr/bin/env node
'use strict';
/**
 * scrape-tennis-draw.js
 * ---------------------
 * Scraper des pages de forecast de tournois TennisAbstract.
 *
 * Source : https://www.tennisabstract.com/current/{filename}.html
 * Extrait la variable JS `proj32` (tableau HTML des probabilités par round).
 *
 * Écriture : table `tennis_draw_forecast` dans pariscore.db (better-sqlite3).
 *
 * Usage :
 *   node scripts/scrape-tennis-draw.js --tournament=monterrey --year=2026
 *   node scripts/scrape-tennis-draw.js --tournament=monterrey --dry-run
 *   node scripts/scrape-tennis-draw.js --list
 *
 * La table `tennis_draw_forecast` est créée automatiquement si absente.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Mapping tournois ─────────────────────────────────────────────────────────
const TOURNAMENTS = {
  monterrey:        { filename: '2026WTAMonterrey',      name: 'Monterrey Open',          category: 'WTA 500',      surface: 'Hard' },
  'australian-open': { filename: '2026AustralianOpen',   name: 'Australian Open',          category: 'Grand Slam',   surface: 'Hard' },
  'roland-garros':   { filename: '2026RolandGarros',     name: 'Roland-Garros',            category: 'Grand Slam',   surface: 'Clay' },
  wimbledon:         { filename: '2026Wimbledon',         name: 'Wimbledon',                category: 'Grand Slam',   surface: 'Grass' },
  'us-open':         { filename: '2026USOpen',            name: 'US Open',                  category: 'Grand Slam',   surface: 'Hard' },
  'indian-wells':    { filename: '2026IndianWells',      name: 'Indian Wells',             category: 'ATP/WTA 1000', surface: 'Hard' },
  miami:             { filename: '2026Miami',             name: 'Miami Open',               category: 'ATP/WTA 1000', surface: 'Hard' },
  'monte-carlo':     { filename: '2026MonteCarlo',       name: 'Monte-Carlo Masters',      category: 'ATP 1000',     surface: 'Clay' },
  madrid:            { filename: '2026Madrid',            name: 'Madrid Open',              category: 'ATP/WTA 1000', surface: 'Clay' },
  rome:              { filename: '2026Rome',              name: 'Italian Open',             category: 'ATP/WTA 1000', surface: 'Clay' },
  canada:            { filename: '2026Canada',            name: 'Canadian Open',            category: 'ATP/WTA 1000', surface: 'Hard' },
  cincinnati:        { filename: '2026Cincinnati',        name: 'Cincinnati Masters',       category: 'ATP/WTA 1000', surface: 'Hard' },
  shanghai:          { filename: '2026Shanghai',          name: 'Shanghai Masters',         category: 'ATP 1000',     surface: 'Hard' },
  paris:             { filename: '2026Paris',             name: 'Paris Masters',            category: 'ATP 1000',     surface: 'Hard (indoor)' },
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.tennisabstract.com/current/';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HTTP_TIMEOUT_MS = 30000;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DB_PATH = process.env.DATABASE_PATH || path.join(REPO_DIR, 'pariscore.db');

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}

const TOURNAMENT_KEY = typeof args.tournament === 'string' ? args.tournament : null;
const YEAR = args.year ? parseInt(args.year, 10) : new Date().getFullYear();
const DRY_RUN = !!args['dry-run'];
const LIST_ONLY = !!args.list;
const ALL_MODE = !!args.all;
const FORCE_FLARE = !!args.flaresolverr;

// ─── HTTPS GET (module natif, zéro-dépendance) ────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: HTTP_TIMEOUT_MS,
    }, (res) => {
      // Suivre les redirections (301/302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = new URL(res.headers.location, url).href;
        httpsGet(redirect).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${url}`)); });
  });
}

// ─── FlareSolverr fallback (pour VPS/datacenter IPs) ──────────────────────────
const FLARE_HOST = process.env.FLARE_HOST || 'localhost';
const FLARE_PORT = process.env.FLARE_PORT || '8191';
const FLARE_URL = `http://${FLARE_HOST}:${FLARE_PORT}/v1`;

function flareSolverrGet(url) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const body = JSON.stringify({
      cmd: 'request.get',
      url,
      maxTimeout: HTTP_TIMEOUT_MS,
    });
    const opts = {
      hostname: FLARE_HOST,
      port: parseInt(FLARE_PORT, 10),
      path: '/v1',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: HTTP_TIMEOUT_MS + 10000,
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (json.status === 'ok' && json.solution && json.solution.response) {
            resolve(json.solution.response);
          } else {
            reject(new Error(`FlareSolverr: ${json.message || 'status ' + json.status}`));
          }
        } catch (e) {
          reject(new Error(`FlareSolverr parse error: ${e.message}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`FlareSolverr timeout ${url}`)); });
    req.write(body);
    req.end();
  });
}

// ─── Fetch avec fallback FlareSolverr ─────────────────────────────────────────
async function fetchHtml(url) {
  // Mode forcé FlareSolverr (pour test ou VPS sans HTTPS direct)
  if (FORCE_FLARE) {
    console.log(`[draw] Mode FlareSolverr forcé`);
    return flareSolverrGet(url);
  }
  try {
    return await httpsGet(url);
  } catch (err) {
    const msg = String(err.message || err);
    console.log(`[draw] HTTPS échoué: ${msg}`);
    if (msg.includes('403') || msg.includes('Timeout') || msg.includes('timeout')) {
      console.log(`[draw] Tentative FlareSolverr...`);
      try {
        return await flareSolverrGet(url);
      } catch (flareErr) {
        throw new Error(`HTTPS (${msg}) + FlareSolverr (${flareErr.message})`);
      }
    }
    throw err;
  }
}

// ─── Extraction de la variable JS proj32 depuis le HTML ────────────────────────
function extractProj32(html) {
  // Cherche : var proj32 = '...'; ou proj32 = `...`;
  const patterns = [
    /var\s+proj32\s*=\s*'([\s\S]*?)';/,
    /var\s+proj32\s*=\s*"([\s\S]*?)";/,
    /var\s+proj32\s*=\s*`([\s\S]*?)`;/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return m[1];
  }
  return null;
}

// ─── Parsing d'une ligne joueur ────────────────────────────────────────────────
// Format : "(Seed)<a href='...'>Name</a> (Country)" ou "Name (Country)" ou "Bye"
function parsePlayerCell(cellHtml) {
  const text = cellHtml
    .replace(/<[^>]+>/g, '')       // supprime les balises HTML
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

  if (!text || text === 'Bye') return { name: 'Bye', seed: null, qualifier: null, country: null, taId: null };

  // Extrait l'ID TennisAbstract depuis le lien href
  const linkMatch = cellHtml.match(/href="[^"]*\/(?:players|player)\?p=([^"&]+)"/);
  const taId = linkMatch ? linkMatch[1] : null;

  // Détecte le seed : (1), (2), etc. ou le qualifier : (Q), (WC), (LL), (PR)
  let seed = null;
  let qualifier = null;
  let remaining = text;

  const seedMatch = text.match(/^\((\d+)\)\s*/);
  if (seedMatch) {
    seed = parseInt(seedMatch[1], 10);
    remaining = text.slice(seedMatch[0].length);
  } else {
    const qualMatch = text.match(/^\((Q|WC|LL|PR)\)\s*/);
    if (qualMatch) {
      qualifier = qualMatch[1];
      remaining = text.slice(qualMatch[0].length);
    }
  }

  // Extrait le pays : "Name (XXX)" → country = XXX
  const countryMatch = remaining.match(/\(([A-Z]{2,3})\)\s*$/);
  let name = remaining;
  let country = null;
  if (countryMatch) {
    country = countryMatch[1];
    name = remaining.slice(0, countryMatch.index).trim();
  }

  return { name: name.trim(), seed, qualifier, country, taId };
}

// ─── Parsing complet de la table proj32 ────────────────────────────────────────
function parseProj32(htmlTable) {
  const players = [];
  const rows = htmlTable.split(/<tr[^>]*>/i);
  let section = 0;

  for (const row of rows) {
    // Extrait toutes les cellules <td> de la ligne
    const cells = [];
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdPattern.exec(row)) !== null) {
      cells.push(tdMatch[1]);
    }

    // Ligne vide = séparateur de section (top/bottom du draw)
    if (cells.length === 0 || (cells.length === 1 && cells[0].trim() === '')) {
      section++;
      continue;
    }

    // Première cellule = en-tête (Player, R16, QF, etc.)
    const firstCellText = cells[0].replace(/<[^>]+>/g, '').trim();
    if (firstCellText === 'Player') continue;

    // Au moins 6 colonnes : Player + spacer + 5 rounds (ou 6 sans spacer)
    if (cells.length < 6) continue;

    const player = parsePlayerCell(cells[0]);
    if (player.name === 'Bye' || !player.name) continue;

    // Extrait les probabilités (supprime %, convertit en float 0-1)
    // TennisAbstract a 7 colonnes : Player + spacer (&nbsp;) + 5 rounds
    const probCells = cells.length >= 7 ? cells.slice(2, 7) : cells.slice(1, 6);
    const probs = probCells.map((c) => {
      const text = c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').replace(/&amp;/g, '&').trim();
      if (!text || text === '' || text === '-') return null;
      const val = parseFloat(text.replace('%', ''));
      return isNaN(val) ? null : val / 100;
    });

    players.push({
      name: player.name,
      seed: player.seed,
      qualifier: player.qualifier,
      country: player.country,
      taId: player.taId,
      probR16: probs[0],
      probQf: probs[1],
      probSf: probs[2],
      probF: probs[3],
      probWin: probs[4],
      section: Math.min(section, 3),
    });
  }

  return players;
}

// ─── Base de données ───────────────────────────────────────────────────────────
function openDb() {
  // better-sqlite3 est un module natif CJS — require dynamique
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  // Crée la table si elle n'existe pas
  db.exec(`
    CREATE TABLE IF NOT EXISTS tennis_draw_forecast (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_slug TEXT NOT NULL,
      year INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      player_seed INTEGER,
      player_qualifier TEXT,
      player_country TEXT,
      player_ta_id TEXT,
      prob_r16 REAL,
      prob_qf REAL,
      prob_sf REAL,
      prob_f REAL,
      prob_win REAL,
      section INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tournament_slug, year, player_name)
    );
  `);

  return db;
}

function upsertPlayers(db, slug, year, players) {
  const stmt = db.prepare(`
    INSERT INTO tennis_draw_forecast
      (tournament_slug, year, player_name, player_seed, player_qualifier,
       player_country, player_ta_id, prob_r16, prob_qf, prob_sf, prob_f,
       prob_win, section, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tournament_slug, year, player_name) DO UPDATE SET
      player_seed = excluded.player_seed,
      player_qualifier = excluded.player_qualifier,
      player_country = excluded.player_country,
      player_ta_id = excluded.player_ta_id,
      prob_r16 = excluded.prob_r16,
      prob_qf = excluded.prob_qf,
      prob_sf = excluded.prob_sf,
      prob_f = excluded.prob_f,
      prob_win = excluded.prob_win,
      section = excluded.section,
      updated_at = CURRENT_TIMESTAMP
  `);

  const insert = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        slug, year, r.name, r.seed, r.qualifier,
        r.country, r.taId, r.probR16, r.probQf, r.probSf, r.probF,
        r.probWin, r.section,
      );
    }
  });

  insert(players);
}

// ─── Scraper un seul tournoi ──────────────────────────────────────────────────
async function scrapeOne(slug, tournament) {
  const url = `${BASE_URL}${tournament.filename}.html`;
  console.log(`\n[draw] ${tournament.name} (${tournament.category}) — ${url}`);

  try {
    const html = await fetchHtml(url);
    const proj32 = extractProj32(html);

    if (!proj32) {
      console.error(`[draw] Variable proj32 introuvable pour ${slug}`);
      return 0;
    }

    const players = parseProj32(proj32);
    console.log(`[draw] ${players.length} joueurs extraits`);

    if (DRY_RUN) {
      console.log('\n--- DRY RUN (aucune écriture en base) ---\n');
      console.log(
        'Joueur'.padEnd(30) +
        'Seed'.padEnd(6) +
        'Qual'.padEnd(6) +
        'Pays'.padEnd(6) +
        'R16'.padEnd(8) +
        'QF'.padEnd(8) +
        'SF'.padEnd(8) +
        'F'.padEnd(8) +
        'Win'.padEnd(8) +
        'Sec'
      );
      console.log('-'.repeat(100));
      for (const p of players) {
        console.log(
          p.name.padEnd(30) +
          String(p.seed ?? '').padEnd(6) +
          String(p.qualifier ?? '').padEnd(6) +
          String(p.country ?? '').padEnd(6) +
          fmt(p.probR16).padEnd(8) +
          fmt(p.probQf).padEnd(8) +
          fmt(p.probSf).padEnd(8) +
          fmt(p.probF).padEnd(8) +
          fmt(p.probWin).padEnd(8) +
          String(p.section)
        );
      }
    } else {
      const db = openDb();
      upsertPlayers(db, slug, YEAR, players);
      db.close();
      console.log(`[draw] ${players.length} joueurs insérés/upsertés dans ${DB_PATH}`);
    }
    return players.length;
  } catch (err) {
    console.error(`[draw] Erreur ${slug}: ${(err).message}`);
    return 0;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Mode --list : affiche les tournois disponibles
  if (LIST_ONLY) {
    console.log('Tournois disponibles :');
    for (const [key, info] of Object.entries(TOURNAMENTS)) {
      console.log(`  ${key.padEnd(20)} ${info.name} (${info.category}, ${info.surface})`);
    }
    return;
  }

  // Mode --all : scrape tous les tournois
  if (ALL_MODE) {
    console.log(`[draw] Mode ALL — ${Object.keys(TOURNAMENTS).length} tournois`);
    let total = 0;
    let ok = 0;
    for (const [slug, info] of Object.entries(TOURNAMENTS)) {
      const n = await scrapeOne(slug, info);
      total += n;
      if (n > 0) ok++;
    }
    console.log(`\n[draw] Terminé : ${ok}/${Object.keys(TOURNAMENTS).length} tournois, ${total} joueurs total`);
    return;
  }

  if (!TOURNAMENT_KEY) {
    console.error('Usage: node scripts/scrape-tennis-draw.js --tournament=<slug> [--year=2026] [--dry-run]');
    console.error('       node scripts/scrape-tennis-draw.js --all [--dry-run]');
    console.error('       node scripts/scrape-tennis-draw.js --list');
    process.exit(1);
  }

  const tournament = TOURNAMENTS[TOURNAMENT_KEY];
  if (!tournament) {
    console.error(`Tournoi inconnu : "${TOURNAMENT_KEY}". Utilisez --list pour voir les options.`);
    process.exit(1);
  }

  await scrapeOne(TOURNAMENT_KEY, tournament);
}

function fmt(v) {
  if (v === null || v === undefined) return '-';
  return (v * 100).toFixed(1) + '%';
}

main();
