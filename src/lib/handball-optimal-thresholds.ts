// Recalibrage des seuils Over / Under Total Points (TOP 10).
//
// Problème constaté : le tableau TOP 10 affichait un « Over » dont la probabilité
// pré-match plafonnait à ~57-58 %, et un « Under » figé sur une ligne fixe
// (62.5). Deux causes distinctes, deux corrections.
//
// 1. Le seuil Over était trop HAUT pour la probabilité visée. On le choisit
//    désormais par optimisation : on remonte les demi-lignes depuis le total
//    attendu jusqu'à ce que la probabilité du côté joué atteigne `minProb`.
//    Plus le seuil est haut, plus la probabilité baisse — il s'agit donc de
//    trouver la ligne la PLUS CONSERVATRICE qui passe la barre, pas de
//    recalibrer un nombre en dur.
//
// 2. La dispersion du modèle était fausse. Le ν = 1.3 historique prédisait
//    σ_total = 4.5 buts alors que la mesure sur 35 matchs réels donne 7.25
//    (cf. handball-goals-calibration.ts). Avec cette dispersion trop faible,
//    `over55.5` vaut 0.0 % et `under62.5` vaut 100.0 % : aucune probabilité
//    intermédiaire n'existe, donc aucun seuil ne peut atteindre 65 % de façon
//    utile. On utilise ici le ν CALIBRÉ (mesure), pas CMP_DEFAULT_NU.
//
// Règle de valeur conservée : cote ≥ 1.15 exigée, sinon le pari n'est pas
// proposé (qualifies: false) — un « pari » à 1.02 n'est pas un pari.

import { CALIBRATED_NU, totalProbabilityOver } from "./handball-goals-calibration";
import { cmpLambdaForMean, cmpMean } from "./handball-cmp";
import {
  PARISCORE_MAX_PROB_PCT,
  PARISCORE_MIN_ODDS,
  PARISCORE_MIN_PROB_PCT,
} from "./handball-pariscore";

/** Statistiques d'équipe minimales pour estimer un seuil. */
export type ThresholdTeamStats = {
  /** Buts marqués par match (moyenne). */
  scoredAvg: number;
  /** Buts encaissés par match (moyenne). */
  concededAvg: number;
};

export type OptimalThreshold = {
  side: "over" | "under";
  /** Seuil en demi-points (ex. 54.5). */
  line: number;
  /** Probabilité du côté joué, 0-100. */
  prob: number;
  /** Cote du marché sur CETTE ligne, si fournie. */
  odds: number | null;
  /** P ≥ minProb ET (cote ≥ 1.15 si cote connue). */
  qualifies: boolean;
  /** Raison du refus, null si le pari est proposé. */
  rejectReason: string | null;
};

export type ThresholdOptions = {
  /** Probabilité cible, 0-100. Défaut 65. */
  minProb?: number;
  /** Cote minimale requise. Défaut 1.15. */
  minOdds?: number;
  /** Exposant de dispersion. Défaut : ν calibré sur données réelles. */
  nu?: number;
  /** Cotes disponibles par ligne ("54.5" → { over, under }). */
  oddsByLine?: Record<string, { over?: number; under?: number }>;
};

/**
 * λ de taux CMP d'une équipe pour une MOYENNE de buts donnée.
 * À ν = 1 (Poisson) λ = moyenne ; sinon il faut inverser (cf. cmpLambdaForMean).
 */
function rateFor(mean: number, nu: number): number {
  if (nu === 1) return Math.max(mean, 0.05);
  return cmpLambdaForMean(Math.max(mean, 0.05), nu);
}

/**
 * Taux CMP d'une rencontre.
 *
 * λ domicile = moyenne des buts marqués par le DOM et des buts encaissés par
 * l'EXT (ce que le Dom encaisse est ce que l'Ext peut marquer, et
 * réciproquement). L'avantage du terrain n'est PAS appliqué ici : il est déjà
 * inclus dans les moyennes observées de chaque équipe (une équipe marque plus
 * à domicile qu'à l'extérieur).
 */
function lambdas(home: ThresholdTeamStats, away: ThresholdTeamStats, nu: number) {
  // Garde-fou explicite : sans ça, un NaN traverse `cmpLambdaForMean` jusqu'à
  // `new Array(NaN)` dans cmpPmf → RangeError (plutôt qu'un null exploitable).
  for (const t of [home, away]) {
    if (!Number.isFinite(t?.scoredAvg) || !Number.isFinite(t?.concededAvg)) {
      return null;
    }
    if (t.scoredAvg < 0 || t.concededAvg < 0) return null;
  }
  const lambdaH = rateFor((home.scoredAvg + away.concededAvg) / 2, nu);
  const lambdaE = rateFor((away.scoredAvg + home.concededAvg) / 2, nu);
  if (!Number.isFinite(lambdaH) || !Number.isFinite(lambdaE)) return null;
  return { lambdaH, lambdaE };
}

/** Un total de buts sous ce plancher n'est pas un match de handball. */
const MIN_PLAUSIBLE_TOTAL = 10;

/** Cote d'une ligne, tolérante aux deux écritures ("60" et "60.0"). */
function oddsAt(
  map: Record<string, { over?: number; under?: number }> | undefined,
  line: number,
  side: "over" | "under",
): number | null {
  if (!map) return null;
  return map[String(round1(line))]?.[side] ?? map[line.toFixed(1)]?.[side] ?? null;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Seuil OVER optimal : la demi-ligne la plus proche du total attendu (donc la
 * plus prudente) dont la probabilité `P(total > line)` atteint `minProb`.
 *
 * Le parcours part du total attendu et remonte vers le haut : chaque demi-ligne
 * plus basse a une probabilité plus faible, donc si le premier point-centred
 * échoue, aucun seuil ne passe et on renvoie null.
 *
 * Plafond à 95 % : au-delà, la ligne est dégénérée (une quasi-certitude sur une
 * variable stochastique est un défaut de ligne, pas un coup gagnant).
 */
export function calculateOptimalOverGoals(
  home: ThresholdTeamStats,
  away: ThresholdTeamStats,
  minProb = PARISCORE_MIN_PROB_PCT,
  options: Omit<ThresholdOptions, "minProb"> = {},
): OptimalThreshold | null {
  const nu = options.nu ?? CALIBRATED_NU;
  const minOdds = options.minOdds ?? PARISCORE_MIN_ODDS;
  const lam = lambdas(home, away, nu);
  if (!lam) return null;
  const { lambdaH, lambdaE } = lam;
  const expected = cmpMean(lambdaH, nu) + cmpMean(lambdaE, nu);
  if (!Number.isFinite(expected) || expected < MIN_PLAUSIBLE_TOTAL) return null;

  // On DESCEND depuis le total attendu : plus le seuil est bas, plus
  // P(total > line) est haute. La première ligne qui atteint `minProb` est donc
  // la plus prudente possible — celle qui colle au marché.
  for (let line = Math.round(expected * 2) / 2; line >= expected - 16; line -= 0.5) {
    const p = totalProbabilityOver(lambdaH, nu, lambdaE, line);
    if (p == null) continue;
    const prob = round1(p * 100);
    if (prob < minProb) continue; // encore trop juste : on descend encore
    if (prob > PARISCORE_MAX_PROB_PCT) continue; // quasi-certitude : ligne dégénérée
    const odds = oddsAt(options.oddsByLine, line, "over");
    return {
      side: "over",
      line: round1(line),
      prob,
      odds,
      qualifies: odds == null || odds >= minOdds,
      rejectReason:
        odds != null && odds < minOdds
          ? `cote ${odds.toFixed(2)} < ${minOdds} : pari non retenu malgré ${prob} %`
          : null,
    };
  }
  return null;
}

/**
 * Seuil UNDER optimal : même logique en descendant sous le total attendu.
 *
 * Remplace la ligne fixe « Under 62.5 » : le seuil dépend désormais des deux
 * équipes (attaques ET défenses) et du rythme de la rencontre, au lieu d'être
 * identique pour tous les matchs de la ligue.
 */
export function calculateOptimalUnderGoals(
  home: ThresholdTeamStats,
  away: ThresholdTeamStats,
  minProb = PARISCORE_MIN_PROB_PCT,
  options: Omit<ThresholdOptions, "minProb"> = {},
): OptimalThreshold | null {
  const nu = options.nu ?? CALIBRATED_NU;
  const minOdds = options.minOdds ?? PARISCORE_MIN_ODDS;
  const lam = lambdas(home, away, nu);
  if (!lam) return null;
  const { lambdaH, lambdaE } = lam;
  const expected = cmpMean(lambdaH, nu) + cmpMean(lambdaE, nu);
  if (!Number.isFinite(expected) || expected < MIN_PLAUSIBLE_TOTAL) return null;

  // On MONTE depuis le total attendu : plus le seuil est haut, plus
  // P(total < line) est haute. Première ligne ≥ minProb = seuil le plus prudent.
  for (let line = Math.round(expected * 2) / 2; line <= expected + 16; line += 0.5) {
    const p = totalProbabilityOver(lambdaH, nu, lambdaE, line);
    if (p == null) continue;
    const prob = round1((1 - p) * 100);
    if (prob < minProb) continue;
    if (prob > PARISCORE_MAX_PROB_PCT) continue;
    const odds = oddsAt(options.oddsByLine, line, "under");
    return {
      side: "under",
      line: round1(line),
      prob,
      odds,
      qualifies: odds == null || odds >= minOdds,
      rejectReason:
        odds != null && odds < minOdds
          ? `cote ${odds.toFixed(2)} < ${minOdds} : pari non retenu malgré ${prob} %`
          : null,
    };
  }
  return null;
}

/**
 * Les deux seuils d'une rencontre, celui qui passe la cote en premier.
 *
 * Règle de choix : on privilégie la probabilité la plus haute, puis le seuil le
 * plus proche du total attendu (le moins extrême). `null` si aucun des deux
 * ne passe les deux contraintes — on ne force jamais un pari.
 */
export function pickOptimalTotalGoal(
  home: ThresholdTeamStats,
  away: ThresholdTeamStats,
  options: ThresholdOptions = {},
): OptimalThreshold | null {
  const over = calculateOptimalOverGoals(home, away, options.minProb, options);
  const under = calculateOptimalUnderGoals(home, away, options.minProb, options);
  const viable = [over, under].filter((t): t is OptimalThreshold => t != null && t.qualifies);
  if (viable.length === 0) return null;
  viable.sort((a, b) => b.prob - a.prob);
  return viable[0];
}
