// Pipeline de features pour la Win Probability live football (soccer).
//
// Extrait et normalise les 38 champs canoniques BSD (sports.bzzoiro.com) en un
// vecteur de features exploitable par un modèle de prédiction en cours de match.
//
// Sources (server.js, backend legacy) :
//   - `_bsdWsApplyEventStats` (mapper WS) → champs `live_*` au format {home, away}
//   - `_bsdMergeShotmap`      → live_xg, live_xg_per_minute, live_momentum, live_shotmap
//   - `computeLiveIntensityFromBSD` → live_intensity (0-100)
//
// Conventions de données (cf. .context/BSD-LIVE-VS-SCRAPE.md §1.2) :
//   - Stats scalaires : { home: number, away: number }
//   - Cartons : { home: {yellow, red}, away: {yellow, red} }
//   - Momentum : Array<{ min: number, v: number }>, v ∈ [-100, +100] (+ = home domine)
//   - Score : string "H-A" (ex: "2-1")
//
// Zéro dépendance externe. Type strict. Préparé pour une logistic regression
// future (T0.3 v2) via `toFeatureVector()`.

/** Représentation partiellement typée d'un match live BSD (champs pertinents). */
export interface BSDLiveMatch {
  live_score?: string | { home?: number; away?: number };
  live_minute?: number;
  live_period?: string;
  expectedGoals?: { home?: number; away?: number };
  live_xg?: { home?: number; away?: number };
  live_possession?: { home?: number | string; away?: number | string };
  live_shots?: { home?: number; away?: number };
  live_shots_on_target?: { home?: number; away?: number };
  live_shots_off_target?: { home?: number; away?: number };
  live_shots_blocked?: { home?: number; away?: number };
  live_shots_inside_box?: { home?: number; away?: number };
  live_corners?: { home?: number; away?: number };
  live_fouls?: { home?: number; away?: number };
  live_offsides?: { home?: number; away?: number };
  live_cards?: {
    home?: { yellow?: number; red?: number };
    away?: { yellow?: number; red?: number };
  };
  live_passes?: { home?: number; away?: number };
  live_pass_accuracy?: { home?: number; away?: number };
  live_big_chances?: { home?: number; away?: number };
  live_big_chances_missed?: { home?: number; away?: number };
  live_big_chances_scored?: { home?: number; away?: number };
  live_touches_opp_box?: { home?: number; away?: number };
  live_final_third_entries?: { home?: number; away?: number };
  live_saves?: { home?: number; away?: number };
  live_goals_prevented?: { home?: number; away?: number };
  live_interceptions?: { home?: number; away?: number };
  live_recoveries?: { home?: number; away?: number };
  live_tackles?: { home?: number; away?: number };
  live_clearances?: { home?: number; away?: number };
  live_crosses?: { home?: number; away?: number };
  live_momentum?: Array<{ min?: number; v?: number }>;
  live_momentum_pct?: {
    home?: { attack_pct?: number; dangerous_attack_pct?: number; ball_safe_pct?: number };
    away?: { attack_pct?: number; dangerous_attack_pct?: number; ball_safe_pct?: number };
  };
  live_dangerous_attacks?: { home?: number; away?: number };
  live_intensity?: number;
}

/** Features live normalisées, prêtes pour la modélisation. */
export interface LiveFeatures {
  // Temps & score
  minute: number;
  period: string | null;
  timeFactor: number; // (90 - minute) / 90  — fraction de match restante
  scoreHome: number;
  scoreAway: number;
  scoreDiff: number; // home - away (>0 = home mène)
  // xG
  xgHome: number | null;
  xgAway: number | null;
  xgDiff: number | null; // home - away
  xgRateHome: number | null; // (xgHome / minute) * 90 — projection fin de match
  xgRateAway: number | null;
  // Attaque / contrôle
  possessionHome: number | null; // 0-100
  possessionAway: number | null;
  possessionRatio: number | null; // home / (home + away), ~0.5 neutre
  shotsHome: number | null;
  shotsAway: number | null;
  sotHome: number | null; // shots on target
  sotAway: number | null;
  cornersHome: number | null;
  cornersAway: number | null;
  dangerousAttacksHome: number | null;
  dangerousAttacksAway: number | null;
  // Qualité des occasions
  bigChancesHome: number | null;
  bigChancesAway: number | null;
  bigChancesMissedHome: number | null;
  bigChancesMissedAway: number | null;
  touchesOppBoxHome: number | null;
  touchesOppBoxAway: number | null;
  // Discipline (NOUVEAU — non exploité par calcLiveAdjustedLambdas)
  redCardsHome: number;
  redCardsAway: number;
  yellowCardsHome: number;
  yellowCardsAway: number;
  // Momentum dérivé
  momentumTail6: number | null; // moyenne signée 6 derniers points, [-100,+100]
  momentumVolatility: number | null; // écart-type |v| sur fenêtre
  // Défense / gardien
  savesHome: number | null;
  savesAway: number | null;
  goalsPreventedHome: number | null;
  goalsPreventedAway: number | null;
  tacklesHome: number | null;
  interceptionsHome: number | null;
  // T3.2 — Sentiment dérivé maison (placeholder). Combinaison normalisée de
  // momentum + score + xG + possession → proxy [-1,+1] par équipe (home - away).
  // Zéro source externe ; sert de skeleton pour brancher une vraie source NLP
  // plus tard (le calcul sera remplacé, le contrat FEATURE_ORDER reste stable).
  sentimentHome: number; // [-1,+1], + = sentiment favorable à home
  sentimentAway: number; // [-1,+1], + = sentiment favorable à away
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};

const pair = (o: { home?: unknown; away?: unknown } | null | undefined) => {
  if (!o) return { home: null, away: null };
  return { home: num(o.home), away: num(o.away) };
};

/** Parse un score BSD (string "H-A" ou objet {home, away}). */
export function parseScore(raw: BSDLiveMatch['live_score']): { home: number; away: number } {
  if (!raw) return { home: 0, away: 0 };
  if (typeof raw === 'object') {
    return { home: num(raw.home) ?? 0, away: num(raw.away) ?? 0 };
  }
  if (typeof raw === 'string' && raw.includes('-')) {
    const parts = raw.split('-').map(Number);
    return { home: Number.isFinite(parts[0]) ? parts[0] : 0, away: Number.isFinite(parts[1]) ? parts[1] : 0 };
  }
  return { home: 0, away: 0 };
}

/** Extrait les features live normalisées d'un match BSD. Ne lance jamais. */
export function extractLiveFeatures(match: BSDLiveMatch): LiveFeatures {
  const minute = Math.max(0, Math.min(130, num(match.live_minute) ?? 0));
  const period = match.live_period || null;
  const { home: scoreHome, away: scoreAway } = parseScore(match.live_score);

  const xg = pair(match.live_xg);
  const poss = pair(match.live_possession);
  const shots = pair(match.live_shots);
  const sot = pair(match.live_shots_on_target);
  const corners = pair(match.live_corners);
  const dang = pair(match.live_dangerous_attacks);
  const bc = pair(match.live_big_chances);
  const bcm = pair(match.live_big_chances_missed);
  const tob = pair(match.live_touches_opp_box);
  const saves = pair(match.live_saves);
  const gp = pair(match.live_goals_prevented);
  const tac = pair(match.live_tackles);

  // Cartons (nested {yellow, red})
  const cardsH = match.live_cards?.home || {};
  const cardsA = match.live_cards?.away || {};
  const redCardsHome = num(cardsH.red) ?? 0;
  const redCardsAway = num(cardsA.red) ?? 0;
  const yellowCardsHome = num(cardsH.yellow) ?? 0;
  const yellowCardsAway = num(cardsA.yellow) ?? 0;

  // Possession ratio (0-1, ~0.5 neutre)
  let possessionRatio: number | null = null;
  if (poss.home != null && poss.away != null && poss.home + poss.away > 0) {
    possessionRatio = poss.home / (poss.home + poss.away);
  }

  // Momentum : moyenne signée des 6 derniers points + volatilité
  let momentumTail6: number | null = null;
  let momentumVolatility: number | null = null;
  const arr = Array.isArray(match.live_momentum) ? match.live_momentum : [];
  if (arr.length > 0) {
    const tail = arr.slice(-6);
    const vs = tail.map(p => num(p?.v) ?? 0);
    momentumTail6 = vs.reduce((a, b) => a + b, 0) / vs.length;
    const mean = momentumTail6;
    const variance = vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length;
    momentumVolatility = Math.sqrt(variance);
  }

  const xgDiff = xg.home != null && xg.away != null ? xg.home - xg.away : null;
  const xgRateHome = xg.home != null && minute > 0 ? (xg.home / minute) * 90 : null;
  const xgRateAway = xg.away != null && minute > 0 ? (xg.away / minute) * 90 : null;

  const features: LiveFeatures = {
    minute,
    period,
    timeFactor: Math.max(0, (90 - minute) / 90),
    scoreHome,
    scoreAway,
    scoreDiff: scoreHome - scoreAway,
    xgHome: xg.home,
    xgAway: xg.away,
    xgDiff,
    xgRateHome,
    xgRateAway,
    possessionHome: poss.home,
    possessionAway: poss.away,
    possessionRatio,
    shotsHome: shots.home,
    shotsAway: shots.away,
    sotHome: sot.home,
    sotAway: sot.away,
    cornersHome: corners.home,
    cornersAway: corners.away,
    dangerousAttacksHome: dang.home,
    dangerousAttacksAway: dang.away,
    bigChancesHome: bc.home,
    bigChancesAway: bc.away,
    bigChancesMissedHome: bcm.home,
    bigChancesMissedAway: bcm.away,
    touchesOppBoxHome: tob.home,
    touchesOppBoxAway: tob.away,
    redCardsHome,
    redCardsAway,
    yellowCardsHome,
    yellowCardsAway,
    momentumTail6,
    momentumVolatility,
    savesHome: saves.home,
    savesAway: saves.away,
    goalsPreventedHome: gp.home,
    goalsPreventedAway: gp.away,
    tacklesHome: tac.home,
    interceptionsHome: pair(match.live_interceptions).home,
    // T3.2 — Sentiment dérivé maison (placeholder). Blend normalisé [-1,+1] de 4
    // signaux : momentum (40%), scoreDiff (30%), xgDiff (20%), possessionRatio (10%).
    // tanh borne les contributions ; somme → sentiment home, opposé → away.
    sentimentHome: (function () {
      const momC = momentumTail6 != null ? Math.tanh((momentumTail6 / 100) * 2) * 0.40 : 0;
      const sd = scoreHome - scoreAway;
      const scoreC = Math.tanh(sd / 2) * 0.30; // 2 buts d'écart ≈ saturation
      const xgC = xgDiff != null ? Math.tanh(xgDiff / 3) * 0.20 : 0;
      const possC = possessionRatio != null ? (possessionRatio - 0.5) * 2 * 0.10 : 0;
      const raw = momC + scoreC + xgC + possC;
      return Math.round(Math.max(-1, Math.min(1, raw)) * 1000) / 1000;
    })(),
    sentimentAway: 0, // calculé ci-dessous (opposé de home)
  };
  // sentimentAway = opposé de home (jeu à somme nulle pour le proxy sentiment)
  // +0 normalisation pour éviter -0 (Object.is(0,-0) === false en test strict)
  features.sentimentAway = Math.round(-features.sentimentHome * 1000) / 1000 || 0;
  return features;
}

/** Ordre canonique du vecteur de features (stable pour l'entraînement ML). */
export const FEATURE_ORDER: readonly (keyof LiveFeatures)[] = [
  'minute', 'timeFactor', 'scoreDiff', 'scoreHome', 'scoreAway',
  'xgDiff', 'xgRateHome', 'xgRateAway',
  'possessionRatio', 'shotsHome', 'shotsAway', 'sotHome', 'sotAway',
  'cornersHome', 'cornersAway', 'dangerousAttacksHome', 'dangerousAttacksAway',
  'bigChancesHome', 'bigChancesAway', 'touchesOppBoxHome',
  'redCardsHome', 'redCardsAway', 'yellowCardsHome', 'yellowCardsAway',
  'momentumTail6', 'momentumVolatility',
  'savesHome', 'goalsPreventedHome', 'tacklesHome', 'interceptionsHome',
  // T3.2 — ajoutés en FIN (contrat stable : ne pas réordonner sans ré-entraîner).
  'sentimentHome', 'sentimentAway',
] as const;

/**
 * Convertit les features en vecteur numérique pour l'inférence ML.
 * Les valeurs null sont remplacées par 0 (imputation neutre).
 * L'ordre est garanti stable via FEATURE_ORDER (ne pas réordonner sans
 * ré-entraîner le modèle consommateur).
 */
export function toFeatureVector(f: LiveFeatures): number[] {
  return FEATURE_ORDER.map(k => {
    const v = f[k];
    return v == null ? 0 : (v as number);
  });
}
