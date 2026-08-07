// Service highlights du tour précédent.
// Partie 1 — FONCTIONS PURES (mapping surface, étiquette, requêtes cascade).
// Partie 2 — orchestration : résolution BSD (last5) + cascade vidéo + cache 48h.

import { fetchMatchH2H } from "@/lib/bsd-tennis-service";
import type { BSDH2H, BSDMatch } from "@/lib/bsd-tennis-service";
import { parseBsdId } from "@/lib/bsd-id";
import { pickBest, searchYouTube } from "@/services/last-match-highlights-service";

export type TennisSurface = "hard" | "clay" | "grass" | null;
export type PreviousRoundLabel = "tour-precedent" | "dernier-match";

export type PreviousRoundContext = {
  round: string | null;
  tournament: string | null;
  surface: string | null;
  opponent: string | null;
  won: boolean | null;
  score: string | null;
};

export type PreviousRoundPlayer = {
  playerId: string;
  playerName: string;
  label: PreviousRoundLabel;
  context: PreviousRoundContext;
  video: { videoId: string; title: string; url: string } | null;
};

const SURFACE_MAP: Record<string, TennisSurface> = {
  "Terre battue": "clay",
  "Dur": "hard",
  "Gazon": "grass",
};

export function mapSurfaceToken(frSurface: string | null): TennisSurface {
  if (!frSurface) return null;
  const key = frSurface.trim();
  return SURFACE_MAP[key] ?? null;
}

export function labelForMatch(
  tournamentName: string | null,
  currentTournamentName: string | null,
): PreviousRoundLabel {
  if (!tournamentName || !currentTournamentName) return "dernier-match";
  return tournamentName.trim().toLowerCase() ===
    currentTournamentName.trim().toLowerCase()
    ? "tour-precedent"
    : "dernier-match";
}

export function buildHighlightQuery(
  playerName: string,
  ctx: {
    opponent: string | null;
    tournament: string | null;
    surface: TennisSurface;
  },
  currentYear: string,
): string[] {
  const surface = ctx.surface ? `${ctx.surface} ` : "";
  const year = ` ${currentYear}`;
  const queries: string[] = [];
  if (ctx.opponent) {
    const adv = `${playerName} vs ${ctx.opponent} highlights`;
    queries.push(
      `${adv} ${surface}${ctx.tournament ? `${ctx.tournament}` : ""}${year}`.trim(),
    );
    queries.push(`${adv} ${surface}`.trim());
  }
  queries.push(
    `${playerName} highlights ${surface}${ctx.tournament ?? ""}${year}`
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (ctx.tournament) queries.push(`${ctx.tournament} highlights`);
  return queries;
}

// ---------------------------------------------------------------------------
// Orchestration — résolution BSD (last5) + cascade vidéo + cache 48h
// ---------------------------------------------------------------------------

type ResolveVideo = (
  playerName: string,
  context: PreviousRoundContext,
  surface: TennisSurface,
) => Promise<PreviousRoundPlayer["video"]>;

function lastFinished(matches: BSDMatch[] | undefined): BSDMatch | null {
  if (!matches || matches.length === 0) return null;
  return (
    matches
      .filter((m) => m.status === "finished")
      .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""))[0] ?? null
  );
}

function scoreOf(m: BSDMatch): string {
  if (m.sets_detail?.length) {
    return m.sets_detail.map((s) => `${s.p1}-${s.p2}`).join(", ");
  }
  return `${m.player1_sets}-${m.player2_sets}`;
}

function playerWon(m: BSDMatch, playerId: string): boolean {
  const isP1 = m.player1.id.toString() === playerId;
  return isP1
    ? m.player1_sets > m.player2_sets
    : m.player2_sets > m.player1_sets;
}

function contextFromMatch(m: BSDMatch, playerId: string): PreviousRoundContext {
  const isP1 = m.player1.id.toString() === playerId;
  const opponent = isP1 ? m.player2.name : m.player1.name;
  return {
    round: m.round_name ?? null,
    tournament: m.tournament?.name ?? null,
    surface: m.tournament?.surface ?? null,
    opponent: opponent ?? null,
    won: playerWon(m, playerId),
    score: scoreOf(m),
  };
}

/**
 * Cascade de recherche YouTube : adversaire + surface + tournoi + année,
 * puis déclinaisons de moins en moins précises. Jamais de throw — null si
 * aucune vidéo trouvée.
 */
async function defaultResolveVideo(
  playerName: string,
  context: PreviousRoundContext,
  surface: TennisSurface,
): Promise<PreviousRoundPlayer["video"]> {
  const queries = buildHighlightQuery(
    playerName,
    { opponent: context.opponent, tournament: context.tournament, surface },
    new Date().getFullYear().toString(),
  );
  for (const q of queries) {
    const videos = await searchYouTube(q);
    const hit = pickBest(videos);
    if (hit) {
      return { videoId: hit.videoId, title: hit.title, url: hit.url };
    }
  }
  return null;
}

const g = globalThis as unknown as Record<
  string,
  { at: number; players: PreviousRoundPlayer[]; source: "bsd" | "fallback" } | undefined
>;
const TTL_MS = 48 * 60 * 60 * 1000; // 48 h
const MEMO_PREFIX = "__prev_round_highlights_";

function emptyContext(): PreviousRoundContext {
  return { round: null, tournament: null, surface: null, opponent: null, won: null, score: null };
}

export type PreviousRoundResult = {
  players: PreviousRoundPlayer[];
  source: "bsd" | "fallback";
};

/**
 * Orchestration 4 étapes — ne throw jamais. source "bsd" si la résolution
 * H2H a réussi (contexte last5 renseigné), sinon "fallback" (contexte vide,
 * requêtes génériques). Cache mémoire 48 h keyé par couple de joueurs.
 */
export async function getPreviousRoundHighlights(params: {
  matchId: string; // ex "bsd-33487"
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  currentTournamentName: string | null;
  currentSurface: TennisSurface | null;
  resolveVideo?: ResolveVideo;
}): Promise<PreviousRoundResult> {
  const {
    matchId, playerAId, playerAName, playerBId, playerBName,
    currentTournamentName, currentSurface,
  } = params;
  const resolveVideo = params.resolveVideo ?? defaultResolveVideo;

  const memoKey = `${playerAId}:${playerBId}:${matchId}`;
  const memo = g[MEMO_PREFIX + memoKey];
  if (memo && Date.now() - memo.at < TTL_MS) {
    return { players: memo.players, source: memo.source };
  }

  // 1. Résolution — jamais de throw.
  let h2h: BSDH2H | null = null;
  try {
    const numericId = parseBsdId(matchId);
    if (numericId) h2h = await fetchMatchH2H(numericId);
  } catch {
    h2h = null;
  }
  const source: "bsd" | "fallback" = h2h ? "bsd" : "fallback";

  // 2. Contexte par joueur (dernier match fini) ou contexte vide.
  const roster: Array<{ id: string; name: string }> = [
    { id: playerAId, name: playerAName },
    { id: playerBId, name: playerBName },
  ];

  const playersOut: PreviousRoundPlayer[] = [];
  for (const p of roster) {
    let ctx = emptyContext();
    let label: PreviousRoundLabel = "dernier-match";
    if (h2h) {
      const list =
        h2h.player1.id.toString() === p.id ? h2h.player1_last5 : h2h.player2_last5;
      const last = lastFinished(list);
      if (last) {
        ctx = contextFromMatch(last, p.id);
        label = labelForMatch(
          last.tournament?.name ?? null,
          currentTournamentName ?? null,
        );
      }
    }
    const video = await resolveVideo(p.name, ctx, currentSurface);
    playersOut.push({ playerId: p.id, playerName: p.name, label, context: ctx, video });
  }

  g[MEMO_PREFIX + memoKey] = { at: Date.now(), players: playersOut, source };
  return { players: playersOut, source };
}