import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { getFootballMatches } from "@/lib/football-shared-fetcher";

// Paris date formatter singleton
const parisDayFmt = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric", month: "2-digit", day: "2-digit",
});

function toParisDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (!Number.isFinite(date.getTime())) return "";
  return parisDayFmt.format(date);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const liveOnly = url.searchParams.get("live") === "true";
    const statusParam = url.searchParams.get("status");

    const { entry, now } = await getFootballMatches();
    let matches = entry.data.matches as any[];

    if (dateParam) matches = matches.filter((m: any) => toParisDateKey(m.scheduledAt) === dateParam);
    if (liveOnly) matches = matches.filter((m: any) => m.live?.status === "LIVE" || m.live?.status === "HT");
    if (statusParam) matches = matches.filter((m: any) => {
      if (statusParam === "scheduled") return !m.live || m.live.status === "scheduled" || m.live.status === "notstarted";
      return m.live?.status === statusParam;
    });

    // ⚠️ On retire `prediction.metricRankings` de la réponse calendrier.
    //
    // Mesuré le 2026-10-03 : pour `date=2026-10-03` la route renvoyait
    // 93,6 Mo pour 175 matchs (548 Ko/match), alors que la médiane est de
    // 18 Ko. Le calcul est bon, la donnée ne l'est pas : sur les « Club
    // Friendlies », `prediction.metricRankings` pèse 1 711 Ko À CHAQUE match
    // — c'est lui qui gonfle la réponse, pas les autres champs (le match
    // complet ne fait que 2 Ko sans lui).
    //
    // Conséquence : `fetchCal` reçoit un corps de 93 Mo, `res.json()` est trop
    // long/lourd côté navigateur, l'exception est attrapée par le `catch` de
    // top-multi-sport.tsx qui fait `setCalMatches([])` — et le calendrier
    // FotMob s'affiche vide, sans une seule erreur dans la console.
    //
    // Ce champ n'est utile qu'à `football-match-card.tsx` (dans `showRankings`),
    // qui n'est PAS le `MatchRow` du calendrier. `prediction` reste donc
    // entièrement fourni — seule cette clé de 1,7 Mo part.
    matches = matches.map((m: any) => {
      const p = m?.prediction;
      if (!p || !p.metricRankings) return m;
      const { metricRankings: _drop, ...rest } = p;
      return { ...m, prediction: rest };
    });

    return NextResponse.json({
      matches,
      source: entry.data.source,
      degraded: entry.data.degraded,
      updatedAt: new Date(entry.data.degraded ? now : entry.at).toISOString(),
    });
  } catch (err) {
    return apiErrorHandler(err, "football/calendar");
  }
}
