// Probe schema des tables avec données
const D = require("better-sqlite3");
const db = new D("pariscore.db", { readonly: true });
const tables = ["team_logos", "league_logos", "users", "kv", "api_cache", "closing_odds"];
for (const name of tables) {
  const info = db.prepare("PRAGMA table_info([" + name + "])").all();
  console.log("\n=== " + name + " ===");
  for (const col of info) console.log("  " + col.name + " " + col.type + (col.pk ? " PK" : ""));
  // Show first 3 rows
  const rows = db.prepare("SELECT * FROM [" + name + "] LIMIT 3").all();
  console.log("  Sample:", JSON.stringify(rows).slice(0, 300));
}
db.close();
