import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 30_000;

type CachedPayload = { matches: unknown[] };
const cache = createTtlCache<CachedPayload>("__handballLiveCache");

// Charger les matchs live depuis Flashscore
function loadFlashscoreLive(): Array<{
  id: string;
  league: { name: string; country: string };
  home: { name: string };
  away: { name: string };
  kickoff: string;
  status: string;
  score?: { home: number; away: number };
  minute?: number;
}> {
  try {
    const filePath = join(process.cwd(), "..", "..", "data", "flashscore_handball.json");
    if (!existsSync(filePath)) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const matches = (data.matches || []) as Array<{
      id?: string;
      time?: string;
      home?: string;
      away?: string;
      score?: string | null;
      isLive?: boolean;
      isFinished?: boolean;
      league?: string;
      country?: string;
    }>;
    return matches
      .filter((m) => m.isLive && m.home && m.away)
      .map((m) => {
        let scoreObj: { home: number; away: number } | undefined;
        if (m.score && m.score !== "- - -") {
          const parts = m.score.split(/\s*-\s*/);
          if (parts.length >= 2) {
            const home = parseInt(parts[0]) || 0;
            const away = parseInt(parts[1]) || 0;
            if (home > 0 || away > 0) scoreObj = { home, away };
          }
        }
        let minute: number | undefined;
        if (m.time) {
          const minuteMatch = m.time.match(/(\d+)/);
          if (minuteMatch) minute = parseInt(minuteMatch[1]);
        }
        const now = new Date();
        let kickoff = now.toISOString();
        if (m.time && m.time.includes(":")) {
          const [hours, mins] = m.time.split(":").map(Number);
          if (!isNaN(hours) && !isNaN(mins)) {
            const ko = new Date(now);
            ko.setHours(hours, mins, 0, 0);
            kickoff = ko.toISOString();
          }
        }
        return {
          id: m.id || `fs-live-${m.home}-${m.away}`.replace(/\s+/g, "-").toLowerCase(),
          league: { name: m.league || "Flashscore Handball", country: m.country || "" },
          home: { name: m.home || "Dom." },
          away: { name: m.away || "Ext." },
          kickoff,
          status: "live" as const,
          score: scoreObj,
          minute,
        };
      });
  } catch {
    return [];
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

  try {
    const { fetchHandballLive } = await import("@/lib/handball-api");
    let matches = await fetchHandballLive();

    // Si API-Sports ne retourne rien, essayer Flashscore
    if (matches.length === 0) {
      const flashscoreLive = loadFlashscoreLive();
      if (flashscoreLive.length > 0) {
        matches = flashscoreLive as any[];
      }
    }

    cache.set({ matches });
    return NextResponse.json({
      matches,
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[handball-live] fetch failed:", (err as Error).message);
    // Essayer Flashscore même en cas d'erreur
    const flashscoreLive = loadFlashscoreLive();
    if (flashscoreLive.length > 0) {
      cache.set({ matches: flashscoreLive });
      return NextResponse.json({
        matches: flashscoreLive,
        updatedAt: new Date(now).toISOString(),
      });
    }
    // Retourner structure valide au lieu de 503
    return NextResponse.json({
      matches: [],
      updatedAt: new Date(now).toISOString(),
    });
  }
}
