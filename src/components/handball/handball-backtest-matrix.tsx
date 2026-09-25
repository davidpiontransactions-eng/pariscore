"use client";

import { useState } from "react";
import useSWR from "swr";
import type {
  BacktestMatrixResult,
  MatrixCell,
} from "@/lib/handball-backtest-matrix";

// Backtest matrice (8 marchés × championnats) — lecture du fichier produit
// par le cron hebdo (walk-forward sur handball_match_history). Cotes simulées
// (protocole handball-backtest.ts) : le ROI est indicatif, sampleOk = n ≥ 10.

type MatrixPayload = {
  window: "full" | "d30";
  generatedAt: string;
  matrix: BacktestMatrixResult;
  league?: { league: string; nMatches: number } | null;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const pct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const signedPct = (v: number | null, d = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`;
const roiCls = (v: number | null) =>
  v == null ? "text-muted-foreground" : v > 0 ? "text-[#00e676]" : v < 0 ? "text-red-500" : "text-muted-foreground";

function CellView({ cell }: { cell: MatrixCell | undefined }) {
  if (!cell || cell.nBets === 0) {
    return (
      <>
        <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
        <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
      </>
    );
  }
  return (
    <>
      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{pct(cell.hitRate, 0)}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${roiCls(cell.roiPct)}`}>
        {signedPct(cell.roiPct)}
        {!cell.sampleOk && <span title={`échantillon < 10 paris — bruit`}> ⚠️</span>}
      </td>
    </>
  );
}

export function HandballBacktestMatrix() {
  const [win, setWin] = useState<"full" | "d30">("full");
  const [marketKey, setMarketKey] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<MatrixPayload>(
    `/api/handball/backtest-matrix?window=${win}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15 * 60_000 }
  );

  if (isLoading) {
    return (
      <section className="rounded border border-border bg-card p-3">
        <div className="py-3 text-center text-sm text-muted-foreground" aria-live="polite">
          Chargement de la matrice de backtest…
        </div>
      </section>
    );
  }
  if (error || !data?.matrix) {
    return (
      <section className="rounded border border-border bg-card p-3">
        <p className="py-2 text-center text-xs text-muted-foreground">
          Matrice de backtest indisponible (cron hebdo à venir).
        </p>
      </section>
    );
  }

  const { matrix } = data;
  const markets = matrix.markets;
  const active = marketKey && markets.some((m) => m.key === marketKey) ? marketKey : markets[0]?.key;
  const market = markets.find((m) => m.key === active);
  const globalCell = active ? matrix.global[active] : undefined;

  return (
    <section className="space-y-2 rounded border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          📊 Backtest matrice — marchés × championnats
        </h3>
        <span className="text-xs text-muted-foreground">
          {matrix.nMatches} matchs · {matrix.leagues.length}/{matrix.nLeagues} ligues ·{" "}
          {data.generatedAt.slice(0, 10)}
        </span>
      </div>

      {/* Fenêtre + marchés */}
      <div className="flex flex-wrap gap-1.5">
        {(["full", "d30"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWin(w)}
            aria-pressed={win === w}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              win === w
                ? "border-transparent bg-foreground text-background"
                : "border-border hover:bg-muted"
            }`}
          >
            {w === "full" ? "Période complète" : "30 jours"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {markets.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMarketKey(m.key)}
            aria-pressed={active === m.key}
            title={m.market}
            className={`min-h-[32px] rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              active === m.key
                ? "border-transparent bg-[#00e676] text-black"
                : "border-border hover:bg-muted"
            }`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Championnat</th>
              <th className="px-2 py-1.5 text-right font-medium">Matchs</th>
              <th className="px-2 py-1.5 text-right font-medium">Paris</th>
              <th className="px-2 py-1.5 text-right font-medium">Hit</th>
              <th className="px-2 py-1.5 text-right font-medium">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Ligne global (toutes ligues) */}
            <tr className="bg-muted/40 dark:bg-white/[0.04]">
              <td className="py-1.5 pr-2 font-semibold">🌍 Toutes ligues</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{matrix.nMatches}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {globalCell?.nBets ?? 0}
              </td>
              <CellView cell={globalCell} />
            </tr>
            {matrix.leagues.map((l) => {
              const cell = active ? l.cells[active] : undefined;
              return (
                <tr key={l.league}>
                  <td className="py-1.5 pr-2">
                    <span className="block max-w-[180px] truncate sm:max-w-none" title={l.league}>
                      {l.league}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {l.nMatches}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {cell?.nBets ?? 0}
                  </td>
                  <CellView cell={cell} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        {market ? `${market.market} · cote simulée ${market.odds ?? "—"}` : ""} — walk-forward
        anti-lookahead, cotes 1xbet simulées (ROI indicatif), ⚠️ = échantillon &lt;{" "}
        {matrix.minSampleBets} paris.{" "}
        <span title={matrix.methodology}>Source : table handball_match_history.</span>
      </p>
    </section>
  );
}
