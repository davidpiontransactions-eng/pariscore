/**
 * T3 — API Bets snooker : paris prédictifs pre-match & live.
 *
 * GET /api/v1/snooker/bets            → paris pre-match pour les matchs du jour
 * GET /api/v1/snooker/bets?live=1     → paris dynamiques pour les matchs live
 *
 * Pre-match (3 paris/match) : handicap frame, total frames O/U, century occurrence.
 * Live (3 paris/match) : race to X frames, next frame winner, expected total frames.
 * Sources : Prisma (matchs) + snooker-analytics (modèle composite) + cotes optionnelles.
 */
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  compositeWinProb,
  expectedValue,
  confidenceLevel,
  buildPreMatchBets,
  raceToProb,
  expectedTotalFrames,
  probTotalFramesOver,
  winByMarginProb,
} from "@/lib/services/snooker-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PROB = 0.58;

export async function GET(request: Request) {
  const isLive = new URL(request.url).searchParams.get("live") === "1";
  try {
    const dbMatches = await prisma.snookerMatch.findMany({
      where: isLive ? { status: "live" } : { status: { in: ["scheduled", "live"] } },
      include: { playerA: true, playerB: true },
      take: 200,
      orderBy: { scheduledAt: "asc" },
    });

    // Index cotes optionnel : data/odds_flashscore_snooker.json (EV si cotes dispo).
    const oddsIndex = new Map<string, { home: number; away: number }>();
    try {
      const rows = JSON.parse(
        readFileSync(join(process.cwd(), "data", "odds_flashscore_snooker.json"), "utf-8"),
      ) as Array<{ home?: string; away?: string; oddsHome?: number; oddsAway?: number }>;
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (typeof r.home === "string" && typeof r.away === "string") {
            oddsIndex.set(`${norm(r.home)}|${norm(r.away)}`, { home: r.oddsHome ?? 0, away: r.oddsAway ?? 0 });
          }
        }
      }
    } catch {
      /* cotes optionnelles — fichier absent ou non-array */
    }

    const out = dbMatches.map((m) => {
      const playedA = m.playerA.winPct != null ? 80 : 0;
      const playedB = m.playerB.winPct != null ? 80 : 0;
      const c = compositeWinProb({
        bestOf: m.bestOf || 9,
        eloA: m.playerA.eloRating,
        eloB: m.playerB.eloRating,
        winPctA: m.playerA.winPct,
        winPctB: m.playerB.winPct,
        playedA,
        playedB,
      });
      const pWin = c.pWin;
      const pFav = Math.max(pWin, 1 - pWin);
      const pFrame = 0.5 + (pWin - 0.5) / 2.2;
      const need = Math.ceil((m.bestOf || 9) / 2);
      const odds = oddsIndex.get(`${norm(m.playerA.name)}|${norm(m.playerB.name)}`);
      const oddsFav = pWin >= 0.5 ? odds?.home : odds?.away;

      const bets = isLive
        ? buildLiveBets({ winsA: m.scoreA, winsB: m.scoreB, need, pWin, pFrame })
        : buildPreMatchBets({
            bestOf: m.bestOf || 9,
            pWin,
            deciderA: m.playerA.deciderWinPct,
            deciderB: m.playerB.deciderWinPct,
            centuryA: m.playerA.centuryRate,
            centuryB: m.playerB.centuryRate,
          });

      return {
        matchId: m.id,
        tournament: m.tournament,
        bestOf: m.bestOf,
        status: m.status,
        playerA: { id: m.playerA.id, name: m.playerA.name, elo: Math.round(m.playerA.eloRating) },
        playerB: { id: m.playerB.id, name: m.playerB.name, elo: Math.round(m.playerB.eloRating) },
        score: `${m.scoreA}-${m.scoreB}`,
        pWin: round3(pWin),
        pFav: round3(pFav),
        favourite: pWin >= 0.5 ? m.playerA.name : m.playerB.name,
        confidence: confidenceLevel(pFav, playedA, playedB),
        ev: oddsFav ? round3(expectedValue(pFav, oddsFav)) : null,
        bets: bets.filter((b) => b.prob >= MIN_PROB),
        allBets: bets,
      };
    });

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

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
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