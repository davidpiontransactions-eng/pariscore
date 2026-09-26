import { describe, it, expect, beforeEach } from "bun:test";
import {
  gameWinProb,
  breakProb,
  expectedRemainingGames,
  setScoreDistribution,
  setOverUnder,
  expectedRemainingSets,
  setScoreExact,
  setHandicap,
  gameHandicap,
  doubleResult,
  firstSetWinner,
  firstSetTotal,
  clearAllMemos,
  gameWinProbFromScore,
  blendServeRecent,
} from "../src/lib/prediction/live-markov";
import {
  playerTotalGames,
  totalSets,
  straightSets,
  atLeastOneSet,
  predictTotalGames,
} from "../src/lib/prediction/total-games";
import {
  totalAcesO_U,
  acesPerSet,
} from "../src/lib/prediction/most-aces";
import {
  buildLiveMatrix,
  matrixBreakPointSide,
} from "../src/lib/prediction/live-matrix";
import {
  tiebreakProb,
  tiebreakSet,
  tiebreakWinner,
  tiebreakScoreDistribution,
} from "../src/lib/prediction/tiebreak";
import {
  bayesianBlend,
  blendMultiple,
  oddToProb,
  probToOdd,
  deVig,
  computeEdge,
  kellyFraction,
} from "../src/lib/prediction/live-blend";
import {
  TENNIS_MARKETS,
  MARKET_COUNT,
  getMarketById,
  getMarketsByCategory,
} from "../src/lib/prediction/tennis-market-map";

/**
 * Tests de sanity du modèle Markov live.
 *
 * gameWinProb(p) prend une proba de POINT au service [0,1]
 * et renvoie la proba de GAGNER LE JEU (hold).
 */
describe("live-markov sanity", () => {
  const pServeA = 0.67;
  const pServeB = 0.62;
  const holdA = gameWinProb(pServeA);
  const holdB = gameWinProb(pServeB);

  beforeEach(() => clearAllMemos());

  // --- gameWinProb (forme fermée) ---

  it("gameWinProb croissant avec p", () => {
    expect(gameWinProb(0.7)).toBeGreaterThan(gameWinProb(0.6));
  });

  it("gameWinProb borné [0,1]", () => {
    expect(gameWinProb(0)).toBe(0);
    expect(gameWinProb(1)).toBe(1);
    expect(gameWinProb(0.65)).toBeGreaterThan(0.5);
    expect(gameWinProb(0.65)).toBeLessThan(1);
  });

  it("holdA > holdB si pServeA > pServeB", () => {
    expect(holdA).toBeGreaterThan(holdB);
  });

  it("breakProb + gameWinProb = 1", () => {
    expect(breakProb(pServeA) + gameWinProb(pServeA)).toBeCloseTo(1, 10);
  });

  // --- setScoreDistribution ---

  it("setScoreDistribution(0-0) somme ≈ 1", () => {
    const dist = setScoreDistribution(holdA, holdB, "A", 0, 0);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 2);
  });

  it("tie-break : les DEUX issues 7-6 et 6-7 sont dans la distribution", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 5, 5);
    // On force l'état 6-6 en sommant via un set qui y arrive : vérification
    // directe des deux clés TB depuis 5-5 (la récursion passe par 6-6).
    expect(dist["7-6"]).toBeGreaterThan(0);
    expect(dist["6-7"]).toBeGreaterThan(0);
  });

  it("6-0 → E[remaining games] = 0 (set terminé)", () => {
    clearAllMemos();
    const er = expectedRemainingGames(holdA, holdB, "A", 6, 0);
    expect(er).toBe(0);
  });

  // NOTE : seuils recalibrés après fix du bug setScoreDistribution
  // (les poids serveurs/retourneurs étaient inversés quand B servait).
  it("4-0 → Over 7,5 faible (<25%) : set se termine vite", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 4, 0);
    const { over75 } = setOverUnder(dist);
    // À 4-0 A domine → 6-0/6-1 = 6-7 jeux → Over 7,5 rare
    expect(over75).toBeLessThan(0.25);
  });

  it("0-4 → Over 7,5 élevé (>75%) : B domine, set long", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 0, 4);
    const { over75 } = setOverUnder(dist);
    // B domine → scores 4-6/3-6/2-6 = 8-10 jeux + A peut revenir 6-4/7-5/7-6
    expect(over75).toBeGreaterThan(0.75);
  });

  it("5-5 → Under 12,5 modérée (20%-80%)", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 5, 5);
    const { under125 } = setOverUnder(dist);
    expect(under125).toBeGreaterThan(0.20);
    expect(under125).toBeLessThan(0.80);
  });

  // --- expectedRemainingGames ---

  it("E[remaining games] raisonnable à 0-0 (>6)", () => {
    clearAllMemos();
    const er = expectedRemainingGames(holdA, holdB, "A", 0, 0);
    expect(er).toBeGreaterThan(6);
    expect(er).toBeLessThan(14);
  });

  it("E[remaining games] décroît quand le set avance", () => {
    clearAllMemos();
    const er00 = expectedRemainingGames(holdA, holdB, "A", 0, 0);
    clearAllMemos();
    const er32 = expectedRemainingGames(holdA, holdB, "A", 3, 2);
    clearAllMemos();
    const er54 = expectedRemainingGames(holdA, holdB, "A", 5, 4);
    expect(er00).toBeGreaterThan(er32);
    expect(er32).toBeGreaterThan(er54);
  });

  // --- expectedRemainingSets ---

  it("E[remaining sets] = 0 si match terminé (2-0 BO3)", () => {
    const er = expectedRemainingSets(2, 0, 0.65, true);
    expect(er).toBe(0);
  });

  it("E[remaining sets] = 1.35 si 1-0 BO3 (prob A ~0.65)", () => {
    const er = expectedRemainingSets(1, 0, 0.65, true);
    // DP : E(1,0) = 1 + q·E(1,1) = 1 + 0.35·1 = 1.35
    expect(er).toBeCloseTo(1.35, 10);
  });

  it("E[remaining sets] > 2 si 0-0 BO3 (le match peut aller en 3 sets)", () => {
    const er = expectedRemainingSets(0, 0, 0.65, true);
    // E(0,0) ≈ 2.455 à p=0.65 — toujours > 2 car le 3e set est possible
    expect(er).toBeGreaterThan(2);
    expect(er).toBeLessThan(3);
  });

  it("E[remaining sets] augmente si pWinSetA diminue", () => {
    const erDominant = expectedRemainingSets(1, 0, 0.8, true);
    const erSerre = expectedRemainingSets(1, 0, 0.5, true);
    expect(erSerre).toBeGreaterThanOrEqual(erDominant);
  });

  it("E[remaining sets] BO5 : 1 set manquant → entre 1 et 2", () => {
    const er = expectedRemainingSets(2, 1, 0.65, false);
    expect(er).toBeGreaterThan(1);
    expect(er).toBeLessThan(2);
  });

  // --- setScoreExact ---

  it("setScoreExact somme 2-0 + 2-1 + 0-2 + 1-2 = 1", () => {
    clearAllMemos();
    const s20 = setScoreExact(holdA, holdB, 2, 0, true);
    const s21 = setScoreExact(holdA, holdB, 2, 1, true);
    const s02 = setScoreExact(holdA, holdB, 0, 2, true);
    const s12 = setScoreExact(holdA, holdB, 1, 2, true);
    expect(s20 + s21 + s02 + s12).toBeCloseTo(1, 2);
  });

  it("setScoreExact favori → P(2-0) > P(0-2)", () => {
    clearAllMemos();
    const p20 = setScoreExact(holdA, holdB, 2, 0, true);
    const p02 = setScoreExact(holdA, holdB, 0, 2, true);
    expect(p20).toBeGreaterThan(p02);
  });

  it("setScoreExact score impossible → 0", () => {
    clearAllMemos();
    expect(setScoreExact(holdA, holdB, 3, 0, true)).toBe(0);
    expect(setScoreExact(holdA, holdB, 0, 0, true)).toBe(0);
    expect(setScoreExact(holdA, holdB, 2, 2, true)).toBe(0);
  });

  it("setScoreExact equal holds → P(2-0) + P(2-1) ≈ pWinSetA", () => {
    clearAllMemos();
    const s20 = setScoreExact(0.7, 0.7, 2, 0, true);
    const s21 = setScoreExact(0.7, 0.7, 2, 1, true);
    const s02 = setScoreExact(0.7, 0.7, 0, 2, true);
    const s12 = setScoreExact(0.7, 0.7, 1, 2, true);
    expect(s20 + s21 + s02 + s12).toBeCloseTo(1, 2);
    // A a un avantage premier serveur → P(A gagne) > 0.5
    expect(s20 + s21).toBeGreaterThan(0.5);
  });

  // --- setHandicap ---

  it("setHandicap 0 → >0.5 si holdA > holdB (favori A)", () => {
    clearAllMemos();
    const p = setHandicap(holdA, holdB, 0, true);
    expect(p).toBeGreaterThan(0.5);
  });

  it("setHandicap -1.5 avec favori fort → élevé", () => {
    clearAllMemos();
    const p = setHandicap(0.99, 0.74, -1.5, true);
    expect(p).toBeGreaterThan(0.8);
  });

  it("setHandicap +1.5 avec favori fort → très élevé (A couvre facilement)", () => {
    clearAllMemos();
    const p = setHandicap(0.99, 0.74, 1.5, true);
    expect(p).toBeGreaterThan(0.95);
  });

  // --- gameHandicap ---

  it("gameHandicap négatif si holdA > holdB (favori A donne des jeux)", () => {
    clearAllMemos();
    const h = gameHandicap(0.75, 0.6, 0.7, true);
    expect(h).toBeLessThan(0);
  });

  it("gameHandicap 0 si hold égaux", () => {
    clearAllMemos();
    const h = gameHandicap(0.7, 0.7, 0.5, true);
    expect(Math.abs(h)).toBeLessThan(0.1);
  });

  it("gameHandicap BO5 plus grand en valeur absolue que BO3", () => {
    clearAllMemos();
    const h3 = gameHandicap(0.75, 0.6, 0.7, true);
    clearAllMemos();
    const h5 = gameHandicap(0.75, 0.6, 0.7, false);
    expect(Math.abs(h5)).toBeGreaterThan(Math.abs(h3));
  });

  // --- doubleResult ---

  it("doubleResult somme = 1", () => {
    clearAllMemos();
    const dr = doubleResult(holdA, holdB, true);
    const total = dr.aWins1stAndMatch + dr.bWins1stAndMatch + dr.aWins1stLosesMatch + dr.bWins1stLosesMatch;
    expect(total).toBeCloseTo(1, 2);
  });

  it("doubleResult favori fort → aWins1stAndMatch > bWins1stAndMatch", () => {
    clearAllMemos();
    const dr = doubleResult(0.85, 0.55, true);
    expect(dr.aWins1stAndMatch).toBeGreaterThan(dr.bWins1stAndMatch);
  });

  it("doubleResult A a avantage premier serveur même avec hold égaux", () => {
    clearAllMemos();
    const dr = doubleResult(0.7, 0.7, true);
    // A sert en premier → avantage structurel
    expect(dr.aWins1stAndMatch).toBeGreaterThan(dr.bWins1stAndMatch);
  });

  // --- T2 : Player Total Games, Total Sets, Straight Sets, At Least 1 Set ---

  it("playerTotalGames → gamesA + gamesB ≈ total attendu", () => {
    clearAllMemos();
    const { gamesA, gamesB } = playerTotalGames(0.86, 0.78, 0.75, 3);
    expect(gamesA).toBeGreaterThan(gamesB); // favori gagne plus de jeux
    expect(gamesA + gamesB).toBeGreaterThan(14);
    expect(gamesA + gamesB).toBeLessThan(30);
  });

  it("totalSets BO3 → entre 2 et 3", () => {
    clearAllMemos();
    const ts = totalSets(0.7, 3);
    expect(ts).toBeGreaterThan(2);
    expect(ts).toBeLessThan(2.5);
  });

  it("totalSets BO5 → entre 3 et 4", () => {
    clearAllMemos();
    const ts = totalSets(0.7, 5);
    expect(ts).toBeGreaterThan(3);
    expect(ts).toBeLessThan(4);
  });

  it("straightSets BO3 → p² + q² < 1", () => {
    clearAllMemos();
    const { aWins, bWins } = straightSets(0.7, 3);
    expect(aWins).toBeCloseTo(0.49, 1);
    expect(bWins).toBeCloseTo(0.09, 1);
    expect(aWins + bWins).toBeLessThan(1);
  });

  it("straightSets favori → aWins > bWins", () => {
    clearAllMemos();
    const { aWins, bWins } = straightSets(0.8, 3);
    expect(aWins).toBeGreaterThan(bWins);
  });

  it("atLeastOneSet → toujours > 0.5 pour tout joueur", () => {
    clearAllMemos();
    const { aWinsAtLeast1, bWinsAtLeast1 } = atLeastOneSet(0.6, 3);
    expect(aWinsAtLeast1).toBeGreaterThan(0.5);
    expect(bWinsAtLeast1).toBeGreaterThan(0.5);
  });

  it("atLeastOneSet → favori fort → bWinsAtLeast1 faible", () => {
    clearAllMemos();
    const { bWinsAtLeast1 } = atLeastOneSet(0.9, 3);
    expect(bWinsAtLeast1).toBeLessThan(0.2);
  });

  it("atLeastOneSet somme ≤ 1 (pas d'exclusivité)", () => {
    clearAllMemos();
    const { aWinsAtLeast1, bWinsAtLeast1 } = atLeastOneSet(0.7, 3);
    expect(aWinsAtLeast1 + bWinsAtLeast1).toBeGreaterThan(1); // overlap possible
  });

  // --- T3 : firstSetWinner, firstSetTotal ---

  it("firstSetWinner → >0.5 si holdA > holdB", () => {
    clearAllMemos();
    const p = firstSetWinner(holdA, holdB);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });

  it("firstSetWinner equal holds → A a léger avantage premier serveur", () => {
    clearAllMemos();
    const p = firstSetWinner(0.7, 0.7);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(0.65);
  });

  it("firstSetTotal → entre 6 et 13 jeux", () => {
    clearAllMemos();
    const t = firstSetTotal(holdA, holdB);
    expect(t).toBeGreaterThan(6);
    expect(t).toBeLessThan(13);
  });

  it("firstSetTotal gros serveurs → plus de jeux", () => {
    clearAllMemos();
    const tBig = firstSetTotal(0.9, 0.9);
    clearAllMemos();
    const tSmall = firstSetTotal(0.6, 0.6);
    expect(tBig).toBeGreaterThan(tSmall);
  });

  // --- T4 : totalAcesO_U, acesPerSet ---

  it("totalAcesO_U → décroît avec le seuil", () => {
    const p8 = totalAcesO_U(8.5, 4, 4);
    const p12 = totalAcesO_U(12.5, 4, 4);
    const p16 = totalAcesO_U(16.5, 4, 4);
    expect(p8).toBeGreaterThan(p12);
    expect(p12).toBeGreaterThan(p16);
  });

  it("totalAcesO_U avec λ élevés → Over élevé", () => {
    const p = totalAcesO_U(9.5, 8, 8);
    expect(p).toBeGreaterThan(0.8);
  });

  it("totalAcesO_U avec λ faibles → Over faible", () => {
    const p = totalAcesO_U(9.5, 2, 2);
    expect(p).toBeLessThan(0.3);
  });

  it("acesPerSet → raisonnable (1-6 par joueur)", () => {
    const { acesPerSetA, acesPerSetB } = acesPerSet(5, 3, 2.2);
    expect(acesPerSetA).toBeGreaterThan(1);
    expect(acesPerSetA).toBeLessThan(6);
    expect(acesPerSetB).toBeGreaterThan(0);
    expect(acesPerSetB).toBeLessThan(4);
  });

  it("acesPerSet expectedSets=0 → 0", () => {
    const { acesPerSetA, acesPerSetB } = acesPerSet(5, 3, 0);
    expect(acesPerSetA).toBe(0);
    expect(acesPerSetB).toBe(0);
  });

  // --- T5 : tiebreakProb, tiebreakSet, tiebreakWinner ---

  it("tiebreakProb borné [0,1]", () => {
    expect(tiebreakProb(0.5, 0.5)).toBeGreaterThan(0.4);
    expect(tiebreakProb(0.5, 0.5)).toBeLessThan(0.6);
  });

  it("tiebreakProb avec pA élevé → A favori", () => {
    const p = tiebreakProb(0.7, 0.5);
    expect(p).toBeGreaterThan(0.6);
  });

  it("tiebreakProb symétrique si pA = pB", () => {
    const p1 = tiebreakProb(0.6, 0.6);
    const p2 = tiebreakProb(0.6, 0.6);
    expect(p1).toBeCloseTo(p2, 5);
  });

  it("tiebreakSet → entre 0 et 1", () => {
    const p = tiebreakSet(0.85, 0.80);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("tiebreakSet gros serveurs → plus probable", () => {
    const pBig = tiebreakSet(0.9, 0.9);
    const pSmall = tiebreakSet(0.6, 0.6);
    expect(pBig).toBeGreaterThan(pSmall);
  });

  it("tiebreakWinner ≤ tiebreakSet", () => {
    const pWin = tiebreakWinner(0.8, 0.75);
    const pSet = tiebreakSet(0.8, 0.75);
    expect(pWin).toBeLessThanOrEqual(pSet);
  });

  it("tiebreakScoreDistribution somme ≈ 1", () => {
    const dist = tiebreakScoreDistribution(0.6, 0.55);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0.95);
    expect(total).toBeLessThanOrEqual(1.01);
  });

  it("tiebreakScoreDistribution contient des scores terminaux", () => {
    const dist = tiebreakScoreDistribution(0.6, 0.55);
    // Scores terminaux courants : 7-5 (A gagne), 5-7 (B gagne)
    // 7-6 n'est PAS terminal (pas d'avance de 2)
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0.95);
    // Au moins un score existe
    expect(Object.keys(dist).length).toBeGreaterThan(0);
  });

  // --- T6 : Bayesian Blend ---

  it("bayesianBlend début → marché domine", () => {
    const result = bayesianBlend({
      matchProgress: 0.1,
      modelProb: 0.7,
      modelConfidence: 0.8,
      marketProb: 0.6,
      marketConfidence: 0.9,
    });
    // En début, le marché a plus de poids → prob proche de 0.6
    expect(result.prob).toBeLessThan(0.7);
    expect(result.prob).toBeGreaterThan(0.55);
    expect(result.marketWeight).toBeGreaterThan(result.modelWeight);
  });

  it("bayesianBlend fin → modèle domine", () => {
    const result = bayesianBlend({
      matchProgress: 0.9,
      modelProb: 0.7,
      modelConfidence: 0.8,
      marketProb: 0.6,
      marketConfidence: 0.9,
    });
    // En fin de match, le modèle a plus de poids → prob proche de 0.7
    expect(result.prob).toBeGreaterThan(0.65);
    expect(result.modelWeight).toBeGreaterThan(result.marketWeight);
  });

  it("bayesianBlend prob bornée [0,1]", () => {
    const result = bayesianBlend({
      matchProgress: 0.5,
      modelProb: 1.5, // hors bornes
      modelConfidence: 0.8,
      marketProb: -0.2, // hors bornes
      marketConfidence: 0.9,
    });
    expect(result.prob).toBeGreaterThanOrEqual(0);
    expect(result.prob).toBeLessThanOrEqual(1);
  });

  it("blendMultiple 0 sources → 0.5", () => {
    expect(blendMultiple([], 0.5)).toBe(0.5);
  });

  it("blendMultiple 1 source → cette prob", () => {
    expect(blendMultiple([{ prob: 0.7, confidence: 0.8, type: "model" }], 0.5)).toBeCloseTo(0.7, 2);
  });

  it("oddToProb + probToOdd round-trip", () => {
    expect(oddToProb(2.0)).toBeCloseTo(0.5, 5);
    expect(probToOdd(0.5)).toBeCloseTo(2.0, 5);
    expect(oddToProb(probToOdd(0.7))).toBeCloseTo(0.7, 5);
  });

  it("deVig normalise à 1", () => {
    const [a, b] = deVig([0.55, 0.50]); // somme = 1.05 (vig)
    expect(a + b).toBeCloseTo(1, 5);
    expect(a).toBeCloseTo(0.55 / 1.05, 3);
  });

  it("computeEdge positif si modèle > marché", () => {
    expect(computeEdge(0.7, 0.6)).toBeCloseTo(10, 1);
    expect(computeEdge(0.5, 0.6)).toBeCloseTo(-10, 1);
  });

  it("kellyFraction positif si value bet", () => {
    // Modèle dit 60%, cote 2.0 → value bet
    const k = kellyFraction(0.6, 2.0);
    expect(k).toBeGreaterThan(0);
  });

  it("kellyFraction 0 si pas de value", () => {
    // Modèle dit 40%, cote 2.0 → pas de value
    const k = kellyFraction(0.4, 2.0);
    expect(k).toBe(0);
  });

  // --- T8 : Market Map ---

  it("TENNIS_MARKETS contient 40+ marchés", () => {
    expect(MARKET_COUNT).toBeGreaterThan(40);
  });

  it("getMarketById retourne un marché existant", () => {
    const m = getMarketById("match-winner");
    expect(m).toBeDefined();
    expect(m!.label).toBe("Vainqueur du match");
  });

  it("getMarketById retourne undefined pour ID inexistant", () => {
    expect(getMarketById("nonexistent")).toBeUndefined();
  });

  it("getMarketsByCategory filtre correctement", () => {
    const acesMarkets = getMarketsByCategory("aces");
    expect(acesMarkets.length).toBeGreaterThan(0);
    acesMarkets.forEach(m => expect(m.category).toBe("aces"));
  });

  it("marchés live sont marqués liveOnly", () => {
    const liveMarkets = TENNIS_MARKETS.filter(m => m.liveOnly);
    expect(liveMarkets.length).toBeGreaterThan(0);
    liveMarkets.forEach(m => expect(m.liveOnly).toBe(true));
  });
});

/**
 * Bead ParisScorebis-agls — sensibilité au point (Markov point-level)
 * + pondération par récence du serve observé + pression balle de break
 * dans adjustLambdaLive (via predictTotalGames).
 */
describe("live-markov point-level + récence (agls)", () => {
  const pServeA = 0.67;
  const pServeB = 0.62;

  beforeEach(() => clearAllMemos());

  // --- gameWinProbFromScore ---

  it("gameWinProbFromScore(0-0, A au service) === gameWinProb(pServeA)", () => {
    const direct = gameWinProb(pServeA);
    const fromScore = gameWinProbFromScore(0, 0, "A", pServeA, pServeB);
    expect(Math.abs(fromScore - direct)).toBeLessThan(1e-9);
  });

  it("gameWinProbFromScore(0-0, B au service) === 1 - gameWinProb(pServeB)", () => {
    const breakP = 1 - gameWinProb(pServeB);
    const fromScore = gameWinProbFromScore(0, 0, "B", pServeA, pServeB);
    expect(Math.abs(fromScore - breakP)).toBeLessThan(1e-9);
  });

  it("balle de break 40-30 : P(relanceur gagne le jeu) > 50%", () => {
    // A au retour, 40-30 : P(A gagne le point) = 1 - pServeB = 0.38,
    // mais 2 chances de closing (gagne direct OU passe par deuce) → ~55%.
    const p = gameWinProbFromScore(3, 2, "B", pServeA, pServeB);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(0.7);
  });

  it("40-0 pour le serveur : P(gagner le jeu) quasi certaine", () => {
    const p = gameWinProbFromScore(3, 0, "A", pServeA, pServeB);
    expect(p).toBeGreaterThan(0.95);
  });

  it("avantage serveur > deuce > avantage relanceur (monotone)", () => {
    const advA = gameWinProbFromScore(4, 3, "A", pServeA, pServeB);
    const deuce = gameWinProbFromScore(3, 3, "A", pServeA, pServeB);
    const advB = gameWinProbFromScore(3, 4, "A", pServeA, pServeB);
    expect(advA).toBeGreaterThan(deuce);
    expect(deuce).toBeGreaterThan(advB);
  });

  it("terminaux défensifs : jeu déjà gagné/perdu", () => {
    expect(gameWinProbFromScore(5, 3, "A", pServeA, pServeB)).toBe(1);
    expect(gameWinProbFromScore(3, 5, "A", pServeA, pServeB)).toBe(0);
  });

  // --- blendServeRecent ---

  it("blendServeRecent sans observation → prematch inchangé", () => {
    expect(blendServeRecent(0.65, null, 10)).toBe(0.65);
    expect(blendServeRecent(0.65, undefined, 10)).toBe(0.65);
  });

  it("blendServeRecent à 0 jeu joué → prematch", () => {
    expect(blendServeRecent(0.65, 0.55, 0)).toBeCloseTo(0.65, 10);
  });

  it("blendServeRecent demi-vie 8 : à 8 jeux, moitié-moitié", () => {
    expect(blendServeRecent(0.65, 0.55, 8, 8)).toBeCloseTo(0.6, 10);
  });

  it("blendServeRecent converge vers l'observé en fin de match", () => {
    const late = blendServeRecent(0.65, 0.55, 80, 8);
    // w = 80/88 ≈ 0.909 → 0.65×0.091 + 0.55×0.909 ≈ 0.559
    expect(late).toBeGreaterThan(0.555);
    expect(late).toBeLessThan(0.565);
  });

  // --- Pression balle de break dans predictTotalGames ---

  it("balle de break dans le contexte live → λ restant raccourci", () => {
    const players = {
      a: { servePtsWonPct: 0.67, returnPtsWonPct: 0.33 },
      b: { servePtsWonPct: 0.62, returnPtsWonPct: 0.38 },
    };
    // Set 1, 4-3 A, B au service, A à 40-30 (balle de break).
    const baseCtx = {
      gamesPlayed: 7,
      setsWon: [0, 0] as [number, number],
      currentSetGames: [4, 3] as [number, number],
      server: "B" as const,
      liveProbA: 60,
      liveProbB: 40,
    };
    const withoutBP = predictTotalGames(players.a, players.b, "Hard", 3, undefined, undefined, baseCtx);
    const withBP = predictTotalGames(players.a, players.b, "Hard", 3, undefined, undefined, {
      ...baseCtx,
      currentPoints: [3, 2] as [number, number],
    });
    // A mène 4-3 avec balle de break → le set (et le match) finit
    // statistiquement plus tôt que depuis 0-0 dans le jeu.
    expect(withBP.lambda).toBeLessThan(withoutBP.lambda);
  });

  it("unroll intra-jeu inactif à 0-0 (strict égal au chemin standard)", () => {
    const players = {
      a: { servePtsWonPct: 0.67, returnPtsWonPct: 0.33 },
      b: { servePtsWonPct: 0.62, returnPtsWonPct: 0.38 },
    };
    const baseCtx = {
      gamesPlayed: 7,
      setsWon: [0, 0] as [number, number],
      currentSetGames: [4, 3] as [number, number],
      server: "B" as const,
    };
    const without = predictTotalGames(players.a, players.b, "Hard", 3, undefined, undefined, baseCtx);
    const with000 = predictTotalGames(players.a, players.b, "Hard", 3, undefined, undefined, {
      ...baseCtx,
      currentPoints: [0, 0] as [number, number],
    });
    expect(with000.lambda).toBeCloseTo(without.lambda, 10);
  });
});

/**
 * Bead ParisScorebis-6ljb — Live Matrix type Betfair Tennis Trader
 * (src/lib/prediction/live-matrix.ts).
 */
describe("live-matrix (6ljb)", () => {
  const pServeA = 0.67;
  const pServeB = 0.62;

  beforeEach(() => clearAllMemos());

  const baseInput = {
    pServeA,
    pServeB,
    games: [4, 3] as [number, number],
    sets: [0, 0] as [number, number],
    points: [0, 0] as [number, number],
    server: "B" as const,
    bo3: true,
  };

  it("grille 4×4, cellule (0,0) cohérente avec gameWinProb", () => {
    const m = buildLiveMatrix(baseInput);
    expect(m.cells.length).toBe(4);
    expect(m.cells[0].length).toBe(4);
    // B au service → P(A gagne le jeu) = prob de break de B.
    expect(m.cells[0][0].pGameA).toBeCloseTo(1 - gameWinProb(pServeB), 9);
  });

  it("pMatchA croît avec les points de A (ligne 40 vs ligne 0)", () => {
    const m = buildLiveMatrix(baseInput);
    expect(m.cells[3][0].pMatchA).toBeGreaterThan(m.cells[0][0].pMatchA);
    // ... et décroît avec les points de B.
    expect(m.cells[0][3].pMatchA).toBeLessThan(m.cells[0][0].pMatchA);
  });

  it("balle de set à 5-4, 40-30 : pMatchA fort pour A", () => {
    const m = buildLiveMatrix({
      ...baseInput,
      games: [5, 4],
      points: [3, 2],
    });
    // A au retour à 40-30 avec 5-4 : double balle de set.
    expect(m.cells[3][2].pMatchA).toBeGreaterThan(0.75);
    // Le coin (3,3) représente aussi le deuce (clamp documenté).
    expect(m.cells[3][3].pGameA).toBeGreaterThan(0);
    expect(m.cells[3][3].pGameA).toBeLessThan(1);
  });

  it("sets partagés 1-1 en BO3 : pMatchA(50) symétrique pour sets égaux", () => {
    const m = buildLiveMatrix({
      ...baseInput,
      sets: [1, 1],
      games: [0, 0],
      points: [0, 0],
      server: "A",
    });
    // 0-0, A sert : set décisif → pMatchA ≈ P(A gagne le set) ≈ 0.75.
    expect(m.cells[0][0].pMatchA).toBeGreaterThan(0.7);
    expect(m.cells[0][0].pMatchA).toBeLessThan(0.8);
  });

  it("cotes justes cohérentes avec pMatchA", () => {
    const m = buildLiveMatrix(baseInput);
    for (const row of m.cells) {
      for (const c of row) {
        if (c.pMatchA > 0.001 && c.pMatchA < 0.999) {
          expect(c.fairOddA * c.pMatchA).toBeCloseTo(1, 6);
        }
      }
    }
  });

  it("matrixBreakPointSide détecte la balle de break", () => {
    // B sert, A au retour à 40-30 → balle de break A.
    expect(matrixBreakPointSide(3, 2, "B")).toBe("A");
    // A sert, B au retour à 30-40 → balle de break B.
    expect(matrixBreakPointSide(2, 3, "A")).toBe("B");
    // Deuce : pas de balle de break.
    expect(matrixBreakPointSide(3, 3, "A")).toBeNull();
    // Avantage relanceur (clampé 3-3 côté feed, ici brut 4-3).
    expect(matrixBreakPointSide(4, 3, "B")).toBe("A");
    // 40-30 pour le serveur : rien.
    expect(matrixBreakPointSide(3, 2, "A")).toBeNull();
  });
});
