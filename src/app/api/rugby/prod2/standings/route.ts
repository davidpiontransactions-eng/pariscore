import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rugby/prod2/standings
 * Classement Pro D2 depuis le widget Idalgo Rugbyrama.
 */

interface StandingRow {
  position: number;
  name: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
}

const IDALGO_URL =
  "https://www.rugbyrama.fr/idalgo/cache/page/rugby_widget_standing_short.php?refProvider=0&refCompetition=7";

function parseStandingText(text: string): StandingRow[] {
  const rows: StandingRow[] = [];

  // Extraire les données par regex sur les classes CSS Idalgo
  const teamPattern = /span_idalgo_content_standing_position[^>]*>(\d+)<[\s\S]*?a_idalgo_content_standing_name[^>]*title="([^"]*)"[\s\S]*?span_idalgo_content_standing_points[^>]*>(\d+)<[\s\S]*?span_idalgo_content_standing_played[^>]*>(\d+)</g;

  let match;
  let prevPos = 999;
  while ((match = teamPattern.exec(text)) !== null) {
    const position = parseInt(match[1], 10);

    // Si la position revient à 1 ou moins, on a changé de section → arrêter
    if (position <= prevPos && rows.length > 0) break;
    prevPos = position;

    const name = match[2]
      .replace(/&eacute;/g, "é")
      .replace(/&egrave;/g, "è")
      .replace(/&agrave;/g, "à")
      .replace(/&ocirc;/g, "ô")
      .replace(/&ccedil;/g, "ç")
      .replace(/&ecirc;/g, "ê")
      .trim();
    const points = parseInt(match[3], 10);
    const played = parseInt(match[4], 10);

    rows.push({
      position,
      name,
      points,
      played,
      won: 0,
      drawn: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });

    if (rows.length >= 16) break;
  }

  return rows;
}

export async function GET() {
  try {
    const res = await fetch(IDALGO_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/plain, */*",
        Referer: "https://www.rugbyrama.fr/",
        Origin: "https://www.rugbyrama.fr",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Idalgo widget returned ${res.status}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    const standings = parseStandingText(text);

    // Debug: include raw HTML info
    const debugInfo = {
      rawLength: text.length,
      hasTeamPattern: text.includes("span_idalgo_content_standing_position"),
      firstTeamMatch: text.match(/span_idalgo_content_standing_position[^>]*>(\d+)/)?.[0] || "none",
    };

    return NextResponse.json(
      {
        competition: "pro-d2",
        name: "Pro D2",
        standings,
        fetchedAt: new Date().toISOString(),
        source: "rugbyrama-idalgo",
        _debug: debugInfo,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[rugby/prod2/standings]", error);
    return NextResponse.json(
      { error: "Pro D2 standings unavailable — retry later." },
      { status: 502 }
    );
  }
}
