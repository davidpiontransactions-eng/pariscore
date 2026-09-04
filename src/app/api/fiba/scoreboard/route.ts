import { NextRequest, NextResponse } from "next/server";
import { cache, fibaCache } from "@/lib/cache/memory-cache";
import { rateLimits } from "@/lib/api/rate-limit";
import { validateSearchParams, scoreboardParamsSchema } from "@/lib/api/validation";

const ESPN_FIBA_SCOREBOARD = "https://site.web.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard";

type ESPNCompetitor = {
  id: string;
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    color: string;
    alternateColor: string;
    logo: string;
  };
  score: string;
  homeAway: "home" | "away";
  winner: boolean;
  records: Array<{ name: string; summary: string }>;
  linescores: Array<{ value: number; displayValue: string; period: number }>;
};

type ESPNStatus = {
  clock: number;
  displayClock: string;
  period: number;
  type: {
    id: string;
    name: string;
    state: "pre" | "in" | "post";
    completed: boolean;
    description: string;
    shortDetail: string;
  };
};

type ESPNEvent = {
  id: string;
  date: string;
  name: string;
  shortName: string;
  competitions: Array<{
    id: string;
    competitors: ESPNCompetitor[];
    status: ESPNStatus;
    venue: { fullName: string; address: { city: string; country: string } };
    notes: Array<{ headline: string }>;
    broadcasts: Array<{ names: string[] }>;
  }>;
  status: ESPNStatus;
};

/** Match FIBA normalisé pour l'UI. */
export type FibaMatch = {
  id: string;
  date: string;
  shortName: string;
  group: string;
  status: "pre" | "in" | "post";
  statusDetail: string;
  clock: string;
  period: number;
  venue: string;
  city: string;
  broadcast: string;
  home: {
    id: string;
    name: string;
    abbr: string;
    color: string;
    logo: string;
    score: number | null;
    record: string | null;
    linescores: number[];
  };
  away: {
    id: string;
    name: string;
    abbr: string;
    color: string;
    logo: string;
    score: number | null;
    record: string | null;
    linescores: number[];
  };
};

function normalizeEvent(event: ESPNEvent): FibaMatch {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find((c) => c.homeAway === "home");
  const away = comp?.competitors?.find((c) => c.homeAway === "away");
  const note = comp?.notes?.[0]?.headline ?? "";
  const groupMatch = note.match(/Group ([A-D])/i);
  const broadcast = comp?.broadcasts?.[0]?.names?.join(", ") ?? "";

  return {
    id: event.id,
    date: event.date,
    shortName: event.shortName,
    group: groupMatch ? groupMatch[1] : "",
    status: event.status.type.state,
    statusDetail: event.status.type.shortDetail,
    clock: event.status.displayClock,
    period: event.status.period,
    venue: comp?.venue?.fullName ?? "",
    city: comp?.venue?.address?.city ?? "",
    broadcast,
    home: {
      id: home?.team?.id ?? "",
      name: home?.team?.displayName ?? "",
      abbr: home?.team?.abbreviation ?? "",
      color: home?.team?.color ?? "",
      logo: home?.team?.logo ?? "",
      score: home?.score ? parseInt(home.score, 10) : null,
      record: home?.records?.[0]?.summary ?? null,
      linescores: home?.linescores?.map((l) => l.value) ?? [],
    },
    away: {
      id: away?.team?.id ?? "",
      name: away?.team?.displayName ?? "",
      abbr: away?.team?.abbreviation ?? "",
      color: away?.team?.color ?? "",
      logo: away?.team?.logo ?? "",
      score: away?.score ? parseInt(away.score, 10) : null,
      record: away?.records?.[0]?.summary ?? null,
      linescores: away?.linescores?.map((l) => l.value) ?? [],
    },
  };
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimitResult = rateLimits.scoreboard(`scoreboard:${ip}`);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetAt.toString(),
        },
      },
    );
  }

  // Validation
  const searchParams = request.nextUrl.searchParams;
  const validation = validateSearchParams(searchParams, scoreboardParamsSchema);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: validation.error },
      { status: 400 },
    );
  }

  const dates = validation.data.dates ?? "";

  const cacheConfig = fibaCache.scoreboard(dates);
  const cached = cache.get(cacheConfig.key);
  
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      },
    });
  }

  try {
    const url = dates
      ? `${ESPN_FIBA_SCOREBOARD}?dates=${encodeURIComponent(dates)}`
      : ESPN_FIBA_SCOREBOARD;

    const res = await fetch(url, {
      headers: { "User-Agent": "PariScore/1.0" },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "ESPN FIBA scoreboard unavailable", status: res.status },
        { status: 503 },
      );
    }

    const json = await res.json();
    const events: ESPNEvent[] = json?.events ?? [];
    const matches = events.map(normalizeEvent);

    const data = {
      matches,
      season: json?.leagues?.[0]?.season?.year ?? 2026,
      calendar: json?.leagues?.[0]?.calendar ?? [],
      source: "espn-fiba",
    };

    cache.set(cacheConfig.key, data, cacheConfig.ttl);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch FIBA scoreboard", details: (err as Error).message },
      { status: 500 },
    );
  }
}
