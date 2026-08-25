/** Diag : matchs prematch par surface × présence des joueurs dans la DB interne. */
const D = require("better-sqlite3");
const db = new D("pariscore.db", { readonly: true });
const norm = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

(async () => {
  const j = await (await fetch("http://localhost:3000/api/tennis/prematch")).json();
  const ms = j.matches || [];
  console.log("slate:", ms.length);
  const bySurf = {};
  for (const m of ms) {
    const s = (m.stats?.surface ?? "?").toLowerCase();
    bySurf[s] = (bySurf[s] ?? 0) + 1;
  }
  console.log("surfaces slate:", JSON.stringify(bySurf));

  const clay = ms.filter((m) => /terre|clay/i.test(m.stats?.surface ?? ""));
  console.log("matchs terre:", clay.length);
  for (const m of clay.slice(0, 6)) {
    for (const p of [m.playerA.name, m.playerB.name]) {
      const r = db
        .prepare(
          `SELECT COUNT(*) n FROM tennis_matches_internal
           WHERE (LOWER(winner_name)=LOWER(?) OR LOWER(loser_name)=LOWER(?))`,
        )
        .get(p, p);
      const rc = db
        .prepare(
          `SELECT COUNT(*) n FROM tennis_matches_internal
           WHERE (LOWER(winner_name)=LOWER(?) OR LOWER(loser_name)=LOWER(?)) AND surface='Clay'`,
        )
        .get(p, p);
      console.log(`  ${p}: total=${r.n} clay=${rc.n}`);
    }
    console.log("  ---");
  }
})();
