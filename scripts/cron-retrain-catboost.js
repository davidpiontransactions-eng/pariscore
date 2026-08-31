#!/usr/bin/env node
/**
 * cron-retrain-catboost.js — Pipeline hebdomadaire complet de re-training CatBoost.
 *
 * Version Node.js pour pm2 : meilleure gestion d'erreurs, exit codes,
 * et sortie structurée.
 *
 * Étapes :
 *   1. Refresh ETL       → node scripts/etl-history-matches.js --source=db
 *   2. Training CatBoost → python ml/train_catboost.py --db pariscore.db
 *   3. Register model    → INSERT INTO ModelVersion (via better-sqlite3)
 *   4. Métriques modèle  → node scripts/compute-model-metrics.js --period=30d --output=db
 *
 * Usage :
 *   node scripts/cron-retrain-catboost.js              # exécution réelle
 *   node scripts/cron-retrain-catboost.js --dry-run    # simulation
 *   node scripts/cron-retrain-catboost.js --period=7d  # période métriques personnalisée
 *
 * Cron VPS suggéré (dimanche 05:00 UTC) :
 *   0 5 * * 0 cd /home/ubuntu/pariscore && node scripts/cron-retrain-catboost.js
 *
 * Exit code : 0 = succès, 1 = échec
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    period:    { type: 'string',  default: '30d' },
    db:        { type: 'string',  default: '' },
    help:      { type: 'boolean', default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`
Usage: node scripts/cron-retrain-catboost.js [OPTIONS]

Flags:
  --dry-run          Simulation — affiche les commandes sans les exécuter
  --period=Nd        Période pour les métriques (défaut: 30d)
  --db=PATH          Chemin DB (défaut: ./pariscore.db)
  --help             Afficher l'aide
`);
  process.exit(0);
}

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..');
const DRY_RUN = args['dry-run'];
const METRICS_PERIOD = args.period;
const DB_PATH = args.db ? resolve(args.db) : join(ROOT, 'pariscore.db');
const LOG_DIR = join(ROOT, 'data', 'logs');
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const LOG_FILE = join(LOG_DIR, `retrain-${DATE}.log`);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formate un timestamp local pour les logs.
 */
function timestamp() {
  return new Date().toLocaleString('fr-FR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/**
 * Écrit une ligne dans le log fichier + console.
 */
function log(message) {
  const line = `[${timestamp()}] ${message}`;
  console.log(line);
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // Ignorer erreurs d'écriture log
  }
}

/**
 * Encapsule une étape du pipeline : exécute une commande et capture stdout/stderr.
 * @returns {{ success: boolean, stdout: string, stderr: string, exitCode: number }}
 */
function runStep(label, command, cwd = ROOT) {
  return new Promise((resolve) => {
    log(`── Étape : ${label}`);

    if (DRY_RUN) {
      log(`  [DRY-RUN] Simulation — commande : ${command}`);
      resolve({ success: true, stdout: '(dry-run)', stderr: '', exitCode: 0 });
      return;
    }

    const parts = command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Rediriger stdout vers le log en temps réel
      text.split('\n').filter(Boolean).forEach((line) => {
        log(`  [${label}] ${line}`);
      });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      text.split('\n').filter(Boolean).forEach((line) => {
        log(`  [${label}] ⚠ ${line}`);
      });
    });

    child.on('close', (code) => {
      const success = code === 0;
      if (success) {
        log(`  ✓ ${label} terminé`);
      } else {
        log(`  ✗ ${label} échoué (code: ${code})`);
      }
      resolve({ success, stdout, stderr, exitCode: code ?? 1 });
    });

    child.on('error', (err) => {
      log(`  ✗ ${label} erreur : ${err.message}`);
      resolve({ success: false, stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

/**
 * Extrait les métriques clés depuis la sortie JSON de train_catboost.py.
 */
function parseTrainingResult(stdout) {
  try {
    // La dernière ligne JSON non-vide est le résultat
    const lines = stdout.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const parsed = JSON.parse(lines[i]);
      if (parsed.n_total !== undefined) return parsed;
    }
  } catch {
    // Sortie non-JSON (catboost log dans stderr)
  }
  return null;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  log('╔══════════════════════════════════════════════════╗');
  log('║  Retrain CatBoost — Pipeline hebdomadaire        ║');
  log(`║  Dry-run: ${DRY_RUN ? 'oui' : 'non'}                                    ║`);
  log(`║  Période métriques: ${METRICS_PERIOD.padEnd(4)}                        ║`);
  log('╚══════════════════════════════════════════════════╝');

  // ── Étape 1 : ETL ────────────────────────────────────────────────────────
  const etl = await runStep(
    'ETL history_matches',
    `node scripts/etl-history-matches.js --source=db --db="${DB_PATH}"`,
  );
  if (!etl.success) {
    log('Pipeline échoué à l\'étape ETL');
    process.exit(1);
  }

  // ── Étape 2 : Training ───────────────────────────────────────────────────
  const PYTHON_BIN = process.env.CATBOOST_PYTHON_BIN || 'python3';
  const train = await runStep(
    'Training CatBoost',
    `${PYTHON_BIN} ml/train_catboost.py --db "${DB_PATH}"`,
  );
  if (!train.success) {
    log('Pipeline échoué à l\'étape Training');
    process.exit(1);
  }

  // Extraire métriques du training
  const trainingResult = parseTrainingResult(train.stdout);

  // ── Étape 3 : Register model in DB ───────────────────────────────────────
  if (trainingResult) {
    try {
      const { createRequire } = await import('node:module');
      const req = createRequire(import.meta.url);
      const Database = req('better-sqlite3');
      const prismaDbPath = process.env.DATABASE_PATH || join(ROOT, 'dev.db');
      const db = new Database(prismaDbPath);
      const modelId = `catboost_football_${trainingResult.sport}_v${Date.now()}`;
      const maxVersion = db.prepare('SELECT COALESCE(MAX(version), 0) as mv FROM "ModelVersion" WHERE modelType = ?').get('catboost');
      const newVersion = (maxVersion?.mv ?? 0) + 1;
      const metricsJson = JSON.stringify({
        rps_1x2: trainingResult.models?.['1x2']?.rps,
        accuracy_btts: trainingResult.models?.btts?.accuracy,
        accuracy_over25: trainingResult.models?.over25?.accuracy,
        n_total: trainingResult.n_total,
        n_train: trainingResult.n_train,
      });
      db.prepare(`
        INSERT INTO "ModelVersion" (id, name, modelType, version, status, trainedAt, promotedAt, configJson, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'production', datetime('now'), datetime('now'), ?, datetime('now'), datetime('now'))
      `).run(modelId, `CatBoost ${trainingResult.sport} v${newVersion}`, 'catboost', newVersion, metricsJson);
      // Demote previous production versions
      db.prepare('UPDATE "ModelVersion" SET status = ? WHERE modelType = ? AND id != ? AND status = ?')
        .run('archived', 'catboost', modelId, 'production');
      db.close();
      log(`  ✓ Modèle enregistré : ${modelId} (v${newVersion})`);
    } catch (err) {
      log(`  ⚠ Enregistrement modèle échoué : ${err.message}`);
    }
  }

  // ── Étape 4 : Métriques ──────────────────────────────────────────────────
  const metrics = await runStep(
    'Métriques modèle',
    `node scripts/compute-model-metrics.js --period=${METRICS_PERIOD} --output=db --db="${DB_PATH}"`,
  );
  if (!metrics.success) {
    log('Pipeline échoué à l\'étape Métriques');
    process.exit(1);
  }

  // ── Résumé ────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  log('');
  log('╔══════════════════════════════════════════════════╗');
  log('║  Pipeline re-training terminé avec succès        ║');
  log('╚══════════════════════════════════════════════════╝');

  if (trainingResult) {
    log(`  Records total       : ${trainingResult.n_total}`);
    log(`  Avec Poisson        : ${trainingResult.n_with_poisson ?? 'N/A'}`);
    log(`  Catégoriques seulem.: ${trainingResult.n_categorical_only ?? 'N/A'}`);
    log(`  Train / Validation  : ${trainingResult.n_train} / ${trainingResult.n_val}`);

    if (trainingResult.models?.['1x2']) {
      const rps = trainingResult.models['1x2'].rps;
      const improvement = trainingResult.models['1x2'].rps_improvement_pct;
      log(`  1X2 RPS             : ${rps} (${improvement > 0 ? '+' : ''}${improvement}% vs Poisson)`);
    }
    if (trainingResult.models?.over25) {
      log(`  Over 2.5 accuracy   : ${(trainingResult.models.over25.accuracy * 100).toFixed(1)}%`);
    }
    if (trainingResult.models?.btts) {
      log(`  BTTS accuracy       : ${(trainingResult.models.btts.accuracy * 100).toFixed(1)}%`);
    }
  }

  log(`  Durée totale        : ${elapsed}s`);
  log(`  Log                 : ${LOG_FILE}`);
  log(`  Date                : ${DATE}`);

  process.exit(0);
}

main();
