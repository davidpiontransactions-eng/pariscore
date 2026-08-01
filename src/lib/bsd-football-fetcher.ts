import type { FootballMatch, League, Team, Prediction, FootballMatchOdds, FootballLiveState } from "@/lib/football-data";
import { lookupClubLogo } from "@/lib/club-logos";
import { enrichPrediction } from "./football-predictions";

// Hôte racine BSD (l'API sous /api, les images sous /img). Identique au legacy
// server.js:3795 (BSD_ROOT_URL = BSD_BASE sans le suffixe /api).
const BSD_IMAGE_ROOT = "https://sports.bzzoiro.com";

const FLAG = (code: string) => String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);

const BSD_BASE = "https://sports.bzzoiro.com/api";

type BSDLeague = {
  id: number;
  name: string;
  country: string;
  is_women?: boolean;
};

type BSDTeamObj = {
  id: number;
  name: string;
  short_name: string;
  country?: string;
};

type BSDJersey = {
  base: string;
  real: boolean;
  type: string;
  number: string;
  sleeve: string;
};

type BSDJerseys = {
  home?: { player?: BSDJersey };
  away?: { player?: BSDJersey };
};

type BSDLiveStats = {
  home?: {
    ball_possession?: number;
    total_shots?: number;
    shots_on_target?: number;
    corner_kicks?: number;
    total_saves?: number;
    fouls?: number;
    yellow_cards?: number;
    red_cards?: number;
  };
  away?: {
    ball_possession?: number;
    total_shots?: number;
    shots_on_target?: number;
    corner_kicks?: number;
    total_saves?: number;
    fouls?: number;
    yellow_cards?: number;
    red_cards?: number;
  };
};

export type BSDFootballMatch = {
  id: number;
  league: BSDLeague;
  season?: { id: number; name: string; year: number };
  home_team: string;
  away_team: string;
  home_team_obj?: BSDTeamObj;
  away_team_obj?: BSDTeamObj;
  event_date: string;
  round_number?: number;
  round_name?: string;
  group_name?: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_score_ht?: number | null;
  away_score_ht?: number | null;
  current_minute?: number;
  period?: string;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  odds_over_15?: number | null;
  odds_over_25?: number | null;
  odds_under_15?: number | null;
  odds_under_25?: number | null;
  odds_btts_yes?: number | null;
  odds_btts_no?: number | null;
  actual_home_xg?: number | null;
  actual_away_xg?: number | null;
  home_xg_live?: number | null;
  away_xg_live?: number | null;
  is_local_derby?: boolean;
  is_neutral_ground?: boolean | null;
  travel_distance_km?: number | null;
  weather_code?: number | null;
  wind_speed?: number | null;
  temperature_c?: number | null;
  pitch_condition?: number | null;
  attendance?: number | null;
  referee?: { id: number; name: string; country?: string } | null;
  venue?: { id: number; name: string; city?: string; country?: string; capacity?: number } | null;
  jerseys?: BSDJerseys;
  live_stats?: BSDLiveStats;
  sr_stats?: { attack?: { home?: number; away?: number }; dangerous_attack?: { home?: number; away?: number } };
  incidents?: unknown[];
  funfacts?: { type_id: number; sentence: string }[];
  ai_preview?: string | null;
  live_websocket?: boolean;
};

type BSDPaginatedResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: BSDFootballMatch[];
};

// ── Réponse BSD /v2/events/{id}/stats/ (endpoint "bd j6pz fix", non-paginé) ──
// Champs confirmés par le normalizer legacy _bsdMergeShotmap (server.js:49892-49913).
type BSDMomentumPoint = { m: number; v: number }; // v ∈ [-100,+100]
type BSDXgPerMinute = { m: number; xg_home: number; xg_away: number; cum_home?: number; cum_away?: number };
type BSDShot = {
  min: number;
  home: boolean;
  type?: string; // 'goal' | 'miss' | 'save' | ...
  gtype?: string | null; // regular | own | penalty (uniquement pour les buts)
  xg: number;
  xgot?: number | null;
  player_id?: number | null;
};
type BSDMatchStatsResponse = {
  momentum?: BSDMomentumPoint[];
  xg_per_minute?: BSDXgPerMinute[];
  shotmap?: BSDShot[];
};

const COUNTRY_FLAGS: Record<string, string> = {
  England: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  France: FLAG("FR"),
  Spain: FLAG("ES"),
  Germany: FLAG("DE"),
  Italy: FLAG("IT"),
  Portugal: FLAG("PT"),
  Netherlands: FLAG("NL"),
  Belgium: FLAG("BE"),
  Scotland: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
  Mexico: FLAG("MX"),
  USA: FLAG("US"),
  Brazil: FLAG("BR"),
  Argentina: FLAG("AR"),
  Sweden: FLAG("SE"),
  Norway: FLAG("NO"),
  Denmark: FLAG("DK"),
  Poland: FLAG("PL"),
  Romania: FLAG("RO"),
  Bulgaria: FLAG("BG"),
  Greece: FLAG("GR"),
  Turkey: FLAG("TR"),
  Morocco: FLAG("MA"),
  Tunisia: FLAG("TN"),
  Nigeria: FLAG("NG"),
  "South Korea": FLAG("KR"),
  Japan: FLAG("JP"),
  China: FLAG("CN"),
  Australia: FLAG("AU"),
  International: "\uD83C\uDF0D",
};

const TIER_MAP: Record<number, "T1" | "T2" | "CUP"> = {
  1: "T1",
  3: "T1",
  5: "T1",
  6: "T1",
  2: "T1",
  9: "T1",
  10: "T1",
  12: "T2",
  7: "CUP",
  8: "CUP",
};

function leagueTier(leagueId: number): "T1" | "T2" | "CUP" {
  return TIER_MAP[leagueId] ?? "T2";
}

function generateColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ["#004170", "#EF0107", "#FEBE10", "#DC052D", "#010E80", "#2FAEE0", "#E63E32", "#1D2C6B", "#6CABDD", "#034694", "#00E676", "#FF6D00", "#AA00FF", "#00BCD4", "#795548"];
  return colors[Math.abs(hash) % colors.length];
}

function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length <= 2) return name.toUpperCase();
  return parts.map((p) => p[0]).join("").toUpperCase().slice(0, 4);
}

function mapLeague(l: BSDLeague): League {
  return {
    id: `bsd-${l.id}`,
    name: l.name,
    country: l.country ?? "",
    logo: COUNTRY_FLAGS[l.country] ?? "",
    tier: leagueTier(l.id),
  };
}

function mapTeam(name: string, obj?: BSDTeamObj, jerseys?: BSDJerseys, side?: "home" | "away"): Team {
  const id = obj?.id ? `bsd-team-${obj.id}` : name.toLowerCase().replace(/\s+/g, "_");
  const jerseyColor = side && jerseys ? jerseys[side]?.player?.base : undefined;
  // Cascade logo : (1) URL publique BSD depuis team_obj.id (zéro scraping),
  // (2) sinon seed football-logos.cc par nom normalisé, (3) "" → Trophy côté UI.
  const logo = obj?.id
    ? `${BSD_IMAGE_ROOT}/img/team/${obj.id}/?bg=transparent`
    : lookupClubLogo(name) ?? "";
  return {
    id,
    name,
    shortName: obj?.short_name || shortName(name),
    logo,
    color: jerseyColor ? `#${jerseyColor}` : generateColor(name),
    form: ["W", "D", "W", "L", "W"],
    rank: 0,
  };
}

function mapOdds(m: BSDFootballMatch): { odds?: FootballMatch["odds"]; allOdds?: FootballMatchOdds[] } {
  if (m.odds_home == null || m.odds_draw == null || m.odds_away == null) return {};
  const invH = 1 / m.odds_home;
  const invD = 1 / m.odds_draw;
  const invA = 1 / m.odds_away;
  const vig = invH + invD + invA;
  const matchOdds: FootballMatchOdds = {
    bookmaker: "BSD Sports",
    home: m.odds_home,
    draw: m.odds_draw,
    away: m.odds_away,
    impliedHome: Math.round((invH / vig) * 100),
    impliedDraw: Math.round((invD / vig) * 100),
    impliedAway: Math.round((invA / vig) * 100),
    margin: Math.round((vig - 1) * 1000) / 1000,
  };
  return {
    odds: { bookmaker: "BSD Sports", home: m.odds_home, draw: m.odds_draw, away: m.odds_away },
    allOdds: [matchOdds],
  };
}

function mapPrediction(m: BSDFootballMatch): Prediction {
  let over25Prob = 50;
  let bttsProb = 50;
  if (m.odds_over_25 != null) over25Prob = Math.round((1 / m.odds_over_25) / ((1 / m.odds_over_25) + (1 / (m.odds_under_25 ?? 2))) * 100);
  if (m.odds_btts_yes != null) bttsProb = Math.round((1 / m.odds_btts_yes) / ((1 / m.odds_btts_yes) + (1 / (m.odds_btts_no ?? 2))) * 100);
  let homeProb = 33, drawProb = 34, awayProb = 33;
  if (m.odds_home != null && m.odds_draw != null && m.odds_away != null) {
    const invH = 1 / m.odds_home, invD = 1 / m.odds_draw, invA = 1 / m.odds_away;
    const vig = invH + invD + invA;
    homeProb = Math.round((invH / vig) * 100);
    drawProb = Math.round((invD / vig) * 100);
    awayProb = Math.round((invA / vig) * 100);
  }
  return { homeProb, drawProb, awayProb, bttsProb, over25Prob, model: "BSD Odds" };
}

function mapLiveState(m: BSDFootballMatch): FootballLiveState | null {
  const isLive = !["finished", "notstarted", "canceled", "postponed", "suspended"].includes(m.status);
  if (!isLive) return null;
  const ls = m.live_stats;
  return {
    homeScore: m.home_score ?? 0,
    awayScore: m.away_score ?? 0,
    minute: m.current_minute ?? 0,
    status: m.status === "HT" || m.period === "HT" ? "HT" : "LIVE",
    period: m.period,
    homePossession: ls?.home?.ball_possession ?? 50,
    homeShots: ls?.home?.total_shots ?? 0,
    awayShots: ls?.away?.total_shots ?? 0,
    homeShotsOnTarget: ls?.home?.shots_on_target ?? 0,
    awayShotsOnTarget: ls?.away?.shots_on_target ?? 0,
    homeCorners: ls?.home?.corner_kicks ?? 0,
    awayCorners: ls?.away?.corner_kicks ?? 0,
  };
}

function buildMatch(m: BSDFootballMatch): FootballMatch {
  const home = mapTeam(m.home_team, m.home_team_obj, m.jerseys, "home");
  const away = mapTeam(m.away_team, m.away_team_obj, m.jerseys, "away");
  const { odds, allOdds } = mapOdds(m);
  return {
    id: `bsd-${m.id}`,
    league: mapLeague(m.league),
    round: m.round_name || m.round_number?.toString() || "Match",
    scheduledAt: m.event_date,
    home,
    away,
    prediction: enrichPrediction(mapPrediction(m), m),
    odds,
    allOdds,
    live: mapLiveState(m),
    venue: m.venue
      ? { id: m.venue.id, name: m.venue.name, city: m.venue.city, country: m.venue.country }
      : null,
  };
}

async function bsdFetch<T>(endpoint: string): Promise<T> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");

  const url = `${BSD_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${key}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 402) throw new Error("BSD Sports Addon required (402)");
  if (res.status === 429) throw new Error("BSD rate limited (429)");
  if (!res.ok) throw new Error(`BSD HTTP ${res.status}`);

  const data: BSDPaginatedResponse | BSDFootballMatch[] = await res.json();
  return (Array.isArray(data) ? data : data.results) as T;
}

/**
 * Variante de `bsdFetch` pour les endpoints NON-paginés (réponse brute, sans
 * wrapper {count, results}). Utilisée par /v2/events/{id}/stats/ qui renvoie
 * directement { momentum, xg_per_minute, shotmap }.
 */
async function bsdFetchRaw<T>(endpoint: string): Promise<T> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");

  const res = await fetch(`${BSD_BASE}${endpoint}`, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 402) throw new Error("BSD Sports Addon required (402)");
  if (res.status === 429) throw new Error("BSD rate limited (429)");
  if (!res.ok) throw new Error(`BSD HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ── Momentum / xG / buts d'un match live (endpoint /v2/events/{id}/stats/) ──
// Normalisation défensive (optionals + ?? []) — cf. _bsdMergeShotmap legacy.
export type FootballMatchStats = {
  momentum: { minute: number; value: number }[]; // value ∈ [-100,+100]
  xgPerMinute: { minute: number; home: number; away: number }[];
  goals: { minute: number; home: boolean; type: string }[];
};

export async function fetchBSDMatchStats(matchId: string): Promise<FootballMatchStats> {
  const raw = await bsdFetchRaw<BSDMatchStatsResponse>(`/v2/events/${matchId}/stats/`);

  const momentum = (raw.momentum ?? [])
    .filter((e) => e && Number.isFinite(e.m) && Number.isFinite(e.v))
    .map((e) => ({ minute: Number(e.m), value: Math.max(-100, Math.min(100, Number(e.v))) }));

  const xgPerMinute = (raw.xg_per_minute ?? [])
    .filter((e) => e && Number.isFinite(e.m))
    .map((e) => ({
      minute: Number(e.m),
      home: Number(e.xg_home || 0),
      away: Number(e.xg_away || 0),
    }));

  // Buts = shots dont type === 'goal' (ou gtype présent pour un tir cadré).
  const goals = (raw.shotmap ?? [])
    .filter((s) => s && Number.isFinite(Number(s.min)) && (s.type === "goal" || s.gtype))
    .map((s) => ({
      minute: Number(s.min),
      home: !!s.home,
      type: s.gtype || s.type || "regular",
    }));

  return { momentum, xgPerMinute, goals };
}

export async function fetchBSDFootballPrematch(): Promise<FootballMatch[]> {
  const matches = await bsdFetch<BSDFootballMatch[]>("/matches/?status=notstarted&limit=100");
  const result = matches.map(buildMatch);
  console.log(`[bsd-foot] Fetched ${result.length} prematch matches`);
  return result;
}

export async function fetchBSDFootballLive(): Promise<FootballMatch[]> {
  const matches = await bsdFetch<BSDFootballMatch[]>("/live/?limit=50");
  const result = matches.map(buildMatch);
  console.log(`[bsd-foot] Fetched ${result.length} live matches`);
  return result;
}
