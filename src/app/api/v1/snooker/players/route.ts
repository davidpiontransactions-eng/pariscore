import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fetchPlayerPhoto } from "@/lib/snooker/player-photos";

export const runtime = "nodejs";

/**
 * /api/v1/snooker/players
 *
 * Sert le leaderboard joueurs snooker (stats CueTracker).
 * Fichier source : data/cuetracker_matches.json (généré par scripts/scrape_cuetracker.py)
 * Si le fichier est absent (scrape non lancé / réseau bloqué), renvoie une liste vide
 * avec un message explicite — le front affiche un état vide gracieux.
 */

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

type SnookerPlayer = {
  id: string;
  name: string;
  nationality?: string;
  ranking?: number;
  eloRating: number;
  winPct?: number;
  centuryRate?: number;
  deciderWinPct?: number;
  avgBreak?: number;
  photoUrl?: string;
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

/**
 * Elo heuristique dérivé des données CueTracker (matches/wins/losses) en l'absence
 * d'historique Elo complet : baseline 1500 + (wins - losses) * 15.
 * À remplacer par des vrais ratings dès que le moteur Elo aura un historique.
 */
function deriveElo(p: CueTrackerFile["players"][number]): number {
  const wins = p.wins ?? 0;
  const losses = p.losses ?? 0;
  return Math.max(400, Math.min(2200, 1500 + (wins - losses) * 15));
}

function transformPlayer(p: CueTrackerFile["players"][number]): SnookerPlayer {
  const wins = p.wins ?? 0;
  const played = p.matches_played ?? wins + (p.losses ?? 0);
  const losses = p.losses ?? Math.max(0, played - wins);

  const out: SnookerPlayer = {
    id: p.id,
    name: p.name,
    eloRating: deriveElo(p),
  };
  if (p.nationality) out.nationality = p.nationality;
  if (p.ranking != null) out.ranking = p.ranking;
  if (played > 0) {
    out.winPct = (wins / played) * 100;
  }
  if (p.centuries != null && played > 0) {
    out.centuryRate = (p.centuries / played) * 100;
  }
  if (p.decider_win_pct != null) {
    out.deciderWinPct = p.decider_win_pct * 100;
  }
  if (p.max_break != null) {
    out.avgBreak = p.max_break;
  }
  return out;
}

export async function GET() {
  const data = readData();

  if (!data) {
    return NextResponse.json(
      {
        players: [],
        total: 0,
        scraped_at: null,
        message:
          "Aucune donnée joueur snooker disponible. Lancez le scraper : python scripts/scrape_cuetracker.py",
      },
      { status: 200 },
    );
  }

  const players = (data.players ?? []).map(transformPlayer).slice(0, 100);

  // Photo lookup async (Wikipedia Commons) — best-effort, jamais bloquant
  const photoPromises = players.map(async (p) => {
    const photoUrl = await fetchPlayerPhoto(p.id);
    if (photoUrl) p.photoUrl = photoUrl;
    return p;
  });
  const enriched = await Promise.all(photoPromises);

  return NextResponse.json({
    players: enriched,
    total: enriched.length,
    scraped_at: data.scraped_at,
    season: data.season,
  });
}