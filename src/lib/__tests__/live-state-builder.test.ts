// Source de vérité du score live : `toLiveState` ne doit publier que les sets
// RÉELLEMENT gagnés. C'est la cause racine du marché ① à 100 % pendant un
// set 3 à 67 % (incident 47b3e074).
import { describe, expect, test } from "bun:test";
import { toLiveState, type RawLiveMatch } from "@/lib/live-state-builder";

function match(over: Partial<RawLiveMatch>): RawLiveMatch {
  return {
    id: "bsd-tn-1",
    playerA: { name: "A", shortName: "A", country: "", elo: 2000 },
    playerB: { name: "B", shortName: "B", country: "", elo: 2000 },
    setsDetail: [],
    currentGame: { p1: 0, p2: 0 },
    currentPoint: { p1: 0, p2: 0 },
    currentSet: 0,
    server: "A",
    liveProbA: 50,
    liveProbB: 50,
    isLive: true,
    ...over,
  } as unknown as RawLiveMatch;
}

describe("toLiveState — comptage des sets gagnés", () => {
  test("1-1 avec set 3 en cours → 1 set chacun (le bug du 100 %)", () => {
    const s = toLiveState(
      match({
        setsDetail: [{ p1: 6, p2: 3 }, { p1: 4, p2: 6 }, { p1: 3, p2: 2 }],
        currentSet: 2,
        currentGame: { p1: 3, p2: 2 },
      }),
      "2026-01-01T00:00:00Z"
    );
    // `sets` porte les JEUX gagnés dans chaque set DÉCIDÉ, pour les deux
    // joueurs : le set 3 en cours (3-2) disparaît, les deux premiers restent.
    expect(s.scoreA.sets).toEqual([6, 4]);
    expect(s.scoreB.sets).toEqual([3, 6]);
    // L'invariant qui compte : 2 sets DÉCIDÉS, mais UN set gagné chacun.
    expect(s.scoreA.sets.length).toBe(2);
    const setsWon = (a: number[], b: number[]) =>
      a.filter((g, i) => g > b[i]).length;
    expect(setsWon(s.scoreA.sets, s.scoreB.sets)).toBe(1);
    expect(setsWon(s.scoreB.sets, s.scoreA.sets)).toBe(1);
  });

  test("le set EN COURS est exclu même placé en tête du tableau", () => {
    const s = toLiveState(
      match({
        setsDetail: [{ p1: 3, p2: 2 }, { p1: 6, p2: 4 }],
        currentSet: 1,
        currentGame: { p1: 3, p2: 2 },
      }),
      "2026-01-01T00:00:00Z"
    );
    expect(s.scoreA.sets).toEqual([6]);
    expect(s.scoreB.sets).toEqual([4]);
    expect(s.scoreA.sets.length).toBe(1);
  });

  test("tie-break 7-6 et 7-5 :(set TERMINÉ, pas ignoré)", () => {
    const s = toLiveState(
      match({
        setsDetail: [{ p1: 7, p2: 6 }, { p1: 7, p2: 5 }],
        currentSet: 2,
        currentGame: { p1: 0, p2: 0 },
      }),
      "2026-01-01T00:00:00Z"
    );
    expect(s.scoreA.sets).toEqual([7, 7]);
  });

  test("6-6 en cours de tie-break → PAS compté comme set gagné", () => {
    const s = toLiveState(
      match({
        setsDetail: [{ p1: 6, p2: 4 }, { p1: 6, p2: 6 }],
        currentSet: 1,
        currentGame: { p1: 6, p2: 6 },
      }),
      "2026-01-01T00:00:00Z"
    );
    expect(s.scoreA.sets).toEqual([6]);
    expect(s.scoreB.sets).toEqual([4]);
    expect(s.scoreA.sets.length).toBe(1);
  });

  test("match terminé 2-0 → 2 sets gagnés par A", () => {
    const s = toLiveState(
      match({
        setsDetail: [{ p1: 6, p2: 3 }, { p1: 6, p2: 4 }],
        currentSet: 2,
        currentGame: { p1: 6, p2: 4 },
      }),
      "2026-01-01T00:00:00Z"
    );
    expect(s.scoreA.sets).toEqual([6, 6]);
    expect(s.scoreB.sets).toEqual([3, 4]);
    expect(s.scoreA.sets.filter((g, i) => g > s.scoreB.sets[i]).length).toBe(2);
    expect(s.scoreB.sets.filter((g, i) => g > s.scoreA.sets[i]).length).toBe(0);
  });

  test("début de match : 0 set, et le tableau vide ne plante pas", () => {
    const s = toLiveState(match({ setsDetail: [] }), "2026-01-01T00:00:00Z");
    expect(s.scoreA.sets).toEqual([]);
    expect(s.scoreB.sets).toEqual([]);
  });

  test("games/points conservés à l'identique (régression du score en cours)", () => {
    const s = toLiveState(
      match({
        setsDetail: [{ p1: 6, p2: 3 }],
        currentSet: 1,
        currentGame: { p1: 4, p2: 1 },
        currentPoint: { p1: 30, p2: 15 },
      }),
      "2026-01-01T00:00:00Z"
    );
    expect(s.scoreA.games).toBe(4);
    expect(s.scoreB.games).toBe(1);
    expect(s.scoreA.points).toBe(30);
    expect(s.scoreB.points).toBe(15);
  });
});