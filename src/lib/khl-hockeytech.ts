// Client KHL/WHL/MHL via proxy HockeyTech (github.com/puckway/khl-hockeytech)
// Zéro dep : fetch du proxy public. key = client_code (khl|mhl|whl).
// Views dispo : seasons, schedule, teamsbyseason, roster, scorebar, gamesbydate,
// gamesperday, player (profile|seasonstats|gamebygame|mostrecentseasonstats),
// searchplayers, statviewtype (standings/topscorers/...), brackets.

const PROXY = "https://khl.shayy.workers.dev?url=";

export type KhlLeague = "khl" | "mhl" | "whl";

type SiteKit<T> = { SiteKit: T & { Copyright?: { required_link: string } } };

function buildUrl(league: KhlLeague, params: Record<string, string>): string {
  const qs = new URLSearchParams({
    feed: "modulekit",
    fmt: "json",
    key: league,
    client_code: league,
    lang: "en",
    ...params,
  });
  return `${PROXY}${encodeURIComponent(`https://lscluster.hockeytech.com/feed/?${qs}`)}`;
}

async function callKit<T>(league: KhlLeague, params: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(buildUrl(league, params), { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as SiteKit<T>;
    return json.SiteKit ?? null;
  } catch {
    return null;
  }
}

export async function khlSeasons(league: KhlLeague = "khl") {
  return callKit<{ Seasons: { season_id: string; season_name: string; shortname: string }[] }>(league, { view: "seasons" });
}

export async function khlSchedule(league: KhlLeague, seasonId: string | "latest", teamId?: string) {
  const params: Record<string, string> = { view: "schedule", season_id: seasonId };
  if (teamId) params.team_id = teamId;
  return callKit<{ Schedule: unknown[] }>(league, params);
}

export async function khlTeamsBySeason(league: KhlLeague, seasonId: string | "latest") {
  return callKit<{ Teams: unknown[] }>(league, { view: "teamsbyseason", season_id: seasonId });
}

export async function khlScorebar(league: KhlLeague, daysBack = 1, daysAhead = 3) {
  return callKit<{ Scorebar: unknown[] }>(league, {
    view: "scorebar",
    numberofdaysback: String(daysBack),
    numberofdaysahead: String(daysAhead),
  });
}

export async function khlRoster(league: KhlLeague, seasonId: string | "latest", teamId: string) {
  return callKit<{ Roster: unknown[] }>(league, { view: "roster", season_id: seasonId, team_id: teamId });
}

export async function khlSearchPlayers(league: KhlLeague, term: string) {
  return callKit<{ SearchPlayers: unknown[] }>(league, { view: "searchplayers", search_term: term });
}
