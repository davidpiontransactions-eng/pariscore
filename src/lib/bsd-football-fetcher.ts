import type { FootballMatch, League, Team, Prediction, FootballMatchOdds, FootballLiveState } from "@/lib/football-data";

const BSD_BASE = "https://sports.bzzoiro.com/football";

type BSDFootballResponse = {
  id: string;
  home_team?: { name: string; id?: string };
  away_team?: { name: string; id?: string };
  league?: { name?: string; id?: string; country?: string };
  status?: string;
  start_time?: string;
  commence_time?: string;
  round?: string;
  venue?: string;
  home_score?: number;
  away_score?: number;
  minute?: number;
  odds?: Array<{
    bookmaker: string;
    home_odds: number;
    draw_odds: number;
    away_odds: number;
  }>;
  stats?: {
    home_possession?: number;
    home_shots?: number;
    away_shots?: number;
    home_shots_on_target?: number;
    away_shots_on_target?: number;
    home_corners?: number;
    away_corners?: number;
  };
};

function bsdBaseUrl(): string {
  return process.env.BSD_FOOTBALL_BASE || BSD_BASE;
}

async function bsdFetch(endpoint: string): Promise<BSDFootballResponse[]> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured for football");

  const url = `${bsdBaseUrl()}${endpoint}`;
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

  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? []);
}

function mapLeague(b?: BSDFootballResponse["league"]): League {
  const name = b?.name ?? "Unknown";
  return {
    id: b?.id ?? name.toLowerCase().replace(/\s+/g, "-"),
    name,
    country: b?.country ?? "",
    logo: "",
    tier: "T1",
  };
}

function generateColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ["#004170", "#EF0107", "#FEBE10", "#DC052D", "#010E80", "#2FAEE0", "#E63E32", "#1D2C6B", "#6CABDD", "#034694"];
  return colors[Math.abs(hash) % colors.length];
}

function mapTeam(name: string, side: "home" | "away"): Team {
  const short = name.split(" ").pop()?.toUpperCase() ?? name.toUpperCase();
  return {
    id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    shortName: short,
    logo: "",
    color: generateColor(name),
    form: ["W", "D", "W", "L", "W"],
    rank: 0,
  };
}

function mapPrediction(): Prediction {
  return {
    homeProb: 50, drawProb: 25, awayProb: 25,
    bttsProb: 55, over25Prob: 60,
    model: "Elo+Poisson",
  };
}

function mapOdds(o?: BSDFootballResponse["odds"]): FootballMatchOdds[] | undefined {
  if (!o || o.length === 0) return undefined;
  return o.map((bm) => {
    const invH = 1 / bm.home_odds;
    const invD = 1 / bm.draw_odds;
    const invA = 1 / bm.away_odds;
    const vig = invH + invD + invA;
    return {
      bookmaker: bm.bookmaker,
      home: bm.home_odds,
      draw: bm.draw_odds,
      away: bm.away_odds,
      impliedHome: Math.round((invH / vig) * 100),
      impliedDraw: Math.round((invD / vig) * 100),
      impliedAway: Math.round((invA / vig) * 100),
      margin: Math.round((vig - 1) * 1000) / 1000,
    };
  });
}

function buildMatch(b: BSDFootballResponse, index: number): FootballMatch {
  const home = mapTeam(b.home_team?.name ?? "Home", "home");
  const away = mapTeam(b.away_team?.name ?? "Away", "away");
  const allOdds = mapOdds(b.odds);

  let live: FootballLiveState | null = null;
  const isLive = b.status === "LIVE" || b.status === "1H" || b.status === "2H" || b.status === "HT";
  if (isLive) {
    live = {
      homeScore: b.home_score ?? 0,
      awayScore: b.away_score ?? 0,
      minute: b.minute ?? 0,
      status: (b.status === "HT" ? "HT" : "LIVE") as "LIVE" | "HT",
      homePossession: b.stats?.home_possession ?? 50,
      homeShots: b.stats?.home_shots ?? 0,
      awayShots: b.stats?.away_shots ?? 0,
      homeShotsOnTarget: b.stats?.home_shots_on_target ?? 0,
      awayShotsOnTarget: b.stats?.away_shots_on_target ?? 0,
      homeCorners: b.stats?.home_corners ?? 0,
      awayCorners: b.stats?.away_corners ?? 0,
    };
  }

  return {
    id: `bsd-${b.id ?? index}`,
    league: mapLeague(b.league),
    round: b.round ?? "Match",
    scheduledAt: b.start_time ?? b.commence_time ?? new Date().toISOString(),
    home,
    away,
    prediction: mapPrediction(),
    allOdds,
    odds: allOdds?.[0]
      ? { bookmaker: allOdds[0].bookmaker, home: allOdds[0].home, draw: allOdds[0].draw, away: allOdds[0].away }
      : undefined,
    live,
  };
}

export async function fetchBSDFootballPrematch(): Promise<FootballMatch[]> {
  const matches = await bsdFetch("/api/v2/matches/?status=scheduled&limit=100");

  const footballMatches: FootballMatch[] = [];
  for (let i = 0; i < matches.length && footballMatches.length < 50; i++) {
    const m = buildMatch(matches[i], i);
    footballMatches.push(m);
  }

  if (footballMatches.length === 0) {
    throw new Error("BSD returned no valid football matches");
  }

  console.log(`[bsd-foot] Fetched ${footballMatches.length} prematch matches`);
  return footballMatches;
}

export async function fetchBSDFootballLive(): Promise<FootballMatch[]> {
  const matches = await bsdFetch("/api/v2/matches/?status=live&limit=50");

  const footballMatches: FootballMatch[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = buildMatch(matches[i], i);
    footballMatches.push(m);
  }

  console.log(`[bsd-foot] Fetched ${footballMatches.length} live matches`);
  return footballMatches;
}
