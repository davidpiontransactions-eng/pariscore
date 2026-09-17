"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Player = {
  id: string;
  name: string;
  eloRating: number;
  winPct: number;
  centuryRate: number;
  deciderWinPct: number;
  avgBreak: number;
  totalMatches: number;
  wins: number;
  losses: number;
};

type Match = {
  id: string;
  player1: string;
  player2: string;
  status: string;
  scoreA: number;
  scoreB: number;
  bestOf: number;
  scheduled_at?: string;
  tournament?: string;
};

// ── Binomial helpers ──────────────────────────────────────────────────────

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

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

function powerScore(p: Player): number {
  const elo = normalize(p.eloRating, 1200, 1800);
  const win = p.winPct ?? 50;
  const century = normalize(p.centuryRate ?? 0, 0, 30);
  const decider = p.deciderWinPct ?? 50;
  const avgBreak = normalize(p.avgBreak ?? 30, 20, 80);
  return Math.round(elo * 0.30 + win * 0.25 + century * 0.20 + decider * 0.15 + avgBreak * 0.10);
}

function playerScore(p: Player): number {
  return (p.eloRating / 1800) * 30 + (p.winPct ?? 50) * 0.25 +
    Math.min(100, ((p.centuryRate ?? 0) / 30) * 100) * 0.20 +
    (p.deciderWinPct ?? 50) * 0.15 +
    Math.min(100, (((p.avgBreak ?? 30) - 20) / 60) * 100) * 0.10;
}

// ── UI Components ─────────────────────────────────────────────────────────

function MetricRow({
  label,
  val1,
  val2,
  higher,
  unit,
}: {
  label: string;
  val1: number;
  val2: number;
  higher?: boolean;
  unit?: string;
}) {
  const total = val1 + val2 || 1;
  const pct1 = (val1 / total) * 100;
  const better = higher === false ? val1 < val2 : val1 > val2;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={`w-14 text-right tabular-nums sm:w-20 ${better ? "font-bold text-[#00985f]" : "text-gray-600"}`}>
        {val1.toFixed(1)}{unit}
      </span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden flex">
        <div className="h-full rounded-full bg-[#00985f] transition-all" style={{ width: `${pct1}%` }} />
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${100 - pct1}%` }} />
      </div>
      <span className={`w-14 tabular-nums sm:w-20 ${!better ? "font-bold text-amber-600" : "text-gray-600"}`}>
        {val2.toFixed(1)}{unit}
      </span>
      <span className="w-20 text-center text-gray-400 text-[10px] hidden sm:inline">{label}</span>
    </div>
  );
}

function FormBadges({ matches, playerName }: { matches: Match[]; playerName: string }) {
  const recent = matches
    .filter((m) => m.status === "finished" && (m.player1 === playerName || m.player2 === playerName))
    .sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""))
    .slice(0, 5);

  if (recent.length === 0) return <span className="text-[10px] text-gray-400">—</span>;

  return (
    <div className="flex gap-1">
      {recent.map((m) => {
        const isP1 = m.player1 === playerName;
        const won = isP1 ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
        const score = isP1 ? `${m.scoreA}-${m.scoreB}` : `${m.scoreB}-${m.scoreA}`;
        return (
          <span
            key={m.id}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ${
              won ? "bg-emerald-500" : "bg-red-500"
            }`}
            title={`${score} vs ${isP1 ? m.player2 : m.player1}`}
          >
            {won ? "W" : "L"}
          </span>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SnookerComparePage() {
  const [p1Name, setP1Name] = useState("");
  const [p2Name, setP2Name] = useState("");
  const [p1Idx, setP1Idx] = useState<number | null>(null);
  const [p2Idx, setP2Idx] = useState<number | null>(null);

  const { data: playersData } = useSWR<{ players: Player[] }>(
    "/api/v1/snooker/players?limit=500",
    fetcher,
    { refreshInterval: 300_000 }
  );

  const { data: matchesData } = useSWR<{ matches: Match[] }>(
    "/api/v1/snooker/matches",
    fetcher,
    { refreshInterval: 60_000 }
  );

  const players = playersData?.players ?? [];
  const allMatches = matchesData?.matches ?? [];

  // Search results
  const p1Results = useMemo(() => {
    if (!p1Name || p1Name.length < 2) return [];
    const q = p1Name.toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [p1Name, players]);

  const p2Results = useMemo(() => {
    if (!p2Name || p2Name.length < 2) return [];
    const q = p2Name.toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [p2Name, players]);

  const p1 = p1Idx !== null ? players[p1Idx] : null;
  const p2 = p2Idx !== null ? players[p2Idx] : null;

  // Prediction
  const prediction = useMemo(() => {
    if (!p1 || !p2) return null;
    const s1 = playerScore(p1);
    const s2 = playerScore(p2);
    const total = s1 + s2 || 1;
    const pFrame = s1 / total;
    const pWinP1 = matchWinProb(pFrame, 7);
    const pWinP2 = 100 - pWinP1;

    // Power scores
    const ps1 = powerScore(p1);
    const ps2 = powerScore(p2);

    // H2H in current matches
    const h2h = allMatches.filter(
      (m) =>
        m.status === "finished" &&
        ((m.player1 === p1.name && m.player2 === p2.name) ||
          (m.player1 === p2.name && m.player2 === p1.name))
    );

    let p1WinsH2H = 0;
    let p2WinsH2H = 0;
    for (const m of h2h) {
      if (m.player1 === p1.name) {
        if (m.scoreA > m.scoreB) p1WinsH2H++;
        else p2WinsH2H++;
      } else {
        if (m.scoreB > m.scoreA) p1WinsH2H++;
        else p2WinsH2H++;
      }
    }

    return {
      pWinP1,
      pWinP2,
      ps1,
      ps2,
      h2hMatches: h2h.length,
      p1WinsH2H,
      p2WinsH2H,
    };
  }, [p1, p2, allMatches]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#00985f] to-[#005c3a] text-white px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/?sport=snooker" className="text-white/60 hover:text-white text-sm">← Snooker</Link>
            <span className="text-white/30">·</span>
            <span className="text-white/60 text-sm">Comparateur</span>
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">Comparateur de joueurs</h1>
          <p className="mt-1 text-sm text-white/60">
            Sélectionnez deux joueurs pour comparer leurs statistiques et prédire le résultat.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Player selectors */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Player 1 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-[11px] font-semibold text-gray-500 uppercase">Joueur 1</label>
            <input
              type="text"
              value={p1Name}
              onChange={(e) => { setP1Name(e.target.value); setP1Idx(null); }}
              placeholder="Nom du joueur…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00985f] focus:outline-none"
            />
            {p1Results.length > 0 && p1Idx === null && (
              <div className="mt-1 rounded-lg border border-gray-100 bg-white shadow-lg">
                {p1Results.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => { setP1Idx(players.indexOf(p)); setP1Name(p.name); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-[10px] text-gray-400">PS {powerScore(p)}</span>
                  </button>
                ))}
              </div>
            )}
            {p1 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00985f]/10 text-[#00985f] text-sm font-bold">
                  {p1.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{p1.name}</div>
                  <div className="text-[10px] text-gray-500">
                    Elo {p1.eloRating} · PS {powerScore(p1)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-[11px] font-semibold text-gray-500 uppercase">Joueur 2</label>
            <input
              type="text"
              value={p2Name}
              onChange={(e) => { setP2Name(e.target.value); setP2Idx(null); }}
              placeholder="Nom du joueur…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00985f] focus:outline-none"
            />
            {p2Results.length > 0 && p2Idx === null && (
              <div className="mt-1 rounded-lg border border-gray-100 bg-white shadow-lg">
                {p2Results.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => { setP2Idx(players.indexOf(p)); setP2Name(p.name); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-[10px] text-gray-400">PS {powerScore(p)}</span>
                  </button>
                ))}
              </div>
            )}
            {p2 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-sm font-bold">
                  {p2.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{p2.name}</div>
                  <div className="text-[10px] text-gray-500">
                    Elo {p2.eloRating} · PS {powerScore(p2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comparison results */}
        {p1 && p2 && prediction && (
          <>
            {/* Win probability */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <h3 className="mb-4 text-center text-[12px] font-semibold text-gray-700 uppercase tracking-wide">
                Probabilité de victoire (Bo7)
              </h3>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-[#00985f] tabular-nums">{prediction.pWinP1.toFixed(1)}%</div>
                  <div className="mt-1 text-[11px] font-medium text-gray-600">{p1.name}</div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-gray-300">vs</span>
                  <span className="text-[9px] text-gray-400">Bo7</span>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-amber-600 tabular-nums">{prediction.pWinP2.toFixed(1)}%</div>
                  <div className="mt-1 text-[11px] font-medium text-gray-600">{p2.name}</div>
                </div>
              </div>
              {/* Win bar */}
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100 flex">
                <div
                  className="h-full rounded-l-full bg-[#00985f] transition-all"
                  style={{ width: `${prediction.pWinP1}%` }}
                />
                <div
                  className="h-full rounded-r-full bg-amber-500 transition-all"
                  style={{ width: `${prediction.pWinP2}%` }}
                />
              </div>
            </div>

            {/* H2H */}
            {prediction.h2hMatches > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <h3 className="mb-3 text-center text-[12px] font-semibold text-gray-700 uppercase tracking-wide">
                  Confrontations directes ({prediction.h2hMatches} matchs)
                </h3>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#00985f]">{prediction.p1WinsH2H}</div>
                    <div className="text-[10px] text-gray-500">{p1.name}</div>
                  </div>
                  <div className="text-lg font-bold text-gray-300">-</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">{prediction.p2WinsH2H}</div>
                    <div className="text-[10px] text-gray-500">{p2.name}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics comparison */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-2">
              <h3 className="mb-3 text-[12px] font-semibold text-gray-700 uppercase tracking-wide">
                Comparaison des métriques
              </h3>
              <MetricRow label="Elo" val1={p1.eloRating} val2={p2.eloRating} />
              <MetricRow label="Win%" val1={p1.winPct ?? 50} val2={p2.winPct ?? 50} />
              <MetricRow label="Century%" val1={p1.centuryRate ?? 0} val2={p2.centuryRate ?? 0} />
              <MetricRow label="Décideur%" val1={p1.deciderWinPct ?? 50} val2={p2.deciderWinPct ?? 50} />
              <MetricRow label="Avg Break" val1={p1.avgBreak ?? 30} val2={p2.avgBreak ?? 30} />
              <MetricRow label="Matchs" val1={p1.totalMatches ?? 0} val2={p2.totalMatches ?? 0} />
              <MetricRow label="PS" val1={prediction.ps1} val2={prediction.ps2} />
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="mb-2 text-[11px] font-semibold text-gray-700 uppercase">Forme récente</div>
                <div className="text-[11px] text-gray-600 mb-2">{p1.name}</div>
                <FormBadges matches={allMatches} playerName={p1.name} />
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="mb-2 text-[11px] font-semibold text-gray-700 uppercase">Forme récente</div>
                <div className="text-[11px] text-gray-600 mb-2">{p2.name}</div>
                <FormBadges matches={allMatches} playerName={p2.name} />
              </div>
            </div>

            {/* Prediction summary */}
            <div className="rounded-2xl border border-[#00985f]/20 bg-[#00985f]/5 p-5">
              <h3 className="mb-2 text-center text-[12px] font-semibold text-[#00985f] uppercase tracking-wide">
                Recommandation
              </h3>
              <div className="text-center">
                <span className="text-lg font-bold text-gray-900">
                  {prediction.pWinP1 > prediction.pWinP2 ? p1.name : p2.name}
                </span>
                <span className="ml-2 text-sm text-gray-600">
                  favori à {Math.max(prediction.pWinP1, prediction.pWinP2).toFixed(1)}%
                </span>
              </div>
              <div className="mt-3 flex justify-center gap-3">
                {[
                  { range: "75%+", label: "Fort", color: "#00985f" },
                  { range: "65-75%", label: "Moyen", color: "#FF6D00" },
                  { range: "55-65%", label: "Léger", color: "#2196F3" },
                  { range: "<55%", label: "Incertain", color: "#9e9e9e" },
                ].map((c) => {
                  const prob = Math.max(prediction.pWinP1, prediction.pWinP2);
                  const inRange =
                    (c.range === "75%+" && prob >= 75) ||
                    (c.range === "65-75%" && prob >= 65 && prob < 75) ||
                    (c.range === "55-65%" && prob >= 55 && prob < 65) ||
                    (c.range === "<55%" && prob < 55);
                  return (
                    <span
                      key={c.label}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${
                        inRange
                          ? "shadow-sm text-white"
                          : "text-gray-400 bg-gray-100"
                      }`}
                      style={inRange ? { backgroundColor: c.color, boxShadow: `0 0 0 2px ${c.color}40` } : undefined}
                    >
                      {c.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!p1 && !p2 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/50 p-10 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500">
              Tapez les noms de deux joueurs pour les comparer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
