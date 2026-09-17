import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 5 * 60_000;

type CachedPayload = { matches: unknown[]; degraded: boolean; source: string };
const cache = createTtlCache<CachedPayload>("__handballMatchesCache");

// Lire les données Flashscore depuis le fichier JSON
function loadFlashscoreHandball(): Array<{
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
      odds?: number[];
    }>;
    // Convertir au format HandballMatch
    return matches
      .filter((m) => m.home && m.away)
      .map((m) => {
        // Parser le score "14 - 16" → { home: 14, away: 16 }
        let scoreObj: { home: number; away: number } | undefined;
        if (m.score && m.score !== "- - -") {
          const parts = m.score.split(/\s*-\s*/);
          if (parts.length >= 2) {
            const home = parseInt(parts[0]) || 0;
            const away = parseInt(parts[1]) || 0;
            if (home > 0 || away > 0) scoreObj = { home, away };
          }
        }

        // Parser le temps "1st Half 26" → minute: 26
        let minute: number | undefined;
        if (m.time) {
          const minuteMatch = m.time.match(/(\d+)/);
          if (minuteMatch) minute = parseInt(minuteMatch[1]);
        }

        // Déterminer le statut
        let status: "live" | "finished" | "scheduled" = "scheduled";
        if (m.isLive) status = "live";
        else if (m.isFinished) status = "finished";

        // Générer un kickoff ISO à partir de l'heure "20:45"
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
          id: m.id || `fs-${m.home}-${m.away}`.replace(/\s+/g, "-").toLowerCase(),
          league: { name: m.league || "Flashscore Handball", country: m.country || "" },
          home: { name: m.home || "Dom." },
          away: { name: m.away || "Ext." },
          kickoff,
          status,
          score: scoreObj,
          minute,
        };
      });
  } catch {
    return [];
  }
}

// Lire les données BetExplorer depuis le fichier JSON (fallback)
function loadBetexplorerHandball(): Array<{
  id: string;
  league: { name: string; country: string };
  home: { name: string };
  away: { name: string };
  kickoff: string;
  status: string;
  score?: { home: number; away: number };
  odds?: { home: number; draw: number; away: number };
}> {
  try {
    const filePath = join(process.cwd(), "..", "..", "data", "betexplorer_calendar.json");
    if (!existsSync(filePath)) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const matches = (data.matches || []) as Array<{
      sport?: string;
      country?: string;
      league?: string;
      time?: string;
      home?: string;
      away?: string;
      odds?: number[];
      score?: string | null;
      isLive?: boolean;
    }>;
    // Filtrer uniquement les matchs handball
    return matches
      .filter((m) => m.sport === "handball" && m.home && m.away)
      .map((m) => ({
        id: `be-${m.home}-${m.away}-${m.time}`.replace(/\s+/g, "-").toLowerCase(),
        league: { name: m.league || "BetExplorer Handball", country: m.country || "" },
        home: { name: m.home || "Dom." },
        away: { name: m.away || "Ext." },
        kickoff: new Date().toISOString().slice(0, 10) + "T" + (m.time || "00:00") + ":00Z",
        status: m.isLive ? "live" : "scheduled",
        score: m.score ? parseScore(m.score) : undefined,
        odds: m.odds && m.odds.length >= 3 ? { home: m.odds[0], draw: m.odds[1], away: m.odds[2] } : undefined,
      }));
  } catch {
    return [];
  }
}

function parseScore(score: string): { home: number; away: number } | undefined {
  const parts = score.split(/[:\-]/);
  if (parts.length >= 2) {
    const home = parseInt(parts[0]) || 0;
    const away = parseInt(parts[1]) || 0;
    return { home, away };
  }
  return undefined;
}

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: cached.data.source,
      degraded: cached.data.degraded,
      updatedAt: new Date(cached.at).toISOString(),
    });
  }

  try {
    const { fetchHandballFixtures, fetchHandballLive } = await import("@/lib/handball-api");
    const [fixtures, live] = await Promise.all([
      fetchHandballFixtures().catch(() => [] as never[]),
      fetchHandballLive().catch(() => [] as never[]),
    ]);

    const liveIds = new Set(live.map((m) => m.id));
    let merged = [...live, ...fixtures.filter((m) => !liveIds.has(m.id))];
    let degraded = fixtures.length === 0 && live.length === 0;
    let source = live.length > 0 ? "api-sports+live" : "api-sports";

    // Si API-Sports ne retourne rien, essayer Flashscore
    if (degraded) {
      const flashscoreMatches = loadFlashscoreHandball() as any[];
      if (flashscoreMatches.length > 0) {
        merged = flashscoreMatches;
        degraded = false;
        source = "flashscore";
      }
    }

    // Si Flashscore ne retourne rien, essayer BetExplorer
    if (degraded) {
      const betexplorerMatches = loadBetexplorerHandball() as any[];
      if (betexplorerMatches.length > 0) {
        merged = betexplorerMatches;
        degraded = false;
        source = "betexplorer";
      }
    }

    if (!degraded) cache.set({ matches: merged, degraded, source });
    return NextResponse.json({
      matches: merged,
      source,
      degraded,
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[handball] fetch failed:", (err as Error).message);
    // Essayer Flashscore même en cas d'erreur
    const flashscoreMatches = loadFlashscoreHandball() as any[];
    if (flashscoreMatches.length > 0) {
      return NextResponse.json({
        matches: flashscoreMatches,
        source: "flashscore",
        degraded: false,
        updatedAt: new Date(now).toISOString(),
      });
    }
    // Essayer BetExplorer même en cas d'erreur
    const betexplorerMatches = loadBetexplorerHandball() as any[];
    if (betexplorerMatches.length > 0) {
      return NextResponse.json({
        matches: betexplorerMatches,
        source: "betexplorer",
        degraded: false,
        updatedAt: new Date(now).toISOString(),
      });
    }
    // Retourner structure valide même en cas d'erreur (pas 503)
    return NextResponse.json({
      matches: [],
      source: "error",
      degraded: true,
      updatedAt: new Date(now).toISOString(),
    });
  }
}
