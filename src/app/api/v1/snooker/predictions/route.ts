import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { expectedScore, calculateEdge, kellyStake } from "../../../../../lib/snooker/elo";
import { fetchPlayerPhoto } from "@/lib/snooker/player-photos";

export const runtime = "nodejs";

/**
 * /api/v1/snooker/predictions
 *
 * Top-10 des meilleurs picks prédictifs sur les matchs snooker à venir
 * (source FlashScore), croisés avec les stats carrière CueTracker.
 *
 * Modèle v1 (heuristique, documenté) :
 *   - Force joueur = Elo proxy dérivé du % de victoires en carrière, rétréci
 *     vers 50 % pour les petits échantillons (shrinkage played/(played+20)),
 *     puis converti : 1 point de % victoires ≈ 12 points Elo.
 *   - Probabilité = logistique Elo standard (expectedScore, src/lib/snooker/elo.ts).
 *   - Pick retenu si probabilité favori >= 65 %.
 *   - Edge + Kelly calculés vs cotes FlashScore quand disponibles.
 *
 * Seuls les matchs programmés (prematch) sont considérés : ni live, ni terminés.
 */

// ---------------------------------------------------------------------------
// Types sources (miroir des fichiers data/)
// ---------------------------------------------------------------------------

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
};

type FlashScoreFile = {
  scraped_at: string;
  matches: FlashScoreMatch[];
};

type CuePlayer = {
  id: string;
  name: string;
  ranking?: number | null;
  matches_played?: number;
  wins?: number;
  losses?: number;
  centuries?: number;
  decider_win_pct?: number | null;
};

type CueTrackerFile = {
  scraped_at?: string;
  players: CuePlayer[];
};

// ---------------------------------------------------------------------------
// Types de sortie
// ---------------------------------------------------------------------------

type PickPlayer = {
  name: string;
  eloRating: number;
  ranking?: number;
  winPct?: number;
  matchesPlayed: number;
};

type TopPick = {
  matchId: string;
  tournament: string;
  player1: PickPlayer;
  player2: PickPlayer;
  pickSide: "A" | "B";
  pickName: string;
  prob: number;
  probA: number;
  probB: number;
  odds?: number;
  edge?: number;
  kelly?: number;
  confidence: number;
  scheduledAt?: string;
  player1PhotoUrl?: string;
  player2PhotoUrl?: string;
  bets: Array<{ type: string; label: string; prob: number }>;
};

// ---------------------------------------------------------------------------
// Constantes & helpers
// ---------------------------------------------------------------------------
// ─── Génération de 3 paris pré-match ───────────────────────────────────────
function buildPickBets(probA: number, probB: number, eloA: number, eloB: number): Array<{ type: string; label: string; prob: number }> {
  const favProb = Math.max(probA, probB);
  const underdogProb = Math.min(probA, probB);
  const eloDiff = Math.abs(eloA - eloB);
  const bets: Array<{ type: string; label: string; prob: number }> = [];

  // 1. Handicap frames (si favori large)
  if (favProb >= 0.75) {
    const pHandicap = 0.4 + (favProb - 0.5) * 0.5; // 0.40→0.65 selon prob
    bets.push({ type: "handicap", label: "Handicap -2.5 frames", prob: Math.min(0.95, Math.max(0.5, pHandicap)) });
  } else if (favProb >= 0.65) {
    const pHandicap = 0.35 + (favProb - 0.5) * 0.4;
    bets.push({ type: "handicap", label: "Handicap -1.5 frames", prob: Math.min(0.95, Math.max(0.5, pHandicap)) });
  }

  // 2. Total frames over/under
  const isClose = favProb < 0.70;
  if (isClose) {
    const pOver = 0.45 + (0.70 - favProb) * 0.3; // ~0.45→0.51
    bets.push({ type: "total_frames", label: "Over 8.5 frames", prob: Math.min(0.95, Math.max(0.5, pOver)) });
  } else {
    const pUnder = 0.35 + favProb * 0.25; // ~0.50→0.58
    bets.push({ type: "total_frames", label: "Under 7.5 frames", prob: Math.min(0.95, Math.max(0.5, pUnder)) });
  }

  // 3. Century in match (si joueurs actifs + gros breakeurs)
  const centuryProb = 0.25 + (eloDiff > 300 ? 0.15 : 0) + (favProb > 0.7 ? 0.10 : 0);
  bets.push({ type: "century", label: "Century in match — Oui", prob: Math.min(0.95, Math.max(0.5, centuryProb)) });

  return bets;
}

// ─── Parse l'heure FlashScore "11:00" → ISO string (date du scrape) ────────
function parseTime(time: string, scrapedAt: string): string | undefined {
  if (!time || time === "-" || time === "") return undefined;
  try {
    const [hours, minutes] = time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return undefined;
    const ref = new Date(scrapedAt);
    const d = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate(), hours, minutes));
    return d.toISOString();
  } catch { return undefined; }
}

const MATCHES_FILE = join(process.cwd(), "data", "odds_flashscore_snooker.json");
const PLAYERS_FILE = join(process.cwd(), "data", "cuetracker_matches.json");
const MIN_PROB = 0.58;
const LIMIT = 10;
/** Seuil d'échantillon au-delà duquel les stats carrière sont considérées fiables. */
const SHRINK_N = 20;

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Normalise un nom : minuscules, sans accents ni ponctuation, espaces compactés. */
function normalizeName(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Elo proxy : 1500 + (winPct rétréci − 50) × 12.
 * Le shrinkage vers 50 % évite de surestimer les petits échantillons
 * (ex : 4 victoires sur 5 matchs ne doit pas donner un Elo de champion).
 */
function strengthElo(p: CuePlayer): number {
  const played = p.matches_played ?? 0;
  const wins = p.wins ?? 0;
  if (played <= 0) return 1500;
  const rawPct = (wins / played) * 100;
  const shrunkPct = 50 + (rawPct - 50) * (played / (played + SHRINK_N));
  return 1500 + (shrunkPct - 50) * 12;
}

/**
 * Index des joueurs CueTracker par nom de famille candidat.
 * Chaque joueur est indexé sous son premier ET son dernier token : couvre
 * l'ordre western (« Judd Trump ») et l'ordre surname-first (« Ding Junhui »).
 */
function buildPlayerIndex(players: CuePlayer[]): Map<string, CuePlayer[]> {
  const index = new Map<string, CuePlayer[]>();
  for (const p of players) {
    const tokens = normalizeName(p.name).split(" ").filter(Boolean);
    if (tokens.length === 0) continue;
    const surnames = new Set<string>();
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    if (first) surnames.add(first);
    if (last && tokens.length > 1) surnames.add(last);
    for (const s of surnames) {
      const list = index.get(s);
      if (list) list.push(p);
      else index.set(s, [p]);
    }
  }
  return index;
}

/**
 * Retrouve un joueur CueTracker depuis un nom FlashScore (« Trump J. »,
 * « J. Trump », « Kyren Wilson », « Ding J. »...).
 * Stratégie : extraire nom de famille + initiale du prénom selon la forme,
 * filtrer les homonymes par l'initiale ; ambiguïté résiduelle → joueur le
 * plus expérimenté (matches_played max).
 */
function findCuePlayer(fsName: string, index: Map<string, CuePlayer[]>): CuePlayer | null {
  const tokens = normalizeName(fsName).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  const first = tokens[0] ?? "";
  const last = tokens[tokens.length - 1] ?? "";

  let surnames: string[];
  let initial: string | null = null;
  if (tokens.length === 1) {
    surnames = [first];
  } else if (last.length === 1) {
    // « Trump J. » → nom de famille d'abord, initiale ensuite
    surnames = [first];
    initial = last;
  } else if (first.length === 1) {
    // « J. Trump » → initiale d'abord, nom de famille ensuite
    surnames = [last];
    initial = first;
  } else {
    // Nom complet : ordre ambigu (western vs surname-first) — essayer les deux
    surnames = [last, first];
  }

  for (const surname of surnames) {
    const candidates = (index.get(surname) ?? []).filter((p) => {
      if (!initial) return true;
      // L'initiale doit correspondre à un token ≠ nom de famille recherché
      const playerTokens = normalizeName(p.name).split(" ").filter(Boolean);
      return playerTokens.some((tok) => tok !== surname && tok.startsWith(initial));
    });
    if (candidates.length > 0) {
      // Désambiguïsation : le plus de matchs joués (échantillon le plus fiable)
      const sorted = candidates.slice().sort((a, b) => (b.matches_played ?? 0) - (a.matches_played ?? 0));
      return sorted[0] ?? null;
    }
  }
  return null;
}

/** Confiance 1-5 : niveau de probabilité + fiabilité des échantillons. */
function toConfidence(prob: number, playedA: number, playedB: number): number {
  let confidence = 3;
  if (prob >= 0.75) confidence++;
  if (prob >= 0.85) confidence++;
  if (playedA < 100 || playedB < 100) confidence--;
  return Math.max(1, Math.min(5, confidence));
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET() {
  const matchesData = readJson<FlashScoreFile>(MATCHES_FILE);
  const playersData = readJson<CueTrackerFile>(PLAYERS_FILE);

  if (!matchesData || !playersData) {
    return NextResponse.json(
      {
        picks: [],
        total: 0,
        minProb: MIN_PROB,
        generated_at: new Date().toISOString(),
        message:
          "Données insuffisantes. Lancez les scrapers : node scripts/scrape_flashscore_snooker.mjs && python scripts/scrape_cuetracker.py",
      },
      { status: 200 },
    );
  }

  const index = buildPlayerIndex(playersData.players ?? []);
  const picks: TopPick[] = [];

  for (const m of matchesData.matches ?? []) {
    // Prematch uniquement : pas live, pas de score final
    if (m.isLive) continue;
    const finished =
      m.scoreHome !== "-" && m.scoreAway !== "-" && m.scoreHome !== "" && m.scoreAway !== "";
    if (finished) continue;
    if (!m.home || !m.away) continue;

    const cueA = findCuePlayer(m.home, index);
    const cueB = findCuePlayer(m.away, index);
    // Sans stats carrière pour les deux joueurs, pas de prédiction possible
    if (!cueA || !cueB) continue;

    const eloA = strengthElo(cueA);
    const eloB = strengthElo(cueB);
    const probA = expectedScore(eloA, eloB);
    const probB = 1 - probA;

    // Pick = favori ; filtré sous le seuil de 65 %
    const pickSide: "A" | "B" = probA >= probB ? "A" : "B";
    const prob = Math.max(probA, probB);
    if (prob < MIN_PROB) continue;

    const oddsSide = pickSide === "A" ? m.odds?.home : m.odds?.away;
    const odds = typeof oddsSide === "number" && oddsSide > 1 ? oddsSide : undefined;
    const edge = odds !== undefined ? calculateEdge(prob, odds) : undefined;
    const kelly = odds !== undefined ? kellyStake(prob, odds) : undefined;

    const pickPlayer = pickSide === "A" ? cueA : cueB;
    const toPickPlayer = (p: CuePlayer, elo: number): PickPlayer => {
      const played = p.matches_played ?? 0;
      const out: PickPlayer = {
        name: p.name,
        eloRating: Math.round(elo),
        matchesPlayed: played,
      };
      if (p.ranking != null) out.ranking = p.ranking;
      if (played > 0) out.winPct = ((p.wins ?? 0) / played) * 100;
      return out;
    };

    const scheduledAt = parseTime(m.time, matchesData.scraped_at);

    picks.push({
      matchId: m.id,
      tournament: m.tournament || "Snooker",
      player1: toPickPlayer(cueA, eloA),
      player2: toPickPlayer(cueB, eloB),
      pickSide,
      pickName: pickPlayer.name,
      prob,
      probA,
      probB,
      ...(odds !== undefined ? { odds, edge, kelly } : {}),
      confidence: toConfidence(prob, cueA.matches_played ?? 0, cueB.matches_played ?? 0),
      scheduledAt,
      bets: buildPickBets(probA, probB, eloA, eloB),
    });
  }

  // Tri : probabilité modèle décroissante, puis edge décroissant (absents en fin)
  picks.sort((a, b) => {
    if (b.prob !== a.prob) return b.prob - a.prob;
    const ea = a.edge ?? -1;
    const eb = b.edge ?? -1;
    return eb - ea;
  });

  const top = picks.slice(0, LIMIT);

  // Enrichir avec photos Wikipedia (best-effort parallèle)
  // On reconstitue les IDs CueTracker depuis le nom via l'index
  const cueAIndex = new Map<string, CuePlayer>();
  for (const p of playersData.players ?? []) {
    const key = p.name.toLowerCase().trim();
    cueAIndex.set(key, p);
    // also store partial (lastname)
    const parts = key.split(/\s+/);
    if (parts.length >= 2) cueAIndex.set(parts[0], p);
  }

  const photoPromises = top.map(async (pick) => {
    const keyA = pick.player1.name.toLowerCase().trim();
    const keyB = pick.player2.name.toLowerCase().trim();
    const p1 = cueAIndex.get(keyA) || cueAIndex.get(keyA.split(/\s+/)[0]);
    const p2 = cueAIndex.get(keyB) || cueAIndex.get(keyB.split(/\s+/)[0]);
    const [p1Photo, p2Photo] = await Promise.all([
      p1 ? fetchPlayerPhoto(p1.id).catch(() => undefined) : Promise.resolve(undefined),
      p2 ? fetchPlayerPhoto(p2.id).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    if (p1Photo) pick.player1PhotoUrl = p1Photo;
    if (p2Photo) pick.player2PhotoUrl = p2Photo;
    return pick;
  });
  const enriched = await Promise.all(photoPromises);

  return NextResponse.json({
    picks: enriched,
    total: enriched.length,
    minProb: MIN_PROB,
    generated_at: new Date().toISOString(),
    sources: {
      matches: "data/odds_flashscore_snooker.json",
      players: "data/cuetracker_matches.json",
      scraped_at: matchesData.scraped_at,
    },
  });
}