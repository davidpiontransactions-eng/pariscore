// BBC Sport US Open Fetcher — scrape matchs depuis la page scores-and-schedule
// Source: bbc.co.uk/sport/tennis/us-open/scores-and-schedule/{date}
// Pas de FlareSolverr nécessaire (BBC = IP datacenter friendly)
//
// Avantages vs usopen.org JSON:
//   - Men ET Women dans la même page
//   - Status live/completed/scheduled fiable
//   - Scores détaillés (sets)
//   - Dates flexibles (today, tomorrow, etc.)

import type { TennisMatch } from "@/lib/tennis-data";

const BBC_BASE = "https://www.bbc.co.uk/sport/tennis/us-open/scores-and-schedule";

function dateSlug(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/* ─── Parse BBC HTML → matchs structurés ─── */

interface RawMatch {
  gender: "men" | "women";
  round: string;
  playerA: string;
  playerB: string;
  seedA?: number;
  seedB?: number;
  status: "live" | "scheduled" | "finished";
  score?: string;
  court?: string;
  estimatedTime?: string;
}

function parseBBCSchedule(html: string): RawMatch[] {
  const matches: RawMatch[] = [];

  // BBC structure: each match block has "Men's Singles - Round of X" or "Women's Singles - Round of X"
  // followed by player names with seeds and scores

  // Split by match sections — look for the pattern "Singles - Round"
  const sections = html.split(/(?=(?:Men's|Women's)\s+Singles\s*-\s*)/i);

  for (const section of sections) {
    // Extract gender and round
    const headerMatch = section.match(/(Men's|Women's)\s+Singles\s*-\s*(Round of \d+|Quarter-Finals|Semi-Finals|Final)/i);
    if (!headerMatch) continue;

    const gender = headerMatch[1].toLowerCase().includes("men") ? "men" : "women";
    const round = headerMatch[2];

    // Extract court
    const courtMatch = section.match(/Arthur Ashe Stadium|Louis Armstrong Stadium|Grandstand|Stadium \d+|Court \d+/i);
    const court = courtMatch ? courtMatch[0] : undefined;

    // Extract player names with seeds
    // Pattern: "FirstName LastName (Country) (Seed ranking N)" or just "FirstName LastName (Country)"
    const playerBlocks = section.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*\([^)]*\)\s*(?:\(Seed ranking (\d+)\))?/g) || [];

    if (playerBlocks.length < 2 || !playerBlocks[0] || !playerBlocks[1]) continue;

    const extractPlayer = (block: string) => {
      const nameMatch = block.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/);
      const seedMatch = block.match(/Seed ranking (\d+)/);
      return {
        name: nameMatch ? nameMatch[1] : block.split("(")[0].trim(),
        seed: seedMatch ? parseInt(seedMatch[1]) : undefined,
      };
    };

    const pA = extractPlayer(playerBlocks[0]);
    const pB = extractPlayer(playerBlocks[1]);

    // Determine status
    let status: "live" | "scheduled" | "finished" = "scheduled";
    if (section.includes("beat ") || section.match(/Result/)) {
      status = "finished";
    } else if (section.includes("Live") || section.includes("in progress")) {
      status = "live";
    }

    // Extract score (Set 1: X - Y, Set 2: X - Y, ...)
    const scoreMatches = section.match(/Set \d+:\s*(\d+)\s*-\s*(\d+)/g) || [];
    let score: string | undefined;
    if (scoreMatches.length >= 2) {
      const sets = scoreMatches.map(s => {
        const m = s.match(/(\d+)\s*-\s*(\d+)/);
        return m ? `${m[1]}-${m[2]}` : "";
      }).filter(Boolean);
      score = sets.join(", ");
    }

    // Estimated time
    const timeMatch = section.match(/Estimated (\d+:\d+)/);
    const estimatedTime = timeMatch ? timeMatch[1] : undefined;

    matches.push({
      gender,
      round,
      playerA: pA.name,
      playerB: pB.name,
      seedA: pA.seed,
      seedB: pB.seed,
      status,
      score,
      court,
      estimatedTime,
    });
  }

  return matches;
}

/* ─── Normalisation → TennisMatch ─── */

function toTennisMatch(m: RawMatch, date: string): TennisMatch {
  const time = m.estimatedTime || "12:00";
  const scheduledAt = `${date}T${time}:00Z`;
  const gender = m.gender === "men" ? "M" : "F";

  const mkPlayer = (name: string, seed?: number) => ({
    id: `bbc-${name.toLowerCase().replace(/\s/g, "-")}`,
    name,
    shortName: name.split(" ").pop() || name,
    rank: seed || 0,
    elo: 1500,
    photoUrl: "",
    color: "#333",
    form: [] as ("W" | "L")[],
    country: "",
    gender,
  });

  return {
    id: `bbc-usopen-${m.gender}-${m.playerA.replace(/\s/g, "-")}-${m.playerB.replace(/\s/g, "-")}`,
    playerA: mkPlayer(m.playerA, m.seedA),
    playerB: mkPlayer(m.playerB, m.seedB),
    tournament: "US Open",
    tournamentCategory: "Grand Chelem",
    surface: "Dur",
    scheduledAt,
    status: m.status === "finished" ? "finished" : m.status === "live" ? "live" : "scheduled",
    court: m.court,
    round: m.round,
    odds: undefined,
    stats: undefined as any,
    probA: 50,
    probB: 50,
    model: "bbc-usopen",
    modelUpdatedAt: new Date().toISOString(),
  } as unknown as TennisMatch;
}

/* ─── Fetch public ─── */

export async function fetchBBCUsOpenMatches(date?: Date): Promise<TennisMatch[]> {
  const targetDate = date || new Date();
  const slug = dateSlug(targetDate);
  const url = `${BBC_BASE}/${slug}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[bbc-usopen] HTTP ${res.status} for ${slug}`);
      return [];
    }

    const html = await res.text();
    const raw = parseBBCSchedule(html);
    const matches = raw.map(m => toTennisMatch(m, slug));

    console.log(`[bbc-usopen] ${slug}: ${matches.length} matches (${raw.filter(m => m.gender === "men").length} men, ${raw.filter(m => m.gender === "women").length} women)`);
    return matches;
  } catch (err) {
    console.error(`[bbc-usopen] Error:`, (err as Error).message);
    return [];
  }
}

/**
 * Fetch US Open matches for today AND tomorrow (pour le widget top matchs).
 */
export async function fetchBBCUsOpenTodayAndTomorrow(): Promise<TennisMatch[]> {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);

  const [todayMatches, tomorrowMatches] = await Promise.all([
    fetchBBCUsOpenMatches(today),
    fetchBBCUsOpenMatches(tomorrow),
  ]);

  return [...todayMatches, ...tomorrowMatches];
}
