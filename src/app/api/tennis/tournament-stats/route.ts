// GET /api/tennis/tournament-stats?matchId={BSD_ID}
//
// Statistiques moyennes PAR TOURNOI pour les deux joueuses d'un match de
// l'édition en cours (ex. WTA Toronto — National Bank Open) :
//   - 1) Tous les matchs TERMINÉS du tournoi sont agrégés par joueuse
//     (aces, doubles fautes, % 1er service, % 1er/2d service gagné, % break
//     pts sauvés — moyennes par match, `Math.round` sur les %, 1 décimale
//     sur les moyennes).
//   - 2) Fallback : une joueuse sans match dans l'édition (1er tour) reçoit
//     sa moyenne de la SAISON sur surface dure (source: "season-hard") —
//     l'UI affiche alors le badge « Moyenne Surface Dur {year} ».
//
// Réponse: TournamentStatsResult (players[2] ordonnés player1/player2 BSD).
// Défensive : ne lève JAMAIS de 500 — erreur réseau/absence de données →
// 200 avec `players: []` et l'UI affiche « Stats non disponibles ».

import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchMatch, fetchMatches } from "@/lib/bsd-tennis-service";
import type { BSDMatch } from "@/lib/bsd-tennis-service";
import {
  aggregatePlayerStats,
  hasUsableSample,
  pickTournamentStats,
} from "@/lib/tournament-stats-engine";
import type { TournamentStatsResult } from "@/lib/tournament-stats-engine";

const CACHE_TTL_MS = 5 * 60_000; // 5 min — assez frais pour un tournoi en cours
const cache = createTtlCache<TournamentStatsResult>("__tennisTournamentStatsCache");

const PAGE_SIZE = 100;
const MAX_PAGES = 3;

/** Récupère toutes les rencontres terminées d'un tournoi (pagination). */
async function fetchFinishedTournamentMatches(
  tournamentFilter: string,
): Promise<BSDMatch[]> {
  const out: BSDMatch[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchMatches({
      tournament: tournamentFilter,
      status: "finished",
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    out.push(...res.results);
    if (!res.next || res.results.length < PAGE_SIZE) break;
  }
  return out;
}

/** Matchs terminés d'un joueur sur une saison donnée (fallback surface dure). */
async function fetchFinishedPlayerMatches(
  playerName: string,
  season: number,
): Promise<BSDMatch[]> {
  const res = await fetchMatches({
    player: playerName,
    status: "finished",
    date_from: `${season}-01-01`,
    date_to: `${season}-12-31`,
    limit: 100,
  });
  return res.results;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");
    if (!matchId) return NextResponse.json({ error: "Missing 'matchId' param" }, { status: 400 });

    const numId = Number(matchId);
    if (!Number.isFinite(numId)) {
      return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
    }

    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && cached.data.tournamentId === numId) {
      return NextResponse.json(cached.data);
    }

    const match = await fetchMatch(numId);

    // Identification du tournoi (id BSD si fourni, sinon nom exact).
    const tournamentFilter = match.tournament?.id
      ? String(match.tournament.id)
      : (match.tournament?.name ?? "");
    const tournamentName = match.tournament?.name ?? "Tournoi";

    // Saison (année du match, fallback année courante).
    const season = match.match_date
      ? new Date(match.match_date).getUTCFullYear()
      : new Date().getUTCFullYear();

    const p1Id = match.player1?.id ?? 0;
    const p2Id = match.player2?.id ?? 0;
    const p1Name = match.player1?.name ?? "";
    const p2Name = match.player2?.name ?? "";

    const tournamentMatches = tournamentFilter
      ? await fetchFinishedTournamentMatches(tournamentFilter)
      : [];

    let seasonHardP1: Awaited<ReturnType<typeof fetchFinishedPlayerMatches>> | null = null;
    let seasonHardP2: Awaited<ReturnType<typeof fetchFinishedPlayerMatches>> | null = null;

    const buildAgg = (matches: BSDMatch[]) =>
      matches.filter((m) => {
        const s = m.tournament?.surface ?? "";
        return s.toLowerCase() === "hard";
      });

    const p1Tournament = aggregatePlayerStats(tournamentMatches, p1Id, p1Name, "tournament");
    const p2Tournament = aggregatePlayerStats(tournamentMatches, p2Id, p2Name, "tournament");

    // Fallback saison sur dur — uniquement si l'édition en cours est vide.
    const p1NeedsFallback = !hasUsableSample(p1Tournament);
    const p2NeedsFallback = !hasUsableSample(p2Tournament);
    if (p1NeedsFallback || p2NeedsFallback) {
      seasonHardP1 = p1NeedsFallback && p1Name
        ? await fetchFinishedPlayerMatches(p1Name, season)
        : [];
      seasonHardP2 = p2NeedsFallback && p2Name
        ? await fetchFinishedPlayerMatches(p2Name, season)
        : [];
    }

    const p1Season = seasonHardP1 ? aggregatePlayerStats(buildAgg(seasonHardP1), p1Id, p1Name, "season-hard") : p1Tournament;
    const p2Season = seasonHardP2 ? aggregatePlayerStats(buildAgg(seasonHardP2), p2Id, p2Name, "season-hard") : p2Tournament;

    const data: TournamentStatsResult = {
      tournamentId: match.tournament?.id ?? numId,
      tournamentName,
      season,
      players: [
        pickTournamentStats(p1Tournament, p1Season),
        pickTournamentStats(p2Tournament, p2Season),
      ],
    };

    cache.set(data);
    return NextResponse.json(data);
  } catch (err) {
    // Dégradation gracieuse — on ne casse jamais l'onglet Stats.
    return apiErrorHandler(err, "tennis/tournament-stats", () =>
      NextResponse.json(
        { tournamentId: 0, tournamentName: "", season: 0, players: [] },
        { status: 200 },
      )
    );
  }
}