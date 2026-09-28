// Tests du moteur de backtest tennis — 9 marchés × segments
// (surface / Hommes-Femmes / type de tournoi / bande de cote).
//
// Données 100 % synthétiques et déterministes : 54 matchs valides générés par
// index (surface, tournoi, genre, bande de cote et issue maîtrisés) suivis de
// 4 lignes invalides (cote absente, cotes hors bornes, score d'abandon).
// Les attendus n / hit / ROI sont recalculés à la main dans le test.
import { describe, expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import {
  MIN_SAMPLE,
  MIN_SEGMENT_MATCHS,
  TENNIS_BT_BANDS,
  TENNIS_BT_MARKETS,
  computeTennisBacktestMatrix,
  loadTennisBtRows,
  marketOdds,
  parseTennisBtRow,
  parseTennisScore,
  settleMarket,
  tennisGenderOf,
  tennisTierOf,
} from "../tennis-backtest-matrix";
import type { TennisBtRow } from "../tennis-backtest-matrix";

type Score = NonNullable<ReturnType<typeof parseTennisScore>>;
type Match = NonNullable<ReturnType<typeof parseTennisBtRow>>;

const DAY = 86_400_000;
const NOW = Date.now();
const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// ─── parseTennisScore ────────────────────────────────────────────────────────

/** Parse attendu NON null (échec = throw explicite plutôt que `!`). */
function ps(score: string, sw: number | null, sl: number | null): Score {
  const s = parseTennisScore(score, sw, sl);
  if (!s) throw new Error(`parseTennisScore("${score}") = null (attendu : valide)`);
  return s;
}

describe("parseTennisScore", () => {
  test("(a) « 7-6 3-6 4-6 » avec colonnes (1,2) → valide, sets et jeux corrects", () => {
    const s = ps("7-6 3-6 4-6", 1, 2);
    expect(s.setsP1).toBe(1);
    expect(s.setsP2).toBe(2);
    expect(s.setsPlayed).toBe(3);
    expect(s.gamesP1).toBe(14); // 7 + 3 + 4
    expect(s.gamesP2).toBe(18); // 6 + 6 + 6
    expect(s.firstSetP1Won).toBe(true);
  });

  test("(b) « 6-3 6-0 » (2,0) → valide, total 15 jeux", () => {
    const s = ps("6-3 6-0", 2, 0);
    expect(s.setsPlayed).toBe(2);
    expect(s.gamesP1).toBe(12);
    expect(s.gamesP2).toBe(3);
    expect(s.gamesP1 + s.gamesP2).toBe(15);
    expect(s.firstSetP1Won).toBe(true);
  });

  test("(c) abandon « 2-6 0-3 » (dernière set incomplète) → null", () => {
    expect(parseTennisScore("2-6 0-3", 0, 2)).toBeNull();
    expect(parseTennisScore("6-3 0-2", 1, 0)).toBeNull();
  });

  test("(d) « 3-0 » (0,0) → null", () => {
    expect(parseTennisScore("3-0", 0, 0)).toBeNull();
  });

  test("(e) score incohérent avec les colonnes → null", () => {
    // Le score dit 2-0 pour le joueur 1, la colonne dit 1-0.
    expect(parseTennisScore("6-3 6-0", 1, 0)).toBeNull();
    // Colonnes absentes.
    expect(parseTennisScore("6-3 6-0", null, 0)).toBeNull();
    expect(parseTennisScore("6-3 6-0", 2, null)).toBeNull();
  });

  test("(f) tie-break entre parenthèses « 7-6(5) » toléré", () => {
    const s = ps("7-6(5) 6-4", 2, 0);
    expect(s.setsPlayed).toBe(2);
    expect(s.gamesP1).toBe(13); // 7 + 6
    expect(s.gamesP2).toBe(10); // 6 + 4
  });

  test("(g) score null / « W/O » / « RET » → null", () => {
    expect(parseTennisScore(null, 1, 0)).toBeNull();
    expect(parseTennisScore(undefined, 1, 0)).toBeNull();
    expect(parseTennisScore("W/O", 0, 0)).toBeNull();
    expect(parseTennisScore("RET", 0, 0)).toBeNull();
  });

  test("(h) match non décidé (colonnes égales ou score équilibré) → null", () => {
    expect(parseTennisScore("6-3 4-6", 1, 1)).toBeNull(); // un set partout
    expect(parseTennisScore("6-3 6-0", 1, 1)).toBeNull(); // colonnes égales
  });
});

// ─── tennisGenderOf ──────────────────────────────────────────────────────────

describe("tennisGenderOf", () => {
  test("marqueurs femmes : Women / WTA / Billie Jean King / Wxx (tour ATP faux)", () => {
    expect(tennisGenderOf("UTR PTT Saitama Women 01", "ATP")).toBe("F");
    expect(tennisGenderOf("WTA 1000 Rome", "WTA")).toBe("F");
    expect(tennisGenderOf("Billie Jean King Cup", "ATP")).toBe("F");
    expect(tennisGenderOf("UTR Newport Beach W06", "ATP")).toBe("F");
  });

  test("marqueurs hommes : Men / Davis Cup / Mxx (le marqueur bat `tour`)", () => {
    expect(tennisGenderOf("Wimbledon, Men", "WTA")).toBe("M");
    expect(tennisGenderOf("Davis Cup", "WTA")).toBe("M");
    expect(tennisGenderOf("UTR Cordoba M02", "WTA")).toBe("M");
  });

  test("fallback colonne `tour` quand aucun marqueur de nom", () => {
    expect(tennisGenderOf("Roland Garros", "WTA")).toBe("F");
    expect(tennisGenderOf("Barcelona", "ATP")).toBe("M");
  });
});

// ─── tennisTierOf ────────────────────────────────────────────────────────────

describe("tennisTierOf", () => {
  test("qualifications : prioritaire sur toutes les autres règles", () => {
    expect(tennisTierOf("Barcelona", "Qualification Round 1")).toBe("Qualifications");
    expect(tennisTierOf("Roland Garros", "Qualifications")).toBe("Qualifications");
  });

  test("Grand Chelem et segment juniors / handisport", () => {
    expect(tennisTierOf("Roland Garros", "Final")).toBe("Grand Chelem");
    expect(tennisTierOf("Roland Garros, Boys", "Final")).toBe("Juniors / Handisport");
  });

  test("Masters 1000 / WTA 1000 : marqueur, liste exacte et « WTA 1000 »", () => {
    expect(tennisTierOf("ATP Madrid Masters", "Final")).toBe("Masters 1000 / WTA 1000");
    expect(tennisTierOf("Miami", "Final")).toBe("Masters 1000 / WTA 1000");
    expect(tennisTierOf("WTA 1000 Rome", "Final")).toBe("Masters 1000 / WTA 1000");
  });

  test("autres segments : UTR, Challenger/125K, tour 250/500, coupe d'équipe", () => {
    expect(tennisTierOf("UTR PTT Saitama Women 01", "Final")).toBe("UTR Pro Series");
    expect(tennisTierOf("ATP Challenger Asuncion 2, Paraguay Men Singles", "Final")).toBe(
      "Challenger / 125K",
    );
    expect(tennisTierOf("WTA 125K Oeiras 3, Portugal Women Singles", "Final")).toBe(
      "Challenger / 125K",
    );
    expect(tennisTierOf("Barcelona", "Final")).toBe("Tour 250/500 & ITF");
    expect(tennisTierOf("Billie Jean King Cup", "Final")).toBe("Coupe d'équipe");
  });
});

// ─── parseTennisBtRow ────────────────────────────────────────────────────────

const BASE_ROW: TennisBtRow = {
  match_date: NOW,
  tourney_name: "Barcelona",
  tour: "ATP",
  surface: "Hard",
  round: "Final",
  score: "6-3 6-0",
  sets_winner: 2,
  sets_loser: 0,
  odds_player1: 1.3,
  odds_player2: 4.5,
};

function row(over: Partial<TennisBtRow>): TennisBtRow {
  return { ...BASE_ROW, ...over };
}

/** Construit un match valide (échec du parsing = throw, pas de `!`). */
function mk(over: Partial<TennisBtRow> = {}): Match {
  const m = parseTennisBtRow(row(over));
  if (!m) throw new Error("parseTennisBtRow a rejeté une ligne censée être valide");
  return m;
}

describe("parseTennisBtRow", () => {
  test("(a) cotes invalides (null, 1.0, >100) → null", () => {
    expect(parseTennisBtRow(row({ odds_player1: null }))).toBeNull();
    expect(parseTennisBtRow(row({ odds_player2: null }))).toBeNull();
    expect(parseTennisBtRow(row({ odds_player1: 1.0 }))).toBeNull();
    expect(parseTennisBtRow(row({ odds_player1: 101 }))).toBeNull();
    expect(parseTennisBtRow(row({ odds_player2: 100.5 }))).toBeNull();
  });

  test("(b) ligne valide → favori = cote la plus basse, bande b2, favWon", () => {
    const m = mk({
      odds_player1: 1.2,
      odds_player2: 4.5,
      score: "6-3 6-1",
      sets_winner: 2,
      sets_loser: 0,
    });
    expect(m.favWon).toBe(true);
    expect(m.favOdds).toBe(1.2);
    expect(m.dogOdds).toBe(4.5);
    expect(m.band.key).toBe("b2");
    expect(m.gamesFav).toBe(12); // 6 + 6
    expect(m.gamesDog).toBe(4); // 3 + 1
    expect(m.winnerLostSets).toBe(0);
    expect(m.firstSetFavWon).toBe(true);
    expect(m.surface).toBe("Dur");
    expect(m.gender).toBe("M");
    expect(m.tier).toBe("Tour 250/500 & ITF");
  });

  test("(c) favoriextérieur (p2) dont le match est perdu par p1 → favWon true", () => {
    const m = mk({
      odds_player1: 4.2,
      odds_player2: 1.15,
      score: "7-6 3-6 4-6",
      sets_winner: 1,
      sets_loser: 2,
    });
    expect(m.favWon).toBe(true); // p1 perd → le favori (p2) a gagné
    expect(m.favOdds).toBe(1.15);
    expect(m.dogOdds).toBe(4.2);
    expect(m.band.key).toBe("b1");
    expect(m.gamesFav).toBe(18); // sets du p2
    expect(m.gamesDog).toBe(14); // sets du p1
    expect(m.winnerLostSets).toBe(1);
  });

  test("(d) bandes de cote du favori : 1,15 / 1,35 / 1,8 / 2,5 / 3,2", () => {
    const band = (fav: number): string => mk({ odds_player1: fav, odds_player2: 9 }).band.key;
    expect(band(1.15)).toBe("b1");
    expect(band(1.35)).toBe("b2");
    expect(band(1.8)).toBe("b3");
    expect(band(2.5)).toBe("b4");
    expect(band(3.2)).toBe("b5");
  });
});

// ─── settleMarket ────────────────────────────────────────────────────────────

describe("settleMarket", () => {
  test("favMl et dogMl sont strictement complémentaires", () => {
    // Favori (p1 @1,30) qui gagne son match 2-0.
    expect(settleMarket("favMl", mk({}))).toBe(true);
    expect(settleMarket("dogMl", mk({}))).toBe(false);
    // Outsidér (@1,25 côté p2) qui perd → le favori perd aussi le pari.
    const upset = mk({
      odds_player1: 6.0,
      odds_player2: 1.25,
      score: "6-3 6-4",
      sets_winner: 2,
      sets_loser: 0,
    });
    expect(settleMarket("favMl", upset)).toBe(false);
    expect(settleMarket("dogMl", upset)).toBe(true);

    const samples: Partial<TennisBtRow>[] = [
      {},
      { score: "6-2 4-6 6-3", sets_winner: 2, sets_loser: 1 },
      { score: "4-6 7-5 6-4", sets_winner: 2, sets_loser: 1 },
      { odds_player1: 6.0, odds_player2: 1.25, score: "6-3 6-4", sets_winner: 2, sets_loser: 0 },
      { odds_player1: 1.05, odds_player2: 9.5, score: "7-6 6-7 7-6", sets_winner: 2, sets_loser: 1 },
    ];
    for (const over of samples) {
      const m = mk(over);
      expect(settleMarket("favMl", m)).toBe(!settleMarket("dogMl", m));
    }
  });

  test("favStraight : 2-0 → true, 2-1 → false, favori battu → false", () => {
    expect(settleMarket("favStraight", mk({}))).toBe(true); // 6-3 6-0
    expect(
      settleMarket("favStraight", mk({ score: "6-2 4-6 6-3", sets_winner: 2, sets_loser: 1 })),
    ).toBe(false);
    const upset = mk({
      odds_player1: 6.0,
      odds_player2: 1.25,
      score: "6-3 6-4",
      sets_winner: 2,
      sets_loser: 0,
    });
    expect(settleMarket("favStraight", upset)).toBe(false);
  });

  test("firstSetFav : suit le1er set du favori, pas le vainqueur du match", () => {
    expect(settleMarket("firstSetFav", mk({}))).toBe(true); // favori p1 prend 6-3
    expect(
      settleMarket("firstSetFav", mk({ score: "4-6 6-3 6-2", sets_winner: 2, sets_loser: 1 })),
    ).toBe(false); // favori p1 perd le 1er set
    // Favori p2 qui prend le 1er set puis perd le match.
    const favLoses = mk({
      odds_player1: 6.0,
      odds_player2: 1.25,
      score: "4-6 7-5 6-4",
      sets_winner: 2,
      sets_loser: 1,
    });
    expect(settleMarket("firstSetFav", favLoses)).toBe(true);
    expect(settleMarket("favMl", favLoses)).toBe(false);
  });

  test("doubleFav = 1er set favori ET match favori", () => {
    expect(settleMarket("doubleFav", mk({}))).toBe(true);
    // Favori p1 perd le 1er set mais gagne le match.
    const comeback = mk({ score: "4-6 6-3 6-2", sets_winner: 2, sets_loser: 1 });
    expect(settleMarket("firstSetFav", comeback)).toBe(false);
    expect(settleMarket("favMl", comeback)).toBe(true);
    expect(settleMarket("doubleFav", comeback)).toBe(false);
    // Favori p2 prend le 1er set mais perd le match.
    const favLoses = mk({
      odds_player1: 6.0,
      odds_player2: 1.25,
      score: "4-6 7-5 6-4",
      sets_winner: 2,
      sets_loser: 1,
    });
    expect(settleMarket("doubleFav", favLoses)).toBe(false);
  });

  test("over2_5sets : 3 sets → true, 2 sets → false", () => {
    expect(
      settleMarket("over2_5sets", mk({ score: "6-2 4-6 6-3", sets_winner: 2, sets_loser: 1 })),
    ).toBe(true);
    expect(settleMarket("over2_5sets", mk({}))).toBe(false);
  });

  test("over215 / under215 : seuil à 21,5 jeux (total 20/21 vs 22/24)", () => {
    const cases: Array<[string, number, boolean]> = [
      // score, total jeux, expectedOver
      ["6-4 6-4", 20, false],
      ["7-5 6-3", 21, false], // 21 < 21,5 → under
      ["7-5 6-4", 22, true], // 22 > 21,5 → over
      ["7-5 7-5", 24, true],
    ];
    for (const [score, total, over] of cases) {
      const m = mk({ score, sets_winner: 2, sets_loser: 0 });
      expect(m.score.gamesP1 + m.score.gamesP2).toBe(total);
      expect(settleMarket("over215", m)).toBe(over);
      expect(settleMarket("under215", m)).toBe(!over);
    }
  });

  test("favGamesHcp (−3,5) : marge ≥ 4 jeux, sinon false", () => {
    // Favori p1 : 13-9 → marge 4 ; 13-10 → marge 3.
    expect(settleMarket("favGamesHcp", mk({ score: "6-4 7-5", sets_winner: 2, sets_loser: 0 })))
      .toBe(true);
    expect(settleMarket("favGamesHcp", mk({ score: "6-4 7-6", sets_winner: 2, sets_loser: 0 })))
      .toBe(false);
    // Favori battu → marge négative.
    const upset = mk({
      odds_player1: 6.0,
      odds_player2: 1.25,
      score: "6-3 6-4",
      sets_winner: 2,
      sets_loser: 0,
    });
    expect(settleMarket("favGamesHcp", upset)).toBe(false);
  });

  test("clé de marché inconnue → null (non applicable)", () => {
    expect(settleMarket("inconnu", mk({}))).toBeNull();
    expect(settleMarket("", mk({}))).toBeNull();
  });

  test("les 9 marchés déclarés sont tous réglables sur un match valide", () => {
    const m = mk({});
    expect(TENNIS_BT_MARKETS).toHaveLength(9);
    for (const def of TENNIS_BT_MARKETS) {
      expect(settleMarket(def.key, m)).not.toBeNull();
      expect(marketOdds(def.key, m)).toBeGreaterThan(1);
    }
  });
});

// ─── marketOdds ──────────────────────────────────────────────────────────────

describe("marketOdds", () => {
  const m = mk({ odds_player1: 1.3, odds_player2: 4.5 });

  test("moneyline : cote RÉELLE du favori et de l'outsider", () => {
    expect(marketOdds("favMl", m)).toBe(1.3);
    expect(marketOdds("dogMl", m)).toBe(4.5);
  });

  test("marchés simulés : cotes fixes 1xbet", () => {
    expect(marketOdds("over215", m)).toBe(1.9);
    expect(marketOdds("under215", m)).toBe(1.9);
    expect(marketOdds("favStraight", m)).toBe(1.65);
    expect(marketOdds("firstSetFav", m)).toBe(1.45);
    expect(marketOdds("doubleFav", m)).toBe(1.35);
    expect(marketOdds("over2_5sets", m)).toBe(2.0);
    expect(marketOdds("favGamesHcp", m)).toBe(1.87);
  });
});

// ─── Constantes exportées ────────────────────────────────────────────────────

describe("TENNIS_BT_MARKETS / TENNIS_BT_BANDS / seuils", () => {
  test("9 marchés, clés uniques, groupes valides, 2 réels / 7 simulés", () => {
    expect(TENNIS_BT_MARKETS).toHaveLength(9);
    const keys = TENNIS_BT_MARKETS.map((mkDef) => mkDef.key);
    expect(new Set(keys).size).toBe(9);
    for (const def of TENNIS_BT_MARKETS) {
      expect(["moneyline", "sets", "jeux"]).toContain(def.group);
      expect(def.label.length).toBeGreaterThan(0);
      if (def.oddsKind === "simulated") expect(def.odds).toBeGreaterThan(1);
      else expect(def.odds).toBeNull();
    }
    expect(TENNIS_BT_MARKETS.filter((d) => d.oddsKind === "real")).toHaveLength(2);
    expect(TENNIS_BT_MARKETS.filter((d) => d.oddsKind === "simulated")).toHaveLength(7);
    expect(keys.filter((k) => k.endsWith("Ml"))).toEqual(["favMl", "dogMl"]);
  });

  test("5 bandes contiguës couvrant [1,0 ; ∞[", () => {
    expect(TENNIS_BT_BANDS).toHaveLength(5);
    expect(TENNIS_BT_BANDS.map((b) => b.key)).toEqual(["b1", "b2", "b3", "b4", "b5"]);
    expect(TENNIS_BT_BANDS[0].min).toBe(1.0);
    expect(TENNIS_BT_BANDS[4].max).toBe(Infinity);
    for (let i = 1; i < TENNIS_BT_BANDS.length; i++) {
      expect(TENNIS_BT_BANDS[i].min).toBe(TENNIS_BT_BANDS[i - 1].max);
    }
  });

  test("seuils exportés", () => {
    expect(MIN_SAMPLE).toBe(30);
    expect(MIN_SEGMENT_MATCHS).toBe(20);
  });
});

// ─── computeTennisBacktestMatrix ─────────────────────────────────────────────
//
// Générateur :54 matchs valides (idx 0..53) + 4 invalides.
//   surfaces : Hard 0-27 (28) · Clay 28-47 (20) · Grass 48-52 (5) · Carpet 53 (1)
//   tournois : Roland Garros 0-19 · ATP Madrid 20-29 · WTA Rome 30-39 ·
//              Barcelona 40-49 · UTR 50-53
//   genre    : M 0-29 (30) · F 30-53 (24)
//   bandes   : b2 0-23 (24) · b3 24-43 (20) · b4 44-49 (6) · b5 50-53 (4)
//   issue    : favori gagne idx ≤ 43 (44) · outsider gagne idx ≥ 44 (10)
type ScoreTpl = { score: string; sw: number; sl: number };

const P1_WINS: ScoreTpl[] = [
  { score: "6-3 6-0", sw: 2, sl: 0 },
  { score: "6-4 6-2", sw: 2, sl: 0 },
  { score: "7-5 6-4", sw: 2, sl: 0 },
  { score: "6-2 4-6 6-3", sw: 2, sl: 1 },
];
const P1_LOSES: ScoreTpl[] = [
  { score: "3-6 4-6", sw: 0, sl: 2 },
  { score: "4-6 6-7", sw: 0, sl: 2 },
  { score: "6-7 3-6", sw: 0, sl: 2 },
  { score: "6-4 3-6 2-6", sw: 1, sl: 2 },
];
const ROUNDS = ["Final", "Semifinal", "Quarterfinal", "Round of 16", "Round of 32"];
const DOG_BY_FAV: Record<string, number> = {
  "1.25": 4.2,
  "1.4": 3.6,
  "1.55": 3.1,
  "1.85": 2.7,
  "2.2": 2.9,
  "2.6": 3.3,
  "3.2": 4.1,
  "3.8": 5.2,
};

function metaOf(idx: number): { tourney: string; tour: string } {
  if (idx < 20) return { tourney: "Roland Garros", tour: "ATP" };
  if (idx < 30) return { tourney: "ATP Madrid Masters", tour: "ATP" };
  if (idx < 40) return { tourney: "WTA 1000 Rome", tour: "WTA" };
  if (idx < 50) return { tourney: "Barcelona", tour: "WTA" };
  return { tourney: "UTR Newport Beach W06", tour: "WTA" };
}

function surfaceOf(idx: number): string {
  if (idx < 28) return "Hard";
  if (idx < 48) return "Clay";
  if (idx < 53) return "Grass";
  return "Carpet";
}

/** Cote du favori par bande (b2 : idx<24, b3 : idx<44, b4 : idx<50, b5 : sinon). */
function favOddsOf(idx: number): number {
  if (idx < 24) return idx % 2 === 0 ? 1.25 : 1.4;
  if (idx < 44) return idx % 2 === 0 ? 1.55 : 1.85;
  if (idx < 50) return idx % 2 === 0 ? 2.2 : 2.6;
  return idx % 2 === 0 ? 3.2 : 3.8;
}

function buildRows(): TennisBtRow[] {
  const rows: TennisBtRow[] = [];
  for (let idx = 0; idx < 54; idx++) {
    const { tourney, tour } = metaOf(idx);
    const favIsP1 = idx % 2 === 0;
    const favWon = idx <= 43; // 44 favoris gagnants, 10 outsiders gagnants
    const p1Won = favIsP1 ? favWon : !favWon; // `score` est écrit côté joueur 1
    const tpl = p1Won ? P1_WINS[idx % 4] : P1_LOSES[idx % 4];
    const fav = favOddsOf(idx);
    const dog = DOG_BY_FAV[String(fav)];
    rows.push({
      // idx 0 = il y a 60 j (exclu en d30) ; le reste ≤ 24 j.
      match_date: idx === 0 ? NOW - 60 * DAY : NOW - (idx % 25) * DAY,
      tourney_name: tourney,
      tour,
      surface: surfaceOf(idx),
      round: ROUNDS[idx % ROUNDS.length],
      score: tpl.score,
      sets_winner: tpl.sw,
      sets_loser: tpl.sl,
      odds_player1: favIsP1 ? fav : dog,
      odds_player2: favIsP1 ? dog : fav,
    });
  }
  const ref = rows[5];
  rows.push({ ...ref, match_date: NOW - 2 * DAY, odds_player1: null }); // cote absente
  rows.push({ ...ref, match_date: NOW - 3 * DAY, odds_player1: 1.0 }); // cote < 1,01
  rows.push({ ...ref, match_date: NOW - 4 * DAY, odds_player1: 101 }); // cote > 100
  rows.push({
    ...ref,
    match_date: NOW - 5 * DAY,
    score: "2-6 0-3", // abandon en cours de set
    sets_winner: 0,
    sets_loser: 2,
  });
  return rows;
}

const ROWS = buildRows();

// Attendus recalculés à la main.
const N_VALID = 54;
const N_FAV_WIN = 44;
// Σ cotes favori sur les54 matchs (12×1,25 + 12×1,4 + 10×1,55 + 10×1,85
// + 3×2,2 + 3×2,6 + 2×3,2 + 2×3,8) = 94,2
const SUM_FAV_ODDS =
  12 * 1.25 + 12 * 1.4 + 10 * 1.55 + 10 * 1.85 + 3 * 2.2 + 3 * 2.6 + 2 * 3.2 + 2 * 3.8;
// Versements moneyline favori : seuls les favoris GAGNANTS versent (mise 1u)
// → Σ cotes des44 gagnants = b2 (31,8) + b3 (34,0) = 65,8
const RETURNED_FAV_ML = 12 * 1.25 + 12 * 1.4 + 10 * 1.55 + 10 * 1.85;
const ROI_FAV_ML = ((RETURNED_FAV_ML - N_VALID) / N_VALID) * 100; // ≈ 21,85 %

describe("computeTennisBacktestMatrix — structure", () => {
  const mx = computeTennisBacktestMatrix(ROWS);

  test("nRows / nValid cohérents (lignes invalides comptées en brut, exclues du valid)", () => {
    expect(mx.nRows).toBe(58); // 54 valides + 4 invalides
    expect(mx.nValid).toBe(N_VALID);
    expect(mx.window).toBe("full");
    expect(mx.from).toBe(dayOf(NOW - 60 * DAY));
    expect(mx.to).toBe(dayOf(NOW));
  });

  test("marchés, seuils, métadonnées", () => {
    expect(mx.markets.map((m) => m.key)).toEqual([
      "favMl",
      "dogMl",
      "favStraight",
      "firstSetFav",
      "doubleFav",
      "over2_5sets",
      "over215",
      "under215",
      "favGamesHcp",
    ]);
    expect(Object.keys(mx.global)).toHaveLength(9);
    expect(mx.thresholds).toEqual({ minSample: 30, goodEdge: 0.05, okEdge: -0.03 });
    expect(mx.source).toBe("tennis_matches_internal");
    expect(mx.simulatedOdds).toBe(true);
    expect(mx.methodology).toContain("tennis_matches_internal");
    expect(typeof mx.computedAt).toBe("string");
  });

  test("aucune ligne → structure vide sans crash", () => {
    const e = computeTennisBacktestMatrix([]);
    expect(e.nRows).toBe(0);
    expect(e.nValid).toBe(0);
    expect(e.from).toBeNull();
    expect(e.to).toBeNull();
    expect(Object.keys(e.global)).toHaveLength(0);
    expect(e.markets).toHaveLength(9);
    expect(e.dimensions).toHaveLength(4);
    for (const d of e.dimensions) expect(d.segments).toHaveLength(0);
  });

  test("uniquement des lignes invalides → nRows > 0 mais nValid = 0", () => {
    const onlyInvalid = ROWS.slice(54);
    const e = computeTennisBacktestMatrix(onlyInvalid);
    expect(e.nRows).toBe(4);
    expect(e.nValid).toBe(0);
    expect(Object.keys(e.global)).toHaveLength(0);
  });
});

describe("computeTennisBacktestMatrix — cellule globale favMl", () => {
  const mx = computeTennisBacktestMatrix(ROWS);

  test("n = matchs valides, hit = favoris gagnants / n, avgOdds recalculés", () => {
    const g = mx.global.favMl;
    expect(g.n).toBe(N_VALID);
    expect(g.wins).toBe(N_FAV_WIN);
    expect(g.hit).toBeCloseTo(N_FAV_WIN / N_VALID, 10);
    expect(g.avgOdds).toBeCloseTo(SUM_FAV_ODDS / N_VALID, 10);
    expect(g.sampleOk).toBe(true);
  });

  test("ROI = (retourné − misé) / misé × 100 avec retourné = Σ cotes des gagnants", () => {
    const g = mx.global.favMl;
    expect(g.roi).not.toBeNull();
    expect(g.roi as number).toBeCloseTo(ROI_FAV_ML, 6);
    expect(g.roi as number).toBeCloseTo(21.852, 3);
  });

  test("verdict 🟢 good : n ≥ 30 et hit − 1/cote ≥ +5 pts", () => {
    const g = mx.global.favMl;
    const edge = (g.hit as number) - 1 / (g.avgOdds as number);
    expect(edge).toBeGreaterThanOrEqual(0.05);
    expect(g.verdict).toBe("good");
  });

  test("outsider : même n que le favori mais wins complémentaires", () => {
    const dog = mx.global.dogMl;
    expect(dog.n).toBe(N_VALID);
    expect(dog.wins).toBe(N_VALID - N_FAV_WIN);
    expect(mx.global.favMl.wins + dog.wins).toBe(N_VALID);
  });

  test("over215 / under215 partitionnent tous les matchs (total entier)", () => {
    const over = mx.global.over215;
    const under = mx.global.under215;
    expect(over.n).toBe(N_VALID);
    expect(under.n).toBe(N_VALID);
    expect(over.wins + under.wins).toBe(N_VALID);
  });
});

describe("computeTennisBacktestMatrix — verdicts", () => {
  const mx = computeTennisBacktestMatrix(ROWS);

  test("segment ≥ 20 matchs mais < 30 paris → sampleOk false et verdict ⚪ low", () => {
    const dur = mx.dimensions[0].segments[0];
    expect(dur.label).toBe("Dur");
    expect(dur.nMatches).toBe(28);
    const cell = dur.cells.favMl;
    expect(cell.n).toBe(28);
    expect(cell.sampleOk).toBe(false);
    expect(cell.verdict).toBe("low");
  });

  test("segment avec n = 30 et hit parfait → verdict 🟢 good", () => {
    const hom = mx.dimensions[1].segments[0];
    expect(hom.label).toBe("Hommes");
    expect(hom.nMatches).toBe(30);
    const cell = hom.cells.favMl;
    expect(cell.n).toBe(30);
    expect(cell.sampleOk).toBe(true);
    expect(cell.hit).toBe(1);
    expect(cell.verdict).toBe("good");
  });
});

describe("computeTennisBacktestMatrix — dimensions et segments", () => {
  const mx = computeTennisBacktestMatrix(ROWS);

  test("4 dimensions présentes, clés et labels exacts", () => {
    expect(mx.dimensions.map((d) => d.key)).toEqual(["surface", "gender", "tier", "band"]);
    expect(mx.dimensions.map((d) => d.label)).toEqual([
      "Surface",
      "Hommes / Femmes",
      "Type de tournoi",
      "Bande de cote 1xbet (favori)",
    ]);
  });

  test("aucun segment sous MIN_SEGMENT_MATCHS (20) n'est affiché", () => {
    for (const d of mx.dimensions) {
      for (const s of d.segments) {
        expect(s.nMatches).toBeGreaterThanOrEqual(MIN_SEGMENT_MATCHS);
        expect(Object.keys(s.cells)).toHaveLength(9);
      }
    }
  });

  test("surface : segments triés du plus peuplé au moins peuplé", () => {
    const surface = mx.dimensions.find((d) => d.key === "surface");
    if (!surface) throw new Error("dimension Surface absente");
    expect(surface.segments.map((s) => s.label)).toEqual(["Dur", "Terre battue"]);
    expect(surface.segments.map((s) => s.nMatches)).toEqual([28, 20]);
    // Grass (5) et Carpet (1) : sous le seuil → absents.
    const labels = surface.segments.map((s) => s.label);
    expect(labels).not.toContain("Gazon");
    expect(labels).not.toContain("Moquette");
    expect(labels.some((l) => l.includes("Carpet"))).toBe(false);
  });

  test("genre : Hommes (30) puis Femmes (24)", () => {
    const gender = mx.dimensions.find((d) => d.key === "gender");
    if (!gender) throw new Error("dimension genre absente");
    expect(gender.segments.map((s) => s.label)).toEqual(["Hommes", "Femmes"]);
    expect(gender.segments.map((s) => s.nMatches)).toEqual([30, 24]);
  });

  test("type de tournoi : ordre TIER_ORDER respecté (Grand Chelem en tête)", () => {
    const tier = mx.dimensions.find((d) => d.key === "tier");
    if (!tier) throw new Error("dimension type de tournoi absente");
    // Grand Chelem (20) et Masters (20) à égalité → le rang TIER_ORDER tranche.
    expect(tier.segments.map((s) => s.label)).toEqual([
      "Grand Chelem",
      "Masters 1000 / WTA 1000",
    ]);
    expect(tier.segments.map((s) => s.nMatches)).toEqual([20, 20]);
    // Tour 250 (10) et UTR (4) : sous le seuil.
    expect(tier.segments.map((s) => s.label)).not.toContain("Tour 250/500 & ITF");
    expect(tier.segments.map((s) => s.label)).not.toContain("UTR Pro Series");
  });

  test("bandes : seules b2 (24) et b3 (20) passent le seuil, ordre décroissant", () => {
    const band = mx.dimensions.find((d) => d.key === "band");
    if (!band) throw new Error("dimension bande absente");
    expect(band.segments.map((s) => s.key)).toEqual(["b2", "b3"]);
    expect(band.segments.map((s) => s.nMatches)).toEqual([24, 20]);
    for (const s of band.segments) {
      const def = TENNIS_BT_BANDS.find((b) => b.key === s.key);
      if (!def) throw new Error(`bande ${s.key} absente de TENNIS_BT_BANDS`);
      expect(s.label).toBe(def.label);
    }
  });
});

describe("computeTennisBacktestMatrix — fenêtre d30", () => {
  const full = computeTennisBacktestMatrix(ROWS, "full");
  const d30 = computeTennisBacktestMatrix(ROWS, "d30");

  test("la ligne datée d'il y a 60 jours est exclue, les récentes incluses", () => {
    expect(d30.window).toBe("d30");
    expect(full.nRows).toBe(58);
    expect(d30.nRows).toBe(57);
    expect(full.nValid).toBe(54);
    expect(d30.nValid).toBe(53);
    expect(full.from).toBe(dayOf(NOW - 60 * DAY));
    expect(d30.from).not.toBe(dayOf(NOW - 60 * DAY));
    expect(d30.from).toBe(dayOf(NOW - 24 * DAY)); // plus vieille ligne conservée
    expect(d30.to).toBe(dayOf(NOW));
  });

  test("statistiques recalculées sur la fenêtre glissante", () => {
    expect(d30.global.favMl.n).toBe(53);
    expect(d30.global.favMl.wins).toBe(43); // le match exclu était une victoire de favori
    // Retourné : 65,8 − 1,25 (cote du favori du match exclu) ; misé : 53.
    expect(d30.global.favMl.roi as number).toBeCloseTo(((65.8 - 1.25 - 53) / 53) * 100, 6);
    expect(d30.global.favMl.verdict).toBe("good");
  });
});

// ─── loadTennisBtRows ────────────────────────────────────────────────────────

describe("loadTennisBtRows", () => {
  test("base absente → tableau vide (dégradation propre, jamais de crash)", () => {
    const prev = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = path.join(os.tmpdir(), `pariscore-test-absent-${process.pid}.db`);
    try {
      const rows = loadTennisBtRows();
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toHaveLength(0);
    } finally {
      if (prev === undefined) delete process.env.DATABASE_PATH;
      else process.env.DATABASE_PATH = prev;
    }
  });
});

// ─── Régressions de revue (2026-09-28) ──────────────────────────────────────

describe("fenêtre d30 entièrement vide (imports plus anciens que 30 j)", () => {
  test("nValid 0 / from-to null sans crash, full reste peuplé", () => {
    const old: TennisBtRow[] = Array.from({ length: 5 }, (_, i) =>
      row({ match_date: NOW - (45 + i) * DAY }),
    );
    const d30 = computeTennisBacktestMatrix(old, "d30");
    expect(d30.nRows).toBe(0);
    expect(d30.nValid).toBe(0);
    expect(d30.from).toBeNull();
    expect(d30.to).toBeNull();
    const full = computeTennisBacktestMatrix(old, "full");
    expect(full.nValid).toBe(5);
  });
});

describe("bandes de cote — bornes exactes (filtres moneyline 1xbet)", () => {
  test("1,19 → <1,20 · 1,20 → 1,20-1,49 · 1,50 → 1,50-1,99 · 2,00 → 2,00-2,99 · 3,00 → 3,00+", () => {
    const bandAt = (o1: number) => {
      const m = parseTennisBtRow(row({ odds_player1: o1, odds_player2: 9.9 }));
      if (!m) throw new Error(`ligne rejetée pour cote ${o1}`);
      return m.band;
    };
    expect(bandAt(1.19)).toEqual({ key: "b1", label: "< 1,20" });
    expect(bandAt(1.2)).toEqual({ key: "b2", label: "1,20 – 1,49" });
    expect(bandAt(1.5)).toEqual({ key: "b3", label: "1,50 – 1,99" });
    expect(bandAt(2.0)).toEqual({ key: "b4", label: "2,00 – 2,99" });
    expect(bandAt(3.0)).toEqual({ key: "b5", label: "3,00 et +" });
  });
});

describe("verdict aligné sur la cote implicite MOYENNE (biais de Jensen)", () => {
  // 40 matchs : 24 @1,20 (favori gagne 22) + 16 @1,667 (favori gagne 6).
  // favMl : hit 70 % vs implicite moyenne 74 % → edge −4 pts = « Sous seuil »
  // (l'ancien 1/coteMoyenne donnait −2,1 pts = « Norme » alors que le ROI est
  // négatif). dogMl : hit 30 % vs implicite 33,2 % → « Sous seuil » (ROI −25 %).
  function verdictRows(): TennisBtRow[] {
    const out: TennisBtRow[] = [];
    const push = (n: number, over: Partial<TennisBtRow>) => {
      for (let i = 0; i < n; i++) out.push(row({ match_date: NOW - i * 60_000, ...over }));
    };
    push(22, {
      odds_player1: 1.2,
      odds_player2: 4.0,
      score: "6-3 6-4",
      sets_winner: 2,
      sets_loser: 0,
    });
    push(2, {
      odds_player1: 1.2,
      odds_player2: 4.0,
      score: "3-6 4-6",
      sets_winner: 0,
      sets_loser: 2,
    });
    push(6, {
      odds_player1: 1.667,
      odds_player2: 2.2,
      score: "6-4 7-5",
      sets_winner: 2,
      sets_loser: 0,
    });
    push(10, {
      odds_player1: 1.667,
      odds_player2: 2.2,
      score: "4-6 6-7",
      sets_winner: 0,
      sets_loser: 2,
    });
    return out;
  }

  test("favMl : ROI négatif ⇒ verdict Sous seuil (et pas Norme)", () => {
    const c = computeTennisBacktestMatrix(verdictRows(), "full").global.favMl;
    expect(c.n).toBe(40);
    expect(c.hit).toBeCloseTo(0.7, 6);
    expect(c.roi as number).toBeLessThan(0);
    expect(c.verdict).toBe("bad");
  });

  test("dogMl : hit 30 % sous implicite 33,2 % ⇒ Sous seuil (ROI −25 %)", () => {
    const c = computeTennisBacktestMatrix(verdictRows(), "full").global.dogMl;
    expect(c.n).toBe(40);
    expect(c.hit).toBeCloseTo(0.3, 6);
    expect(c.roi as number).toBeLessThan(0);
    expect(c.verdict).toBe("bad");
  });
});

describe("score super tie-break entre crochets", () => {
  test("« 6-3 [10-8] » accepté (dernière set max ≥ 6)", () => {
    const s = parseTennisScore("6-3 [10-8]", 2, 0);
    if (!s) throw new Error("parseTennisScore a rejeté [10-8]");
    expect(s.setsP1).toBe(2);
    expect(s.setsP2).toBe(0);
    expect(s.gamesP1).toBe(16);
    expect(s.gamesP2).toBe(11);
  });
});
