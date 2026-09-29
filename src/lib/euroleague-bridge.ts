/**
 * euroleague-bridge.ts — appel euroleague_api (Python) partagé par
 * /api/euroleague/matches et /api/basketball/calendar. Serveur uniquement.
 *
 * Fix P1 2026-09-29 : `python3` n'existe pas sur Windows (le bridge tombait
 * toujours en erreur) → binaire `python` sur win32, `python3` ailleurs.
 */

import { execFile } from "child_process";
import os from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type EuroLeagueGame = {
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

export type EuroLeagueBridgeResult = {
  games: EuroLeagueGame[];
  error?: string;
};

function pythonScript(league: string, season: string): string {
  return `
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
`;
}

/**
 * Récupère les matchs EuroLeague/EuroCup via le bridge Python.
 * Ne lève jamais : renvoie `{ games: [], error }` en cas d'indisponibilité.
 */
export async function fetchEuroGames(
  league: "euroleague" | "eurocup",
  season = "2025",
): Promise<EuroLeagueBridgeResult> {
  const pythonBin = process.platform === "win32" ? "python" : "python3";
  // Fix prod 2026-09-29 : le process PM2 tourne sans HOME ni PATH → python3 ne
  // voit PAS ~/.local/lib/pythonX/site-packages (pip --user) → ImportError.
  // On durcit l'env : HOME et PATH garantis.
  const env = {
    ...process.env,
    HOME: process.env.HOME || os.homedir(),
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  };
  try {
    const { stdout } = await execFileAsync(pythonBin, ["-c", pythonScript(league, season)], {
      timeout: 15_000,
      env,
    });
    const data = JSON.parse(stdout.trim()) as EuroLeagueBridgeResult;
    return { games: Array.isArray(data?.games) ? data.games : [], error: data?.error };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    const hint = msg.includes("ENOENT") ? `${pythonBin} introuvable` : msg;
    return { games: [], error: `EuroLeague bridge indisponible : ${hint}` };
  }
}
