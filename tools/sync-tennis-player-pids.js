#!/usr/bin/env node
/**
 * tools/sync-tennis-player-pids.js
 *
 * Problème : tennis_players_elo a parfois plusieurs PIDs pour un même joueur
 * (ex: Jannik Sinner a les PIDs 206173 et 516), mais player_surface_scores
 * n'a le SPS que pour un seul PID. Le composant PlayerStatline lit le premier
 * PID trouvé et ne trouve pas son SPS.
 *
 * Ce script copie les données SPS entre tous les PIDs d'un même joueur,
 * pour que chaque PID ait accès aux mêmes SPS.
 *
 * Usage :
 *   node tools/sync-tennis-player-pids.js
 *   node tools/sync-tennis-player-pids.js --dry-run
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.error(`${ts} ${msg}`);
}

function main() {
  const t0 = Date.now();
  log(`=== sync-tennis-player-pids start === dry=${DRY_RUN}`);

  const db = new Database(DB_PATH, { readonly: false });
  db.pragma('journal_mode = WAL');

  try {
    // 1. Trouver les joueurs avec plusieurs PIDs
    const dupPlayers = db.prepare(`
      SELECT LOWER(player_name) AS name, GROUP_CONCAT(DISTINCT player_id) AS pids,
             COUNT(DISTINCT player_id) AS cnt
      FROM tennis_players_elo
      WHERE player_name IS NOT NULL AND player_name != ''
      GROUP BY LOWER(player_name)
      HAVING cnt > 1
    `).all();

    log(`Found ${dupPlayers.length} players with multiple PIDs`);

    // 2. Pour chaque joueur, copier le SPS du PID qui a des données
    //    vers les PIDs qui n'en ont pas
    let synced = 0;
    let skipped = 0;

    const srcPss = db.prepare(`
      SELECT surface, sps, confidence_full, matches_played, computed_at
      FROM player_surface_scores
      WHERE player_id = ?
    `);

    const dstInsert = db.prepare(`
      INSERT OR IGNORE INTO player_surface_scores
        (player_id, surface, match_id, circuit, sps, aptitude_score,
         confidence_full, matches_played, computed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (const p of dupPlayers) {
        const pids = p.pids.split(',');
        if (pids.length < 2) continue;

        // Trouver le PID source (celui qui a le plus de SPS en base)
        let bestPid = null;
        let bestCount = 0;
        for (const pid of pids) {
          const cnt = db.prepare(
            'SELECT COUNT(*) FROM player_surface_scores WHERE player_id = ?'
          ).get(pid)['COUNT(*)'];
          if (cnt > bestCount) {
            bestCount = cnt;
            bestPid = pid;
          }
        }

        if (!bestPid || bestCount === 0) {
          skipped++;
          continue;
        }

        // Lire les SPS du PID source
        const rows = srcPss.all(bestPid);

        // Copier vers les autres PIDs
        for (const targetPid of pids) {
          if (targetPid === bestPid) continue;

          // Vérifier combien de SPS le target a déjà
          const targetCount = db.prepare(
            'SELECT COUNT(*) FROM player_surface_scores WHERE player_id = ?'
          ).get(targetPid)['COUNT(*)'];

          if (targetCount >= bestCount) {
            // Déjà à jour
            continue;
          }

          // Supprimer les anciennes données du target
          db.prepare('DELETE FROM player_surface_scores WHERE player_id = ?').run(targetPid);

          // Copier les nouvelles
          for (const r of rows) {
            dstInsert.run(
              targetPid, r.surface, `sync-${targetPid}-${r.surface}`,
              'ATP', r.sps, r.sps || 0,
              r.confidence_full, r.matches_played, r.computed_at
            );
          }
          synced++;
          log(`  Copied ${rows.length} SPS rows: ${bestPid} → ${targetPid} (${p.name})`);
        }
      }
    });

    if (!DRY_RUN) {
      tx();
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    log(`Done in ${elapsed}s — synced=${synced} skipped=${skipped}${DRY_RUN ? ' [DRY-RUN]' : ''}`);

  } catch (err) {
    log(`ERROR: ${err.message}`);
    process.exit(2);
  } finally {
    db.close();
  }
}

main();
