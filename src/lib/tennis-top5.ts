import type { TennisMatch } from "@/lib/tennis-data";

/** Shape minimal requis pour évaluer les métriques leaderboard d'un joueur
 *  (satisfait à la fois par LeaderboardRow et par Top5MetricRow interne). */
export interface TennisTop5MetricRow {
  servicePointsWonPct?: number | null;
  returnPointsWonPct?: number | null;
  tiebreaksWonPct?: number | null;
  decidingSetsWonPct?: number | null;
}

/**
 * Top 5 matchs tennis par métrique joueur — inspiré du widget foot
 * (football-strategy-top5). Les métriques s'appuient sur la littérature de
 * prédiction tennis (thèses Dryja VU 2025 & Willekes 2022, synthèse dans
 * TENNIS_SIDEBAR_DEBUG.md) :
 *  - Élo PAR SURFACE = recommandation n°1 de Dryja pour « meilleur joueur
 *    selon la surface » (ladder séparé, K fixe, sans decay — validation Nadal) ;
 *  - CMPLT = service × retour (proxy Sipko repris par Dryja : récompense
 *    l'all-round) ;
 *  - domination service / efficacité retour / pression (TB + sets décisifs)
 *    issues des boards stats internes (getStatsLeaderboard).
 */

export type TennisTop5Key =
  | "surfaceElo"
  | "eloGlobal"
  | "momentum"
  | "serveDominance"
  | "returnEfficiency"
  | "completeness"
  | "pressure"
  | "gagnant"
  | "mlWinner";

export type Top5Surface = "all" | "hard" | "clay" | "grass";
export type Top5Period = "52w" | "ytd" | "all";

export interface PlayerMetricSide {
  name: string;
  shortName: string;
  /** Valeur de la métrique côté joueur (garantie présente : les matchs
   *  à valeur manquante sont écartés par le builder). */
  value: number;
}

export interface TennisTop5Entry {
  matchId: string;
  scheduledAt: string;
  tournament: string;
  round: string;
  /** Surface UI FR ("Dur" | "Terre battue" | "Gazon"). */
  surface: string;
  playerA: PlayerMetricSide;
  playerB: PlayerMetricSide;
  /** Côté favori selon la métrique — null si égalité ou donnée incomplète. */
  pick: "A" | "B" | null;
  /** Valeur de la métrique sur le côté pick (tri desc). */
  value: number;
  /** Probabilité modèle (%) du côté pick — null si indisponible. */
  probPick: number | null;
}

export interface TennisTop5Def {
  key: TennisTop5Key;
  label: string;
  emoji: string;
  /** true si la valeur est une probabilité (%) — sinon métrique de niveau. */
  isProb: boolean;
  format: (v: number) => string;
  /** Source : payload match (BSD) ou leaderboard stats DB. */
  source: "match" | "leaderboard";
}

const pct1 = (v: number) => `${v.toFixed(1).replace(".", ",")} %`;
const int0 = (v: number) => Math.round(v).toLocaleString("fr-FR");

export const TENNIS_TOP5_METRICS: readonly TennisTop5Def[] = [
  {
    key: "surfaceElo",
    label: "Meilleur joueur de la surface (Élo surface)",
    emoji: "🎯",
    isProb: false,
    format: int0,
    source: "match",
  },
  {
    key: "eloGlobal",
    label: "Élo global le plus élevé",
    emoji: "🌐",
    isProb: false,
    format: int0,
    source: "match",
  },
  {
    key: "momentum",
    label: "Momentum / forme récente",
    emoji: "🔥",
    isProb: false,
    format: (v) => `${Math.round(v)}/100`,
    source: "match",
  },
  {
    key: "serveDominance",
    label: "Domination service (points gagnés sur mise en jeu)",
    emoji: "⚡",
    isProb: false,
    format: pct1,
    source: "leaderboard",
  },
  {
    key: "returnEfficiency",
    label: "Efficacité retour (points gagnés en retour)",
    emoji: "🧲",
    isProb: false,
    format: pct1,
    source: "leaderboard",
  },
  {
    key: "completeness",
    label: "Complétude all-round (service × retour, points)",
    emoji: "🧩",
    isProb: false,
    format: (v) => v.toFixed(2).replace(".", ","),
    source: "leaderboard",
  },
  {
    key: "pressure",
    label: "Sous pression (tie-breaks + sets décisifs)",
    emoji: "💥",
    isProb: false,
    format: pct1,
    source: "leaderboard",
  },
  {
    key: "gagnant",
    label: "Gagnant prédit par le modèle (confiance)",
    emoji: "🏆",
    isProb: true,
    format: pct1,
    source: "match",
  },
  {
    key: "mlWinner",
    label: "Gagnant prédit par le modèle ML v2.0 (XGBoost)",
    emoji: "🤖",
    isProb: true,
    format: pct1,
    source: "match",
  },
];

/** Valeur d'une métrique pour un côté de match (payload BSD). */
function sideMatchValue(m: TennisMatch, side: "A" | "B", key: TennisTop5Key): number | null {
  const p = side === "A" ? m.playerA : m.playerB;
  if (!p) return null;
  switch (key) {
    case "surfaceElo":
      return p.surfaceElo ?? p.elo ?? null;
    case "eloGlobal":
      return p.elo ?? null;
    case "momentum":
      // MomentumScore EWM 0-100 ; repli forme W/L → score simple.
      if (typeof p.momentumScore === "number") return p.momentumScore;
      if (Array.isArray(p.form) && p.form.length > 0) {
        const wins = p.form.filter((f) => f === "W").length;
        return Math.round((wins / p.form.length) * 100);
      }
      return null;
    default:
      return null;
  }
}

/** Valeur d'une métrique depuis une ligne de stats joueur. */
function rowValue(row: TennisTop5MetricRow | undefined, key: TennisTop5Key): number | null {
  if (!row) return null;
  switch (key) {
    case "serveDominance":
      // SRV_PTS_WON (Dryja) — points gagnés sur mise en jeu.
      return row.servicePointsWonPct ?? null;
    case "returnEfficiency":
      // RET_PTS_WON (Dryja) — points gagnés en retour.
      return row.returnPointsWonPct ?? null;
    case "completeness": {
      // CMPLT = SRV_PTS_WON × RET_PTS_WON (Sipko repris par Dryja).
      if (row.servicePointsWonPct == null || row.returnPointsWonPct == null) return null;
      return (row.servicePointsWonPct * row.returnPointsWonPct) / 100;
    }
    case "pressure": {
      const tb = row.tiebreaksWonPct;
      const dec = row.decidingSetsWonPct;
      if (tb == null && dec == null) return null;
      if (tb == null) return dec!;
      if (dec == null) return tb;
      return (tb + dec) / 2;
    }
    default:
      return null;
  }
}

/** Clé de jointure noms BSD ↔ leaderboard (accents/ponctuation ignorés). */
export function normPlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Surface UI FR → clé filtre (tolérant aux variantes BSD). */
export function surfaceToKey(raw: string | undefined | null): Top5Surface {
  const s = (raw ?? "").toLowerCase();
  if (/gazon|grass/.test(s)) return "grass";
  if (/terre|clay/.test(s)) return "clay";
  if (/dur|hard/.test(s)) return "hard";
  return "all";
}

/**
 * Construit le Top 5 : ne garde que les matchs où LES DEUX côtés ont une
 * valeur (exigence de comparabilité, comme la forme L5 exigée côté foot),
 * pick = côté à la valeur max, tri desc, 5 premiers.
 */
export function buildTennisTop5(
  matches: TennisMatch[],
  lbByPlayer: Map<string, TennisTop5MetricRow>,
  metric: TennisTop5Key,
): TennisTop5Entry[] {
  const entries: TennisTop5Entry[] = [];

  for (const m of matches) {
    if (!m?.playerA?.name || !m?.playerB?.name) continue;

    let va: number | null;
    let vb: number | null;
    if (metric === "gagnant") {
      // Confiance du modèle serveur (blend Élo-surface/forme/H2H — Kovalchik
      // 2016 & Dryja 2025). playerA = favori par construction du type.
      // Synthétiques/données insuffisantes : aucune prédiction fiable.
      const fiable = !m.synthetic && !m.insufficientData;
      va = fiable && Number.isFinite(m.probA) ? m.probA : null;
      vb = fiable && Number.isFinite(m.probB) ? m.probB : null;
    } else if (metric === "mlWinner") {
      // Nouveau modèle ML v2.0 (XGBoost surface-specific + calibration)
      // Utilise probA/probB du modèle ML si disponible, sinon fallback sur l'ancien modèle
      const fiable = !m.synthetic && !m.insufficientData;
      // Pour l'instant, on utilise les mêmes probA/probB (l'API ML les mettra à jour)
      // TODO: Ajouter champs mlProbA/mlProbB dans TennisMatch quand l'API ML sera branchée
      va = fiable && Number.isFinite(m.probA) ? m.probA : null;
      vb = fiable && Number.isFinite(m.probB) ? m.probB : null;
    } else if (TENNIS_TOP5_METRICS.find((d) => d.key === metric)?.source === "leaderboard") {
      const rowA = lbByPlayer.get(normPlayerName(m.playerA.name));
      const rowB = lbByPlayer.get(normPlayerName(m.playerB.name));
      va = rowValue(rowA, metric);
      vb = rowValue(rowB, metric);
    } else {
      va = sideMatchValue(m, "A", metric);
      vb = sideMatchValue(m, "B", metric);
    }
    if (va == null || vb == null || !Number.isFinite(va) || !Number.isFinite(vb)) continue;

    const diff = va - vb;
    const pick: "A" | "B" | null =
      Math.abs(diff) < Number.EPSILON ? null : diff > 0 ? "A" : "B";
    // Tri : matches avec un favori net d'abord (écart décroissant), puis proba.
    const probPick =
      pick === "A" ? (m.probA ?? null) : pick === "B" ? (m.probB ?? null) : null;

    entries.push({
      matchId: m.id,
      scheduledAt: m.scheduledAt ?? "",
      tournament: m.tournament ?? "",
      round: m.round ?? "",
      surface: m.stats?.surface ?? "Dur",
      playerA: { name: m.playerA.name, shortName: m.playerA.shortName || m.playerA.name, value: va },
      playerB: { name: m.playerB.name, shortName: m.playerB.shortName || m.playerB.name, value: vb },
      pick,
      value: pick === "B" ? vb : va,
      probPick: typeof probPick === "number" && Number.isFinite(probPick) ? probPick : null,
    });
  }

  entries.sort(
    (x, y) =>
      Math.abs(y.playerA.value - y.playerB.value) -
        Math.abs(x.playerA.value - x.playerB.value) ||
      (y.probPick ?? 50) - (x.probPick ?? 50),
  );
  return entries.slice(0, 5);
}
