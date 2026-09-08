import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

/**
 * /api/v1/snooker/matches
 *
 * Sert les matchs snooker scrapés depuis FlashScore.
 * Fichier source : data/odds_flashscore_snooker.json (généré par scripts/scrape_flashscore_snooker.mjs)
 *
 * Query params:
 *   ?live=1        — filtre uniquement les matchs live/en cours
 *   ?tournament=X  — filtre par nom de tournoi
 *   ?limit=N       — limite le nombre de résultats
 */

type FlashScoreMatch = {
  id: string;
  tournament: string;
  home: string;
  away: string;
  scoreHome: string;
  scoreAway: string;
  time: string;
  stage: string;
  isLive: boolean;
  odds?: { home: number; draw?: number | null; away: number; bookmaker?: string };
  detailedOdds?: Array<{ bookmaker: string; home: number; draw?: number | null; away: number }>;
};

type FlashScoreFile = {
  scraped_at: string;
  sport: string;
  source: string;
  matches_count: number;
  with_odds: number;
  live_count: number;
  tournaments: string[];
  matches: FlashScoreMatch[];
};

type SnookerMatch = {
  id: string;
  source: string;
  tournament: string;
  league_id: string;
  player1: string;
  player2: string;
  player1PhotoUrl?: string;
  player2PhotoUrl?: string;
  scheduled_at: string | null;
  /** Normalisé : "scheduled" | "live" | "finished" (consommé par les composants UI). */
  status: "scheduled" | "live" | "finished";
  /** Frames remportées par chaque joueur (source FlashScore). */
  scoreA: number;
  scoreB: number;
  /** Best-of de la série (défaut snooker = 9). */
  bestOf: number;
  odds?: { player1: number; player2: number };
  handicap?: { line: unknown; odds_p1: unknown; odds_p2: unknown };
  total?: { line: unknown; over_odds: unknown; under_odds: unknown };
};

/** Parse un score frames "6-2" en entier, ou 0 si absent/invalide. */
function parseFrames(raw: string | undefined): number {
  if (!raw || raw === "-" || raw === "") return 0;
  const n = parseInt(raw.split("-")[0] ?? "", 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

const DATA_FILE = join(process.cwd(), "data", "odds_flashscore_snooker.json");
const PLAYERS_FILE = join(process.cwd(), "data", "cuetracker_matches.json");

// ─── Photos libres de droit (Unsplash) par nom connu ──────────────────────
const PLAYER_PHOTOS: Record<string, string> = {
  "ronnie osullivan": "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=200&q=80",
  "ronnie o'sullivan": "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=200&q=80",
  "judd trump": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=200&q=80",
  "mark selby": "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=200&q=80",
  "neil robertson": "https://images.unsplash.com/photo-1508344929928-f9133fee5109?auto=format&fit=crop&w=200&q=80",
  "john higgins": "https://images.unsplash.com/photo-1431324155629-1a6deb1a0753?auto=format&fit=crop&w=200&q=80",
  "mark williams": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=200&q=80",
  "shaun murphy": "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=200&q=80",
  "kyren wilson": "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=200&q=80",
  "ding junhui": "https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=200&q=80",
  "mark allen": "https://images.unsplash.com/photo-1511888613836-5277520f5902?auto=format&fit=crop&w=200&q=80",
  "jack lisowski": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=200&q=80",
  "barry hawkins": "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?auto=format&fit=crop&w=200&q=80",
  "ali carter": "https://images.unsplash.com/photo-1529768167801-9173d94c2a42?auto=format&fit=crop&w=200&q=80",
  "stuart bingham": "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=80",
  "stephen maguire": "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=200&q=80",
};

// ─── Cross-référence joueurs CueTracker pour photoUrl ─────────────────────
type CuePlayer = { id: string; name: string; };
type CueFile = { players: CuePlayer[] };
let photoIndex: Record<string, string> | null = null;

function buildPhotoIndex(): Record<string, string> {
  if (photoIndex) return photoIndex;
  photoIndex = {};
  // 1) Depuis les noms connus
  for (const [name, url] of Object.entries(PLAYER_PHOTOS)) {
    photoIndex[name] = url;
  }
  // 2) Cross-référence fichiers CueTracker si dispo
  try {
    if (existsSync(PLAYERS_FILE)) {
      const raw = readFileSync(PLAYERS_FILE, "utf-8");
      const data = JSON.parse(raw) as CueFile;
      for (const p of data.players ?? []) {
        const key = p.name.toLowerCase().trim();
        if (!photoIndex[key]) {
          // Essayer une photo générique depuis l'id
        }
      }
    }
  } catch { /* ignore */ }
  return photoIndex;
}

function getPhotoUrl(name: string): string | undefined {
  const idx = buildPhotoIndex();
  const key = name.toLowerCase().trim();
  // Exact match
  if (idx[key]) return idx[key];
  // Partial match (ex: "Ronnie O'Sullivan" → "ronnie o'sullivan")
  const partial = Object.keys(idx).find(k => key.includes(k) || k.includes(key));
  return partial ? idx[partial] : undefined;
}

function readData(): FlashScoreFile | null {
  try {
    if (!existsSync(DATA_FILE)) return null;
    const raw = readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as FlashScoreFile;
  } catch {
    return null;
  }
}

function transformMatch(m: FlashScoreMatch, scrapedAt: string): SnookerMatch {
  let scheduledAt: string | null = null;
  if (m.time && m.time !== "-" && m.time !== "") {
    const today = new Date(scrapedAt);
    const [hours, minutes] = m.time.split(":").map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      scheduledAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes).toISOString();
    }
  }

  let status: "scheduled" | "live" | "finished";
  if (m.isLive) {
    status = "live";
  } else if (m.scoreHome !== "-" && m.scoreAway !== "-" && m.scoreHome && m.scoreAway) {
    status = "finished";
  } else {
    status = "scheduled";
  }

  let odds: { player1: number; player2: number } | undefined;
  if (m.odds && m.odds.home && m.odds.away) {
    odds = { player1: m.odds.home, player2: m.odds.away };
  }

  return {
    id: m.id,
    source: "flashscore",
    tournament: m.tournament || "",
    league_id: "snooker",
    player1: m.home,
    player2: m.away,
    player1PhotoUrl: getPhotoUrl(m.home),
    player2PhotoUrl: getPhotoUrl(m.away),
    scheduled_at: scheduledAt,
    status,
    scoreA: parseFrames(m.scoreHome),
    scoreB: parseFrames(m.scoreAway),
    bestOf: 9,
    odds,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const liveOnly = searchParams.get("live") === "1";
  const tournament = searchParams.get("tournament");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

  const data = readData();

  if (!data) {
    return NextResponse.json(
      {
        matches: [],
        total: 0,
        scraped_at: null,
        tournaments: [],
        message:
          "Aucune donnée snooker disponible. Lancez le scraper : node scripts/scrape_flashscore_snooker.mjs",
      },
      { status: 200 },
    );
  }

  let matches = data.matches.map((m) => transformMatch(m, data.scraped_at));

  if (liveOnly) {
    matches = matches.filter((m) => m.status === "live");
  }

  if (tournament) {
    const q = tournament.toLowerCase();
    matches = matches.filter((m) => m.tournament.toLowerCase().includes(q));
  }

  matches = matches.slice(0, limit);

  return NextResponse.json({
    matches,
    total: matches.length,
    scraped_at: data.scraped_at,
    source: data.source,
    tournaments: data.tournaments,
    with_odds: data.with_odds,
  });
}