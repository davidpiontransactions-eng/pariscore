// GET /api/handball/players?home=…&away=…&league=…
// DTO compact « meilleurs joueurs » pour la popup prématch handball (G4).
// Snapshot fusionné HBL + StarLigue (loadHandballPlayers) lu via fs
// (server-only) : le dialog client ne consomme QUE topPlayersForTeam.
import { NextResponse } from "next/server";
import {
  loadHandballPlayers,
  playersForLeague,
  topPlayersForTeam,
  type HblPlayersSnapshot,
  type HblTeamTopPlayers,
} from "@/lib/handball-players";
import { handballPlayerPhoto } from "@/lib/handball-photos";

type PlayersTops = {
  home: HblTeamTopPlayers;
  away: HblTeamTopPlayers;
};

/**
 * Enrichit chaque joueur de sa photo : headshot officiel du snapshot HBL
 * (`photoUrl` Sportradar, prioritaire) → sinon Wikipedia → sinon null
 * (PlayerAvatar affiche les initiales).
 */
function withPhotos(tops: HblTeamTopPlayers): HblTeamTopPlayers {
  const add = (p: HblTeamTopPlayers["field"][number]) => ({
    ...p,
    photoUrl: p.photoUrl ?? handballPlayerPhoto(p.name),
  });
  return { ...tops, gk: tops.gk.map(add), field: tops.field.map(add) };
}

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

  // Filtre par compétition : StarLigue → snapshot LNH, DHB Pokal → tout,
  // sinon HBL seul (706 joueurs pokal écraseraient les 277 professionnels).
  const snap = playersForLeague(loadHandballPlayers(), league);

  const payload: PlayersTops = {
    home: withPhotos(topsWithFallback(snap, home)),
    away: withPhotos(topsWithFallback(snap, away)),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=1800" },
  });
}
