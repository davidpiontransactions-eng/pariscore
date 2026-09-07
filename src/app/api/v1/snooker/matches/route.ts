import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * /api/v1/snooker/matches
 *
 * Sert les matchs snooker scrapés depuis 1xbet/1xwin.
 * Fichier source : data/odds_1xbet_snooker.json (généré par scripts/scrape_1xbet_snooker.py)
 *
 * Query params:
 *   ?live=1        — filtre uniquement les matchs live/en cours
 *   ?tournament=X  — filtre par nom de tournoi
 *   ?limit=N       — limite le nombre de résultats
 */

type SnookerMatch = {
  id: string;
  source: string;
  tournament: string;
  league_id: string;
  player1: string;
  player2: string;
  scheduled_at: string | null;
  status: string | null;
  odds?: { player1: number; player2: number };
  handicap?: { line: unknown; odds_p1: unknown; odds_p2: unknown };
  total?: { line: unknown; over_odds: unknown; under_odds: unknown };
};

type SnookerFile = {
  scraped_at: string;
  sport: string;
  source: string;
  matches_count: number;
  with_odds: number;
  tournaments: string[];
  matches: SnookerMatch[];
};

const DATA_FILE = join(process.cwd(), "data", "odds_1xbet_snooker.json");

function readData(): SnookerFile | null {
  try {
    if (!existsSync(DATA_FILE)) return null;
    const raw = readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as SnookerFile;
  } catch {
    return null;
  }
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
        message: "Aucune donnée snooker disponible. Lancez le scraper : python scripts/scrape_1xbet_snooker.py",
      },
      { status: 200 },
    );
  }

  let matches = data.matches;

  // Filtre live
  if (liveOnly) {
    matches = matches.filter(
      (m) =>
        m.status?.toLowerCase().includes("live") ||
        m.status?.toLowerCase().includes("in_play") ||
        m.status?.toLowerCase().includes("1st") ||
        m.status?.toLowerCase().includes("2nd"),
    );
  }

  // Filtre tournoi
  if (tournament) {
    const q = tournament.toLowerCase();
    matches = matches.filter((m) => m.tournament.toLowerCase().includes(q));
  }

  // Limite
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
