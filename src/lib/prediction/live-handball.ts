/**
 * Moteur live HANDBALL — marchés in-play.
 *
 * Le handball est un sport de CONTACT PERMANENT : l'attaque ne s'arrête jamais,
 * pas de hors-jeu, pas de possession. Le λ résiduel est donc
 * `taux de buts par minute × minutes restantes`, sans partage ni fenêtre — c'est
 * le sport où le « prochain but » est le marché le plus naturel.
 *
 * Deux particularités :
 *   1. Pas de nul : tout écart compte, donc le 1X2 se réduit à 2 issues.
 *   2. L'écart de force (2 min de Numerical) est le levier de marché le plus
 *      rentable du handball : λ multiplié pendant la supériorité numérique.
 *
 * Réutilise `skellamPmf` de `@/lib/hockey/totals` (double sommation, sans
 * Bessel — voir l'en-tête de ce module) pour la distribution de l'écart : la
 * formule est identique quel que soit le sport, seule l'échelle de λ change.
 */

import { skellamPmf } from "@/lib/hockey/totals";
import {
  clampRange,
  driver,
  market,
  nextScorerProbs,
  poissonAtLeast,
  resolvedMarket,
  type LiveBetsBundle,
  type LiveMarket,
} from "./live-common";

/** Durée d'une période de handball. */
const HALF_MINUTES = 30;
/** Durée totale d'un match : 2 × 30 min. */
const MATCH_MINUTES = 60;
/** λ moyen par équipe sur 60 min (Starligue ≈ 28.5 buts). */
const LEAGUE_RATE = 28.5 / 60;
/** Fenêtre du marché « prochaine attaque » : une attaque dure ~90 s. */
const ATTACK_WINDOW_MIN = 1.5;
/**
 * Multiplicateur λ de l'attaque en avantage numérique 2 contre 1.
 *
 * Un joueur de plus sur le terrain augmente la production de l'équipe sur la
 * fenêtre de l'infériorité (le « tier » de handball) ; le multiplicateur est
 * volontairement modéré pour ne pas promettre un ratio de 3× qui n'existe pas.
 */
const MAN_ADVANTAGE_MULTIPLIER = 2.3;
/** P(marquage d'une attaque jouée, tir exterior + gardien). */
const OPEN_SHOT_SCORE_PROB = 0.55;
/** P(succès d'un 7 m) — taux league (≈ 82 %). */
const SEVEN_M_SCORE_PROB = 0.82;
/** Part des attaques terminées en 7 m (%). */
const LEAGUE_SEVEN_M_RATE = 30;

export type HandballLiveInput = {
  /** Minute en cours, 0-60. */
  minute: number;
  homeScore: number;
  awayScore: number;
  /** Score à la mi-temps. Optionnel → marché mi-temps indisponible. */
  halfTimeScore?: { home: number; away: number } | null;
  /** Équipe en avantage numérique (2 min de suspension). */
  manAdvantage?: "home" | "away" | null;
  /** Secondes restantes de l'avantage numérique en cours. */
  manAdvantageSecondsLeft?: number | null;
  /** % d'arrêts du gardien par équipe (0-100). */
  saveRate?: { home: number; away: number } | null;
  /** Vitesse de transition (ratio league = 1). */
  transitionSpeed?: number | null;
  /** % des attaques terminées en 7 m (0-100). */
  sevenMeterRate?: number | null;
};

/** Minutes restantes jusqu'à la fin du match. */
function matchMinutesLeft(input: HandballLiveInput): number {
  return Math.max(0, MATCH_MINUTES - clampRange(input.minute, 0, MATCH_MINUTES));
}

/**
 * λ par équipe sur le temps restant.
 *
 * λ = taux observé (buts/min) si assez de recul, sinon prior de ligue. Le
 * % d'arrêts du gardien tilt la PARTITION (un gardien à 70 % d'arrêts réduit
 * le λ adverse d'environ 5 % par point d'écart au-dessus de 65 %) ; la vitesse
 * de transition tilt le λ ABSOLU (match à 1.2× marque 20 % de plus).
 */
function matchLambdas(input: HandballLiveInput): {
  lambdaHome: number;
  lambdaAway: number;
} {
  const minutes = matchMinutesLeft(input);
  const minute = clampRange(input.minute, 0, MATCH_MINUTES);

  let rateHome = LEAGUE_RATE;
  let rateAway = LEAGUE_RATE;
  if (minute >= 8) {
    rateHome = Math.max(LEAGUE_RATE * 0.6, input.homeScore / minute);
    rateAway = Math.max(LEAGUE_RATE * 0.6, input.awayScore / minute);
  }

  // Avantage numérique : multiplicateur appliqué à la part de la fenêtre
  // d'infériorité encore à jouer dans le match.
  const maMinutes = clampRange(input.manAdvantageSecondsLeft ?? 0, 0, 120) / 60;
  if (input.manAdvantage != null && maMinutes > 0 && minutes > 0) {
    const share = Math.min(1, maMinutes / minutes);
    const bump = 1 + (MAN_ADVANTAGE_MULTIPLIER - 1) * share;
    if (input.manAdvantage === "home") rateHome *= bump;
    else rateAway *= bump;
  }

  const saves = input.saveRate;
  if (saves) {
    // `save` est un POURCENTAGE (30-90) ; le seuil neutre est 65, pas 0.65.
    // Avec un seuil en fraction, (0.65 − 78).valait −77 et tout partait dans
    // la borne basse : le % d'arrêts n'avait AUCUN effet sur la projection.
    const factor = (save: number) =>
      clampRange(1 + (65 - clampRange(save, 30, 90)) * 0.01, 0.85, 1.15);
    rateHome *= factor(saves.away);
    rateAway *= factor(saves.home);
  }

  const speed = clampRange(input.transitionSpeed ?? 1, 0.6, 1.5);
  return { lambdaHome: rateHome * speed * minutes, lambdaAway: rateAway * speed * minutes };
}

/** P(gagne) — 2 issues, pas de nul au handball. */
function winProb(
  scoreHome: number,
  scoreAway: number,
  lambdaHome: number,
  lambdaAway: number
): { home: number; away: number } {
  const span = 20;
  const margin = skellamPmf(lambdaHome, lambdaAway, span);
  const diff = scoreHome - scoreAway;
  let home = 0;
  let away = 0;
  for (let d = -span; d <= span; d++) {
    const p = margin[d + span];
    if (diff + d > 0) home += p;
    else if (diff + d < 0) away += p;
  }
  const sum = home + away || 1;
  return { home: home / sum, away: away / sum };
}

/** P(X = k), X ~ Poisson(λ) — puissances successives, pas de dépassement. */
function poissonPmf(k: number, lambda: number): number {
  if (!Number.isInteger(k) || k < 0) return 0;
  if (!(lambda > 0)) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p = (p * lambda) / i;
  return p;
}

/** PMF du TOTAL (somme de deux Poisson) — convolution, PAS Skellam. */
function totalPmf(lambdaHome: number, lambdaAway: number, max = 20): number[] {
  const out = new Array<number>(max + 1).fill(0);
  for (let i = 0; i <= max; i++) {
    const p1 = poissonPmf(i, lambdaHome);
    if (p1 === 0 && i > lambdaHome) break;
    for (let j = 0; i + j <= max; j++) out[i + j] += p1 * poissonPmf(j, lambdaAway);
  }
  return out;
}

/** Projette les marchés live handball. */
export function handballLiveMarkets(input: HandballLiveInput): LiveBetsBundle {
  const minute = clampRange(input.minute, 0, MATCH_MINUTES);
  const minutesLeft = matchMinutesLeft(input);
  const { lambdaHome, lambdaAway } = matchLambdas(input);

  const markets: LiveMarket[] = [];

  // ① Vainqueur du match.
  const final = winProb(input.homeScore, input.awayScore, lambdaHome, lambdaAway);
  const finishRows = [
    { id: "home", label: "Domicile", prob: final.home },
    { id: "away", label: "Extérieur", prob: final.away },
  ];
  const finishHint = `λ restants = ${lambdaHome.toFixed(1)} / ${lambdaAway.toFixed(1)} buts (taux observé par minute, ajusté des arrêts du gardien et de la vitesse de transition). Pas de nul : 2 issues exclusives.`;
  // Au coup de sifflet final (minute ≥ 60), l'issue est tranchée : aucune
  // borne, sinon un match terminé s'afficherait « 98 % ».
  markets.push(
    minutesLeft <= 0
      ? resolvedMarket("match-winner", "match", "Vainqueur du match", finishHint, finishRows)
      : market("match-winner", "match", "Vainqueur du match", finishHint, finishRows)
  );

  // ② Vainqueur à la mi-temps.
  const halfTime = input.halfTimeScore ?? null;
  if (minute > HALF_MINUTES) {
    // Mi-temps passée : le marché est ARCHIVÉ, pas prédit. Sans score de
    // mi-temps fourni (flux BSD sans `halfTimeScore`), on retombe sur le
    // score courant — ce qui était un crash `null.home` sur toute seconde
    // période d'un match sans donnée de pause.
    const ht = halfTime ?? { home: input.homeScore, away: input.awayScore };
    const lead = ht.home - ht.away;
    const rows = [
      { id: "home", label: "Domicile", prob: lead >= 0 ? 1 : 0 },
      { id: "away", label: "Extérieur", prob: lead < 0 ? 1 : 0 },
    ];
    const hint = `Mi-temps atteinte (${ht.home}-${ht.away}) : marché archivé, plus aucun pari possible.`;
    markets.push(
      lead === 0
        ? // Égalité : ni l'un ni l'autre ne gagne la mi-temps → issues non
          // factuellement tranchées, on garde le bornage anti-0/100 %.
          market("half-time-winner", "period", "Vainqueur mi-temps", hint, [
            { id: "home", label: "Domicile", prob: 0.5 },
            { id: "away", label: "Extérieur", prob: 0.5 },
          ])
        : resolvedMarket("half-time-winner", "period", "Vainqueur mi-temps", hint, rows)
    );
  } else {
    const toHalf = Math.max(0, HALF_MINUTES - minute);
    const halfShare = toHalf / Math.max(1, minutesLeft + toHalf);
    const half = winProb(
      input.homeScore,
      input.awayScore,
      lambdaHome * halfShare,
      lambdaAway * halfShare
    );
    markets.push(
      market(
        "half-time-winner",
        "period",
        "Vainqueur à la mi-temps",
        `λ restreints aux ${toHalf.toFixed(1)} min avant la pause : ${(lambdaHome * halfShare).toFixed(1)} / ${(lambdaAway * halfShare).toFixed(1)} buts.`,
        [
          { id: "home", label: "Domicile", prob: half.home },
          { id: "away", label: "Extérieur", prob: half.away },
        ]
      )
    );
  }

  // ③ Impact de l'avantage numérique — marché signature du handball :
  // l'équipe en infériorité encaisse combien de buts sur la fenêtre ?
  const maTeam = input.manAdvantage ?? null;
  const maSeconds = clampRange(input.manAdvantageSecondsLeft ?? 0, 0, 120);
  if (maTeam !== null && maSeconds > 0) {
    const lambdaMA =
      ((maTeam === "home" ? lambdaHome : lambdaAway) / Math.max(1, minutesLeft)) *
      MAN_ADVANTAGE_MULTIPLIER *
      (maSeconds / 60);
    const over1 = poissonAtLeast(1, lambdaMA);
    const over2 = poissonAtLeast(2, lambdaMA);
    markets.push(
      market(
        "two-minute-impact",
        "micro",
        `Impact ${maSeconds}s d'avantage numérique`,
        `λ sur la fenêtre d'infériorité = ${lambdaMA.toFixed(2)} buts (taux de l'attaque en force × ${MAN_ADVANTAGE_MULTIPLIER} × ${(maSeconds / 60).toFixed(1)} min). Issues exclusives : au moins 1 but, ou aucun.`,
        [
          { id: "over1", label: "Au moins 1 but", prob: over1 },
          { id: "none", label: "Aucun but", prob: 1 - over1 },
        ]
      )
    );
    // P(≥ 2 buts) reste une information utile mais n'est PAS une issue du
    // marché précédent (les deux seuils ne sont pas exclusifs entre eux).
    markets.push(
      market(
        "two-minute-impact-2plus",
        "micro",
        `Impact ${maSeconds}s : au moins 2 buts`,
        `λ = ${lambdaMA.toFixed(2)} buts sur la fenêtre. Issues exclusives : 2 buts ou plus, ou moins de 2.`,
        [
          { id: "over2", label: "2 buts ou plus", prob: over2 },
          { id: "under2", label: "Moins de 2 buts", prob: 1 - over2 },
        ]
      )
    );
  }

  // ④ Issue de la prochaine attaque — but ou pas. Probabilité de marquage
  // d'une attaque = mélange du tir en jeu et du 7 m.
  const sevenRate = clampRange((input.sevenMeterRate ?? LEAGUE_SEVEN_M_RATE) / 100, 0.15, 0.45);
  const attackScoreProb = clampRange(
    (1 - sevenRate) * OPEN_SHOT_SCORE_PROB + sevenRate * SEVEN_M_SCORE_PROB,
    0.3,
    0.85
  );
  const windowShare = Math.min(1, ATTACK_WINDOW_MIN / Math.max(1, minutesLeft));
  const scoringSide = nextScorerProbs(lambdaHome * windowShare, lambdaAway * windowShare);
  // Le camp qui attaque emporte la fenêtre avec probabilité proportionnelle à
  // sa part de λ ; le marché ne distingue pas « qui » — seulement « but ou pas ».
  const scoreProb = clampRange(attackScoreProb * (scoringSide.a + scoringSide.b), 0.02, 0.98);
  markets.push(
    market(
      "next-attack",
      "micro",
      "Prochaine attaque marquée",
      `Fenêtre d'une attaque (~${(ATTACK_WINDOW_MIN * 60).toFixed(0)} s). P(marquage) = ${(attackScoreProb * 100).toFixed(0)} % × P(la fenêtre contient une tentative) : tir en jeu ${(OPEN_SHOT_SCORE_PROB * 100).toFixed(0)} %, 7 m à ${(sevenRate * 100).toFixed(0)} % convertis à ${(SEVEN_M_SCORE_PROB * 100).toFixed(0)} %.`,
      [
        { id: "scored", label: "Attaque marquée", prob: scoreProb },
        { id: "empty", label: "Attaque infructueuse", prob: 1 - scoreProb },
      ]
    )
  );

  // ⑤ Total buts match — ligne ajustée au score courant + λ restants.
  const currentTotal = input.homeScore + input.awayScore;
  const ouLine = Math.ceil((currentTotal + lambdaHome + lambdaAway) * 2) / 2;
  const pmfTotal = totalPmf(lambdaHome, lambdaAway);
  const needed = ouLine - currentTotal;
  let over = 0;
  for (let k = 0; k < pmfTotal.length; k++) {
    if (k >= needed) over += pmfTotal[k];
  }
  markets.push(
    market(
      "ou-total",
      "match",
      `Over/Under ${ouLine} buts`,
      `Ligne ajustée au score courant + λ restants (${(currentTotal + lambdaHome + lambdaAway).toFixed(1)} attendus au total). Convolution Poisson des deux camps.`,
      [
        { id: "over", label: `Over ${ouLine}`, prob: over },
        { id: "under", label: `Under ${ouLine}`, prob: 1 - over },
      ]
    )
  );

  const lead = input.homeScore - input.awayScore;
  const saveHome = clampRange(input.saveRate?.home ?? 65, 30, 90);
  const saveAway = clampRange(input.saveRate?.away ?? 65, 30, 90);

  return {
    sport: "handball",
    scoreA: input.homeScore,
    scoreB: input.awayScore,
    clock: `${Math.floor(minute)}'`,
    markets,
    drivers: [
      driver("Arrêts gardien dom.", saveHome / 100, `${saveHome.toFixed(0)} %`),
      driver("Arrêts gardien ext.", saveAway / 100, `${saveAway.toFixed(0)} %`),
      driver(
        "Vitesse transition",
        clampRange((input.transitionSpeed ?? 1) / 1.5, 0, 1),
        `${((input.transitionSpeed ?? 1) * 100).toFixed(0)} %`
      ),
      driver(
        "Avantage numérique",
        maTeam === "home" ? 1 : maTeam === "away" ? 0 : 0.5,
        maTeam === null ? "—" : `${maTeam === "home" ? "Dom" : "Ext"} ${Math.ceil(maSeconds)}s`
      ),
      driver("Écart", clampRange(0.5 + lead / 12, 0, 1), lead > 0 ? `+${lead}` : `${lead}`),
      driver("Temps restant", clampRange(minutesLeft / MATCH_MINUTES, 0, 1), `${minutesLeft.toFixed(0)} min`),
    ],
  };
}