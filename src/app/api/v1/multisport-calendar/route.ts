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

  // 2b. Routes sport dédiées (mission k044 : liste du jour par sport).
  // Adaptateur DÉFENSIF : shapes multiples (hockey homeName/leagueName,
  // tennis playerA/playerB/tournament, handball home/away) → extraction par
  // fallbacks successifs ; échec d'une route → [] sans casser la réponse.
  // ponytail: pas de dédup avec BetExplorer (son JSON est vide aujourd'hui) —
  // si le scraper calendar revient, dédupérer par home+away ici.
  const DEDICATED = ["tennis", "hockey", "handball"];
  if (!sportFilter || DEDICATED.includes(sportFilter)) {
    const str = (v: unknown): string => (typeof v === "string" ? v : "");
    const pick = (m: any, ...keys: string[]): string => {
      for (const k of keys) {
        const v = k.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as any)[part] : undefined), m);
        const s = str(v);
        if (s) return s;
      }
      return "";
    };
    const toTime = (v: unknown): string => {
      const direct = str(v);
      if (/^\d{1,2}:\d{2}/.test(direct)) return direct.slice(0, 5);
      if (direct) {
        try {
          return new Date(direct).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
        } catch { /* format inconnu */ }
      }
      return "";
    };
    const toDedicated = (sport: string, m: any): CalendarMatch => ({
      sport,
      country: pick(m, "countryName", "country"),
      league: pick(m, "leagueName", "league.name", "tournament.name", "tournament", "competition") || sport,
      time: toTime(m.time ?? m.scheduledAt ?? m.scheduled_at ?? m.match_date),
      home: pick(m, "homeName", "home.name", "playerA.name", "playerA", "homeTeam", "home"),
      away: pick(m, "awayName", "away.name", "playerB.name", "playerB", "awayTeam", "away"),
      odds: [],
      score: null,
      isLive: m.isLive === true || m.live === true,
    });

    const loads: Promise<CalendarMatch[]>[] = [];
    if (!sportFilter || sportFilter === "hockey") {
      loads.push(
        (async () => {
          const { GET } = await import("@/app/api/hockey/matches/route");
          const data = await (await GET()).json();
          return Array.isArray(data?.matches) ? data.matches.map((m: any) => toDedicated("hockey", m)) : [];
        })().catch(() => [] as CalendarMatch[])
      );
    }
    if (!sportFilter || sportFilter === "handball") {
      loads.push(
        (async () => {
          const { GET } = await import("@/app/api/handball/matches/route");
          const data = await (await GET()).json();
          return Array.isArray(data?.matches) ? data.matches.map((m: any) => toDedicated("handball", m)) : [];
        })().catch(() => [] as CalendarMatch[])
      );
    }
    if (!sportFilter || sportFilter === "tennis") {
      loads.push(
        (async () => {
          const { GET } = await import("@/app/api/tennis/bsd/matches/route");
          const today = new Date().toISOString().slice(0, 10);
          const res = await GET(
            new Request(`http://internal/api/tennis/bsd/matches?date_from=${today}&date_to=${today}&limit=200`)
          );
          const data: any = await res.json();
          const arr = Array.isArray(data?.matches) ? data.matches : Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
          return arr.map((m: any) => toDedicated("tennis", m));
        })().catch(() => [] as CalendarMatch[])
      );
    }
    const dedicated = (await Promise.all(loads)).flat();
    if (dedicated.length > 0) matches = [...matches, ...dedicated];
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
