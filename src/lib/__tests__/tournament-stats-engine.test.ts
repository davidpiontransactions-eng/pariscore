import { describe, test, expect } from "bun:test";
import {
  aggregatePlayerStats,
  hasUsableSample,
  normalizePlayerName,
  pickTournamentStats,
  surfaceUiLabel,
} from "../tournament-stats-engine";
import type { BSDMatch } from "../bsd-tennis-service";

// ─── Fixtures ─────────────────────────────────────────────────────────────

let seq = 0;

function makeMatch(overrides: Partial<BSDMatch> = {}): BSDMatch {
  seq += 1;
  return {
    id: seq,
    tournament: { name: "National Bank Open", surface: "hard" },
    player1: { id: 101, name: "Player A", current_ranking: { position: 3, type: "WTA" } },
    player2: { id: 202, name: "Player B", current_ranking: { position: 8, type: "WTA" } },
    status: "finished",
    round_name: "R1",
    match_date: "2026-08-05T18:00:00Z",
    player1_sets: 2,
    player2_sets: 0,
    sets_detail: [{ p1: 6, p2: 4 }],
    p1_aces: null,
    p2_aces: null,
    p1_double_faults: null,
    p2_double_faults: null,
    p1_first_serve_pct: null,
    p2_first_serve_pct: null,
    p1_first_serve_won_pct: null,
    p2_first_serve_won_pct: null,
    p1_second_serve_won_pct: null,
    p2_second_serve_won_pct: null,
    p1_break_points_saved_pct: null,
    p2_break_points_saved_pct: null,
    odds_player1: null,
    odds_player2: null,
    point_by_point_available: false,
    ...overrides,
  };
}

// ─── aggregatePlayerStats ─────────────────────────────────────────────────

describe("aggregatePlayerStats", () => {
  test("moyennes exactes des aces et doubles fautes par match (arrondi 1 décimale)", () => {
    const matches = [
      makeMatch({ p1_aces: 5, p1_double_faults: 2, p1_first_serve_pct: 62 }),
      makeMatch({ p1_aces: 8, p1_double_faults: 4, p1_first_serve_pct: 71 }),
    ];
    const s = aggregatePlayerStats(matches, 101, "Player A", "tournament");
    expect(s.matchesPlayed).toBe(2);
    expect(s.acesPerMatch).toBe(6.5);
    expect(s.doubleFaultsPerMatch).toBe(3);
    expect(s.firstServePct).toBe(67); // (62+71)/2 = 66.5 → Math.round = 67
    expect(s.source).toBe("tournament");
  });

  test("arrondi à 1 décimale (Math.round sur les %) sans décimales parasites", () => {
    const matches = [
      makeMatch({ p1_aces: 4, p1_first_serve_pct: 62, p1_first_serve_won_pct: 58 }),
      makeMatch({ p1_aces: 5, p1_first_serve_pct: 63, p1_first_serve_won_pct: 59 }),
      // 4.333 → 4.3 ; (62+63+63)/3 ≈ 62.67 → 63
      makeMatch({ p1_aces: 4, p1_first_serve_pct: 63, p1_first_serve_won_pct: 60 }),
    ];
    const s = aggregatePlayerStats(matches, 101, "Player A", "tournament");
    expect(s.acesPerMatch).toBe(4.3);
    expect(s.firstServePct).toBe(63);
    expect(s.firstServeWonPct).toBe(59); // (58+59+60)/3 = 59
  });

  test("une valeur null ne compte pas comme un 0 — dénominateur par métrique", () => {
    const matches = [
      makeMatch({ p1_aces: 10, p2_aces: 2 }),
      makeMatch({ p1_aces: null, p2_aces: null, p1_first_serve_pct: 50 }),
    ];
    const s = aggregatePlayerStats(matches, 101, "Player A", "tournament");
    expect(s.acesPerMatch).toBe(10); // 1 occurrence exploitable
    expect(s.firstServePct).toBe(50);
    expect(s.matchesPlayed).toBe(2);
  });

  test("les stats adverses (p2) ne polluent pas l'agrégat du joueur 1", () => {
    const matches = [
      makeMatch({ p1_aces: 6, p2_aces: 12, p1_double_faults: 3, p2_double_faults: 10 }),
      makeMatch({ p1_aces: 7, p2_aces: 20, p1_double_faults: 2, p2_double_faults: 11 }),
    ];
    const s = aggregatePlayerStats(matches, 101, "Player A", "tournament");
    expect(s.acesPerMatch).toBe(6.5);
    expect(s.doubleFaultsPerMatch).toBe(2.5);
  });

  test("aucun match joué → échantillon vide (matchesPlayed 0, toutes valeurs null)", () => {
    const s = aggregatePlayerStats([makeMatch()], 303, "Player C", "season-hard");
    expect(s.matchesPlayed).toBe(0);
    expect(hasUsableSample(s)).toBe(false);
    expect(s.source).toBe("season-hard");
  });
});

// ─── pickTournamentStats (fallback saison sur dur) ──────────────────────────

describe("pickTournamentStats", () => {
  test("édition du tournoi utilisée quand la joueuse y a disputé des matchs", () => {
    const tournament = aggregatePlayerStats(
      [makeMatch({ p1_aces: 6, p1_first_serve_pct: 60 })],
      101, "Player A", "tournament",
    );
    const season = aggregatePlayerStats(
      [makeMatch({ p1_aces: 2, p1_first_serve_pct: 50 })],
      101, "Player A", "season-hard",
    );
    const picked = pickTournamentStats(tournament, season);
    expect(picked.source).toBe("tournament");
    expect(picked.acesPerMatch).toBe(6);
  });

  test("fallback saison sur dur quand la joueuse débute le tournoi (0 match)", () => {
    const tournament = aggregatePlayerStats([makeMatch()], 101, "Player A", "tournament");
    const season = aggregatePlayerStats(
      [makeMatch({ p1_aces: 3, p1_first_serve_pct: 55 })],
      101, "Player A", "season-hard",
    );
    const picked = pickTournamentStats(tournament, season);
    expect(picked.source).toBe("season-hard");
    expect(picked.acesPerMatch).toBe(3);
    expect(picked.firstServePct).toBe(55);
  });

  test("pas de fallback sans données saison — on retombe sur le tournoi vide", () => {
    const tournament = aggregatePlayerStats([makeMatch()], 101, "Player A", "tournament");
    const picked = pickTournamentStats(tournament, null);
    expect(picked.source).toBe("tournament");
    expect(picked.matchesPlayed).toBe(0);
  });
});

// ─── Divers ───────────────────────────────────────────────────────────────

describe("helpers", () => {
  test("normalizePlayerName ignore la casse et les diacritiques", () => {
    expect(normalizePlayerName("Coco Gauff")).toBe("coco gauff");
    expect(normalizePlayerName("  GARCÍA ")).toBe("garcia");
  });

  test("surfaceUiLabel mappe les surfaces BSD vers l'UI française", () => {
    expect(surfaceUiLabel("hard")).toBe("Dur");
    expect(surfaceUiLabel("clay")).toBe("Terre battue");
    expect(surfaceUiLabel("grass")).toBe("Gazon");
    expect(surfaceUiLabel(null)).toBe("Dur");
  });
});