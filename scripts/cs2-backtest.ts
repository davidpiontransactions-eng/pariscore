/**
 * cs2-backtest.ts — Harness de backtest des marchés CS2 (gate de calibration).
 * ---------------------------------------------------------------------------
 * Usage : bun run scripts/cs2-backtest.ts [--days=90] [--out=data/cs2-backtest-report.json]
 *
 * Méthode (walk-forward sans fuite de données) :
 *  1. Collecte des matchs terminés csapi.de (/matches/latest?days=N — aucune auth).
 *  2. Tri chronologique ; pour chaque match, les TeamModel sont reconstruits
 *     UNIQUEMENT depuis les matchs antérieurs (fenêtre glissante 90j).
 *  3. Pour chaque map réellement jouée : p1 = mapWinProb (Bradley-Terry), puis
 *     Monte-Carlo MR12 (2000 sims) → P(over 22.5) et P(cover ±1.5 handicap).
 *  4. Records { prob, outcome, odds≈2.0 } → evaluateMarkets (backtest-core).
 *
 * Limitations v1 (documentées dans .context/trace-cs2-implementation.md) :
 *  - Pas d'ancrage ELO/CT-T historique (BSD ne fournit que l'instantané) →
 *    ctWinrate/tWinrate neutres 50/50, elo null (fallback 1500).
 *  - Cotes moyenne 2.0 (proxy ROI — pas d'historique de cotes horodaté).
 */

import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import {
  mapWinProb,
  simulateMapRounds,
  CT_BIAS,
  type TeamModel,
  type Cs2MapName,
} from "../src/lib/prediction/cs2/cs2-predictive-ml-engine";
import { canonMapName } from "../src/lib/cs2/types";
import { handicapRoundMarkets } from "../src/lib/prediction/cs2/handicap-rounds";
import { buildBacktestReport, type BacktestRecord } from "../src/lib/prediction/cs2/backtest-core";

const OVER_LINE = 22.5;
const HANDICAP_LINE = 1.5;
const SIMS = 2000;

type CsapiMap = { name?: string; team1_score?: number; team2_score?: number };
type CsapiMatch = {
  date?: string;
  team1?: { name?: string; rank?: number };
  team2?: { name?: string; rank?: number };
  maps?: CsapiMap[];
};

function httpsGetJson(url: string, timeoutMs = 15000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: "GET", headers: { Accept: "application/json" } },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch { resolve(null); }
        });
      },
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

/** Statistiques glissantes par équipe/carte (wins/plays) — reconstruites au fil de l'eau. */
type MapStat = { wins: number; plays: number };
type TeamStats = { maps: Map<string, MapStat>; seriesWins: number; seriesPlays: number };

function emptyStats(): TeamStats {
  return { maps: new Map(), seriesWins: 0, seriesPlays: 0 };
}

/** MapWinrate % lissé Laplace (fallback 50 si <3 plays). */
function winratePct(stats: TeamStats, map: Cs2MapName): number | null {
  const s = stats.maps.get(map.toLowerCase());
  if (!s || s.plays < 3) return null;
  return ((s.wins + 1) / (s.plays + 2)) * 100;
}

function toTeamModel(name: string, stats: TeamStats, pool: Cs2MapName[]): TeamModel {
  const mapWinrates: Partial<Record<Cs2MapName, number>> = {};
  const mapSample: Partial<Record<Cs2MapName, number>> = {};
  for (const map of pool) {
    const wr = winratePct(stats, map);
    if (wr != null) {
      mapWinrates[map] = wr;
      mapSample[map] = stats.maps.get(map.toLowerCase())?.plays ?? 0;
    }
  }
  return {
    name,
    elo: null,
    hltvRank: null,
    mapWinrates,
    mapSample,
    ctWinrate: 50,
    tWinrate: 50,
    formWinrate: stats.seriesPlays > 0 ? (stats.seriesWins / stats.seriesPlays) * 100 : null,
  };
}

/** Enregistre le résultat d'un match dans les stats des deux équipes. */
function recordMatch(stats: Map<string, TeamStats>, m: CsapiMatch): void {
  const t1 = (m.team1?.name ?? "").toLowerCase();
  const t2 = (m.team2?.name ?? "").toLowerCase();
  if (!t1 || !t2) return;
  const s1 = stats.get(t1) ?? emptyStats();
  const s2 = stats.get(t2) ?? emptyStats();
  let w1 = 0;
  let w2 = 0;
  for (const mp of m.maps ?? []) {
    const canon = canonMapName(mp.name ?? null);
    const a = Number(mp.team1_score);
    const b = Number(mp.team2_score);
    if (!canon || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    const total = a + b;
    if (total < 13 || total > 45) continue;
    const k = canon.toLowerCase();
    const m1 = s1.maps.get(k) ?? { wins: 0, plays: 0 };
    const m2 = s2.maps.get(k) ?? { wins: 0, plays: 0 };
    m1.plays++; m2.plays++;
    if (a > b) { m1.wins++; w1++; } else if (b > a) { m2.wins++; w2++; }
    s1.maps.set(k, m1);
    s2.maps.set(k, m2);
  }
  if (w1 !== w2) {
    s1.seriesPlays++; s2.seriesPlays++;
    if (w1 > w2) s1.seriesWins++; else s2.seriesWins++;
  }
  stats.set(t1, s1);
  stats.set(t2, s2);
}

async function main(): Promise<void> {
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const days = daysArg ? Number(daysArg.split("=")[1]) : 90;
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const outPath = outArg ? outArg.split("=")[1] : "data/cs2-backtest-report.json";

  console.log(`[backtest] Collecte csapi /matches/latest?limit=500 (fenêtre locale ${days}j)…`);
  const raw = (await httpsGetJson("https://api.csapi.de/matches/latest?limit=500")) as
    | { matches?: CsapiMatch[]; data?: CsapiMatch[] | { matches?: CsapiMatch[] } }
    | CsapiMatch[]
    | null;
  const matches: CsapiMatch[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.matches)
      ? raw.matches
      : Array.isArray((raw as { data?: CsapiMatch[] })?.data)
        ? (raw as { data: CsapiMatch[] }).data
        : Array.isArray((raw as { data?: { matches?: CsapiMatch[] } })?.data?.matches)
          ? (raw as { data: { matches: CsapiMatch[] } }).data.matches
          : [];
  console.log(`[backtest] ${matches.length} matchs reçus`);

  // Ne garde que les matchs terminés avec ≥1 map scoreée, triés chronologiquement.
  // L'API ignore le param days → filtre local par date (cutoff = days jours).
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const finished = matches
    .filter((m) => new Date(m.date ?? 0).getTime() >= cutoff)
    .filter((m) => Array.isArray(m.maps) && m.maps.length > 0 && m.maps.some((mp) => Number.isFinite(Number(mp.team1_score))))
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  console.log(`[backtest] ${finished.length} matchs terminés dans la fenêtre ${days}j`);

  const stats = new Map<string, TeamStats>();
  const winnerRecords: BacktestRecord[] = [];
  const mapRecords: BacktestRecord[] = [];
  const overRecords: BacktestRecord[] = [];
  const handicapRecords: BacktestRecord[] = [];
  const pool: Cs2MapName[] = ["Mirage", "Inferno", "Nuke", "Anubis", "Ancient", "Vertigo", "Dust2"];

  for (const m of finished) {
    const t1Name = m.team1?.name ?? "";
    const t2Name = m.team2?.name ?? "";
    const t1 = stats.get(t1Name.toLowerCase()) ?? emptyStats();
    const t2 = stats.get(t2Name.toLowerCase()) ?? emptyStats();
    // Exige un minimum d'historique pour éviter les probas dégénérées.
    if (t1.seriesPlays < 3 || t2.seriesPlays < 3) {
      recordMatch(stats, m);
      continue;
    }
    const tm1 = toTeamModel(t1Name, t1, pool);
    const tm2 = toTeamModel(t2Name, t2, pool);

    let mapsPlayed = 0;
    let mapsWon1 = 0;
    const seedBase = new Date(m.date ?? 0).getTime() % 100000;
    for (const mp of m.maps ?? []) {
      const map = canonMapName(mp.name ?? null);
      const s1 = Number(mp.team1_score);
      const s2 = Number(mp.team2_score);
      if (!map || !Number.isFinite(s1) || !Number.isFinite(s2)) continue;
      const total = s1 + s2;
      if (total < 13 || total > 45) continue;
      mapsPlayed++;
      if (s1 > s2) mapsWon1++;

      const p1 = mapWinProb(tm1, tm2, map);
      const ctBias = CT_BIAS[map] ?? 0;
      const seed = (seedBase + mapsPlayed * 7919) % 2147483647;
      const dist = simulateMapRounds(p1, ctBias, 0.5 + ctBias / 2, 0.5 - ctBias / 2, SIMS, seed);

      // Marché MAP winner (côté T1 systématique).
      mapRecords.push({ prob: p1, outcome: s1 > s2 ? 1 : 0, odds: 2.0 });

      // Marché OVER rounds (ligne centrale 22.5).
      const overProb = dist.totalRounds.filter((t) => t > OVER_LINE).length / SIMS;
      overRecords.push({ prob: overProb, outcome: total > OVER_LINE ? 1 : 0, odds: 2.0 });

      // Marché HANDICAP rounds ±1.5 (côté favori du modèle).
      const markets = handicapRoundMarkets(dist, [HANDICAP_LINE], SIMS);
      const h = markets[0];
      if (p1 >= 0.5) {
        handicapRecords.push({ prob: h.probT1Cover, outcome: s1 - s2 >= HANDICAP_LINE ? 1 : 0, odds: 2.0 });
      } else {
        handicapRecords.push({ prob: h.probT2Cover, outcome: s2 - s1 >= HANDICAP_LINE ? 1 : 0, odds: 2.0 });
      }
    }

    // Marché WINNER série : proba moyenne des maps jouées (approx sans veto historique).
    if (mapsPlayed > 0 && mapsWon1 !== mapsPlayed - mapsWon1) {
      const avgP1 = mapRecords.slice(-mapsPlayed).reduce((a, r) => a + r.prob, 0) / mapsPlayed;
      winnerRecords.push({ prob: avgP1, outcome: mapsWon1 > mapsPlayed - mapsWon1 ? 1 : 0, odds: 2.0 });
    }

    recordMatch(stats, m);
  }

  const report = buildBacktestReport(
    { winner: winnerRecords, map: mapRecords, over: overRecords, handicap: handicapRecords },
    new Date().toISOString(),
  );
  const absOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(report, null, 2));
  console.log(`[backtest] Rapport écrit : ${absOut}`);
  for (const [market, r] of Object.entries(report)) {
    console.log(`  ${market.padEnd(9)} n=${String(r.n).padEnd(5)} brier=${r.brier} ece=${r.ece} roi=${r.roi}% verdict=${r.verdict}`);
  }
}

main().catch((e) => {
  console.error("[backtest] ERREUR:", e);
  process.exit(1);
});