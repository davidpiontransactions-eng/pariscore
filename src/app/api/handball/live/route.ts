import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { isFlashscoreFresh, resolveHandballDataFile } from "@/lib/handball-flashscore";
import { readFileSync, existsSync } from "fs";

const CACHE_TTL = 30_000;

type CachedPayload = { matches: unknown[] };
const cache = createTtlCache<CachedPayload>("__handballLiveCache");

type FlashscoreMatch = {
  id?: string;
  time?: string;
  home: string;
  away: string;
  score?: string | null;
  isLive?: boolean;
  isFinished?: boolean;
  league?: string;
  country?: string;
  odds?: number[];
  homeHalf?: number;
  awayHalf?: number;
  minute?: number;
};

function loadFlashscoreLive(): Array<{
  id: string;
  league: { name: string; country: string };
  home: { name: string };
  away: { name: string };
  kickoff: string;
  status: "live";
  score?: { home: number; away: number; homeHalf?: number; awayHalf?: number };
  minute?: number;
}> {
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const matches = (data.matches || []) as FlashscoreMatch[];
    return matches
      .filter((m) => m.isLive && m.home && m.away)
      .map((m) => {
        let scoreObj: { home: number; away: number; homeHalf?: number; awayHalf?: number } | undefined;
        if (m.score && m.score !== "- - -") {
          const parts = m.score.split(/\s*-\s*/);
          if (parts.length >= 2) {
            const home = parseInt(parts[0]) || 0;
            const away = parseInt(parts[1]) || 0;
            if (home > 0 || away > 0) {
              scoreObj = { home, away };
              if (m.homeHalf != null) scoreObj.homeHalf = m.homeHalf;
              if (m.awayHalf != null) scoreObj.awayHalf = m.awayHalf;
            }
          }
        }
        return {
          id: m.id || `fs-live-${m.home}-${m.away}`.replace(/\s+/g, "-").toLowerCase(),
          league: { name: m.league || "Handball", country: m.country || "" },
          home: { name: m.home },
          away: { name: m.away },
          kickoff: m.time || new Date().toISOString(),
          status: "live" as const,
          score: scoreObj,
          minute: m.minute,
        };
      });
  } catch {
    return [];
  }
}

/** scraped_at du snapshot — gate anti-zombie (fix audit C-H7). */
function loadFlashscoreScrapedAt(): string | null {
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return null;
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return typeof data.scraped_at === "string" ? data.scraped_at : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({
      matches: cached.data.matches,
      updatedAt: new Date(cached.at).toISOString(),
    });
  }

  // Fix audit C-H7 : un snapshot stale ne produit PAS de faux lives gelés —
  // on saute direct au fallback, puis on renvoie une liste live vide honnête.
  const stale = !isFlashscoreFresh(loadFlashscoreScrapedAt());
  const liveMatches = stale ? [] : loadFlashscoreLive();
  if (liveMatches.length > 0) {
    cache.set({ matches: liveMatches });
    return NextResponse.json({
      matches: liveMatches,
      updatedAt: new Date(now).toISOString(),
    });
  }

  // Fallback API-Sports
  try {
    const { fetchHandballLive } = await import("@/lib/handball-api");
    const matches = await fetchHandballLive();
    if (matches.length > 0) {
      cache.set({ matches });
      return NextResponse.json({
        matches,
        updatedAt: new Date(now).toISOString(),
      });
    }
  } catch {
    // API-Sports indisponible
  }

  return NextResponse.json({
    matches: [],
    updatedAt: new Date(now).toISOString(),
  });
}
