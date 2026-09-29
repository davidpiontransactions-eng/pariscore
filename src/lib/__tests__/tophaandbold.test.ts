// Tests du client tophaandbold — fonctions pures uniquement (zéro réseau).
// Fixtures = extraits réels des pages/JSON vérifiés le 2026-09-29.
import { describe, expect, test } from "bun:test";
import { mapTopMatch, parseMatchIds } from "../tophaandbold";

describe("parseMatchIds — IDs /match/{id} d'une page kampprogram", () => {
  test("extrait les IDs uniques dans l'ordre (fixture réelle pokalturnering-herrer)", () => {
    const html = `
      <a href="/match/8350">Resultat</a>
      <a href="/match/8351">Senere</a>
      <a href="/match/8364">Senere</a>
      <a href="/match/8350">Resultat (dup)</a>
      <a href="/match/REPLACE">placeholder</a>`;
    expect(parseMatchIds(html)).toEqual([8350, 8351, 8364]);
  });

  test("page sans match → []", () => {
    expect(parseMatchIds("<p>aucun</p>")).toEqual([]);
  });
});

describe("mapTopMatch — JSON /match/{id}.json → TopCupMatch", () => {
  const ns = {
    id: 8364,
    start_time: "2026-09-29T20:00:00+02:00",
    time: "00:00.00",
    time_running: 0,
    spectators: 0,
    score: "0-0",
    halftime_score: "0-0",
    teams: [
      { id: 32, name: "Skive fH", short_name: "SFH", logo: "/app/webroot/x/sfh.png" },
      { id: 68, name: "SAH", short_name: "SAH", logo: "/app/webroot/y/sah.png" },
    ],
    season: { name: "2026/2027" },
    league: { id: 5, name: "Pokalturnering Herrer" },
    bracket: { name: "1/8 finaler" },
    arena: { name: "BioCirc Arena" },
    tv_channel: { name: "TV2 sport" },
  };

  test("match à venir → not_started, logos absolutisés, contexte coupe", () => {
    const now = Date.parse("2026-09-29T10:00:00Z"); // avant le coup d'envoi
    const m = mapTopMatch(ns, now);
    expect(m).not.toBeNull();
    expect(m!.status).toBe("not_started");
    expect(m!.kickoff).toBe("2026-09-29T18:00:00.000Z");
    expect(m!.score).toBeUndefined(); // NS → pas de score affiché
    expect(m!.home.name).toBe("Skive fH");
    expect(m!.home.logo).toBe("https://tophaandbold.dk/app/webroot/x/sfh.png");
    expect(m!.league.countryCode).toBe("DK");
    expect(m!.bracket).toBe("1/8 finaler");
    expect(m!.arena).toBe("BioCirc Arena");
    expect(m!.tv).toBe("TV2 sport");
    expect(m!.spectators).toBe(0);
  });

  test("match en cours → live avec minute + score", () => {
    const live = {
      ...ns,
      time: "42:10.00",
      time_running: 1,
      score: "18-21",
      halftime_score: "9-11",
      spectators: 940,
    };
    const m = mapTopMatch(live, Date.parse("2026-09-29T19:00:00Z"));
    expect(m!.status).toBe("live");
    expect(m!.minute).toBe(42);
    expect(m!.score).toEqual({ home: 18, away: 21, homeHalf: 9, awayHalf: 11 });
    expect(m!.spectators).toBe(940);
  });

  test("pause MT (30:00, horloge arrêtée) → halftime", () => {
    const ht = { ...ns, time: "30:00.00", time_running: 0, score: "14-15" };
    const m = mapTopMatch(ht, Date.parse("2026-09-29T19:00:00Z"));
    expect(m!.status).toBe("halftime");
    expect(m!.minute).toBe(30);
  });

  test("fin de match (60:00, horloge arrêtée) → finished avec score", () => {
    const ft = { ...ns, time: "60:00.00", time_running: 0, score: "25-30", halftime_score: "15-15" };
    const m = mapTopMatch(ft, Date.parse("2026-09-29T20:00:00Z"));
    expect(m!.status).toBe("finished");
    expect(m!.score).toEqual({ home: 25, away: 30, homeHalf: 15, awayHalf: 15 });
  });

  test("structures invalides → null", () => {
    expect(mapTopMatch(null)).toBeNull();
    expect(mapTopMatch({})).toBeNull();
    expect(mapTopMatch({ id: 1, teams: [{ name: "A" }] })).toBeNull();
  });
});
