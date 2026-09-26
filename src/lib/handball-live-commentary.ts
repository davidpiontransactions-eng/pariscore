// Moteur de commentaire live handball (bead xx78) — transformation DÉTERMINISTE
// d'événements API-Sports v3 handball (/fixtures/events, /fixtures/statistics,
// /fixtures/players) en phrases de commentateur FR + jauge d'intensité.
//
// Règles :
//  - JAMAIS d'événement fabriqué : seuls les events réellement reçus sont
//    commentés ; sans events → fil vide (pas de texte inventé).
//  - Jauge d'intensité = rythme des 5 derniers événements (buts/min sur fenêtre
//    glissante) + pénalités — 0..100, calculée côté pur, testée.
//  - Stats équipes : lecture par liste de types candidats (source peut varier),
//    clé absente → null (UI affiche « — », jamais de 0 inventé).

export type LiveEvent = {
  /** Élapsed en minutes (time.elapsed). */
  minute: number;
  team: "home" | "away";
  player?: string;
  /** "Goal" | "Card" | "subst" (schéma API-Sports). */
  type: string;
  /** "Normal" | "Yellow Card" | "Red Card" | détail but (7m…). */
  detail?: string;
  comment?: string;
};

export type TeamStat = { type: string; value: string | number | null };

export type LiveFeed = {
  events: LiveEvent[];
  homeStats: TeamStat[];
  awayStats: TeamStat[];
  homeScorers: { name: string; goals: number }[];
  awayScorers: { name: string; goals: number }[];
};

/** Phrase commentateur pour un event (null = event non commentable). */
export function commentEvent(e: LiveEvent, homeName: string, awayName: string): string | null {
  const team = e.team === "home" ? homeName : awayName;
  const who = e.player ?? team;
  if (e.type === "Goal") {
    const detail =
      e.detail && e.detail !== "Normal" ? ` (${e.detail.toLowerCase()})` : "";
    return `⚽ ${e.minute}' but ${team}${e.player ? ` — ${e.player}` : ""}${detail}`;
  }
  if (e.type === "Card") {
    const red = (e.detail ?? "").toLowerCase().includes("red");
    return red
      ? `🟥 ${e.minute}' carton rouge — ${who} (${team})`
      : `🟨 ${e.minute}' exclusion 2 min — ${who} (${team})`;
  }
  if (e.type === "subst" && e.player) {
    return `🔄 ${e.minute}' remplacement — ${e.player} (${team})`;
  }
  return null;
}

/** Commentaire complet : events triés par minute, filtre non commentables. */
export function buildCommentary(
  feed: LiveFeed,
  homeName: string,
  awayName: string,
): string[] {
  return [...feed.events]
    .sort((a, b) => a.minute - b.minute)
    .map((e) => commentEvent(e, homeName, awayName))
    .filter((s): s is string => s != null);
}

/**
 * Jauge d'intensité 0..100 : rythme de buts sur la fenêtre des 5 derniers
 * events + bonus pénalités. 0 si feed vide.
 */
export function intensityGauge(feed: LiveFeed): number {
  const evs = feed.events;
  if (evs.length === 0) return 0;
  const last = evs.reduce((m, e) => Math.max(m, e.minute), 0);
  const windowStart = Math.max(0, last - 5);
  const win = evs.filter((e) => e.minute >= windowStart);
  const span = Math.max(1, last - windowStart);
  const goals = win.filter((e) => e.type === "Goal").length;
  const cards = win.filter((e) => e.type === "Card").length;
  // Calibrage : ~4.5 buts / 5 min (rythme moyen handball, 54 buts / 60 min)
  // = 100 ; pénalité pénalités +8. Borné [0,100].
  const raw = (goals / span) * (5 / 4.5) * 100 + cards * 8;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Lecture stats par types candidats (absent → null, jamais 0 inventé). */
export function readStat(stats: TeamStat[], candidates: string[]): number | null {
  for (const c of candidates) {
    const hit = stats.find(
      (s) => s.type.toLowerCase() === c.toLowerCase(),
    );
    if (hit && hit.value != null) {
      const n = Number(String(hit.value).replace("%", ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Buteurs cumulés du match (top N par buts) — depuis /fixtures/players. */
export function topScorers(
  players: { name: string; goals: number }[],
  n = 3,
): { name: string; goals: number }[] {
  return [...players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, n);
}
