// GET /api/handball/players?home=…&away=…&league=…
// DTO compact « meilleurs joueurs » pour la popup prématch handball (G4).
// Le snapshot data/hbl_players.json est lu via fs (server-only) : le dialog
// client ne consomme QUE ce résultat de topPlayersForTeam (jamais le module).
import { NextResponse } from "next/server";
import {
  loadHblPlayers,
  topPlayersForTeam,
  type HblPlayersSnapshot,
  type HblTeamTopPlayers,
} from "@/lib/handball-players";

type PlayersTops = {
  home: HblTeamTopPlayers;
  away: HblTeamTopPlayers;
};

/**
 * Top joueurs avec repli « dernier mot du nom » : le snapshot peut avoir
 * renommé un club (match "HG Erlangen" ↔ snapshot "HC Erlangen") — le
 * matching inclusif de topPlayersForTeam ne suffit pas sur le préfixe.
 */
function topsWithFallback(
  snap: HblPlayersSnapshot | null,
  name: string,
): HblTeamTopPlayers {
  const first = topPlayersForTeam(snap, name, 5);
  if (first.gk.length > 0 || first.field.length > 0) return first;
  const lastWord = name.trim().split(/\s+/).pop() ?? "";
  if (lastWord.length >= 4 && lastWord !== name) {
    const retry = topPlayersForTeam(snap, lastWord, 5);
    if (retry.gk.length > 0 || retry.field.length > 0) return retry;
  }
  return first;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get("home") ?? "";
  const away = searchParams.get("away") ?? "";
  const league = searchParams.get("league") ?? "";

  let snap = loadHblPlayers();
  // Hors pokal : priorité au championnat (277 HBL vs 706 joueurs pokal) —
  // le snapshot "all" mélange professionnels et amateurs.
  if (
    snap &&
    !/pokal/i.test(league) &&
    snap.players.some((p) => p.competition === "hbl")
  ) {
    snap = {
      ...snap,
      players: snap.players.filter((p) => !p.competition || p.competition === "hbl"),
    };
  }

  const payload: PlayersTops = {
    home: topsWithFallback(snap, home),
    away: topsWithFallback(snap, away),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=1800" },
  });
}
