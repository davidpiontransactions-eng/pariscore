/**
 * API route pour les matchs EuroLeague/EuroCup.
 * Bridge vers euroleague_api (Python) — appelé côté serveur uniquement.
 * GET /api/euroleague/matches?league=euroleague&season=2025
 */

import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type EuroLeagueGame = {
  code: number;
  id: number;
  home: { id: number; name: string; code: string };
  away: { id: number; name: string; code: string };
  status: string;
  startTime: string;
  homeScore: number | null;
  awayScore: number | null;
  round: number;
  group: string | null;
  venue: string | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") || "euroleague";
  const season = searchParams.get("season") || "2025";

  if (!["euroleague", "eurocup"].includes(league)) {
    return NextResponse.json({ error: "Invalid league. Must be euroleague or eurocup." }, { status: 400 });
  }

  try {
    // Appel euroleague_api Python (installé via pip)
    const { stdout, stderr } = await execFileAsync(
      "python3",
      ["-c", `
import sys
try:
    from euroleague_api import EuroLeagueAPI
    api = EuroLeagueAPI()
    if "${league}" == "euroleague":
        games = api.get_euroleague_games(season=${season})
    else:
        games = api.get_eurocup_games(season=${season})
    
    import json
    result = []
    for g in games:
        result.append({
            "code": getattr(g, "code", 0),
            "id": getattr(g, "game_code", 0),
            "home": {"id": getattr(g, "home_team_code", 0), "name": getattr(g, "home_team", ""), "code": getattr(g, "home_team_code", "")},
            "away": {"id": getattr(g, "away_team_code", 0), "name": getattr(g, "away_team", ""), "code": getattr(g, "away_team_code", "")},
            "status": getattr(g, "game_status", "scheduled"),
            "startTime": getattr(g, "game_date", ""),
            "homeScore": getattr(g, "home_team_score", None),
            "awayScore": getattr(g, "away_team_score", None),
            "round": getattr(g, "round", 0),
            "group": getattr(g, "group_name", None),
            "venue": getattr(g, "venue", None),
        })
    print(json.dumps({"games": result}))
except ImportError:
    # euroleague_api non installé — retourner données simulées
    import json
    print(json.dumps({"games": [], "error": "euroleague_api not installed"}))
except Exception as e:
    import json
    print(json.dumps({"games": [], "error": str(e)}))
`,
      ],
      { timeout: 15000 },
    );

    const data = JSON.parse(stdout.trim());
    return NextResponse.json(data);
  } catch (error) {
    // Fallback : retourner données vides si euroleague_api non disponible
    return NextResponse.json({
      games: [],
      error: "EuroLeague API unavailable. Install euroleague_api: pip install euroleague_api",
    });
  }
}
