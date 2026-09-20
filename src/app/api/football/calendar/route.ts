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
