#!/usr/bin/env node
/**
 * tools/update-tennis-ranks.js
 *
 * Met à jour les rangs ATP/WTA (atp_rank, wta_rank) dans tennis_players_elo
 * à partir du dernier rang connu dans tennis_matches (winner_rank/loser_rank).
 *
 * Problème : recompute-tennis-elo.js INSÈRE dans tennis_players_elo avec
 * atp_rank=NULL, wta_rank=NULL. Les rangs officiels sont dans tennis_matches
 * (25437 rows avec winner_rank, 25257 avec loser_rank — 1417 joueurs uniques).
 *
 * Ce script :
 *   1. Pour chaque joueur dans tennis_players_elo, cherche le dernier match
 *      (tourney_date DESC) où il apparaît comme winner ou loser.
 *   2. Prend le winner_rank ou loser_rank correspondant.
 *   3. UPDATE atp_rank / wta_rank dans tennis_players_elo.
 *
 * Usage :
 *   node tools/update-tennis-ranks.js              # production
 *   node tools/update-tennis-ranks.js --dry-run    # dry-run (ne modifie rien)
 *
 * Crontab (après recompute-tennis-elo, avant cron_sps_updater) :
 *   0 14 * * 1 cd /home/ubuntu/pariscore && node tools/update-tennis-ranks.js >> logs/cron-tennis-ranks.log 2>&1
 *
 * Logging : écrit dans un fichier de log rotatif (logs/cron-tennis-ranks.log)
 *           et sur stderr (visible dans cron mail / docker logs).
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const LOG_PATH = path.join(ROOT, 'logs', 'cron-tennis-ranks.log');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Logging ───────────────────────────────────────────────────────────────

const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

function log(level, msg) {
  if (levels[level] === undefined) level = 'INFO';
  if (levels[level] > (levels[LOG_LEVEL] || levels.INFO)) return;
  const line = `${new Date().toISOString().replace('T', ' ').slice(0, 19)} [${level}] ${msg}`;
  process.stderr.write(line + '\n');
  try {
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch (_) { /* best-effort */ }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalise un nom (NFD → strip diacritics → lowercase → collapse). */
function norm(s) {
  if (!s) return '';
  return s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const t0 = Date.now();
  log('INFO', `=== update-tennis-ranks start === db=${DB_PATH} dry=${DRY_RUN}`);

  if (!fs.existsSync(DB_PATH)) {
    log('ERROR', `Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: false });
  db.pragma('journal_mode = WAL');

  try {
    // 1. Lire tous les joueurs de tennis_players_elo
    const players = db.prepare(`
      SELECT DISTINCT player_id, player_name, circuit, atp_rank, wta_rank
      FROM tennis_players_elo
      WHERE player_name IS NOT NULL AND player_name != ''
    `).all();

    log('INFO', `Found ${players.length} players in tennis_players_elo`);

    // 2. Préparer la requête du dernier rang connu pour un nom donné.
    //    On match en SQL sur LOWER(nm) = LOWER(?) avec le nom BRUT en paramètre,
    //    ET en OR avec le nom NORMALISÉ via norm() (sans accents) pour gérer les
    //    noms accentués stockés différemment entre tennis_players_elo et
    //    tennis_matches. LIMIT 20 car plusieurs candidats peuvent correspondre
    //    en SQL (accents vs pas d'accents) ; on affine ensuite en JS via norm().
    const stmtLatestRank = db.prepare(`
      SELECT nm, rk, td, tour FROM (
        SELECT winner_name AS nm, winner_rank AS rk, tourney_date AS td, tour
        FROM tennis_matches
        WHERE winner_rank IS NOT NULL AND winner_rank > 0
        UNION ALL
        SELECT loser_name AS nm, loser_rank AS rk, tourney_date AS td, tour
        FROM tennis_matches
        WHERE loser_rank IS NOT NULL AND loser_rank > 0
      )
      WHERE LOWER(nm) = LOWER(?) OR LOWER(nm) = LOWER(?)
      ORDER BY td DESC
      LIMIT 20
    `);

    // 3. Pour chaque joueur, trouver le dernier rang
    let updated = 0;
    let skipped = 0;
    const updateStmt = db.prepare(`
      UPDATE tennis_players_elo
      SET atp_rank = ?, wta_rank = ?, updated_at = ?
      WHERE player_id = ? AND circuit = ?
    `);

    const tx = db.transaction(() => {
      for (const p of players) {
        const circuit = (p.circuit || '').toUpperCase();
        // Déterminer quel rang on cherche
        const currentRank = circuit === 'WTA' ? p.wta_rank : p.atp_rank;
        // Si déjà rempli, on passe
        if (currentRank != null && currentRank > 0) {
          skipped++;
          continue;
        }

        // Matching par nom normalisé : on passe le nom BRUT et le nom norm()
        // (sans accents) à la requête SQL, puis on affine en JS pour ne garder
        // que le candidat dont norm(nm) === norm(player_name). C'était le bug
        // P0-3 : avant on passait p.player_name BRUT à une query qui ne
        // normalisait QUE la casse, ce qui cassait le matching pour tout nom
        // accentué.
        const normalized = norm(p.player_name);
        const candidates = stmtLatestRank.all(p.player_name, normalized);
        const row = candidates.find(c => norm(c.nm) === normalized);
        if (!row || !row.rk) {
          skipped++;
          continue;
        }

        const rank = row.rk;
        const nowSec = Math.floor(Date.now() / 1000);

        if (circuit === 'WTA') {
          updateStmt.run(null, rank, nowSec, p.player_id, p.circuit);
        } else {
          updateStmt.run(rank, null, nowSec, p.player_id, p.circuit);
        }
        updated++;
      }
    });

    if (!DRY_RUN) {
      tx();
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    log('INFO', `Done in ${elapsed}s — updated=${updated} skipped=${skipped}${DRY_RUN ? ' [DRY-RUN]' : ''}`);

    // Sample log
    if (updated > 0 || DRY_RUN) {
      const sample = db.prepare(`
        SELECT player_name, circuit, atp_rank, wta_rank
        FROM tennis_players_elo
        WHERE atp_rank IS NOT NULL OR wta_rank IS NOT NULL
        ORDER BY COALESCE(atp_rank, wta_rank, 9999) ASC
        LIMIT 10
      `).all();
      log('INFO', 'Top 10 ranked players after update:');
      for (const s of sample) {
        log('INFO', `  ${s.player_name.padEnd(25)} circuit=${s.circuit} atp_rank=${s.atp_rank} wta_rank=${s.wta_rank}`);
      }
    }

  } catch (err) {
    log('ERROR', `Fatal error: ${err.message}`);
    log('ERROR', err.stack || '');
    process.exit(2);
  } finally {
    db.close();
  }

  log('INFO', `=== update-tennis-ranks end ===`);
}

main();
