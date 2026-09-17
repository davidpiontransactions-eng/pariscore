"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { kellyCriterion, simulateBankroll, type KellyResult } from "@/lib/snooker/kelly";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AccuracyData = {
  perMatch: { match: string; predicted: number; actual: "win" | "loss"; correct: boolean }[];
};

function MiniChart({ data, height = 40 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="bankrollGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00985f" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00985f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill */}
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill="url(#bankrollGrad)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#00985f"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Start line */}
      <line x1="0" y1={h - ((data[0] - min) / range) * h} x2={w} y2={h - ((data[0] - min) / range) * h} stroke="#9e9e9e" strokeWidth="0.5" strokeDasharray="2,2" />
    </svg>
  );
}

export function BankrollSimulator() {
  const [bankroll, setBankroll] = useState(100);
  const [fraction, setFraction] = useState(0.5);

  const { data } = useSWR<AccuracyData>(
    "/api/v1/snooker/accuracy",
    fetcher,
    { refreshInterval: 300_000 }
  );

  const sim = useMemo(() => {
    if (!data?.perMatch || data.perMatch.length === 0) return null;

    // Convert predictions to bets
    const bets = data.perMatch.map((p) => ({
      probability: p.predicted / 100,
      odds: 1 / (p.predicted / 100), // implied odds from model prob
      won: p.actual === "win",
    }));

    return simulateBankroll(bets, bankroll, fraction);
  }, [data, bankroll, fraction]);

  if (!sim) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <h3 className="mb-4 text-[12px] font-semibold text-gray-700 uppercase tracking-wide">
        Simulation Kelly
      </h3>

      {/* Controls */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] text-gray-500">Bankroll (units)</label>
          <input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(Number(e.target.value) || 100)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm tabular-nums focus:border-[#00985f] focus:outline-none"
            min={10}
            max={10000}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-gray-500">Fraction Kelly</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.1}
              value={fraction}
              onChange={(e) => setFraction(Number(e.target.value))}
              className="flex-1 accent-[#00985f]"
            />
            <span className="w-8 text-center text-xs font-bold tabular-nums text-[#00985f]">
              {fraction}x
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-3 rounded-lg bg-gray-50 p-3">
        <MiniChart data={sim.bankroll} height={60} />
      </div>

      {/* Results */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className={`text-lg font-black tabular-nums ${sim.final >= bankroll ? "text-[#00985f]" : "text-red-500"}`}>
            {sim.final.toFixed(0)}
          </div>
          <div className="text-[9px] text-gray-500">Bankroll finale</div>
        </div>
        <div>
          <div className={`text-lg font-black tabular-nums ${sim.roi >= 0 ? "text-[#00985f]" : "text-red-500"}`}>
            {sim.roi >= 0 ? "+" : ""}{sim.roi}%
          </div>
          <div className="text-[9px] text-gray-500">ROI</div>
        </div>
        <div>
          <div className="text-lg font-black tabular-nums text-amber-600">
            {sim.maxDrawdown}%
          </div>
          <div className="text-[9px] text-gray-500">Max drawdown</div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 text-center text-[9px] text-gray-400">
        Simulation sur {data?.perMatch?.length ?? 0} paris historiques avec {fraction}x Kelly
      </div>
    </div>
  );
}
