import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import type {
  LocationFilter,
  TeamStanding,
  TeamStandingStats,
  MarketTops,
  MarketTopEntry,
} from "@/lib/league-stats";

// ── Helpers ──

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
}

// ── Types internes ──

type TeamMatch = {
  date: string;
  goalsFor: number;
  goalsAgainst: number;
  xgFor: number;
  xgAgainst: number;
  isWin: boolean;
  isDraw: boolean;
  isLoss: boolean;
};

type TeamAccumulator = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
  matches: TeamMatch[];
};


// ── Agrégation par équipe ──

function aggregateTeam(acc: TeamAccumulator): TeamStandingStats {
  const m = acc.matches;
  const played = m.length;
  const wins = m.filter((x) => x.isWin).length;
  const draws = m.filter((x) => x.isDraw).length;
  const losses = m.filter((x) => x.isLoss).length;
  const goalsFor = m.reduce((s, x) => s + x.goalsFor, 0);
  const goalsAgainst = m.reduce((s, x) => s + x.goalsAgainst, 0);
  const points = wins * 3 + draws;
  const xG = safeDiv(m.reduce((s, x) => s + x.xgFor, 0), played);
  const xGA = safeDiv(m.reduce((s, x) => s + x.xgAgainst, 0), played);
  const xGD = xG - xGA;

  const over15Pct = pct(m.filter((x) => x.goalsFor + x.goalsAgainst > 1.5).length, played);
  const under35Pct = pct(m.filter((x) => x.goalsFor + x.goalsAgainst < 3.5).length, played);
  const bttsYesPct = pct(m.filter((x) => x.goalsFor > 0 && x.goalsAgainst > 0).length, played);

  const sorted = [...m].sort((a, b) => b.date.localeCompare(a.date));
  const l5 = sorted.slice(0, 5);
  const l10 = sorted.slice(0, 10);
  const ovL5 = pct(l5.filter((x) => x.goalsFor + x.goalsAgainst > 1.5).length, l5.length);
  const ovL10 = pct(l10.filter((x) => x.goalsFor + x.goalsAgainst > 1.5).length, l10.length);
  const unL5 = pct(l5.filter((x) => x.goalsFor + x.goalsAgainst < 3.5).length, l5.length);
  const unL10 = pct(l10.filter((x) => x.goalsFor + x.goalsAgainst < 3.5).length, l10.length);
  const btL5 = pct(l5.filter((x) => x.goalsFor > 0 && x.goalsAgainst > 0).length, l5.length);
  const btL10 = pct(l10.filter((x) => x.goalsFor > 0 && x.goalsAgainst > 0).length, l10.length);

  return {
    played, wins, draws, losses,
    goalsFor, goalsAgainst, goalDiff: goalsFor - goalsAgainst,
    points, pointsPerGame: Math.round(safeDiv(points, played) * 100) / 100,
    xG: Math.round(xG * 100) / 100, xGA: Math.round(xGA * 100) / 100, xGD: Math.round(xGD * 100) / 100,
    over15Pct, over15PctL5: ovL5, over15PctL10: ovL10,
    under35Pct, under35PctL5: unL5, under35PctL10: unL10,
    bttsYesPct, bttsYesPctL5: btL5, bttsYesPctL10: btL10,
  };
}


// ── Tri classement: points → goalDiff → goalsFor ──

function sortStandings(teams: { acc: TeamAccumulator; stats: TeamStandingStats }[]): TeamStanding[] {
  const sorted = [...teams].sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    if (b.stats.goalDiff !== a.stats.goalDiff) return b.stats.goalDiff - a.stats.goalDiff;
    return b.stats.goalsFor - a.stats.goalsFor;
  });
  return sorted.map((t, i) => ({
    rank: i + 1,
    team: {
      id: t.acc.id,
      name: t.acc.name,
      shortName: t.acc.shortName,
      logo: t.acc.logo,
      color: t.acc.color,
    },
    stats: t.stats,
  }));
}

// ── Market Tops (top 5) ──

function computeMarketTops(standings: TeamStanding[]): MarketTops {
  const mkTop = (key: keyof TeamStandingStats, higherBetter: boolean): MarketTopEntry[] =>
    [...standings]
      .sort((a, b) => {
        const va = a.stats[key] as number;
        const vb = b.stats[key] as number;
        return higherBetter ? vb - va : va - vb;
      })
      .slice(0, 5)
      .map((s) => ({
        teamId: s.team.id,
        teamName: s.team.name,
        shortName: s.team.shortName,
        logo: s.team.logo,
        value: s.stats[key] as number,
      }));

  return {
    pointsPerGame: mkTop("pointsPerGame", true),
    over15Pct: mkTop("over15Pct", true),
    under35Pct: mkTop("under35Pct", true),
    bttsYesPct: mkTop("bttsYesPct", true),
    xG: mkTop("xG", true),
    xGA: mkTop("xGA", false),
  };
}


// ── Fonction principale ──

export function computeStandings(
  matches: BSDFootballMatch[],
  location: LocationFilter,
): { standings: TeamStanding[]; marketTops: MarketTops } {
  const finished = matches.filter((m) => m.home_score !== null && m.away_score !== null);
  const teamMap = new Map<number, TeamAccumulator>();

  for (const m of finished) {
    const hid = m.home_team_obj?.id;
    const aid = m.away_team_obj?.id;
    if (!hid || !aid) continue;
    const hxg = m.actual_home_xg ?? 0;
    const axg = m.actual_away_xg ?? 0;

    if (location === "all" || location === "home") {
      let t = teamMap.get(hid);
      if (!t) {
        t = { id: String(hid), name: m.home_team_obj?.name ?? m.home_team, shortName: m.home_team_obj?.short_name ?? m.home_team, logo: "", color: "#333", matches: [] };
        teamMap.set(hid, t);
      }
      t.matches.push({ date: m.event_date, goalsFor: m.home_score!, goalsAgainst: m.away_score!, xgFor: hxg, xgAgainst: axg, isWin: m.home_score! > m.away_score!, isDraw: m.home_score === m.away_score, isLoss: m.home_score! < m.away_score! });
    }

    if (location === "all" || location === "away") {
      let t = teamMap.get(aid);
      if (!t) {
        t = { id: String(aid), name: m.away_team_obj?.name ?? m.away_team, shortName: m.away_team_obj?.short_name ?? m.away_team, logo: "", color: "#333", matches: [] };
        teamMap.set(aid, t);
      }
      t.matches.push({ date: m.event_date, goalsFor: m.away_score!, goalsAgainst: m.home_score!, xgFor: axg, xgAgainst: hxg, isWin: m.away_score! > m.home_score!, isDraw: m.away_score === m.home_score, isLoss: m.away_score! < m.home_score! });
    }
  }

  const aggregated = Array.from(teamMap.values()).filter((t) => t.matches.length > 0).map((acc) => ({ acc, stats: aggregateTeam(acc) }));
  const standings = sortStandings(aggregated);
  const marketTops = computeMarketTops(standings);
  return { standings, marketTops };
}
