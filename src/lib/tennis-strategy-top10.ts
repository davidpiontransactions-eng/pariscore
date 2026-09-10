/**
 * Top 10 matchs tennis par stratégie de pari — miroir de
 * `football-strategy-top5.ts`, adapté aux données tennis disponibles
 * (BSD = cotes moneyline uniquement ; stats joueurs via leaderboard).
 *
 * 9 stratégies (fondements académiques dans `.context/PLAN-TENNIS-CAL-TOP10.md`) :
 *   1. surfaceEloGap   — Élo surface : écart ≥ 100 (Kovalchik 2016)
 *   2. momentum        — ≥ 4 victoires sur les 5 derniers
 *   3. serveHold       — Force service : hold % ≥ 80 (Barnett & Clarke)
 *   4. returnEfficacy  — Efficacité retour vs hold adverse
 *   5. fatigue         — Adversaire chargé (matchs 3 sets / 7 j)
 *   6. underdogValue   — proba modèle − proba marché ≥ 15 pts (outsider)
 *   7. over215         — Over 21,5 jeux via Markov ≥ 60 %
 *   8. under215        — Under 21,5 jeux : P(under) ≥ 60 %
 *   9. favorite20      — Favori 2-0 : P(match) ≥ 70 % + écart classement
 *
 * Sur/under 21,5 : le modèle Markov (`live-markov.ts`) donne la distribution
 * des scores D'UN set. On en dérive la distribution du total de jeux du match
 * BO3 par convolution (2 sets si balayage, 3 sets sinon) — pas de Monte-Carlo.
 */

import type { Player, TennisMatch } from "@/lib/tennis-data";
import type { TennisTop5MetricRow } from "@/lib/tennis-top5";
import { normPlayerName } from "@/lib/tennis-top5";
import {
  computeHolds,
  gameWinProb,
  setScoreDistribution,
  setWinProb,
} from "@/lib/prediction/live-markov";
import { tennisPowerScore, type PowerScore } from "@/lib/power-score";

// ─── Types publics ────────────────────────────────────────────────────────────

export type TennisStrategyKey =
  | "surfaceEloGap"
  | "momentum"
  | "serveHold"
  | "returnEfficacy"
  | "fatigue"
  | "underdogValue"
  | "over215"
  | "under215"
  | "favorite20";

export type TennisStrategySide = "A" | "B";

export interface TennisStrategyPlayerRow {
  name: string;
  shortName: string;
  rank: number;
  /** Élo affiché (surface si dispo, sinon global). */
  value: number;
}

export interface TennisStrategyEntry {
  matchId: string;
  tournament: string;
  round: string;
  scheduledAt: string;
  /** Surface UI FR ("Dur" | "Terre battue" | "Gazon"). */
  surface: string;
  playerA: TennisStrategyPlayerRow;
  playerB: TennisStrategyPlayerRow;
  /** Côté désigné par la stratégie — null si stratégie de match (over/under). */
  pick: TennisStrategySide | null;
  /** Valeur de classement (plus haut = mieux, sauf mention contraire). */
  value: number;
  /** Probabilité modèle (%) du côté pick — null si non pertinent. */
  probPick: number | null;
  /** % jeux de service tenus A/B (null si leaderboard absent). */
  serveA?: number | null;
  serveB?: number | null;
  /** % points de retour gagnés A/B (null si absent). */
  retA?: number | null;
  retB?: number | null;
}

export interface TennisStrategyDef {
  key: TennisStrategyKey;
  label: string;
  emoji: string;
  /** Seuil d'éligibilité minimum (interprétation par clé). */
  threshold: number;
  format: (v: number) => string;
}

/** Match brut pour le calendrier FotMob (tous les matchs considérés). */
export interface TennisCalendarPlayer {
  name: string;
  shortName: string;
  country: string | null;
}

export interface TennisCalendarMatch {
  matchId: string;
  tournament: string;
  round: string;
  scheduledAt: string;
  surface: string;
  playerA: TennisCalendarPlayer;
  playerB: TennisCalendarPlayer;
  /** PowerScore 0-100 (+ détail) des deux joueurs. */
  powerA: PowerScore;
  powerB: PowerScore;
}

// ─── Définitions UI ───────────────────────────────────────────────────────────

const pct1 = (v: number) => `${v.toFixed(1).replace(".", ",")} %`;
const int0 = (v: number) => Math.round(v).toLocaleString("fr-FR");

export const TENNIS_STRATEGY_DEFS: readonly TennisStrategyDef[] = [
  { key: "surfaceEloGap", label: "Écart Élo surface (≥ 100)", emoji: "🎯", threshold: 100, format: int0 },
  { key: "momentum", label: "Momentum (≥ 4 victoires / 5)", emoji: "🔥", threshold: 4, format: (v) => `${Math.round(v)}/5` },
  { key: "serveHold", label: "Force service (hold ≥ 80 %)", emoji: "⚡", threshold: 80, format: pct1 },
  { key: "returnEfficacy", label: "Efficacité retour", emoji: "🥊", threshold: 0, format: pct1 },
  { key: "fatigue", label: "Adversaire en fatigue (7 j)", emoji: "😴", threshold: 0, format: (v) => `${Math.round(v)} match(s) chargé(s)` },
  { key: "underdogValue", label: "Value outsider (≥ 15 pts)", emoji: "💰", threshold: 15, format: (v) => `+${v.toFixed(1).replace(".", ",")} pts` },
  { key: "over215", label: "Over 21,5 jeux (≥ 60 %)", emoji: "📈", threshold: 60, format: pct1 },
  { key: "under215", label: "Under 21,5 jeux", emoji: "📉", threshold: 0, format: pct1 },
  { key: "favorite20", label: "Favori 2-0 (≥ 70 %)", emoji: "👑", threshold: 70, format: pct1 },
] as const;


// ─── Utilitaires sur/under (Markov) ───────────────────────────────────────────

/** Distribution du nombre total de jeux d'UN set (indépendant du vainqueur),
 *  à partir de la distribution Markov des scores ("w-l" → total w+l). */
function setGamesDistribution(holdA: number, holdB: number): Record<number, number> {
  const dist = setScoreDistribution(holdA, holdB, "A");
  const byTotal: Record<number, number> = {};
  for (const [score, prob] of Object.entries(dist)) {
    const [w, l] = score.split("-").map(Number);
    byTotal[w + l] = (byTotal[w + l] ?? 0) + prob;
  }
  return byTotal;
}

/** Convolution de deux distributions de totaux (indépendance des sets). */
function convolve(
  d1: Record<number, number>,
  d2: Record<number, number>,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [g1, p1] of Object.entries(d1)) {
    for (const [g2, p2] of Object.entries(d2)) {
      const t = Number(g1) + Number(g2);
      out[t] = (out[t] ?? 0) + p1 * p2;
    }
  }
  return out;
}

/** P(total jeux du match BO3 > 21,5) et P(≤ 21,5) via convolution Markov.
 *
 * Structure BO3 : P(2 sets) = p²+(1-p)² (balayage) ; P(3 sets) = 2p(1-p). */
export function matchTotalGamesProbs(
  pServeA: number,
  pServeB: number,
): { over215: number; under215: number } {
  const [holdA, holdB] = computeHolds(pServeA, pServeB);
  const pSetA = setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");

  const perSet = setGamesDistribution(holdA, holdB);
  const twoSets = convolve(perSet, perSet);
  const threeSets = convolve(twoSets, perSet);

  const pTwo = pSetA * pSetA + (1 - pSetA) * (1 - pSetA);
  const total: Record<number, number> = {};
  for (const [g, p] of Object.entries(twoSets)) {
    total[Number(g)] = (total[Number(g)] ?? 0) + pTwo * p;
  }
  for (const [g, p] of Object.entries(threeSets)) {
    total[Number(g)] = (total[Number(g)] ?? 0) + (1 - pTwo) * p;
  }

  let over = 0;
  let under = 0;
  for (const [g, p] of Object.entries(total)) {
    if (Number(g) > 21.5) over += p;
    else under += p;
  }
  return { over215: over, under215: under };
}

// ─── Contexte d'évaluation ────────────────────────────────────────────────────

export type LeaderboardByPlayer = Map<string, TennisTop5MetricRow>;

/** Contexte pré-calculé une fois par match (évite les recalculs par stratégie). */
interface MatchContext {
  m: TennisMatch;
  lbA: TennisTop5MetricRow | undefined;
  lbB: TennisTop5MetricRow | undefined;
  /** Point de service estimé A (0-1) — depuis le leaderboard. */
  serveA: number | null;
  serveB: number | null;
}

function servePointProb(
  lb: TennisTop5MetricRow | undefined,
  fallbackElo: number,
): number | null {
  const svc = lb?.servicePointsWonPct;
  if (typeof svc === "number" && svc > 0 && svc < 100) return svc / 100;
  void fallbackElo;
  return null;
}

function buildContext(m: TennisMatch, lbByPlayer: LeaderboardByPlayer): MatchContext {
  const lbA = lbByPlayer.get(normPlayerName(m.playerA.name));
  const lbB = lbByPlayer.get(normPlayerName(m.playerB.name));
  return {
    m,
    lbA,
    lbB,
    serveA: servePointProb(lbA, m.playerA.elo),
    serveB: servePointProb(lbB, m.playerB.elo),
  };
}

function playerRow(p: Player, value: number): TennisStrategyPlayerRow {
  return { name: p.name, shortName: p.shortName || p.name, rank: p.rank, value: Math.round(value * 100) / 100 };
}

// ─── Fatigue (historique H2H) ─────────────────────────────────────────────────

const FATIGUE_WINDOW_MS = 7 * 24 * 3600 * 1000;

/** Nombre de matchs « chargés » joués par un joueur dans les 7 derniers jours :
 *  matchs à 3 sets gagnés OU perdus. Retourne null si aucun historique. */
function fatigueLoad(m: TennisMatch, side: TennisStrategySide): number | null {
  const hist = m.h2hHistory;
  if (!hist?.length) return null;
  const now = Date.now();
  const target = normPlayerName(side === "A" ? m.playerA.name : m.playerB.name);
  let load = 0;
  for (const h of hist) {
    const t = new Date(h.date).getTime();
    if (!Number.isFinite(t) || now - t > FATIGUE_WINDOW_MS) continue;
    const winner = normPlayerName(
      h.winnerId === m.playerA.id ? m.playerA.name
        : h.winnerId === m.playerB.id ? m.playerB.name : "",
    );
    const participated = winner === target || h.score.split(",").some((p) => p.includes(target.split("_").pop() ?? target));
    if (!participated) continue;
    const sets = h.score.split(",").length;
    if (sets >= 3) load += 1;
  }
  return load;
}

// ─── Helpers de scoring ────────────────────────────────────────────────────────

/** Dernières N victoires dans la forme récente (plus récent en dernier). */
function recentWins(form: ("W" | "L")[] | undefined, n: number): number {
  if (!form?.length) return 0;
  return form.slice(-n).filter((r) => r === "W").length;
}

/** Probabilités de marché implicites (0-1) dé-vigées par normalisation simple.
 *  Retourne null si les cotes moneyline sont absentes. */
function marketProbs(m: TennisMatch): { pA: number; pB: number } | null {
  const dA = m.odds?.decimalA;
  const dB = m.odds?.decimalB;
  if (!dA || !dB || dA <= 1 || dB <= 1) return null;
  const rawA = 1 / dA;
  const rawB = 1 / dB;
  const sum = rawA + rawB;
  return { pA: rawA / sum, pB: rawB / sum };
}


// ─── Scoring par stratégie (switch) ───────────────────────────────────────────

type StrategyScore = {
  /** Valeur de classement (null = match non éligible pour cette stratégie). */
  value: number | null;
  pick: TennisStrategySide | null;
  probPick: number | null;
};

/** Évalue UNE stratégie pour UN match. Pur : aucune lecture disqo/réseau. */
export function scoreStrategy(key: TennisStrategyKey, ctx: MatchContext): StrategyScore {
  const { m } = ctx;

  switch (key) {
    case "surfaceEloGap": {
      const ea = m.playerA.surfaceElo ?? m.playerA.elo;
      const eb = m.playerB.surfaceElo ?? m.playerB.elo;
      if (!m.playerA.eloKnown || !m.playerB.eloKnown) return { value: null, pick: null, probPick: null };
      const gap = Math.abs(ea - eb);
      if (gap < 100) return { value: null, pick: null, probPick: null };
      const pick: TennisStrategySide = ea > eb ? "A" : "B";
      return { value: gap, pick, probPick: pick === "A" ? m.probA : m.probB };
    }

    case "momentum": {
      const winsA = recentWins(m.playerA.form, 5);
      const winsB = recentWins(m.playerB.form, 5);
      const best = Math.max(winsA, winsB);
      if (best < 4) return { value: null, pick: null, probPick: null };
      const pick: TennisStrategySide | null = winsA === winsB ? null : winsA > winsB ? "A" : "B";
      return { value: best, pick, probPick: pick === "A" ? m.probA : pick === "B" ? m.probB : null };
    }

    case "serveHold": {
      const holdA = ctx.serveA != null ? gameWinProb(ctx.serveA) * 100 : null;
      const holdB = ctx.serveB != null ? gameWinProb(ctx.serveB) * 100 : null;
      if (holdA == null && holdB == null) return { value: null, pick: null, probPick: null };
      const a = holdA ?? -1;
      const b = holdB ?? -1;
      const best = Math.max(a, b);
      if (best < 80) return { value: null, pick: null, probPick: null };
      const pick: TennisStrategySide = a >= b ? "A" : "B";
      return { value: best, pick, probPick: pick === "A" ? m.probA : m.probB };
    }

    case "returnEfficacy": {
      const retA = ctx.lbA?.returnPointsWonPct ?? null;
      const retB = ctx.lbB?.returnPointsWonPct ?? null;
      const holdA = ctx.serveA != null ? gameWinProb(ctx.serveA) * 100 : null;
      const holdB = ctx.serveB != null ? gameWinProb(ctx.serveB) * 100 : null;
      if (retA == null && retB == null) return { value: null, pick: null, probPick: null };
      const scoreA = retA != null && holdB != null ? retA * (1 - holdB / 100) : null;
      const scoreB = retB != null && holdA != null ? retB * (1 - holdA / 100) : null;
      const a = scoreA ?? -1;
      const b = scoreB ?? -1;
      if (a <= 0 && b <= 0) return { value: null, pick: null, probPick: null };
      const pick: TennisStrategySide = a >= b ? "A" : "B";
      return { value: Math.max(a, b), pick, probPick: pick === "A" ? m.probA : m.probB };
    }

    case "fatigue": {
      const fA = fatigueLoad(m, "A");
      const fB = fatigueLoad(m, "B");
      if (fA == null && fB == null) return { value: null, pick: null, probPick: null };
      const a = fA ?? 0;
      const b = fB ?? 0;
      if (a === 0 && b === 0) return { value: null, pick: null, probPick: null };
      // On parie CONTRE le joueur fatigué : pick = le moins chargé.
      const pick: TennisStrategySide = a > b ? "B" : "A";
      return { value: Math.max(a, b), pick, probPick: pick === "A" ? m.probA : m.probB };
    }

    case "underdogValue": {
      const mp = marketProbs(m);
      if (!mp) return { value: null, pick: null, probPick: null };
      const fiable = !m.synthetic && !m.insufficientData;
      if (!fiable) return { value: null, pick: null, probPick: null };
      const edgeA = m.probA - mp.pA * 100;
      const edgeB = m.probB - mp.pB * 100;
      const marketOutsider: TennisStrategySide = mp.pA <= mp.pB ? "A" : "B";
      const edge = marketOutsider === "A" ? edgeA : edgeB;
      if (edge < 15) return { value: null, pick: null, probPick: null };
      const probPl = marketOutsider === "A" ? mp.pA : mp.pB;
      return { value: edge, pick: marketOutsider, probPick: edge + probPl * 100 };
    }

    case "over215":
    case "under215": {
      if (ctx.serveA == null || ctx.serveB == null) return { value: null, pick: null, probPick: null };
      const { over215, under215 } = matchTotalGamesProbs(ctx.serveA, ctx.serveB);
      if (key === "over215") {
        if (over215 * 100 < 60) return { value: null, pick: null, probPick: null };
        return { value: over215 * 100, pick: null, probPick: null };
      }
      if (under215 * 100 < 60) return { value: null, pick: null, probPick: null };
      return { value: under215 * 100, pick: null, probPick: null };
    }

    case "favorite20": {
      const fiable = !m.synthetic && !m.insufficientData;
      if (!fiable) return { value: null, pick: null, probPick: null };
      const prob = Math.max(m.probA, m.probB);
      if (prob < 70) return { value: null, pick: null, probPick: null };
      const pick: TennisStrategySide = m.probA >= m.probB ? "A" : "B";
      const rankFav = pick === "A" ? m.playerA.rank : m.playerB.rank;
      const rankDog = pick === "A" ? m.playerB.rank : m.playerA.rank;
      if (!(rankFav < rankDog)) return { value: null, pick: null, probPick: null };
      return { value: prob, pick, probPick: prob };
    }

    default:
      return { value: null, pick: null, probPick: null };
  }
}


// ─── Builder principal ────────────────────────────────────────────────────────

export interface TennisStrategyTop10Result {
  strategies: Record<TennisStrategyKey, TennisStrategyEntry[]>;
  matchesConsidered: number;
  computedAt: string;
  /** Tous les matchs considérés (calendrier FotMob) — indépendant des seuils. */
  matches: TennisCalendarMatch[];
}

/**
 * PowerScore d'un côté du match (calendrier + dialogs) — mêmes signaux
 * que les stratégies (Élo, forme, service, retour, SPS, fatigue).
 */
function powerForSide(
  m: TennisMatch,
  side: TennisStrategySide,
  lbByPlayer: LeaderboardByPlayer,
): PowerScore {
  const p = side === "A" ? m.playerA : m.playerB;
  const lb = lbByPlayer.get(normPlayerName(p.name));
  const servePt = servePointProb(lb, p.elo);
  return tennisPowerScore({
    surfaceElo: p.surfaceElo ?? p.elo,
    form: p.form,
    holdPct: servePt == null ? null : gameWinProb(servePt) * 100,
    returnPct: lb?.returnPointsWonPct ?? null,
    sps: p.sps,
    fatigueLoad: fatigueLoad(m, side),
  });
}

/**
 * Normalise un match externe (DTO scraper : `matchId`, pas d'Élo/forme)
 * en TennisMatch : `id` requis par le builder (entries, calendrier, pills),
 * `insufficientData` pour que les stratégies à seuils l'ignorent sans
 * crasher. Retourne null si inexploitable.
 */
export function normalizeExternalMatch(m: {
  matchId?: string;
  tournament?: string;
  round?: string;
  scheduledAt?: string;
  surface?: string;
  playerA?: { name?: string; shortName?: string; country?: string | null };
  playerB?: { name?: string; shortName?: string; country?: string | null };
}): TennisMatch | null {
  const nameA = m.playerA?.name;
  const nameB = m.playerB?.name;
  if (!m.matchId || !nameA || !nameB || !m.scheduledAt) return null;
  const now = new Date().toISOString();
  const player = (
    name: string,
    short: string | undefined,
    country: string | null | undefined,
  ): Player => ({
    id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    shortName: short || name,
    rank: 0,
    elo: 1500,
    eloKnown: false,
    photoUrl: "",
    color: "#999",
    form: [],
    country: country ?? undefined,
  });
  return {
    id: m.matchId,
    tournament: m.tournament ?? "",
    round: m.round ?? "",
    scheduledAt: m.scheduledAt,
    playerA: player(nameA, m.playerA?.shortName, m.playerA?.country),
    playerB: player(nameB, m.playerB?.shortName, m.playerB?.country),
    probA: 50,
    probB: 50,
    stats: { form: "", eloGap: 0, surface: m.surface ?? "Dur", h2h: "—", ic: [0, 100], confidence: 0 },
    model: "external",
    modelUpdatedAt: now,
    insufficientData: true,
  } as TennisMatch;
}

/**
 * Construit le Top 10 matchs par stratégie. Un match n'entre dans une
 * stratégie que si `scoreStrategy` retourne une valeur (données complètes
 * et seuil respecté). Tri : value décroissante, puis proba modèle.
 */
export function buildTennisStrategyTop10(
  matches: TennisMatch[],
  lbByPlayer: LeaderboardByPlayer,
  opts: { limit?: number } = {},
): TennisStrategyTop10Result {
  const limit = opts.limit ?? 10;
  const strategies = {} as Record<TennisStrategyKey, TennisStrategyEntry[]>;
  const contexts = new Map<string, MatchContext>();

  for (const def of TENNIS_STRATEGY_DEFS) {
    const entries: TennisStrategyEntry[] = [];
    for (const m of matches) {
      if (!m?.playerA?.name || !m?.playerB?.name) continue;
      const id = m.id;
      let ctx = contexts.get(id);
      if (!ctx) {
        ctx = buildContext(m, lbByPlayer);
        contexts.set(id, ctx);
      }
      const { value, pick, probPick } = scoreStrategy(def.key, ctx);
      if (value == null) continue;

      entries.push({
        matchId: m.id,
        tournament: m.tournament ?? "",
        round: m.round ?? "",
        scheduledAt: m.scheduledAt ?? "",
        surface: m.stats?.surface ?? "Dur",
        playerA: playerRow(m.playerA, m.playerA.surfaceElo ?? m.playerA.elo),
        playerB: playerRow(m.playerB, m.playerB.surfaceElo ?? m.playerB.elo),
        pick,
        value: Math.round(value * 100) / 100,
        probPick,
        serveA: ctx.serveA != null ? gameWinProb(ctx.serveA) * 100 : null,
        serveB: ctx.serveB != null ? gameWinProb(ctx.serveB) * 100 : null,
        retA: ctx.lbA?.returnPointsWonPct ?? null,
        retB: ctx.lbB?.returnPointsWonPct ?? null,
      });
    }
    entries.sort(
      (x, y) => y.value - x.value || (y.probPick ?? 0) - (x.probPick ?? 0),
    );
    strategies[def.key] = entries.slice(0, limit);
  }

  const calMatches: TennisCalendarMatch[] = matches
    .filter((m) => m?.playerA?.name && m?.playerB?.name)
    .map((m) => ({
      matchId: m.id,
      tournament: m.tournament ?? "",
      round: m.round ?? "",
      scheduledAt: m.scheduledAt ?? "",
      surface: m.stats?.surface ?? "Dur",
      playerA: {
        name: m.playerA.name,
        shortName: m.playerA.shortName || m.playerA.name,
        country: m.playerA.country ?? null,
      },
      playerB: {
        name: m.playerB.name,
        shortName: m.playerB.shortName || m.playerB.name,
        country: m.playerB.country ?? null,
      },
      powerA: powerForSide(m, "A", lbByPlayer),
      powerB: powerForSide(m, "B", lbByPlayer),
    }));
  return { strategies, matchesConsidered: matches.length, computedAt: new Date().toISOString(), matches: calMatches };
}

// ─── Export utilitaires (tests & route API) ───────────────────────────────────

export { gameWinProb };
export type { TennisMatch, Player };
