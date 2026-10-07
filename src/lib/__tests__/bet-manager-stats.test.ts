import { describe, expect, test } from "bun:test";
import {
  clvEdge,
  computeBankrollStats,
  computeClvStats,
  groupStats,
  timingBucket,
} from "../bet-manager/stats";
import type { Bet } from "../bet-manager/types";

const bet = (over: Partial<Bet>): Bet => ({
  id: "b1",
  bankrollId: "bk",
  betType: "single",
  sport: "football",
  stake: 10,
  odds: 2,
  status: "pending",
  placedAt: "2026-10-01T12:00:00.000Z",
  legs: [],
  ...over,
});

describe("CLV — clvEdge a le bon sens (positif = on bat la clôture)", () => {
  test("notre cote 2.10 > clôture 2.00 → positif", () => {
    const e = clvEdge(bet({ odds: 2.1, closingOdd: 2.0 }));
    expect(e).not.toBeNull();
    expect(e!).toBeCloseTo(1 / 2.0 - 1 / 2.1, 6);
    expect(e!).toBeGreaterThan(0);
  });

  test("notre cote 2.00 < clôture 2.20 → négatif (on a pris pire que le marché final)", () => {
    const e = clvEdge(bet({ odds: 2.0, closingOdd: 2.2 }));
    expect(e!).toBeLessThan(0);
  });

  test("sans closingOdd exploitable → null", () => {
    expect(clvEdge(bet({}))).toBeNull();
    expect(clvEdge(bet({ closingOdd: 0 }))).toBeNull();
    expect(clvEdge(bet({ closingOdd: 1 }))).toBeNull();
    expect(clvEdge(bet({ odds: 1, closingOdd: 2 }))).toBeNull();
  });
});

describe("CLV — agrégats computeClvStats", () => {
  const bets = [
    bet({ id: "a", odds: 2.1, closingOdd: 2.0 }), // beat close
    bet({ id: "b", odds: 2.0, closingOdd: 2.2 }), // pire que la clôture
    bet({ id: "c" }), // pas de closing → non tracké
  ];

  test("tracked = 2, positiveRate = 50 %, avgRaw = moyenne(odds − closing)", () => {
    const s = computeClvStats(bets);
    expect(s.tracked).toBe(2);
    expect(s.positiveRate).toBeCloseTo(50, 6);
    expect(s.avgRaw).toBeCloseTo((0.1 + -0.2) / 2, 6);
    expect(s.avgEdge).toBeCloseTo(((1 / 2.0 - 1 / 2.1) + (1 / 2.2 - 1 / 2.0)) / 2, 6);
  });

  test("aucun tracked → tout à 0 (pas de NaN)", () => {
    const s = computeClvStats([bet({})]);
    expect(s).toEqual({ tracked: 0, avgEdge: 0, avgRaw: 0, positiveRate: 0 });
  });
});

describe("groupStats — volume % et streaks par groupe (ajouts P3)", () => {
  const bets = [
    // Groupe A : G G G P G → bestStreak 3, worst −1
    bet({ id: "a1", bookmaker: "A", status: "won", stake: 10, payout: 20, settledAt: "2026-10-01T10:00:00.000Z" }),
    bet({ id: "a2", bookmaker: "A", status: "won", stake: 10, payout: 20, settledAt: "2026-10-02T10:00:00.000Z" }),
    bet({ id: "a3", bookmaker: "A", status: "won", stake: 10, payout: 20, settledAt: "2026-10-03T10:00:00.000Z" }),
    bet({ id: "a4", bookmaker: "A", status: "lost", stake: 10, settledAt: "2026-10-04T10:00:00.000Z" }),
    bet({ id: "a5", bookmaker: "A", status: "won", stake: 10, payout: 20, settledAt: "2026-10-05T10:00:00.000Z" }),
    // Groupe B : P P G → bestStreak 1, worst 0, volume 50 %
    bet({ id: "b1", bookmaker: "B", status: "lost", stake: 20, settledAt: "2026-10-01T11:00:00.000Z" }),
    bet({ id: "b2", bookmaker: "B", status: "lost", stake: 20, settledAt: "2026-10-02T11:00:00.000Z" }),
    bet({ id: "b3", bookmaker: "B", status: "won", stake: 20, payout: 40, settledAt: "2026-10-03T11:00:00.000Z" }),
  ];
  const groups = groupStats(bets, (b) => b.bookmaker ?? "—");

  test("volumePct : A = 50/110, B = 60/110, somme = 100", () => {
    const a = groups.find((g) => g.key === "A")!;
    const b = groups.find((g) => g.key === "B")!;
    expect(a.volumePct).toBeCloseTo((50 / 110) * 100, 6);
    expect(b.volumePct).toBeCloseTo((60 / 110) * 100, 6);
    expect(a.volumePct + b.volumePct).toBeCloseTo(100, 6);
  });

  test("streaks chronologiques par groupe", () => {
    const a = groups.find((g) => g.key === "A")!;
    expect(a.bestStreak).toBe(3);
    expect(a.worstStreak).toBe(-1);
    const b = groups.find((g) => g.key === "B")!;
    expect(b.bestStreak).toBe(1);
    expect(b.worstStreak).toBe(-2);
  });
});

describe("stats — computeBankrollStats toujours vert avec les champs ajoutés", () => {
  test("smoke : stats de base inaltérées", () => {
    const s = computeBankrollStats(
      [bet({ status: "won", stake: 10, payout: 20, settledAt: "2026-10-01T10:00:00.000Z" })],
      100
    );
    expect(s.current).toBe(110);
    expect(s.winRate).toBe(100);
  });
});

describe("timingBucket — axe By Timing", () => {
  test("4 plages UTC + hors format", () => {
    expect(timingBucket("2026-10-02T03:15:00.000Z")).toBe("00-06 Nuit");
    expect(timingBucket("2026-10-02T09:00:00.000Z")).toBe("06-12 Matin");
    expect(timingBucket("2026-10-02T14:59:00.000Z")).toBe("12-18 Après-midi");
    expect(timingBucket("2026-10-02T18:00:00.000Z")).toBe("18-24 Soir");
    expect(timingBucket("2026-10-02")).toBe("—");
    expect(timingBucket("")).toBe("—");
  });
});
