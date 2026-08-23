import { parseJsfragMatches } from "../src/lib/tennis-elo/jsfrag";
import { readFileSync } from "node:fs";

for (const [file, name] of [["scripts/tmp-ArynaSabalenka.js", "Aryna Sabalenka"], ["scripts/tmp-SaraBejlek.js", "Sara Bejlek"]]) {
  const src = readFileSync(file, "utf8");
  const rows = parseJsfragMatches(src, name);
  console.log("===", name, "- parsed rows:", rows.length);
  const hard = rows.filter((r) => r.surface === "Hard" && r.result !== "LIVE");
  console.log("  hard non-live:", hard.length, "| first:", JSON.stringify(hard[0] || null));
  console.log("  LIVE rows:", rows.filter((r) => r.result === "LIVE").map((r) => r.date + " vs " + r.opponentName));
  console.log("  surfaces:", [...new Set(rows.map((r) => r.surface))].join(","));
  console.log("  weeks:", [...new Set(rows.map((r) => r.weekIso))].sort().join(","));
}