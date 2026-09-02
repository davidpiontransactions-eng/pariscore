import { describe, it, expect } from "bun:test";
import { computeMatchScore, rankTopMatches } from "../src/lib/match-score";
import type { MatchScoreInput } from "../src/lib/match-score";

/**
 * Tests du scoring engine "Meilleurs matchs du jour".
 *
 * Formule : tanh(somme(poids × signal)) × 10 → 0-10.
 * Signaux : closeness, tournament, elo, star, form, rivalry.
 */

// --- Fixtures ---

const TOP_CLASH: MatchScoreInput = {
  probA: 55,              // presque coinflip
  eloA: 2200, eloB: 2150, // elite
  rankA: 2, rankB: 5,     // top stars
  formA: ["W", "W", "W", "W", "L"], // 4/5
  formB: ["W", "W", "W", "W", "W"], // 5/5
  tournament: "Roland Garros",
  round: "Quart de finale",
  h2hHistory: [
    { winnerId: "a" }, { winnerId: "b" }, { winnerId: "a" },
    { winnerId: "b" }, { winnerId: "a" }, { winnerId: "b" },
  ],
  playerAId: "a",
};

const ITF_MISMATCH: MatchScoreInput = {
  probA: 85,              // favori clair
  eloA: 1600, eloB: 1450, // faibles
  rankA: 250, rankB: 400, // inconnus
  formA: ["W", "W", "W", "L", "L"],
  formB: ["L", "L", "L", "L", "W"],
  tournament: "ITF M25 Bloomfield Hills",
  round: "Round of 32",
};

const MASTERS_FINAL: MatchScoreInput = {
  probA: 50,              // coinflip parfait
  eloA: 2100, eloB: 2050,
  rankA: 8, rankB: 12,
  formA: ["W", "W", "W", "W", "W"],
  formB: ["W", "W", "W", "W", "L"],
  tournament: "ATP Masters 1000 Paris Bercy",
  round: "Finale",
};

// --- Tests ---

describe("match-score engine", () => {
  it("score borné [0, 10]", () => {
    const r1 = computeMatchScore(TOP_CLASH);
    const r2 = computeMatchScore(ITF_MISMATCH);
    const r3 = computeMatchScore(MASTERS_FINAL);
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(10);
    expect(r2.score).toBeGreaterThanOrEqual(0);
    expect(r2.score).toBeLessThanOrEqual(10);
    expect(r3.score).toBeGreaterThanOrEqual(0);
    expect(r3.score).toBeLessThanOrEqual(10);
  });

  it("Top clash (GS QF, elite, coinflip) > ITF mismatch", () => {
    const top = computeMatchScore(TOP_CLASH);
    const itf = computeMatchScore(ITF_MISMATCH);
    expect(top.score).toBeGreaterThan(itf.score);
  });

  it("Masters Final > ITF Round of 32", () => {
    const masters = computeMatchScore(MASTERS_FINAL);
    const itf = computeMatchScore(ITF_MISMATCH);
    expect(masters.score).toBeGreaterThan(itf.score);
  });

  it("label TOP MATCH pour score >= 8.5", () => {
    const r = computeMatchScore(TOP_CLASH);
    // GS QF + elite + coinflip → devrait etre TOP ou FEATURED
    expect(["TOP MATCH", "FEATURED"]).toContain(r.label);
  });

  it("label STANDARD pour ITF mismatch", () => {
    const r = computeMatchScore(ITF_MISMATCH);
    expect(["STANDARD", "INTERESTING"]).toContain(r.label);
  });

  it("breakdown contient tous les signaux", () => {
    const r = computeMatchScore(TOP_CLASH);
    expect(r.breakdown).toHaveProperty("closeness");
    expect(r.breakdown).toHaveProperty("tournamentImp");
    expect(r.breakdown).toHaveProperty("eloQuality");
    expect(r.breakdown).toHaveProperty("starPower");
    expect(r.breakdown).toHaveProperty("form");
    expect(r.breakdown).toHaveProperty("rivalry");
  });

  it("breakdown signaux bornés [0, 1]", () => {
    const r = computeMatchScore(TOP_CLASH);
    for (const [key, val] of Object.entries(r.breakdown)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it("labelColor et labelBg sont des strings CSS", () => {
    const r = computeMatchScore(TOP_CLASH);
    expect(typeof r.labelColor).toBe("string");
    expect(typeof r.labelBg).toBe("string");
    expect(r.labelColor.length).toBeGreaterThan(0);
    expect(r.labelBg.length).toBeGreaterThan(0);
  });

  it("raw positif", () => {
    const r = computeMatchScore(TOP_CLASH);
    expect(r.raw).toBeGreaterThan(0);
  });

  it("closeness maximale pour coinflip (50-50)", () => {
    const r = computeMatchScore({ ...TOP_CLASH, probA: 50 });
    expect(r.breakdown.closeness).toBeCloseTo(1.0, 1);
  });

  it("closeness minimale pour favori a 90%", () => {
    const r = computeMatchScore({ ...TOP_CLASH, probA: 90 });
    expect(r.breakdown.closeness).toBeLessThan(0.5);
  });

  it("tournament importance maximale pour Grand Slam Finale", () => {
    const r = computeMatchScore({
      ...TOP_CLASH,
      tournament: "Wimbledon",
      round: "Finale",
    });
    expect(r.breakdown.tournamentImp).toBeGreaterThanOrEqual(0.9);
  });

  it("tournament importance faible pour ITF", () => {
    const r = computeMatchScore(ITF_MISMATCH);
    expect(r.breakdown.tournamentImp).toBeLessThan(0.3);
  });

  it("star power maximale pour top 1 vs top 2", () => {
    const r = computeMatchScore({ ...TOP_CLASH, rankA: 1, rankB: 2 });
    expect(r.breakdown.starPower).toBeGreaterThanOrEqual(0.95);
  });

  it("star power faible pour rang 200+ vs 300+", () => {
    const r = computeMatchScore({ ...TOP_CLASH, rankA: 200, rankB: 300 });
    expect(r.breakdown.starPower).toBeLessThan(0.1);
  });

  it("form maximale si les 2 joueurs gagnent tout", () => {
    const r = computeMatchScore({
      ...TOP_CLASH,
      formA: ["W", "W", "W", "W", "W"],
      formB: ["W", "W", "W", "W", "W"],
    });
    expect(r.breakdown.form).toBe(1.0);
  });

  it("form minimale si les 2 joueurs perdent tout", () => {
    const r = computeMatchScore({
      ...TOP_CLASH,
      formA: ["L", "L", "L", "L", "L"],
      formB: ["L", "L", "L", "L", "L"],
    });
    expect(r.breakdown.form).toBe(0);
  });

  it("rivalry haute si H2H 3-3", () => {
    const r = computeMatchScore(TOP_CLASH);
    expect(r.breakdown.rivalry).toBeGreaterThanOrEqual(0.9);
  });

  it("rivalry par defaut 0.3 si pas d'H2H", () => {
    const r = computeMatchScore(ITF_MISMATCH);
    expect(r.breakdown.rivalry).toBe(0.3);
  });

  it("deterministe : memes inputs = meme score", () => {
    const r1 = computeMatchScore(TOP_CLASH);
    const r2 = computeMatchScore(TOP_CLASH);
    expect(r1.score).toBe(r2.score);
    expect(r1.raw).toBe(r2.raw);
  });

  it("rankTopMatches trie par score decroissant", () => {
    const matches = [
      { id: "1", ...TOP_CLASH },
      { id: "2", ...ITF_MISMATCH },
      { id: "3", ...MASTERS_FINAL },
    ];
    const ranked = rankTopMatches(matches, (m) => m);
    expect(ranked.length).toBe(3);
    expect(ranked[0].matchScore.score).toBeGreaterThanOrEqual(ranked[1].matchScore.score);
    expect(ranked[1].matchScore.score).toBeGreaterThanOrEqual(ranked[2].matchScore.score);
  });

  it("rankTopMatches limite a N resultats", () => {
    const matches = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      ...TOP_CLASH,
      probA: 50 + i,
    }));
    const ranked = rankTopMatches(matches, (m) => m, 5);
    expect(ranked.length).toBe(5);
  });
});
