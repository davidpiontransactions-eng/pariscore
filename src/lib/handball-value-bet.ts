// Sélection automatique du value bet handball — cascade 3 priorités, cote ≥ 1.20.
//
// ⚠️ POURQUOI CE FICHIER EXISTE — l'engine (Skellam, Team Power, Index Pariscore,
// Forme L10 pondérée) est déjà produit par `computePariscorePrediction`, et les
// 3 paris prédictifs par `computeHandballPredictiveBets`. Ce qui n'existait pas,
// c'est l'ARBITRAGE : ces modules renvoient 3 paris coexistantS, sans dire
// lequel jouer, et avec un seuil unique PARISCORE_MIN_ODDS = 1.15.
//
// La mission tranche le seuil à 1.20 et impose une CASCADE. On garde donc les
// deux modules intacts et on n'ajoute que la décision.
//
// ── La cascade (mission §2) ──
//   P1 Vainqueur 1N2  : P(victoire) ≥ 70 % ET cote ≥ 1.20  →  Victoire Simple
//   P2 Handicap       : cote du 1N2 trop basse (< 1.20, donc pavé de favori)
//                       →  ligne ±.5 derivée de la marge Skellam attendue
//   P3 Total O/U      : marge 1N2 incertaine →  ligne ±.5 autour du total
//                       attendu, celle qui bate le seuil de probabilité
//
// ── Garde-fou central : jamais de cote inventée ──
// Une "value bet" sans prix de marché n'est pas une value bet, c'est une
// soustraction entre deux inventions (cf. `fiba-value-bets.ts` qui renvoie
// systématiquement null pour cette raison). Chaque niveau exige donc une cote
// RÉELLEMENT présente sur la rencontre, à la LIGNE EXACTE sélectionnée :
// une cote relevée sur une autre ligne ou un autre côté donnerait un EV
// fabriqué — le bug déjà corrigé en review G6-5 (handball-predictive-bets.ts).
//
// Les λ sont ceux de `PariscorePrediction.meanHome`/`meanAway` : une seule
// source de vérité, donc l'Index, le score affiché, le 1N2 et le value bet
// publié ne peuvent pas se contredire.

import type { HandballMatch, HandballOpeningOdds } from "./handball-data";
import type { PariscorePrediction } from "./handball-pariscore";
import { handicapProb } from "./handball-skellam";
import { overUnderProb } from "./handball-cmp";
import { computeKellyStake } from "./kelly";

// ─── Tunables (mission §2) ───

/**
 * Cote minimale du pari publié. 1.20 = premier palier au-dessus de la mise
 * unitaire, donc tout pari publié est « jouable » (marge bookmaker ≥ 20 %).
 *
 * Distinct de `PARISCORE_MIN_ODDS` (1.15) qui régit l'affichage du seuil de
 * total dans le pop-up : on ne change pas un seuil existant et déjà testé, on
 * ajoute la règle de décision demandée par la mission.
 */
export const VALUEBET_MIN_ODDS = 1.2;

/**
 * Probabilité minimale du favori 1N2 (mission : 70 %).
 *
 * Vaut pour le SEUL niveau 1 : la mission écrit « cote Marché » pour le
 * Vainqueur, mais « cote **cible** » pour le Handicap et le Total.
 */
export const VALUEBET_MIN_PROB_PCT = 70;

/**
 * Plafond de probabilité des niveaux 2 et 3 — déduit, pas choisi.
 *
 * Une cote cible vaut `1 / P`. Exiger `cote cible ≥ 1.20` revient donc à
 * exiger `P ≤ 83.3 %`. Ce plafond est la VRAIE fonction du seuil de 1.20 :
 * il écarte les quasi-certitudes (P = 95 % → cote cible 1.05, invendable car
 * aucun bookmaker ne paie 1.05 avec 20 % de marge), et il borne la bande par
 * le bas à P > 50 %, faute de quoi on publierait un « favori » qui ne l'est pas.
 *
 * Écrire `P ≥ 70 %` ici donnerait −0.5 au lieu de −2.5 : à 70 % de couverture
 * exigée, la seule demi-ligne qui survive est la plus prudente, qui ne dit
 * plus rien de la marge attendue. La borne utile de P2 est donc (50 %, 83.3 %].
 */
export const VALUEBET_MAX_PROB_PCT = Math.round((100 / VALUEBET_MIN_ODDS) * 100) / 100;

/** Demi-pas des lignes de handicap / total (handball : lignes en .5). */
const LINE_STEP = 0.5;
/** Profondeur du scan sous la marge attendue (buts) — 6 = 12 demi-lignes. */
const HANDICAP_SCAN_DEPTH = 6;
/** Lignes figées du snapshot d'ouverture (cf. `HandballOpeningOdds`). */
const MARKET_OVER55_LINE = 55.5;
const MARKET_UNDER62_LINE = 62.5;
const MARKET_HANDICAP_LINE = 4.5;

// ─── Types ───

/** Marché playable issu de la cascade. */
export type ValueBetMarket = "winner" | "handicap" | "total";

/** Un pari candidate, évalué mais pas forcément retenu. */
export type ValueBetCandidate = {
  market: ValueBetMarket;
  /** Label affichable FR (« PSG gagne », « Team -3.5 », « Over 57.5 »). */
  label: string;
  /** Probabilité du côté retenu [0-100], 1 décimale. */
  prob: number;
  /**
   * Cote JUSTE du modèle = `1 / P` — le prix auquel ce pari devrait être vendu.
   * C'est la « cote cible » de la mission aux niveaux 2 et 3.
   *
   * Distincte de `odds` (prix réel du bookmaker) : c'est l'EV qui compare les
   * deux. Publier la cote cible quand le marché est muet ne fabrique donc
   * aucun edge — on annonce un prix, pas une opportunité.
   */
  targetOdds: number;
  /**
   * Cote RÉELLE du marché à la LIGNE EXACTE retenue. null = marché non couvert
   * (cas le plus fréquent : le snapshot handball ne porte aucun prix).
   */
  odds: number | null;
  /** EV = (P × cote) − 1, fraction. null si cote absente. */
  ev: number | null;
  /** Demi-Kelly fraction de bankroll. null si cote absente. */
  kelly: number | null;
  /** true si le candidat respecte TOUS les garde-fous de la mission. */
  qualifies: boolean;
  /** Motif de refus, null si retenu. Tracé pour l'UI et les tests. */
  rejectReason: string | null;
};

export type HandballValueBetResult = {
  /** Le pari retenu par la cascade, null si aucun niveau ne passe. */
  selected: ValueBetCandidate | null;
  /** Rang du niveau retenu (1/2/3), null si rien. */
  selectedPriority: 1 | 2 | 3 | null;
  /** Les 3 candidats, dans l'ordre de la cascade. */
  candidates: ValueBetCandidate[];
  /** Note de méthode affichée sous le badge. */
  note: string;
};

export type HandballValueBetOpts = {
  /** Lignes de handicap cotées, clé = valeurur absolue (« "3.5" »). */
  handicapOdds?: Record<string, number>;
  /** Lignes de total cotées, clé = ligne (« "57.5" »). */
  totalOdds?: Record<string, { over?: number; under?: number }>;
};

// ─── Helpers ───

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** Cote finie et > 1.01, sinon null (même convention que le moteur prédictif). */
function validOdd(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 1.01 ? n : null;
}

/** ÉV + Kelly d'un candidat, null si pas de cote. */
function money(prob: number, odds: number | null): { ev: number | null; kelly: number | null } {
  if (odds == null) return { ev: null, kelly: null };
  return {
    ev: round3((prob / 100) * odds - 1),
    kelly: round4(computeKellyStake(prob, odds).pct / 100),
  };
}

// ─── P1 — Vainqueur 1N2 ───

/**
 * Cotes 1N2 de la rencontre (snapshot courant, sinon ouverture).
 * Chaque côté est résolu INDÉPENDAMMENT : une rencontre à 2 cotes sur 3 reste
 * exploitable côté favori, ce qui est le cas le plus fréquent en Liga/actif.
 */
function odds1x2(match: HandballMatch): {
  home: number | null;
  draw: number | null;
  away: number | null;
} {
  const fav: HandballOpeningOdds["fav1x2"] = match.openingOdds?.fav1x2;
  return {
    home: validOdd(match.odds?.home) ?? validOdd(fav?.home),
    draw: validOdd(match.odds?.draw) ?? validOdd(fav?.draw),
    away: validOdd(match.odds?.away) ?? validOdd(fav?.away),
  };
}

function winnerCandidate(match: HandballMatch, prediction: PariscorePrediction): ValueBetCandidate {
  const o = odds1x2(match);
  const sides = [
    { key: "home" as const, name: match.home.shortName || match.home.name, prob: prediction.winrate.home },
    { key: "draw" as const, name: "Nul", prob: prediction.winrate.draw },
    { key: "away" as const, name: match.away.shortName || match.away.name, prob: prediction.winrate.away },
  ];
  const top = sides.reduce((a, b) => (b.prob > a.prob ? b : a));
  const odds = o[top.key];
  const prob = round1(top.prob);
  const targetOdds = round2(100 / Math.max(prob, 0.01));
  const { ev, kelly } = money(prob, odds);
  const label = top.key === "draw" ? "Nul" : `${top.name} gagne`;
  const base = { market: "winner" as const, label, prob, targetOdds, odds, ev, kelly };

  if (!prediction.hasSignal) {
    return {
      ...base,
      qualifies: false,
      rejectReason: "aucune donnée en base — le 1N2 serait la moyenne de ligue",
    };
  }
  if (prob < VALUEBET_MIN_PROB_PCT) {
    return { ...base, qualifies: false, rejectReason: `P ${prob} % < ${VALUEBET_MIN_PROB_PCT} %` };
  }
  // Niveau 1 : la mission dit « cote MARCHÉ ». Sans prix réel on ne publie
  // rien — contrairement aux niveaux 2 et 3, où l'objet est une LIGNE, pas
  // une opportunité sur un prix déjà connu.
  if (odds == null) {
    return { ...base, odds: null, ev: null, kelly: null, qualifies: false, rejectReason: "aucune cote 1N2 sur cette rencontre" };
  }
  if (odds < VALUEBET_MIN_ODDS) {
    return {
      ...base,
      qualifies: false,
      rejectReason: `cote ${odds} < ${VALUEBET_MIN_ODDS} — bascule sur le handicap`,
    };
  }
  return { ...base, qualifies: true, rejectReason: null };
}

// ─── P2 — Handicap couvert ───

/**
 * Ligne de handicap du favori, en valeurur absolue.
 *
 * La mission demande la « marge Skellam attendue » : on retient la demi-ligne
 * la plus CONSERVATRICE (la plus proche de la marge) qui conserve au moins
 * `VALUEBET_MIN_PROB_PCT` de couverture. Une ligne trop agressive ferait
 * tomber la proba sous le seuil sans rien apporter ; une ligne trop prudente
 * (-0.5) serait un pari sur un quasi-nul.
 *
 * Le signe est porté par `favSide`, pas par la ligne : celle-ci est toujours
 * positive en valeur absolue.
 */
function handicapLine(
  prediction: PariscorePrediction,
  favSide: "home" | "away",
): { line: number; prob: number } | null {
  const lh = prediction.meanHome;
  const le = prediction.meanAway;
  // La mission demande la LIGNE « calculée d'après la marge Skellam attendue ».
  //
  // La marge pure serait une ligne à ~50 % de couverture (c'est sa définition :
  // P(écart > marge espérée) ≈ 50 %) — donc un pile ou face, invendable. On
  // part donc de la marge arrondie et on descend par demi-lignes jusqu'à
  // atteindre la bande (50 %, 83.3 %] : la première ligne qui reste un pari
  // d'un côté ET garde une cote cible jouable. C'est ce qui produit les
  // « -2.5 / -3.5 » de la mission : la ligne colle à la marge attendue, pas à
  // une probabilité de couverture arbitraire.
  const margin = favSide === "home" ? lh - le : le - lh;
  const base = Math.round(margin / LINE_STEP) * LINE_STEP;
  if (base < LINE_STEP) return null; // marge < 0.5 : aucun handicap à jouer
  for (let step = 0; step * LINE_STEP <= HANDICAP_SCAN_DEPTH; step++) {
    const line = base - step * LINE_STEP;
    if (line < LINE_STEP) break;
    const hc = handicapProb(lh, le, line);
    const cover = favSide === "home" ? hc.home : hc.away;
    const prob = round1(cover * 100);
    // La couverture CROÎT quand la ligne décroît : sous 50 % on doit donc
    // descendre, pas abandonner. (C'était un `break` — il faisait sortir de la
    // boucle à la première ligne pile ou face, donc P2 ne sortait jamais rien.)
    if (prob <= 50) continue;
    if (prob > VALUEBET_MAX_PROB_PCT) continue; // quasi-certitude : cote cible < 1.20
    return { line: round1(line), prob };
  }
  return null;
}

function handicapCandidate(
  match: HandballMatch,
  prediction: PariscorePrediction,
  opts: HandballValueBetOpts,
): ValueBetCandidate {
  const favSide: "home" | "away" = prediction.meanHome >= prediction.meanAway ? "home" : "away";
  const favName = favSide === "home" ? match.home.shortName || match.home.name : match.away.shortName || match.away.name;

  const fail = (reason: string): ValueBetCandidate => ({
    market: "handicap",
    label: `${favName} -0`,
    prob: 0,
    targetOdds: 0,
    odds: null,
    ev: null,
    kelly: null,
    qualifies: false,
    rejectReason: reason,
  });

  if (!prediction.hasSignal) return fail("aucune donnée en base");
  const picked = handicapLine(prediction, favSide);
  if (!picked) return fail("marge attendue < 0.5 but — aucun handicap à jouer");
  const { line, prob } = picked;
  const label = `${favName} -${line}`;
  // Cote RÉELLE à la LIGNE EXACTE — optionnelle ici (cf. `targetOdds`).
  const odds = validOdd(opts.handicapOdds?.[String(line)]);
  const targetOdds = round2(100 / prob);
  const { ev, kelly } = money(prob, odds);

  // Niveau 2 : la mission dit « cote CIBLE ≥ 1.20 », donc on juge la LIGNE du
  // modèle (marge Skellam) et non une ligne du marché. Une cote réelle est
  // un bonus — elle donne l'EV — mais son absence n'empêche pas de publier la
  // ligne que le modèle recommande, avec sa juste prix.
  if (prob <= 50) {
    return {
      market: "handicap",
      label,
      prob,
      targetOdds,
      odds,
      ev,
      kelly,
      qualifies: false,
      rejectReason: `couverture ${prob} % ≤ 50 % — le favori ne couvre pas`,
    };
  }
  if (targetOdds < VALUEBET_MIN_ODDS) {
    return {
      market: "handicap",
      label,
      prob,
      targetOdds,
      odds,
      ev,
      kelly,
      qualifies: false,
      rejectReason: `cote cible ${targetOdds} < ${VALUEBET_MIN_ODDS} (P ${prob} % > ${VALUEBET_MAX_PROB_PCT} %)`,
    };
  }
  return { market: "handicap", label, prob, targetOdds, odds, ev, kelly, qualifies: true, rejectReason: null };
}

// ─── P3 — Total Over/Under ───

function totalCandidate(
  prediction: PariscorePrediction,
  opts: HandballValueBetOpts,
): ValueBetCandidate {
  const expected = prediction.expectedTotal;
  const lines = Object.keys(opts.totalOdds ?? {});
  const fail = (reason: string): ValueBetCandidate => ({
    market: "total",
    label: `Total ${round1(expected)} buts`,
    prob: 0,
    // Cote cible INCONNUE sur un candidat refusé : pas de ligne retenue, donc
    // pas de prix. On ne comble pas avec 100/total — ce serait un ratio de
    // buts, pas une cote.
    targetOdds: 0,
    odds: null,
    ev: null,
    kelly: null,
    qualifies: false,
    rejectReason: reason,
  });

  if (!prediction.hasSignal) return fail("aucune donnée en base");
  // La mission : « l'écart entre le total attendu et la LIGNE PROPOSÉE PAR LE
  // BOOKMAKER ». On ne propose donc pas une ligne de notre invention — on
  // évalue les lignes réellement cotées, et on publie celle où le modèle et le
  // marché s'écartent le plus.
  if (lines.length === 0) return fail("aucune cote de total sur cette rencontre");

  let best: ValueBetCandidate | null = null;
  let bestDistance = Infinity;
  for (const key of lines) {
    const line = Number(key);
    if (!Number.isFinite(line) || line < LINE_STEP) continue;
    const market = opts.totalOdds?.[key];
    // CMP réel (taux + ν), pas un Poisson reconstruit : ν ≈ 1.3 rend le
    // handball sous-dispersé, et c'est le modèle qui produit le seuil affiché
    // par `pickTotalThreshold`. Un Poisson décalerait le total de plusieurs buts.
    const { over } = overUnderProb(
      prediction.lambdaHome,
      prediction.nuHome,
      prediction.lambdaAway,
      prediction.nuAway,
      line,
    );
    for (const side of ["over", "under"] as const) {
      const p = side === "over" ? over : 1 - over;
      const prob = round1(p * 100);
      if (prob <= 50) continue; // le côté prédit par le modèle n'est pas le côté gagnant
      const targetOdds = round2(100 / prob);
      if (targetOdds < VALUEBET_MIN_ODDS) continue;
      const odds = validOdd(market?.[side]);
      // Cote < 1.20 = marché qui paie moins que la juste prix : pas de value.
      if (odds != null && odds < VALUEBET_MIN_ODDS) continue;
      const { ev, kelly } = money(prob, odds);
      const cand: ValueBetCandidate = {
        market: "total",
        label: `${side === "over" ? "Over" : "Under"} ${round1(line)} buts`,
        prob,
        targetOdds,
        odds,
        ev,
        kelly,
        qualifies: true,
        rejectReason: null,
      };
      // Meilleur écart modèle/marché d'abord ; à proba égale, la ligne la
      // plus proche du total attendu (la moins extrême, donc la plus vendable).
      if (
        best == null ||
        (cand.ev ?? -1) > (best.ev ?? -1) ||
        ((cand.ev ?? -1) === (best.ev ?? -1) && Math.abs(line - expected) < bestDistance)
      ) {
        best = cand;
        bestDistance = Math.abs(line - expected);
      }
    }
  }
  if (best) return best;
  return fail("aucune ligne cotée ne donne de cote cible ≥ 1.20 avec P > 50 %");
}

// ─── Dérivation des marchés disponibles ───

/**
 * Lignes de marché réellement cotées, déduites du snapshot.
 *
 * Le contrat d'exactitude de ligne est donc respecté SANS que l'appelant ait
 * à connaître les noms de champs : `openingOdds` porte 3 lignes fixes
 * (`over55` = 55.5, `under62` = 62.5, `handicap` = favori 4.5), et chacune est
 * enregistrée sous SA clé de ligne. Une cote relevée ailleurs n'apparaît donc
 * jamais sous la ligne du modèle — le bug d'EV fabriqué reste impossible.
 *
 * Un appelant qui dispose d'un vrai bookmaker multi-lignes passe ses
 * `handicapOdds`/`totalOdds` explicites : ils sont PRIORITAIRES (plus riches,
 * donc plus justes) et simplement fusionnés par-dessus.
 */
function marketsFromSnapshot(
  match: HandballMatch,
  opts: HandballValueBetOpts,
): Required<Pick<HandballValueBetOpts, "handicapOdds" | "totalOdds">> {
  const o = match.openingOdds;
  const handicapOdds: Record<string, number> = {};
  const totalOdds: Record<string, { over?: number; under?: number }> = {};

  const hcp = validOdd(o?.handicap);
  if (hcp != null) handicapOdds[String(MARKET_HANDICAP_LINE)] = hcp;

  const over55 = validOdd(o?.over55);
  if (over55 != null) (totalOdds[String(MARKET_OVER55_LINE)] ??= {}).over = over55;
  const under62 = validOdd(o?.under62);
  if (under62 != null) (totalOdds[String(MARKET_UNDER62_LINE)] ??= {}).under = under62;

  return {
    handicapOdds: { ...handicapOdds, ...opts.handicapOdds },
    totalOdds: mergeTotalLines(totalOdds, opts.totalOdds),
  };
}

/** Fusionne deux tables de lignes de total, sans écraser une cote par un undefined. */
function mergeTotalLines(
  base: Record<string, { over?: number; under?: number }>,
  extra: HandballValueBetOpts["totalOdds"],
): Record<string, { over?: number; under?: number }> {
  if (!extra) return base;
  const out: Record<string, { over?: number; under?: number }> = { ...base };
  for (const [line, sides] of Object.entries(extra)) {
    out[line] = { ...out[line], ...sides };
  }
  return out;
}

// ─── Entry point ───

/**
 * Choisit LE value bet handball d'une rencontre selon la cascade de la mission.
 *
 * Ne throw jamais. Renvoie toujours les 3 candidats (retenu ou motif de refus)
 * pour que l'UI puisse expliquer le choix plutôt que d'afficher un pari muet.
 * `selected: null` signifie « aucun pari publiable » — état légitime et
 * fréquent (ligue sans cotes, 1N2balanced, aucune ligne de total cotée).
 */
export function selectHandballValueBet(
  match: HandballMatch,
  prediction: PariscorePrediction,
  opts: HandballValueBetOpts = {},
): HandballValueBetResult {
  const markets = marketsFromSnapshot(match, opts);
  const candidates = [
    winnerCandidate(match, prediction),
    handicapCandidate(match, prediction, markets),
    totalCandidate(prediction, markets),
  ];
  const priorities = [1, 2, 3] as const;
  let selected: ValueBetCandidate | null = null;
  let selectedPriority: 1 | 2 | 3 | null = null;
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].qualifies) {
      selected = candidates[i];
      selectedPriority = priorities[i];
      break; // cascade : premier niveau qui passe gagne
    }
  }
  const marketName = selected ? `P${selectedPriority}` : "aucun";
  const note = selected
    ? `Value bet ${selected.label} — ${selected.prob.toFixed(1)} % @ ${selected.odds?.toFixed(2)} (niveau ${marketName})`
    : "Aucun pari ≥ 1.20 publiable sur cette rencontre";
  return { selected, selectedPriority, candidates, note };
}