/**
 * l10-surface.ts — calcul du score L10 Surface (Elo figé par semaine).
 *
 * Règle (spec PariScore) :
 *   - Historique du joueur : même surface, fenêtre 3 derniers mois,
 *     au plus 10 matchs terminés (LIVE exclus).
 *   - Elo figé : l'Elo de la SEMAINE du match (snapshot TennisEloSnapshot),
 *     pas l'Elo courant. Fallback : snapshot de la semaine la plus proche
 *     antérieure (≤ 30 jours), sinon null (match ignoré).
 *   - Points par victoire selon ΔElo = EloAdversaire(semaine) − EloJoueur(semaine) :
 *       ≤ 50   → 1 pt
 *       51-100 → 3 pts
 *       101-150 → 5 pts
 *       151-200 → 7 pts
 *       ≥ 201   → 10 pts
 *     Défaite = 0 pt, mais comptée dans le ratio W/L.
 */
import type { TennisEloSnapshot, TennisPlayerMatch, PrismaClient } from "@prisma/client";
import type { L10SurfaceMatch, L10SurfaceScoreResult } from "../../types/tennis-l10";
import { l10PerformanceOf } from "../../types/tennis-l10";

export const L10_WINDOW_DAYS = 93; // 3 derniers mois
export const L10_MAX_MATCHES = 10;

/** Points selon le ΔElo (barème spec). Δ négatif → 1 pt (adversaire plus faible). */
export function l10PointsForDiff(diff: number): number {
  if (diff <= 50) return 1;
  if (diff <= 100) return 3;
  if (diff <= 150) return 5;
  if (diff <= 200) return 7;
  return 10;
}

function snapshotElo(s: TennisEloSnapshot | undefined, surface: string): number | null {
  if (!s) return null;
  if (surface === "Hard") return s.eloHard ?? s.eloOverall;
  if (surface === "Clay") return s.eloClay ?? s.eloOverall;
  if (surface === "Grass") return s.eloGrass ?? s.eloOverall;
  return s.eloOverall;
}

function surfaceKey(surface: string): "eloHard" | "eloClay" | "eloGrass" {
  return surface === "Hard" ? "eloHard" : surface === "Clay" ? "eloClay" : "eloGrass";
}

/** Lundi d'une semaine ISO "YYYY-Www" (pour bornes de temps). */
function mondayOfWeek(weekIso: string): Date {
  const m = weekIso.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return new Date(0);
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400e3);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400e3);
}

/**
 * Elo figé le plus proche : snapshot exact de la semaine du match, sinon le
 * snapshot antérieur le plus récent (≤ 30 jours avant), sinon null.
 */
function frozenEloAt(
  snapshotsByWeek: Map<string, TennisEloSnapshot>,
  weeksSortedDesc: string[],
  weekIso: string,
  surface: string,
): number | null {
  const exact = snapshotsByWeek.get(weekIso);
  if (exact) return snapshotElo(exact, surface);
  const matchMonday = mondayOfWeek(weekIso);
  for (const w of weeksSortedDesc) {
    if (w < weekIso) {
      const s = snapshotsByWeek.get(w);
      if (!s) continue;
      if (matchMonday.getTime() - mondayOfWeek(w).getTime() > 30 * 86400e3) return null;
      return snapshotElo(s, surface);
    }
  }
  return null;
}

/**
 * Calcule le L10 Surface depuis les matchs + snapshots déjà chargés (pur).
 * `surface` : "Hard" | "Clay" | "Grass".
 * `snapshots` : snapshots du joueur ET de ses adversaires (filtrés en interne).
 */
export function computeL10Surface(opts: {
  playerKey: string;
  surface: string;
  matches: TennisPlayerMatch[];
  snapshots: TennisEloSnapshot[];
  now?: Date;
}): L10SurfaceScoreResult {
  const { playerKey, surface, matches, snapshots } = opts;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - L10_WINDOW_DAYS * 86400e3);

  const playerSnapshots = snapshots.filter((s) => s.playerKey === playerKey);
  const snapshotsByWeek = new Map<string, TennisEloSnapshot>();
  const weekSet = new Set<string>();
  for (const s of playerSnapshots) {
    snapshotsByWeek.set(s.weekIso, s);
    weekSet.add(s.weekIso);
  }
  const weeksSortedDesc = [...weekSet].sort().reverse();

  const recent = matches
    .filter((m) => m.playerKey === playerKey && m.surface === surface && m.result !== "LIVE")
    .filter((m) => m.date >= cutoff)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, L10_MAX_MATCHES);

  const details: L10SurfaceMatch[] = [];
  let score = 0;
  let wins = 0;
  let losses = 0;
  let rated = 0;

  for (const m of recent) {
    const oppSnapshots = snapshots.filter((s) => s.playerKey === m.opponentKey);
    const oppByWeek = new Map(oppSnapshots.map((s) => [s.weekIso, s]));
    const oppWeeks = [...oppByWeek.keys()].sort().reverse();
    const playerElo = frozenEloAt(snapshotsByWeek, weeksSortedDesc, m.weekIso, surface);
    const oppElo = m.opponentKey ? frozenEloAt(oppByWeek, oppWeeks, m.weekIso, surface) : null;

    const isWin = m.result === "W";
    const ratedMatch = playerElo != null && oppElo != null;
    const diff = playerElo != null && oppElo != null ? Math.round(oppElo - playerElo) : null;
    const pts = isWin && diff != null ? l10PointsForDiff(diff) : 0;

    if (isWin) wins++;
    else losses++;
    if (ratedMatch) rated++;
    score += pts;

    details.push({
      date: m.date,
      weekIso: m.weekIso,
      surface: m.surface,
      tournament: m.tournament,
      round: m.round ?? "",
      opponentName: m.opponentName,
      opponentKey: m.opponentKey ?? "",
      result: isWin ? "W" : "L",
      score: m.score ?? "",
      playerEloAtWeek: playerElo,
      opponentEloAtWeek: oppElo,
      eloDiff: diff,
      points: pts,
      rated: ratedMatch,
    });
  }

  return {
    playerKey,
    surface,
    score,
    wins,
    losses,
    matches: details.length,
    rated: rated,
    details,
    performance: l10PerformanceOf(score),
    computedAt: now.toISOString(),
    windowDays: L10_WINDOW_DAYS,
    maxMatches: L10_MAX_MATCHES,
  };
}

/**
 * Variante DB : charge matchs + snapshots (joueur + adversaires) puis calcule.
 * Retourne null si le joueur n'a aucun snapshot (surface inconnue).
 */
export async function computeL10SurfaceFromDb(
  playerKey: string,
  surface: string,
  db: Pick<PrismaClient, "tennisPlayerMatch" | "tennisEloSnapshot">,
): Promise<L10SurfaceScoreResult | null> {
  const matches = await db.tennisPlayerMatch.findMany({
    where: { playerKey, surface, result: { not: "LIVE" } },
    orderBy: { date: "desc" },
    take: 50,
  });
  const opponentKeys = [
  ...new Set(matches.map((m) => m.opponentKey).filter((k): k is string => Boolean(k))),
];
  const snapshots = await db.tennisEloSnapshot.findMany({
    where: {
      OR: [{ playerKey }, ...opponentKeys.map((k) => ({ playerKey: k }))],
    },
    orderBy: { weekIso: "desc" },
    take: 200,
  });
  if (!snapshots.some((s) => s.playerKey === playerKey)) return null;
  return computeL10Surface({ playerKey, surface, matches, snapshots });
}

export { surfaceKey };