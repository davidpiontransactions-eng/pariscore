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
import { parisDateOf } from "../handball-backtest-today";

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

  test("league.id = hash du nom (fix G6-4 : 2 ligues ≠ 2 ids sports-tree)", () => {
    const a = toHandballMatch({ home: "THW Kiel", away: "Füchse Berlin", league: "Bundesliga", country: "Allemagne" }, 0);
    const b = toHandballMatch({ home: "PSG", away: "Nantes", league: "Starligue", country: "France" }, 1);
    // Régression : league.id ≡ 0 effondrait toutes les ligues d'un pays en
    // un unique nœud `handball:0`.
    expect(a.league.id).not.toBe(0);
    expect(b.league.id).not.toBe(0);
    expect(a.league.id).not.toBe(b.league.id);
    // Même ligue → même id (join/dédup sports-tree)
    const a2 = toHandballMatch({ home: "HSG Wetzlar", away: "THW Kiel", league: "Bundesliga" }, 2);
    expect(a.league.id).toBe(a2.league.id);
  });
});

// ─── kickoff : pas de reinterpretation de fuseau ───
//
// Le scripteur émet un VRAI instant UTC (`new Date(epoch*1000).toISOString()`).
// Toute reconversion ici (Date.parse puis reformatage, soustraction d'un offset
// CEST) décalerait l'heure affichée de 2 h en Europe/Paris. Contrat : le
// kickoff est repris TEL QUEL, les formateurs `timeZone: "Europe/Paris"` de
// l'UI font la conversion.

describe("toHandballMatch — kickoff repris verbatim", () => {
  const time = "2026-09-30T17:00:00.000Z"; // 19:00 Paris (CEST)

  test("chaîne ISO du snapshot conservée à l'identique", () => {
    const m = toHandballMatch({ home: "SC Magdeburg", away: "Kiel", league: "Bundesliga", time }, 0);
    expect(m.kickoff).toBe(time);
    expect(Date.parse(m.kickoff)).toBe(Date.parse(time));
  });

  test("l'instant reste 19:00 Europe/Paris (aucun décalage −2h)", () => {
    const m = toHandballMatch({ home: "SC Magdeburg", away: "Kiel", league: "Bundesliga", time }, 0);
    const shown = new Date(m.kickoff).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
    expect(shown).toBe("19:00");
  });

  test("un instant UTC tardif bascule bien sur le jour civil Paris suivant", () => {
    // 22:00Z = 00:00 Paris le lendemain : c'est le comportement VOLONTAIRE du
    // jour civil Paris (et la raison du fix de dédup : ce saut de journée est
    // ce qui exposait le doublon horodaté à l'instant du scrape).
    expect(parisDateOf("2026-09-30T22:00:00.000Z")).toBe("2026-10-01");
    expect(parisDateOf(time)).toBe("2026-09-30");
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
