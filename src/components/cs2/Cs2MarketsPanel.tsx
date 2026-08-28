"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";

/**
 * Cs2MarketsPanel — Panneau des marchés prédictifs calibrés CS2.
 * ------------------------------------------------------------------
 * Affiche les 4 marchés (winner match, winner map, over/under rounds,
 * handicap rounds ±1.5) avec proba modèle, EV/Kelly (si cote fournie)
 * et le verdict BET/SKIP issu du gate de calibration (≥65% + EV≥4% +
 * backtest OK). Charte PariScore, zéro emoji.
 */

type MarketEv = {
  market: string;
  pModel: number | null;
  decimalOdds: number | null;
  ev: number | null;
  kelly: number | null;
  verdict: "BET" | "SKIP" | "NO_ODDS";
  calibration: string;
};

type HandicapRound = { line: number; probT1Cover: number; probT2Cover: number; probPush: number };

type Cs2MarketsPayload = {
  team1: string;
  team2: string;
  bestOf: number;
  winProb1: number;
  winProb2: number;
  topMap: string;
  handicapRounds: HandicapRound[];
  odds: { team1: number; team2: number | null } | null;
  evs: MarketEv[];
  error?: string;
};

const MARKET_LABELS: Record<string, string> = {
  winner: "Vainqueur du match",
  map: "Vainqueur de map",
  over: "Over rounds",
  handicap: "Handicap rounds",
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
};

function pct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

function verdictBadge(v: MarketEv["verdict"], calibration: string) {
  if (v === "BET") {
    return <span className="rounded bg-[#00E676]/15 px-2 py-0.5 text-[11px] font-bold text-[#00E676]">BET</span>;
  }
  if (v === "SKIP" && calibration === "OK") {
    return <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">SKIP</span>;
  }
  if (calibration !== "OK") {
    return (
      <span
        className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400"
        title="Calibration backtest non validée — signal non émis"
      >
        calibration en attente
      </span>
    );
  }
  return <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-zinc-600">cote requise</span>;
}

export function Cs2MarketsPanel({
  team1,
  team2,
  bestOf,
  oddsTeam1,
  oddsTeam2,
}: {
  team1: string | null | undefined;
  team2: string | null | undefined;
  bestOf: number;
  oddsTeam1?: number | null;
  oddsTeam2?: number | null;
}) {
  const enabled = Boolean(team1 && team2);
  const qs = new URLSearchParams();
  if (team1) qs.set("team1", team1);
  if (team2) qs.set("team2", team2);
  qs.set("best_of", String(bestOf || 3));
  if (oddsTeam1 && oddsTeam1 > 1) qs.set("odds_team1", String(oddsTeam1));
  if (oddsTeam2 && oddsTeam2 > 1) qs.set("odds_team2", String(oddsTeam2));

  const { data, isLoading, error } = useSWR<Cs2MarketsPayload>(
    enabled ? `/api/cs2/markets?${qs.toString()}` : null,
    fetcher,
    { revalidateOnFocus: false, errorRetryCount: 1, dedupingInterval: 5 * 60_000 },
  );

  if (!enabled) return null;
  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-white/[0.02]" aria-busy="true" />;
  }
  if (error || !data || data.error) {
    return (
      <p className="rounded-md bg-white/[0.02] px-3 py-2 text-xs text-zinc-500">
        Marchés prédictifs indisponibles{data?.error ? ` (${data.error})` : ""}.
      </p>
    );
  }

  const handicapTop = data.handicapRounds[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Marchés calibrés · BO{data.bestOf} · map probable : {data.topMap}
        </p>
        <span className="text-[11px] text-zinc-600" title="Gate : proba ≥65% + EV ≥4% + backtest OK">
          seuil ≥65%
        </span>
      </div>

      {data.evs.map((m) => (
        <div
          key={m.market}
          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-200">{MARKET_LABELS[m.market] ?? m.market}</p>
            <p className="text-[11px] text-zinc-500">
              proba {pct(m.pModel)}
              {m.ev != null && (
                <span className={cn("ml-2 font-mono", m.ev >= 4 ? "text-[#00E676]" : "text-zinc-500")}>
                  EV {m.ev >= 0 ? "+" : ""}
                  {m.ev.toFixed(1)}%
                </span>
              )}
              {m.kelly != null && m.kelly > 0 && (
                <span className="ml-2 font-mono text-zinc-500">Kelly {(m.kelly * 100).toFixed(0)}%</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {m.decimalOdds != null && (
              <span className="font-mono text-[11px] text-zinc-400">@{m.decimalOdds.toFixed(2)}</span>
            )}
            {verdictBadge(m.verdict, m.calibration)}
          </div>
        </div>
      ))}

      {handicapTop && (
        <p className="text-[11px] text-zinc-600">
          Handicap ±{handicapTop.line} — T1 couvre {pct(handicapTop.probT1Cover)} · T2 couvre{" "}
          {pct(handicapTop.probT2Cover)} (distribution Monte-Carlo {""}
          map la plus probable)
        </p>
      )}
    </div>
  );
}