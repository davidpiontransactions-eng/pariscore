// Backtest CLV handball — walk-forward CMP/Skellam vs cotes d'ouverture 1xbet.
// Protocole : tri chrono, fits CMP sur matchs antérieurs seuls (aucun lookahead),
// CLV = (p_model − p_implied)/p_implied par marché, profit flat 1u aux cotes
// d'ouverture. Match nul = pari 1X2 perdant (on joue le 1 ou le 2).
// Repli simulé (handball-backtest.ts) si couverture openingOdds < 50 %.

import type { HandballMatch } from "./handball-data";
import { isCLVTestable } from "./handball-flashscore";
import {
  teamStrength,
  matchLambdas,
  overUnderProb,
  cmpPmf,
  cmpKMax,
  type CmpTeam,
} from "./handball-cmp";
import { skellamMatchProbs, handicapProb } from "./handball-skellam";
import {
  devigProportional,
  rawImplied,
  clvValue,
  summarizeClv,
  type ClvRecord,
} from "./handball-clv";
import {
  HANDBALL_STRATEGY_DEFS,
  type HandballStrategyKey,
  type HandballSide,
} from "./handball-strategy-top8";
import { LINE_OVER, LINE_UNDER, LINE_BTTS, LINE_HANDICAP } from "./handball-backtest";

// ─── Types résultat (plan §5) ───

export type ClvStrategyRow = {
  key: HandballStrategyKey;
  label: string;
  emoji: string;
  market: string;
  nBets: number;
  meanCLV: number | null;
  stdCLV: number | null;
  hitRate: number | null;
  profitSimU: number;
  roiPct: number | null;
  curve: number[];
  /** false si nBets < 30 (bruit) ou 0 pari */
  sampleOk: boolean;
  note?: string;
};

export type HandballCLVResult = {
  league: string;
  nMatches: number;
  leagues: string[];
  strategies: ClvStrategyRow[];
  global: {
    nBets: number;
    wins: number;
    hitRate: number | null;
    profitSimU: number;
    roiPct: number | null;
    curve: number[];
  };
  methodology: string;
  clvProxy: true;
  computedAt: string;
};

const METHODOLOGY =
  "Backtest CLV walk-forward : matchs terminés triés par coup d'envoi, fits CMP " +
  "(MLE Newton-Raphson, 10 derniers matchs pondérés récence) sur les matchs " +
  "antérieurs seuls — aucun lookahead ; équipe < 3 matchs antérieurs = pas de pari. " +
  "Fair probs : totaux via CMP (Over 55.5 / Under 62.5), handicap via Skellam " +
  "(λh/λe issus du CMP), 1X2 via Skellam sur forces CMP s_a/s_d. " +
  "CLV = (p_model − p_implied)/p_implied par marché vs cotes d'ouverture 1xbet " +
  "(proxy snapshot) ; devig proportionnel sur 1X2, implicite brut 1/cote sur " +
  "marchés à cote unique (marge incluse). Profit flat 1u à la cote d'ouverture, " +
  "match nul = 1X2 perdant. Edge si |CLV| > 1,5 %, n ≥ 30 = significatif.";

/** Couverture CLV : part des terminés testables (seuil repli simulé 50 %). */
export function clvCoverage(
  finished: HandballMatch[],
  league = "all",
): { coverage: number; nTestable: number; nTotal: number } {
  const scoped =
    league === "all" ? finished : finished.filter((m) => m.league.name === league);
  const nTotal = scoped.length;
  const nTestable = scoped.filter(isCLVTestable).length;
  return { coverage: nTotal > 0 ? nTestable / nTotal : 0, nTestable, nTotal };
}

// ─── Historique walk-forward ───

type TeamPair = { gf: number; ga: number };
type HistStore = Map<string, TeamPair[]>;

function ppgPairs(pairs: TeamPair[], n: number): number {
  const slice = pairs.slice(-n);
  if (slice.length === 0) return 0;
  let pts = 0;
  for (const p of slice) {
    if (p.gf > p.ga) pts += 2;
    else if (p.gf === p.ga) pts += 1;
  }
  return pts / slice.length;
}

/** PPG récent L5 60 % / L10 40 % (miroir favRecent handball-backtest). */
function ppgRecent(pairs: TeamPair[]): number {
  return ppgPairs(pairs, 5) * 0.6 + ppgPairs(pairs, 10) * 0.4;
}

function fitsOf(pairs: TeamPair[]): CmpTeam | null {
  if (pairs.length < 3) return null;
  return teamStrength(
    pairs.map((p) => p.gf),
    pairs.map((p) => p.ga),
  );
}

type Obs = ClvRecord & { kickoff: string };

function emptyRow(key: HandballStrategyKey, market: string, note?: string): ClvStrategyRow {
  const def = HANDBALL_STRATEGY_DEFS[key];
  return {
    key,
    label: def.label,
    emoji: def.emoji,
    market,
    nBets: 0,
    meanCLV: null,
    stdCLV: null,
    hitRate: null,
    profitSimU: 0,
    roiPct: null,
    curve: [],
    sampleOk: false,
    note,
  };
}

function finalizeRow(
  key: HandballStrategyKey,
  market: string,
  obs: Obs[],
  note?: string,
): ClvStrategyRow {
  const row = emptyRow(key, market, note);
  if (obs.length === 0) return row;
  const s = summarizeClv(obs);
  let cumul = 0;
  const curve: number[] = [];
  for (const o of obs) {
    cumul += o.win ? o.odds - 1 : -1;
    curve.push(Math.round(cumul * 100) / 100);
  }
  row.nBets = s.nBets;
  row.meanCLV = s.meanCLV;
  row.stdCLV = s.stdCLV;
  row.hitRate = s.hitRate;
  row.profitSimU = s.profitSimU;
  row.roiPct = s.roiPct;
  row.curve = curve;
  row.sampleOk = s.nBets >= 30;
  return row;
}

function bttsProb(tH: CmpTeam, tA: CmpTeam): number {
  const lh = (tH.attack.lambda + tA.defense.lambda) / 2;
  const le = (tA.attack.lambda + tH.defense.lambda) / 2;
  const nuH = (tH.attack.nu + tA.defense.nu) / 2;
  const nuE = (tA.attack.nu + tH.defense.nu) / 2;
  const kMax = Math.max(cmpKMax(lh), cmpKMax(le), LINE_BTTS);
  const pmfH = cmpPmf(lh, nuH, kMax);
  const pmfA = cmpPmf(le, nuE, kMax);
  let pH = 0;
  let pA = 0;
  for (let k = LINE_BTTS; k <= kMax; k++) {
    pH += pmfH[k] ?? 0;
    pA += pmfA[k] ?? 0;
  }
  return pH * pA; // indépendance (simplification documentée)
}

/**
 * Walk-forward CLV : CMP/Skellam → fair probs → CLV vs ouverture 1xbet.
 * Retourne null si couverture < 50 % (la route bascule en simulé).
 */
export function runHandballCLVBacktest(
  finished: HandballMatch[],
  league = "all",
): HandballCLVResult | null {
  const leagues = [...new Set(finished.map((m) => m.league.name))].sort();
  const scoped =
    league === "all" ? [...finished] : finished.filter((m) => m.league.name === league);
  scoped.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const { coverage } = clvCoverage(finished, league);
  if (coverage < 0.5) return null;

  const hist = new Map<string, TeamPair[]>();
  const getHist = (id: number): TeamPair[] => {
    const k = String(id);
    if (!hist.has(k)) hist.set(k, []);
    return hist.get(k)!;
  };

  const obsByKey: Record<HandballStrategyKey, Obs[]> = {
    bestTeam: [],
    bestTeam1x2: [],
    over55: [],
    under62: [],
    handicap: [],
    btts30: [],
    htLeader: [],
    valueBet: [],
  };

  for (const m of scoped) {
    const hH = getHist(m.home.id);
    const hA = getHist(m.away.id);
    const testable = isCLVTestable(m);
    const o = m.openingOdds;
    if (testable && m.score && o) {
      const total = m.score.home + m.score.away;
      const tH = fitsOf(hH);
      const tA = fitsOf(hA);
      if (tH && tA) {
        const { lambdaH, lambdaE, nuH, nuE } = matchLambdas(tH, tA);
        const probs1x2 = skellamMatchProbs(lambdaH, lambdaE);
        const push = (key: HandballStrategyKey, pModel: number, pImplied: number, odds: number, win: boolean) => {
          if (!(pImplied > 0) || !(odds > 1)) return;
          obsByKey[key].push({ clv: clvValue(pModel, pImplied), win, odds, kickoff: m.kickoff });
        };

        // bestTeam : pick PPG récent, proba modèle CMP/Skellam
        const pickPpg: HandballSide = ppgRecent(hH) >= ppgRecent(hA) ? "home" : "away";
        if (o.fav1x2?.home != null && o.fav1x2?.away != null) {
          const dev = devigProportional([
            o.fav1x2.home,
            o.fav1x2.draw ?? 9,
            o.fav1x2.away,
          ]);
          const winPpg =
            m.score.home === m.score.away ? false : pickPpg === "home"
              ? m.score.home > m.score.away
              : m.score.away > m.score.home;
          const pricePpg = pickPpg === "home" ? o.fav1x2.home : o.fav1x2.away;
          push("bestTeam", pickPpg === "home" ? probs1x2.home : probs1x2.away, pickPpg === "home" ? dev[0] : dev[2], pricePpg, winPpg);
        }

        // bestTeam1x2 : pick forces CMP s_a/s_d (λ le plus haut)
        const pickCmp: HandballSide = lambdaH >= lambdaE ? "home" : "away";
        if (o.fav1x2?.home != null && o.fav1x2?.away != null) {
          const dev = devigProportional([
            o.fav1x2.home,
            o.fav1x2.draw ?? 9,
            o.fav1x2.away,
          ]);
          const winCmp =
            m.score.home === m.score.away ? false : pickCmp === "home"
              ? m.score.home > m.score.away
              : m.score.away > m.score.home;
          const priceCmp = pickCmp === "home" ? o.fav1x2.home : o.fav1x2.away;
          push("bestTeam1x2", pickCmp === "home" ? probs1x2.home : probs1x2.away, pickCmp === "home" ? dev[0] : dev[2], priceCmp, winCmp);
        }

        // valueBet : côté EV+ (p_model × cote − 1 > 0), sinon pas de pari
        if (o.fav1x2?.home != null && o.fav1x2?.away != null) {
          const dev = devigProportional([
            o.fav1x2.home,
            o.fav1x2.draw ?? 9,
            o.fav1x2.away,
          ]);
          const evH = probs1x2.home * o.fav1x2.home - 1;
          const evA = probs1x2.away * o.fav1x2.away - 1;
          const side: HandballSide | null =
            evH > 0 || evA > 0 ? (evH >= evA ? "home" : "away") : null;
          if (side) {
            const winV =
              m.score.home === m.score.away ? false : side === "home"
                ? m.score.home > m.score.away
                : m.score.away > m.score.home;
            push(
              "valueBet",
              side === "home" ? probs1x2.home : probs1x2.away,
              side === "home" ? dev[0] : dev[2],
              side === "home" ? o.fav1x2.home : o.fav1x2.away,
              winV,
            );
          }
        }

        // over55 / under62 : fair CMP vs implicite brut (cote unique)
        if (o.over55 != null) {
          const { over } = overUnderProb(lambdaH, nuH, lambdaE, nuE, LINE_OVER);
          push("over55", over, rawImplied(o.over55), o.over55, total > LINE_OVER);
        }
        if (o.under62 != null) {
          const { under } = overUnderProb(lambdaH, nuH, lambdaE, nuE, LINE_UNDER);
          push("under62", under, rawImplied(o.under62), o.under62, total < LINE_UNDER);
        }

        // handicap : côté fort couvre −4.5 (cote favori, hypothèse documentée)
        if (o.handicap != null) {
          const hc = handicapProb(lambdaH, lambdaE, LINE_HANDICAP);
          const pickHc: HandballSide = lambdaH >= lambdaE ? "home" : "away";
          const margin =
            pickHc === "home" ? m.score.home - m.score.away : m.score.away - m.score.home;
          push(
            "handicap",
            pickHc === "home" ? hc.home : hc.away,
            rawImplied(o.handicap),
            o.handicap,
            margin > LINE_HANDICAP,
          );
        }

        // btts30 : P(h≥30)·P(a≥30) indépendantes
        if (o.btts30 != null) {
          const pBoth = bttsProb(tH, tA);
          push(
            "btts30",
            pBoth,
            rawImplied(o.btts30),
            o.btts30,
            m.score.home >= LINE_BTTS && m.score.away >= LINE_BTTS,
          );
        }
      }
    }

    // Historique walk-forward : match courant ajouté APRÈS calcul (pas de lookahead)
    if (m.score) {
      getHist(m.home.id).push({ gf: m.score.home, ga: m.score.away });
      getHist(m.away.id).push({ gf: m.score.away, ga: m.score.home });
    }
  }

  const strategies: ClvStrategyRow[] = (
    Object.keys(HANDBALL_STRATEGY_DEFS) as HandballStrategyKey[]
  ).map((key) => {
    if (key === "htLeader") {
      return emptyRow(key, "Leader MT (pick forme)", "Pas de marché d'ouverture MT au snapshot.");
    }
    const market =
      key === "over55" ? `Over ${LINE_OVER}`
      : key === "under62" ? `Under ${LINE_UNDER}`
      : key === "handicap" ? `Handicap favori -${LINE_HANDICAP}`
      : key === "btts30" ? `Les deux à ${LINE_BTTS}+`
      : key === "valueBet" ? "EV+ vs ouverture 1xbet"
      : "1X2 favori (ouverture)";
    return finalizeRow(key, market, obsByKey[key]);
  });

  // Tri meanCLV décroissant (nuls en fin)
  strategies.sort(
    (a, b) => (b.meanCLV ?? Number.NEGATIVE_INFINITY) - (a.meanCLV ?? Number.NEGATIVE_INFINITY),
  );

  // Global : toutes observations chrono (courbe = profit cumulé séquentiel)
  const all = strategies
    .flatMap((s, si) => obsByKey[s.key].map((o) => ({ ...o, si })))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.si - b.si);
  const gs = summarizeClv(all);
  const gCurve: number[] = [];
  let g = 0;
  for (const o of all) {
    g += o.win ? o.odds - 1 : -1;
    gCurve.push(Math.round(g * 100) / 100);
  }
  const wins = all.filter((o) => o.win).length;

  return {
    league,
    nMatches: scoped.length,
    leagues,
    strategies,
    global: {
      nBets: gs.nBets,
      wins,
      hitRate: gs.nBets > 0 ? wins / gs.nBets : null,
      profitSimU: gs.profitSimU,
      roiPct: gs.roiPct,
      curve: gCurve,
    },
    methodology: METHODOLOGY,
    clvProxy: true,
    computedAt: new Date().toISOString(),
  };
}
