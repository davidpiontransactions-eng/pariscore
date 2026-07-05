import { test, expect } from "@playwright/test";

/**
 * API endpoint tests — direct fetch against /api/tennis/prematch.
 *
 * Verifies the response shape: { matches: [...3], source, updatedAt }.
 * Each match has the documented schema (id, tournament, playerA/B, probA/B,
 * stats, model). Each player has id/name/rank/elo/photoUrl/color/form.
 * Stats has form/eloGap/surface/h2h/ic/confidence. Source is one of
 * "cache" | "odds-api" | "mock".
 */

type ApiResponse = {
  matches: Array<{
    id: string;
    tournament: string;
    round: string;
    scheduledAt: string;
    playerA: {
      id: string;
      name: string;
      shortName: string;
      rank: number;
      elo: number;
      surfaceElo?: number;
      photoUrl: string;
      color: string;
      form: string[];
      country?: string;
    };
    playerB: {
      id: string;
      name: string;
      shortName: string;
      rank: number;
      elo: number;
      surfaceElo?: number;
      photoUrl: string;
      color: string;
      form: string[];
      country?: string;
    };
    probA: number;
    probB: number;
    stats: {
      form: string;
      eloGap: number;
      surface: string;
      h2h: string;
      ic: [number, number];
      confidence: number;
    };
    model: string;
    modelUpdatedAt: string;
    allOdds?: Array<{
      bookmaker: string;
      decimalA: number;
      decimalB: number;
      impliedProbA: number;
      impliedProbB: number;
      margin: number;
    }>;
  }>;
  source: "cache" | "odds-api" | "mock";
  updatedAt: string;
};

test.describe("API /api/tennis/prematch", () => {
  test("returns 200 with matches/source/updatedAt", async ({ request }) => {
    const res = await request.get("/api/tennis/prematch");
    expect(res.status()).toBe(200);

    const body = (await res.json()) as ApiResponse;
    expect(body).toHaveProperty("matches");
    expect(body).toHaveProperty("source");
    expect(body).toHaveProperty("updatedAt");
    expect(Array.isArray(body.matches)).toBe(true);
    expect(body.matches).toHaveLength(3);
  });

  test("source is one of cache | odds-api | mock", async ({ request }) => {
    const body = (await (await request.get("/api/tennis/prematch")).json()) as ApiResponse;
    expect(["cache", "odds-api", "mock"]).toContain(body.source);
  });

  test("updatedAt is a valid ISO timestamp", async ({ request }) => {
    const body = (await (await request.get("/api/tennis/prematch")).json()) as ApiResponse;
    const d = new Date(body.updatedAt);
    expect(d.toString()).not.toBe("Invalid Date");
    expect(d.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test("each match has id/tournament/playerA/playerB/probA/probB/stats/model", async ({
    request,
  }) => {
    const body = (await (await request.get("/api/tennis/prematch")).json()) as ApiResponse;

    for (const m of body.matches) {
      expect(typeof m.id).toBe("string");
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.tournament).toBe("string");
      expect(typeof m.round).toBe("string");
      expect(typeof m.probA).toBe("number");
      expect(typeof m.probB).toBe("number");
      expect(m.probA + m.probB).toBeCloseTo(100, 0);
      expect(m.probA).toBeGreaterThan(0);
      expect(m.probB).toBeGreaterThan(0);
      expect(typeof m.model).toBe("string");
    }
  });

  test("each player has id/name/rank/elo/photoUrl/color/form", async ({ request }) => {
    const body = (await (await request.get("/api/tennis/prematch")).json()) as ApiResponse;

    for (const m of body.matches) {
      for (const p of [m.playerA, m.playerB]) {
        expect(typeof p.id).toBe("string");
        expect(typeof p.name).toBe("string");
        expect(typeof p.rank).toBe("number");
        expect(typeof p.elo).toBe("number");
        expect(typeof p.photoUrl).toBe("string");
        expect(p.photoUrl).toMatch(/^https?:\/\//);
        expect(typeof p.color).toBe("string");
        expect(p.color).toMatch(/^#/);
        expect(Array.isArray(p.form)).toBe(true);
        // Form is a list of "W" | "L"
        for (const f of p.form) {
          expect(["W", "L"]).toContain(f);
        }
      }
    }
  });

  test("stats has form/eloGap/surface/h2h/ic/confidence with correct types", async ({
    request,
  }) => {
    const body = (await (await request.get("/api/tennis/prematch")).json()) as ApiResponse;

    for (const m of body.matches) {
      const s = m.stats;
      expect(typeof s.form).toBe("string");
      expect(s.form).toMatch(/^\d+V-\d+D$/);
      expect(typeof s.eloGap).toBe("number");
      expect(["Dur", "Terre battue", "Gazon"]).toContain(s.surface);
      expect(typeof s.h2h).toBe("string");
      expect(s.h2h).toMatch(/^\d+-\d+$/);
      expect(Array.isArray(s.ic)).toBe(true);
      expect(s.ic).toHaveLength(2);
      expect(typeof s.ic[0]).toBe("number");
      expect(typeof s.ic[1]).toBe("number");
      expect(s.ic[0]).toBeLessThanOrEqual(s.ic[1]);
      expect(typeof s.confidence).toBe("number");
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("matches are m1 (Sabalenka/Osaka), m2 (Alcaraz/Rublev), m3 (Sinner/Medvedev)", async ({
    request,
  }) => {
    const body = (await (await request.get("/api/tennis/prematch")).json()) as ApiResponse;
    const ids = body.matches.map((m) => m.id).sort();
    expect(ids).toEqual(["m1", "m2", "m3"]);

    const byId = Object.fromEntries(body.matches.map((m) => [m.id, m]));
    expect(byId.m1.playerA.name).toBe("Aryna Sabalenka");
    expect(byId.m1.playerB.name).toBe("Naomi Osaka");
    expect(byId.m2.playerA.name).toBe("Carlos Alcaraz");
    expect(byId.m2.playerB.name).toBe("Andrey Rublev");
    expect(byId.m3.playerA.name).toBe("Jannik Sinner");
    expect(byId.m3.playerB.name).toBe("Daniil Medvedev");
  });

  test("all matches include multi-bookmaker odds (5 bookmakers each)", async ({ request }) => {
    const body = (await (await request.get("/api/tennis/prematch")).json()) as ApiResponse;

    for (const m of body.matches) {
      expect(m.allOdds).toBeDefined();
      expect(m.allOdds).toHaveLength(5);
      const bookmakers = m.allOdds!.map((o) => o.bookmaker).sort();
      expect(bookmakers).toEqual(["Bet365", "Bwin", "PMU", "Unibet", "Winamax"]);
    }
  });

  test("second call returns cached source within TTL window", async ({ request }) => {
    // First call — may be mock or cache (depending on dev server state).
    const r1 = await request.get("/api/tennis/prematch");
    const b1 = (await r1.json()) as ApiResponse;

    // Second call — should be cached (within 60s TTL).
    const r2 = await request.get("/api/tennis/prematch");
    const b2 = (await r2.json()) as ApiResponse;

    expect(b2.source).toBe("cache");
    // Same updatedAt timestamp as the first call (cache hit).
    expect(b2.updatedAt).toBe(b1.updatedAt);
  });
});
