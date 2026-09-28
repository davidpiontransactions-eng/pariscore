import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync } from "fs";
import {
  isFlashscoreFresh,
  resolveHandballDataFile,
  teamHashId,
  toHandballMatch,
  type FlashscoreMatch,
} from "@/lib/handball-flashscore";
import { parisDateOf } from "@/lib/handball-backtest-today";
import { loadRecentTotals } from "@/lib/handball-history-db";
import type { HistoryMatch } from "@/lib/handball-history-stats";
import type { HandballMatch } from "@/lib/handball-data";

// Cache 5 min (miroir /api/handball/matches) — la clé inclut la date pour ne
// jamais servir les résultats d'hier après minuit Europe/Paris.
const CACHE_TTL = 5 * 60_000;
/** Fenêtre : 7 jours glissants (aujourd'hui inclus) — bead 4pvy. */
const MAX_DAYS = 7;

type Payload = {
  date: string;
  days: number;
  matches: HandballMatch[];
  source: string;
  scrapedAt: string | null;
  stale: boolean;
  count: number;
  updatedAt: string;
};
const cache = createTtlCache<Payload>("__handballResultsTodayCache");

/** Clé de dédup insensible casse/accents : le snapshot écrase l'historique. */
function dedupKey(home: string, away: string, date: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return `${norm(home)}|${norm(away)}|${date}`;
}

/** Ligne `handball_match_history` → HandballMatch « finished » (fenêtre semaine). */
function historyToMatch(h: HistoryMatch): HandballMatch {
  // time_utc souvent absent (source snapshot) → midi par défaut (affichage seule).
  const t =
    h.timeUtc && /^\d{2}:\d{2}/.test(h.timeUtc)
      ? h.timeUtc.length === 5
        ? `${h.timeUtc}:00`
        : h.timeUtc.slice(0, 8)
      : "12:00:00";
  return {
    id: teamHashId(`hist|${h.date}|${h.home}|${h.away}`),
    league: {
      id: teamHashId(h.league || "Handball"),
      name: h.league || "Handball",
      country: h.country || "",
      countryCode: "",
    },
    home: { id: teamHashId(h.home), name: h.home },
    away: { id: teamHashId(h.away), name: h.away },
    kickoff: `${h.date}T${t}Z`,
    status: "finished",
    score: {
      home: h.homeGoals,
      away: h.awayGoals,
      ...(h.homeHalf != null && h.awayHalf != null
        ? { homeHalf: h.homeHalf, awayHalf: h.awayHalf }
        : {}),
    },
  };
}

/**
 * GET /api/handball/results-today?days=7 — matchs terminés des N derniers
 * jours (Europe/Paris), défaut 7 (bead 4pvy : onglet « Résultats » enrichi
 * sur toute la semaine).
 *
 * Fusion de 2 sources (dédup clé équipes+date, snapshot prioritaire) :
 *   1. `handball_match_history` — profondeur hebdomadaire (cron PM2 lundi +
 *      runs manuels) couvre toute la semaine ;
 *   2. snapshot Flashscore (cron quotidien 06:30 UTC) — J-1 + finis du jour,
 *      le plus frais.
 * Les matchs dont le flag live est périmé sont reclassés « finished » par le
 * mapping partagé (`resolveHandballLifecycle` via `toHandballMatch`) — plus de
 * match fini bloqué en live ET absent des résultats.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const reqDays = parseInt(url.searchParams.get("days") ?? "7", 10);
    const days = Number.isFinite(reqDays) ? Math.min(MAX_DAYS, Math.max(1, reqDays)) : 7;
    const today = parisDateOf(new Date());
    const since = parisDateOf(new Date(Date.now() - (days - 1) * 86_400_000));

    const cached = cache.getEntry();
    if (
      cached &&
      isFresh(cached, CACHE_TTL) &&
      cached.data.date === today &&
      cached.data.days === days &&
      cached.data.matches.length > 0
    ) {
      return NextResponse.json(cached.data);
    }

    // ── 1. Historique profond (semaine entière) ──
    const merged = new Map<string, HandballMatch>();
    let historyCount = 0;
    for (const h of loadRecentTotals(Math.max(0, days - 1))) {
      if (h.date < since || h.date > today) continue;
      merged.set(dedupKey(h.home, h.away, h.date), historyToMatch(h));
      historyCount++;
    }

    // ── 2. Snapshot Flashscore (frais, écrase l'historique sur la même clé) ──
    let scrapedAt: string | null = null;
    let snapshotCount = 0;
    try {
      const filePath = resolveHandballDataFile("flashscore_handball.json");
      if (filePath) {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        scrapedAt = typeof data.scraped_at === "string" ? data.scraped_at : null;
        const raw = (data.matches || []) as FlashscoreMatch[];
        for (let i = 0; i < raw.length; i++) {
          const m = raw[i];
          if (!m.home || !m.away) continue;
          const hm = toHandballMatch(m, i);
          if (hm.status !== "finished" || !hm.score) continue;
          const d = parisDateOf(hm.kickoff);
          if (d < since || d > today) continue;
          merged.set(dedupKey(m.home, m.away, d), hm);
          snapshotCount++;
        }
      }
    } catch {
      // Snapshot illisible : l'historique seul porte la semaine.
    }

    const weekMatches = [...merged.values()].sort((a, b) =>
      b.kickoff.localeCompare(a.kickoff),
    );
    const source =
      historyCount > 0 && snapshotCount > 0
        ? "history+flashscore"
        : snapshotCount > 0
          ? "flashscore"
          : historyCount > 0
            ? "history"
            : "none";

    const payload: Payload = {
      date: today,
      days,
      matches: weekMatches,
      source,
      scrapedAt,
      stale: scrapedAt != null ? !isFlashscoreFresh(scrapedAt) : false,
      count: weekMatches.length,
      updatedAt: scrapedAt ?? new Date().toISOString(),
    };
    // Pas de cache d'une fenêtre vide : les sources se rafraîchissent dans la journée.
    if (weekMatches.length > 0) cache.set(payload);
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/results-today");
  }
}
