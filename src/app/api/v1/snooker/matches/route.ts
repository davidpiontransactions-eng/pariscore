import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fetchPlayerPhoto } from "@/lib/snooker/player-photos";

export const runtime = "nodejs";

/**
 * /api/v1/snooker/matches
 *
 * Sert les matchs snooker scrapés depuis FlashScore.
 * Fichier source : data/odds_flashscore_snooker.json (généré par scripts/scrape_flashscore_snooker.mjs)
 *
 * Query params:
 *   ?live=1        — filtre uniquement les matchs live/en cours
 *   ?tournament=X  — filtre par nom de tournoi
 *   ?limit=N       — limite le nombre de résultats
 */

type FlashScoreMatch = {
  id: string;
  tournament: string;
  home: string;
  away: string;
  scoreHome: string;
  scoreAway: string;
  time: string;
  stage: string;
  isLive: boolean;
  odds?: { home: number; draw?: number | null; away: number; bookmaker?: string };
  detailedOdds?: Array<{ bookmaker: string; home: number; draw?: number | null; away: number }>;
};

type FlashScoreFile = {
  scraped_at: string;
  sport: string;
  source: string;
  matches_count: number;
  with_odds: number;
  live_count: number;
  tournaments: string[];
  matches: FlashScoreMatch[];
};

type SnookerMatch = {
  id: string;
  source: string;
  tournament: string;
  league_id: string;
  player1: string;
  player2: string;
  player1PhotoUrl?: string;
  player2PhotoUrl?: string;
  scheduled_at: string | null;
  /** Normalisé : "scheduled" | "live" | "finished" (consommé par les composants UI). */
  status: "scheduled" | "live" | "finished";
  /** Frames remportées par chaque joueur (source FlashScore). */
  scoreA: number;
  scoreB: number;
  /** Best-of de la série (défaut snooker = 9). */
  bestOf: number;
  odds?: { player1: number; player2: number };
  handicap?: { line: unknown; odds_p1: unknown; odds_p2: unknown };
  total?: { line: unknown; over_odds: unknown; under_odds: unknown };
};

/** Parse un score frames "6-2" en entier, ou 0 si absent/invalide. */
function parseFrames(raw: string | undefined): number {
  if (!raw || raw === "-" || raw === "") return 0;
  const n = parseInt(raw.split("-")[0] ?? "", 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

const DATA_FILE = join(process.cwd(), "data", "odds_flashscore_snooker.json");

// ─── Mapping FlashScore → CueTracker ID pour photos Wikipedia ────────────
// FlashScore returns abbreviated names ("Selby M."). We map to CueTracker IDs.
const FS_TO_CUE_ID: Record<string, string> = {
  "osullivan r.": "ronnie-osullivan", "o'sullivan r.": "ronnie-osullivan",
  "trump j.": "judd-trump", "selby m.": "mark-selby",
  "robertson n.": "neil-robertson", "higgins j.": "john-higgins",
  "williams m.": "mark-williams", "murphy s.": "shaun-murphy",
  "wilson k.": "kyren-wilson", "ding j.": "ding-junhui",
  "allen m.": "mark-allen", "lisowski j.": "jack-lisowski",
  "hawkins b.": "barry-hawkins", "carter a.": "ali-carter",
  "bingham s.": "stuart-bingham", "maguire s.": "stephen-maguire",
  "zhou y.": "zhou-yuelong", "page j.": "jackson-page",
  "saengkham n.": "noppon-saengkham", "pang j.": "pang-junxu",
  "xiao g.": "xiao-guodong", "wu y.": "wu-yize",
  "gilbert d.": "david-gilbert", "jones j.": "jamie-jones",
  "ford t.": "tom-ford", "wilson g.": "gary-wilson",
  "yuan s.": "yuan-sijun", "dale d.": "dominic-dale",
  "dott g.": "graeme-dott", "holt m.": "michael-holt",
  "gould m.": "martin-gould", "perry j.": "joe-perry",
  "un-nooh t.": "thepchaiya-un-nooh", "vafaei h.": "hussain-vafaei",
  "wakelin c.": "chris-wakelin", "white j.": "jimmy-white",
  "milkins r.": "rob-milkins", "burden a.": "alfie-burden",
  "higginson a.": "andrew-higginson", "carty a.": "ashley-carty",
  "wells d.": "daniel-wells", "slessor e.": "elliott-slessor",
  "odonnell m.": "martin-odonnell", "carrington s.": "stuart-carrington",
  "pinhey h.": "haydon-pinhey", "brown j.": "jordan-brown",
  "kowalski a.": "antoni-kowalski", "zizins a.": "artemijs-zizins",
  "lei p.": "julian-lei", "muir r.": "ross-muir",
  "xianbo w.": "wang-xinbo", "fan z.": "fan-zhengyi",
  "si x.": "si-xiaohan", "yang g.": "yu-yang",
  "lyu h.": "lyu-haotian", "clarke j.": "james-clarke",
  "hill a.": "aaron-hill", "davies l.": "liam-davies",
  "brown o.": "oliver-brown",
};

async function getPhotoForPlayer(name: string): Promise<string | undefined> {
  if (!name) return undefined;
  const key = name.toLowerCase().trim();
  // 1) Direct match FullScore format
  const cueId = FS_TO_CUE_ID[key];
  if (cueId) return await fetchPlayerPhoto(cueId);
  // 2) Lastname prefix: "Ding J." → cherche key commençant par "ding"
  const tokens = key.split(/\s+/).filter(Boolean);
  if (tokens.length >= 1) {
    const lastName = tokens[0].toLowerCase();
    const match = Object.entries(FS_TO_CUE_ID).find(([k]) => k.startsWith(lastName));
    if (match) return await fetchPlayerPhoto(match[1]);
  }
  return undefined;
}

function readData(): FlashScoreFile | null {
  try {
    if (!existsSync(DATA_FILE)) return null;
    const raw = readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as FlashScoreFile;
  } catch {
    return null;
  }
}

async function transformMatch(m: FlashScoreMatch, scrapedAt: string): Promise<SnookerMatch> {
  let scheduledAt: string | null = null;
  if (m.time && m.time !== "-" && m.time !== "") {
    const today = new Date(scrapedAt);
    const [hours, minutes] = m.time.split(":").map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      scheduledAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes).toISOString();
    }
  }

  let status: "scheduled" | "live" | "finished";
  if (m.isLive) {
    status = "live";
  } else if (m.scoreHome !== "-" && m.scoreAway !== "-" && m.scoreHome && m.scoreAway) {
    status = "finished";
  } else {
    status = "scheduled";
  }

  let odds: { player1: number; player2: number } | undefined;
  if (m.odds && m.odds.home && m.odds.away) {
    odds = { player1: m.odds.home, player2: m.odds.away };
  }

  return {
    id: m.id,
    source: "flashscore",
    tournament: m.tournament || "",
    league_id: "snooker",
    player1: m.home,
    player2: m.away,
    player1PhotoUrl: await getPhotoForPlayer(m.home),
    player2PhotoUrl: await getPhotoForPlayer(m.away),
    scheduled_at: scheduledAt,
    status,
    scoreA: parseFrames(m.scoreHome),
    scoreB: parseFrames(m.scoreAway),
    bestOf: 9,
    odds,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const liveOnly = searchParams.get("live") === "1";
  const tournament = searchParams.get("tournament");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

  const data = readData();

  if (!data) {
    return NextResponse.json(
      {
        matches: [],
        total: 0,
        scraped_at: null,
        tournaments: [],
        message:
          "Aucune donnée snooker disponible. Lancez le scraper : node scripts/scrape_flashscore_snooker.mjs",
      },
      { status: 200 },
    );
  }

  let matches = await Promise.all(data.matches.map((m) => transformMatch(m, data.scraped_at)));

  if (liveOnly) {
    matches = matches.filter((m) => m.status === "live");
  }

  if (tournament) {
    const q = tournament.toLowerCase();
    matches = matches.filter((m) => m.tournament.toLowerCase().includes(q));
  }

  matches = matches.slice(0, limit);

  return NextResponse.json({
    matches,
    total: matches.length,
    scraped_at: data.scraped_at,
    source: data.source,
    tournaments: data.tournaments,
    with_odds: data.with_odds,
  });
}