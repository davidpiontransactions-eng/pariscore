import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync } from "fs";
import {
  isFlashscoreFresh,
  resolveHandballDataFile,
  toHandballMatch,
  type FlashscoreMatch,
} from "@/lib/handball-flashscore";
import { parisDateOf } from "@/lib/handball-backtest-today";
import type { HandballMatch } from "@/lib/handball-data";

// Cache 5 min (miroir /api/handball/matches) — la clé inclut la date pour ne
// jamais servir les résultats d'hier après minuit Europe/Paris.
const CACHE_TTL = 5 * 60_000;

type Payload = {
  date: string;
  matches: HandballMatch[];
  source: string;
  scrapedAt: string | null;
  stale: boolean;
  count: number;
  updatedAt: string;
};
const cache = createTtlCache<Payload>("__handballResultsTodayCache");

/** Snapshot Flashscore complet (mapping partagé toHandballMatch). */
function loadFlashscoreHandball(): { matches: HandballMatch[]; scrapedAt: string | null } {
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return { matches: [], scrapedAt: null };
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const raw = (data.matches || []) as FlashscoreMatch[];
    const matches = raw
      .filter((m) => m.home && m.away)
      .map((m, i) => toHandballMatch(m, i));
    const scrapedAt = typeof data.scraped_at === "string" ? data.scraped_at : null;
    return { matches, scrapedAt };
  } catch {
    return { matches: [], scrapedAt: null };
  }
}

/**
 * GET /api/handball/results-today — matchs terminés du jour civil Europe/Paris.
 *
 * Filtre date : `parisDateOf(kickoff)` (Intl + Europe/Paris, gère CET/CEST) ===
 * `parisDateOf(now)`. Pas de fallback API-Sports : les résultats ne viennent que
 * du snapshot Flashscore (rafraîchi par le cron pariscore-cron-flashscore-handball).
 * `stale: true` expose un snapshot de plus de 20h (gate I13) sans jamais servir
 * un tableau vide silencieusement.
 */
export async function GET() {
  try {
    const date = parisDateOf(new Date());

    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL) && cached.data.date === date && cached.data.matches.length > 0) {
      return NextResponse.json(cached.data);
    }

    const { matches, scrapedAt } = loadFlashscoreHandball();
    const dayMatches = matches
      .filter((m) => m.status === "finished" && m.score && parisDateOf(m.kickoff) === date)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    const payload: Payload = {
      date,
      matches: dayMatches,
      source: matches.length > 0 ? "flashscore" : "none",
      scrapedAt,
      stale: matches.length > 0 ? !isFlashscoreFresh(scrapedAt) : true,
      count: dayMatches.length,
      updatedAt: scrapedAt ?? new Date().toISOString(),
    };
    // Pas de cache d'une journée vide : le snapshot se rafraîchit dans la journée.
    if (dayMatches.length > 0) cache.set(payload);
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/results-today");
  }
}
