/**
 * Press Review Cache Cron — pré-chauffe quotidienne du cache revue de presse.
 *
 * GET /api/ai/press-review-cron?token=CRON_SECRET
 *
 * Appelé par un cron VPS (ex: 07:00 UTC). Parcourt les matchs tennis/football
 * du jour, et appelle les services de revue de presse pour pré-remplir le
 * cache 24h (.cache/press-review/). 100 % gratuit : aucun appel LLM.
 * Throttle 1,2 s entre les matchs pour rester discret vis-à-vis des sources.
 *
 * Réponse: { ok, attempted, warmed, failed, skipped, sportCounts, errors }
 */
import { NextResponse } from "next/server";
import { getPressReview } from "@/lib/tennis-press-review-service";
import { getFootballPressReview } from "@/lib/football-press-review-service";

const CRON_SECRET = process.env.CRON_SECRET;
const ALLOWED_SPORTS = ["tennis", "football"] as const;
const PRESS_DELAY_MS = 1_200;
const MAX_MATCHES_PER_SPORT = 8;

// ---- Mapping tolérant des champs match → requête press-review ----

function tennisQuery(m: any): { matchId: string; playerAName: string; playerBName: string; tournamentName?: string } | null {
  const id = String(m?.id ?? m?.matchId ?? "");
  const a = m?.playerA?.name ?? m?.home?.name ?? m?.homeName ?? m?.home_team ?? "";
  const b = m?.playerB?.name ?? m?.away?.name ?? m?.awayName ?? m?.away_team ?? "";
  if (!id || !a || !b) return null;
  const tournamentName = String(m?.tournamentName ?? m?.tournament?.name ?? m?.competition ?? "").trim() || undefined;
  const surface = String(m?.surface ?? m?.surfaceType ?? "").trim() || undefined;
  const q: any = { matchId: id, playerAName: a, playerBName: b };
  if (tournamentName) q.tournamentName = tournamentName;
  if (surface) q.surface = surface;
  return q;
}

function footballQuery(m: any): { matchId: string; homeTeam: string; awayTeam: string; leagueName?: string } | null {
  const id = String(m?.id ?? m?.matchId ?? m?.event_id ?? "");
  const home = String(m?.home_team ?? m?.home?.name ?? m?.homeName ?? "").trim();
  const away = String(m?.away_team ?? m?.away?.name ?? m?.awayName ?? "").trim();
  if (!id || !home || !away) return null;
  const leagueName = String(m?.league_name ?? m?.competition?.name ?? m?.leagueName ?? "").trim() || undefined;
  const q: any = { matchId: id, homeTeam: home, awayTeam: away };
  if (leagueName) q.leagueName = leagueName;
  return q;
}

async function fetchMatches(sport: string): Promise<any[]> {
  // Même base que l'appelant du cron (pariscore-next sur 3005 en prod) ;
  // NEXT_PUBLIC_APP_URL sert de surcharge externe si définie.
  const baseUrl = process.env.PRESS_CRON_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3005";
  const endpoint = sport === "tennis" ? "/api/tennis/prematch" : "/api/football/matches";
  const res = await fetch(`${baseUrl}${endpoint}`);
  if (!res.ok) throw new Error(`Failed to fetch ${sport} matches: ${res.status}`);
  const json = await res.json();
  return json?.matches ?? [];
}

// ---- GET handler ----

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const errors: string[] = [];
  let attempted = 0;
  let warmed = 0;
  let skipped = 0;
  const sportCounts: Record<string, number> = {};

  try {
    for (const sport of ALLOWED_SPORTS) {
      let matches: any[];
      try {
        matches = await fetchMatches(sport);
      } catch (err: any) {
        errors.push(`fetch ${sport}: ${err.message}`);
        continue;
      }

      const toProcess = matches.slice(0, MAX_MATCHES_PER_SPORT);
      sportCounts[sport] = toProcess.length;

      for (const match of toProcess) {
        attempted++;
        try {
          if (sport === "tennis") {
            const q = tennisQuery(match);
            if (!q) { skipped++; continue; }
            await getPressReview(q);
          } else {
            const q = footballQuery(match);
            if (!q) { skipped++; continue; }
            await getFootballPressReview(q);
          }
          warmed++;
          if (attempted < toProcess.length) {
            await new Promise((r) => setTimeout(r, PRESS_DELAY_MS));
          }
        } catch (err: any) {
          errors.push(`press ${sport}/${String(match?.id ?? match?.matchId ?? "?")}: ${err.message}`);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      ok: true, attempted, warmed, skipped,
      sportCounts,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message, attempted, warmed, skipped, sportCounts, errors },
      { status: 500 },
    );
  }
}