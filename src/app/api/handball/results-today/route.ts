import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { loadFinishedWindow } from "@/lib/handball-results-week";
import { parisDateOf } from "@/lib/handball-backtest-today";
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

/**
 * GET /api/handball/results-today?days=7 — matchs terminés des N derniers
 * jours (Europe/Paris), défaut 7 (onglet « Résultats » enrichi — bead 4pvy).
 *
 * Source = `loadFinishedWindow` (lib partagée) : historique profond + snapshot
 * Flashscore frais, dédupés — LA même table qui remplit le backtest quotidien
 * (`/api/handball/backtest-today`).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const reqDays = parseInt(url.searchParams.get("days") ?? "7", 10);
    const days = Number.isFinite(reqDays) ? Math.min(MAX_DAYS, Math.max(1, reqDays)) : 7;
    const date = parisDateOf(new Date());

    const cached = cache.getEntry();
    if (
      cached &&
      isFresh(cached, CACHE_TTL) &&
      cached.data.date === date &&
      cached.data.days === days &&
      cached.data.matches.length > 0
    ) {
      return NextResponse.json(cached.data);
    }

    const win = loadFinishedWindow(days);
    const payload: Payload = {
      date: win.today,
      days,
      matches: win.matches,
      source: win.source,
      scrapedAt: win.scrapedAt,
      stale: win.stale,
      count: win.matches.length,
      updatedAt: win.scrapedAt ?? new Date().toISOString(),
    };
    // Pas de cache d'une fenêtre vide : les sources se rafraîchissent dans la journée.
    if (win.matches.length > 0) cache.set(payload);
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/results-today");
  }
}
