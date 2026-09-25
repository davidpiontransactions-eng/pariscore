// Tests des chips « Top stratégies ≥60 % » du calendrier handball —
// computeHandballMatchChips (réutilise scoreMatch, filtre BET_FLOOR = 60 %).
import { describe, test, expect } from "bun:test";
import {
  computeHandballMatchChips,
  computeHandballStrategyTop8,
  computeHandballStrategyPayload,
} from "../handball-strategy-top8";
import { BET_FLOOR } from "../handball-history-stats";
import type { HandballMatch } from "../handball-data";

function mockMatch(overrides: Partial<HandballMatch> = {}): HandballMatch {
  return {
    id: 4242, // id fixe (pas de Math.random → tests déterministes)
    league: { id: 1, name: "Starligue", country: "France", countryCode: "FR" },
    home: { id: 100, name: "Paris Saint-Germain", shortName: "PSG" },
    away: { id: 200, name: "HBC Nantes", shortName: "Nantes" },
    kickoff: new Date(Date.now() + 3600_000).toISOString(),
    status: "not_started",
    odds: { home: 1.45, draw: 9.0, away: 3.2 },
    ...overrides,
  };
}

function mockFinished(hg: number, ag: number): HandballMatch {
  return mockMatch({ status: "finished", score: { home: hg, away: ag, homeHalf: Math.floor(hg / 2), awayHalf: Math.floor(ag / 2) } });
}

/** 5 matchs terminés → forme complète (≥ CMP_MIN_HISTORY) pour les 2 équipes. */
const finished = [
  mockFinished(30, 25),
  mockFinished(28, 28),
  mockFinished(32, 22),
  mockFinished(31, 24),
  mockFinished(27, 26),
];

describe("computeHandballMatchChips", () => {
  test("seuil par défaut BET_FLOOR (60 %), tri décroissant, ≤ 4 chips, jointure String(id)", () => {
    const fixture = mockMatch({ id: 4242 });
    const chips = computeHandballMatchChips(finished, [fixture]);
    const list = chips["4242"] ?? [];

    // Les formules produisent au moins une ligne jouable pour ce match testé
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(4);
    for (let i = 0; i < list.length; i++) {
      expect(list[i].probPct).toBeGreaterThanOrEqual(BET_FLOOR * 100);
      if (i > 0) expect(list[i - 1].probPct).toBeGreaterThanOrEqual(list[i].probPct);
      expect(["bestTeam", "htLeader"]).not.toContain(list[i].key);
      expect(list[i].label.length).toBeGreaterThan(0);
      expect(list[i].emoji.length).toBeGreaterThan(0);
    }
    // Aucune entrée pour un match hors fixture
    expect(Object.keys(chips)).toEqual(["4242"]);
  });

  test("sans forme : le garde-fou exclut under62 (repli λ → ~96 % systématique)", () => {
    const fixture = mockMatch({ id: 7 });
    const chips = computeHandballMatchChips([], [fixture]);
    const list = chips["7"] ?? [];
    expect(list.some((c) => c.key === "under62")).toBe(false);
    // handicap sans forme → diff 0 → proba 0 % → jamais chipé
    expect(list.some((c) => c.key === "handicap")).toBe(false);
  });

  test("avec forme complète, under62 redevient candidate (normalisé par le seuil)", () => {
    const fixture = mockMatch({ id: 8 });
    const chips = computeHandballMatchChips(finished, [fixture]);
    const list = chips["8"] ?? [];
    // Si under62 apparaît, c'est qu'elle dépasse 60 % sur le mérite (pas le repli)
    const u = list.find((c) => c.key === "under62");
    if (u) expect(u.probPct).toBeGreaterThanOrEqual(60);
    expect(list.every((c) => c.probPct >= 60)).toBe(true);
  });

  test("valueBet honnête : chip uniquement si ev > 0", () => {
    const fixture = mockMatch({ id: 9 });
    const chips = computeHandballMatchChips(finished, [fixture]);
    for (const c of chips["9"] ?? []) {
      if (c.key === "valueBet") expect(c.ev).not.toBeNull();
      if (c.key === "valueBet") expect(c.ev!).toBeGreaterThan(0);
    }
  });

  test("threshold sur-mesure : 100 % → zéro chip ; 40 % → ≥ défaut", () => {
    const fixture = mockMatch({ id: 10 });
    const strict = computeHandballMatchChips(finished, [fixture], { threshold: 100 });
    expect(strict["10"]).toBeUndefined();
    const loose = computeHandballMatchChips(finished, [fixture], { threshold: 40 });
    const def = computeHandballMatchChips(finished, [fixture]);
    expect(Object.keys(loose).length).toBeGreaterThanOrEqual(Object.keys(def).length);
    expect((loose["10"] ?? []).length).toBeGreaterThanOrEqual((def["10"] ?? []).length);
  });

  test("maxPerMatch respecté (limite stricte à 2)", () => {
    const fixture = mockMatch({ id: 11 });
    const chips = computeHandballMatchChips(finished, [fixture], { threshold: 40, maxPerMatch: 2 });
    expect((chips["11"] ?? []).length).toBeLessThanOrEqual(2);
  });

  test("cohérence : mêmes proba que le moteur Top8 (scoreMatch partagé)", () => {
    const fixture = mockMatch({ id: 12 });
    const chips = computeHandballMatchChips(finished, [fixture])["12"] ?? [];
    const top8 = computeHandballStrategyTop8(finished, [fixture], { limit: 8 });
    for (const chip of chips) {
      const entry = top8.strategies[chip.key as keyof typeof top8.strategies]?.find(
        (e) => e.matchId === "12"
      );
      expect(entry).toBeDefined();
      expect(entry!.probPct).toBeGreaterThanOrEqual(60);
      expect(Math.round(entry!.probPct!)).toBeGreaterThanOrEqual(Math.round(chip.probPct) - 1);
    }
  });

  test("contrat de payload : le cache stocke EXACTEMENT ce que la réponse renvoie (chips présent)", () => {
    // Régression review 2026-09-25 : le cold-path servait `result` sans chips.
    const payload = computeHandballStrategyPayload(finished, [mockMatch({ id: 99 })]);
    expect(payload.chips).toBeDefined();
    expect(payload.strategies).toBeDefined();
    expect(Object.keys(payload.strategies)).toHaveLength(8); // 8 stratégies
    expect(typeof payload.computedAt).toBe("string");
    expect(payload.window).toBe("all");
    // Chips typés et bornés
    for (const list of Object.values(payload.chips)) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(4);
      for (const c of list) expect(c.probPct).toBeGreaterThanOrEqual(60);
    }
  });

  test("calendrier vide → chips vide (pas d'entrée fantôme)", () => {
    expect(computeHandballMatchChips(finished, [])).toEqual({});
  });

  test("valueBet SANS cotes réelles → chip exclu (EV sur cote de repli 1.55)", () => {
    // Fixture sans odds ni openingOdds : le garde-fou hasRealOdds doit exclure
    // valueBet même si la proba dépasse 60 %.
    const fixture = mockMatch({ id: 13, odds: undefined, openingOdds: undefined });
    const chips = computeHandballMatchChips(finished, [fixture], { threshold: 40 });
    expect((chips["13"] ?? []).some((c) => c.key === "valueBet")).toBe(false);
    // Avec cotes réelles, valueBet redevient candidate (si EV > 0)
    const withOdds = computeHandballMatchChips(finished, [mockMatch({ id: 14 })], { threshold: 40 });
    expect(Object.keys(withOdds).length).toBeGreaterThan(0);
  });
});
