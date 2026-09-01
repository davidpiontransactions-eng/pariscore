import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "football";
  const league = searchParams.get("league");
  const status = searchParams.get("status") || "FT";

  let matches: any[] = [];
  let source = "unknown";

  switch (sport.toLowerCase()) {
    case "football":
      // Utiliser l'API football existante
      try {
        const footRes = await fetch("/api/football/matches", {
          method: "GET",
          headers: { "Accept": "application/json" },
        });
        if (footRes.ok) {
          const footData = await footRes.json();
          matches = (footData.matches ?? []).filter(
            (m: any) =>
              !league || m.league?.id === league || m.league?.name?.toLowerCase().includes(league?.toLowerCase() ?? ""),
          );
          source = footData.source || "football-api";
          if (matches.length === 0 && footData.degraded) {
            // Dégradé BSD → essayer tennis fallback
            try {
              const tennisRes = await fetch("/api/tennis/matches/live?status=FT", {
                method: "GET",
                headers: { "Accept": "application/json" },
              });
              if (tennisRes.ok) {
                const tennisData = await tennisRes.json();
                matches = (tennisData.matches ?? []).filter(
                  (m: any) =>
                    !league || m.league?.id === league || m.league?.name?.toLowerCase().includes(league?.toLowerCase() ?? ""),
                );
                source = "tennis-fallback";
              }
            } catch {}
          }
        }
      } catch {
        // Fallback vers tennis si football échoue
        try {
          const tennisRes = await fetch("/api/tennis/matches/live?status=FT", {
            method: "GET",
            headers: { "Accept": "application/json" },
          });
          if (tennisRes.ok) {
            const tennisData = await tennisRes.json();
            matches = (tennisData.matches ?? []).filter(
              (m: any) =>
                !league || m.league?.id === league || m.league?.name?.toLowerCase().includes(league?.toLowerCase() ?? ""),
            );
            source = "tennis-fallback";
          }
        } catch {}
      }
      break;

    case "tennis":
      try {
        const tennisRes = await fetch("/api/tennis/matches/live?status=FT", {
          method: "GET",
          headers: { "Accept": "application/json" },
        });
        if (tennisRes.ok) {
          const tennisData = await tennisRes.json();
          matches = (tennisData.matches ?? []).filter(
            (m: any) =>
              !league || m.league?.id === league || m.league?.name?.toLowerCase().includes(league?.toLowerCase() ?? ""),
          );
          source = "tennis-api";
        }
      } catch {
        // Fallback vide mais pas d'erreur 503
        matches = [];
        source = "tennis-api";
      }
      break;

    case "basketball":
      try {
        const basketballRes = await fetch("/api/basketball/matches?status=FT", {
          method: "GET",
          headers: { "Accept": "application/json" },
        });
        if (basketballRes.ok) {
          const basketballData = await basketballRes.json();
          matches = (basketballData.matches ?? []).filter(
            (m: any) =>
              !league || m.league?.id === league || m.league?.name?.toLowerCase().includes(league?.toLowerCase() ?? ""),
          );
          source = "basketball-api";
        }
      } catch {
        matches = [];
        source = "basketball-api";
      }
      break;

    default:
      matches = [];
      source = "unknown";
      break;
  }

  // Si aucun sport ne retourne de matches, essayer un fallback général
  if (matches.length === 0) {
    try {
      const footRes = await fetch("/api/football/matches", {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      if (footRes.ok) {
        const footData = await footRes.json();
        matches = (footData.matches ?? []).filter(
          (m: any) => m.live?.status === "FT",
        );
        source = footData.source || "football-api";
      }
    } catch {}
  }

  return NextResponse.json({ matches, sport, source, status });
}