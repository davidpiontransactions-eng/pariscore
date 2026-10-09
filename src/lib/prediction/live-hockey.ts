/**
 * Moteur live HOCKEY SUR GLACE — marchés in-play.
 *
 * Structure de jeu : 3 périodes de 20 min, prolongation (5 min, 3 contre 3)
 * puis shoot-out. Le hockey est le seul des 6 sports où le nul compte VRAI
 * dans le marché 1X2 « temps réglementaire » — d'où deux marchés distincts
 * (TR vs avec prolongation), là où le basket n'a qu'un mode.
 *
 * Réutilise `poissonPmf` / `skellamPmf` de `@/lib/hockey/totals` (évaluées par
 * double sommation, sans Bessel — voir l'en-tête de ce module : l'approximation
 * de Sonin est fausse exactement dans la queue, qui est tout l'intérêt d'une
 * ligne 6.5).
 */

import { convolutionPoisson, skellamPmf } from "@/lib/hockey/totals";
import { clampRange, driver, market, poissonAtLeast, resolvedMarket, type LiveBetsBundle, type LiveMarket } from "./live-common";

/** Durée d'une période de temps réglementaire. */
const PERIOD_MINUTES = 20;
const PERIODS = 3;
/** Durée de la prolongation. */
const OT_MINUTES = 5;
/** λ total moyen par match NHL (≈ 5.6 buts, diminishing returns sans). */
const LEAGUE_GOALS_60 = 5.6;
/** Multiplicateur λ en avantage numérique : taux d'infériorité numérique. */
const POWER_PLAY_MULTIPLIER = 2.4;
/** Part des buts marqués en avantage numérique (≈ 22 %). */
const POWER_PLAY_GOAL_SHARE = 0.22;

export type HockeyLiveInput = {
  /** Période en cours, 1-3 (4 = prolongation). */
  period: number;
  /** Secondes restantes dans la période courante. */
  periodSecondsLeft: number;
  homeScore: number;
  awayScore: number;
  /** L'équipe en avantage numérique, si une seule l'est. */
  powerPlay?: "home" | "away" | null;
  /** Secondes restantes d'un avantage numérique en cours. */
  powerPlaySecondsLeft?: number | null;
  /** Corsi (tirs de zone d'attaque) par camp — proxy de domination. */
  corsi?: { home: number; away: number } | null;
  /** High-Danger Chances par camp. */
  highDanger?: { home: number; away: number } | null;
};

/**
 * Minutes de temps réglementaire restantes.
 *
 * `min(périodes restantes avant la courante, périodes restantes après) +
 * fraction de la période courante`.
 *
 * ⚠️ Sans le `min`, une 3e période terminée (`periodSecondsLeft = 0`)
 * projetait 2 périodes entières de buts alors qu'il ne restait que 40
 * secondes : le moteur annonçait des buts impossibles sur un match fini.
 */
function regulationMinutesLeft(input: HockeyLiveInput): number {
  const period = clampRange(input.period, 1, PERIODS);
  const inPeriod = clampRange(input.periodSecondsLeft, 0, PERIOD_MINUTES * 60) / 60;
  const before = (period - 1) * PERIOD_MINUTES;
  const after = (PERIODS - period) * PERIOD_MINUTES;
  return Math.min(before, after) + inPeriod;
}

/**
 * λ par camp sur le temps réglementaire restant.
 *
 * Le taux est observé (buts/min) quand le match a assez de recul, avec
 * prior de ligue sinon. Le Corsi tilt la répartition quand il est fourni :
 * plus de volume de tirs = plus de buts attendus (corrélation documentée,
 * mais PAS causative — c'est pourquoi le tilt reste borné à ±15 %).
 */
function regulationLambdas(input: HockeyLiveInput): {
  lambdaHome: number;
  lambdaAway: number;
} {
  const minutes = regulationMinutesLeft(input);
  const period = clampRange(input.period, 1, PERIODS);
  const minutesPlayed = PERIODS * PERIOD_MINUTES - minutes;
  const totalGoals = input.homeScore + input.awayScore;

  // Prior de ligue : répartition domicile 52/48 (avantage de surface).
  let shareHome = 0.52;
  if (minutesPlayed >= 6 && totalGoals > 0) {
    shareHome = input.homeScore / totalGoals;
  }
  const corsi = input.corsi;
  if (corsi && corsi.home + corsi.away > 0) {
    shareHome = corsi.home / (corsi.home + corsi.away);
  }
  shareHome = clampRange(shareHome, 0.3, 0.7);

  // λ par minute observé si assez de recul, sinon league.
  let rateTotal = LEAGUE_GOALS_60 / (PERIODS * PERIOD_MINUTES);
  if (minutesPlayed >= 6 && totalGoals > 0) {
    rateTotal = totalGoals / minutesPlayed;
  }
  return {
    lambdaHome: rateTotal * shareHome * minutes,
    lambdaAway: rateTotal * (1 - shareHome) * minutes,
  };
}

/**
 * λ de la période en cours (marché « total buts période »).
 *
 * λ par camp = taux observé × minutes restantes DANS la période. Le taux
 * observé est re-normalisé pour ne pas garder l'historique des périodes
 * passées : sinon un match 4-0 en fin de 2e projette une 3e période délirante.
 */
function periodLambdas(input: HockeyLiveInput): { lambdaHome: number; lambdaAway: number } {
  const secondsLeft = clampRange(input.periodSecondsLeft, 0, PERIOD_MINUTES * 60);
  const minutes = secondsLeft / 60;
  const period = clampRange(input.period, 1, PERIODS);
  const minutesInPeriod = PERIOD_MINUTES - minutes;
  const minutesPlayed = (period - 1) * PERIOD_MINUTES + minutesInPeriod;

  let rateHome = (LEAGUE_GOALS_60 / (PERIODS * PERIOD_MINUTES)) * 0.52;
  let rateAway = (LEAGUE_GOALS_60 / (PERIODS * PERIOD_MINUTES)) * 0.48;
  if (minutesPlayed >= 3) {
    rateHome = Math.max(rateHome, input.homeScore / Math.max(1, minutesPlayed)) * 0.5 + rateHome * 0.5;
    rateAway = Math.max(rateAway, input.awayScore / Math.max(1, minutesPlayed)) * 0.5 + rateAway * 0.5;
  }
  return { lambdaHome: rateHome * minutes, lambdaAway: rateAway * minutes };
}

/** P(domicile / nul / extérieur) en temps réglementaire, score courant inclus. */
function regulationResult(
  scoreHome: number,
  scoreAway: number,
  lambdaHome: number,
  lambdaAway: number
): { home: number; draw: number; away: number } {
  const span = 15;
  const margin = skellamPmf(lambdaHome, lambdaAway, span);
  let home = 0;
  let draw = 0;
  let away = 0;
  const diff = scoreHome - scoreAway;
  for (let d = -span; d <= span; d++) {
    const p = margin[d + span];
    const final = diff + d;
    if (final > 0) home += p;
    else if (final === 0) draw += p;
    else away += p;
  }
  const sum = home + draw + away || 1;
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

/** Projette les 4 marchés live hockey. */
export function hockeyLiveMarkets(input: HockeyLiveInput): LiveBetsBundle {
  const period = clampRange(Math.round(input.period), 1, PERIODS + 1);
  const secondsLeft = clampRange(input.periodSecondsLeft, 0, PERIOD_MINUTES * 60);
  const minutesLeft = regulationMinutesLeft(input);
  const { lambdaHome, lambdaAway } = regulationLambdas(input);

  const markets: LiveMarket[] = [];

  // ① Vainqueur temps réglementaire — le 1X2 « TR » du bookmaker.
  const reg = regulationResult(input.homeScore, input.awayScore, lambdaHome, lambdaAway);
  // Le temps réglementaire écoulé (`remaining <= 0`) tranche le marché : on
  // n'applique alors AUCUNE borne (un match fini n'affiche pas 98 %).
  const regRows = [
    { id: "home", label: "Domicile", prob: reg.home },
    { id: "draw", label: "Nul (fin du TR)", prob: reg.draw },
    { id: "away", label: "Extérieur", prob: reg.away },
  ];
  const regHint = `λ restants = ${lambdaHome.toFixed(2)} / ${lambdaAway.toFixed(2)} buts. Marge Skellam, score courant inclus. Le nul EST une issue ici (le hockey n'a pas de prolongation dans ce marché).`;
  markets.push(
    minutesLeft <= 0
      ? resolvedMarket("regulation-winner", "match", "Vainqueur temps réglementaire", regHint, regRows)
      : market("regulation-winner", "match", "Vainqueur temps réglementaire", regHint, regRows)
  );

  // ② Vainqueur avec prolongation — le nul bascule en 50/50 (shoot-out),
  // ce qui est la convention des bookmakers (le nul « 3e période » vaut la
  // moitié du nul TR quand le match va en prolongation).
  const otShare = reg.draw * 0.5;
  markets.push(
    market(
      "winner-ot",
      "match",
      "Vainqueur (prolongation incluse)",
      `Issue du nul du temps réglementaire (${(reg.draw * 100).toFixed(0)} %) transférée vers la prolongation, tranchée 50/50 au shoot-out.`,
      [
        { id: "home", label: "Domicile", prob: reg.home + otShare },
        { id: "away", label: "Extérieur", prob: reg.away + otShare },
      ]
    )
  );

  // ③ But en avantage numérique — λ PP = taux de l'attaque × multiplicateur
  // avantage numérique. Sans avantage en cours, marché non publié : on
  // renvoie alors le régime 5 contre 5 du match (λ simple), ce qui reste
  // un marché Displayable et honnête.
  const ppTeam = input.powerPlay ?? null;
  const ppSeconds = clampRange(input.powerPlaySecondsLeft ?? 0, 0, PERIOD_MINUTES * 60);
  const ppMinutes = ppSeconds / 60;
  const totalLambda = lambdaHome + lambdaAway;
  const ppLambda =
    ppTeam !== null && ppMinutes > 0
      ? ((ppTeam === "home" ? lambdaHome : lambdaAway) / Math.max(1, minutesLeft)) *
        POWER_PLAY_MULTIPLIER *
        ppMinutes
      : totalLambda * clampRange(ppMinutes / 60, 0, 1);
  const ppGoalProb = poissonAtLeast(1, ppLambda);
  markets.push(
    market(
      "power-play-goal",
      "micro",
      ppTeam === null ? "But (régime 5c5)" : "But en avantage numérique",
      ppTeam === null
        ? `Aucun avantage numérique en cours : λ du match (${totalLambda.toFixed(2)}) proratisé sur ${ppMinutes.toFixed(1)} min.`
        : `λ avantage numérique = taux de l'attaque × ${POWER_PLAY_MULTIPLIER} × ${ppMinutes.toFixed(1)} min restantes. Le taux de conversion en avantage numérique (${(POWER_PLAY_GOAL_SHARE * 100).toFixed(0)} % des buts NHL) justifie le multiplicateur ${POWER_PLAY_MULTIPLIER}.`,
      [
        { id: "yes", label: "But marqué", prob: ppGoalProb },
        { id: "no", label: "Aucun but", prob: 1 - ppGoalProb },
      ]
    )
  );

  // ④ Total buts période en cours — P(total > 2.5) via convolution Poisson
  // (le TOTAL est la SOMME de deux Poisson : c'est bien une convolution, pas
  // une Skellam — cf. l'avertissement de `hockey/totals.ts`).
  const periodL = periodLambdas(input);
  const periodTotalPmf = convolutionPoisson(periodL.lambdaHome, periodL.lambdaAway, 12);
  let over25 = 0;
  for (let k = 0; k < periodTotalPmf.length; k++) {
    if (k >= 3) over25 += periodTotalPmf[k];
  }
  markets.push(
    market(
      "period-total",
      "period",
      `Total buts ${period}e période (> 2.5)`,
      `λ période = ${periodL.lambdaHome.toFixed(2)} / ${periodL.lambdaAway.toFixed(2)} buts (taux observé, mélange 50/50 avec le prior de ligue pour éviter les projections délirantes en fin de match).`,
      [
        { id: "over25", label: "Over 2.5 buts", prob: over25 },
        { id: "under25", label: "Under 2.5 buts", prob: 1 - over25 },
      ]
    )
  );

  const corsiTotal = (input.corsi?.home ?? 0) + (input.corsi?.away ?? 0);
  const hdTotal = (input.highDanger?.home ?? 0) + (input.highDanger?.away ?? 0);
  const hdShare =
    hdTotal > 0 ? (input.highDanger?.home ?? 0) / hdTotal : clampRange(reg.home, 0, 1);

  return {
    sport: "hockey",
    scoreA: input.homeScore,
    scoreB: input.awayScore,
    clock: `${Math.floor(secondsLeft / 60)}:${String(Math.floor(secondsLeft % 60)).padStart(2, "0")} ${period}e`,
    markets,
    drivers: [
      driver("Corsi", corsiTotal > 0 ? (input.corsi?.home ?? 0) / corsiTotal : 0.5, `${corsiTotal} shots`),
      driver("High-Danger", hdShare, `${hdTotal} chances`),
      driver(
        "Avantage numérique",
        ppTeam === "home" ? 1 : ppTeam === "away" ? 0 : 0.5,
        ppTeam === null ? "5c5" : `${ppTeam === "home" ? "Dom" : "Ext"} ${Math.ceil(ppSeconds / 60)}'`
      ),
      driver(
        "Écart",
        clampRange(0.5 + (input.homeScore - input.awayScore) / 6, 0, 1),
        input.homeScore - input.awayScore > 0
          ? `+${input.homeScore - input.awayScore}`
          : `${input.homeScore - input.awayScore}`
      ),
      driver(
        "TR restant",
        clampRange(minutesLeft / (PERIODS * PERIOD_MINUTES), 0, 1),
        `${minutesLeft.toFixed(1)} min`
      ),
    ],
  };
}