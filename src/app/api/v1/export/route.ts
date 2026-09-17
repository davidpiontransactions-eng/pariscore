import { NextRequest, NextResponse } from "next/server";
import { getLeague } from "@/lib/leagues-stats/db";

// GET /api/v1/export?country=france&slug=ligue-1
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const country = sp.get("country");
  const slug = sp.get("slug");

  if (!country || !slug) {
    return NextResponse.json(
      { error: "country et slug requis" },
      { status: 400 },
    );
  }

  const league = getLeague(country, slug);
  if (!league) {
    return NextResponse.json(
      { error: "Ligue non trouvée" },
      { status: 404 },
    );
  }

  // Construire le CSV
  const rows: string[] = [];

  // Header
  rows.push("section,key,label,value,pct,avg");

  // Data
  for (const section of league.sections) {
    for (const item of section.items) {
      rows.push(
        [
          csvEscape(section.id),
          csvEscape(item.key),
          csvEscape(item.label),
          item.value ?? "",
          item.pct ?? "",
          item.avg ?? "",
        ].join(","),
      );
    }
  }

  // Fixtures
  if (league.fixtures.length > 0) {
    rows.push("");
    rows.push("fixtures");
    rows.push("kickoff,home,away,odds_home,odds_draw,odds_away");
    for (const f of league.fixtures) {
      rows.push(
        [
          csvEscape(f.kickoffText ?? ""),
          csvEscape(f.home.name),
          csvEscape(f.away.name),
          f.odds?.home ?? "",
          f.odds?.draw ?? "",
          f.odds?.away ?? "",
        ].join(","),
      );
    }
  }

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${country}_${slug}_stats.csv"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
