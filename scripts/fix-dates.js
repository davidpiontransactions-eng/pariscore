const D = require("better-sqlite3");
const db = new D("prisma/dev.db");
const rows = db.prepare("SELECT id, scheduledAt FROM Match").all();
console.log("Dates in Match table:");
rows.forEach(r => console.log("  " + r.id + ": " + r.scheduledAt + " (type=" + typeof r.scheduledAt + ")"));
// Fix: clean dates to ISO format
db.prepare("UPDATE Match SET scheduledAt = ? WHERE id = ?").run("2026-07-11 23:00:00", rows[0]?.id);
rows.forEach(r => {
  const clean = String(r.scheduledAt || "").replace("Z", "").trim();
  if (clean && clean.length < 19) {
    const fixed = clean + ":00".repeat(Math.max(0, (19 - clean.length) / 3));
    db.prepare("UPDATE Match SET scheduledAt = ? WHERE id = ?").run(fixed, r.id);
    console.log("  Fixed " + r.id + " → " + fixed);
  }
});
console.log("Done. Rows: " + db.prepare("SELECT COUNT(*) as n FROM Match").get().n);
db.close();
