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
  // API réelle de euroleague_api 0.1.1 (fix prod 2026-09-29 : la classe
  // EuroLeagueAPI de l'ancien script N'EXISTE PAS dans le package) :
  // euroleague_api.schedule.Schedule(competition='E'|'U').get_schedule(season)
  // → DataFrame (380 lignes E / 224 U en 2026). Colonnes : date ('Sep 24, 2026',
  // jour local salle) + startime ('20:15', heure locale) + played ('true'|'false').
  // PAS de scores dans ce feed → matchs joués = 'finished' sans score ; heures
  // converties Paris → UTC (approximation tz salle). Le package est installé
  // côté VPS : pip3 install --user --break-system-packages euroleague_api.
  return `
import sys
try:
    import json
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from euroleague_api.schedule import Schedule

    comp = "E" if "${league}" == "euroleague" else "U"
    api = Schedule(competition=comp)
    df = api.get_schedule(season=${season})

    PARIS = ZoneInfo("Europe/Paris")
    result = []
    for _, r in df.iterrows():
        try:
            local = datetime.strptime(str(r["date"]) + " " + str(r["startime"]), "%b %d, %Y %H:%M").replace(tzinfo=PARIS)
            start = local.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            start = ""
        played = str(r.get("played", "false")).lower() == "true"
        try:
            rd = int(r.get("gameday", 0))
        except Exception:
            rd = 0
        result.append({
            "code": 0,
            "id": str(r.get("gamecode", "")),
            "home": {"id": 0, "name": str(r.get("hometeam", "")), "code": str(r.get("homecode", ""))},
            "away": {"id": 0, "name": str(r.get("awayteam", "")), "code": str(r.get("awaycode", ""))},
            "status": "finished" if played else "scheduled",
            "startTime": start,
            "homeScore": None,
            "awayScore": None,
            "round": rd,
            "group": str(r.get("group", "")) or None,
            "venue": str(r.get("arenaname", "")) or None,
        })
    print(json.dumps({"games": result}))
except ImportError as e:
    import json
    print(json.dumps({"games": [], "error": f"euroleague_api indisponible : {e}"}))
except Exception as e:
    import json
    print(json.dumps({"games": [], "error": str(e)[:200]}))
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
