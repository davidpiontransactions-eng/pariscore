import { NextResponse, type NextRequest } from "next/server";
import { buildProD2Teams } from "@/lib/rugby/prod2-predict";
import { vgPredict, vgOverUnder } from "@/lib/rugby/variance-gamma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rugby/prod2/predictions
 * Prédictions Pro D2 = fixtures Idalgo + classement + Poisson model.
 */

export async function GET(request: NextRequest) {
  // Base dérivée de la requête (pas de localhost hardcodé : casse en prod
  // et sur tout port autre que 3000).
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;
  const FIXTURES_URL = `${base}/api/rugby/prod2/fixtures`;
  const STANDINGS_URL = `${base}/api/rugby/prod2/standings`;

  try {
    const [fixturesRes, standingsRes] = await Promise.all([
      fetch(FIXTURES_URL, { cache: "no-store", signal: AbortSignal.timeout(10000) }),
      fetch(STANDINGS_URL, { cache: "no-store", signal: AbortSignal.timeout(10000) }),
    ]);

    if (!fixturesRes.ok || !standingsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Pro D2 data" },
        { status: 502 }
      );
    }

    const fixturesData = await fixturesRes.json();
    const standingsData = await standingsRes.json();

    const teams = buildProD2Teams(
      standingsData.standings || [],
      fixturesData.matches?.map((m: any) => [m.home?.name, m.away?.name]).flat().filter(Boolean)
    );
    const teamMap = new Map(teams.map((t) => [t.name, t]));

    const matches = (fixturesData.matches || []).map((m: any) => {
      const homeName = m.home?.name;
      const awayName = m.away?.name;
      const home = teamMap.get(homeName);
      const away = teamMap.get(awayName);

      let prediction: ReturnType<typeof vgPredict> | null = null;
      if (home && away) {
        // Lambda = leagueAvg × offensiveStrength × opponentDefensiveStrength × homeBoost
        const LEAGUE_AVG = 24; // ~48 total / 2
        const HOME_ADV = 1.08;
        const lambdaHome = LEAGUE_AVG * home.offensiveStrength * away.defensiveStrength * HOME_ADV;
        const lambdaAway = LEAGUE_AVG * away.offensiveStrength * home.defensiveStrength;
        prediction = vgPredict(lambdaHome, lambdaAway);
        // Ajouter over/under
        const overUnder = vgOverUnder(prediction);
        (prediction as any).overUnderLines = overUnder;
      }

      return {
        match: {
          id: m.id,
          competitionSlug: "pro-d2",
          date: `${m.date}T${m.time || "00:00"}:00Z`,
          status: m.status,
          home: {
            id: homeName?.toLowerCase().replace(/\s+/g, "-") || "",
            name: homeName || "TBD",
            abbreviation: "",
            logo: m.home?.logo || "",
            color: "#E63946",
          },
          away: {
            id: awayName?.toLowerCase().replace(/\s+/g, "-") || "",
            name: awayName || "TBD",
            abbreviation: "",
            logo: m.away?.logo || "",
            color: "#E63946",
          },
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          venue: "",
          neutral: false,
          form: { home: "", away: "" },
        },
        prediction,
      };
    });

    return NextResponse.json(
      {
        competition: {
          id: "pro-d2",
          slug: "pro-d2",
          name: "Pro D2",
          code: "UNION",
          country: "France",
        },
        matches,
        fetchedAt: new Date().toISOString(),
        source: "rugbyrama-idalgo-poisson",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[rugby/prod2/predictions]", error);
    return NextResponse.json(
      { error: "Pro D2 predictions unavailable — retry later." },
      { status: 502 }
    );
  }
}
