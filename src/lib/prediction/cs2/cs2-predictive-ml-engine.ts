/**
 * cs2-predictive-ml-engine.ts — Moteur prédictif CS2 scientifique
 * -----------------------------------------------------------------------------
 * S'appuie sur la littérature académique de prédiction CS:GO/CS2 :
 *  - Modèles Bradley-Terry par carte (éligibilité + probabilité de victoire
 *    individuelle M_i via l'écart de force des deux effectifs sur cette map,
 *    fenêtre glissante 90j).
 *  - Inférence du veto (simulation rationnelle du pick/ban → 3 maps probables).
 *  - Simulation Monte-Carlo MR12 round-par-round (premier à 13, OT premier à 16)
 *    intégrant pistol rounds, chaîne économique (Full Buy / Force / Eco) et le
 *    biais CT/T propre à chaque carte.
 *
 * 100% déterministe (RNG seedable) → testable unitairement.
 * Aucune dépendance réseau : reçoit un input structuré (assemblé par la couche
 * service via /api/cs2/enrich) et renvoie un objet de marchés prédictifs.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Cs2MapName =
  | "Mirage"
  | "Inferno"
  | "Nuke"
  | "Anubis"
  | "Ancient"
  | "Vertigo"
  | "Dust2";

export const ACTIVE_MAP_POOL: readonly Cs2MapName[] = [
  "Mirage",
  "Inferno",
  "Nuke",
  "Anubis",
  "Ancient",
  "Vertigo",
  "Dust2",
];

export type TeamModel = {
  name: string;
  elo: number | null; // ELO BSD (≈1000–2000)
  hltvRank: number | null;
  /** Winrate % par carte (fenêtre 3m), ex { Mirage: 72, Inferno: 45 } */
  mapWinrates: Partial<Record<Cs2MapName, number>>;
  /** Nombre de matchs joués par carte (poids de confiance) */
  mapSample: Partial<Record<Cs2MapName, number>>;
  /** Round winrate % côté CT (proxy pistol / side strength) */
  ctWinrate: number | null;
  /** Round winrate % côté T */
  tWinrate: number | null;
  /** Forme récente % (5-10 derniers matchs) */
  formWinrate: number | null;
};

export type PredictionInput = {
  team1: TeamModel;
  team2: TeamModel;
  bestOf: 1 | 3 | 5;
  mapPool?: Cs2MapName[];
  /** Graine RNG pour reproductibilité des simulations (tests / recettes) */
  seed?: number;
  /** Nombre d'itérations Monte-Carlo par carte (défaut 10 000) */
  simulations?: number;
};

export type MapPrediction = {
  map: Cs2MapName;
  /** P(équipe 1 gagne la carte) calibré Bradley-Terry + ELO */
  winProb1: number;
  winProb2: number;
  /** Probabilité de sélection via veto (ordre de pick) */
  playProbability: number;
  /** Round moyen attendu (médiane simulée) */
  expectedRounds: number;
  /** Ligne Over/Under la plus proche */
  overLine: number;
  /** P(total rounds > overLine) */
  overProb: number;
  /** Signal retenu si confiance ≥ 65% */
  overSignal: "OVER" | "UNDER" | null;
  /** Confiance du signal Over/Under (0-1) */
  overConfidence: number;
  /** Biais CT (avantage proba pour l'équipe en CT, en points) */
  ctBias: number;
  pistolT1: number;
  pistolT2: number;
  /** Handicap rounds attendu (rounds T1 − rounds T2) */
  handicapRounds: number;
};

export type MapWinnerMarket = {
  map: Cs2MapName;
  team1: number;
  team2: number;
};

export type HandicapMarket = {
  side: "team1" | "team2";
  line: string;
  prob: number;
};

export type MatchPrediction = {
  team1: string;
  team2: string;
  bestOf: number;
  /** P(équipe 1 gagne la série) */
  winProb1: number;
  winProb2: number;
  predictedMaps: MapPrediction[];
  mapWinnerMarkets: MapWinnerMarket[];
  handicapMaps: HandicapMarket[];
  totalMaps: { over: number; under: number };
  source: "bradley-terry" | "monte-carlo-mr12";
  simulations: number;
};

// ─── Constantes empiriques ───────────────────────────────────────────────────

/**
 * Biais CT par carte (en points de proba, + = CT favorisé).
 * Priors empiriques issus de la littérature de méta CS2 (côté défenseur avantagé
 * sur les cartes "exécution-heavy"). Recalibrables sur backtest.
 * Exporté pour réutilisation par le harness de backtest (scripts/cs2-backtest.ts).
 */
export const CT_BIAS: Record<Cs2MapName, number> = {
  Mirage: -0.01, // légèrement T
  Inferno: 0.03, // CT
  Nuke: 0.05, // CT fort
  Anubis: 0.04, // CT
  Ancient: 0.04, // CT
  Vertigo: 0.06, // CT fort
  Dust2: -0.02, // T
};

/** Échelle logistique ELO (écart standard). */
const ELO_SCALE = 400;

/** Multiplicateurs d'économie (perte de round proba selon l'état). */
const ECO_MULTIPLIER: Record<"full" | "force" | "eco", number> = {
  full: 1.0,
  force: 0.82,
  eco: 0.56,
};

/** Lignes Over/Under standards des bookmakers CS2. */
const OVER_LINES = [20.5, 21.5, 22.5, 23.5, 24.5, 25.5, 26.5];

/** Seuil de confiance pour émettre un signal Over/Under. */
const CONFIDENCE_THRESHOLD = 0.65;

// ─── Helpers mathématiques ───────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** RNG déterministe (mulberry32) — reproductibilité des simulations. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Bradley-Terry par carte ─────────────────────────────────────────────────

/**
 * Probabilité de victoire de l'équipe 1 sur une carte donnée.
 * Blend entre un Bradley-Terry "map-specific" (winrate empirique par carte,
 * lissé Laplace) et un terme ELO global, pondéré par la taille d'échantillon :
 * plus les deux équipes ont joué la carte, plus on fait confiance au winrate
 * observé plutôt qu'à l'ELO brut.
 */
export function mapWinProb(
  team1: TeamModel,
  team2: TeamModel,
  map: Cs2MapName,
): number {
  const wr1 = team1.mapWinrates[map];
  const wr2 = team2.mapWinrates[map];
  const n1 = team1.mapSample[map] ?? 0;
  const n2 = team2.mapSample[map] ?? 0;

  // Terme Bradley-Terry sur winrate (Laplace smoothing)
  const s1 = (wr1 ?? 50) / 100;
  const s2 = (wr2 ?? 50) / 100;
  const pWinrate = (s1 + 0.01) / (s1 + s2 + 0.02);

  // Terme ELO
  const e1 = team1.elo ?? 1500;
  const e2 = team2.elo ?? 1500;
  const pElo = sigmoid((e1 - e2) / ELO_SCALE);

  // Pondération par l'échantillon (sature à 20 matchs cumulés)
  const n = n1 + n2;
  const w = clamp(n / 20, 0, 1);

  return clamp(w * pWinrate + (1 - w) * pElo, 0.01, 0.99);
}

// ─── Inférence du veto ───────────────────────────────────────────────────────

export type VetoStep = {
  step: number;
  actor: "team1" | "team2";
  action: "ban" | "pick" | "decider";
  map: Cs2MapName;
  rationale: string;
};

/**
 * Simulation rationnelle du pick/ban (veto) pour prédire l'ordre des cartes.
 * Convention standard HLTV 7 cartes :
 *   1. T1 ban   2. T2 ban   3. T1 pick   4. T2 pick   5. T1 ban   6. T2 ban   7. decider
 * Règle d'agent rationnel : on ban la meilleure carte adverse, on pick la carte
 * où son avantage (winrate différentiel) est maximal.
 */
export function simulateVeto(
  team1: TeamModel,
  team2: TeamModel,
  pool: Cs2MapName[],
  bestOf: 1 | 3 | 5,
): { order: VetoStep[]; pickedMaps: Cs2MapName[] } {
  const remaining = [...pool];
  const order: VetoStep[] = [];
  const pickedMaps: Cs2MapName[] = [];

  const advantageFor = (team: TeamModel, opp: TeamModel, map: Cs2MapName) =>
    (team.mapWinrates[map] ?? 50) - (opp.mapWinrates[map] ?? 50);

  const banBestOpponentMap = (actor: "team1" | "team2", step: number) => {
    const actorTeam = actor === "team1" ? team1 : team2;
    const oppTeam = actor === "team1" ? team2 : team1;
    let best = remaining[0];
    let bestAdv = -Infinity;
    for (const m of remaining) {
      const adv = advantageFor(oppTeam, actorTeam, m);
      if (adv > bestAdv) {
        bestAdv = adv;
        best = m;
      }
    }
    remaining.splice(remaining.indexOf(best), 1);
    order.push({ step, actor, action: "ban", map: best, rationale: `ban meilleure carte adverse (${oppTeam.name} ${(oppTeam.mapWinrates[best] ?? 50)}%)` });
  };

  const pickBestOwnMap = (actor: "team1" | "team2", step: number) => {
    const actorTeam = actor === "team1" ? team1 : team2;
    const oppTeam = actor === "team1" ? team2 : team1;
    let best = remaining[0];
    let bestAdv = -Infinity;
    for (const m of remaining) {
      const adv = advantageFor(actorTeam, oppTeam, m);
      if (adv > bestAdv) {
        bestAdv = adv;
        best = m;
      }
    }
    remaining.splice(remaining.indexOf(best), 1);
    pickedMaps.push(best);
    order.push({ step, actor, action: "pick", map: best, rationale: `pick avantage maximal (${actorTeam.name} ${(actorTeam.mapWinrates[best] ?? 50)}% vs ${(oppTeam.mapWinrates[best] ?? 50)}%)` });
  };

  if (bestOf === 1) {
    // BO1 : 3 bans chacun → 1 carte restante (decider)
    for (let i = 0; i < 3; i++) {
      banBestOpponentMap("team1", order.length + 1);
      banBestOpponentMap("team2", order.length + 1);
    }
    const decider = remaining[0];
    pickedMaps.push(decider);
    order.push({ step: order.length + 1, actor: "team2", action: "decider", map: decider, rationale: "carte restante (BO1)" });
  } else {
    // BO3 / BO5 : ban/ban/pick/pick/ban/ban/decider
    banBestOpponentMap("team1", 1);
    banBestOpponentMap("team2", 2);
    pickBestOwnMap("team1", 3);
    pickBestOwnMap("team2", 4);
    if (bestOf === 3) {
      banBestOpponentMap("team1", 5);
      banBestOpponentMap("team2", 6);
      const decider = remaining[0];
      pickedMaps.push(decider);
      order.push({ step: 7, actor: "team2", action: "decider", map: decider, rationale: "decider BO3" });
    } else {
      // BO5 : picks supplémentaires puis decider
      pickBestOwnMap("team1", 5);
      pickBestOwnMap("team2", 6);
      const decider = remaining[0];
      pickedMaps.push(decider);
      order.push({ step: 7, actor: "team2", action: "decider", map: decider, rationale: "decider BO5" });
    }
  }

  return { order, pickedMaps };
}

// ─── Monte-Carlo MR12 ────────────────────────────────────────────────────────

type EcoState = "full" | "force" | "eco";

function ecoStateFromLossStreak(lossStreak: number): EcoState {
  if (lossStreak >= 3) return "eco";
  if (lossStreak === 2) return "force";
  return "full";
}

export type RoundDistribution = {
  t1Wins: number[];
  t2Wins: number[];
  totalRounds: number[];
  mapWinRate: number;
};

/**
 * Simule N déroulements MR12 d'une carte.
 *  - Premier à 13, OT (12-12) → premier à 16.
 *  - Pistol rounds aux rounds 1 et 13 (probabilité dédiée via CT/T winrate).
 *  - Économie : loss-streak → full / force / eco, multiplie la proba de round.
 *  - Biais CT/T : l'équipe en CT gagne (pBase + ctBias), en T (pBase − ctBias).
 * L'équipe 1 démarre CT (convention), sides swap au round 13.
 */
export function simulateMapRounds(
  pBase: number,
  ctBias: number,
  pistolT1: number,
  pistolT2: number,
  nSims: number,
  seed: number,
): RoundDistribution {
  const rand = mulberry32(seed);
  const t1Wins: number[] = [];
  const t2Wins: number[] = [];
  const totalRounds: number[] = [];
  let t1MapWins = 0;

  for (let sim = 0; sim < nSims; sim++) {
    let r1 = 0;
    let r2 = 0;
    let loss1 = 0;
    let loss2 = 0;

    const playRound = (roundIndex: number): "t1" | "t2" => {
      const t1IsCt = roundIndex < 12; // 1ère mi-temps : T1 en CT
      const isPistol = roundIndex === 0 || roundIndex === 12; // round 1 & 13

      let p: number;
      if (isPistol) {
        p = roundIndex === 0 ? pistolT1 : 1 - pistolT2;
      } else {
        p = pBase + (t1IsCt ? ctBias : -ctBias);
        const m1 = ECO_MULTIPLIER[ecoStateFromLossStreak(loss1)];
        const m2 = ECO_MULTIPLIER[ecoStateFromLossStreak(loss2)];
        p = (p * m1) / (p * m1 + (1 - p) * m2);
      }
      p = clamp(p, 0.02, 0.98);
      return rand() < p ? "t1" : "t2";
    };

    let roundIndex = 0;
    while (true) {
      const winner = playRound(roundIndex);
      if (winner === "t1") {
        r1++;
        loss1 = 0;
        loss2++;
      } else {
        r2++;
        loss2 = 0;
        loss1++;
      }
      roundIndex++;

      // MR12 : premier à 13, OT premier à 16
      const target = r1 === 12 && r2 === 12 ? 16 : 13;
      if (r1 >= target || r2 >= target) break;
      if (roundIndex > 100) break; // garde-fou
    }

    t1Wins.push(r1);
    t2Wins.push(r2);
    totalRounds.push(r1 + r2);
    if (r1 > r2) t1MapWins++;
  }

  return {
    t1Wins,
    t2Wins,
    totalRounds,
    mapWinRate: t1MapWins / nSims,
  };
}

export type MapSequence = {
  winners: ("t1" | "t2")[];
  score1: number;
  score2: number;
  total: number;
};

/**
 * Simule UN déroulement MR12 round-par-round (séquence exacte des vainqueurs
 * de rounds) — utilisé pour visualiser la projection la plus probable d'une
 * carte (icônes round par round côté UI). Même modèle que simulateMapRounds.
 */
export function simulateSingleMapSequence(
  pBase: number,
  ctBias: number,
  pistolT1: number,
  pistolT2: number,
  seed: number,
): MapSequence {
  const rand = mulberry32(seed);
  let r1 = 0;
  let r2 = 0;
  let loss1 = 0;
  let loss2 = 0;
  const winners: ("t1" | "t2")[] = [];
  let roundIndex = 0;

  while (true) {
    const t1IsCt = roundIndex < 12;
    const isPistol = roundIndex === 0 || roundIndex === 12;

    let p: number;
    if (isPistol) {
      p = roundIndex === 0 ? pistolT1 : 1 - pistolT2;
    } else {
      p = pBase + (t1IsCt ? ctBias : -ctBias);
      const m1 = ECO_MULTIPLIER[ecoStateFromLossStreak(loss1)];
      const m2 = ECO_MULTIPLIER[ecoStateFromLossStreak(loss2)];
      p = (p * m1) / (p * m1 + (1 - p) * m2);
    }
    p = clamp(p, 0.02, 0.98);

    const winner: "t1" | "t2" = rand() < p ? "t1" : "t2";
    winners.push(winner);
    if (winner === "t1") {
      r1++;
      loss1 = 0;
      loss2++;
    } else {
      r2++;
      loss2 = 0;
      loss1++;
    }
    roundIndex++;

    const target = r1 === 12 && r2 === 12 ? 16 : 13;
    if (r1 >= target || r2 >= target) break;
    if (roundIndex > 100) break;
  }

  return { winners, score1: r1, score2: r2, total: r1 + r2 };
}

// ─── Over/Under avec seuil de confiance ──────────────────────────────────────

export function overUnderSignal(
  totalRounds: number[],
): { line: number; overProb: number; signal: "OVER" | "UNDER" | null; confidence: number } {
  if (!totalRounds.length) {
    return { line: 0, overProb: 0.5, signal: null, confidence: 0 };
  }
  const mean = totalRounds.reduce((a, b) => a + b, 0) / totalRounds.length;
  // Ligne la plus proche de la moyenne (standard bookmaker)
  const line = OVER_LINES.reduce((p, c) =>
    Math.abs(c - mean) < Math.abs(p - mean) ? c : p,
  );
  const over = totalRounds.filter((t) => t > line).length;
  const overProb = over / totalRounds.length;

  let signal: "OVER" | "UNDER" | null = null;
  let confidence = 0;
  if (overProb >= CONFIDENCE_THRESHOLD) {
    signal = "OVER";
    confidence = overProb;
  } else if (overProb <= 1 - CONFIDENCE_THRESHOLD) {
    signal = "UNDER";
    confidence = 1 - overProb;
  }
  return { line, overProb, signal, confidence };
}

// ─── Pistol probabilité dérivée des CT/T winrate ─────────────────────────────

function pistolProbFor(
  ctWr: number | null,
  tWr: number | null,
  fallback: number,
): number {
  if (ctWr == null || tWr == null) return fallback;
  return clamp(sigmoid(((ctWr ?? 50) - (tWr ?? 50)) / 50), 0.05, 0.95);
}

// ─── Marché vainqueur de série (analytique sur les probas par carte) ────────

function seriesWinProb(mapProbs: number[]): number {
  // p = proba T1 gagne une carte. Série au meilleur de bestOf.
  const bestOf = mapProbs.length;
  const needed = Math.ceil(bestOf / 2);
  let p = 0;
  for (let wins = needed; wins <= bestOf; wins++) {
    for (let losses = 0; losses < needed; losses++) {
      const games = wins + losses;
      if (games > bestOf) continue;
      // combinaisons : nombre de façons d'arriver à (wins, losses)
      const combos = binomial(games - 1, wins - 1);
      p += combos * Math.pow(mapProbs[wins - 1], wins) * Math.pow(1 - mapProbs[wins - 1], losses);
    }
  }
  return clamp(p, 0, 1);
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

// ─── API principale ──────────────────────────────────────────────────────────

export function predictMatch(input: PredictionInput): MatchPrediction {
  const pool = input.mapPool ?? [...ACTIVE_MAP_POOL];
  const bestOf = input.bestOf;
  const nSims = Math.max(1, input.simulations ?? 10_000);
  const seed = input.seed ?? 42;

  // 1. Inférence du veto → cartes probables dans l'ordre
  const { order, pickedMaps } = simulateVeto(input.team1, input.team2, pool, bestOf);

  // 2. Probabilité par carte + Monte-Carlo MR12
  const predictedMaps: MapPrediction[] = pool.map((map, idx) => {
    const p1 = mapWinProb(input.team1, input.team2, map);
    const ctBias = CT_BIAS[map] ?? 0;

    const pistolT1 = pistolProbFor(input.team1.ctWinrate, input.team2.tWinrate, p1);
    const pistolT2 = pistolProbFor(input.team2.ctWinrate, input.team1.tWinrate, 1 - p1);

    const dist = simulateMapRounds(p1, ctBias, pistolT1, pistolT2, nSims, seed + idx);
    const ou = overUnderSignal(dist.totalRounds);

    const playProb =
      pickedMaps.indexOf(map) >= 0
        ? 1
        : pickedMaps.length
          ? 0.05
          : 1 / pool.length;

    const meanDiff =
      dist.t1Wins.reduce((a, b) => a + b, 0) / nSims -
      dist.t2Wins.reduce((a, b) => a + b, 0) / nSims;

    const expectedRounds =
      dist.totalRounds.reduce((a, b) => a + b, 0) / nSims;

    return {
      map,
      winProb1: +p1.toFixed(4),
      winProb2: +(1 - p1).toFixed(4),
      playProbability: +playProb.toFixed(4),
      expectedRounds: +expectedRounds.toFixed(2),
      overLine: ou.line,
      overProb: +ou.overProb.toFixed(4),
      overSignal: ou.signal,
      overConfidence: +ou.confidence.toFixed(4),
      ctBias,
      pistolT1: +pistolT1.toFixed(4),
      pistolT2: +pistolT2.toFixed(4),
      handicapRounds: +meanDiff.toFixed(2),
    };
  });

  // Trier : cartes effectivement retenues d'abord (ordre veto), puis proba de jeu
  predictedMaps.sort((a, b) => b.playProbability - a.playProbability);

  // 3. Marché vainqueur de série (analytique sur les cartes retenues)
  const playedProbs = pickedMaps.map((m) => {
    const found = predictedMaps.find((p) => p.map === m);
    return found ? found.winProb1 : 0.5;
  });
  const winProb1 = seriesWinProb(playedProbs);

  // 4. Marchés dérivés
  const mapWinnerMarkets: MapWinnerMarket[] = pickedMaps.map((m) => {
    const found = predictedMaps.find((p) => p.map === m);
    return {
      map: m,
      team1: found ? found.winProb1 : 0.5,
      team2: found ? found.winProb2 : 0.5,
    };
  });

  const handicapMaps: HandicapMarket[] = [];
  if (bestOf === 3) {
    // -1.5 maps = gagner 2-0
    const p20 = playedProbs[0] * playedProbs[1];
    const p02 = (1 - playedProbs[0]) * (1 - playedProbs[1]);
    handicapMaps.push({ side: "team1", line: "-1.5 maps", prob: +p20.toFixed(4) });
    handicapMaps.push({ side: "team2", line: "-1.5 maps", prob: +p02.toFixed(4) });
  }

  // Over/Under 2.5 maps (BO3 : 2-0 vs 2-1)
  let totalMaps = { over: 0.5, under: 0.5 };
  if (bestOf === 3) {
    const [p1, p2, p3] = playedProbs;
    const over = 1 - (p1 * p2 + (1 - p1) * (1 - p2)); // pas de 2-0 ni 0-2 → 3 maps
    totalMaps = { over: +over.toFixed(4), under: +(1 - over).toFixed(4) };
    void p3;
  }

  return {
    team1: input.team1.name,
    team2: input.team2.name,
    bestOf,
    winProb1: +winProb1.toFixed(4),
    winProb2: +(1 - winProb1).toFixed(4),
    predictedMaps,
    mapWinnerMarkets,
    handicapMaps,
    totalMaps,
    source: "monte-carlo-mr12",
    simulations: nSims,
  };
}
