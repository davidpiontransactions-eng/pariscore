import type { FootballMatch, League, Team, Prediction, FootballMatchOdds, FootballLiveState, StandingContext, TeamStandingStats, MatchMetricStats, TeamMetricStats, MetricValue, MetricRankings, MetricRankingRow, TeamMetricCategory, GoalMetrics, CornerMetrics } from "@/lib/football-data";
import { lookupClubLogo } from "@/lib/club-logos";
import { enrichPrediction } from "./football-predictions";

// Hôte racine BSD (l'API sous /api, les images sous /img). Identique au legacy
// server.js:3795 (BSD_ROOT_URL = BSD_BASE sans le suffixe /api).
const BSD_IMAGE_ROOT = "https://sports.bzzoiro.com";

const FLAG = (code: string) => String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);

/** Mapping pays (nom complet) → code ISO 2 lettres pour le drapeau. */
const COUNTRY_TO_CODE: Record<string, string> = {
  England: "GB",
  France: "FR",
  Spain: "ES",
  Germany: "DE",
  Italy: "IT",
  Portugal: "PT",
  Netherlands: "NL",
  Belgium: "BE",
  Scotland: "GB",
  Mexico: "MX",
  USA: "US",
  Brazil: "BR",
  Argentina: "AR",
  Sweden: "SE",
  Norway: "NO",
  Denmark: "DK",
  Poland: "PL",
  Romania: "RO",
  Bulgaria: "BG",
  Greece: "GR",
  Turkey: "TR",
  Morocco: "MA",
  Tunisia: "TN",
  Nigeria: "NG",
  "South Korea": "KR",
  Japan: "JP",
  China: "CN",
  Australia: "AU",
  Colombia: "CO",
  "Saudi Arabia": "SA",
  "United Arab Emirates": "AE",
  UAE: "AE",
  Croatia: "HR",
  Switzerland: "CH",
  Austria: "AT",
  Czechia: "CZ",
  "Czech Republic": "CZ",
  Ukraine: "UA",
  Russia: "RU",
  Serbia: "RS",
  Chile: "CL",
  Uruguay: "UY",
  Peru: "PE",
  Ecuador: "EC",
  Paraguay: "PY",
  Bolivia: "BO",
  Venezuela: "VE",
  Egypt: "EG",
  Algeria: "DZ",
  "Ivory Coast": "CI",
  Ghana: "GH",
  Senegal: "SN",
  Cameroon: "CM",
  "South Africa": "ZA",
  Canada: "CA",
  India: "IN",
  Indonesia: "ID",
  Thailand: "TH",
  Malaysia: "MY",
  Vietnam: "VN",
  Qatar: "QA",
  Iran: "IR",
  Israel: "IL",
  Cyprus: "CY",
  Finland: "FI",
  Ireland: "IE",
  Hungary: "HU",
  Slovakia: "SK",
  Slovenia: "SI",
};

/** Génère un drapeau émoji pour n'importe quel pays (nom complet ou code ISO). */
export function countryFlag(country: string): string {
  if (!country) return "\uD83C\uDF0D"; // 🌍 fallback
  // Code ISO 2 lettres direct
  if (country.length === 2 && /^[A-Z]{2}$/.test(country)) {
    return FLAG(country);
  }
  // Mapping nom complet → code
  const code = COUNTRY_TO_CODE[country];
  if (code) return FLAG(code);
  // Dernier recours : globe
  return "\uD83C\uDF0D";
}

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
    countryCode: countryNameToCode(l.country ?? ""),
    logo: `${BSD_IMAGE_ROOT}/img/league/${l.id}/`,
    tier: leagueTier(l.id),
  };
}

/** Mapping nom de pays → code ISO 2 lettres pour le CDN drapeau. */
function countryNameToCode(name: string): string {
  const MAP: Record<string, string> = {
    france: "FR", england: "GB-ENG", spain: "ES", germany: "DE",
    italy: "IT", portugal: "PT", netherlands: "NL", belgium: "BE",
    brazil: "BR", argentina: "AR", mexico: "MX", scotland: "GB-SCT",
    turkey: "TR", greece: "GR", russia: "RU", austria: "AT",
    switzerland: "CH", denmark: "DK", sweden: "SE", norway: "NO",
    poland: "PL", "czech republic": "CZ", croatia: "HR", serbia: "RS",
    ukraine: "UA", romania: "RO", bulgaria: "BG", hungary: "HU",
    usa: "US", japan: "JP", "south korea": "KR", china: "CN",
    australia: "AU", egypt: "EG", morocco: "MA", tunisia: "TN",
    algeria: "DZ", "saudi arabia": "SA", qatar: "QA",
    "united arab emirates": "AE", wales: "GB-WLS", "northern ireland": "GB-NIR",
  };
  return MAP[name.toLowerCase().trim()] ?? "INTL";
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
    bookmaker: "PariScore",
    home: m.odds_home,
    draw: m.odds_draw,
    away: m.odds_away,
    impliedHome: Math.round((invH / vig) * 100),
    impliedDraw: Math.round((invD / vig) * 100),
    impliedAway: Math.round((invA / vig) * 100),
    margin: Math.round((vig - 1) * 1000) / 1000,
  };
  return {
    odds: { bookmaker: "PariScore", home: m.odds_home, draw: m.odds_draw, away: m.odds_away },
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
  return { homeProb, drawProb, awayProb, bttsProb, over25Prob, model: "PariScore" };
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
  momentum: { minute: number; value: number }[];
  xgPerMinute: { minute: number; home: number; away: number }[];
  goals: { minute: number; home: boolean; type: string }[];
  /** Pression : % du temps où chaque équipe domine. */
  pressure: { homePct: number; awayPct: number };
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

  // Buts = shots dont type === 'goal' (uniquement).
  const goals = (raw.shotmap ?? [])
    .filter((s) => s && Number.isFinite(Number(s.min)) && s.type === "goal")
    .map((s) => ({
      minute: Number(s.min),
      home: !!s.home,
      type: s.gtype || s.type || "regular",
    }));

  // Pression : % du temps avec momentum positif (domicile) vs négatif (extérieur)
  const totalMoments = momentum.length;
  const homeDominant = momentum.filter((m) => m.value > 5).length;
  const awayDominant = momentum.filter((m) => m.value < -5).length;
  // Par défaut 50/50 si pas de données
  const homePct = totalMoments > 0 ? Math.round((homeDominant / Math.max(totalMoments, 1)) * 100) : 50;
  const awayPct = totalMoments > 0 ? 100 - homePct : 50;

  return {
    momentum,
    xgPerMinute,
    goals,
    pressure: { homePct, awayPct },
  };
}

export async function fetchBSDFootballPrematch(): Promise<FootballMatch[]> {
  const matches = await bsdFetch<BSDFootballMatch[]>("/matches/?status=notstarted&limit=100");
  const result = matches.map(buildMatch);
  console.log(`[bsd-foot] Fetched ${result.length} prematch matches`);

  // Enrichissement Domicile/Extérieur réel (best-effort, jamais bloquant).
  try {
    const leagueIds = [...new Set(matches.map((m) => m.league?.id).filter((id): id is number => typeof id === "number"))];
    await Promise.all(
      leagueIds.map(async (lid) => {
        const derived = await fetchBSDLeagueData(lid);
        matches.forEach((m, i) => {
          if (m.league?.id === lid) attachDerivedData(derived, result[i]);
        });
      })
    );
  } catch (e) {
    console.warn("[bsd-foot] derived data enrichment failed:", (e as Error).message);
  }

  return result;
}

// ── Bilan Domicile/Extérieur réel (dérivé des events BSD terminés) ─────────────
// Miroir du legacy server.js fetchBSDStandingsFromEvents : on agrège les scores
// des matchs finis d'une ligue pour reconstruire un classement réel avec les
// splits home/away (played/wins/draws/losses/gf/ga). Aucun nouveau schéma réseau.
type SideAgg = { played: number; wins: number; draws: number; losses: number; gf: number; ga: number };
type StandingAgg = { name: string; totals: SideAgg; home: SideAgg; away: SideAgg };
type StandingData = { home: TeamStandingStats; away: TeamStandingStats };

/** One team's full derived metric/standing data (home + away contexts). */
type TeamDerived = { stats: { home: TeamMetricStats; away: TeamMetricStats }; standing: StandingData };

/** League-wide derived data: per-team map + real leaderboards + partial status. */
type LeagueDerivedData = {
  teams: Map<string, TeamDerived>;
  rankings: MetricRankings;
  partial: boolean;
};

function normTeamKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function emptySide(): SideAgg {
  return { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
}

function sidePts(s: SideAgg): number {
  return s.wins * 3 + s.draws;
}

function sidePpg(s: SideAgg): number {
  return s.played > 0 ? sidePts(s) / s.played : 0;
}

function toStandingSide(side: SideAgg, rank: number, rankTotal: number): TeamStandingStats {
  return {
    played: side.played,
    points: sidePts(side),
    ppg: side.played > 0 ? Math.round((sidePts(side) / side.played) * 100) / 100 : 0,
    wins: side.wins,
    draws: side.draws,
    losses: side.losses,
    goalsFor: side.gf,
    goalsAgainst: side.ga,
    goalDiff: side.gf - side.ga,
    rank,
    rankTotal,
    partial: side.played < 3,
  };
}

// Cache par ligue (6h) pour ne pas rescaner tous les events à chaque call prematch.
const standingsCache = new Map<number, { at: number; data: LeagueDerivedData | null }>();
const STANDINGS_TTL = 6 * 60 * 60 * 1000;

// ── Métriques par catégorie (Buts réelles ; Tirs/Corners/Attaques indisponibles) ──
type GoalRankMaps = { avg: Map<string, number>; scored: Map<string, number>; scoredPg: Map<string, number>; conceded: Map<string, number>; concededPg: Map<string, number> };

const avgGoalsOf = (s: SideAgg): number => (s.played > 0 ? (s.gf + s.ga) / s.played : 0);
const scoredOf = (s: SideAgg): number => s.gf;
const scoredPgOf = (s: SideAgg): number => (s.played > 0 ? s.gf / s.played : 0);
const concededOf = (s: SideAgg): number => s.ga;
const concededPgOf = (s: SideAgg): number => (s.played > 0 ? s.ga / s.played : 0);

/** Rang (1 = meilleur) d'un côté (home ou away) selon une fonction de valeur (desc). */
function buildRankMap(teams: StandingAgg[], pick: (t: StandingAgg) => SideAgg, valueFn: (s: SideAgg) => number): Map<string, number> {
  const arr = teams.map((t) => ({ key: normTeamKey(t.name), v: valueFn(pick(t)) }));
  arr.sort((a, b) => b.v - a.v);
  const m = new Map<string, number>();
  arr.forEach((r, i) => m.set(r.key, i + 1));
  return m;
}

function buildGoalRankMaps(teams: StandingAgg[], pick: (t: StandingAgg) => SideAgg): GoalRankMaps {
  return {
    avg: buildRankMap(teams, pick, avgGoalsOf),
    scored: buildRankMap(teams, pick, scoredOf),
    scoredPg: buildRankMap(teams, pick, scoredPgOf),
    conceded: buildRankMap(teams, pick, concededOf),
    concededPg: buildRankMap(teams, pick, concededPgOf),
  };
}

/** Métrique avec valeur indisponible (aucune source réelle) — rank & value null. */
function unavailableMetric(rankTotal: number): MetricValue {
  return { value: null, rank: null, rankTotal };
}

/** Métrique réelle (Buts) avec son rang ligue. */
function realMetric(value: number | null, rank: number | null | undefined, rankTotal: number): MetricValue {
  return { value: value == null ? null : Math.round(value * 100) / 100, rank: rank ?? null, rankTotal };
}

/** Construit les stats par catégorie d'une équipe dans un contexte (home ou away). */
function buildTeamMetricStats(key: string, side: SideAgg, ranks: GoalRankMaps, rankTotal: number): TeamMetricStats {
  const played = side.played;
  const goals: GoalMetrics = {
    avg: realMetric(avgGoalsOf(side), ranks.avg.get(key), rankTotal),
    scored: realMetric(scoredOf(side), ranks.scored.get(key), rankTotal),
    scoredPg: realMetric(scoredPgOf(side), ranks.scoredPg.get(key), rankTotal),
    conceded: realMetric(concededOf(side), ranks.conceded.get(key), rankTotal),
    concededPg: realMetric(concededPgOf(side), ranks.concededPg.get(key), rankTotal),
  };
  const unav = (): MetricValue => unavailableMetric(rankTotal);
  const cat = (): TeamMetricCategory => ({ for: unav(), against: unav(), total: unav() });
  const corners: CornerMetrics = {
    total: unav(), over55: unav(), over65: unav(), over75: unav(), over85: unav(), over95: unav(), over105: unav(),
  };
  return { shots: cat(), sot: cat(), attacks: cat(), goals, corners };
}

/** Leaderboard d'une métrique : équipes triées desc + rang. */
function buildLeaderboard(teams: StandingAgg[], pick: (t: StandingAgg) => SideAgg, valueFn: (s: SideAgg) => number): MetricRankingRow[] {
  return teams
    .map((t) => ({ teamId: t.name, name: t.name, value: Math.round(valueFn(pick(t)) * 100) / 100, rank: 0 }))
    .sort((a, b) => (b.value - a.value))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

async function fetchBSDLeagueData(leagueId: number): Promise<LeagueDerivedData | null> {
  const cached = standingsCache.get(leagueId);
  if (cached && Date.now() - cached.at < STANDINGS_TTL) return cached.data;

  const agg = new Map<string, StandingAgg>();
  const ensure = (key: string, name: string): StandingAgg => {
    let a = agg.get(key);
    if (!a) {
      a = { name, totals: emptySide(), home: emptySide(), away: emptySide() };
      agg.set(key, a);
    }
    return a;
  };

  type BSDSeason = { id: number; name?: string; year?: number; start_date?: string; end_date?: string };
  type BSDStandingsRow = {
    position?: number; team_id?: number; team_name?: string; played?: number;
    won?: number; drawn?: number; lost?: number; gf?: number; ga?: number; gd?: number; pts?: number;
  };

  try {
    // 1) Résolution de la saison courante (endpoint /v2/leagues/{id}/season/, cached 30 min côté BSD).
    //    Le scan sur 420 jours x 20 pages causait des timeouts en prod ([live-broker] BSD_ERROR).
    const seasonRes = await bsdFetchRaw<{ league_id: number; season: BSDSeason }>(
      `/v2/leagues/${leagueId}/season/`
    );
    const seasonId: number | undefined = seasonRes?.season?.id;

    // 2) Standings officiels de la saison (cache 10 min BSD, réponse non paginée).
    //    On y injecte le classement TOTAL (pts) car /standings/ ne fournit pas le split home/away.
    if (seasonId) {
      try {
        const official = await bsdFetchRaw<{
          league_id: number; season: BSDSeason; grouped: boolean; standings: BSDStandingsRow[];
        }>(`/v2/leagues/${leagueId}/standings/?season_id=${seasonId}`);
        for (const row of (official?.standings ?? [])) {
          const p = Number(row.position);
          const name = (row.team_name || "").trim();
          const pts = Number(row.pts);
          const played = Number(row.played);
          const gf = Number(row.gf);
          const ga = Number(row.ga);
          if (!name || !Number.isFinite(p) || !Number.isFinite(pts)) continue;
          const a = ensure(normTeamKey(name), name);
          // Le classement officiel est la meilleure source pour le total ; il remplace
          // le total dérivé des seuls matchs terminés (ne rejette pas les splits home/away).
          a.totals = {
            played: Number.isFinite(played) ? played : a.totals.played,
            wins: Number.isFinite(Number(row.won)) ? Number(row.won) : a.totals.wins,
            draws: Number.isFinite(Number(row.drawn)) ? Number(row.drawn) : a.totals.draws,
            losses: Number.isFinite(Number(row.lost)) ? Number(row.lost) : a.totals.losses,
            gf: Number.isFinite(gf) ? gf : a.totals.gf,
            ga: Number.isFinite(ga) ? ga : a.totals.ga,
          };
        }
      } catch (e) {
        console.warn(`[bsd-foot] official standings league=${leagueId} skipped:`, (e as Error).message);
      }

      // 3) Events terminés de la saison courante (limit=200 → 2-3 pages max, offset pagination).
      let offset = 0;
      for (let page = 1; page <= 10; page++) {
        const res = await bsdFetch<{ results: BSDFootballMatch[] }>(
          `/events/?league_id=${leagueId}&season_id=${seasonId}&status=finished&limit=200&offset=${offset}`
        );
        const rows = Array.isArray(res) ? res : (res.results ?? []);
        if (!rows.length) break;
        for (const e of rows) {
          const homeName = (e.home_team || "").trim();
          const awayName = (e.away_team || "").trim();
          const hScore = Number(e.home_score);
          const aScore = Number(e.away_score);
          if (!homeName || !awayName || !Number.isFinite(hScore) || !Number.isFinite(aScore)) continue;
          const hKey = normTeamKey(homeName);
          const aKey = normTeamKey(awayName);
          const h = ensure(hKey, homeName);
          const a = ensure(aKey, awayName);

          h.home.played++; h.home.gf += hScore; h.home.ga += aScore;
          a.away.played++; a.away.gf += aScore; a.away.ga += hScore;

          if (hScore > aScore) {
            h.home.wins++; a.away.losses++;
          } else if (hScore < aScore) {
            a.away.wins++; h.home.losses++;
          } else {
            h.home.draws++; a.away.draws++;
          }
        }
        if (rows.length < 200) break;
        offset += rows.length;
      }
    }
  } catch (e) {
    console.warn(`[bsd-foot] standings league=${leagueId} failed:`, (e as Error).message);
    standingsCache.set(leagueId, { at: Date.now(), data: null });
    return null;
  }

  if (agg.size === 0) {
    standingsCache.set(leagueId, { at: Date.now(), data: null });
    return null;
  }

  const rankTotal = agg.size;
  const teams = [...agg.values()];
  const partial = teams.some((t) => t.home.played < 3 || t.away.played < 3);

  // Rangs distincts : classement PPG Domicile (équipe 1) et PPG Extérieur (équipe 2).
  const rankByPpg = (pick: (t: StandingAgg) => SideAgg): Map<string, number> => {
    const sorted = [...teams].sort((x, y) => {
      const ppgDiff = sidePpg(pick(y)) - sidePpg(pick(x));
      if (ppgDiff !== 0) return ppgDiff;
      const gdX = pick(x).gf - pick(x).ga;
      const gdY = pick(y).gf - pick(y).ga;
      if (gdY !== gdX) return gdY - gdX;
      return pick(y).gf - pick(x).gf;
    });
    const map = new Map<string, number>();
    sorted.forEach((t, i) => map.set(normTeamKey(t.name), i + 1));
    return map;
  };

  const homeRank = rankByPpg((t) => t.home);
  const awayRank = rankByPpg((t) => t.away);

  // Rangs par métrique buts (Domicile / Extérieur).
  const homeGoalRanks = buildGoalRankMaps(teams, (t) => t.home);
  const awayGoalRanks = buildGoalRankMaps(teams, (t) => t.away);

  const teamsOut = new Map<string, TeamDerived>();
  for (const t of teams) {
    const key = normTeamKey(t.name);
    const standing: StandingData = {
      home: toStandingSide(t.home, homeRank.get(key) ?? rankTotal, rankTotal),
      away: toStandingSide(t.away, awayRank.get(key) ?? rankTotal, rankTotal),
    };
    teamsOut.set(key, {
      standing,
      stats: {
        home: buildTeamMetricStats(key, t.home, homeGoalRanks, rankTotal),
        away: buildTeamMetricStats(key, t.away, awayGoalRanks, rankTotal),
      },
    });
  }

  // Leaderboards du championnat (métriques réelles, Domicile & Extérieur).
  const rankings: MetricRankings = {
    "ppg-home": buildLeaderboard(teams, (t) => t.home, sidePpg),
    "ppg-away": buildLeaderboard(teams, (t) => t.away, sidePpg),
    "goals-scored-home": buildLeaderboard(teams, (t) => t.home, scoredOf),
    "goals-scored-away": buildLeaderboard(teams, (t) => t.away, scoredOf),
    "goals-conceded-home": buildLeaderboard(teams, (t) => t.home, concededOf),
    "goals-conceded-away": buildLeaderboard(teams, (t) => t.away, concededOf),
    "goals-avg-home": buildLeaderboard(teams, (t) => t.home, avgGoalsOf),
    "goals-avg-away": buildLeaderboard(teams, (t) => t.away, avgGoalsOf),
  };

  const data: LeagueDerivedData = { teams: teamsOut, rankings, partial };
  standingsCache.set(leagueId, { at: Date.now(), data });
  return data;
}

/** Rattache bilan Domicile/Extérieur + métriques + leaderboards au match (best-effort). */
function attachDerivedData(data: LeagueDerivedData | null, fm: FootballMatch): void {
  if (!data) return;
  const key = normTeamKey;
  const home = data.teams.get(key(fm.home.name));
  const away = data.teams.get(key(fm.away.name));
  if (!home || !away) return;
  fm.prediction = {
    ...fm.prediction,
    standingStats: { home: home.standing.home, away: away.standing.away },
    metricStats: { home: home.stats.home, away: away.stats.away, partial: data.partial },
    metricRankings: data.rankings,
  };
}


// ── Méta d'un événement BSD (noms, date, ligue) — pour résolution ESPN ─────
export interface BSDFootballMatchMeta {
  id: number;
  homeTeam: string;
  awayTeam: string;
  leagueId: number | null;
  leagueName: string;
  date: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  currentMinute?: number;
  isLive: boolean;
}

/** Récupération défensive `/v2/events/{id}/` → meta légère (jamais de throw). */
export async function fetchBSDFootballMatchMeta(matchId: string): Promise<BSDFootballMatchMeta | null> {
  if (!/^\d+$/.test(String(matchId))) return null;
  try {
    const m = await bsdFetchRaw<BSDFootballMatch>(`/v2/events/${matchId}/`);
    if (!m || !m.league) return null;
    const status = String(m.status || "");
    const isLive = !["finished", "notstarted", "canceled", "postponed", "suspended"].includes(status);
    return {
      id: m.id,
      homeTeam: m.home_team ?? "",
      awayTeam: m.away_team ?? "",
      leagueId: typeof m.league?.id === "number" ? m.league.id : null,
      leagueName: m.league?.name ?? "",
      date: m.event_date ?? new Date().toISOString(),
      status,
      homeScore: m.home_score,
      awayScore: m.away_score,
      currentMinute: m.current_minute,
      isLive,
    };
  } catch {
    return null;
  }
}

export async function fetchBSDFootballLive(): Promise<FootballMatch[]> {

  const matches = await bsdFetch<BSDFootballMatch[]>("/live/?limit=50");
  const result = matches.map(buildMatch);
  console.log(`[bsd-foot] Fetched ${result.length} live matches`);
  return result;
}
