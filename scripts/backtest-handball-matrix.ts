#!/usr/bin/env node
/**
 * backtest-handball-matrix.ts
 * ---------------------------
 * Matrice de backtest 8 marchés × N championnats →
 * data/handball_backtest_matrix.json (source : table handball_match_history).
 *
 * Protocole : moteur handball-backtest.ts (walk-forward anti-lookahead,
 * cotes 1xbet SIMULÉES — l'historique ne contient pas de cotes réelles).
 * 2 fenêtres produites d'un coup : full (tout l'historique) + d30 (30 j).
 *
 * Usage :
 *   bun scripts/backtest-handball-matrix.ts                # écrit le JSON
 *   bun scripts/backtest-handball-matrix.ts --dry-run      # stats seulement
 *   bun scripts/backtest-handball-matrix.ts --top=24 --min=15
 *
 * Cron PM2 : `pariscore-cron-handball-matrix` (lundi 04:40 UTC, après
 * l'history 04:20 → la matrice consomme toujours la table à jour).
 * Consommateur : GET /api/handball/backtest-matrix (+ onglet popup
 * « Statistiques & Backtest »).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeBacktestMatrix } from "../src/lib/handball-backtest-matrix";
import { loadAllHistory } from "../src/lib/handball-history-db";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const OUT = path.join(DATA_DIR, "handball_backtest_matrix.json");

const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);
const TOP = Math.max(1, parseInt(argv.get("top") ?? "16", 10) || 16);
const MIN = Math.max(1, parseInt(argv.get("min") ?? "20", 10) || 20);
const DRY = argv.has("dry-run");

async function main() {
  const t0 = Date.now();
  // Lecture via la couche partagée (bun:sqlite → better-sqlite3, env
  // DATABASE_PATH || cwd/pariscore.db) — plus de double mappage des colonnes.
  const history = loadAllHistory();
  console.log(`[matrix] historique : ${history.length} matchs`);
  if (history.length === 0) {
    console.log("[matrix] table vide — rien à calculer (lance scrape-handball-history.mjs)");
    return;
  }

  const full = computeBacktestMatrix(history, { window: "full", topLeagues: TOP, minLeagueMatches: MIN });
  const d30 = computeBacktestMatrix(history, { window: "d30", topLeagues: TOP, minLeagueMatches: MIN });

  console.log(
    `[matrix] full : ${full.nMatches} matchs, ${full.leagues.length}/${full.nLeagues} ligues retenues, ` +
      `paris=${full.globalCell.nBets}, hit=${full.globalCell.hitRate != null ? (full.globalCell.hitRate * 100).toFixed(1) + "%" : "—"}, ` +
      `ROI=${full.globalCell.roiPct != null ? full.globalCell.roiPct.toFixed(1) + "%" : "—"}`
  );
  console.log(
    `[matrix] d30  : ${d30.nMatches} matchs, ${d30.leagues.length} ligues, paris=${d30.globalCell.nBets}`
  );
  for (const l of full.leagues.slice(0, 8)) {
    console.log(
      `   ${l.league.padEnd(38)} n=${String(l.nMatches).padStart(4)} paris=${String(l.global.nBets).padStart(4)} ` +
        `hit=${l.global.hitRate != null ? (l.global.hitRate * 100).toFixed(0) + "%" : "—"} ` +
        `ROI=${l.global.roiPct != null ? l.global.roiPct.toFixed(1) + "%" : "—"}${l.global.sampleOk ? "" : " (n<10)"}`
    );
  }

  if (DRY) {
    console.log("[matrix] dry-run — fichier non écrit");
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Écriture atomique (tmp + rename) : un lecteur (route) ne voit jamais de
  // JSON tronqué → pas de 503 transitoire pendant la génération (~5-8 min).
  const tmp = `${OUT}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ generatedAt: new Date().toISOString(), full, d30 }), "utf8");
  fs.renameSync(tmp, OUT);
  console.log(
    `[matrix] ✅ écrit ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} Ko) en ${Date.now() - t0} ms`
  );
}

main().catch((err) => {
  console.error("[matrix] ERREUR", err);
  process.exitCode = 1;
});
