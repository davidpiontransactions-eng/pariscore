#!/usr/bin/env node
// Calcule les métriques du modèle (Brier, logLoss, accuracy) par marché
// et les stocke en DB ou en JSON. Usage: node scripts/compute-model-metrics.js --period=7d

import { parseArgs } from "node:util";
import Database from "better-sqlite3";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const { values } = parseArgs({
  options: {
    period: { type: "string", default: "7d" },
    "dry-run": { type: "boolean", default: false },
    output: { type: "string", default: "db" },
    db: { type: "string", default: process.env.DATABASE_PATH || "pariscore.db" },
  },
});

const PERIOD_DAYS = parseInt(values.period) || 7;
const DRY_RUN = values["dry-run"];
const OUTPUT = values.output;
const DB_PATH = values.db;

// Metric functions
function brierScore(predicted, actual) {
  if (predicted.length === 0) return 0;
  const sum = predicted.reduce((acc, p, i) => acc + Math.pow(p - actual[i], 2), 0);
  return sum / predicted.length;
}

function logLoss(predicted, actual) {
  if (predicted.length === 0) return 0;
  const eps = 1e-15;
  const sum = predicted.reduce((acc, p, i) => {
    const clipped = Math.max(eps, Math.min(1 - eps, p));
    return acc - (actual[i] * Math.log(clipped) + (1 - actual[i]) * Math.log(1 - clipped));
  }, 0);
  return sum / predicted.length;
}

function accuracy(predicted, actual) {
  if (predicted.length === 0) return 0;
  const correct = predicted.reduce((acc, p, i) => acc + ((p >= 0.5 ? 1 : 0) === actual[i] ? 1 : 0), 0);
  return correct / predicted.length;
}

// Connect DB
const db = new Database(DB_PATH, { readonly: OUTPUT === "json" });
db.pragma("journal_mode = WAL");

// Date cutoff
const cutoff = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

// Read settled PredictionLog
const rows = db.prepare(`
  SELECT id, modelVersionId, homeProb, drawProb, awayProb, bttsProb, over25Prob,
         actualHome, actualAway, createdAt
  FROM "PredictionLog"
  WHERE settled = 1
`).all();

// Filter by date (handles both ISO strings and epoch ms from Prisma)
const cutoffMs = Date.now() - PERIOD_DAYS * 86400000;
const filtered = rows.filter((r) => {
  const ts = typeof r.createdAt === 'number'
    ? r.createdAt
    : new Date(r.createdAt).getTime();
  return ts >= cutoffMs;
});

if (filtered.length === 0) {
  console.log(`Aucune prédiction settlée sur les ${PERIOD_DAYS} derniers jours.`);
  db.close();
  process.exit(2);
}

// Compute per-market metrics
const metrics = {};
for (const row of filtered) {
  const versionId = row.modelVersionId || "default";
  if (!metrics[versionId]) metrics[versionId] = {};

  // 1X2
  const outcome = row.actualHome > row.actualAway ? 0 : row.actualHome === row.actualAway ? 1 : 2;
  const probs1x2 = [row.homeProb / 100, row.drawProb / 100, row.awayProb / 100];
  const predicted1x2 = probs1x2[outcome]; // prob of actual outcome
  
  // BTTS
  const bttsActual = (row.actualHome > 0 && row.actualAway > 0) ? 1 : 0;
  const bttsPredicted = row.bttsProb / 100;
  
  // Over 2.5
  const ouActual = (row.actualHome + row.actualAway > 2.5) ? 1 : 0;
  const ouPredicted = row.over25Prob / 100;

  for (const [market, pred, act] of [
    ["1x2", predicted1x2, 1], // Brier on the actual outcome's predicted prob
    ["btts", bttsPredicted, bttsActual],
    ["over25", ouPredicted, ouActual],
  ]) {
    if (!metrics[versionId][market]) metrics[versionId][market] = { preds: [], acts: [] };
    metrics[versionId][market].preds.push(pred);
    metrics[versionId][market].acts.push(act);
  }
}

// Format results
const results = [];
for (const [versionId, markets] of Object.entries(metrics)) {
  for (const [market, data] of Object.entries(markets)) {
    results.push({
      modelVersionId: versionId,
      market,
      brierScore: brierScore(data.preds, data.acts),
      logLoss: logLoss(data.preds, data.acts),
      accuracy: accuracy(data.preds, data.acts),
      sampleSize: data.preds.length,
    });
  }
}

// Output
if (DRY_RUN || OUTPUT === "json") {
  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `model-metrics-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`[DRY-RUN] Écriture dans ${outPath}`);
} else {
  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_metrics (
      id TEXT PRIMARY KEY,
      modelVersionId TEXT,
      market TEXT,
      brierScore REAL,
      logLoss REAL,
      accuracy REAL,
      sampleSize INTEGER,
      computedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (modelVersionId) REFERENCES "ModelVersion"(id)
    )
  `);
  
  const insert = db.prepare(`
    INSERT INTO model_metrics (id, modelVersionId, market, brierScore, logLoss, accuracy, sampleSize, computedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  
  for (const r of results) {
    insert.run(`metrics_${Date.now()}_${r.market}`, r.modelVersionId, r.market, r.brierScore, r.logLoss, r.accuracy, r.sampleSize);
  }
  console.log(`✓ ${results.length} métriques écrites en DB`);
}

// Print summary table
console.log("\n═══════════════════════════════════════════════");
console.log("  Model Metrics — Résumé");
console.log("═══════════════════════════════════════════════");
console.log(`  Période : ${PERIOD_DAYS} jours | Records : ${rows.length}`);
console.log("───────────────────────────────────────────────");
for (const r of results) {
  console.log(`  ${r.modelVersionId.padEnd(20)} | ${r.market.padEnd(6)} | Brier: ${r.brierScore.toFixed(4)} | LogLoss: ${r.logLoss.toFixed(4)} | Acc: ${(r.accuracy * 100).toFixed(1)}% | n=${r.sampleSize}`);
}
console.log("═══════════════════════════════════════════════\n");

db.close();
