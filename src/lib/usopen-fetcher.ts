// US Open Schedule Fetcher — JSON feeds officiels via FlareSolverr
// Source: usopen.org/en_US/scores/feeds/{year}/draws/{DRAW_CODE}.json
// Remplace l'ancien scraper HTML (non fiable, WAF Akamai)
//
// Draws: MS (Men's Singles), LS (Ladies' Singles), MD, LD, XD
// Pas de clé API — accès libre (mais VPS datacenter → FlareSolverr requis)

const FLARE_URL = process.env.FLARESOLVERR_URL || "http://127.0.0.1:8191/v1";

function getDrawUrl(year: number, drawCode: string): string {
  return `https://www.usopen.org/en_US/scores/feeds/${year}/draws/${drawCode}.json`;
}

/* ─── Types US Open JSON ─── */

type UsOpenStatusCode = "D" | "O" | "I" | "P" | "U" | "C";
// D = Completed, O = In Progress, I = In Progress (alternate), P = Pending/Upcoming, U = Unscheduled, C = Cancelled

interface UsOpenTeam {
  firstNameA: string | null;
  lastNameA: string | null;
  displayNameA: string | null;
  idA: string | null;
  nationA: string | null;
  firstNameB: string | null;
  lastNameB: string | null;
  displayNameB: string | null;
  idB: string | null;
  nationB: string | null;
  seed: number | null;
  entryStatus: string | null;
  totalSetsWon: number;
  won: boolean;
  serve: boolean;
}

interface UsOpenMatch {
  match_id: string;
  eventName: string;
  shortEventName: string;
  eventCode: string;
  courtName: string;
  shortCourtName: string;
  courtId: string;
  roundCode: string;
  roundName: string;
  roundNameShort: string;
  eventDay: number;
  duration: string | null;
  statsLevel: string;
  status: string;
  statusCode: UsOpenStatusCode;
  winner: string | null;
  epoch: number;
  team1: UsOpenTeam;
  team2: UsOpenTeam;
}

interface UsOpenDrawResponse {
  eventName: string;
  drawSize: string;
  drawFormat: string;
  totalRounds: number;
  prizeMoney: unknown[];
  matches: UsOpenMatch[];
}

/* ─── Normalisation → TopMatch ─── */

function mapStatus(code: UsOpenStatusCode): "live" | "scheduled" | "finished" {
  switch (code) {
    case "D":
    case "C":
      return "finished";
    case "O":
    case "I":
      return "live";
    default:
      return "scheduled";
  }
}

function mapRound(code: string, name: string): string {
  const roundMap: Record<string, string> = {
    "1": "R1",
    "2": "R2",
    "3": "R3",
    "4": "R4",
    Q: "Quarter-Finals",
    S: "Semi-Finals",
    F: "Final",
  };
  return roundMap[code] || name;
}

interface NormalizedMatch {
  id: string;
  playerA: string;
  playerB: string;
  scheduledAt: string;
  status: "live" | "scheduled" | "finished";
  tournament: string;
  round: string;
  court?: string;
  gender?: "men" | "women";
  score?: string;
  seedA?: number;
  seedB?: number;
  winnerA?: boolean;
  winnerB?: boolean;
}

function normalizeMatch(m: UsOpenMatch, gender: "men" | "women"): NormalizedMatch | null {
  const pA =
    m.team1.displayNameA ||
    (m.team1.firstNameA && m.team1.lastNameA ? `${m.team1.firstNameA} ${m.team1.lastNameA}` : null);
  const pB =
    m.team2.displayNameA ||
    (m.team2.firstNameA && m.team2.lastNameA ? `${m.team2.firstNameA} ${m.team2.lastNameA}` : null);

  if (!pA || !pB) return null;

  // Epoch → ISO (epoch est en ms)
  const scheduledAt = m.epoch > 0 ? new Date(m.epoch).toISOString() : new Date().toISOString();

  // Score from sets
  const score =
    m.team1.totalSetsWon != null && m.team2.totalSetsWon != null
      ? `${m.team1.totalSetsWon}-${m.team2.totalSetsWon}`
      : undefined;

  return {
    id: `usopen-${m.match_id}`,
    playerA: pA,
    playerB: pB,
    scheduledAt,
    status: mapStatus(m.statusCode),
    tournament: "US Open",
    round: mapRound(m.roundCode, m.roundName),
    court: m.shortCourtName || m.courtName || undefined,
    gender,
    score,
    seedA: m.team1.seed ?? undefined,
    seedB: m.team2.seed ?? undefined,
    winnerA: m.winner === "1" || m.team1.won,
    winnerB: m.winner === "2" || m.team2.won,
  };
}

/* ─── FlareSolverr fetch ─── */

async function flareGet(url: string): Promise<string> {
  const res = await fetch(FLARE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd: "request.get", url, maxTimeout: 30000 }),
    signal: AbortSignal.timeout(40000),
  });
  const json = (await res.json()) as { status: string; message?: string; solution?: { response?: string } };
  if (json.status !== "ok") throw new Error(`FlareSolverr: ${json.message || json.status}`);
  return json.solution?.response || "";
}

/* ─── Fetch draws ─── */

async function fetchDraw(year: number, drawCode: string, gender: "men" | "women"): Promise<NormalizedMatch[]> {
  const url = getDrawUrl(year, drawCode);
  try {
    const raw = await flareGet(url);
    // FlareSolverr retourne le JSON dans un <pre> — extraire le JSON brut
    const jsonMatch = raw.match(/\{[\s\S]*"matches"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (!jsonMatch) {
      console.log(`[usopen] No JSON found for ${drawCode}`);
      return [];
    }
    const data: UsOpenDrawResponse = JSON.parse(jsonMatch[0]);
    const matches = (data.matches || [])
      .map((m) => normalizeMatch(m, gender))
      .filter((m): m is NormalizedMatch => m !== null);
    console.log(`[usopen] ${drawCode}: ${matches.length} matches`);
    return matches;
  } catch (err) {
    console.error(`[usopen] Draw ${drawCode} failed:`, (err as Error).message);
    return [];
  }
}

/* ─── Export principal ─── */

export async function fetchUsOpenMatches(): Promise<NormalizedMatch[]> {
  const year = new Date().getFullYear();
  // Pendant l'US Open (fin août → début sept), fetch MS + LS
  // En dehors, retourne vide (pas de données)
  const [menMatches, womenMatches] = await Promise.all([
    fetchDraw(year, "MS", "men"),
    fetchDraw(year, "LS", "women"),
  ]);
  return [...menMatches, ...womenMatches];
}

export async function fetchUsOpenTodayMatches(): Promise<NormalizedMatch[]> {
  const allMatches = await fetchUsOpenMatches();
  if (allMatches.length === 0) return [];

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Filtrer matchs d'aujourd'hui OU live/à venir
  const todayMatches = allMatches.filter((m) => {
    if (m.status === "live") return true;
    const matchDate = new Date(m.scheduledAt).toISOString().split("T")[0];
    return matchDate === today;
  });

  if (todayMatches.length === 0) {
    console.log(`[usopen] No matches for today (${today}), returning all (${allMatches.length})`);
    return allMatches;
  }

  console.log(`[usopen] Found ${todayMatches.length} matches for ${today}`);
  return todayMatches;
}
