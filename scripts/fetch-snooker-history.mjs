/**
 * fetch-snooker-history.mjs — Télécharge SnookerDB puis extrait l'historique utile.
 *
 * SOURCE : SnookerDB (https://github.com/obrienjoey/snookerdb), licence GPL-3.0.
 *   - Données scrapées de CueTracker (circuit professionnel).
 *   - La base upstream est régénérée en nightly : ce script est donc re-jouable
 *     pour rafraîchir data/snooker_history.db.
 *
 * Ce que fait le script :
 *   1. Télécharge la DB brute (~58,5 Mo) vers un fichier temporaire (fetch natif,
 *      lecture par flux, erreurs réseau gérées) ;
 *   2. Recrée data/snooker_history.db en n'y copiant QUE les tables
 *      matches / tournament / players / rankings (ATTACH du brut +
 *      CREATE TABLE ... AS SELECT) puis les index demandés ;
 *   3. Supprime le brut temporaire et imprime un résumé (lignes par table,
 *      min/max de matches.date, taille du fichier).
 *
 * Modes d'exécution (double driver, comme le reste du projet) :
 *   node scripts/fetch-snooker-history.mjs [--verify]
 *   bun  scripts/fetch-snooker-history.mjs [--verify]
 *   bun:sqlite est essayé en premier (disponible sous Bun), repli better-sqlite3 (Node).
 *   --verify : n'ouvre que la destination (lecture seule) et affiche PRAGMA + comptes.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/obrienjoey/snookerdb/main/Database/snookerdb.db';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'data', 'snooker_history.db');
const TABLES = ['matches', 'tournament', 'players', 'rankings'];
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date)',
  'CREATE INDEX IF NOT EXISTS idx_matches_tourn_id ON matches(tourn_id)',
  'CREATE INDEX IF NOT EXISTS idx_matches_player_1_url ON matches(player_1_url)',
  'CREATE INDEX IF NOT EXISTS idx_matches_player_2_url ON matches(player_2_url)',
];

/** Schéma de référence (data dictionary upstream) — sert de contrôle dans --verify. */
const EXPECTED_COLUMNS = {
  matches: [
    'match_id', 'tourn_id', 'date', 'stage', 'best_of',
    'player_1_score', 'player_2_score', 'player_1', 'player_1_url',
    'player_2', 'player_2_url', 'scores', 'walkover', 'winner', 'winner_url',
  ],
  tournament: [
    'tourn_id', 'url', 'dates', 'name', 'season', 'category', 'venue',
    'city', 'country', 'sponsor', 'prize_fund', 'start_date', 'end_date',
  ],
  players: ['url', 'first_name', 'surname', 'nationality'],
  rankings: [
    'season', 'player_url', 'player_name', 'start_position', 'start_points',
    'difference', 'finish_position', 'finish_points',
  ],
};

// ---------------------------------------------------------------------------
// Double driver SQLite : bun:sqlite d'abord (si lancé avec bun), repli better-sqlite3
// ---------------------------------------------------------------------------

let cachedDriver = null;

/** Détecte une seule fois le driver disponible (bun:sqlite sous Bun, sinon better-sqlite3). */
async function detectDriver() {
  if (cachedDriver) return cachedDriver;
  try {
    await import('bun:sqlite');
    cachedDriver = 'bun:sqlite';
  } catch {
    cachedDriver = 'better-sqlite3';
  }
  return cachedDriver;
}

/**
 * Ouvre une base SQLite et retourne une enveloppe homogène :
 * les deux drivers n'exposent pas les mêmes méthodes de requête.
 */
async function openDb(file, opts = {}) {
  const driver = await detectDriver();
  if (driver === 'bun:sqlite') {
    const { Database } = await import('bun:sqlite');
    const db = new Database(file, opts);
    return {
      driver,
      exec: (sql) => db.exec(sql),
      get: (sql) => db.query(sql).get(),
      all: (sql) => db.query(sql).all(),
      close: () => db.close(),
    };
  }
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  const db = new Database(file, opts);
  return {
    driver,
    exec: (sql) => db.exec(sql),
    get: (sql) => db.prepare(sql).get(),
    all: (sql) => db.prepare(sql).all(),
    close: () => db.close(),
  };
}

// ---------------------------------------------------------------------------
// Petit utilitaire d'affichage (la sortie est redirigée vers un log par le shell)
// ---------------------------------------------------------------------------

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function mo(o) {
  return `${(o / 1024 / 1024).toFixed(1)} Mo`;
}

function sqlPath(p) {
  return p.replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// 1. Téléchargement du brut
// ---------------------------------------------------------------------------

async function download(destFile) {
  log(`Téléchargement : ${SOURCE_URL}`);
  let res;
  try {
    res = await fetch(SOURCE_URL, { redirect: 'follow' });
  } catch (err) {
    throw new Error(`échec réseau : ${err && err.message ? err.message : err}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  if (!res.body) throw new Error('réponse HTTP sans corps');

  const total = Number(res.headers.get('content-length')) || 0;
  const fd = fs.openSync(destFile, 'w');
  const reader = res.body.getReader();
  let received = 0;
  let lastReport = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      fs.writeSync(fd, Buffer.from(value));
      received += value.byteLength;
      if (received - lastReport >= 16 * 1024 * 1024) {
        lastReport = received;
        log(`  … ${mo(received)}${total ? ` / ${mo(total)}` : ''}`);
      }
    }
  } catch (err) {
    throw new Error(`flux interrompu après ${mo(received)} : ${err && err.message ? err.message : err}`);
  } finally {
    fs.closeSync(fd);
  }

  if (total && received !== total) {
    throw new Error(`téléchargement tronqué : ${received} octets reçus / ${total} annoncés`);
  }
  if (received === 0) throw new Error('téléchargement vide (0 octet)');
  log(`Téléchargé : ${mo(received)}`);
  return received;
}

// ---------------------------------------------------------------------------
// 2. Extraction des 4 tables vers data/snooker_history.db
// ---------------------------------------------------------------------------

async function extract(tmpFile) {
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  // Construction dans un fichier TEMPORAIRE, à côté de la destination.
  //
  // L'implémentation d'origine faisait `rmSync(DEST)` AVANT l'extraction : la
  // base était donc détruite d'entrée, et un échec en cours de route (tables
  // absentes, disque plein, crash) laissait data/snooker_history.db absent ou
  // incomplet — avec pour conséquence un backtest vide en prod, sans aucun
  // avertissement. Inacceptable pour un job planifié en cron, qui doit être
  // rejouable à volonté.
  //
  // Ici DEST n'est touchée qu'après extraction complète, via `renameSync`
  // (opération atomique sur le même filesystem) : échec ⇒ l'ancienne base
  // reste intacte, le prochain run repart de zéro sur le .tmp.
  const out = `${DEST}.tmp`;
  fs.rmSync(out, { force: true });

  const db = await openDb(out);
  log(`Driver : ${db.driver}`);
  try {
    db.exec(`ATTACH DATABASE '${sqlPath(tmpFile)}' AS src`);

    const present = new Set(
      db.all("SELECT name FROM src.sqlite_master WHERE type = 'table'").map((r) => r.name),
    );
    const missing = TABLES.filter((t) => !present.has(t));
    if (missing.length) {
      throw new Error(`tables absentes dans la base source : ${missing.join(', ')}`);
    }

    for (const table of TABLES) {
      db.exec(`CREATE TABLE ${table} AS SELECT * FROM src.${table}`);
    }
    for (const sql of INDEXES) db.exec(sql);

    db.exec('DETACH DATABASE src');
  } finally {
    db.close();
  }

  // Tout a réussi : on bascule sur la nouvelle base.
  if (fs.existsSync(DEST)) fs.rmSync(DEST);
  fs.renameSync(out, DEST);
  log('Destination remplacée (extraction complète).');
}

// ---------------------------------------------------------------------------
// 3. Résumé / vérification
// ---------------------------------------------------------------------------

function columnsOf(db, table) {
  return db.all(`PRAGMA table_info(${table})`).map((r) => r.name);
}

function reportCounts(db) {
  log('--- Comptes de lignes ---');
  for (const table of TABLES) {
    const row = db.get(`SELECT COUNT(*) AS n FROM ${table}`);
    log(`  ${table.padEnd(10)} ${row.n}`);
  }
  const dates = db.get('SELECT MIN(date) AS min_date, MAX(date) AS max_date, COUNT(*) AS n FROM matches');
  log(`--- matches.date --- min=${dates.min_date} max=${dates.max_date} (n=${dates.n})`);
}

function reportSchema(db) {
  log('--- PRAGMA table_info ---');
  for (const table of TABLES) {
    const cols = db.all(`PRAGMA table_info(${table})`);
    const names = cols.map((c) => `${c.name}:${c.type || '?'}`);
    log(`  ${table} (${cols.length} cols) : ${names.join(', ')}`);
    // Comparaison en ensemble : l'ORDRE des colonnes du data dictionary n'est pas
    // une obligation (l'ordre réel de la source peut différer, seul le jeu compte).
    const expected = [...(EXPECTED_COLUMNS[table] || [])].sort();
    const actual = cols.map((c) => c.name).sort();
    const same = expected.length === actual.length && expected.every((c, i) => c === actual[i]);
    log(`     mêmes colonnes que le data dictionary upstream : ${same ? 'OUI' : `NON (attendu : ${expected.join(',')} ; obtenu : ${actual.join(',')})`}`);
  }
}

async function verify() {
  if (!fs.existsSync(DEST)) throw new Error(`destination absente : ${DEST}`);
  const size = fs.statSync(DEST).size;
  const db = await openDb(DEST, { readonly: true });
  try {
    log(`--- Vérification ${DEST} (driver ${db.driver}) ---`);
    log(`Taille : ${size} octets (${mo(size)})`);
    reportSchema(db);
    reportCounts(db);
    const idx = db.all("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_matches%' ORDER BY name");
    log('--- Index matches ---');
    for (const i of idx) log(`  ${i.name} ON ${i.tbl_name}`);
  } finally {
    db.close();
  }
}

async function main() {
  const tmpFile = path.join(os.tmpdir(), `snookerdb-${process.pid}-${Date.now()}.db`);
  try {
    await download(tmpFile);
    await extract(tmpFile);
    const size = fs.statSync(DEST).size;
    log(`--- Destination --- ${DEST}`);
    log(`Taille : ${size} octets (${mo(size)})`);
    const db = await openDb(DEST, { readonly: true });
    try {
      reportCounts(db);
    } finally {
      db.close();
    }
    log('Terminé.');
  } finally {
    // Le brut temporaire ne doit jamais survivre au script.
    if (fs.existsSync(tmpFile)) {
      fs.rmSync(tmpFile, { force: true });
      log(`Fichier brut temporaire supprimé : ${path.basename(tmpFile)}`);
    }
  }
}

const verifyOnly = process.argv.includes('--verify');
try {
  if (verifyOnly) {
    await verify();
  } else {
    await main();
  }
} catch (err) {
  process.stderr.write(`ERREUR : ${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
}
