import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface CalendarMatch {
  sport: string;
  country: string;
  league: string;
  time: string;
  home: string;
  away: string;
  odds: number[];
  score: string | null;
  isLive: boolean;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport");
  const live = searchParams.get("live") === "true";

  const dataPath = join(process.cwd(), "data", "betexplorer_calendar.json");

  if (!existsSync(dataPath)) {
    return NextResponse.json(
      { error: "Calendar data not available yet. Run scraper first." },
      { status: 404 }
    );
  }

  try {
    const raw = JSON.parse(readFileSync(dataPath, "utf-8"));
    let matches: CalendarMatch[] = raw.matches || [];

    // Filter by sport
    if (sport) {
      matches = matches.filter((m) => m.sport === sport);
    }

    // Filter live only
    if (live) {
      matches = matches.filter((m) => m.isLive);
    }

    return NextResponse.json({
      scraped_at: raw.scraped_at,
      source: raw.source,
      total: matches.length,
      matches,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load calendar data" },
      { status: 500 }
    );
  }
}
