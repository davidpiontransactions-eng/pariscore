/** Sonde seuil minMatches par surface (QA top5). */
const D = require("better-sqlite3");
const db = new D("pariscore.db", { readonly: true });
for (const surf of ["Clay", "Hard"]) {
  for (const mm of [5, 4, 3, 2]) {
    const n = db
      .prepare(
        `SELECT COUNT(*) n FROM (
           SELECT winner_name p FROM tennis_matches_internal
            WHERE surface=? AND w_1st_in_pct IS NOT NULL GROUP BY 1 HAVING COUNT(*)>=?
           UNION ALL
           SELECT loser_name FROM tennis_matches_internal
            WHERE surface=? AND l_1st_in_pct IS NOT NULL GROUP BY 1 HAVING COUNT(*)>=?)`,
      )
      .get(surf, mm, surf, mm).n;
    console.log(`${surf} ≥${mm} matchs: ${n} joueurs`);
  }
}
