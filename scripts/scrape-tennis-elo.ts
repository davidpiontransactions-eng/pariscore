#!/usr/bin/env node
/**
 * scrape-tennis-elo.ts
 *
 * Scrapes tennisabstract.com ATP & WTA Elo ratings → cached JSON.
 *
 * Usage:
 *   node scripts/scrape-tennis-elo.ts
 *   node scripts/scrape-tennis-elo.ts --dry-run
 *
 * Exit codes:
 *   0 — success (cache written, or dry-run)
 *   1 — fetch / parse failure
 */
import { writeFileSync } from "node:fs";
import { cacheFilePath, fetchAndParse } from "../src/lib/tennis-elo/scraper";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=== scrape-tennis-elo ===");
  const cache = await fetchAndParse();
  const atpCount = Object.values(cache.players).filter((p) => p.tour === "ATP").length;
  const wtaCount = Object.values(cache.players).filter((p) => p.tour === "WTA").length;
  console.log(`Parsed: ${atpCount} ATP + ${wtaCount} WTA = ${atpCount + wtaCount} players`);

  if (DRY_RUN) {
    console.log("[dry-run] NOT writing cache file");
    return;
  }

  const outPath = cacheFilePath();
  writeFileSync(outPath, JSON.stringify(cache, null, 2), "utf8");
  const sizeKB = (Buffer.byteLength(JSON.stringify(cache), "utf8") / 1024).toFixed(1);
  console.log(`✓ Wrote ${outPath} (${sizeKB} KB, lastUpdate: ${cache.lastUpdate})`);
}

main().catch((err) => {
  console.error("FATAL:", (err as Error).message);
  process.exit(1);
});
