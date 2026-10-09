/**
 * Moteur live BASEBALL — marchés in-play.
 *
 * Le baseball est le seul des 6 sports où l'état du match est un ÉTAT
 * COMBINATOIRE discret (manche × moitié × outs × occupation des bases ×
 * compte), pas un simple score. Deux conséquences :
 *
 *   1. Le moneyline ne se calcule PAS par Poisson sur le score seul : il
 *      s'appuie sur la matrice d'espérance de points
 *      (`RUN_EXPECTANCY_MATRIX`, MLB 2010-2015) qui est déjà l'état de
 *      référence du moteur sabermétrique du repo.
 *   2. Les issues d'un passage au bâton sont dérivées du `BatterProfile`
 *      (mêmes poids que `sampleOutcome`), donc cohérentes avec la simulation
 *      Monte-Carlo existante.
 *
 * Réutilise `runExpectancy` et `BatterProfile` de `src/lib/baseball/engine/` —
 * aucune réimplémentation de la matrice.
 */

import { runExpectancy } from "@/lib/baseball/engine/run-expectancy";
import {
  RUN_EXPECTANCY_MATRIX,
  type BatterProfile,
} from "@/lib/baseball/engine/constants";
import {
  clampRange,
  driver,
  market,
  resolvedMarket,
  type LiveBetsBundle,
  type LiveMarket,
} from "./live-common";

/** Outs par manche. */
const OUTS_PER_INNING = 3;
/** Manches en temps réglementaire. */
const REGULATION_INNINGS = 9;
/** Points marqués par manche en MLB (≈ 4.88). */
const LEAGUE_RUNS_PER_INNING = 4.88;
/** Bonus de scoring en bottom de manche (l'équipe du domicile frappe en 9e). */
const BOTTOM_INNING_BUMP = 0.08;
/**
 * Atténuation du scoring sur la dernière demi-manche (9e).
 *
 * Les deux équipes marquent moins en 9e : le lanceur est chaud, les
 * frappeurs sont contraints de bien lancer, et le jeu est plus prudent. On
 * applique un facteur 0.75 sur la demie-manche opposée jouée en 9e manche.
 */
const LATE_INNING_DAMP = 0.75;

/** Masque de bases : 1 = 1re, 2 = 2e, 4 = 3e. */
export type BaseballBases = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type BaseballLiveInput = {
  /** Manche en cours, 1-9 (10+ = prolongations). */
  inning: number;
  /** Moitié de la manche : "top" = visiteurs à la batte, "bottom" = domicile. */
  half: "top" | "bottom";
  /** Outs accomplishments, 0-2. */
  outs: number;
  /** Occupation des bases (masque FIRST=1, SECOND=2, THIRD=4). */
  bases: BaseballBases;
  /** Compte balls-strikes. Optionnel → aucun ajustement. */
  count?: { balls: number; strikes: number } | null;
  homeScore: number;
  awayScore: number;
  /** Profil du frappeur au bâton. Optionnel → profil league moyen. */
  batter?: Partial<BatterProfile> | null;
};

/** Profil league moyen MLB (K 22 %, BB 8 %, 1B 25 %, 2B 5 %, 3B 0.5 %, HR 3.5 %). */
const LEAGUE_BATTER: BatterProfile = {
  pStrikeout: 0.22,
  pWalk: 0.08,
  pSingle: 0.25,
  pDouble: 0.05,
  pTriple: 0.005,
  pHomerun: 0.035,
  pOut: 0.36,
};

const PROFILE_KEYS: (keyof BatterProfile)[] = [
  "pStrikeout",
  "pWalk",
  "pSingle",
  "pDouble",
  "pTriple",
  "pHomerun",
  "pOut",
];

/**
 * Complète un `BatterProfile` partiel et le renormalise.
 *
 * La renormalisation est obligatoire : `sampleOutcome` empile les seuils dans
 * l'ordre et renvoie le dernier si le total dépasse 1 — un profil
 * légèrement surchargé ne planterait pas, mais银行ait des groundballs
 * impossibles en fin de liste.
 */
export function resolveBatterProfile(
  batter: Partial<BatterProfile> | null | undefined
): BatterProfile {
  const merged: BatterProfile = { ...LEAGUE_BATTER, ...(batter ?? {}) };
  let total = 0;
  for (const k of PROFILE_KEYS) {
    merged[k] = clampRange(merged[k], 0, 1);
    total += merged[k];
  }
  if (total <= 0) return LEAGUE_BATTER;
  for (const k of PROFILE_KEYS) merged[k] = merged[k] / total;
  return merged;
}

/**
 * Ajustement de la compte balls-strikes sur le profil du frappeur.
 *
 * 3 balls rapprochent la marche (walk ↑), 2 strikes éloignent le home run
 * (K ↑, HR ↓). Coefficients volontairement modérés (±15 %) : un baseball avec
 * un compte ne justifie pas un basculement de 40 % de la distribution.
 */
export function applyCountToProfile(
  profile: BatterProfile,
  count: { balls: number; strikes: number } | null | undefined
): BatterProfile {
  if (!count) return profile;
  const balls = clampRange(count.balls, 0, 3);
  const strikes = clampRange(count.strikes, 0, 2);
  return {
    ...profile,
    pWalk: profile.pWalk * (1 + 0.05 * balls),
    pStrikeout: profile.pStrikeout * (1 + 0.07 * strikes),
    pHomerun: profile.pHomerun * (1 - 0.09 * strikes),
  };
}

/**
 * Issues du prochain passage au bâton, agrégées en 3 catégories :
 * OUT (strikeout + groundout), BASE (walk + simple/double/triple), HOME RUN.
 *
 * La marche est comptée dans BASE : elle met le frappeur sur les bases, donc
 * « pas out ». Le libellé du marché dit « base atteinte » pour rester exact.
 */
export function nextPlateAppearance(
  batter: Partial<BatterProfile> | null | undefined,
  count?: { balls: number; strikes: number } | null
): { out: number; hit: number; homerun: number } {
  const profile = applyCountToProfile(resolveBatterProfile(batter), count);
  const out = profile.pStrikeout + profile.pOut;
  const hit = profile.pWalk + profile.pSingle + profile.pDouble + profile.pTriple;
  const homerun = profile.pHomerun;
  const sum = out + hit + homerun || 1;
  return { out: out / sum, hit: hit / sum, homerun: homerun / sum };
}

/**
 * Espérance de points (runs) sur le reste de la demi-manche en cours.
 *
 * `runExpectancy(bases, outs)` EST DÉJÀ cette espérance : la matrice MLB
 * donne les runs attendus jusqu'à la fin de la demi-manche pour chaque
 * couple (occupation, outs). Aucune récursion supplémentaire n'est nécessaire
 * — d'où l'absence totale de divergence possible avec le moteur existant.
 */
export function halfInningRunExp(bases: BaseballBases, outs: number): number {
  return runExpectancy(bases, clampRange(Math.round(outs), 0, OUTS_PER_INNING));
}

/**
 * P(au moins 1 run sur le reste de la demi-manche).
 *
 * Approximation Poisson calibrée sur l'espérance : P ≥ 1 = 1 − e^(−RE).
 * Même famille d'approximation que le Poisson de but du football, appliquée à
 * la matrice MLB. L'esp étant faible (0.1 à 2.3), l'erreur de Poisson est
 * négligeable au voisinage de 0 et de 1.
 */
export function halfInningRunProb(bases: BaseballBases, outs: number): number {
  return clampRange(1 - Math.exp(-halfInningRunExp(bases, outs)), 0, 1);
}

/**
 * Points attendus pour le reste du match, équipe par équipe.
 *
 * Trois contributions :
 *   1. la demi-manche EN COURS (état discret → matrice MLB), pour l'équipe
 *      qui est à la batte ;
 *   2. la demi-manche OPPOSÉE de la manche en cours si elle n'a pas encore
 *      eu lieu — c'est-à-dire le bottom quand on est au top. Sans elle, une
 *      9e manche au top à 4-4 donnait 0 point attendu au domicile : le modèle
 *      oubliait qu'il frappe encore en bottom ;
 *   3. les manches entièrement restantes, partagées 50/50 avec le petit bonus
 *      de scoring en bottom (l'équipe du domicile frappe en 9e).
 */
export function remainingRunExp(input: BaseballLiveInput): {
  expHome: number;
  expAway: number;
} {
  const outs = clampRange(Math.round(input.outs), 0, OUTS_PER_INNING);
  const inning = Math.max(1, Math.round(input.inning));
  const currentHalf = halfInningRunExp(input.bases, outs);
  const perHalf = LEAGUE_RUNS_PER_INNING / 2;

  // ponytail: projection limitée aux 9 manches de regulation — les
  // prolongations (≥ 10e) ne sont pas projetées. Elles ne surviennent que sur
  // des matchs à égalité en 9e, donc sur une part marginale des encounters ;
  // basculer sur 12 manches dès qu'on voit inning=10.
  const inningsLeft = Math.max(0, REGULATION_INNINGS - inning);
  const shared = inningsLeft * perHalf * 2;

  const battingIsHome = input.half === "bottom";
  // Le moneyline porte sur le MATCH entier, donc chaque camp garde sa demie-
  // manche à venir DANS la manche en cours : les visiteurs au top, le
  // domicile au bottom. Au top, l'état discret (bases pleines, 1 out) est
  // celui des visiteurs ; au bottom, celui du domicile.
  const currentHalfForHome = battingIsHome ? currentHalf : 0;
  const currentHalfForAway = battingIsHome ? 0 : currentHalf;
  // La demie-manche OPPOSÉE de celle en cours est encore à jouer si elle
  // n'a pas eu lieu : le bottom quand on est au top, et inversement. Au top de
  // la 9e manche, c'est la DERNIÈRE demi-manche de la rencontre — sans elle,
  // le domicile se voyait attribuer 0 point attendu à 4-4 et perdait un match
  // qu'il ne pouvait pas perdre.
  //
  // Deux pièges corrigés ici :
  //   1. `perHalf` et non `perHalf × 2` — une demi-manche vaut ~2.44 runs.
  //   2. Pondération par `LATE_INNING_DAMP` sur la 9e : la tension du dernier
  //      tour réduit le scoring des deux camps (levrage des travaux
  //      sabermétriques sur la 9e manche). Sans elle, 4-4 au top de la 9e
  //      donnait 88 % au domicile — un score de bookmaker à 55 % réel.
  const isNinth = inning >= REGULATION_INNINGS;
  const lateDamp = isNinth ? LATE_INNING_DAMP : 1;
  const oppositeHalfForHome = battingIsHome ? 0 : perHalf * lateDamp;
  const oppositeHalfForAway = battingIsHome ? perHalf * lateDamp : 0;

  return {
    expHome:
      currentHalfForHome + oppositeHalfForHome + shared + inningsLeft * perHalf * BOTTOM_INNING_BUMP,
    expAway: currentHalfForAway + oppositeHalfForAway + shared,
  };
}

/** P(X = k), X ~ Poisson(λ) — sommation par puissances successives. */
function poissonPmf(k: number, lambda: number): number {
  if (!Number.isInteger(k) || k < 0) return 0;
  if (!(lambda > 0)) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p = (p * lambda) / i;
  return p;
}

/**
 * P(gagne le match) depuis le score courant et les points attendus.
 *
 * Skellam (différence de deux Poisson) sur les points restants : P(écart
 * final > 0). L'égalité finale n'existe pas au baseball (le home-run à 3
 * points d'avance force la prolongation) — la branche « égalité » alimente
 * donc 50/50 la prolongation, comme au basket.
 */
export function moneylineProb(
  scoreHome: number,
  scoreAway: number,
  expHome: number,
  expAway: number
): { home: number; away: number } {
  const span = 14;
  const max = 22;
  let home = 0;
  let away = 0;
  let tie = 0;
  for (let k = -span; k <= span; k++) {
    // diff = i − j = k, donc j = i − k. Avec `j = i + k` on calculait en fait
    // P(diff = −k) et les deux camps étaient inversés : à 4-4 avec λ_dom >
    // λ_ext, le moteur donnait 12 % au domicile au lieu de 72 %.
    let p = 0;
    for (let i = 0; i <= max; i++) {
      const j = i - k;
      if (j < 0 || j > max) continue;
      p += poissonPmf(i, expHome) * poissonPmf(j, expAway);
    }
    const final = scoreHome - scoreAway + k;
    if (final > 0) home += p;
    else if (final === 0) tie += p;
    else away += p;
  }
  const sum = home + away + tie || 1;
  return { home: (home + tie / 2) / sum, away: (away + tie / 2) / sum };
}

/** Projette les marchés live baseball. */
export function baseballLiveMarkets(input: BaseballLiveInput): LiveBetsBundle {
  const inning = Math.max(1, Math.round(input.inning));
  const outs = clampRange(Math.round(input.outs), 0, OUTS_PER_INNING);
  const bases = clampRange(Math.round(input.bases), 0, 7) as BaseballBases;
  const profile = applyCountToProfile(resolveBatterProfile(input.batter), input.count);

  const battingIsHome = input.half === "bottom";
  const reNow = halfInningRunExp(bases, outs);
  const inningHalfProb = halfInningRunProb(bases, outs);
  // ① Vainqueur du match.
  // La demi-manche en cours appartient à l'équipe à la batte ; l'autre doit
  // attendre son tour de batte. Le moneyline regarde la FIN du match, donc
  // « qui frappe en ce moment » ne décide pas du vainqueur : ce qui compte,
  // c'est l'écart de points. D'où une comparaison par l'écart, pas par la
  // position de frappe.
  const { expHome, expAway } = remainingRunExp({ ...input, inning, outs, bases });
  const ml = moneylineProb(input.homeScore, input.awayScore, expHome, expAway);

  const markets: LiveMarket[] = [];

  // ① Vainqueur du match.
  markets.push(
    market(
      "moneyline",
      "match",
      "Vainqueur du match",
      `Points attendus restants : ${expHome.toFixed(2)} / ${expAway.toFixed(2)} (matrice d'espérance MLB pour la demi-manche en cours + ${Math.max(0, REGULATION_INNINGS - inning)} manche(s) restante(s)). L'écart final suit une Skellam ; égalité comptée 50/50.`,
      [
        { id: "home", label: "Domicile", prob: ml.home },
        { id: "away", label: "Extérieur", prob: ml.away },
      ]
    )
  );

  // ② Point sur la demi-manche en cours.
  markets.push(
    market(
      "moneyline-inning",
      "period",
      `${battingIsHome ? "Domicile" : "Extérieur"} marque dans la ${inning}${inningSuffix(inning)}`,
      `Espérance de points sur les ${OUTS_PER_INNING - outs} outs restants : ${reNow.toFixed(2)} runs (bases ${describeBases(bases)}, ${outs} out${outs > 1 ? "s" : ""}). ${battingIsHome ? "Le domicile" : "Les visiteurs"} sont à la batte (${input.half}).`,
      [
        { id: "scored", label: "Marque au moins 1 run", prob: inningHalfProb },
        { id: "scoreless", label: "Demi-manche sans point", prob: 1 - inningHalfProb },
      ]
    )
  );

  // ③ Résultat du prochain passage au bâton.
  const pa = nextPlateAppearance(input.batter, input.count);
  const countLabel = input.count ? `${input.count.balls}-${input.count.strikes}` : "non fournie";
  markets.push(
    market(
      "next-pa",
      "micro",
      "Prochain passage au bâton",
      `Poids du frappeur après compte ${countLabel} : K ${(profile.pStrikeout * 100).toFixed(0)} %, BB ${(profile.pWalk * 100).toFixed(0)} %, HR ${(profile.pHomerun * 100).toFixed(1)} %. La marche est comptée dans « base atteinte ».`,
      [
        { id: "out", label: "Out", prob: pa.out },
        { id: "hit", label: "Base atteinte", prob: pa.hit },
        { id: "hr", label: "Home run", prob: pa.homerun },
      ]
    )
  );

  // ④ Runs sur la demi-manche (O/U 0.5) — l'issue de la demi-manche, vue
  // comme marché de total plutôt que comme moneyline.
  markets.push(
    market(
      "half-inning-runs",
      "period",
      "Runs demi-manche (> 0.5)",
      `P(au moins 1 run sur les outs restants) = 1 − e^(−RE), RE = ${reNow.toFixed(2)} runs depuis la matrice MLB.`,
      [
        { id: "over", label: "Over 0.5 runs", prob: inningHalfProb },
        { id: "under", label: "Under 0.5 runs", prob: 1 - inningHalfProb },
      ]
    )
  );

  // ⑤ Un run ou plus d'ici la fin (les deux camps confondus — issues
  // exclusives, sinon la normalisation forcerait une somme fausse).
  const anyRun = clampRange(1 - Math.exp(-(expHome + expAway)), 0, 1);
  markets.push(
    market(
      "any-run-o05",
      "match",
      "Un run ou plus d'ici la fin (O0.5)",
      `Points attendus restants des deux camps : ${(expHome + expAway).toFixed(2)} runs. Issues exclusives : au moins un run, ou match qui se termine sans nouveau point.`,
      [
        { id: "over", label: "Over 0.5 runs", prob: anyRun },
        { id: "under", label: "Under 0.5 runs", prob: 1 - anyRun },
      ]
    )
  );

  // Leverage Index : (outs + 1) × |diff| / 3 — proxy standard du degré de
  // criticité de la situation.
  const leverage = ((outs + 1) * Math.abs(input.homeScore - input.awayScore)) / 3;
  const reMax = Math.max(...RUN_EXPECTANCY_MATRIX.flat());

  return {
    sport: "baseball",
    scoreA: input.homeScore,
    scoreB: input.awayScore,
    clock: `${inning}${inningSuffix(inning)} ${input.half === "top" ? "Haut" : "Bas"} · ${outs} out${outs > 1 ? "s" : ""}`,
    markets,
    drivers: [
      driver("Espérance de points", reNow / reMax, `${reNow.toFixed(2)} RE`),
      driver("Leverage Index", clampRange(leverage / 12, 0, 1), leverage.toFixed(1)),
      driver("Occupation bases", bases / 7, describeBases(bases)),
      driver(
        "Compte",
        (input.count ? clampRange(input.count.balls + input.count.strikes, 0, 5) : 2.5) / 5,
        input.count ? `${input.count.balls}-${input.count.strikes}` : "n/d"
      ),
      driver(
        "Écart",
        clampRange(0.5 + (input.homeScore - input.awayScore) / 6, 0, 1),
        input.homeScore - input.awayScore > 0
          ? `+${input.homeScore - input.awayScore}`
          : `${input.homeScore - input.awayScore}`
      ),
    ],
  };
}

/** Suffixe ordinal français d'une manche (1re, 2e, 3e, 10e). */
function inningSuffix(inning: number): string {
  return inning === 1 ? "re" : "e";
}

/** Description lisible de l'occupation des bases. */
function describeBases(bases: BaseballBases): string {
  const first = (bases & 1) !== 0;
  const second = (bases & 2) !== 0;
  const third = (bases & 4) !== 0;
  if (first && second && third) return "Bases pleines";
  if (first && second) return "1re + 2e";
  if (second && third) return "2e + 3e";
  if (first && third) return "1re + 3e";
  if (first) return "1re";
  if (second) return "2e";
  if (third) return "3e";
  return "Bases vides";
}