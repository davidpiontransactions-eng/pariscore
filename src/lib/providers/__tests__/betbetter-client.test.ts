import { describe, expect, test, afterEach } from "bun:test";

import {
  BETBETTER_ATTRIBUTION,
  BetBetterApiError,
  clearCache,
  compareWithDevig,
  getPicksFeed,
  getPredictedScores,
  type BetBetterPick,
} from "../betbetter-client";

// Payload réel observé le 2026-10-08 sur /soccer/epl/picks?format=json (truncated)
const PICKS_BODY = {
  site: "Bet Better",
  page: "https://betbetter.world/soccer/epl/picks",
  sport: "EPL",
  type: "picks",
  updatedUtc: "2026-10-08T20:23:34.0404947Z",
  licence: "CC BY 4.0 — free to use with attribution to Bet Better (https://betbetter.world)",
  attribution: "Bet Better — https://betbetter.world",
  docs: "https://betbetter.world/api/",
  disclaimer: "Model estimates for research. Not a guarantee. 18+. Please gamble responsibly.",
  count: 200,
  // typed pour que les spreads des tests ne widens pas confidence en string
  picks: [
    {
      game: "Everton @ Hull City",
      gameTimeUtc: "2026-10-11T13:00:00.0000000Z",
      market: "Spread",
      selection: "Hull City",
      line: 0.5,
      winProbabilityPct: 61.5,
      probabilityLabel: "our prediction",
      modelProbabilityPct: 61.5,
      fairOdds: 1.88,
      confidence: "LEAN" as const,
      verdict:
        "As of Oct 8, 2026, Bet Better's model rates Hull City a 61.5% chance to land, which is fair value at odds of 1.88. Confidence: LEAN.",
      locked: false,
      unlocksAtUtc: null,
    },
    {
      game: "Bournemouth @ Chelsea",
      gameTimeUtc: "2026-10-10T14:00:00.0000000Z",
      market: "Draw No Bet",
      selection: "Bournemouth",
      line: null,
      winProbabilityPct: 31.5,
      probabilityLabel: "our prediction",
      modelProbabilityPct: 31.5,
      fairOdds: 3.5,
      confidence: "LONG-SHOT" as const,
      verdict: "As of Oct 8, 2026, Bet Better's model rates Bournemouth a 31.5% chance to land. Confidence: LONG-SHOT.",
      locked: false,
      unlocksAtUtc: null,
    },
    {
      // pick payant : selection/confidence vides, nombres null (docs)
      game: "Arsenal @ Liverpool",
      gameTimeUtc: "2026-10-18T16:30:00.0000000Z",
      market: "Head to Head",
      selection: "",
      line: null,
      modelProbabilityPct: null,
      fairOdds: null,
      confidence: "" as const,
      verdict: "",
      locked: true,
      unlocksAtUtc: "2026-10-18T16:30:00.0000000Z",
    },
  ],
};

// Payload réel observé le 2026-10-08 sur /predicted-scores/soccer?format=json
const EMPTY_PREDICTED_BODY = {
  sport: "soccer",
  source: "betbetter.world",
  page: "https://betbetter.world/predicted-scores/soccer",
  games: [],
};

let fetchCount = 0;

function mockFetch(status: number, body: unknown) {
  // @ts-expect-error — stub volontaire de l'API fetch dans les tests
  globalThis.fetch = async () => {
    fetchCount++;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
}

afterEach(() => {
  clearCache();
  fetchCount = 0;
});

describe("BetBetterClient", () => {
  test("getPicksFeed parse le payload (count, licence, picks typés) sans rien inventer", async () => {
    mockFetch(200, PICKS_BODY);
    const res = await getPicksFeed("soccer/epl");
    expect(res.sport).toBe("EPL");
    expect(res.count).toBe(200);
    expect(res.picks).toHaveLength(3);
    expect(res.picks[0]?.modelProbabilityPct).toBeCloseTo(61.5);
    expect(res.picks[0]?.fairOdds).toBeCloseTo(1.88);
    expect(res.picks[0]?.confidence).toBe("LEAN");
    expect(res.picks[2]?.modelProbabilityPct).toBeNull();
    expect(res.picks[2]?.locked).toBe(true);
    expect(res.licence).toContain("CC BY 4.0");
    // attribution dispo à la fois dans le payload et en constante exportée
    expect(res.attribution).toBe(BETBETTER_ATTRIBUTION);
  });

  test("cache 15 min : 2 appels sur le même feed = 1 seul fetch", async () => {
    mockFetch(200, PICKS_BODY);
    await getPicksFeed("soccer/epl");
    await getPicksFeed("soccer/epl");
    expect(fetchCount).toBe(1);
    // un feed différent re-fetch
    await getPicksFeed("soccer/ligue-1");
    expect(fetchCount).toBe(2);
  });

  test("réponse vide (hors saison) : picks: [] sans erreur — normal, pas un échec", async () => {
    mockFetch(200, { sport: "EPL", type: "picks", count: 0, picks: [] });
    const res = await getPicksFeed("soccer/epl");
    expect(res.picks).toHaveLength(0);
    expect(res.count).toBe(0);
  });

  test("getPredictedScores tolère games: [] (cas vide observé en live le 2026-10-08)", async () => {
    mockFetch(200, EMPTY_PREDICTED_BODY);
    const res = await getPredictedScores("soccer");
    expect(res.sport).toBe("soccer");
    expect(res.games).toHaveLength(0);
  });

  test("getPredictedScores parse les colonnes figées (home_margin, total, home_win_prob)", async () => {
    mockFetch(200, {
      sport: "nfl",
      games: [
        {
          date_utc: "2026-10-08",
          time_utc: "23:15",
          away_team: "Eagles",
          home_team: "Giants",
          pred_away_score: 27,
          pred_home_score: 21,
          home_margin: -6,
          total: 48,
          home_win_prob: 32.4,
        },
      ],
    });
    const res = await getPredictedScores("nfl");
    expect(res.games).toHaveLength(1);
    expect(res.games[0]?.home_margin).toBe(-6);
    expect(res.games[0]?.total).toBe(48);
    expect(res.games[0]?.home_win_prob).toBeCloseTo(32.4);
  });

  test("champ error du feed (doc valide, pas un 500) levé comme BetBetterApiError", async () => {
    mockFetch(200, { sport: "EPL", error: "no data for this league yet" });
    try {
      await getPicksFeed("soccer/epl");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BetBetterApiError);
      expect((err as BetBetterApiError).message).toContain("no data for this league yet");
    }
  });

  test("HTTP non-OK levé comme BetBetterApiError", async () => {
    mockFetch(500, null);
    try {
      await getPicksFeed("soccer/epl");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BetBetterApiError);
      expect((err as BetBetterApiError).message).toContain("500");
    }
  });
});

describe("compareWithDevig — cross-check model Bet Better vs dévig Pariscore", () => {
  const devig = { home: 45.0, draw: 27.5, away: 27.5 };
  const basePick = PICKS_BODY.picks[0]!;

  test("edge = modelProbabilityPct − devig du même côté ; aligne sous le seuil", () => {
    const r = compareWithDevig({ ...basePick, modelProbabilityPct: 47.2 }, devig, "home");
    expect(r.edgePct).toBeCloseTo(2.2);
    expect(r.edge).toBe("aligne");
    expect(r.marketProbabilityPct).toBeCloseTo(45.0);
  });

  test("écart ≥ +3 pts = value_externe (modèle externe au-dessus du marché)", () => {
    const r = compareWithDevig({ ...basePick, modelProbabilityPct: 49.5 }, devig, "home");
    expect(r.edgePct).toBeCloseTo(4.5);
    expect(r.edge).toBe("value_externe");
  });

  test("écart ≤ −3 pts = value_interne (notre dévig au-dessus du modèle externe)", () => {
    const r = compareWithDevig({ ...basePick, modelProbabilityPct: 38.0 }, devig, "home");
    expect(r.edgePct).toBeCloseTo(-7.0);
    expect(r.edge).toBe("value_interne");
  });

  test("pick verrouillé (modelProbabilityPct null) : edgePct null, jamais de valeur inventée", () => {
    const locked = PICKS_BODY.picks[2]!;
    const r = compareWithDevig(locked, devig, "home");
    expect(r.modelProbabilityPct).toBeNull();
    expect(r.edgePct).toBeNull();
    expect(r.edge).toBe("aligne");
  });
});
