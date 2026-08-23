const fs = require("fs");
const j = JSON.parse(fs.readFileSync("/tmp/ps2.json", "utf8"));
for (const k of ["aryna sabalenka", "sara bejlek"]) {
  const p = j[k];
  if (!p) { console.log(k, "ABSENT"); continue; }
  const l = p.l10Surface;
  console.log(k);
  if (!l) { console.log("  l10Surface: NULL"); continue; }
  console.log("  score:", l.score, "| perf:", l.performance, "| W:", l.wins, "L:", l.losses, "| matchs:", l.matches, "rated:", l.rated);
  console.log("  details:", l.details.length);
  for (const d of l.details.slice(0, 3)) {
    console.log("   ", d.date.slice(0, 10), d.result, "vs", d.opponentName, "|", d.tournament, d.round, "|", d.score || "-", "| pts:", d.points);
  }
}