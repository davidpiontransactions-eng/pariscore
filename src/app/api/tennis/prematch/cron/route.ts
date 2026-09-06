import { NextResponse } from "next/server";

/**
 * Cron endpoint — force refresh des matchs tennis (US Open + BSD).
 * Appelé par pm2 cron tous les jours à 15h00 UTC.
 * Invoque la route prematch avec ?force=1 pour bypasser le cache.
 */
export async function GET() {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
    const res = await fetch(`${base}/api/tennis/prematch?force=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json();

    const count = Array.isArray(data.matches) ? data.matches.length : 0;
    const usOpen = data.matches?.filter((m: any) => m.tournament === "US Open").length ?? 0;

    console.log(
      `[tennis-cron] Refresh: ${count} matches (${usOpen} US Open) source=${data.source}`,
    );

    return NextResponse.json({
      ok: true,
      matches: count,
      usOpen,
      source: data.source,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[tennis-cron] Error:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
