// Tests handball-live-commentary — moteur pur (bead xx78).
// Convention projet : import explicite depuis "bun:test".
import { describe, expect, test } from "bun:test";
import {
  buildCommentary,
  commentEvent,
  intensityGauge,
  readStat,
  topScorers,
  type LiveFeed,
} from "../handball-live-commentary";

const feed = (events: LiveFeed["events"]): LiveFeed => ({
  events,
  homeStats: [],
  awayStats: [],
  homeScorers: [],
  awayScorers: [],
});

describe("commentEvent", () => {
  test("but normal + but 7m + buteur nommé", () => {
    expect(
      commentEvent(
        { minute: 12, team: "home", type: "Goal", detail: "Normal", player: "D. Santamaría" },
        "PSG",
        "Nantes",
      ),
    ).toBe("⚽ 12' but PSG — D. Santamaría");
    expect(
      commentEvent({ minute: 30, team: "away", type: "Goal", detail: "7m" }, "PSG", "Nantes"),
    ).toBe("⚽ 30' but Nantes (7m)");
  });

  test("carton jaune = exclusion 2 min, rouge = 🟥", () => {
    expect(
      commentEvent(
        { minute: 22, team: "away", type: "Card", detail: "Yellow Card", player: "T. Réda" },
        "PSG",
        "Nantes",
      ),
    ).toBe("🟨 22' exclusion 2 min — T. Réda (Nantes)");
    expect(
      commentEvent({ minute: 40, team: "home", type: "Card", detail: "Red Card", player: "X" }, "A", "B"),
    ).toContain("🟥");
  });

  test("event non commentable → null (jamais fabriqué)", () => {
    expect(commentEvent({ minute: 5, team: "home", type: "unknown" }, "A", "B")).toBeNull();
  });
});

describe("buildCommentary", () => {
  test("trie par minute, filtre non commentables", () => {
    const out = buildCommentary(
      feed([
        { minute: 30, team: "away", type: "Goal" },
        { minute: 3, team: "home", type: "Goal" },
        { minute: 10, team: "home", type: "weird" },
      ]),
      "A",
      "B",
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("3'");
    expect(out[1]).toContain("30'");
  });

  test("feed vide → fil vide", () => {
    expect(buildCommentary(feed([]), "A", "B")).toEqual([]);
  });
});

describe("intensityGauge", () => {
  test("vide → 0", () => {
    expect(intensityGauge(feed([]))).toBe(0);
  });

  test("rafale de buts récents → intensité haute", () => {
    const hot = intensityGauge(
      feed([
        { minute: 55, team: "home", type: "Goal" },
        { minute: 57, team: "home", type: "Goal" },
        { minute: 58, team: "away", type: "Goal" },
        { minute: 59, team: "home", type: "Card", detail: "Yellow Card" },
      ]),
    );
    expect(hot).toBeGreaterThan(60);
    expect(hot).toBeLessThanOrEqual(100);
  });

  test("match calme ancien → intensité basse", () => {
    const calm = intensityGauge(
      feed([
        { minute: 3, team: "home", type: "Goal" },
        { minute: 40, team: "away", type: "Goal" },
      ]),
    );
    expect(calm).toBeLessThan(30);
  });

  test("borne [0,100]", () => {
    const storm = intensityGauge(
      feed(
        Array.from({ length: 8 }, (_, i) => ({
          minute: 53 + i,
          team: "home" as const,
          type: "Goal",
        })),
      ),
    );
    expect(storm).toBe(100);
  });
});

describe("readStat", () => {
  const stats = [
    { type: "Ball Possession", value: "55%" },
    { type: "Total Shots", value: 30 },
  ];
  test("candidat trouvé (+ suffixe %)", () => {
    expect(readStat(stats, ["Ball Possession"])).toBe(55);
    expect(readStat(stats, ["Total Shots"])).toBe(30);
  });
  test("absent → null (pas 0)", () => {
    expect(readStat(stats, ["Goalkeeper Saves"])).toBeNull();
    expect(readStat([], ["Total Shots"])).toBeNull();
  });
});

describe("topScorers", () => {
  test("trie, filtre 0 but, top N", () => {
    expect(
      topScorers(
        [
          { name: "A", goals: 4 },
          { name: "B", goals: 6 },
          { name: "C", goals: 0 },
        ],
        2,
      ),
    ).toEqual([{ name: "B", goals: 6 }, { name: "A", goals: 4 }]);
  });
});
