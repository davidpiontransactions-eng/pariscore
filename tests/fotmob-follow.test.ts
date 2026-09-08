import { describe, expect, test } from "bun:test";
import { partitionFollowed, toFollowId } from "@/lib/fotmob-follow";

// Ligne minimale du shape FotmobCalMatch pour les tests.
const m = (id: string) => ({
  id,
  scheduledAt: "2026-09-08T19:00:00Z",
  home: { name: "A" },
  away: { name: "B" },
});

describe("toFollowId", () => {
  test("préfixe les ids bruts", () => {
    expect(toFollowId("bsd-1")).toBe("match:football:bsd-1");
  });

  test("idempotent sur ids conventionnels", () => {
    expect(toFollowId("match:football:bsd-1")).toBe("match:football:bsd-1");
  });
});

describe("partitionFollowed", () => {
  test("sépare suivis (2 formes) et préserve l'ordre", () => {
    const ms = [m("bsd-1"), m("bsd-2"), m("bsd-3")];
    const { followed, rest } = partitionFollowed(ms, ["match:football:bsd-2", "bsd-3"]);
    expect(followed.map((x) => x.id)).toEqual(["bsd-2", "bsd-3"]);
    expect(rest.map((x) => x.id)).toEqual(["bsd-1"]);
  });

  test("listes vides", () => {
    expect(partitionFollowed([], ["match:football:x"])).toEqual({ followed: [], rest: [] });
  });
});
