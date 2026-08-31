#!/usr/bin/env node
/**
 * settle-predictions.js — Settle automatique des prédictions en attente.
 *
 * Cherche les PredictionLog unsettled dont le matchId correspond à un
 * bsd_event_id dans match_stats_history, et met à jour avec les scores réels.
 *
 * Usage:
 *   node scripts/settle-predictions.js                    # dry-run
 *   node scripts/settle-predictions.js --apply            # exécution réelle
 *   node scripts/settle-predictions.js --apply --limit=50 # max 50 settlements
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {}

// Prisma DB (PredictionLog, ModelMetrics)
const PRISMA_DB_PATH = ENV.DATABASE_PATH || path.join(ROOT, 'dev.db');
// Legacy DB (match_stats_history)
const LEGACY_DB_PATH = path.join(ROOT, 'pariscore.db');

const isApply = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

function main() {
  const Database = require('better-sqlite3');

  // Ouvrir les deux DB
  const prismaDb = new Database(PRISMA_DB_PATH, { readonly: !isApply });
  const legacyDb = new Database(LEGACY_DB_PATH, { readonly: true });

  // Trouver les prédictions unsettled
  const unsettled = prismaDb.prepare(`
    SELECT id, matchId, homeProb, drawProb, awayProb
    FROM "PredictionLog"
    WHERE settled = 0
    ORDER BY createdAt DESC
    LIMIT ?
  `).all(LIMIT);

  if (unsettled.length === 0) {
    console.log('[settle] Aucune prédiction en attente.');
    prismaDb.close();
    legacyDb.close();
    return;
  }

  console.log(`[settle] ${unsettled.length} prédiction(s) en attente.`);

  // Chercher les résultats correspondants
  const matchesFound = [];
  const matchesNotFound = [];

  for (const pred of unsettled) {
    // Le matchId peut être "bsd-12345", "12345", ou un format custom
    const rawId = pred.matchId.replace(/^bsd-/, '');
    const result = legacyDb.prepare(`
      SELECT bsd_event_id, home_score, away_score, home_team, away_team, match_date
      FROM match_stats_history
      WHERE bsd_event_id = ? OR bsd_event_id = ?
    `).get(pred.matchId, rawId);

    if (result && result.home_score != null && result.away_score != null) {
      matchesFound.push({
        ...pred,
        homeScore: result.home_score,
        awayScore: result.away_score,
        homeTeam: result.home_team,
        awayTeam: result.away_team,
        matchDate: result.match_date,
      });
    } else {
      matchesNotFound.push(pred.matchId);
    }
  }

  console.log(`[settle] ${matchesFound.length} match(es) trouvé(s), ${matchesNotFound.length} non trouvé(s).`);

  if (!isApply) {
    console.log('\n[DRY-RUN] Aperçu des settlements:');
    for (const m of matchesFound) {
      console.log(`  ${m.matchId} | ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} (${m.matchDate})`);
      console.log(`    Prédit: H${m.homeProb}% D${m.drawProb}% A${m.awayProb}%`);
      const actualOutcome = m.homeScore > m.awayScore ? 'H' : m.homeScore < m.awayScore ? 'A' : 'D';
      console.log(`    Résultat: ${actualOutcome} → Brier=${(Math.pow((actualOutcome === 'H' ? m.homeProb / 100 : actualOutcome === 'D' ? m.drawProb / 100 : m.awayProb / 100) - 1, 2)).toFixed(4)}`);
    }
    prismaDb.close();
    legacyDb.close();
    return;
  }

  // Appliquer les settlements
  const updateStmt = prismaDb.prepare(`
    UPDATE "PredictionLog"
    SET settled = 1, actualHome = ?, actualAway = ?
    WHERE id = ?
  `);

  let settled = 0;
  const tx = prismaDb.transaction(() => {
    for (const m of matchesFound) {
      updateStmt.run(m.homeScore, m.awayScore, m.id);
      settled++;
    }
  });

  tx();

  console.log(`[settle] ✓ ${settled} prédiction(s) settlée(s).`);
  prismaDb.close();
  legacyDb.close();
}

main();
