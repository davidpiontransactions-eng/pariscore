"use client";

// Builder identity-stable des états live tennis, partagé entre les DEUX
// chemins de données :
//   - SSE temps réel (use-live-stream.ts, via subscribeLiveStream) ;
//   - polling REST fallback (use-live-matches.ts, /api/tennis/live, 8s).
//
// Drame résolu (R9/v6ka) : le polling reconstruisait tous les LiveMatchState à
// chaque poll → re-renders de toute la grille memoïsée (match-card-broadcast).
// Ici, un match dont la signature n'a pas bougé réutilise l'objet précédent →
// les cartes memo SAUTENT le re-render pour les matchs inchangés.
//
// Politique unifiée des 2 chemins (conforme à l'historique) :
//   - liveMatchList : TOUS les matchs reçus (live + non-live) ;
//   - liveStates : uniquement les matchs isLive.
// NOTE : les stats live n'entrent PAS dans la signature — leur évolution est
// consommée séparément (use-tennis-live-stats) sans re-render des cartes.
// NOTE 2 : `lastUpdate` ne change que quand la signature change (réutilisation
// d'identité) — le timestamp reflète la dernière MAJ réelle, pas le dernier poll.

/** Score d'un côté (sets, jeux, points) — shape utilisée par les cartes live. */
export type SideScore = {
  sets: number[];
  games: number;
  points: number;
};

/** État live normalisé d'un match — consommé par les cartes memoïsées. */
export type LiveMatchState = {
  matchId: string;
  isLive: boolean;
  currentSet: number;
  scoreA: SideScore;
  scoreB: SideScore;
  liveProbA: number;
  liveProbB: number;
  server: "A" | "B";
  /** Cote décimale live du joueur A (depuis BSD odds_player1). null si absente. */
  oddsA: number | null;
  /** Cote décimale live du joueur B (depuis BSD odds_player2). null si absente. */
  oddsB: number | null;
  lastUpdate: string;
};

/** Shape minimale commune aux matchs live des 2 sources (SSE + REST). */
export type RawLiveMatch = {
  id: string;
  playerA: { name: string };
  playerB: { name: string };
  setsDetail: Array<{ p1: number; p2: number }>;
  currentGame: { p1: number; p2: number };
  currentPoint: { p1: number; p2: number };
  currentSet: number;
  server: "A" | "B";
  liveProbA: number;
  liveProbB: number;
  isLive: boolean;
  oddsA?: number | null;
  oddsB?: number | null;
  tournamentName?: string;
  roundName?: string;
};

export type LiveListItem = {
  id: string;
  playerA: { name: string };
  playerB: { name: string };
  isLive: boolean;
  tournamentName?: string;
  roundName?: string;
};

export type LiveStateCache = {
  states: Record<string, LiveMatchState>;
  sigs: Record<string, string>;
  list: Map<string, LiveListItem>;
};

/**
 * Signature compacte d'un match : tout ce qui compte pour le rendu carte
 * (score, sets, point, serveur, probas, cotes, tournoi/round).
 * Les stats live n'y figurent PAS volontairement.
 */
export function matchSig(m: RawLiveMatch): string {
  return (
    `${m.id}|${m.isLive ? 1 : 0}|${m.currentSet}|` +
    `${m.currentGame.p1}-${m.currentGame.p2}|` +
    `${m.currentPoint.p1}-${m.currentPoint.p2}|` +
    `${m.setsDetail.map((s) => `${s.p1}-${s.p2}`).join(",")}|` +
    `${m.server}|${m.liveProbA}|${m.liveProbB}|${m.oddsA ?? ""}|${m.oddsB ?? ""}|` +
    `${m.tournamentName ?? ""}|${m.roundName ?? ""}`
  );
}

/** Conversion match brut → LiveMatchState (même shape qu'avant). */
export function toLiveState(m: RawLiveMatch, updatedAt: string): LiveMatchState {
  // FIX doublon score : ne compte que les sets TERMINÉS — le set courant est
  // exclu (il est déjà dans currentGame), sinon il serait compté deux fois.
  const completedCount = Math.min(m.currentSet, (m.setsDetail?.length ?? 0) - 1);
  const setsA = m.setsDetail.slice(0, Math.max(0, completedCount)).map((s) => s.p1);
  const setsB = m.setsDetail.slice(0, Math.max(0, completedCount)).map((s) => s.p2);

  return {
    matchId: m.id,
    isLive: m.isLive,
    currentSet: m.currentSet,
    scoreA: { sets: setsA, games: m.currentGame.p1, points: m.currentPoint.p1 },
    scoreB: { sets: setsB, games: m.currentGame.p2, points: m.currentPoint.p2 },
    liveProbA: m.liveProbA,
    liveProbB: m.liveProbB,
    oddsA: m.oddsA ?? null,
    oddsB: m.oddsB ?? null,
    server: m.server,
    lastUpdate: updatedAt,
  };
}

function toListItem(m: RawLiveMatch): LiveListItem {
  return {
    id: m.id,
    playerA: m.playerA,
    playerB: m.playerB,
    isLive: m.isLive,
    tournamentName: m.tournamentName,
    roundName: m.roundName,
  };
}

/**
 * Construit l'état live identity-stable à partir des matchs bruts du dernier
 * push/poll. Réutilise les objets `LiveMatchState` / list items précédents tant
 * que la signature d'un match n'a pas changé.
 * Politique : list = tous les matchs ; states = isLive uniquement.
 * @param matches matchs bruts du push courant.
 * @param updatedAt timestamp ISO (at du snapshot, ou Date.now() en mode update).
 * @param prev cache du push précédent (undefined au 1er push → tout reconstruit).
 */
export function buildLiveStates(
  matches: RawLiveMatch[],
  updatedAt: string,
  prev?: LiveStateCache | null,
): LiveStateCache {
  const states: Record<string, LiveMatchState> = {};
  const sigs: Record<string, string> = {};
  const list = new Map<string, LiveListItem>();

  for (const m of matches) {
    const sig = matchSig(m);
    sigs[m.id] = sig;

    const prevItem = prev?.sigs[m.id] === sig ? prev.list.get(m.id) : undefined;
    list.set(m.id, prevItem ?? toListItem(m));

    if (!m.isLive) continue;
    const prevState = prev?.sigs[m.id] === sig ? prev.states[m.id] : undefined;
    states[m.id] = prevState ?? toLiveState(m, updatedAt);
  }

  return { states, sigs, list };
}

/** Cache vide (état initial d'un hook). */
export function emptyLiveStateCache(): LiveStateCache {
  return { states: {}, sigs: {}, list: new Map<string, LiveListItem>() };
}
