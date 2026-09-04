/**
 * Top 10 joueurs tennis par métrique — refonte du Top 5 sidebar.
 *
 * Contrairement au top5 (matchs à venir), le top10 classe les JOUEURS
 * par métrique avec profil enrichi : photo, pays, classement, momentum, forme.
 *
 * Sources :
 *  - Momentum EWMA : MDPI AppliedMath 2025 (α=3.4, décroissance exponentielle)
 *  - Comparaison partielle : Garcia & Martínez Mori 2024 (stochastic dominance)
 *  - Storytelling data : ACM Practitioners 2025 ("un message par viz")
 */

import type { TennisMatch } from "./tennis-data";
import {
  TENNIS_TOP5_METRICS,
  normPlayerName,
  surfaceToKey,
  type TennisTop5Key,
  type TennisTop5MetricRow,
  type Top5Surface,
  type Top5Period,
} from "./tennis-top5";
import { getTop5PlayerStats } from "./tennis-top5-stats";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type { TennisTop5Key as TennisTop10Key, Top5Surface as Top10Surface, Top5Period as Top10Period };

export interface TennisTop10Player {
  name: string;
  shortName: string;
  country?: string;
  photoUrl?: string;
  atpRank?: number;
  wtaRank?: number;
  elo: number;
  surfaceElo?: number;
  /** 6 derniers résultats (W/L), plus récent en dernier */
  form: ("W" | "L")[];
  /** Score momentum EWMA 0-100 */
  momentumScore: number;
  /** Stats leaderboard */
  serveWonPct?: number;
  returnWonPct?: number;
  tiebreaksWonPct?: number;
  decidingSetsWonPct?: number;
}

export interface TennisTop10Entry {
  rank: number;
  player: TennisTop10Player;
  /** Valeur de la métrique principale */
  metricValue: number;
  /** Label lisible de la métrique */
  metricLabel: string;
  /** Insight dynamique (ex: "🔥 Forme ascendante", "⚡ Meilleur service") */
  insight: string;
  /** Badge value bet si edge détecté */
  isValue: boolean;
}

export interface TennisTop10Meta {
  metric: TennisTop5Key;
  surface: Top5Surface;
  period: Top5Period;
  playersConsidered: number;
  computedAt: string;
}

export interface TennisTop10Payload {
  entries: TennisTop10Entry[];
  meta: TennisTop10Meta;
}

// ─── MOMENTUM EWMA ────────────────────────────────────────────────────────────

/**
 * Score de momentum basé sur EWMA (Exponentially Weighted Moving Average).
 *
 * α = 0.34 (inspiré du paper MDPI 2025, α=3.4 sur échelle 0-10 → 0.34 sur 0-1).
 * Les matchs récents pèsent exponentiellement plus que les anciens.
 *
 * @param form - Tableau de résultats ["W", "L", "W", ...], plus récent en dernier
 * @returns Score 0-100 (100 = forme maximale)
 */
export function computeMomentum(form: ("W" | "L")[]): number {
  if (form.length === 0) return 50; // neutre par défaut
  const alpha = 0.34;
  let score = 0;
  let weightSum = 0;
  for (let i = 0; i < form.length; i++) {
    const w = Math.pow(1 - alpha, form.length - 1 - i); // décroissance exponentielle
    score += (form[i] === "W" ? 1 : 0) * w;
    weightSum += w;
  }
  return Math.round((score / weightSum) * 100);
}

// ─── INSIGHT GENERATOR ────────────────────────────────────────────────────────

function generateInsight(
  player: TennisTop10Player,
  metric: TennisTop5Key,
  metricValue: number,
  allValues: number[],
): string {
  const maxVal = Math.max(...allValues);
  const isTop = metricValue === maxVal;
  const momentum = player.momentumScore;

  // Priorité 1 : métrique dominante
  if (isTop) {
    if (metric === "surfaceElo") return "🏆 Meilleur de la surface";
    if (metric === "eloGlobal") return "🏆 Elo mondial #1";
    if (metric === "momentum") return "🔥 Forme maximale";
    if (metric === "serveDominance") return "⚡ Service dominant";
    if (metric === "returnEfficiency") return "🧲 Retour redoutable";
    if (metric === "completeness") return "🧩 Joueur complet";
    if (metric === "pressure") return "💪 Sous pression";
    if (metric === "gagnant" || metric === "mlWinner") return "🎯 Favori du modèle";
  }

  // Priorité 2 : momentum
  if (momentum >= 80) return "🔥 Forme ascendante";
  if (momentum >= 60) return "📈 En progression";
  if (momentum <= 20) return "📉 En difficulty";
  if (momentum <= 30) return "⚠️ Forme fragile";

  // Priorité 3 : surface specialization
  if (player.surfaceElo && player.elo && player.surfaceElo > player.elo + 100) {
    return "🎯 Spécialiste surface";
  }

  // Priorité 4 : fallback
  if (isTop) return "🏆 Top de la métrique";
  return `📊 Classé #${allValues.indexOf(metricValue) + 1}`;
}

// ─── BUILDER ──────────────────────────────────────────────────────────────────

/**
 * Construit le Top 10 joueurs à partir des matchs et du leaderboard.
 *
 * Approche :
 * 1. Agréger les stats par joueur (serve, return, pressure)
 * 2. Calculer le momentum EWMA pour chaque joueur
 * 3. Trier par la métrique sélectionnée
 * 4. Top 10 premiers
 */
export function buildTennisTop10(
  matches: TennisMatch[],
  lbByPlayer: Map<string, TennisTop5MetricRow>,
  metric: TennisTop5Key,
  playerInfo: Map<string, { country?: string; photoUrl?: string; atpRank?: number; wtaRank?: number; form?: ("W" | "L")[] }> = new Map(),
): TennisTop10Entry[] {
  // 1. Agréger les stats par joueur à partir des matchs
  const playerStats = new Map<string, {
    elo: number;
    surfaceElo: number;
    form: ("W" | "L")[];
    matches: number;
  }>();

  for (const m of matches) {
    if (!m?.playerA?.name || !m?.playerB?.name) continue;

    for (const side of ["A", "B"] as const) {
      const p = side === "A" ? m.playerA : m.playerB;
      const key = normPlayerName(p.name);
      if (!key) continue;

      const elo = side === "A" ? (m.eloA ?? 1500) : (m.eloB ?? 1500);
      const surfaceElo = side === "A" ? (m.dbEloSurfaceA ?? elo) : (m.dbEloSurfaceB ?? elo);
      const form = p.form ?? [];

      const prev = playerStats.get(key);
      if (prev) {
        prev.matches++;
        // Garder le form le plus récent
        if (form.length > prev.form.length) prev.form = form;
        // Moyenne pondérée pour Elos
        prev.elo = (prev.elo * (prev.matches - 1) + elo) / prev.matches;
        prev.surfaceElo = (prev.surfaceElo * (prev.matches - 1) + surfaceElo) / prev.matches;
      } else {
        playerStats.set(key, { elo, surfaceElo, form, matches: 1 });
      }
    }
  }

  // 2. Construire les entries avec métrique
  const entries: Array<{ key: string; player: TennisTop10Player; metricValue: number }> = [];

  for (const [key, stats] of playerStats) {
    const lbRow = lbByPlayer.get(key);
    const info = playerInfo.get(key);

    // Calculer la valeur de la métrique
    let metricValue = 0;
    if (metric === "surfaceElo") {
      metricValue = stats.surfaceElo;
    } else if (metric === "eloGlobal") {
      metricValue = stats.elo;
    } else if (metric === "momentum") {
      metricValue = computeMomentum(stats.form);
    } else if (metric === "serveDominance") {
      metricValue = lbRow?.servicePointsWonPct ?? 0;
    } else if (metric === "returnEfficiency") {
      metricValue = lbRow?.returnPointsWonPct ?? 0;
    } else if (metric === "completeness") {
      const s = lbRow?.servicePointsWonPct ?? 0;
      const r = lbRow?.returnPointsWonPct ?? 0;
      metricValue = s > 0 && r > 0 ? (s * r) / 100 : 0;
    } else if (metric === "pressure") {
      metricValue = lbRow?.tiebreaksWonPct ?? 0;
    } else if (metric === "gagnant" || metric === "mlWinner") {
      // Pas de classement joueur pour ces métriques (ce sont des métriques de match)
      continue;
    }

    if (metricValue <= 0 && metric !== "momentum") continue;

    // Trouver le nom d'origine (pas normalisé)
    let displayName = key;
    let shortName = key;
    for (const m of matches) {
      for (const side of ["A", "B"] as const) {
        const p = side === "A" ? m.playerA : m.playerB;
        if (normPlayerName(p.name) === key) {
          displayName = p.name;
          shortName = p.shortName || p.name.split(" ").pop() || p.name;
          break;
        }
      }
      if (displayName !== key) break;
    }

    const form = stats.form.length > 0 ? stats.form.slice(-6) : [];
    const momentumScore = computeMomentum(form);

    entries.push({
      key,
      player: {
        name: displayName,
        shortName,
        country: info?.country,
        photoUrl: info?.photoUrl,
        atpRank: info?.atpRank,
        wtaRank: info?.wtaRank,
        elo: Math.round(stats.elo),
        surfaceElo: Math.round(stats.surfaceElo),
        form,
        momentumScore,
        serveWonPct: lbRow?.servicePointsWonPct ?? undefined,
        returnWonPct: lbRow?.returnPointsWonPct ?? undefined,
        tiebreaksWonPct: lbRow?.tiebreaksWonPct ?? undefined,
        decidingSetsWonPct: lbRow?.decidingSetsWonPct ?? undefined,
      },
      metricValue: Math.round(metricValue * 100) / 100,
    });
  }

  // 3. Trier par métrique (décroissant)
  entries.sort((a, b) => b.metricValue - a.metricValue);

  // 4. Top 10 + insights
  const top10 = entries.slice(0, 10);
  const allValues = top10.map((e) => e.metricValue);
  const metricDef = TENNIS_TOP5_METRICS.find((d) => d.key === metric);

  return top10.map((e, idx) => ({
    rank: idx + 1,
    player: e.player,
    metricValue: e.metricValue,
    metricLabel: metricDef?.label ?? metric,
    insight: generateInsight(e.player, metric, e.metricValue, allValues),
    isValue: false, // sera calculé côté client si cotes disponibles
  }));
}
