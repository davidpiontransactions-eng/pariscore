#!/usr/bin/env node
'use strict';
/**
 * scrape-usopen-draw.js
 * ---------------------
 * Scraper dédié pour les pages de forecast US Open TennisAbstract.
 *
 * Source : https://www.tennisabstract.com/current/2026USOpenMenForecast.html
 *          https://www.tennisabstract.com/current/2026USOpenWomenForecast.html
 *
 * Parse le HTML natif (<td>, <a href>) pour extraire TA IDs, noms et probabilités.
 * Écriture : table `tennis_draw_forecast` dans pariscore.db.
 *
 * Usage :
 *   node scripts/scrape-usopen-draw.js --tournament=us-open-men
 *   node scripts/scrape-usopen-draw.js --tournament=us-open-women
 *   node scripts/scrape-usopen-draw.js --all
 *   node scripts/scrape-usopen-draw.js --list
 *   node scripts/scrape-usopen-draw.js --tournament=us-open-men --dry-run
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Mapping tournois US Open ─────────────────────────────────────────────────
const TOURNAMENTS = {
  'us-open-men': {
    filename: '2026USOpenMenForecast',
    name: 'US Open Men',
    category: 'Grand Slam',
    surface: 'Hard',
    slugDb: 'us-open',
  },
  'us-open-women': {
    filename: '2026USOpenWomenForecast',
    name: 'US Open Women',
    category: 'Grand Slam',
    surface: 'Hard',
    slugDb: 'us-open-women',
  },
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

// ─── FlareSolverr fallback ────────────────────────────────────────────────────
const FLARE_HOST = process.env.FLARE_HOST || 'localhost';
const FLARE_PORT = process.env.FLARE_PORT || '8191';

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

// ─── Parsing HTML natif ───────────────────────────────────────────────────────
// Extrait les <tr>/<td> du draw TennisAbstract.
// Format cellule joueur : (Seed)<a href="...?p=TaId">Name</a> (Country)
// Format cellules probs  : &nbsp;&nbsp;XX.X%
function parseHtmlDraw(html) {
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const players = [];
  let section = 0;

  let trMatch;
  while ((trMatch = trPattern.exec(clean)) !== null) {
    const rowHtml = trMatch[1];

    // Extrait les <td> de la ligne
    const cells = [];
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }

    // Ligne vide → séparateur de section
    if (cells.length <= 1) {
      const text = cells[0]?.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
      if (!text) { section++; continue; }
    }

    // En-tête "Player" → ignorer
    const firstText = cells[0]?.replace(/<[^>]+>/g, '').trim();
    if (firstText === 'Player') continue;

    // Au moins 8 cellules : player + spacer + 7 rounds (R64→W)
    if (cells.length < 8) continue;

    // ── Cellule joueur ──────────────────────────────────────────────────────
    const playerCell = cells[0];

    // TA ID depuis <a href="...?p=XXX">
    const linkMatch = playerCell.match(/href="[^"]*\?p=([^"&]+)"/);
    const taId = linkMatch ? linkMatch[1] : null;

    // Texte brut du joueur (sans balises)
    const playerText = playerCell
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();

    // Pays : "Name (USA)" → country = USA
    const countryMatch = playerText.match(/\(([A-Z]{2,3})\)\s*$/);
    let name = playerText;
    let country = null;
    if (countryMatch) {
      country = countryMatch[1];
      name = playerText.slice(0, countryMatch.index).trim();
    }

    // Qualifier : (Q), (WC), (LL), (PR) au début
    let seed = null;
    let qualifier = null;
    const qualMatch = name.match(/^\((Q|WC|LL|PR)\)\s*/);
    if (qualMatch) {
      qualifier = qualMatch[1];
      name = name.slice(qualMatch[0].length).trim();
    } else {
      // Seed : (1), (25), etc.
      const seedMatch = name.match(/^\((\d+)\)\s*/);
      if (seedMatch) {
        seed = parseInt(seedMatch[1], 10);
        name = name.slice(seedMatch[0].length).trim();
      }
    }

    if (!name || !country) continue;

    // ── Probabilités (colonnes 2→8, skip spacer en colonne 1) ──────────────
    const probCells = cells.slice(2, 9);
    const probs = probCells.map((c) => {
      const text = c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
      if (!text || text === '-') return null;
      const val = parseFloat(text.replace('%', ''));
      return isNaN(val) ? null : val / 100;
    });

    if (probs.length < 7) continue;

    players.push({
      name,
      seed,
      qualifier,
      country,
      taId,
      probR16: probs[2] ?? null,
      probQf: probs[3] ?? null,
      probSf: probs[4] ?? null,
      probF: probs[5] ?? null,
      probWin: probs[6] ?? null,
      section: Math.min(section, 3),
    });
  }

  return players;
}

// ─── Base de données ───────────────────────────────────────────────────────────
function openDb() {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

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

// ─── Scraper un tournoi ───────────────────────────────────────────────────────
async function scrapeOne(key, tournament) {
  const url = `${BASE_URL}${tournament.filename}.html`;
  console.log(`\n[draw] ${tournament.name} (${tournament.category}) — ${url}`);

  try {
    const html = await fetchHtml(url);
    const players = parseHtmlDraw(html);
    console.log(`[draw] ${players.length} joueurs extraits`);

    if (DRY_RUN) {
      console.log('\n--- DRY RUN (aucune écriture en base) ---\n');
      console.log(
        'Joueur'.padEnd(30) +
        'Seed'.padEnd(6) +
        'Qual'.padEnd(6) +
        'Pays'.padEnd(6) +
        'TA ID'.padEnd(20) +
        'R16'.padEnd(8) +
        'QF'.padEnd(8) +
        'SF'.padEnd(8) +
        'F'.padEnd(8) +
        'Win'.padEnd(8) +
        'Sec'
      );
      console.log('-'.repeat(120));
      for (const p of players) {
        console.log(
          p.name.padEnd(30) +
          String(p.seed ?? '').padEnd(6) +
          String(p.qualifier ?? '').padEnd(6) +
          String(p.country ?? '').padEnd(6) +
          String(p.taId ?? '').padEnd(20) +
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
      upsertPlayers(db, tournament.slugDb, YEAR, players);
      const count = db.prepare(
        'SELECT COUNT(*) as c FROM tennis_draw_forecast WHERE tournament_slug = ? AND year = ?'
      ).get(tournament.slugDb, YEAR);
      db.close();
      console.log(`[draw] ✅ ${count.c} joueurs en base pour ${tournament.slugDb} ${YEAR}`);
    }

    return players.length;
  } catch (err) {
    console.error(`[draw] ❌ Erreur ${key}: ${err.message}`);
    return 0;
  }
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function fmt(v) {
  if (v == null) return '-';
  return (v * 100).toFixed(1) + '%';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (LIST_ONLY) {
    console.log('Tournois US Open disponibles :');
    for (const [k, v] of Object.entries(TOURNAMENTS)) {
      console.log(`  ${k.padEnd(20)} ${v.name.padEnd(25)} ${v.category}`);
    }
    return;
  }

  if (!TOURNAMENT_KEY && !ALL_MODE) {
    console.error('Usage: node scripts/scrape-usopen-draw.js --tournament=<key> | --all | --list');
    process.exit(1);
  }

  if (ALL_MODE) {
    let total = 0;
    for (const [k, v] of Object.entries(TOURNAMENTS)) {
      total += await scrapeOne(k, v);
    }
    console.log(`\n[draw] Total: ${total} joueurs traités`);
  } else {
    const t = TOURNAMENTS[TOURNAMENT_KEY];
    if (!t) {
      console.error(`[draw] Tournoi inconnu : ${TOURNAMENT_KEY}`);
      console.error(`[draw] Clés disponibles : ${Object.keys(TOURNAMENTS).join(', ')}`);
      process.exit(1);
    }
    await scrapeOne(TOURNAMENT_KEY, t);
  }
}

main().catch((err) => {
  console.error(`[draw] Erreur fatale: ${err.message}`);
  process.exit(1);
});
