import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Mapping PariScore slug → fichier JSON soccerstats
const SLUG_TO_FILE: Record<string, string> = {
  epl: "england",
  laliga: "spain",
  bundesliga: "germany",
  seriea: "italy",
  ligue1: "france",
  "ligue-1": "france",
  championship: "england2",
  laliga2: "spain2",
  "la-liga-2": "spain2",
  ligue2: "france2",
  "ligue-2": "france2",
  bundesliga2: "germany2",
  "2-bundesliga": "germany2",
  eredivisie: "netherlands",
  primeira_liga: "portugal",
  "primeira-liga": "portugal",
  super_lig: "turkey",
  "super-lig": "turkey",
  scot_prem: "scotland",
  premiership: "scotland",
  saudi_pro_league: "saudiarabia",
  "saudi-pro-league": "saudiarabia",
  j1_league: "japan",
  "j1-league": "japan",
  k_league1: "southkorea",
  "k-league-1": "southkorea",
  mls: "usa",
  liga_mx: "mexico",
  "liga-mx": "mexico",
  brasileirao_a: "brazil",
  "brasileirao-serie-a": "brazil",
};

type TeamCS = {
  team: string;
  csPct: number;
  gp: number;
  bttsPct: number | null;
  over25Pct: number | null;
};

type MetricsFile = {
  meta?: { teamCount?: number };
  teams: Array<{
    teamName: string;
    gp: number;
    goals?: {
      csPct?: number;
      bttsPct?: number;
      over25Pct?: number;
    };
  }>;
};

// GET /api/v1/leagues-stats/[country]/[slug]/clean-sheets
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ country: string; slug: string }> },
) {
  const { slug } = await params;
  const fileName = SLUG_TO_FILE[slug];
  if (!fileName) {
    return NextResponse.json(
      { error: "Ligue non supportée pour clean sheets" },
      { status: 404 },
    );
  }

  const filePath = path.join(process.cwd(), "public", "data", "metrics", `${fileName}.json`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Fichier metrics non trouvé" },
      { status: 404 },
    );
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data: MetricsFile = JSON.parse(raw);

    const teams: TeamCS[] = data.teams
      .filter((t) => t.goals?.csPct != null)
      .map((t) => ({
        team: t.teamName,
        csPct: t.goals!.csPct!,
        gp: t.gp,
        bttsPct: t.goals?.bttsPct ?? null,
        over25Pct: t.goals?.over25Pct ?? null,
      }))
      .sort((a, b) => b.csPct - a.csPct);

    return NextResponse.json(
      { teams, total: teams.length, league: fileName },
      { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Erreur lecture fichier metrics" },
      { status: 500 },
    );
  }
}
