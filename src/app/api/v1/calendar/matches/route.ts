import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { football, tennis } from "@/lib/api/bzzoiro-client";
import { flashscoreService } from "@/lib/services/flashscore-service";

// ─── Type de réponse unifiée ────────────────────────────────────────────────

export type CalendarMatchResponse = {
  id: string;
  sport: string;
  league: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  scheduledAt: string;
  status: "scheduled" | "live" | "finished";
  minute?: number;
  score?: { home: number; away: number };
  odds?: { home: number; draw?: number; away: number };
  source: "bsd" | "flashscore" | "betexplorer" | "merged";
  bzzoiroId?: number;
  flashscoreId?: string;
  edge?: number;
};

// ─── Headers cache CDN ──────────────────────────────────────────────────────

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Génère une clé de déduplication basée sur noms + heure */
function deduplicationKey(m: CalendarMatchResponse): string {
  const norm = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const time = m.scheduledAt
    ? new Date(m.scheduledAt).toISOString().slice(0, 13) // heure au bon format
    : "";
  return `${norm(m.homeTeam)}-${norm(m.awayTeam)}-${time}`;
}

/** Nettoie les doublons en conservant la source la plus détaillée */
function deduplicate(matches: CalendarMatchResponse[]): CalendarMatchResponse[] {
  const map = new Map<string, CalendarMatchResponse>();

  for (const m of matches) {
    const key = deduplicationKey(m);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...m, source: "merged" });
      continue;
    }

    // Priorité : BSD > Flashscore > BetExplorer pour les détails
    const priority: Record<string, number> = {
      bsd: 3,
      flashscore: 2,
      betexplorer: 1,
      merged: 0,
    };
    const currentPriority = priority[m.source] ?? 0;
    const existingPriority = priority[existing.source] ?? 0;

    if (currentPriority > existingPriority) {
      // Remplacer mais garder les infos de l'ancien si manquantes
      map.set(key, {
        ...m,
        source: "merged",
        flashscoreId: m.flashscoreId ?? existing.flashscoreId,
        bzzoiroId: m.bzzoiroId ?? existing.bzzoiroId,
        odds: m.odds ?? existing.odds,
        score: m.score ?? existing.score,
        minute: m.minute ?? existing.minute,
      });
    } else {
      // Enrichir l'existant avec les données manquantes
      const merged = map.get(key)!;
      merged.odds = merged.odds ?? m.odds;
      merged.score = merged.score ?? m.score;
      merged.minute = merged.minute ?? m.minute;
      merged.flashscoreId = merged.flashscoreId ?? m.flashscoreId;
      merged.bzzoiroId = merged.bzzoiroId ?? m.bzzoiroId;
    }
  }

  return Array.from(map.values());
}

// ─── Sources de données ─────────────────────────────────────────────────────

/** Charge les données BetExplorer scrapées */
function loadBetExplorer(date?: string): CalendarMatchResponse[] {
  const dataPath = join(process.cwd(), "data", "betexplorer_calendar.json");
  if (!existsSync(dataPath)) return [];

  try {
    const raw = JSON.parse(readFileSync(dataPath, "utf-8"));
    const matches: CalendarMatchResponse[] = (raw.matches ?? []).map(
      (m: Record<string, unknown>) => {
        const home = (m.home as string) ?? (m.homeTeam as string) ?? "";
        const away = (m.away as string) ?? (m.awayTeam as string) ?? "";
        const time = (m.time as string) ?? "";
        const oddsArr = Array.isArray(m.odds) ? m.odds : [];
        const scoreStr = m.score as string | null;

        return {
          id: `be-${home}-${away}-${time}`,
          sport: (m.sport as string) ?? "football",
          league: (m.league as string) ?? "",
          country: (m.country as string) ?? "",
          homeTeam: home,
          awayTeam: away,
          scheduledAt: time,
          status: m.isLive
            ? "live"
            : scoreStr
              ? "finished"
              : "scheduled",
          score: scoreStr
            ? (() => {
                const parts = scoreStr.split(":").map(Number);
                return parts.length === 2 && parts.every(Number.isFinite)
                  ? { home: parts[0], away: parts[1] }
                  : undefined;
              })()
            : undefined,
          odds:
            oddsArr.length >= 3
              ? { home: oddsArr[0], draw: oddsArr[1], away: oddsArr[2] }
              : undefined,
          source: "betexplorer" as const,
        };
      },
    );

    // Filtrer par date si fournie
    if (date) {
      return matches.filter((m) => m.scheduledAt?.startsWith(date));
    }
    return matches;
  } catch {
    return [];
  }
}

/** Récupère les matchs BSD (football + tennis) */
async function fetchBSD(
  sport?: string,
  date?: string,
): Promise<CalendarMatchResponse[]> {
  const results: CalendarMatchResponse[] = [];

  // Football BSD
  if (!sport || sport === "football") {
    try {
      const params: { date?: string; limit?: number } = { limit: 200 };
      if (date) params.date = date;

      const [evRes, liveRes] = await Promise.allSettled([
        football.events(params),
        football.live(),
      ]);

      const events =
        evRes.status === "fulfilled" ? evRes.value?.results ?? [] : [];
      const live =
        liveRes.status === "fulfilled"
          ? Array.isArray(liveRes.value)
            ? liveRes.value
            : []
          : [];

      // Fusionner prematch + live (dédup par ID)
      const liveIds = new Set(live.map((e) => e.id));
      const allFootball = [
        ...live,
        ...events.filter((e) => !liveIds.has(e.id)),
      ];

      for (const e of allFootball) {
        const status: CalendarMatchResponse["status"] =
          e.status === "live" || e.status === "finished"
            ? e.status
            : "scheduled";

        results.push({
          id: `bsd-fb-${e.id}`,
          sport: "football",
          league: e.league?.name ?? "",
          country: e.league?.country ?? "",
          homeTeam: e.home?.name ?? "",
          awayTeam: e.away?.name ?? "",
          scheduledAt: e.utc_date ?? "",
          status,
          minute: e.minute,
          score:
            e.home_score != null && e.away_score != null
              ? { home: e.home_score, away: e.away_score }
              : undefined,
          source: "bsd",
          bzzoiroId: e.id,
        });
      }
    } catch {
      // Erreur silencieuse — on continue avec les autres sources
    }
  }

  // Tennis BSD
  if (!sport || sport === "tennis") {
    try {
      const params: { date_from?: string; date_to?: string; limit?: number } = {
        limit: 200,
      };
      if (date) {
        params.date_from = date;
        params.date_to = date;
      }

      const [matchRes, liveRes] = await Promise.allSettled([
        tennis.matches(params),
        tennis.live(),
      ]);

      const matches =
        matchRes.status === "fulfilled" ? matchRes.value?.results ?? [] : [];
      const live =
        liveRes.status === "fulfilled"
          ? Array.isArray(liveRes.value)
            ? liveRes.value
            : []
          : [];

      const liveIds = new Set(live.map((m) => m.id));
      const allTennis = [
        ...live,
        ...matches.filter((m) => !liveIds.has(m.id)),
      ];

      for (const m of allTennis) {
        const status: CalendarMatchResponse["status"] =
          m.status === "live" || m.status === "finished"
            ? m.status
            : "scheduled";

        results.push({
          id: `bsd-tn-${m.id}`,
          sport: "tennis",
          league: m.tournament?.name ?? "",
          country: "",
          homeTeam: m.player1?.name ?? "",
          awayTeam: m.player2?.name ?? "",
          scheduledAt: m.match_date ?? "",
          status,
          score:
            m.player1_sets != null && m.player2_sets != null
              ? { home: m.player1_sets, away: m.player2_sets }
              : undefined,
          odds:
            m.odds_player1 != null && m.odds_player2 != null
              ? { home: m.odds_player1, away: m.odds_player2 }
              : undefined,
          source: "bsd",
          bzzoiroId: m.id,
        });
      }
    } catch {
      // Erreur silencieuse
    }
  }

  return results;
}

/** Récupère les données Flashscore */
async function fetchFlashscore(
  sport?: string,
): Promise<CalendarMatchResponse[]> {
  try {
    const response = await flashscoreService.getLiveScores({
      limit: 200,
    });

    return response.matches.map((m) => {
      const sportTag =
        m.league?.name?.toLowerCase().includes("tennis") ? "tennis" : "football";
      const filtered = sport && sport !== sportTag;

      return {
        id: `fs-${m.id}`,
        sport: sportTag,
        league: m.league?.name ?? "",
        country: m.league?.country ?? "",
        homeTeam: m.home_team ?? "",
        awayTeam: m.away_team ?? "",
        scheduledAt: "",
        status: (
          m.status === "FT"
            ? "finished"
            : m.status === "Live" || m.status === "HT"
              ? "live"
              : "scheduled"
        ) as CalendarMatchResponse["status"],
        minute: undefined,
        score:
          m.home_score != null && m.away_score != null
            ? { home: m.home_score, away: m.away_score }
            : undefined,
        odds:
          m.odds && m.odds.home != null && m.odds.away != null
            ? ({ home: m.odds.home, draw: m.odds.draw ?? undefined, away: m.odds.away } as { home: number; draw?: number; away: number })
            : undefined,
        source: "flashscore" as const,
        flashscoreId: m.id,
      };
    }).filter((m) => !sport || m.sport === sport);
  } catch {
    return [];
  }
}

// ─── Route GET ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") ?? undefined;
    const liveOnly = searchParams.get("live") === "true";
    const date = searchParams.get("date") ?? undefined;

    // Récupération parallèle de toutes les sources
    const [bsdResults, flashscoreResults, betExplorerResults] =
      await Promise.allSettled([
        fetchBSD(sport, date),
        fetchFlashscore(sport),
        Promise.resolve(loadBetExplorer(date)),
      ]);

    const bsd = bsdResults.status === "fulfilled" ? bsdResults.value : [];
    const flash =
      flashscoreResults.status === "fulfilled" ? flashscoreResults.value : [];
    const betExplorer =
      betExplorerResults.status === "fulfilled" ? betExplorerResults.value : [];

    // Fusionner et dédupliquer
    let allMatches = deduplicate([...bsd, ...flash, ...betExplorer]);

    // Filtre par sport si demandé
    if (sport) {
      allMatches = allMatches.filter(
        (m) => m.sport.toLowerCase() === sport.toLowerCase(),
      );
    }

    // Filtre live uniquement
    if (liveOnly) {
      allMatches = allMatches.filter((m) => m.status === "live");
    }

    // Tri par heure de kickoff
    allMatches.sort((a, b) => {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

    return NextResponse.json(allMatches, { headers: CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[calendar/matches] Erreur:", message);
    return NextResponse.json(
      { error: "Erreur interne", detail: message },
      { status: 500 },
    );
  }
}
