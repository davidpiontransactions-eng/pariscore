// Moteur de backtesting Pariscore — indépendant de la ligue.
//
// Rejoue les prédictions Pariscore sur des matchs TERMINÉS et produit les KPI
// demandés : taux de réussite global, ROI en flat betting, profit/perte net en
// unités, et le taux de réussite PAR MARCHÉ (1N2 vs Total Over/Under).
//
// Trois règles structurent tout le fichier :
//
// 1. WALK-FORWARD STRICT. Pour le match i, la forme est construite sur les
//    matchs j < i uniquement. Aucune information du futur ne fuite dans le
//    score prédit (c'est ce qui distingue un backtest d'un.fit sur le passé).
//
// 2. COTES SIMULÉES, jamais réelles. Vitibet ne publie pas les cotes, et le
//    snapshot Flashscore handball ne porte que over55/under62. Les cotes sont
//    donc des moyennes de marché 1xbet, identiques à celles du backtest maison
//    (`handball-backtest.ts`) : le ROI est INDICATIF, pas un conseil de pari.
//    Le module l'expose dans `methodology` pour que l'UI ne puisse pas l'oublier.
//
// 3. MISE CONSTANTE (flat 1u). Pas de Kelly, pas de mise variable : le ROI
//    doit isoler la QUALITÉ du signal, pas une courbe de mise.

import {
  CMP_NEUTRAL_LAMBDA,
  matchLambdas,
  cmpLambdaForMean,
  cmpMean,
  overUnderProb,
  teamStrength,
  type CmpTeam,
} from "./handball-cmp";
import { CALIBRATED_NU } from "./handball-goals-calibration";
import { skellamMatchProbs } from "./handball-skellam";
import { applyMatchToFormStore } from "./handball-strategy-top8";
import {
  HOME_ADVANTAGE_INDEX,
  PARISCORE_MAX_PROB_PCT,
  PARISCORE_MIN_PROB_PCT,
  PARISCORE_MIN_ODDS,
  computeFormPctWeighted,
  computePower,
} from "./handball-pariscore";

// ─── Cotes simulées (moyennes 1xbet, cf. handball-backtest.ts) ───

/** Cote d'un favori 1X2. */
export const SIM_ODDS_FAVOURITE_1X2 = 1.55;
/** Cote d'un nul (sous-coté car le nul est rare au handball). */
export const SIM_ODDS_DRAW = 12;
/** Cote de la ligne de total retenue (Over/Under). */
export const SIM_ODDS_TOTAL = 1.9;
/** Mise constante par pari. */
export const FLAT_STAKE_U = 1;

// ─── Types ───

/** Match terminé minimal dont le moteur a besoin (rejouable hors UI). */
export type BacktestMatch = {
  id: string;
  date: string;
  league: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  /** Cotes 1X2 réelles si disponibles ; sinon les cotes simulées sont used. */
  odds?: { home?: number; draw?: number; away?: number };
  /** true = entrée synthétique (absente de la source Vitibet). */
  synthetic?: boolean;
};

/** Marché d'un pari suivi. */
export type BacktestMarket = "1N2" | "total";

/** Un pari réglé. */
export type BacktestSettledBet = {
  matchId: string;
  date: string;
  league: string;
  home: string;
  away: string;
  market: BacktestMarket;
  /** Libellé affiché du pari (« Favori », « Over 53.5 »…). */
  pick: string;
  /** Côté joué pour 1N2 ; null pour un marché de total. */
  side: "home" | "away" | "draw" | null;
  /** Cote engagée. */
  odds: number;
  /** Probabilité du modèle AVANT le match, 0-100. */
  prob: number;
  /** Score prédit par le modèle. */
  predictedHome: number;
  predictedAway: number;
  /** Issue du pari après règlement. */
  result: "won" | "lost" | "void";
  /** Profit net en unités (odds−1 si gagné, −1 si perdu, 0 si annulé). */
  profitU: number;
  /** true = pari issu du seuil de probabilité (P ≥ 65 % [+ cote]). */
  qualified: boolean;
  /** true = entrée de match synthétique. */
  syntheticMatch: boolean;
};

/** KPI d'un sous-ensemble de paris. */
export type BacktestSegment = {
  nBets: number;
  won: number;
  lost: number;
  voided: number;
  /** Taux de réussite 0-100 sur les paris réglés (void exclus). */
  winrate: number | null;
  /** Profit net cumulé en unités. */
  profitU: number;
  /** ROI = profit / (nBets réglés × 1u), en %. null si aucun pari réglé. */
  roiPct: number | null;
  /** Mise cumulée en unités. */
  stakedU: number;
};

/** Agrégat par journée (pour la courbe de progression). */
export type BacktestDayRow = {
  date: string;
  segment: BacktestSegment;
  /** Profit cumulé en unités jusqu'à cette journée incluse. */
  cumulativeProfitU: number;
  /** Nombre de matchs de la journée. */
  nMatches: number;
};

export type BacktestResult = {
  league: string;
  /** Nombre de matchs terminés réinjectés dans le moteur. */
  nMatches: number;
  /** Nombre de ces matchs qui sont synthétiques (absents de la source). */
  nSyntheticMatches: number;
  /**
   * Matchs prédits avec le MODÈLE AJUSTÉ (forme ≥ 3 matchs par équipe) plutôt
   * qu'avec le prior neutre. Exposé car il conditionne la lecture des KPI :
   * sur un échantillon trop mince (ligue à 12 équipes, 15 matchs), ce compte
   * peut être 0 — les résultats mesurent alors le prior + le choix de ligne,
   * pas la qualité de la forme. Jamais caché dans un KPI.
   */
  nFormMatches: number;
  /** Paris émis ET retenus (P ≥ seuil) — c'est la base des KPI. */
  bets: BacktestSettledBet[];
  /** Tous les paris émis, retenus ou non (transparence sur le filtrage). */
  allBets: BacktestSettledBet[];
  global: BacktestSegment;
  byMarket: Record<BacktestMarket, BacktestSegment>;
  /** Progression par journée (dates croissantes). */
  byDay: BacktestDayRow[];
  /** Bornes de confiance des signaux émis. */
  thresholds: {
    minProbPct: number;
    maxProbPct: number;
    minOdds: number;
    homeAdvantageIndex: number;
  };
  methodology: string;
};

// Note de méthode : voir `methodologyNote()` plus bas — elle dépend de la
// provenance réelle des cotes, donc elle ne peut plus être une constante.
// ─── Utilitaires ───

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Probabilité du total > ligne, CMP. */
function overProb(
  lambdaH: number,
  nuH: number,
  lambdaE: number,
  nuE: number,
  line: number,
): number {
  return overUnderProb(lambdaH, nuH, lambdaE, nuE, line).over;
}

/**
 * Seuil de total retenu pour un match : la demi-ligne la plus PROCHE du total
 * attendu dont la probabilité tient dans [65 %, 95 %]. `null` si aucune.
 */
export function pickBacktestTotalLine(
  lambdaH: number,
  nuH: number,
  lambdaE: number,
  nuE: number,
): { line: number; side: "over" | "under"; prob: number } | null {
  const expected = cmpMean(lambdaH, nuH) + cmpMean(lambdaE, nuE);
  const base = Math.round(expected / 0.5) * 0.5;
  let best: { line: number; side: "over" | "under"; prob: number } | null = null;
  let bestDistance = Infinity;
  for (let line = base - 12; line <= base + 12; line += 0.5) {
    const p = overProb(lambdaH, nuH, lambdaE, nuE, line);
    for (const side of ["over", "under"] as const) {
      const prob = Math.round((side === "over" ? p : 1 - p) * 1000) / 10;
      if (prob < PARISCORE_MIN_PROB_PCT || prob > PARISCORE_MAX_PROB_PCT) continue;
      const distance = Math.abs(line - expected);
      if (best && distance >= bestDistance) continue;
      bestDistance = distance;
      best = { line: Math.round(line * 10) / 10, side, prob };
    }
  }
  return best;
}

function emptySegment(): BacktestSegment {
  return { nBets: 0, won: 0, lost: 0, voided: 0, winrate: null, profitU: 0, roiPct: null, stakedU: 0 };
}

function segmentOf(bets: BacktestSettledBet[]): BacktestSegment {
  const seg = emptySegment();
  for (const b of bets) {
    seg.nBets++;
    seg.profitU += b.profitU;
    if (b.result === "void") {
      seg.voided++;
      continue;
    }
    seg.stakedU += FLAT_STAKE_U;
    if (b.result === "won") seg.won++;
    else seg.lost++;
  }
  const settled = seg.won + seg.lost;
  seg.winrate = settled > 0 ? Math.round((seg.won / settled) * 1000) / 10 : null;
  seg.profitU = Math.round(seg.profitU * 100) / 100;
  seg.roiPct = seg.stakedU > 0 ? Math.round((seg.profitU / seg.stakedU) * 1000) / 10 : null;
  return seg;
}

// ─── Moteur ───

/**
 * Rejoue le moteur Pariscore en walk-forward sur `matches`.
 *
 * Émet 2 paris par match : 1X2 (le favori du modèle, ou X si aucun favori
 * n'atteint le seuil) et Total (le seuil optimal). Chaque pari est réglé puis
 * filtré par `qualified`. Les matchs dont l'historique est trop court pour un
 * fit CMP ne produisent qu'un prior neutre — ils restent dans l'échantillon
 * (sinon on ferait disappear les mauvais cas, ce qui gonflerait le taux).
 */
/**
 * Note de méthode, adaptée à la provenance RÉELLE des cotes.
 *
 * ⚠️ Le texte d'origine annonçait « COTES SIMULÉES » en dur. Dès qu'une ligue
 * est lue dans `handball_match_history` (pages de saison BetExplorer, colonnes
 * `odds_home/draw/away`), le ROI 1N2 est calculé sur de VRAIES cotes — laisser
 * « simulées » affiché serait un mensonge de méthode, et l'inverse (annoncer des
 * cotes réelles quand on en a simulé) le serait tout autant. Le libellé suit donc
 * ce que le moteur a réellement fait, à partir du nombre de matchs pour lesquels
 * une cote complète a été fournie.
 *
 * `realOdds` = nombre de matchs ayant les 3 cotes. `total` = nombre de matchs
 * traités. Un mélange (une partie avec, une partie sans) est donne tel quel : le
 * taux de couverture est affichable, donc on ne le masque pas.
 */
function methodologyNote(realOdds: number, total: number): string {
  const head =
    "Walk-forward strict : la forme de chaque équipe est reconstruite sur les " +
    "matchs strictement antérieurs (aucun lookahead). Le modèle ajusté n'est " +
    "activé qu'à partir de 3 matchs antérieurs par équipe (CMP_MIN_HISTORY, même " +
    "seuil que le modèle live — on ne l'abaisse pas ici, sinon le backtest ne " +
    "mesurerait plus le modèle déployé) ; en dessous, le match est prédit avec le " +
    "prior neutre calé sur la moyenne de buts de la ligue. `nFormMatches` expose " +
    "ce compteur. Score prédit via les moteurs " +
    "CMP (totaux) + Skellam (1N2), forme pondérée lieu + écart de buts, Team Power " +
    "et Index Pariscore ramenés à la moyenne de buts de la ligue. Seuils : un pari " +
    "n'est compté que si P ≥ 65 % et, cote disponible, cote ≥ 1.15 ; les lignes de " +
    "total au-delà de 95 % de probabilité sont rejetées (quasi-certitude = défaut de " +
    "ligne, pas coup gagnant). Mise constante 1u (flat).";

  if (total === 0 || realOdds === 0) {
    return (
      head +
      " COTES SIMULÉES (moyennes 1xbet : favori 1X2 @1.55, nul @12, total @1.9) — " +
      "aucune cote réelle disponible pour cette ligue. ROI indicatif, pas un " +
      "conseil de pari."
    );
  }
  const pct = Math.round((100 * realOdds) / total);
  const cotes =
    pct === 100
      ? "COTES RÉELLES (BetExplorer, pages de saison) sur 100 % des matchs"
      : `COTES RÉELLES (BetExplorer) sur ${pct} % des matchs (${realOdds}/${total}) ; ` +
        `les ${total - realOdds} autres ont été valorisés aux moyennes 1xbet ` +
        `(favori 1X2 @1.55, nul @12, total @1.9)`;
  return (
    head +
    ` ${cotes}. Le ROI 1N2 dépend donc directement du prix payé : il mesure ` +
    "l'écart entre le prix et la probabilité, pas seulement la justesse du " +
    "modèle. Échantillon historique, pas un conseil de pari."
  );
}

export function runPariscoreBacktest(
  matches: BacktestMatch[],
  opts: { league: string; leagueMean?: number } = { league: "MOL Liga Women" },
): BacktestResult {
  const leagueMean =
    opts.leagueMean != null && opts.leagueMean > 0 ? opts.leagueMean : CMP_NEUTRAL_LAMBDA;
  // Walk-forward : on trie par date pour que « les matchs antérieurs » soit
  // bien « les matchs plus anciens », indépendamment de l'ordre d'entrée.
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));

  const store = new Map<string, { gf: number[]; ga: number[]; atHome: boolean[] }>();
  const allBets: BacktestSettledBet[] = [];
  let nFormMatches = 0;

  for (const m of sorted) {
    // ── 1. λs AVANT d'injecter le match dans le store (pas de lookahead) ──
    // ⚠️ UNE SEULE clé par équipe (le nom), pas une par côté : scinder « h:X »
    // et « a:X » répartirait l'historique d'un club entre deux seaux selon le
    // lieu et personne n'atteindrait jamais le seuil de 3 matchs → tout
    // retomberait sur le prior neutre (bug constaté : 47.4 % sur tous les
    // matchs, 1N2 à 0 pari retenu). Le lieu est porté par `atHome[]`.
    const h = store.get(m.home);
    const a = store.get(m.away);
    const hasForm = !!h && !!a && h.gf.length >= 3 && a.gf.length >= 3;

    let lambdaH: number;
    let lambdaE: number;
    let nuH = CALIBRATED_NU;
    let nuE = CALIBRATED_NU;
    if (hasForm) {
      const home: CmpTeam = teamStrength(h!.gf, h!.ga);
      const away: CmpTeam = teamStrength(a!.gf, a!.ga);
      const lam = matchLambdas(home, away);
      // ⚠️ FIX 2026-10-04 — normalisation sur ν = 1 (échelle Poisson).
      //
      // `teamStrength`/`matchLambdas`fitted sur ν = CMP_DEFAULT_NU (1.3), et la
      // PMF CMP n'est PAS moyen-paramétrée : à ν = 1.3, `cmpMean(30, 1.3) ≈ 13.6`.
      // Or TOUS les consommateurs en aval de ce moteur raisonnaient sur des
      // échelles différentes :
      //   • `cmpMean(λ, ν)`        → attend λ = RATE CMP, renvoie la MOYENNE ;
      //   • `skellamMatchProbs(λ)` → suppose λ = MOYENNE d'une Poisson ;
      //   • `pickBacktestTotalLine`→ mélange les deux via `cmpMean`.
      // Conséquences mesurées sur 597 paris 1N2 réels :
      //   • le score affiché valait ~45 % de l'attendu, et pointait dans le SENS
      //     OPPOSÉ du pari retenu sur 216 paris sur 558 (39 %) ;
      //   • 42 % des paris partaient à ≥ 90 % de confiance pour 47.8 % de
      //     winrate réel — un modèle à 100 % de confiance qui joue à pile ou face.
      //
      // `cmpLambdaForMean(moyenne, 1)` est l'identité à ν = 1 : on convertit donc
      // le λ CMP en taux Poisson équivalent, et tout l'aval partage une échelle.
      // Avalide pour λ, PAS pour la forme : `teamStrength` reste tel quel, seul
      // son λ est ré-exprimé.
      //
      // `CMP_DEFAULT_NU` n'est PAS modifié : ce changement est local à la fonction
      // de backtest (aucun chemin live, aucune stratégie de production n'importe
      // ce moteur). Les 6 stratégies historiques et le golden figé restent hors
      // d'atteinte — c'était la condition pour qu'un go soit suffisant.
      lambdaH = cmpLambdaForMean(cmpMean(lam.lambdaH, lam.nuH), CALIBRATED_NU);
      lambdaE = cmpLambdaForMean(cmpMean(lam.lambdaE, lam.nuE), CALIBRATED_NU);
      nFormMatches++;
    } else {
      // Prior neutre Poisson, calé sur la moyenne de la ligue — déjà un λ
      // (cf. `CMP_NEUTRAL_LAMBDA` = 28.5 par équipe), donc rien à convertir.
      lambdaH = leagueMean;
      lambdaE = leagueMean;
    }

    const meanH = cmpMean(lambdaH, nuH);
    const meanE = cmpMean(lambdaE, nuE);
    const predH = Math.round(meanH);
    const predE = Math.round(meanE);
    const w = skellamMatchProbs(lambdaH, lambdaE);
    const probH = Math.round(w.home * 1000) / 10;
    const probD = Math.round(w.draw * 1000) / 10;
    const probA = Math.round(w.away * 1000) / 10;

    const odds = {
      home: m.odds?.home ?? SIM_ODDS_FAVOURITE_1X2,
      draw: m.odds?.draw ?? SIM_ODDS_DRAW,
      away: m.odds?.away ?? SIM_ODDS_FAVOURITE_1X2,
    };

    // ── 2. Pari 1N2 : la side la plus probable du modèle ──
    const sides = [
      { side: "home" as const, prob: probH },
      { side: "draw" as const, prob: probD },
      { side: "away" as const, prob: probA },
    ].sort((x, y) => y.prob - x.prob);
    const fav = sides[0];
    const odd = odds[fav.side];
    const realWinner = m.homeGoals > m.awayGoals ? "home" : m.homeGoals < m.awayGoals ? "away" : "draw";
    const oneX2Won = fav.side === realWinner;
    const oneX2Qualified = fav.prob >= PARISCORE_MIN_PROB_PCT && odd >= PARISCORE_MIN_ODDS;
    allBets.push({
      matchId: m.id,
      date: m.date,
      league: m.league,
      home: m.home,
      away: m.away,
      market: "1N2",
      pick:
        fav.side === "home" ? m.home : fav.side === "away" ? m.away : "Nul",
      side: fav.side,
      odds: odd,
      prob: fav.prob,
      predictedHome: predH,
      predictedAway: predE,
      // Convention projet : un nul est perdant pour un pick 1X2 (on joue 1 ou 2).
      result: fav.side === "draw" ? "lost" : oneX2Won ? "won" : "lost",
      profitU: fav.side === "draw" ? -FLAT_STAKE_U : oneX2Won ? odd - FLAT_STAKE_U : -FLAT_STAKE_U,
      qualified: oneX2Qualified,
      syntheticMatch: m.synthetic === true,
    });

    // ── 3. Pari Total : seuil optimal du même modèle ──
    const total = pickBacktestTotalLine(lambdaH, nuH, lambdaE, nuE);
    if (total) {
      const realTotal = m.homeGoals + m.awayGoals;
      const totalWon = total.side === "over" ? realTotal > total.line : realTotal < total.line;
      const totalQualified = total.prob >= PARISCORE_MIN_PROB_PCT && SIM_ODDS_TOTAL >= PARISCORE_MIN_ODDS;
      allBets.push({
        matchId: m.id,
        date: m.date,
        league: m.league,
        home: m.home,
        away: m.away,
        market: "total",
        pick: `${total.side === "over" ? "Over" : "Under"} ${total.line}`,
        side: null,
        odds: SIM_ODDS_TOTAL,
        prob: total.prob,
        predictedHome: predH,
        predictedAway: predE,
        result: totalWon ? "won" : "lost",
        profitU: totalWon ? SIM_ODDS_TOTAL - FLAT_STAKE_U : -FLAT_STAKE_U,
        qualified: totalQualified,
        syntheticMatch: m.synthetic === true,
      });
    }

    // ── 4. On n'injecte le match qu'APRÈS avoir prédit ──
    store.set(m.home, {
      gf: [...(h?.gf ?? []), m.homeGoals],
      ga: [...(h?.ga ?? []), m.awayGoals],
      atHome: [...(h?.atHome ?? []), true],
    });
    store.set(m.away, {
      gf: [...(a?.gf ?? []), m.awayGoals],
      ga: [...(a?.ga ?? []), m.homeGoals],
      atHome: [...(a?.atHome ?? []), false],
    });
  }

  const bets = allBets.filter((b) => b.qualified);

  // ── 5. Progression par journée ──
  const days = [...new Set(bets.map((b) => b.date))].sort();
  let cumulative = 0;
  const byDay: BacktestDayRow[] = days.map((date) => {
    const dayBets = bets.filter((b) => b.date === date);
    const segment = segmentOf(dayBets);
    cumulative += segment.profitU;
    return {
      date,
      segment,
      cumulativeProfitU: Math.round(cumulative * 100) / 100,
      nMatches: new Set(dayBets.map((b) => b.matchId)).size,
    };
  });

  return {
    league: opts.league,
    nMatches: sorted.length,
    nSyntheticMatches: sorted.filter((m) => m.synthetic === true).length,
    nFormMatches,
    bets,
    allBets,
    global: segmentOf(bets),
    byMarket: {
      "1N2": segmentOf(bets.filter((b) => b.market === "1N2")),
      total: segmentOf(bets.filter((b) => b.market === "total")),
    },
    byDay,
    thresholds: {
      minProbPct: PARISCORE_MIN_PROB_PCT,
      maxProbPct: PARISCORE_MAX_PROB_PCT,
      minOdds: PARISCORE_MIN_ODDS,
      homeAdvantageIndex: HOME_ADVANTAGE_INDEX,
    },
    methodology: methodologyNote(
      sorted.filter(
        (m) => m.odds?.home != null && m.odds?.draw != null && m.odds?.away != null,
      ).length,
      sorted.length,
    ),
  };
}

/**
 * Métriques Pariscore d'un match du backtest, exposées pour l'UI qui affiche
 * « Forme Calculée / Team Power / Index » à côté du score prédit.
 * (Réutilise exactement les fonctions du modèle live — pas de 2e formule.)
 */
export function backtestMatchMetrics(
  m: BacktestMatch,
  leagueMean: number,
): {
  homeFormPct: number | null;
  homePower: number | null;
  awayFormPct: number | null;
  awayPower: number | null;
  index: number;
} {
  // Un seul match : Forme/Power sont calculés sur cet unique résultat (donc peu
  // signifiants) — la fonction sert au PROFIL d'un match isolé, pas au backtest
  // lui-même, où le walk-forward utilise l'historique complet.
  const home = computeFormPctWeighted([m.homeGoals], [m.awayGoals], [true]);
  const away = computeFormPctWeighted([m.awayGoals], [m.homeGoals], [false]);
  const homePower = computePower([m.homeGoals], [m.awayGoals], leagueMean);
  const awayPower = computePower([m.awayGoals], [m.homeGoals], leagueMean);
  const index =
    HOME_ADVANTAGE_INDEX +
    0.25 * ((home ?? 50) - (away ?? 50)) +
    0.2 * ((homePower ?? 50) - (awayPower ?? 50));
  return {
    homeFormPct: home,
    homePower,
    awayFormPct: away,
    awayPower,
    index: Math.round(index * 10) / 10,
  };
}
