import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

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

// ─── Photos libres de droit (Unsplash) par joueur connu ─────────────────
const PLAYER_PHOTOS: Record<string, string> = {
  "ronnie-osullivan": "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=200&q=80",
  "judd-trump": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=200&q=80",
  "mark-selby": "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=200&q=80",
  "neil-robertson": "https://images.unsplash.com/photo-1508344929928-f9133fee5109?auto=format&fit=crop&w=200&q=80",
  "john-higgins": "https://images.unsplash.com/photo-1431324155629-1a6deb1a0753?auto=format&fit=crop&w=200&q=80",
  "mark-williams": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=200&q=80",
  "shaun-murphy": "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=200&q=80",
  "kyren-wilson": "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=200&q=80",
  "ding-junhui": "https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=200&q=80",
  "mark-allen": "https://images.unsplash.com/photo-1511888613836-5277520f5902?auto=format&fit=crop&w=200&q=80",
  "jack-lisowski": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=200&q=80",
  "barry-hawkins": "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?auto=format&fit=crop&w=200&q=80",
  "ali-carter": "https://images.unsplash.com/photo-1529768167801-9173d94c2a42?auto=format&fit=crop&w=200&q=80",
  "stuart-bingham": "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=80",
  "stephen-maguire": "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=200&q=80",
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
    photoUrl: PLAYER_PHOTOS[p.id] ?? undefined,
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

  return NextResponse.json({
    players,
    total: players.length,
    scraped_at: data.scraped_at,
    season: data.season,
  });
}