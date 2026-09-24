"use client";

import { useState } from "react";
import useSWR from "swr";
import type { HandballBacktestResult } from "@/lib/handball-backtest";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as HandballBacktestResult;
};

/** Mise en forme signée (+x.x) */
function fmtSigned(v: number, digits = 1): string {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
}

/** Sparkline SVG pure (aucune dépendance graphique) */
function Sparkline({ data, width = 260, height = 64 }: { data: number[]; width?: number; height?: number }) {
  if (data.length === 0) return <span className="text-muted-foreground">—</span>;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const span = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 8)).toFixed(1)}`)
    .join(" ");
  const up = data[data.length - 1] >= 0;
  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="Courbe profit cumulé">
      {/* Ligne zéro */}
      <line
        x1={0}
        x2={width}
        y1={height - 4 - ((0 - min) / span) * (height - 8)}
        y2={height - 4 - ((0 - min) / span) * (height - 8)}
        className="stroke-border"
        strokeDasharray="3 3"
      />
      <polyline points={pts} fill="none" strokeWidth={2} className={up ? "stroke-[#00e676]" : "stroke-red-500"} />
    </svg>
  );
}

export function HandballBacktestWidget() {
  const [league, setLeague] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, error, isLoading } = useSWR<HandballBacktestResult>(
    `/api/handball/backtest?league=${encodeURIComponent(league)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15 * 60_000 },
  );

  if (isLoading)
    return (
      <div className="text-center py-4 text-muted-foreground" aria-live="polite">
        Calcul du backtest…
      </div>
    );
  if (error || !data)
    return (
      <div className="text-center py-4 text-muted-foreground" aria-live="polite">
        Backtest indisponible
      </div>
    );

  const rows = data.strategies;
  const active = rows.find((s) => s.key === selected) ?? rows[0] ?? null;
  // Barres ROI : échelle relative au |ROI| max (lignes non rejouées exclues)
  const maxAbsRoi = Math.max(1, ...rows.map((s) => Math.abs(s.roiPct ?? 0)));

  return (
    <div className="space-y-3 rounded border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">📉 Backtest ROI visuel</h3>
        <span className="text-xs text-muted-foreground">
          {data.nMatches} matchs terminés · mises flat 1u
        </span>
        <select
          value={league}
          onChange={(e) => {
            setLeague(e.target.value);
            setSelected(null);
          }}
          className="ml-auto text-xs rounded border border-border bg-background px-2 py-1"
          aria-label="Filtrer par ligue"
        >
          <option value="all">Toutes ligues</option>
          {data.leagues.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau ROI trié (meilleurs en tête — tri serveur) */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-1.5 pr-2 font-medium">Stratégie</th>
              <th className="py-1.5 pr-2 font-medium">Marché</th>
              <th className="py-1.5 pr-2 font-medium text-right">Cote</th>
              <th className="py-1.5 pr-2 font-medium text-right">Paris</th>
              <th className="py-1.5 pr-2 font-medium text-right">Hit%</th>
              <th className="py-1.5 pr-2 font-medium text-right">Profit</th>
              <th className="py-1.5 pr-2 font-medium text-right">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => {
              const roi = s.roiPct;
              const positive = roi != null && roi > 0;
              return (
                <tr
                  key={s.key}
                  onClick={() => setSelected(s.key)}
                  className={`cursor-pointer transition-colors hover:bg-muted ${active?.key === s.key ? "bg-muted/60" : ""}`}
                >
                  <td className="py-1.5 pr-2 font-medium text-foreground whitespace-nowrap">
                    {s.emoji} {s.label}
                    {!s.sampleOk && (
                      <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                        n&lt;10
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">{s.market}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{s.odds != null ? `@${s.odds.toFixed(2)}` : "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{s.nBets}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {s.hitRate != null ? `${(s.hitRate * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-mono">
                    {s.nBets > 0 ? `${fmtSigned(s.profitU)}u` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {roi != null ? (
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums ${
                          positive ? "bg-[#00e676]/15 text-[#00e676]" : "bg-red-500/15 text-red-500"
                        }`}
                      >
                        {fmtSigned(roi)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mini bar-chart ROI (divs CSS pures) */}
      <div className="space-y-1">
        {rows
          .filter((s) => s.roiPct != null)
          .map((s) => {
            const roi = s.roiPct ?? 0;
            const w = Math.abs(roi) / maxAbsRoi;
            return (
              <div key={s.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-24 truncate text-muted-foreground">{s.label}</span>
                <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded ${roi > 0 ? "bg-[#00e676]" : "bg-red-500"}`}
                    style={{ width: `${Math.max(2, w * 100)}%` }}
                  />
                </div>
                <span className="w-16 text-right tabular-nums font-mono">{fmtSigned(roi)}%</span>
              </div>
            );
          })}
      </div>

      {/* Courbe profit cumulé (stratégie cliquée, sinon tête du tableau) */}
      {active && active.curve.length > 0 && (
        <div className="space-y-1 rounded border border-border p-2">
          <div className="flex items-baseline gap-2 text-xs">
            <span className="font-semibold text-foreground">
              {active.emoji} {active.label} — profit cumulé
            </span>
            <span className="tabular-nums font-mono text-muted-foreground">
              {fmtSigned(active.profitU)}u · Kelly {fmtSigned(active.profitKellyU)}u
            </span>
          </div>
          <Sparkline data={active.curve} />
        </div>
      )}

      {/* Note méthodologique + disclaimer */}
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer font-medium">Méthodologie</summary>
        <p className="mt-1">{data.methodology}</p>
      </details>
      <p className="text-[11px] font-medium text-amber-500">
        ⚠️ Cotes simulées — ROI indicatif, pas un conseil de pari.
      </p>
    </div>
  );
}
