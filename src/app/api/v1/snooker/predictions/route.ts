import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { expectedScore, calculateEdge, kellyStake } from "../../../../../lib/snooker/elo";
import { fetchPlayerPhoto } from "@/lib/snooker/player-photos";
import { buildPreMatchBets } from "@/lib/services/snooker-analytics";
import { buildPlayerIndex, findCuePlayer, type PlayerLike } from "@/lib/snooker/player-match";
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 *   - Pick retenu si probabilité favori >= 58 % (MIN_PROB).
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
// Les probabilités proviennent de snooker-analytics.buildPreMatchBets
// (formules binomiales réelles) — plus de constantes hardcodées.

function buildPickBets(
  probA: number,
  probB: number,
  cueA: CuePlayer,
  cueB: CuePlayer,
): Array<{ type: string; label: string; prob: number }> {
  const favProb = Math.max(probA, probB);
  const playedA = cueA.matches_played ?? 0;
  const playedB = cueB.matches_played ?? 0;
  // Formules réelles snooker-analytics (handicap/over/century) — l'ancienne
  // version mélangeait des constantes arbitraires (audit lot3).
  return buildPreMatchBets({
    bestOf: 9,
    pWin: favProb,
    deciderA: cueA.decider_win_pct != null ? cueA.decider_win_pct * 100 : null,
    deciderB: cueB.decider_win_pct != null ? cueB.decider_win_pct * 100 : null,
    centuryA: playedA > 0 ? ((cueA.centuries ?? 0) / playedA) * 100 : null,
    centuryB: playedB > 0 ? ((cueB.centuries ?? 0) / playedB) * 100 : null,
    playedA,
    playedB,
  });
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

const MATCHES_FILE = join(DATA_DIR, "odds_flashscore_snooker.json");
const PLAYERS_FILE = join(DATA_DIR, "cuetracker_matches.json");
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

  const cueList = playersData.players ?? [];
  const playerLikes: PlayerLike[] = cueList.map((p) => ({
    id: p.id,
    name: p.name,
    matches_played: p.matches_played ?? 0,
  }));
  const index = buildPlayerIndex(playerLikes);
  const cueById = new Map(cueList.map((p) => [p.id, p]));
  const picks: TopPick[] = [];
  const seenIds = new Set<string>();

  for (const m of matchesData.matches ?? []) {
    // Prematch uniquement : pas live, pas de score final
    if (m.isLive) continue;
    const finished =
      m.scoreHome !== "-" && m.scoreAway !== "-" && m.scoreHome !== "" && m.scoreAway !== "";
    if (finished) continue;
    if (!m.home || !m.away) continue;
    // Le JSON source contient des ids en double (--both) → dédup (QA post-deploy)
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);

    // Résolution partagée (player-match — mapping FS_TO_CUE_ID + fuzzy)
    const hitA = findCuePlayer(m.home, index, playerLikes);
    const hitB = findCuePlayer(m.away, index, playerLikes);
    const cueA = hitA ? cueById.get(hitA.id) : undefined;
    const cueB = hitB ? cueById.get(hitB.id) : undefined;
    // Sans stats carrière pour les deux joueurs, pas de prédiction possible
    if (!cueA || !cueB) continue;

    const eloA = strengthElo(cueA);
    const eloB = strengthElo(cueB);
    const probA = expectedScore(eloA, eloB);
    const probB = 1 - probA;

    // Pick = favori ; filtré sous le seuil MIN_PROB
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
      bets: buildPickBets(probA, probB, cueA, cueB),
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

  // Enrichir avec photos Wikipedia
  const cueAIndex = new Map<string, CuePlayer>();
  for (const p of playersData.players ?? []) {
    cueAIndex.set(p.name.toLowerCase().trim(), p);
  }

  const photoPromises = top.map(async (pick) => {
    const p1 = cueAIndex.get(pick.player1.name.toLowerCase().trim());
    const p2 = cueAIndex.get(pick.player2.name.toLowerCase().trim());
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