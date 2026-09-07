#!/usr/bin/env node
/**
 * sync-snooker-db.ts — Synchronise le JSON CueTracker (+ matchs snooker.org)
 * vers la base Prisma (SnookerPlayer / SnookerMatch) via src/lib/services/snooker-db.ts.
 *
 * Prérequis : installer le scraper d'abord (ou fournir un fichier existant).
 *
 * Usage:
 *   bun run scripts/sync-snooker-db.ts [data/cuetracker_matches.json] [--dry-run]
 *
 * Exit codes : 0 succès, 1 échec (erreurs de synchro signalées sans interrompre le flux).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { syncFromJson, type CuetrackerFile } from "../src/lib/services/snooker-db";

const DRY_RUN = process.argv.includes("--dry-run");
// argv = [bun.exe, script, arg...] → on ignore les deux premiers.
const FILE_ARG = process.argv.slice(2).find((a) => !a.startsWith("-"));
const FILE = FILE_ARG || "data/cuetracker_matches.json";

async function main() {
  const path = resolve(process.cwd(), FILE);
  if (!existsSync(path)) {
    console.error(`Fichier absent : ${path}. Lancez d'abord le scraper (python scripts/scrape_cuetracker.py).`);
    process.exit(1);
  }

  const file = JSON.parse(readFileSync(path, "utf8")) as CuetrackerFile;
  console.log(`=== sync-snooker-db === dry-run=${DRY_RUN} source=${file.source} scraped_at=${file.scraped_at}`);
  console.log(`  joueurs: ${(file.players ?? []).length} | matchs: ${(file.matches ?? []).length}`);

  if (DRY_RUN) {
    console.log("  [dry-run] aucune écriture en base");
    return;
  }

  const fallbackDate = file.scraped_at ? new Date(file.scraped_at) : new Date();
  const result = await syncFromJson(file, fallbackDate);
  console.log(`  joueurs upsertés: ${result.players.upserted} | échecs: ${result.players.failed}`);
  console.log(`  matchs   upsertés: ${result.matches.upserted} | échecs: ${result.matches.failed}`);
  console.log(result.ok ? "=== sync-snooker-db OK ===" : `=== sync-snooker-db TERMINÉ (${result.errors} erreur(s)) ===`);
}

main()
  .catch((err) => {
    console.error("FATAL:", (err as Error).message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => {}));