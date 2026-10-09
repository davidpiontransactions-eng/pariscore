// Tests de la couche d'adaptateurs + du câblage hook → moteur.
// Ces tests verrouillent la PROPRIÉTÉ centrale du câblage : un flux qui ne
// porte pas les champs nécessaires doit produire `null` (UI : « indisponible »),
// jamais des probabilités de repli présentées comme des prédictions.
import { describe, expect, test } from "bun:test";
import {
  adaptBaseball,
  adaptBasketball,
  adaptFootball,
  adaptHandball,
  adaptHockey,
  adaptLivePayload,
  adaptSnooker,
  parseClockMinutes,
} from "@/lib/prediction/live-adapters";
import {
  buildBundle,
  extractLiveMatch,
  LIVE_ROUTE_BY_SPORT,
} from "@/hooks/use-live-predictive-bets";
import { extractMlbLiveState } from "@/lib/baseball/data/mlb-statsapi";

// ─── Football ──────────────────────────────────────────────────────────────

describe("adaptFootball", () => {
  const full = {
    id: "m1",
    minute: 67,
    home_score: 2,
    away_score: 1,
    home_xg: 1.85,
    away_xg: 0.72,
    home_corners: 6,
    away_corners: 2,
    home_yellow_cards: 1,
    away_yellow_cards: 3,
    pressure_index: 22,
  };

  test("payload BSD plat → entrée complète", () => {
    const r = adaptFootball(full);
    expect(r).not.toBeNull();
    expect(r?.minute).toBe(67);
    expect(r?.homeXg).toBe(1.85);
    expect(r?.corners).toEqual({ home: 6, away: 2 });
    expect(r?.yellowCards).toEqual({ home: 1, away: 3 });
    expect(r?.pressureIndex).toBe(22);
  });

  test("accepte la forme imbriquée `live` (type du hook useLiveFootball)", () => {
    const r = adaptFootball({
      id: "m1",
      live: { minute: 12, homeScore: 0, awayScore: 0, homeXg: 0.3, awayXg: 0.1 },
    });
    expect(r?.minute).toBe(12);
    expect(r?.homeXg).toBe(0.3);
  });

  test("probs pré-match en fraction (0-1) → converties en pourcentage", () => {
    const r = adaptFootball({ ...full, prematch: { homeProb: 0.46, drawProb: 0.27 } });
    expect(r?.prematch?.homeProb).toBeCloseTo(46, 6);
    expect(r?.prematch?.drawProb).toBeCloseTo(27, 6);
  });

  test("probs pré-match déjà en pourcentage → non multipliées", () => {
    const r = adaptFootball({ ...full, prematch: { homeProb: 46, drawProb: 27 } });
    expect(r?.prematch?.homeProb).toBeCloseTo(46, 6);
  });

  test("sans score → null (pas de marché calculable)", () => {
    expect(adaptFootball({ id: "m1", minute: 67, home_score: 2 })).toBeNull();
  });

  test("minute absente → null", () => {
    expect(adaptFootball({ id: "m1", home_score: 2, away_score: 1 })).toBeNull();
  });

  test("null / non-objet → null", () => {
    expect(adaptFootball(null)).toBeNull();
    expect(adaptFootball("match")).toBeNull();
    expect(adaptFootball([])).toBeNull();
  });

  test("xG absent → undefined (le moteur retombe sur son prior)", () => {
    const r = adaptFootball({ id: "m1", minute: 5, home_score: 0, away_score: 0 });
    expect(r?.homeXg).toBeUndefined();
  });
});

// ─── Basketball ───────────────────────────────────────────────────────────

describe("adaptBasketball", () => {
  const fiba = {
    id: "f1",
    period: 3,
    clock: "5:34",
    home: { score: 78, linescores: [25, 22, 31] },
    away: { score: 74, linescores: [20, 24, 30] },
  };

  test("payload FIBA → période + temps restant", () => {
    const r = adaptBasketball(fiba);
    expect(r?.period).toBe(3);
    expect(r?.periodMinutesLeft).toBeCloseTo(5 + 34 / 60, 9);
    expect(r?.homeScore).toBe(78);
  });

  test("horloge absente → quart supposé plein (hypothèse explicite)", () => {
    const r = adaptBasketball({ ...fiba, clock: undefined });
    expect(r?.periodMinutesLeft).toBe(12);
  });

  test("période absente → null", () => {
    expect(adaptBasketball({ ...fiba, period: undefined })).toBeNull();
  });

  test("score null → null (jamais 0 inventé)", () => {
    expect(adaptBasketball({ ...fiba, home: { score: null } })).toBeNull();
  });

  test("FGA / eFG / 3PA restent null : le moteur retombe sur la ligue", () => {
    const r = adaptBasketball(fiba);
    expect(r?.homeFga).toBeNull();
    expect(r?.homeEfg).toBeNull();
    expect(r?.homeThreeAtt).toBeNull();
  });
});

describe("parseClockMinutes", () => {
  test("formats valides", () => {
    expect(parseClockMinutes("5:34")).toBeCloseTo(5.5667, 4);
    expect(parseClockMinutes("12:00")).toBe(12);
    expect(parseClockMinutes("0:09")).toBeCloseTo(0.15, 6);
  });

  test("formats invalides → undefined", () => {
    for (const v of ["", "5", "5:", ":34", "5:99", "abc", "5:4", null, 12]) {
      expect(parseClockMinutes(v)).toBeUndefined();
    }
  });
});

// ─── Hockey ────────────────────────────────────────────────────────────────

describe("adaptHockey", () => {
  test("sans période ni horloge → null (dégradé documenté)", () => {
    // Le flux hockey actuel ne fournit que `isLive` + noms : projeter sans
    // période reviendrait à supposer 60 minutes restantes, toujours.
    expect(adaptHockey({ id: "h1", isLive: true, homeName: "A", awayName: "B" })).toBeNull();
  });

  test("période + horloge + score → entrée complète", () => {
    const r = adaptHockey({
      id: "h1",
      period: 3,
      periodSecondsLeft: 640,
      homeGoals: 2,
      awayGoals: 1,
      powerPlay: "home",
      powerPlaySecondsLeft: 78,
    });
    expect(r?.period).toBe(3);
    expect(r?.homeScore).toBe(2);
    expect(r?.powerPlay).toBe("home");
  });

  test("score présent mais période absente → null (λ serait faux)", () => {
    expect(adaptHockey({ id: "h1", homeGoals: 2, awayGoals: 1 })).toBeNull();
  });

  test("powerPlay invalide → null (jamais une valeur inventée)", () => {
    const r = adaptHockey({
      id: "h1",
      period: 2,
      periodSecondsLeft: 600,
      homeGoals: 0,
      awayGoals: 0,
      powerPlay: "oui",
    });
    expect(r?.powerPlay).toBeNull();
  });
});

// ─── Baseball ──────────────────────────────────────────────────────────────

describe("adaptBaseball", () => {
  const full = {
    inning: 7,
    half: "top",
    outs: 1,
    bases: 5,
    balls: 2,
    strikes: 1,
    homeRuns: 3,
    awayRuns: 1,
  };

  test("état de jeu complet → entrée complète", () => {
    const r = adaptBaseball(full);
    expect(r?.inning).toBe(7);
    expect(r?.half).toBe("top");
    expect(r?.bases).toBe(5);
    expect(r?.count).toEqual({ balls: 2, strikes: 1 });
  });

  test("un seul champ manquant → null (la matrice MLB n'est pas indexable)", () => {
    for (const key of ["inning", "half", "outs", "bases", "homeRuns", "awayRuns"]) {
      const broken: Record<string, unknown> = { ...full };
      delete broken[key];
      expect(adaptBaseball(broken)).toBeNull();
    }
  });

  test("outs hors [0, 2] → null", () => {
    expect(adaptBaseball({ ...full, outs: 5 })).toBeNull();
  });

  test("bases hors [0, 7] → null", () => {
    expect(adaptBaseball({ ...full, bases: 12 })).toBeNull();
  });

  test("half invalide → null", () => {
    expect(adaptBaseball({ ...full, half: "middle" })).toBeNull();
  });
});

describe("extractMlbLiveState", () => {
  const feed = {
    gamePk: 715,
    liveData: {
      linescore: {
        currentInning: 7,
        innings: [
          { home: 0, away: 1 },
          { home: 2, away: 0 },
        ],
      },
      count: { balls: 2, strikes: 1, outs: 1 },
      bases: "101",
      allPlay: [{ about: { halfInning: "top" } }],
    },
  };

  test("extrait les 5 champs de l'état de jeu", () => {
    const s = extractMlbLiveState(feed);
    expect(s?.inning).toBe(7);
    expect(s?.half).toBe("top");
    expect(s?.outs).toBe(1);
    expect(s?.balls).toBe(2);
    expect(s?.strikes).toBe(1);
    // "101" = 1re + 3e → masque 1 + 4 = 5
    expect(s?.bases).toBe(5);
    expect(s?.inningScores).toHaveLength(2);
  });

  test("`halfInning` absent → null (deviner le camp qui frappe est un mensonge)", () => {
    const s = extractMlbLiveState({ ...feed, liveData: { ...feed.liveData, allPlay: [] } });
    expect(s).toBeNull();
  });

  test("bases de longueur inattendue → null", () => {
    expect(extractMlbLiveState({ ...feed, liveData: { ...feed.liveData, bases: "10" } })).toBeNull();
  });

  test("null / non-objet → null", () => {
    expect(extractMlbLiveState(null)).toBeNull();
    expect(extractMlbLiveState("feed")).toBeNull();
  });

  test("bases pleines «111» → 7", () => {
    expect(
      extractMlbLiveState({ ...feed, liveData: { ...feed.liveData, bases: "111" } })?.bases
    ).toBe(7);
  });
});

// ─── Handball ──────────────────────────────────────────────────────────────

describe("adaptHandball", () => {
  const live = {
    id: "hb1",
    minute: 24,
    score: { home: 14, away: 12, homeHalf: 7, awayHalf: 6 },
  };

  test("payload /api/handball/live → entrée complète", () => {
    const r = adaptHandball(live);
    expect(r?.minute).toBe(24);
    expect(r?.homeScore).toBe(14);
    expect(r?.halfTimeScore).toEqual({ home: 7, away: 6 });
  });

  test("mi-temps absente → null, jamais {0, 0}", () => {
    const r = adaptHandball({ id: "hb1", minute: 24, score: { home: 14, away: 12 } });
    expect(r?.halfTimeScore).toBeNull();
  });

  test("minute absente → null", () => {
    expect(adaptHandball({ id: "hb1", score: { home: 1, away: 0 } })).toBeNull();
  });

  test("drivers avancés absents → null (moteur sur prior de ligue)", () => {
    const r = adaptHandball(live);
    expect(r?.manAdvantage).toBeNull();
    expect(r?.saveRate).toBeNull();
    expect(r?.transitionSpeed).toBeUndefined();
  });
});

// ─── Snooker ───────────────────────────────────────────────────────────────

describe("adaptSnooker", () => {
  const full = {
    scoreA: 3,
    scoreB: 2,
    bestOf: 11,
    framePointsA: 41,
    framePointsB: 28,
    pointsOnTable: 62,
  };

  test("payload complet → entrée complète", () => {
    const r = adaptSnooker(full);
    expect(r?.framesA).toBe(3);
    expect(r?.framePointsA).toBe(41);
    expect(r?.pointsOnTable).toBe(62);
  });

  test("payload actuel (frames seules) → null (dégradé documenté)", () => {
    // Le parseur snooker ne lit qu'un entier par camp : les points de frame
    // n'existent pas. Sans eux, « A mène de 13 » et « A mène de 130 » sont
    // indiscernables et les 3 marchés seraient faux.
    expect(adaptSnooker({ id: "s1", scoreA: 3, scoreB: 2, bestOf: 11 })).toBeNull();
  });

  test("points hors [0, 147] → null", () => {
    expect(adaptSnooker({ ...full, pointsOnTable: 200 })).toBeNull();
  });
});

// ─── Dispatcher ────────────────────────────────────────────────────────────

describe("adaptLivePayload", () => {
  test("les 6 sports sont câblés", () => {
    for (const sport of ["football", "basketball", "hockey", "baseball", "handball", "snooker"]) {
      expect(typeof adaptLivePayload(sport, {})).not.toBe("undefined");
    }
  });

  test("route déclarée pour chaque sport supporté", () => {
    for (const sport of ["football", "basketball", "hockey", "baseball", "handball", "snooker"]) {
      expect(LIVE_ROUTE_BY_SPORT[sport]).toBeTruthy();
    }
  });

  test("sport inconnu → null", () => {
    expect(adaptLivePayload("rugby", { minute: 1 })).toBeNull();
  });
});

// ─── extractLiveMatch ──────────────────────────────────────────────────────

describe("extractLiveMatch", () => {
  const matches = [
    { id: "a", minute: 1 },
    { id: "b", minute: 2 },
  ];

  test("enveloppe `matches`", () => {
    expect(extractLiveMatch({ matches })).toBe(matches[0]);
  });

  test("enveloppe `liveGames` (baseball)", () => {
    expect(extractLiveMatch({ liveGames: matches })).toBe(matches[0]);
  });

  test("enveloppe `games` (FIBA)", () => {
    expect(extractLiveMatch({ games: matches })).toBe(matches[0]);
  });

  test("tableau nu", () => {
    expect(extractLiveMatch(matches)).toBe(matches[0]);
  });

  test("sélection par id", () => {
    expect(extractLiveMatch({ matches }, "b")).toBe(matches[1]);
  });

  test("id absent du flux → null (jamais le premier match par défaut)", () => {
    expect(extractLiveMatch({ matches }, "zzz")).toBeNull();
  });

  test("payload vide / invalide → null", () => {
    expect(extractLiveMatch({})).toBeNull();
    expect(extractLiveMatch(null)).toBeNull();
    expect(extractLiveMatch("x")).toBeNull();
  });
});

// ─── buildBundle (route → adaptateur → moteur) ─────────────────────────────

describe("buildBundle", () => {
  const footballPayload = {
    matches: [
      {
        id: "m1",
        minute: 67,
        home_score: 2,
        away_score: 1,
        home_xg: 1.85,
        away_xg: 0.72,
        corners: { home: 6, away: 2 },
      },
    ],
  };

  test("football : bundle complet depuis un payload réel", () => {
    const { bundle, reason } = buildBundle("football", footballPayload, "m1");
    expect(reason).toBeNull();
    expect(bundle).not.toBeNull();
    expect(bundle?.sport).toBe("football");
    expect(bundle?.markets.length).toBeGreaterThan(3);
    expect(bundle?.scoreA).toBe(2);
    expect(bundle?.drivers.length).toBeGreaterThan(0);
  });

  test("football : invariant de somme 1 sur chaque marché", () => {
    const { bundle } = buildBundle("football", footballPayload, "m1");
    for (const m of bundle?.markets ?? []) {
      const sum = m.outcomes.reduce((a, o) => a + o.prob, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  test("hockey : bundle null + raison SPÉCIFIQUE", () => {
    const { bundle, reason } = buildBundle(
      "hockey",
      { matches: [{ id: "h1", isLive: true, homeName: "A", awayName: "B" }] },
      "h1"
    );
    expect(bundle).toBeNull();
    expect(reason).toContain("période");
  });

  test("snooker : bundle null + raison SPÉCIFIQUE", () => {
    const { bundle, reason } = buildBundle(
      "snooker",
      { matches: [{ id: "s1", scoreA: 3, scoreB: 2, bestOf: 11 }] },
      "s1"
    );
    expect(bundle).toBeNull();
    expect(reason).toContain("frames");
  });

  test("flux vide → raison explicite", () => {
    const { bundle, reason } = buildBundle("football", { matches: [] }, null);
    expect(bundle).toBeNull();
    expect(reason).toContain("Aucun match live");
  });

  test("sport inconnu → raison explicite", () => {
    const { bundle, reason } = buildBundle("rugby", {}, null);
    expect(bundle).toBeNull();
    expect(reason).toContain("non pris en charge");
  });

  test("baseball complet → bundle baseball", () => {
    const { bundle } = buildBundle(
      "baseball",
      {
        liveGames: [
          {
            gamePk: 715,
            inning: 7,
            half: "top",
            outs: 1,
            bases: 5,
            balls: 2,
            strikes: 1,
            homeRuns: 3,
            awayRuns: 1,
          },
        ],
      },
      "715"
    );
    expect(bundle?.sport).toBe("baseball");
    expect(bundle?.markets.length).toBeGreaterThan(3);
  });

  test("déterminisme : même payload → même bundle", () => {
    const a = buildBundle("football", footballPayload, "m1").bundle;
    const b = buildBundle("football", footballPayload, "m1").bundle;
    expect(a).toEqual(b);
  });
});