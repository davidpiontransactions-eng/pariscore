#!/usr/bin/env bun
// cron_collect_odds.ts — Vérifie et force la collecte d'odds dans odds_snapshots.
//
// Usage:
//   bun scripts/cron_collect_odds.ts              # stats seulement
//   bun scripts/cron_collect_odds.ts --force       # force enrichment des matchs à venir
//   bun scripts/cron_collect_odds.ts --dry-run     # dry run (pas d'INSERT)
//
// Cron PM2 recommandé: `30 */6 * * *` (toutes les 6h)

import { Database } from "bun:sqlite";

const SQLITE_FILE = process.env.DATABASE_PATH || "pariscore.db";
const args = process.argv.slice(2);
const isForce = args.includes("--force");
const isDryRun = args.includes("--dry-run");

function main() {
  const db = new Database(SQLITE_FILE, { readonly: true });

  // Stats actuelles
  const totalRow = db.prepare("SELECT COUNT(*) as cnt FROM odds_snapshots").get() as { cnt: number };
  const bsdRow = db.prepare("SELECT COUNT(*) as cnt FROM odds_snapshots WHERE source = 'bsd-compare'").get() as { cnt: number };
  const recentRow = db.prepare("SELECT COUNT(*) as cnt FROM odds_snapshots WHERE scrapedAt > datetime('now', '-24 hours')").get() as { cnt: number };
  const matchCountRow = db.prepare("SELECT COUNT(DISTINCT matchId) as cnt FROM odds_snapshots WHERE source = 'bsd-compare'").get() as { cnt: number };

  console.log("=== Odds Archive Stats ===");
  console.log(`Total snapshots:      ${totalRow.cnt}`);
  console.log(`BSD-compare:          ${bsdRow.cnt}`);
  console.log(`Last 24h:             ${recentRow.cnt}`);
  console.log(`Unique matches:       ${matchCountRow.cnt}`);

  // Dernier snapshot
  const lastRow = db.prepare(
    "SELECT matchId, scrapedAt FROM odds_snapshots ORDER BY scrapedAt DESC LIMIT 1"
  ).get() as { matchId: string; scrapedAt: string } | undefined;

  if (lastRow) {
    console.log(`Last snapshot:        ${lastRow.matchId} @ ${lastRow.scrapedAt}`);
  } else {
    console.log("Last snapshot:        (none)");
  }

  // Top marchés
  const markets = db.prepare(
    "SELECT market, COUNT(*) as cnt FROM odds_snapshots GROUP BY market ORDER BY cnt DESC"
  ).all() as { market: string; cnt: number }[];

  console.log("\n=== Markets ===");
  for (const m of markets) {
    console.log(`${m.market.padEnd(10)} ${m.cnt}`);
  }

  db.close();

  if (isDryRun) {
    console.log("\n[dry-run] Pas d'insertion.");
  }

  if (isForce) {
    console.log("\n[force] L'enrichissement BSD est géré par server.js (cronEnrichBSDFullStack).");
    console.log("[force] Les odds sont persistés automatiquement via persistOddsToDB().");
    console.log("[force] Pour forcer: redémarrer server.js et laisser le cron BSD tourner.");
  }

  console.log("\nDone.");
}

main();
