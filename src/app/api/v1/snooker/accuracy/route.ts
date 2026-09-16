import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

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
  odds?: { player1: number; player2: number };
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
  const avgBreak = normalize(p.avgBreak ?? 30, 20, 80);
  return elo * 0.30 + win * 0.25 + century * 0.20 + decider * 0.15 + avgBreak * 0.10;
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
    pWin += Math.exp(logBinomPMF(i, bestOf - 1, pFrame));
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
    const dataDir = join(process.cwd(), "data");
    const playersFile = join(dataDir, "cuetracker_matches.json");
    const matchesFile = join(dataDir, "odds_flashscore_snooker.json");
    const oddsportalFile = join(dataDir, "oddsportal_nio.json");

    if (!existsSync(playersFile) || !existsSync(matchesFile)) {
      return NextResponse.json({ error: "Missing data files" }, { status: 500 });
    }

    // Load players
    const playersRaw = readFileSync(playersFile, "utf-8");
    const playersData = JSON.parse(playersRaw);
    const playerList: Player[] = [];
    const seen = new Set<string>();
    for (const row of playersData.matches ?? []) {
      const key = (row.player_name as string).trim();
      if (!seen.has(key) && key) {
        seen.add(key);
        playerList.push({
          id: String(row.player_id ?? key),
          name: key,
          eloRating: row.elo_rating ?? 1500,
          winPct: row.win_pct,
          centuryRate: row.century_rate,
          deciderWinPct: row.decider_win_pct,
          avgBreak: row.avg_break,
        });
      }
    }
    const playerByName = new Map(playerList.map((p) => [p.name, p]));

    // Load FlashScore matches
    const flashRaw = readFileSync(matchesFile, "utf-8");
    const flashData = JSON.parse(flashRaw);

    // Load Oddsportal if exists
    let oddsportalData: Record<string, { odds1?: number; odds2?: number }> = {};
    if (existsSync(oddsportalFile)) {
      const opRaw = readFileSync(oddsportalFile, "utf-8");
      const opData = JSON.parse(opRaw);
      for (const m of opData.matches ?? []) {
        oddsportalData[`${m.home}||${m.away}`] = { odds1: m.odds1, odds2: m.odds2 };
      }
    }

    // Build matches
    const matches: Match[] = (flashData.matches ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      player1: m.home as string,
      player2: m.away as string,
      status: m.isLive ? "live" : (m.scoreHome === "0" && m.scoreAway === "0" ? "scheduled" : "finished"),
      scoreA: parseInt(m.scoreHome as string) || 0,
      scoreB: parseInt(m.scoreAway as string) || 0,
      bestOf: 7,
      odds: m.odds as { player1: number; player2: number } | undefined,
    }));

    // Compute accuracy for finished matches
    const finished = matches.filter((m) => m.status === "finished" && (m.scoreA + m.scoreB) > 0);

    let correctPredictions = 0;
    let totalPredictions = 0;
    let highConfidenceCorrect = 0;
    let highConfidenceTotal = 0;
    let edgeCorrect = 0;
    let edgeTotal = 0;
    let brierScores: number[] = [];
    let logLossScores: number[] = [];

    for (const m of finished) {
      const p1 = playerByName.get(m.player1);
      const p2 = playerByName.get(m.player2);

      if (!p1 && !p2) continue;

      const s1 = p1 ? playerScore(p1) : 50;
      const s2 = p2 ? playerScore(p2) : 50;
      const total = s1 + s2 || 1;
      const pFrame = s1 / total;
      const modelProb = matchWinProb(pFrame, m.bestOf || 7) / 100;

      // Actual result: did player1 win?
      const p1Won = m.scoreA > m.scoreB;

      // Model prediction: predict player1 wins if prob > 50%
      const modelPredictedP1 = modelProb > 0.5;

      totalPredictions++;
      if (modelPredictedP1 === p1Won) correctPredictions++;

      // High confidence (>65%)
      if (modelProb > 0.65 || modelProb < 0.35) {
        highConfidenceTotal++;
        if (modelPredictedP1 === p1Won) highConfidenceCorrect++;
      }

      // Brier score
      const brier = Math.pow(modelProb - (p1Won ? 1 : 0), 2);
      brierScores.push(brier);

      // Log loss
      const pred = p1Won ? modelProb : 1 - modelProb;
      if (pred > 0.01) {
        logLossScores.push(-Math.log(pred));
      }

      // Edge vs odds
      if (m.odds && m.odds.player1 > 0 && m.odds.player2 > 0) {
        const implied = oddsWinProb(m.odds.player1, m.odds.player2) / 100;
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
      scraped_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
