import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { quickElo } from "@/lib/snooker/elo-engine";
import { buildPlayerIndex, findCuePlayer, type PlayerLike } from "@/lib/snooker/player-match";
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = {
  id: string;
  name: string;
  eloRating: number;
  winPct?: number;
  centuryRate?: number;
  deciderWinPct?: number;
  avgBreak?: number;
};

type Match = {
  id: string;
  player1: string;
  player2: string;
  status: string;
  scoreA: number;
  scoreB: number;
  bestOf: number;
  /** Cotes FlashScore : {home, away} — pas {player1, player2} (audit lot3). */
  odds?: { home: number; away: number };
};

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

function playerScore(p: Player): number {
  const elo = normalize(p.eloRating, 1200, 1800);
  const win = p.winPct ?? 50;
  const century = normalize(p.centuryRate ?? 0, 0, 30);
  const decider = p.deciderWinPct ?? 50;
  // avgBreak = max_break CueTracker (40-147), neutre si absent
  const maxBreak = p.avgBreak != null ? normalize(p.avgBreak, 40, 147) : 50;
  return elo * 0.30 + win * 0.25 + century * 0.20 + decider * 0.15 + maxBreak * 0.10;
}

function logBinomPMF(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 0 : -Infinity;
  if (p >= 1) return k === n ? 0 : -Infinity;
  let logC = 0;
  for (let i = 0; i < k; i++) {
    logC += Math.log(n - i) - Math.log(i + 1);
  }
  return logC + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

function matchWinProb(pFrame: number, bestOf: number): number {
  const winsNeeded = Math.ceil(bestOf / 2);
  let pWin = 0;
  for (let i = 0; i < winsNeeded; i++) {
    pWin += Math.exp(logBinomPMF(i, bestOf, pFrame));
  }
  return (1 - pWin) * 100;
}

function oddsWinProb(odds1: number, odds2: number): number {
  if (odds1 <= 0 || odds2 <= 0) return 50;
  const v1 = 1 / odds1;
  const v2 = 1 / odds2;
  const total = v1 + v2;
  return (v1 / total) * 100;
}

export async function GET() {
  try {
    const dataDir = DATA_DIR;
    const playersFile = join(dataDir, "cuetracker_matches.json");
    const matchesFile = join(dataDir, "odds_flashscore_snooker.json");
    const oddsportalFile = join(dataDir, "oddsportal_nio.json");

    // Default empty structures when data files are missing
    const defaultPlayersData = { players: [] };
    const defaultFlashData = { matches: [] };

    let playersData: { players: Array<Record<string, unknown>> };
    let flashData: { matches: Array<Record<string, unknown>>; scraped_at?: string };

    // Try loading data files, fall back to empty structures
    if (existsSync(playersFile) && existsSync(matchesFile)) {
      playersData = JSON.parse(readFileSync(playersFile, "utf-8"));
      flashData = JSON.parse(readFileSync(matchesFile, "utf-8"));
    } else {
      playersData = defaultPlayersData;
      flashData = defaultFlashData;
    }

    // Build player list from CueTracker players data (NOT matches)
    const playerList: Player[] = [];
    const playerLikes: PlayerLike[] = [];
    const seen = new Set<string>();
    for (const row of (playersData.players ?? [])) {
      const key = (row.name as string)?.trim();
      if (!seen.has(key) && key) {
        seen.add(key);
        const wins = (row.wins as number) ?? 0;
        const losses = (row.losses as number) ?? 0;
        const played = (row.matches_played as number) ?? wins + losses;
        // Champs réels du JSON CueTracker (win_pct/century_rate n'existent pas)
        const p: Player = {
          id: String(row.id ?? key),
          name: key,
          eloRating: quickElo(wins, losses, (row.centuries as number) ?? 0),
        };
        if (played > 0) p.winPct = (wins / played) * 100;
        if (played > 0) p.centuryRate = (((row.centuries as number) ?? 0) / played) * 100;
        // decider_win_pct stocké en fraction 0-1 → converti en %
        if (row.decider_win_pct != null) p.deciderWinPct = (row.decider_win_pct as number) * 100;
        if (row.max_break != null) p.avgBreak = row.max_break as number;
        playerList.push(p);
        playerLikes.push({ id: p.id, name: p.name, matches_played: played });
      }
    }
    const cueIndex = buildPlayerIndex(playerLikes);

    // Load FlashScore matches
    const flashMatches: Match[] = (flashData.matches ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      player1: m.home as string,
      player2: m.away as string,
      status: m.isLive ? "live" : (m.scoreHome !== "-" && m.scoreHome !== "" ? "finished" : "scheduled"),
      scoreA: parseInt(m.scoreHome as string) || 0,
      scoreB: parseInt(m.scoreAway as string) || 0,
      // Le reste du pipeline matchs utilise Bo9 (défaut snooker) — pas 7.
      bestOf: 9,
      odds:
        typeof (m.odds as { home?: number } | undefined)?.home === "number" &&
        typeof (m.odds as { away?: number } | undefined)?.away === "number"
          ? {
              home: (m.odds as { home: number }).home,
              away: (m.odds as { away: number }).away,
            }
          : undefined,
    }));

    // Finished matches only
    const finished = flashMatches.filter((m) => m.status === "finished" && (m.scoreA + m.scoreB) > 0);

    let correctPredictions = 0;
    let totalPredictions = 0;
    let highConfidenceCorrect = 0;
    let highConfidenceTotal = 0;
    let edgeCorrect = 0;
    let edgeTotal = 0;
    let brierScores: number[] = [];
    let logLossScores: number[] = [];

    // Calibration buckets (10 buckets: 50-55%, 55-60%, ..., 95-100%)
    const buckets: { min: number; correct: number; total: number; predicted: number[] }[] = [];
    for (let i = 0; i < 10; i++) {
      buckets.push({ min: 50 + i * 5, correct: 0, total: 0, predicted: [] });
    }

    // Per-match predictions for calibration
    const perMatch: {
      match: string;
      predicted: number;
      actual: "win" | "loss";
      correct: boolean;
    }[] = [];

    for (const m of finished) {
      // Résolution fuzzy FlashScore → CueTracker ("Gilbert D." → "David Gilbert")
      const hit1 = findCuePlayer(m.player1, cueIndex, playerLikes);
      const hit2 = findCuePlayer(m.player2, cueIndex, playerLikes);
      const p1 = hit1 ? playerList.find((p) => p.id === hit1.id) : undefined;
      const p2 = hit2 ? playerList.find((p) => p.id === hit2.id) : undefined;

      // Sans stats pour les DEUX joueurs → pas de prédiction évaluable
      if (!p1 || !p2) continue;

      const s1 = playerScore(p1);
      const s2 = playerScore(p2);
      const total = s1 + s2 || 1;
      const pFrame = s1 / total;
      const modelProb = matchWinProb(pFrame, m.bestOf) / 100;

      // Actual result: did player1 win?
      const p1Won = m.scoreA > m.scoreB;

      // Model prediction: predict player1 wins if prob > 50%
      const modelPredictedP1 = modelProb > 0.5;
      const isCorrect = modelPredictedP1 === p1Won;

      totalPredictions++;
      if (isCorrect) correctPredictions++;

      // Per-match data (limit to last 50)
      if (perMatch.length < 50) {
        perMatch.push({
          match: `${m.player1} vs ${m.player2}`,
          predicted: Math.round(modelProb * 1000) / 10,
          actual: p1Won ? "win" : "loss",
          correct: isCorrect,
        });
      }

      // Calibration bucket — confiance du côté prédit (couvre aussi <50 %)
      const probPct = modelProb * 100;
      const confPct = probPct >= 50 ? probPct : 100 - probPct;
      const predictedRight = (probPct >= 50) === p1Won;
      const bIdx = Math.min(9, Math.max(0, Math.floor((confPct - 50) / 5)));
      if (confPct >= 50) {
        buckets[bIdx].total++;
        buckets[bIdx].predicted.push(confPct);
        if (predictedRight) buckets[bIdx].correct++;
      }

      // High confidence (>65%)
      if (modelProb > 0.65 || modelProb < 0.35) {
        highConfidenceTotal++;
        if (isCorrect) highConfidenceCorrect++;
      }

      // Brier score
      const brier = Math.pow(modelProb - (p1Won ? 1 : 0), 2);
      brierScores.push(brier);

      // Log loss
      const pred = p1Won ? modelProb : 1 - modelProb;
      if (pred > 0.01) {
        logLossScores.push(-Math.log(pred));
      }

      // Edge vs odds (FlashScore : {home, away})
      if (m.odds && m.odds.home > 0 && m.odds.away > 0) {
        const implied = oddsWinProb(m.odds.home, m.odds.away) / 100;
        const edge = modelProb - implied;
        if (Math.abs(edge) > 0.05) {
          edgeTotal++;
          if ((edge > 0) === p1Won) edgeCorrect++;
        }
      }
    }

    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
    const highConfidenceAccuracy = highConfidenceTotal > 0 ? (highConfidenceCorrect / highConfidenceTotal) * 100 : 0;
    const edgeAccuracy = edgeTotal > 0 ? (edgeCorrect / edgeTotal) * 100 : 0;
    const avgBrier = brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : 0;
    const avgLogLoss = logLossScores.length > 0
      ? logLossScores.reduce((a, b) => a + b, 0) / logLossScores.length
      : 0;

    // Calibration data: average predicted vs actual win rate per bucket
    const calibration = buckets
      .filter((b) => b.total > 0)
      .map((b) => ({
        range: `${b.min}-${b.min + 5}%`,
        avgPredicted: Math.round((b.predicted.reduce((a, c) => a + c, 0) / b.total) * 10) / 10,
        actualRate: Math.round((b.correct / b.total) * 1000) / 10,
        count: b.total,
      }));

    return NextResponse.json({
      totalMatches: totalPredictions,
      accuracy: Math.round(accuracy * 10) / 10,
      highConfidence: {
        count: highConfidenceTotal,
        accuracy: Math.round(highConfidenceAccuracy * 10) / 10,
      },
      edge: {
        count: edgeTotal,
        accuracy: Math.round(edgeAccuracy * 10) / 10,
      },
      brierScore: Math.round(avgBrier * 1000) / 1000,
      logLoss: Math.round(avgLogLoss * 1000) / 1000,
      calibration,
      perMatch,
      scraped_at: flashData.scraped_at ?? new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Retour 200 (SWR crash-proof) mais on porte l'erreur pour le front
    return NextResponse.json({
      totalMatches: 0,
      accuracy: 0,
      highConfidence: { count: 0, accuracy: 0 },
      edge: { count: 0, accuracy: 0 },
      brierScore: 1,
      logLoss: 1,
      calibration: [],
      perMatch: [],
      error: msg,
      scraped_at: new Date().toISOString(),
    }, { status: 200 });
  }
}