import { describe, test, expect } from "bun:test";
import { NextRequest } from "next/server";
import { parseBsdId } from "../src/lib/bsd-id";
import { GET } from "../src/app/api/v1/previous-match-highlights/route";
import {
  buildHighlightQuery,
  getPreviousRoundHighlights,
  labelForMatch,
  mapSurfaceToken,
} from "../src/services/previous-match-highlights-service";

describe("parseBsdId", () => {
  test("strips bsd- prefix", () => {
    expect(parseBsdId("bsd-33487")).toBe(33487);
  });
  test("returns null on non-numeric", () => {
    expect(parseBsdId("abc")).toBeNull();
    expect(parseBsdId("")).toBeNull();
    expect(parseBsdId("bsd-")).toBeNull();
  });
});

describe("mapSurfaceToken", () => {
  test("maps French surface labels", () => {
    expect(mapSurfaceToken("Terre battue")).toBe("clay");
    expect(mapSurfaceToken("Dur")).toBe("hard");
    expect(mapSurfaceToken("Gazon")).toBe("grass");
    expect(mapSurfaceToken(null)).toBeNull();
    expect(mapSurfaceToken("Synthetic")).toBeNull();
  });
});

describe("labelForMatch", () => {
  test("same tournament → tour-precedent", () => {
    expect(labelForMatch("Roland Garros", "Roland Garros")).toBe("tour-precedent");
  });
  test("different tournament → dernier-match", () => {
    expect(labelForMatch("Wimbledon", "Roland Garros")).toBe("dernier-match");
  });
  test("missing ctx → dernier-match", () => {
    expect(labelForMatch(null, "Roland Garros")).toBe("dernier-match");
  });
});

describe("buildHighlightQuery", () => {
  test("full query with opponent + surface + tournament + year", () => {
    const queries = buildHighlightQuery("Iga Swiatek", {
      opponent: "M. Dupont",
      tournament: "Roland Garros",
      surface: "clay",
    }, "2026");
    expect(queries[0]).toContain("Iga Swiatek vs M. Dupont highlights");
    expect(queries[0]).toContain("clay");
    expect(queries[0]).toContain("Roland Garros");
    expect(queries[0]).toContain("2026");
    expect(queries[1]).toContain("Iga Swiatek vs M. Dupont highlights");
  });
  test("no opponent → player + tournament query", () => {
    const queries = buildHighlightQuery("Carlos Alcaraz", {
      opponent: null,
      tournament: "Wimbledon",
      surface: null,
    }, "2026");
    expect(queries[0]).toContain("Carlos Alcaraz highlights Wimbledon 2026");
  });
});

describe("getPreviousRoundHighlights", () => {
  test("ne throw jamais en mode fallback (BSD indisponible) et remplit players", async () => {
    // Aucune clé BSD en CI → fetchMatchH2H throw → source "fallback",
    // contexte vide, mais resolveVideo injecté fournit quand même une vidéo.
    const res = await getPreviousRoundHighlights({
      matchId: "bd-999",
      playerAId: "11",
      playerAName: "Iga Swiatek",
      playerBId: "12",
      playerBName: "Ons Jabeur",
      currentTournamentName: null,
      currentSurface: "clay",
      resolveVideo: async (name) => ({
        videoId: "abc123",
        title: `${name} highlights`,
        url: "https://youtu.be/abc123",
      }),
    });
    expect(res.source).toBe("fallback");
    expect(res.players.length).toBe(2);
    for (const p of res.players) {
      expect(p.context).toEqual({
        round: null, tournament: null, surface: null,
        opponent: null, won: null, score: null,
      });
      expect(p.video).not.toBeNull();
    }
  });

  test("ne throw jamais même sur matchId invalide + surface nulle", async () => {
    const res = await getPreviousRoundHighlights({
      matchId: "abc",
      playerAId: "1",
      playerAName: "A",
      playerBId: "2",
      playerBName: "B",
      currentTournamentName: "Wimbledon",
      currentSurface: null,
      resolveVideo: async () => null,
    });
    expect(res.players.length).toBe(2);
    expect(res.players[0].video).toBeNull();
  });
});

describe("GET /api/v1/previous-match-highlights", () => {
  test("400 on missing params", async () => {
    const req = new NextRequest("http://x/api/v1/previous-match-highlights?matchId=1");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
  test("400 on too long name", async () => {
    const long = "x".repeat(121);
    const req = new NextRequest(
      `http://x/api/v1/previous-match-highlights?matchId=1&playerAId=a&playerAName=${encodeURIComponent(long)}&playerBId=b&playerBName=c`,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
  test("200 valid", async () => {
    const req = new NextRequest(
      "http://x/api/v1/previous-match-highlights?matchId=bsd-99&playerAId=11&playerAName=Iga%20Swiatek&playerBId=12&playerBName=Ons%20Jabeur&tournament=Roland%20Garros&surface=Terre%20battue",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.ttlSeconds).toBe(172800);
    expect(Array.isArray(body.players)).toBe(true);
  });
});