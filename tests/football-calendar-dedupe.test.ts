import { describe, expect, test } from "bun:test";
import { dedupeFootballMatches } from "@/lib/bsd-football-fetcher";

const m = (id: string, home: string, away: string, live?: unknown) => ({
  id,
  scheduledAt: "2026-09-08T19:00:00Z",
  home: { name: home },
  away: { name: away },
  league: { name: "L" },
  live: live ?? null,
});

describe("dedupeFootballMatches", () => {
  test("supprime le doublon live/prematch (priorité au live)", () => {
    const live = m("bsd-9", "AFC Stoneham", "Basingstoke", { status: "HT", minute: 45 });
    const pre = m("bsd-1", "AFC Stoneham", "Basingstoke", null);
    const out = dedupeFootballMatches([live, pre]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("bsd-9");
  });

  test("insensible à la casse et aux espaces", () => {
    const out = dedupeFootballMatches([m("a", "AFC  Stoneham", "X", null), m("b", "afc stoneham", "x", null)]);
    expect(out).toHaveLength(1);
  });

  test("garde les matchs distincts", () => {
    const out = dedupeFootballMatches([m("a", "A", "B", null), m("b", "C", "D", null)]);
    expect(out).toHaveLength(2);
  });

  test("noms vides : jamais dédupliqués", () => {
    const out = dedupeFootballMatches([m("a", "", "B", null), m("b", "", "B", null)]);
    expect(out).toHaveLength(2);
  });
});
