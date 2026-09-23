// Tests régression normalisation status ESPN → vocab UI — boucle rouge debug 2026-09-23
// Bug : service émet "in" mais UI teste "in-progress" → matchs live NBA jamais comptés/badge

import { describe, test, expect } from "bun:test";
import { normalizeMatch } from "../../hooks/use-basketball-matches";

function raw(status: string) {
  return {
    id: "1",
    date: "2026-10-01T23:00:00Z",
    status,
    home: { id: "1", abbr: "BOS", name: "Celtics", score: 80, record: "1-0" },
    away: { id: "2", abbr: "NYK", name: "Knicks", score: 78, record: "0-1" },
  };
}

describe("normalizeMatch — status ESPN → UI", () => {
  test("\"in\" → \"in-progress\" (badge LIVE + compteur live)", () => {
    expect(normalizeMatch(raw("in"), "NBA").status).toBe("in-progress");
  });

  test("\"pre\" reste \"pre\"", () => {
    expect(normalizeMatch(raw("pre"), "NBA").status).toBe("pre");
  });

  test("\"post\" reste \"post\" (filtré côté hook)", () => {
    expect(normalizeMatch(raw("post"), "NBA").status).toBe("post");
  });

  test("status manquant → \"pre\"", () => {
    const r = raw("in");
    delete (r as { status?: string }).status;
    expect(normalizeMatch(r, "WNBA").status).toBe("pre");
  });
});
