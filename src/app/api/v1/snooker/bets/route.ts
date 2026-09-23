/**
 * T3 — API Bets snooker : paris prédictifs pre-match & live.
 *
 * GET /api/v1/snooker/bets            → paris pre-match pour les matchs du jour
 * GET /api/v1/snooker/bets?live=1     → paris dynamiques pour les matchs live
 *
 * Pre-match (3 paris/match) : handicap frame, total frames O/U, century occurrence.
 * Live (3 paris/match) : race to X frames, next frame winner, expected total frames.
 *
 * Sources JSON (mêmes fichiers que /matches) — l'ancien backend Prisma n'était
 * jamais rempli (sync-snooker-db orphelin) → panel vide + EV null (audit lot3).
 * Cotes FlashScore lues sur le MÊME match que les noms → clés toujours alignées.
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  compositeWinProb,
  expectedValue,
  confidenceLevel,
  buildPreMatchBets,
  raceToProb,
  expectedTotalFrames,
  probTotalFramesOver,
  winByMarginProb,
  totalFramesLines,
} from "@/lib/services/snooker-analytics";
import { buildPlayerIndex, findCuePlayer, type PlayerLike } from "@/lib/snooker/player-match";
import { quickElo } from "@/lib/snooker/elo-engine";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PROB = 0.58;
const DEFAULT_BEST_OF = 9;

type FlashMatch = {
  id: string;
  tournament?: string;
  home: string;
  away: string;
  scoreHome: string;
  scoreAway: string;
  isLive: boolean;
  odds?: { home?: number; draw?: number | null; away?: number };
};

type CuePlayer = {
  id: string;
  name: string;
  matches_played?: number;
  wins?: number;
  losses?: number;
  centuries?: number;
  decider_win_pct?: number | null;
};

type FlashFile = { matches?: FlashMatch[] };
type CueFile = { players?: CuePlayer[] };

export async function GET(request: Request) {
  const isLive = new URL(request.url).searchParams.get("live") === "1";
  try {
    const flash = readJson<FlashFile>(join(DATA_DIR, "odds_flashscore_snooker.json"));
    const cue = readJson<CueFile>(join(DATA_DIR, "cuetracker_matches.json"));
    if (!flash || !cue) {
      return NextResponse.json({
        mode: isLive ? "live" : "prematch",
        total: 0,
        min_prob: MIN_PROB,
        matches: [],
        generated_at: new Date().toISOString(),
        message: "Données absentes — lancez les scrapers FlashScore + CueTracker.",
      });
    }

    const cuePlayers = cue.players ?? [];
    const playerLikes: PlayerLike[] = cuePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      matches_played: p.matches_played ?? 0,
    }));
    const index = buildPlayerIndex(playerLikes);
    const byId = new Map(cuePlayers.map((p) => [p.id, p]));

    const out: unknown[] = [];
    for (const m of flash.matches ?? []) {
      if (!m.home || !m.away) continue;
      const scoreA = parseFrames(m.scoreHome);
      const scoreB = parseFrames(m.scoreAway);
      const finished =
        !m.isLive && scoreA + scoreB > 0 && m.scoreHome !== "-" && m.scoreAway !== "-";
      // Mode prematch = tout sauf terminé (comme l'ancien where scheduled|live) ;
      // mode live = uniquement en cours.
      if (finished) continue;
      if (isLive && !m.isLive) continue;

      const hitA = findCuePlayer(m.home, index, playerLikes);
      const hitB = findCuePlayer(m.away, index, playerLikes);
      const cueA = hitA ? byId.get(hitA.id) : undefined;
      const cueB = hitB ? byId.get(hitB.id) : undefined;

      const winsA = cueA?.wins ?? 0;
      const lossesA = cueA?.losses ?? 0;
      const winsB = cueB?.wins ?? 0;
      const lossesB = cueB?.losses ?? 0;
      const playedA = cueA?.matches_played ?? winsA + lossesA;
      const playedB = cueB?.matches_played ?? winsB + lossesB;
      const eloA = quickElo(winsA, lossesA, cueA?.centuries ?? 0);
      const eloB = quickElo(winsB, lossesB, cueB?.centuries ?? 0);

      const c = compositeWinProb({
        bestOf: DEFAULT_BEST_OF,
        eloA,
        eloB,
        winPctA: playedA > 0 ? (winsA / playedA) * 100 : null,
        winPctB: playedB > 0 ? (winsB / playedB) * 100 : null,
        playedA,
        playedB,
      });
      const pWin = c.pWin;
      const pFav = Math.max(pWin, 1 - pWin);
      const pFrame = 0.5 + (pWin - 0.5) / 2.2;
      const need = Math.ceil(DEFAULT_BEST_OF / 2);

      // Cotes sur LE match courant (source identique aux noms → clé toujours hit)
      const odds = m.odds?.home && m.odds.away ? m.odds : undefined;
      const oddsFav = odds ? (pWin >= 0.5 ? odds.home : odds.away) : undefined;

      const bets = isLive
        // Live = SCORE du match (scoreA/scoreB), PAS les wins carrière (audit QA)
        ? buildLiveBets({ winsA: scoreA, winsB: scoreB, need, pWin, pFrame })
        : buildPreMatchBets({
            bestOf: DEFAULT_BEST_OF,
            pWin,
            deciderA: cueA?.decider_win_pct != null ? cueA.decider_win_pct * 100 : null,
            deciderB: cueB?.decider_win_pct != null ? cueB.decider_win_pct * 100 : null,
            centuryA: playedA > 0 ? ((cueA?.centuries ?? 0) / playedA) * 100 : null,
            centuryB: playedB > 0 ? ((cueB?.centuries ?? 0) / playedB) * 100 : null,
            playedA,
            playedB,
          });

      out.push({
        matchId: m.id,
        tournament: m.tournament || "Snooker",
        bestOf: DEFAULT_BEST_OF,
        status: m.isLive ? "live" : "scheduled",
        playerA: { id: hitA?.id ?? m.home, name: cueA?.name ?? m.home, elo: Math.round(eloA) },
        playerB: { id: hitB?.id ?? m.away, name: cueB?.name ?? m.away, elo: Math.round(eloB) },
        score: `${scoreA}-${scoreB}`,
        pWin: round3(pWin),
        pFav: round3(pFav),
        favourite: pWin >= 0.5 ? (cueA?.name ?? m.home) : (cueB?.name ?? m.away),
        confidence: confidenceLevel(pFav, playedA, playedB),
        ev: oddsFav ? round3(expectedValue(pFav, oddsFav)) : null,
        totalFramesLines: totalFramesLines(DEFAULT_BEST_OF, pFrame),
        bets: bets.filter((b) => b.prob >= MIN_PROB),
        allBets: bets,
      });
    }

    return NextResponse.json({
      mode: isLive ? "live" : "prematch",
      total: out.length,
      min_prob: MIN_PROB,
      matches: out,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

/** Parse un score frames "6-2" en entier, ou 0 si absent/invalide. */
function parseFrames(raw: string | undefined): number {
  if (!raw || raw === "-" || raw === "") return 0;
  const n = parseInt(raw.split("-")[0] ?? "", 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Paris dynamiques live : race-to-X, next frame, total frames, handicap in-play. */
function buildLiveBets(args: { winsA: number; winsB: number; need: number; pWin: number; pFrame: number }) {
  const { winsA, winsB, need, pWin, pFrame } = args;
  const bets: Array<{ type: string; label: string; prob: number }> = [];

  // 1) Race to X (jalon = frames requises pour gagner) : proba côté leader.
  const raceP = raceToProb(winsA, winsB, need, need, pFrame);
  if (raceP >= MIN_PROB || raceP <= 1 - MIN_PROB) {
    bets.push({
      type: "race_to_x",
      label: `Race to ${need} frames — ${raceP >= 0.5 ? "joueur A" : "joueur B"}`,
      prob: round3(Math.max(raceP, 1 - raceP)),
    });
  }

  // 2) Next frame : proba frame conditionnelle (recalculée en direct).
  if (pFrame >= MIN_PROB || pFrame <= 1 - MIN_PROB) {
    bets.push({
      type: "next_frame",
      label: `Prochaine frame — ${pFrame >= 0.5 ? "joueur A" : "joueur B"}`,
      prob: round3(Math.max(pFrame, 1 - pFrame)),
    });
  }

  // 3) Total frames restantes : E[frames] courant → Over/Under à la ligne médiane.
  const eTotal = expectedTotalFrames(winsA, winsB, need, pFrame);
  const line = eTotal - 0.5;
  const pOver = probTotalFramesOver(need * 2 - 1, pFrame, line);
  if (pOver >= MIN_PROB || pOver <= 1 - MIN_PROB) {
    bets.push({
      type: "total_frames_live",
      label: `Total frames ${pOver >= 0.5 ? "Over" : "Under"} ${line.toFixed(1)}`,
      prob: round3(Math.max(pOver, 1 - pOver)),
    });
  }

  // 4) Handicap in-play : favori (P_win ≥ 70 %) gagne par marge ≥ 2.
  if (pWin >= 0.7) {
    const pMargin = winByMarginProb(winsA, winsB, need, 2, pFrame);
    if (pMargin >= MIN_PROB) {
      bets.push({ type: "handicap_live", label: "Favori marge ≥ 2 frames", prob: round3(pMargin) });
    }
  }
  return bets;
}
