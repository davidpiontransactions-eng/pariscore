import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { fetchPlayerPhoto } from "@/lib/snooker/player-photos";
import { quickElo } from "@/lib/snooker/elo-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CueTrackerFile = {
  scraped_at?: string;
  source?: string;
  season?: number;
  total_players?: number;
  players: Array<{
    id: string;
    name: string;
    nationality?: string;
    ranking?: number | null;
    matches_played?: number;
    wins?: number;
    losses?: number;
    centuries?: number;
    max_break?: number | null;
    decider_win_pct?: number | null;
  }>;
};

type PlayerDetail = {
  id: string;
  name: string;
  nationality?: string;
  ranking?: number;
  eloRating: number;
  winPct: number;
  centuryRate: number;
  deciderWinPct: number;
  avgBreak: number;
  photoUrl?: string;
  cuetrackerUrl: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  centuries: number;
  maxBreak: number | null;
  winStreak: number;
  lossStreak: number;
  formLast10: string;
};

const DATA_FILE = join(process.cwd(), "data", "cuetracker_matches.json");

function readData(): CueTrackerFile | null {
  try {
    if (!existsSync(DATA_FILE)) return null;
    const raw = readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as CueTrackerFile;
  } catch {
    return null;
  }
}

function deriveElo(p: CueTrackerFile["players"][number]): number {
  return quickElo(p.wins ?? 0, p.losses ?? 0, p.centuries ?? 0);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = readData();

  if (!data) {
    return NextResponse.json(
      { error: "Données non disponibles" },
      { status: 404 },
    );
  }

  const player = (data.players ?? []).find((p) => p.id === id);
  if (!player) {
    return NextResponse.json(
      { error: `Joueur "${id}" introuvable` },
      { status: 404 },
    );
  }

  const wins = player.wins ?? 0;
  const played = player.matches_played ?? wins + (player.losses ?? 0);
  const losses = player.losses ?? Math.max(0, played - wins);
  const elo = deriveElo(player);
  const winPct = played > 0 ? (wins / played) * 100 : 50;
  const centuryRate = played > 0 ? ((player.centuries ?? 0) / played) * 100 : 0;
  const deciderWinPct = (player.decider_win_pct ?? 0.5) * 100;

  // Forme basée sur le win% (déterministe)
  const formWinPct = Math.round(winPct / 10);
  const formLast10 = "W".repeat(formWinPct) + "L".repeat(10 - formWinPct);

  // Fetch photo from Wikipedia
  let photoUrl: string | undefined;
  try {
    const fetched = await fetchPlayerPhoto(id);
    if (fetched) photoUrl = fetched;
  } catch {
    // best-effort
  }

  const detail: PlayerDetail = {
    id: player.id,
    name: player.name,
    eloRating: elo,
    winPct,
    centuryRate,
    deciderWinPct,
    avgBreak: player.max_break ?? 30,
    cuetrackerUrl: `https://cuetracker.net/players/${id}`,
    matchesPlayed: played,
    wins,
    losses,
    centuries: player.centuries ?? 0,
    maxBreak: player.max_break ?? null,
    winStreak: 0,
    lossStreak: 0,
    formLast10,
  };

  if (player.nationality) detail.nationality = player.nationality;
  if (player.ranking != null) detail.ranking = player.ranking;
  if (photoUrl) detail.photoUrl = photoUrl;

  return NextResponse.json(detail);
}
