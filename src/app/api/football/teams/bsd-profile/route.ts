import { NextResponse } from "next/server";
import { BSD_LEAGUE_IDS } from "@/lib/league-mapping";
import type { TeamProfile } from "@/lib/team-profile";

/**
 * GET /api/football/teams/bsd-profile?league=mls&team=Inter%20Miami&venue=home
 *
 * Fiche équipe depuis les données BSD (standings + stats).
 * Utilisé quand les données FD ne sont pas disponibles (MLS, Brasileirão, etc.)
 * Retourne un format compatible avec TeamProfile.
 */

type BsdStandingRow = {
  team: string;
  teamId: number;
  gp: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  ppg: number;
};

// Cache des standings BSD par ligue (5 min)
const standingsCache = new Map<string, { at: number; data: BsdStandingRow[] | null }>();
const CACHE_TTL = 5 * 60_000;

async function fetchBsdStandings(leagueId: number): Promise<BsdStandingRow[] | null> {
  const cached = standingsCache.get(String(leagueId));
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const key = process.env.BSD_API_KEY;
  if (!key) return null;

  try {
    // 1. Récupérer la saison courante
    const seasonRes = await fetch(
      `https://sports.bzzoiro.com/api/v2/leagues/${leagueId}/season/`,
      { headers: { Authorization: `Token ${key}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!seasonRes.ok) return null;
    const seasonData = await seasonRes.json();
    const seasonId = seasonData?.season?.id;
    if (!seasonId) return null;

    // 2. Récupérer les standings
    const standRes = await fetch(
      `https://sports.bzzoiro.com/api/v2/leagues/${leagueId}/standings/?season_id=${seasonId}`,
      { headers: { Authorization: `Token ${key}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!standRes.ok) return null;
    const standData = await standRes.json();
    const rows: BsdStandingRow[] = (standData?.standings ?? []).map((r: any) => ({
      team: r.team_name ?? r.team ?? "",
      teamId: r.team_id ?? 0,
      gp: r.played ?? (r.won ?? 0) + (r.drawn ?? 0) + (r.lost ?? 0),
      wins: r.won ?? 0,
      draws: r.drawn ?? 0,
      losses: r.lost ?? 0,
      gf: r.goals_for ?? r.gf ?? 0,
      ga: r.goals_against ?? r.ga ?? 0,
      gd: r.goal_difference ?? r.gd ?? 0,
      points: r.points ?? r.pts ?? 0,
      ppg: r.ppm ?? ((r.played ?? 0) > 0 ? (r.points ?? 0) / r.played : 0),
    }));

    standingsCache.set(String(leagueId), { at: Date.now(), data: rows });
    return rows;
  } catch {
    standingsCache.set(String(leagueId), { at: Date.now(), data: null });
    return null;
  }
}

function normTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function resolveTeam(rows: BsdStandingRow[], teamName: string): BsdStandingRow | null {
  const key = normTeam(teamName);
  // Exact match
  const exact = rows.find((r) => normTeam(r.team) === key);
  if (exact) return exact;
  // Partial match
  const partial = rows.find(
    (r) => normTeam(r.team).includes(key) || key.includes(normTeam(r.team))
  );
  return partial ?? null;
}

function computeScore(value: number, allValues: number[], higherBetter: boolean): number {
  const sorted = [...allValues].sort((a, b) => higherBetter ? b - a : a - b);
  const idx = sorted.indexOf(value);
  if (idx < 0) return 50;
  return Math.round(100 - (idx / Math.max(1, sorted.length - 1)) * 100);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league");
  const team = url.searchParams.get("team");
  const venue = url.searchParams.get("venue") ?? "overall";

  if (!league || !team) {
    return NextResponse.json({ error: "league et team requis" }, { status: 400 });
  }

  const bsdId = BSD_LEAGUE_IDS[league as keyof typeof BSD_LEAGUE_IDS];
  if (!bsdId) {
    return NextResponse.json({ error: "ligue non supportée" }, { status: 404 });
  }

  const rows = await fetchBsdStandings(bsdId);
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "standings indisponibles" }, { status: 404 });
  }

  const resolved = resolveTeam(rows, team);
  if (!resolved) {
    return NextResponse.json({ error: "équipe introuvable" }, { status: 404 });
  }

  // Rangs
  const sortedByPoints = [...rows].sort((a, b) => b.points - a.points || b.gd - a.gd);
  const overallRank = sortedByPoints.findIndex((r) => normTeam(r.team) === normTeam(resolved.team)) + 1;

  // Stats offensives/défensives
  const gfValues = rows.map((r) => r.gp > 0 ? r.gf / r.gp : 0);
  const gaValues = rows.map((r) => r.gp > 0 ? r.ga / r.gp : 0);
  const gfPg = resolved.gp > 0 ? resolved.gf / resolved.gp : 0;
  const gaPg = resolved.gp > 0 ? resolved.ga / resolved.gp : 0;

  const attackScore = computeScore(gfPg, gfValues, true);
  const defenseScore = computeScore(gaPg, gaValues, false);
  const attackRank = gfValues.filter((v) => v > gfPg).length + 1;
  const defenseRank = gaValues.filter((v) => v < gaPg).length + 1;

  // Forces/faiblesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (attackRank <= 3) strengths.push(`Attaque top ${attackRank} (${gfPg.toFixed(1)} buts/m)`);
  if (defenseRank <= 3) strengths.push(`Défense top ${defenseRank} (${gaPg.toFixed(1)} encaissés/m)`);
  if (overallRank <= 3) strengths.push(`#${overallRank} au classement général`);

  if (attackRank >= rows.length - 2) weaknesses.push(`Attaque faible (#${attackRank}/${rows.length})`);
  if (defenseRank >= rows.length - 2) weaknesses.push(`Défense faible (#${defenseRank}/${rows.length})`);
  if (overallRank >= rows.length - 2) weaknesses.push(`#${overallRank} au classement`);

  // Construire le profil compatible TeamProfile
  const standingRow = {
    team: resolved.team,
    gp: resolved.gp,
    wins: resolved.wins,
    draws: resolved.draws,
    losses: resolved.losses,
    points: resolved.points,
    gf: resolved.gf,
    ga: resolved.ga,
    gd: resolved.gd,
    ppg: resolved.ppg,
    gfPg,
    gaPg,
    rank: overallRank,
    rankTotal: rows.length,
  };

  const profile: TeamProfile = {
    team: resolved.team,
    leagueId: league,
    venue: venue as any,
    season: "2026",
    standing: standingRow,
    overall: standingRow,
    attack: {
      score: attackScore,
      rank: attackRank,
      rankTotal: rows.length,
      metrics: [
        { key: "gfPg", label: "Buts marqués/match", score: attackScore, display: `${gfPg.toFixed(2).replace(".", ",")}/m`, rank: attackRank },
        { key: "o15", label: "Over 1,5 buts", score: 50, display: "—", rank: null },
        { key: "btts", label: "Les 2 marquent", score: 50, display: "—", rank: null },
      ],
    },
    defense: {
      score: defenseScore,
      rank: defenseRank,
      rankTotal: rows.length,
      metrics: [
        { key: "gaPg", label: "Buts encaissés/match", score: defenseScore, display: `${gaPg.toFixed(2).replace(".", ",")}/m`, rank: defenseRank },
        { key: "u35", label: "Under 3,5 buts", score: 50, display: "—", rank: null },
      ],
    },
    strengths,
    weaknesses,
    elo: null,
    sos: null,
    xgDiff: null,
    reversion: null,
    value: null,
    alerts: [],
    discipline: null,
    congestion: { restDays: null, next14d: 0, congested: false },
    clv: null,
    referee: null,
    ppmAjuste: resolved.ppg,
    injuries: null,
    injuriesCovered: false,
  };

  return NextResponse.json({ profile, meta: { source: "bsd", computedAt: new Date().toISOString() } });
}

