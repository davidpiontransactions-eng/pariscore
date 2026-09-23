// Tests régression mapping Flashscore handball — boucle rouge debug 2026-09-23
// Bug : home.id = away.id = 0 pour toutes les rows → form-store en 1 bucket "0"
// → toutes stratégies form-based identiques (bestTeam toujours home, diff ≡ HOME_ADV)

import { describe, test, expect } from "bun:test";
import {
  toHandballMatch,
  isFlashscoreFresh,
  flashscoreAgeMs,
  FLASHSCORE_MAX_AGE_MS,
} from "../handball-flashscore";

describe("toHandballMatch — identité d'équipe stable", () => {
  test("ids non nuls et distincts home vs away", () => {
    const m = toHandballMatch(
      { home: "THW Kiel", away: "Füchse Berlin", league: "Bundesliga", country: "Allemagne" },
      0,
    );
    expect(m.home.id).not.toBe(0);
    expect(m.away.id).not.toBe(0);
    expect(m.home.id).not.toBe(m.away.id);
  });

  test("même nom d'équipe → même id entre 2 rows (form-store join)", () => {
    const m1 = toHandballMatch(
      { home: "THW Kiel", away: "Füchse Berlin", league: "Bundesliga" },
      0,
    );
    const m2 = toHandballMatch(
      { home: "HSG Wetzlar", away: "THW Kiel", league: "Bundesliga" },
      1,
    );
    expect(m1.home.id).toBe(m2.away.id);
  });

  test("noms différents → ids différents (2 équipes ≠ 2 buckets)", () => {
    const m1 = toHandballMatch({ home: "Barcelona", away: "Antequera", league: "Liga ASOBAL" }, 0);
    expect(m1.home.id).not.toBe(m1.away.id);
    // Couvre l'effondrement : 3 équipes → 3 ids uniques
    const ids = new Set([m1.home.id, m1.away.id,
      toHandballMatch({ home: "Granollers", away: "Barcelona", league: "Liga ASOBAL" }, 1).home.id]);
    expect(ids.size).toBe(3);
  });

  test("matchId stable (hash équipes, pas index de tableau)", () => {
    const a = toHandballMatch({ home: "PSG", away: "Nantes", league: "Starligue", time: "2026-09-24T18:00:00Z" }, 5);
    const b = toHandballMatch({ home: "PSG", away: "Nantes", league: "Starligue", time: "2026-09-24T18:00:00Z" }, 99);
    expect(a.id).toBe(b.id);
  });
});

describe("fraîcheur snapshot Flashscore (gate 20h)", () => {
  const NOW = Date.parse("2026-09-23T12:00:00Z");

  test("snapshot J-2 → stale", () => {
    expect(isFlashscoreFresh("2026-09-21T22:35:28Z", NOW)).toBe(false);
  });

  test("snapshot 2h → frais", () => {
    expect(isFlashscoreFresh("2026-09-23T10:00:00Z", NOW)).toBe(true);
  });

  test("scraped_at absent ou invalide → stale", () => {
    expect(isFlashscoreFresh(undefined, NOW)).toBe(false);
    expect(isFlashscoreFresh(null, NOW)).toBe(false);
    expect(isFlashscoreFresh("pas-une-date", NOW)).toBe(false);
  });

  test("âge borné 0, seuil = 20h", () => {
    expect(FLASHSCORE_MAX_AGE_MS).toBe(20 * 3_600_000);
    expect(flashscoreAgeMs("2026-09-23T13:00:00Z", NOW)).toBe(0);
    expect(flashscoreAgeMs("2026-09-23T06:00:00Z", NOW)).toBe(6 * 3_600_000);
    expect(flashscoreAgeMs("bad", NOW)).toBeNull();
  });
});
