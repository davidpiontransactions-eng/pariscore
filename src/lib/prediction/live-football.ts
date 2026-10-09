/**
 * Moteur live FOOTBALL — marchés in-play.
 *
 * Réutilise `projectLiveMarkets` (`football-live-thresholds.ts`) pour le 1N2 et
 * les Over/Under : c'est déjà le modèle de référence du repo (xG live, profil
 * de phase Dixon & Robinson 1998, cartons rouges Cerveny 2016, calibration
 * marché O/U 2.5). Le réécrire ici serait une divergence silencieuse.
 *
 * Ce fichier ajoute ce qui manquait : les TROIS marchés d'événement court
 * (prochain but / prochain corner / prochain carton), absents de tout le code
 * football existant.
 */

import {
  projectLiveMarkets,
  type LiveProjectionInput,
  type LiveMarketsProjection,
} from "@/lib/football-live-thresholds";
import {
  clampRange,
  driver,
  market,
  nextScorerProbs,
  poissonAtLeast,
  type LiveBetsBundle,
  type LiveMarket,
} from "./live-common";

/** Minutes de football, temps additionnel inclus. */
const MATCH_MINUTES = 90;
/** λ total moyen 90' sans calibration (moyenne ligues top-5). */
const LEAGUE_GOALS_90 = 2.7;
/** Corners moyens par match (Europe, toutes compétitions) : 10.5. */
const LEAGUE_CORNERS_90 = 10.5;
/** Cartons jaunes moyens par match (≈ 4.2 toutes compétitions). */
const LEAGUE_CARDS_90 = 4.2;

/** Fenêtre du marché « prochain but » : durée typique d'une attaque. */
const NEXT_GOAL_WINDOW_MIN = 8;
/**
 * Fenêtre des marchés « prochain corner » / « prochain carton » : durée
 * typique d'un temps de jeu mort (corner ou carton survient en moyenne toutes
 * les 8 à 10 minutes, pas toutes les 25 restantes).
 *
 * Sans cette borne, le marché annonçait « aucun corner » à 2 % quasi partout
 * (λ ≈ 8 sur 60 minutes restantes rend l'occurrence certaine) : le marché
 * devenait inexploitable et son information nulle.
 */
const NEXT_EVENT_WINDOW_MIN = 9;

export type FootballLiveInput = {
  minute: number;
  homeScore: number;
  awayScore: number;
  /** xG cumulé live (source BSD). Optionnel — fallback taux pré-match. */
  homeXg?: number | null;
  awayXg?: number | null;
  /** Probabilités pré-match, en pourcentage (0-100). */
  prematch?: LiveProjectionInput["prematch"];
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  corners?: { home: number; away: number } | null;
  yellowCards?: { home: number; away: number } | null;
  /** Pressure Index (momentum signé, -100..100) des 30 dernières minutes. */
  pressureIndex?: number | null;
};

/**
 * λ résiduel par camp, en buts pour les minutes restantes.
 *
 * Même logique de taux que `projectLiveMarkets` (xG par minute × minutes
 * restantes), mais SANS le profil de phase : ici on projette sur une fenêtre
 * courte ou sur le temps restant brut, or le profil de phase ne change
 * meaningfully que sur l'échelle du match. Réutiliser la même base de taux
 * (xG/minute quand connu, moyenne de ligue sinon) garantit que le « prochain
 * but » reste cohérent avec le 1N2 affiché juste au-dessus.
 */
function remainingLambdas(input: FootballLiveInput): {
  lambdaHome: number;
  lambdaAway: number;
} {
  const minute = Math.max(1, Math.min(130, Math.round(input.minute || 1)));
  const stoppage = minute > MATCH_MINUTES ? 6 : 0;
  const remaining = Math.max(0, MATCH_MINUTES + stoppage - minute);

  const share = input.prematch
    ? clampRange((input.prematch.homeProb + input.prematch.drawProb / 2) / 100, 0.15, 0.85)
    : 0.5;

  const hasXg =
    Number.isFinite(input.homeXg) &&
    Number.isFinite(input.awayXg) &&
    (input.homeXg as number) >= 0 &&
    (input.awayXg as number) >= 0;

  let rateHome: number;
  let rateAway: number;
  if (hasXg) {
    rateHome = (input.homeXg as number) / minute;
    rateAway = (input.awayXg as number) / minute;
  } else {
    rateHome = (LEAGUE_GOALS_90 * share) / MATCH_MINUTES;
    rateAway = (LEAGUE_GOALS_90 * (1 - share)) / MATCH_MINUTES;
  }

  // Plancher : un xG quasi nul à la minute 3 ne veut pas dire « 0 but garanti ».
  const floor = LEAGUE_GOALS_90 * 0.4 / MATCH_MINUTES;
  rateHome = Math.max(rateHome, floor * share);
  rateAway = Math.max(rateAway, floor * (1 - share));

  return { lambdaHome: rateHome * remaining, lambdaAway: rateAway * remaining };
}

/**
 * λ résiduel corners / cartons, en événements pour les minutes restantes.
 *
 * Rétrécissement vers le prior de ligue : le taux observé est un TAUX par
 * minute (`observed / minute`), jamais un nombre. On le mélange avec le taux
 * de ligue pondéré par `PRIOR_STRENGTH` pseudo-événements — sans cela, 1
 * corner à la 67' projetterait 0 corner sur les 23 minutes restantes.
 *
 * ⚠️ Un dimensionnement fautif ici (`observed / minute × prior × k`, qui
 * multiplie un taux par un NOMBRE) donnait λ = 46 corners pour 8 corners
 * observés — invisible au typecheck, absurde à l'écran.
 */
const PRIOR_STRENGTH = 3;

function remainingEventLambda(
  observed: number | undefined | null,
  prior: number,
  minute: number,
  remaining: number
): number {
  const m = Math.max(1, minute);
  const priorRate = prior / MATCH_MINUTES;
  const obs =
    observed != null && Number.isFinite(observed) && observed > 0 ? observed : null;
  const rate =
    obs == null ? priorRate : (obs / m + priorRate * PRIOR_STRENGTH) / (1 + PRIOR_STRENGTH);
  return Math.max(priorRate, rate) * remaining;
}

/** Projette les 6 marchés live football. */
export function footballLiveMarkets(input: FootballLiveInput): LiveBetsBundle {
  const projection: LiveMarketsProjection = projectLiveMarkets({
    minute: input.minute,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    homeXg: input.homeXg,
    awayXg: input.awayXg,
    prematch: input.prematch ?? null,
    homeRedCards: input.homeRedCards,
    awayRedCards: input.awayRedCards,
  });

  const minute = Math.max(1, Math.min(130, Math.round(input.minute || 1)));
  const stoppage = minute > MATCH_MINUTES ? 6 : 0;
  const remaining = Math.max(0, MATCH_MINUTES + stoppage - minute);
  const { lambdaHome, lambdaAway } = remainingLambdas(input);

  const markets: LiveMarket[] = [];

  // ① 1N2 — modèle de référence (xG live + phase + cartons rouges).
  markets.push(
    market(
      "1n2",
      "match",
      "Vainqueur du match",
      "Poisson sur le temps restant, λ dérivé du xG cumulé live (profil de phase Dixon & Robinson 1998, cartons rouges Cerveny 2016).",
      [
        { id: "home", label: "Domicile", prob: projection.homeWin / 100 },
        { id: "draw", label: "Nul", prob: projection.draw / 100 },
        { id: "away", label: "Extérieur", prob: projection.awayWin / 100 },
      ]
    )
  );

  // ② Prochain but — qui marque en premier dans la fenêtre à venir.
  const windowShare = Math.min(1, NEXT_GOAL_WINDOW_MIN / Math.max(1, remaining));
  const nextGoal = nextScorerProbs(lambdaHome * windowShare, lambdaAway * windowShare);
  markets.push(
    market(
      "next-goal",
      "micro",
      `Prochain but (sous ${NEXT_GOAL_WINDOW_MIN} min)`,
      `Fenêtre de ${NEXT_GOAL_WINDOW_MIN} minutes : deux processus de Poisson indépendants de taux λ = ${(lambdaHome * windowShare).toFixed(2)} / ${(lambdaAway * windowShare).toFixed(2)}. « Aucun » = aucun but sur la fenêtre.`,
      [
        { id: "home", label: "Domicile", prob: nextGoal.a },
        { id: "none", label: "Aucun but", prob: nextGoal.none },
        { id: "away", label: "Extérieur", prob: nextGoal.b },
      ]
    )
  );

  // ③ Over/Under buts live — cumuls, pas restants.
  markets.push(
    market(
      "ou-goals-live",
      "match",
      "Over/Under buts live",
      "Distribution Poisson du score final (score courant + buts restants) sur la ligne 2.5 : au-delà de 2.5 = 3 buts ou plus.",
      [
        { id: "over25", label: "Over 2.5", prob: projection.over25 / 100 },
        { id: "under25", label: "Under 2.5", prob: projection.under25 / 100 },
      ]
    )
  );

  // ④ Prochain corner — λ sur la FENÊTRE, pas sur le temps restant.
  const cornersHome = input.corners?.home ?? null;
  const cornersAway = input.corners?.away ?? null;
  const cornerTotal =
    cornersHome != null && cornersAway != null ? cornersHome + cornersAway : null;
  const cornerWindow = Math.min(NEXT_EVENT_WINDOW_MIN, remaining);
  const cornerRate = remainingEventLambda(
    cornerTotal,
    LEAGUE_CORNERS_90,
    minute,
    cornerWindow
  );
  // Répartition par pression : plus l'équipe attaque, plus elle prend les corners.
  const homeCornerShare =
    cornerTotal != null && cornerTotal > 0 && cornersHome != null
      ? clampRange(cornersHome / cornerTotal, 0.2, 0.8)
      : 0.5;
  const nextCorner = nextScorerProbs(cornerRate * homeCornerShare, cornerRate * (1 - homeCornerShare));
  markets.push(
    market(
      "next-corner",
      "micro",
      "Prochain corner",
      `λ corners sur ${cornerWindow.toFixed(0)} min = ${cornerRate.toFixed(2)} (taux observé rétréci vers le prior de ligue 10.5/90'). Issues : domicile / aucun / extérieur.`,
      [
        { id: "home", label: "Domicile", prob: nextCorner.a },
        { id: "none", label: "Aucun corner", prob: nextCorner.none },
        { id: "away", label: "Extérieur", prob: nextCorner.b },
      ]
    )
  );

  // ⑤ Prochain carton.
  const cardsHome = input.yellowCards?.home ?? null;
  const cardsAway = input.yellowCards?.away ?? null;
  const cardTotal = cardsHome != null && cardsAway != null ? cardsHome + cardsAway : null;
  const cardWindow = Math.min(NEXT_EVENT_WINDOW_MIN, remaining);
  const cardRate = remainingEventLambda(cardTotal, LEAGUE_CARDS_90, minute, cardWindow);
  const homeCardShare =
    cardTotal != null && cardTotal > 0 && cardsHome != null
      ? clampRange(cardsHome / cardTotal, 0.2, 0.8)
      : 0.5;
  const nextCard = nextScorerProbs(cardRate * homeCardShare, cardRate * (1 - homeCardShare));
  markets.push(
    market(
      "next-card",
      "micro",
      "Prochain carton",
      `λ cartons sur ${cardWindow.toFixed(0)} min = ${cardRate.toFixed(2)} (prior de ligue 4.2/90'). Un carton est attendu toutes les ~21 minutes.`,
      [
        { id: "home", label: "Domicile", prob: nextCard.a },
        { id: "none", label: "Aucun carton", prob: nextCard.none },
        { id: "away", label: "Extérieur", prob: nextCard.b },
      ]
    )
  );

  // ⑥ But d'ici la fin du match (total des deux camps, issues exclusives).
  markets.push(
    market(
      "any-goal-o05",
      "match",
      "Un but ou plus d'ici la fin (O0.5)",
      `λ total restants = ${(lambdaHome + lambdaAway).toFixed(2)} buts. Issues exclusives : au moins un but sur les ${Math.round(remaining)} minutes restantes, ou rien.`,
      [
        { id: "over", label: "Over 0.5", prob: poissonAtLeast(1, lambdaHome + lambdaAway) },
        { id: "under", label: "Under 0.5", prob: 1 - poissonAtLeast(1, lambdaHome + lambdaAway) },
      ]
    )
  );

  const totalXg = (input.homeXg ?? 0) + (input.awayXg ?? 0);
  const pressure = input.pressureIndex ?? 0;

  return {
    sport: "football",
    scoreA: input.homeScore,
    scoreB: input.awayScore,
    clock: `${minute}'`,
    markets,
    drivers: [
      driver("xG cumulé", Math.min(1, totalXg / 4), totalXg > 0 ? `${totalXg.toFixed(2)} xG` : "n/d"),
      driver(
        "xG domicile",
        Math.min(1, (input.homeXg ?? 0) / 3),
        input.homeXg != null ? `${input.homeXg.toFixed(2)}` : "n/d"
      ),
      driver(
        "Pressure Index",
        (pressure + 100) / 200,
        pressure >= 0 ? `+${Math.round(pressure)}` : `${Math.round(pressure)}`
      ),
      driver("Temps restant", Math.max(0, remaining) / MATCH_MINUTES, `${Math.round(remaining)} min`),
    ],
  };
}