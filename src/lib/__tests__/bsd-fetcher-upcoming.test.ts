// Régression : le plateau prématch ne doit jamais absorber J0 quand BSD
// renvoie les matchs du plus récent au plus ancien (cf. incident filtre JOUR
// vide alors que 74 matchs de J0 étaient bien « scheduled »).
// NOW = 08/10/2026 10:00 Europe/Paris.
import { describe, expect, test } from "bun:test";
import { pickUpcomingMatches } from "@/lib/bsd-fetcher";
import type { BSDMatch } from "@/lib/bsd-tennis-service";

const NOW = Date.parse("2026-10-08T08:00:00Z"); // 10:00 Paris

const bsd = (id: number, match_date: string | null): BSDMatch =>
  ({
    id,
    tournament: { name: "Shanghai" },
    player1: { id: 1, name: `P1-${id}`, current_ranking: null },
    player2: { id: 2, name: `P2-${id}`, current_ranking: null },
    status: "scheduled",
    round_name: null,
    match_date,
  }) as unknown as BSDMatch;

describe("pickUpcomingMatches", () => {
  test("trie par date croissante même si l'entree est decroissante", () => {
    // Cas reel du 08/10/2026 : results[0] = 09/10, la fin = 08/10.
    const page = [
      bsd(1, "2026-10-09T17:00:00+00:00"), // 09/10 19:00 Paris
      bsd(2, "2026-10-09T14:00:00+00:00"), // 09/10 16:00 Paris
      bsd(3, "2026-10-08T22:00:00+00:00"), // 09/10 00:00 Paris
      bsd(4, "2026-10-08T08:20:00+00:00"), // 08/10 10:20 Paris  <- J0
      bsd(5, "2026-10-08T09:00:00+00:00"), // 08/10 11:00 Paris  <- J0
    ];
    expect(pickUpcomingMatches(page, 30, NOW).map((m) => m.id)).toEqual([4, 5, 3, 2, 1]);
  });

  test("ne plafonne jamais sur du J+1 tant que du J0 est disponible", () => {
    const page = [
      ...Array.from({ length: 40 }, (_, i) => bsd(100 + i, "2026-10-09T12:00:00+00:00")),
      ...Array.from({ length: 3 }, (_, i) => bsd(200 + i, "2026-10-08T12:00:00+00:00")),
    ];
    const kept = pickUpcomingMatches(page, 30, NOW);
    expect(kept).toHaveLength(30);
    // Les 3 matchs de J0 passent EN TETE (les plus proches) avant tout J+1.
    expect(kept.slice(0, 3).map((m) => m.id)).toEqual([200, 201, 202]);
  });

  test("jette les matchs passes, en cours et les dates invalides", () => {
    const page = [
      bsd(1, "2026-09-01T10:00:00+00:00"), // scheduled perime
      bsd(2, null),
      bsd(3, "pas-une-date"),
      bsd(4, "2026-10-08T07:00:00+00:00"), // 09:00 Paris -> deja commence
      bsd(5, "2026-10-08T12:00:00+00:00"), // 14:00 Paris -> a venir
    ];
    expect(pickUpcomingMatches(page, 30, NOW).map((m) => m.id)).toEqual([5]);
  });

  test("trie puis plafonne sur les plus proches", () => {
    const page = [
      bsd(3, "2026-10-09T09:00:00+00:00"),
      bsd(2, "2026-10-08T09:00:00+00:00"),
      bsd(1, "2026-10-10T09:00:00+00:00"),
    ];
    expect(pickUpcomingMatches(page, 2, NOW).map((m) => m.id)).toEqual([2, 3]);
  });

  test("ne mute pas le tableau recu", () => {
    const page = [bsd(2, "2026-10-09T09:00:00+00:00"), bsd(1, "2026-10-08T09:00:00+00:00")];
    const copy = page.map((m) => m.id);
    pickUpcomingMatches(page, 30, NOW);
    expect(page.map((m) => m.id)).toEqual(copy);
  });
});