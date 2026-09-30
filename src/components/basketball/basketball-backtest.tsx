"use client";

/**
 * BasketballBacktest — sous-onglet « Backtest » : 4 stratégies évaluées
 * walk-forward (anti-fuite, fenêtre glissante 10 matchs) sur la table
 * basketball_match_history. ROI à cote fixe 1.91. Charte FotMob light :
 * ROI vert si > 0, rouge sinon.
 */

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type StratResult = {
  key: string; label: string; description: string;
  bets: number; wins: number; winRate: number; roi: number; profitUnits: number;
};

type Payload = {
  perLeague: { league: string; matches: number; strategies: StratResult[] }[];
  overall: StratResult[];
  windowSize: number;
  matches: number;
  oddsFixed: number;
  leagues: string[];
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

function roiClass(roi: number) {
  if (roi > 2) return "text-[#00985f] font-bold";
  if (roi < -2) return "text-red-600 font-bold";
  return "text-[#545454]";
}

function StratTable({ strategies }: { strategies: StratResult[] }) {
  return (
    <table className="w-full min-w-[640px] text-xs">
      <thead>
        <tr className="border-b border-black/10 text-left text-[#717171]">
          <th className="px-3 py-2 font-medium">Stratégie</th>
          <th className="px-3 py-2 text-right font-medium">Paris</th>
          <th className="px-3 py-2 text-right font-medium">Gagnés</th>
          <th className="px-3 py-2 text-right font-medium">Winrate</th>
          <th className="px-3 py-2 text-right font-medium">ROI (cote 1.91)</th>
          <th className="px-3 py-2 text-right font-medium">Profit (u)</th>
        </tr>
      </thead>
      <tbody>
        {strategies.map((s) => (
          <tr key={s.key} className="border-b border-black/5 last:border-0" title={s.description}>
            <td className="px-3 py-2 font-medium text-[#222]">{s.label}</td>
            <td className="px-3 py-2 text-right tabular-nums text-[#545454]">{s.bets}</td>
            <td className="px-3 py-2 text-right tabular-nums text-[#545454]">{s.wins}</td>
            <td className="px-3 py-2 text-right tabular-nums text-[#545454]">{s.winRate.toFixed(1)} %</td>
            <td className={cn("px-3 py-2 text-right tabular-nums", roiClass(s.roi))}>
              {s.roi > 0 ? "+" : ""}{s.roi.toFixed(1)} %
            </td>
            <td className={cn("px-3 py-2 text-right tabular-nums", roiClass(s.profitUnits))}>
              {s.profitUnits > 0 ? "+" : ""}{s.profitUnits.toFixed(1)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BasketballBacktest({ className }: { className?: string }) {
  const [leagues, setLeagues] = useState<string>("NBA,WNBA");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (lg: string) => {
    setLeagues(lg);
    setLoading(true);
    setError(null);
    try {
      const d = (await fetcher(`/api/basketball/backtest?leagues=${encodeURIComponent(lg)}`)) as Payload;
      setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // premier chargement automatique (au mount uniquement)
  useEffect(() => {
    void run("NBA,WNBA");
     
  }, []);

  const leagueOptions = useMemo(() => ["NBA,WNBA", "NBA", "WNBA", "EuroLeague,EuroCup", "EuroLeague"], []);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#717171]">Ligues :</span>
        {leagueOptions.map((lg) => (
          <button
            key={lg}
            onClick={() => void run(lg)}
            className={cn(
              "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
              leagues === lg ? "bg-[#00985f] text-white" : "bg-black/[0.06] text-[#717171] hover:text-[#222]",
            )}
          >
            {lg === "NBA,WNBA" ? "NBA + WNBA" : lg === "EuroLeague,EuroCup" ? "Euro E+U" : lg}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-[11px] text-[#717171]">
            {data.matches} matchs · fenêtre glissante {data.windowSize} · cote fixe {data.oddsFixed}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">Backtest indisponible : {error}</div>
      )}

      {loading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-black/[0.05]" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="rounded-xl border border-black/5 bg-white">
            <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold text-[#222]">
              🎯 Toutes ligues ({data.leagues.join(" + ")})
            </div>
            <div className="overflow-x-auto">
              <StratTable strategies={data.overall} />
            </div>
          </div>
          {data.perLeague.map((lg) => (
            <div key={lg.league} className="rounded-xl border border-black/5 bg-white">
              <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold text-[#222]">
                {lg.league} <span className="text-xs font-normal text-[#717171]">({lg.matches} matchs)</span>
              </div>
              <div className="overflow-x-auto">
                <StratTable strategies={lg.strategies} />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-[#717171]">
            Walk-forward sans fuite : chaque pari n&apos;utilise que les stats des {data.windowSize} matchs
            précédents de chaque équipe. Cote fixe 1.91 (≈ -5.2 % de marge book) — un ROI &gt; 0 signifie
            que la stratégie bat la marge. Données : basketball_match_history (entry 100).
          </p>
        </>
      )}
    </div>
  );
}
