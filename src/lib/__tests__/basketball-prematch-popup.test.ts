import { describe, expect, test } from "bun:test";
import {
  buildOddsGrid,
  summarizeOdds,
  standingLabel,
  h2hSupport,
  infraMessage,
} from "@/components/basketball/basketball-prematch-popup";
import { findBsdFixture, findBsdFixtureByTeam, type BsdCacheResponse } from "@/hooks/use-bsd-cache";
import type { CachedOdds } from "@/lib/basketball-bsd-cache";

const odds = (partial: Partial<CachedOdds> & { bookmaker: string; slug: string }): CachedOdds => ({
  oddsHome: 2,
  oddsAway: 2,
  fairHome: 0.5,
  fairAway: 0.5,
  vigPct: 0,
  updatedAt: null,
  ...partial,
});

describe("buildOddsGrid — la grille de cotes", () => {
  const data = [
    odds({ bookmaker: "Bet365", slug: "bet365", oddsHome: 1.75, oddsAway: 2.05, vigPct: 3.2 }),
    odds({ bookmaker: "1xBet", slug: "1xbet", oddsHome: 1.80, oddsAway: 2.00, vigPct: 2.8 }),
    // Cote d'arbitrage : le book a coté domicile 2.5 (anomalie), extérieur 1.9.
    odds({ bookmaker: "Arb", slug: "arb", oddsHome: 2.5, oddsAway: 1.9, vigPct: -20 }),
  ];

  test("tri décroissant sur le côté demandé", () => {
    const home = buildOddsGrid(data, "home");
    expect(home.map((r) => r.oddsHome)).toEqual([2.5, 1.8, 1.75]);
    const away = buildOddsGrid(data, "away");
    expect(away.map((r) => r.oddsAway)).toEqual([2.05, 2.0, 1.9]);
  });

  test("meilleure cote marquée sur CHAQUE colonne, sur deux livres différents", () => {
    const home = buildOddsGrid(data, "home");
    // Dom. : Arb (2.5) — Ext. : Bet365 (2.05). Ce sont les prix que le
    // parieur doit voir, indépendamment de l'ordre de tri.
    expect(home.find((r) => r.slug === "arb")!.isBestHome).toBe(true);
    expect(home.find((r) => r.slug === "bet365")!.isBestAway).toBe(true);
    expect(home.filter((r) => r.isBestHome)).toHaveLength(1);
    expect(home.filter((r) => r.isBestAway)).toHaveLength(1);
    // Le tri ne doit PAS repropager un drapeau : il est calculé avant tri.
    const away = buildOddsGrid(data, "away");
    expect(away.find((r) => r.slug === "arb")!.isBestHome).toBe(true);
    expect(away.find((r) => r.slug === "bet365")!.isBestAway).toBe(true);
  });

  test("une cote nulle est exclue (absence, pas cote à 0)", () => {
    const avecNulle = [...data, odds({ bookmaker: "Nul", slug: "nul", oddsHome: 0 })];
    const rows = buildOddsGrid(avecNulle, "home");
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.slug === "nul")).toBeUndefined();
  });

  test("grille vide sans cote valide", () => {
    expect(buildOddsGrid([odds({ bookmaker: "x", slug: "x", oddsHome: 0, oddsAway: 0 })], "home")).toEqual([]);
  });
});

describe("summarizeOdds — marge mesurée", () => {
  test("moyenne des marges, anomalie comptée mais non masquée", () => {
    const s = summarizeOdds([
      odds({ bookmaker: "a", slug: "a", vigPct: 4 }),
      odds({ bookmaker: "b", slug: "b", vigPct: 2 }),
      odds({ bookmaker: "c", slug: "c", vigPct: -1.31 }),
    ]);
    expect(s.count).toBe(3);
    expect(s.meanVigPct).toBeCloseTo(1.56, 2);
    // La marge négative (cote d'arbitrage) reste comptée, pas filtrée.
    expect(s.suspiciousCount).toBe(1);
  });

  test("aucune marge ⇒ mean null (pas 0 qui se lirait comme conforme)", () => {
    const s = summarizeOdds([odds({ bookmaker: "a", slug: "a", vigPct: null })]);
    expect(s.meanVigPct).toBeNull();
    expect(s.suspiciousCount).toBe(0);
  });

  test("meilleures cotes par colonne", () => {
    const s = summarizeOdds([
      odds({ bookmaker: "a", slug: "a", oddsHome: 1.7, oddsAway: 2.2 }),
      odds({ bookmaker: "b", slug: "b", oddsHome: 1.9, oddsAway: 2.0 }),
    ]);
    expect(s.bestHome).toBe(1.9);
    expect(s.bestAway).toBe(2.2);
  });

  test("aucune cote ⇒ toutes les mesures à null, count 0", () => {
    const s = summarizeOdds([]);
    expect(s).toEqual({ count: 0, meanVigPct: null, suspiciousCount: 0, bestHome: null, bestAway: null });
  });
});

describe("standingLabel — un classement reste lisible", () => {
  test("libellé composé de rang et bilan", () => {
    expect(standingLabel({ position: 6, wins: 1, losses: 0, matches: 1 })).toBe("6e — 1V 0D");
  });
  test("« 1er », pas « 1e »", () => {
    expect(standingLabel({ position: 1, wins: 0, losses: 1, matches: 1 })).toBe("1er — 0V 1D");
  });
  test("0 match ⇒ null (jamais « 1er — 0V 0D » qui se lirait comme du classement)", () => {
    expect(standingLabel(null)).toBeNull();
    expect(standingLabel({ position: 1, wins: 0, losses: 0, matches: 0 })).toBeNull();
  });
});

// ─── findBsdFixture ────────────────────────────────────────────────────────

function mkResponse(fixtures: BsdCacheResponse["fixtures"]): BsdCacheResponse {
  return {
    source: "bsd-cache",
    fetchedAt: "2026-10-06T10:00:00Z",
    ageMinutes: 5,
    staleAfterMinutes: 30,
    stale: false,
    fixtures,
    counts: { served: fixtures.length, withPrediction: 0, withPregame: 0, withOdds: 0, withHomeLogo: 0 },
    freshnessNote: null,
    predictionsAvailable: true,
  };
}

function mkFixture(id: number, lg: number, h: string, a: string) {
  const team = (name: string) => ({
    bsdId: 1,
    name,
    shortName: name,
    countryCode: "",
    logo: { url: null, available: false },
  });
  return {
    bsdEventId: id,
    leagueBsdId: lg,
    leagueName: "Eurocup",
    scheduledAt: "2026-10-06T16:30:00+00:00",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    home: team(h),
    away: team(a),
    prediction: null,
    predictionSource: null,
    pregame: null,
    odds: [],
    oddsSource: null,
  };
}

describe("findBsdFixture — joint calendrier ↔ cache", () => {
  const resp = mkResponse([mkFixture(1, 6, "Türk Telekom B.K.", "Maxima Roma")]);

  test("joint exact, casse insensible", () => {
    expect(findBsdFixture(resp, 6, "türk telekom b.k.", "MAXIMA ROMA")!.bsdEventId).toBe(1);
  });

  test("rencontre inversée : domicile ↔ extérieur", () => {
    expect(findBsdFixture(resp, 6, "Maxima Roma", "Türk Telekom B.K.")!.bsdEventId).toBe(1);
  });

  test("ligue différente ⇒ null (« Roma » existe en plusieurs ligues)", () => {
    expect(findBsdFixture(resp, 1, "Türk Telekom B.K.", "Maxima Roma")).toBeNull();
  });

  test("ligue inconnue acceptée si null (appelant sans ligue)", () => {
    expect(findBsdFixture(resp, null, "Türk Telekom B.K.", "Maxima Roma")).not.toBeNull();
  });

  test("ambiguïté = refus : deux fixtures identiques → null, pas le hasard", () => {
    const ambigue = mkResponse([
      mkFixture(1, 6, "A", "B"),
      mkFixture(2, 6, "A", "B"),
    ]);
    expect(findBsdFixture(ambigue, 6, "A", "B")).toBeNull();
  });

  test("noms absents ⇒ null, pas un match arbitraire", () => {
    expect(findBsdFixture(resp, 6, null, "Maxima Roma")).toBeNull();
    expect(findBsdFixture(resp, 6, "X", "")).toBeNull();
    expect(findBsdFixture(null, 6, "A", "B")).toBeNull();
  });
});

describe("findBsdFixtureByTeam — déclencheur clic calendrier", () => {
  const resp = mkResponse([
    mkFixture(1, 6, "Türk Telekom B.K.", "Maxima Roma"),
    mkFixture(2, 6, "Budućnost", "Napoli"),
  ]);

  test("équipe à domicile comme à extérieur résolvent la même rencontre", () => {
    expect(findBsdFixtureByTeam(resp, "Türk Telekom B.K.")!.bsdEventId).toBe(1);
    expect(findBsdFixtureByTeam(resp, "Maxima Roma")!.bsdEventId).toBe(1);
    expect(findBsdFixtureByTeam(resp, "Napoli")!.bsdEventId).toBe(2);
  });

  test("casse insensible et espaces superflus tolérés", () => {
    expect(findBsdFixtureByTeam(resp, "  maxima romA ")!.bsdEventId).toBe(1);
  });

  test("ambiguïté = refus : deux rencontres pour la même équipe → null", () => {
    // C'est la règle qui empêche le popup d'ouvrir sur LE MAUVAIS match :
    // dans la fenêtre d'un cron (7 jours), une équipe joue souvent 2 fois.
    const double = mkResponse([
      mkFixture(1, 6, "Napoli", "A"),
      mkFixture(2, 6, "Napoli", "B"),
    ]);
    expect(findBsdFixtureByTeam(double, "Napoli")).toBeNull();
    // L'autre équipe reste résoluble (une seule occurrence).
    expect(findBsdFixtureByTeam(double, "A")!.bsdEventId).toBe(1);
  });

  test("équipe inconnue ou entrée absente → null", () => {
    expect(findBsdFixtureByTeam(resp, "ZZZ Inconnu")).toBeNull();
    expect(findBsdFixtureByTeam(resp, "")).toBeNull();
    expect(findBsdFixtureByTeam(resp, null)).toBeNull();
    expect(findBsdFixtureByTeam(null, "Napoli")).toBeNull();
  });
});

describe("h2hSupport — couverture déclarée par les données, pas par le type", () => {
  test("NBA et WNBA sont couverts", () => {
    // Ids relevés sur /basketball/api/v2/leagues/ : 1=NBA, 7=WNBA.
    expect(h2hSupport(1)).toEqual({ supported: true, league: "nba" });
    expect(h2hSupport(7)).toEqual({ supported: true, league: "wnba" });
  });

  test("EuroCup et EuroLeague REFUSÉS — aucune base H2H", () => {
    // data/basketball_h2h/ ne contient que des fichiers `nba_*` (mesuré
    // 2026-10-06). Étendre le type `league: "nba" | "wnba"` à ces ligues
    // produirait un sélecteur affichant une liste VIDE en prétendant les
    // couvrir — pire qu'un refus explicite.
    for (const id of [2, 6]) {
      const s = h2hSupport(id);
      expect(s.supported, `ligue ${id} déclarée couverte`).toBe(false);
      expect(s.league).toBeNull();
    }
    // La raison est obligatoire et nomme les ligues réellement couvertes —
    // sinon l'utilisateur reçoit un « indisponible » sans savoir pourquoi.
    const r = h2hSupport(6);
    expect(r.supported === false && r.reason).toContain("NBA");
    expect(r.supported === false && r.reason).toContain("WNBA");
  });

  test("ligue inconnue ou absente ⇒ refus, jamais un défaut optimiste", () => {
    // Un défaut `supported: true` ouvrirait la fiche sur une ligue sans donnée.
    for (const id of [null, 3, 4, 5, 99]) {
      expect(h2hSupport(id).supported, `ligue ${id} acceptée par défaut`).toBe(false);
    }
  });
});

describe("infraMessage — on ne parle pas de reverse-proxy au parieur", () => {
  test("un code HTTP brut ne doit jamais fuiter à l'écran", () => {
    // Régression : le popup affichait « Cache BSD indisponible : HTTP 502 » en
    // rouge. Le 502 vient de nginx (upstream), pas de notre route — il n'a
    // aucun sens pour l'utilisateur.
    for (const code of ["HTTP 502", "HTTP 500", "HTTP 504", "HTTP 404"]) {
      const msg = infraMessage(code);
      expect(msg, `${code} fuit tel quel`).not.toBeNull();
      expect(msg).not.toContain("HTTP");
      expect(msg).not.toContain(String(code).slice(-3));
    }
  });

  test("les échecs réseau sont normalisés aussi", () => {
    for (const e of ["fetch failed", "network timeout", "ECONNRESET"]) {
      expect(infraMessage(e)).not.toContain(e);
    }
  });

  test("pas d'erreur ⇒ null (aucun bandeau affiché)", () => {
    expect(infraMessage(null)).toBeNull();
    expect(infraMessage(undefined)).toBeNull();
    expect(infraMessage("")).toBeNull();
  });

  test("une erreur de MAISON (pas infra) reste affichée telle quelle", () => {
    // Si notre route renvoie un message propre du type « paramètre league
    // invalide », on le montre : il vient de nous et il est actionnable.
    const maison = "paramètre `league` invalide";
    expect(infraMessage(maison)).toBe(maison);
  });
});
