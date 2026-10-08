// Régression : la casse des surfaces dans `player_surface_scores`.
//
// Mesuré en prod le 2026-10-08 : 'hard' 8 755 + 'Hard' 7 448 lignes,
// 'clay' 5 513 + 'Clay' 4 489, 'grass' 1 514 + 'Grass' 866 — la MOITIÉ des
// lignes SPS était invisible pour `WHERE surface = 'Hard'`. Alexandrova avait
// 16 lignes (sps max 62,25) et la route renvoyait `sps: None`.
//
// better-sqlite3 est incompatible Bun, donc on vérifie la SÉMANTIQUE SQL avec
// bun:sqlite en mémoire : la requête de `getPlayerStats`/`getSpsIndex` doit
// trouver les lignes quelle que soit la casse stockée.
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

/** La requête de getSpsIndex (db.ts) — copiée ici volontairement pour tester la
 *  sémantique SQLite, pas la source (qui est vérifiée bout-en-bout en prod). */
const SPS_INDEX_SQL = `
  SELECT player_id, sps
  FROM player_surface_scores
  WHERE surface = ? COLLATE NOCASE AND sps IS NOT NULL
  GROUP BY player_id
  HAVING MAX(computed_at)
  ORDER BY sps DESC`;

/** La requête spsStmt de getPlayerStats (db.ts). */
const SPS_PLAYER_SQL = `
  SELECT sps, confidence_full, matches_played
  FROM player_surface_scores
  WHERE surface = ? COLLATE NOCASE AND player_id = ?
  ORDER BY computed_at DESC
  LIMIT 1`;

function seed(db: Database) {
  db.exec(`CREATE TABLE player_surface_scores (
    player_id INTEGER, surface TEXT, match_id INTEGER,
    sps REAL, confidence_full REAL, matches_played INTEGER, computed_at TEXT,
    PRIMARY KEY (player_id, surface, match_id)
  )`);
  const ins = db.prepare(
    "INSERT INTO player_surface_scores VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  // Alexandrova : ses lignes réelles — surface 'Hard' ET 'hard' mélangées.
  ins.run(101, "hard", 1, 55.0, 1, 3, "2026-09-01T00:00:00Z");
  ins.run(101, "Hard", 2, 62.25, 1, 4, "2026-09-20T00:00:00Z");
  ins.run(101, "Clay", 3, 40.0, 1, 2, "2026-09-25T00:00:00Z");
  // Un joueur sans SPS (edge case cron).
  ins.run(102, "Hard", 4, null, null, 0, "2026-09-26T00:00:00Z");
}

describe("player_surface_scores — casse des surfaces", () => {
  test("l'index SPS trouve 'Hard' même si les lignes sont stockées 'hard'", () => {
    // DB séparée : uniquement des lignes en MINUSCULE — c'est le cas réel où
    // la requête sans COLLATE ne trouvait RIEN (avant fix).
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE player_surface_scores (
      player_id INTEGER, surface TEXT, match_id INTEGER,
      sps REAL, confidence_full REAL, matches_played INTEGER, computed_at TEXT,
      PRIMARY KEY (player_id, surface, match_id)
    )`);
    db.prepare("INSERT INTO player_surface_scores VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(101, "hard", 1, 55.0, 1, 3, "2026-09-01T00:00:00Z");
    const avant = db.prepare(SPS_INDEX_SQL.replace(" COLLATE NOCASE", "")).all("Hard");
    expect(avant).toHaveLength(0); // échec AVANT le fix
    const rows = db.prepare(SPS_INDEX_SQL).all("Hard") as Array<{ player_id: number; sps: number }>;
    expect(rows.map((r) => r.player_id)).toEqual([101]);
    db.close();
  });

  test("la casse inverse marche aussi ('hard' demandé, 'Hard' stocké)", () => {
    const db = new Database(":memory:");
    seed(db);
    const rows = db.prepare(SPS_INDEX_SQL).all("hard") as Array<{ player_id: number; sps: number }>;
    expect(rows.map((r) => r.player_id)).toContain(101);
    db.close();
  });

  test("spsStmt retourne la ligne la plus récente toutes casses confondues", () => {
    const db = new Database(":memory:");
    seed(db);
    const r = db.prepare(SPS_PLAYER_SQL).get("Hard", 101) as { sps: number; computed_at: string };
    expect(r.sps).toBe(62.25); // 'Hard' du 20/09, plus récent que 'hard' du 01/09
    db.close();
  });

  test("spsStmt peut renvoyer un sps NULL — le guard est côté appelant", () => {
    // `getPlayerStats` garde `row.sps != null` avant d'affecter : une ligne
    // NULL-sps (edge case cron) ne doit donc jamais produire un `sps: 0`.
    const db = new Database(":memory:");
    seed(db);
    const r = db.prepare(SPS_PLAYER_SQL).get("Hard", 102) as { sps: number | null } | null;
    expect(r).not.toBeNull();
    expect(r?.sps).toBeNull();
    db.close();
  });

  test("la surface 'Clay' demandée ne ramène pas les lignes 'Hard'", () => {
    const db = new Database(":memory:");
    seed(db);
    const rows = db.prepare(SPS_INDEX_SQL).all("Clay") as Array<{ player_id: number; sps: number }>;
    const alexandrova = rows.find((r) => r.player_id === 101);
    expect(alexandrova?.sps).toBe(40.0);
    db.close();
  });
});