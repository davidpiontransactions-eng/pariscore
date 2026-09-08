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
  /** BSD league id for football */
  leagueId?: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sportFilter = searchParams.get("sport");
  const liveOnly = searchParams.get("live") === "true";

  let matches: CalendarMatch[] = [];

  // 1. Load BetExplorer scraped data (all sports)
  const dataPath = join(process.cwd(), "data", "betexplorer_calendar.json");
  if (existsSync(dataPath)) {
    try {
      const raw = JSON.parse(readFileSync(dataPath, "utf-8"));
      matches = raw.matches || [];
    } catch {}
  }

  // 2. Fetch BSD football live + prematch (fresh, real-time)
  if (!sportFilter || sportFilter === "football") {
    try {
      const { fetchBSDFootballPrematch, fetchBSDFootballLive } = await import(
        "@/lib/bsd-football-fetcher"
      );
      const [bsdPrematch, bsdLive] = await Promise.all([
        fetchBSDFootballPrematch().catch(() => [] as any[]),
        fetchBSDFootballLive().catch(() => [] as any[]),
      ]);
      const bsdAll = [...bsdLive, ...bsdPrematch];
      if (bsdAll.length > 0) {
        const bsdMatches: CalendarMatch[] = bsdAll.map((m) => {
          const isLive = m.status === "live" || m.liveState?.status === "LIVE" || m.liveState?.status === "HT";
          const hasScore = m.liveState?.homeScore != null && m.liveState?.awayScore != null;
          const score = hasScore ? `${m.liveState.homeScore}:${m.liveState.awayScore}` : null;
          const odds = m.odds ? [m.odds.home, m.odds.draw, m.odds.away].filter((o: any) => o != null) : [];
          return {
            sport: "football",
            country: m.league?.country || m.home?.country || "",
            league: m.league?.name || m.competition || "",
            time: m.scheduledAt ? (() => {
              try { return new Date(m.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }); } catch { return ""; }
            })() : "",
            home: m.home?.name || m.homeTeam || "",
            away: m.away?.name || m.awayTeam || "",
            odds,
            score,
            isLive,
            leagueId: m.league?.id || undefined,
          };
        });
        // Merge: replace betexplorer football matches with BSD data
        matches = [...matches.filter((m) => m.sport !== "football"), ...bsdMatches];
      }
    } catch {}
  }

  // Filter by sport
  if (sportFilter) {
    matches = matches.filter((m) => m.sport === sportFilter);
  }

  // Filter live only
  if (liveOnly) {
    matches = matches.filter((m) => m.isLive);
  }

  return NextResponse.json({
    scraped_at: new Date().toISOString(),
    source: "betexplorer+bsd",
    total: matches.length,
    matches,
  });
}
