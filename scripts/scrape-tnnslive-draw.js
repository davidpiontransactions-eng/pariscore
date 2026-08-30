#!/usr/bin/env node
'use strict';
/**
 * scrape-tnnslive-draw.js
 * -----------------------
 * Importe le tableau de bord du US Open 2026 dans la table `tennis_draw_bracket`.
 *
 * Sources :
 *   1. PDFs tnnslive.com (téléchargement + parsing si disponible)
 *   2. us_open_draw_2026.json (fallback principal, déjà extrait)
 *
 * Table cible : `tennis_draw_bracket` dans pariscore.db (better-sqlite3).
 *
 * Usage :
 *   node scripts/scrape-tnnslive-draw.js --all
 *   node scripts/scrape-tnnslive-draw.js --men
 *   node scripts/scrape-tnnslive-draw.js --women
 *   node scripts/scrape-tnnslive-draw.js --all --dry-run
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Constantes ───────────────────────────────────────────────────────────────
const DRAW_URLS = {
  men:   'https://tnnslive.com/draws/XMdlPyLwFAaounByxT1v/ms',
  women: 'https://tnnslive.com/draws/XMdlPyLwFAaounByxT1v/ws',
};

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HTTP_TIMEOUT_MS = 30000;
const YEAR = 2026;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DB_PATH = process.env.DATABASE_PATH || path.join(REPO_DIR, 'pariscore.db');
const JSON_PATH = path.join(REPO_DIR, 'us_open_draw_2026.json');

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}

const ALL_MODE    = !!args.all;
const MEN_ONLY    = !!args.men;
const WOMEN_ONLY  = !!args.women;
const DRY_RUN     = !!args['dry-run'];
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
      res.on('end', () => resolve(Buffer.concat(chunks)));
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
            resolve(Buffer.from(json.solution.response, 'utf-8'));
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
async function fetchBuffer(url) {
  if (FORCE_FLARE) {
    console.log(`[tnnslive] Mode FlareSolverr forcé`);
    return flareSolverrGet(url);
  }
  try {
    return await httpsGet(url);
  } catch (err) {
    const msg = String(err.message || err);
    console.log(`[tnnslive] HTTPS échoué: ${msg}`);
    if (msg.includes('403') || msg.includes('Timeout') || msg.includes('timeout')) {
      console.log(`[tnnslive] Tentative FlareSolverr...`);
      try {
        return await flareSolverrGet(url);
      } catch (flareErr) {
        throw new Error(`HTTPS (${msg}) + FlareSolverr (${flareErr.message})`);
      }
    }
    throw err;
  }
}

// ─── Chargement du JSON local (fallback principal) ────────────────────────────
function loadJsonDraw() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`[tnnslive] Fichier introuvable : ${JSON_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  return JSON.parse(raw);
}

// ─── Conversion JSON → lignes de la table ─────────────────────────────────────
function jsonToRows(section, players) {
  const slug = section === 'men' ? 'us-open-men' : 'us-open-women';
  return players.map((p) => ({
    tournament_slug: slug,
    year: YEAR,
    section: p.position,
    player_name: p.name,
    player_seed: p.seed,
    player_country: p.country,
    qualifier: p.qualifier ? 1 : 0,
    wildcard: p.wildcard ? 1 : 0,
    round_r128: p.name,
    round_r64: null,
    round_r32: null,
    round_r16: null,
    round_qf: null,
    round_sf: null,
    round_f: null,
    round_w: null,
  }));
}

// ─── Base de données ───────────────────────────────────────────────────────────
function openDb() {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tennis_draw_bracket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_slug TEXT NOT NULL,
      year INTEGER NOT NULL,
      section INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      player_seed INTEGER,
      player_country TEXT,
      qualifier INTEGER DEFAULT 0,
      wildcard INTEGER DEFAULT 0,
      round_r128 TEXT,
      round_r64 TEXT,
      round_r32 TEXT,
      round_r16 TEXT,
      round_qf TEXT,
      round_sf TEXT,
      round_f TEXT,
      round_w TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tournament_slug, year, section)
    );
  `);

  return db;
}

function upsertRows(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO tennis_draw_bracket
      (tournament_slug, year, section, player_name, player_seed, player_country,
       qualifier, wildcard, round_r128, round_r64, round_r32, round_r16,
       round_qf, round_sf, round_f, round_w, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tournament_slug, year, section) DO UPDATE SET
      player_name = excluded.player_name,
      player_seed = excluded.player_seed,
      player_country = excluded.player_country,
      qualifier = excluded.qualifier,
      wildcard = excluded.wildcard,
      round_r128 = excluded.round_r128,
      round_r64 = excluded.round_r64,
      round_r32 = excluded.round_r32,
      round_r16 = excluded.round_r16,
      round_qf = excluded.round_qf,
      round_sf = excluded.round_sf,
      round_f = excluded.round_f,
      round_w = excluded.round_w,
      updated_at = CURRENT_TIMESTAMP
  `);

  const insert = db.transaction((rs) => {
    for (const r of rs) {
      stmt.run(
        r.tournament_slug, r.year, r.section, r.player_name, r.player_seed,
        r.player_country, r.qualifier, r.wildcard, r.round_r128, r.round_r64,
        r.round_r32, r.round_r16, r.round_qf, r.round_sf, r.round_f, r.round_w,
      );
    }
  });

  insert(rows);
}

// ─── Scraper tnnslive (PDF) ───────────────────────────────────────────────────
async function tryScrapeTnnslive(section) {
  const url = DRAW_URLS[section];
  if (!url) return null;

  console.log(`[tnnslive] Tentative téléchargement PDF tnnslive.com — ${section}`);
  try {
    const buf = await fetchBuffer(url);
    const ct = buf.slice(0, 4).toString('ascii');
    if (ct !== '%PDF') {
      console.log(`[tnnslive] Réponse non-PDF (${ct}), fallback JSON`);
      return null;
    }
    console.log(`[tnnslive] PDF téléchargé (${buf.length} octets) — ${section}`);
    console.log(`[tnnslive] ⚠️  Parsing PDF non implémenté, utilisation du JSON local`);
    return null;
  } catch (err) {
    console.log(`[tnnslive] Échec téléchargement tnnslive.com: ${err.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[tnnslive] US Open ${YEAR} — scrape bracket draw`);

  // Valider les flags
  if (!ALL_MODE && !MEN_ONLY && !WOMEN_ONLY) {
    console.error('Usage: node scripts/scrape-tnnslive-draw.js --all|--men|--women [--dry-run]');
    process.exit(1);
  }

  // Charger le JSON local comme source de vérité
  const json = loadJsonDraw();
  console.log(`[tnnslive] JSON chargé : ${json.men.length} hommes, ${json.women.length} femmes`);

  let sections = [];
  if (ALL_MODE || MEN_ONLY)   sections.push({ key: 'men',   players: json.men });
  if (ALL_MODE || WOMEN_ONLY) sections.push({ key: 'women', players: json.women });

  // Pré-charger FlareSolverr une fois si nécessaire
  let flareAvailable = false;
  if (FORCE_FLARE) {
    flareAvailable = true;
  }

  let totalInserted = 0;

  for (const section of sections) {
    const label = section.key === 'men' ? 'Men' : 'Women';
    console.log(`\n[tnnslive] US Open ${label} — ${section.players.length} joueurs`);

    // Tenter tnnslive.com d'abord (PDF)
    await tryScrapeTnnslive(section.key);

    // Construire les lignes depuis le JSON
    const rows = jsonToRows(section.key, section.players);

    if (DRY_RUN) {
      console.log(`\n--- DRY RUN (${label}) — aucune écriture en base ---\n`);
      console.log(
        'Sec'.padEnd(5) +
        'Joueur'.padEnd(30) +
        'Seed'.padEnd(6) +
        'Pays'.padEnd(6) +
        'Q'.padEnd(3) +
        'WC'.padEnd(3) +
        'R128'.padEnd(25)
      );
      console.log('-'.repeat(80));
      for (const r of rows) {
        console.log(
          String(r.section).padEnd(5) +
          r.player_name.padEnd(30) +
          String(r.player_seed ?? '-').padEnd(6) +
          String(r.player_country ?? '-').padEnd(6) +
          (r.qualifier ? 'Q' : '-').padEnd(3) +
          (r.wildcard ? 'WC' : '-').padEnd(3) +
          (r.round_r128 ?? '-')
        );
      }
    } else {
      const db = openDb();
      upsertRows(db, rows);
      const slug = section.key === 'men' ? 'us-open-men' : 'us-open-women';
      const count = db.prepare(
        'SELECT COUNT(*) as c FROM tennis_draw_bracket WHERE tournament_slug = ? AND year = ?'
      ).get(slug, YEAR);
      db.close();

      totalInserted += count.c;
      console.log(`[tnnslive] ✅ ${count.c} joueurs en base pour ${slug} ${YEAR}`);
    }
  }

  if (!DRY_RUN) {
    console.log(`[tnnslive] ✅ Total : ${totalInserted} joueurs en base pour US Open ${YEAR}`);
  }
}

main().catch((err) => {
  console.error(`[tnnslive] Erreur fatale: ${err.message}`);
  process.exit(1);
});
