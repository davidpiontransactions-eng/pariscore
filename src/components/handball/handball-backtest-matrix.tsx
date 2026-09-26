"use client";

import { useState } from "react";
import useSWR from "swr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
  BacktestMatrixResult,
  MatrixCell,
} from "@/lib/handball-backtest-matrix";
import { HandballTableCaption } from "./handball-table-caption";

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
  v == null ? "text-[#717171]" : v > 0 ? "text-[#00e676]" : v < 0 ? "text-red-500" : "text-[#717171]";

function CellView({ cell }: { cell: MatrixCell | undefined }) {
  if (!cell || cell.nBets === 0) {
    return (
      <>
        <td className="px-2 py-1.5 text-right text-[#717171]">—</td>
        <td className="px-2 py-1.5 text-right text-[#717171]">—</td>
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
  const [mOpen, setMOpen] = useState(false);

  const { data, error, isLoading } = useSWR<MatrixPayload>(
    `/api/handball/backtest-matrix?window=${win}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15 * 60_000 }
  );

  if (isLoading) {
    return (
      <section className="rounded border border-[#f0f0f0] bg-white p-3">
        <div className="py-3 text-center text-sm text-[#717171]" aria-live="polite">
          Chargement de la matrice de backtest…
        </div>
      </section>
    );
  }
  if (error || !data?.matrix) {
    return (
      <section className="rounded border border-[#f0f0f0] bg-white p-3">
        <p className="py-2 text-center text-xs text-[#717171]">
          Matrice de backtest indisponible (cron hebdo à venir).
        </p>
      </section>
    );
  }

  const { matrix } = data;
  const markets = matrix.markets;
  // Marchés classés du meilleur au moins bon (ROI global période courante) —
  // le tri s'adapte au choix Période complète / 30 jours.
  const sortedMarkets = [...markets].sort((a, b) => {
    const ra = matrix.global[a.key]?.roiPct;
    const rb = matrix.global[b.key]?.roiPct;
    if (ra == null && rb != null) return 1;
    if (rb == null && ra != null) return -1;
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    return (matrix.global[b.key]?.nBets ?? 0) - (matrix.global[a.key]?.nBets ?? 0);
  });
  // Défaut = meilleur marché (celui en tête du classement).
  const active =
    marketKey && markets.some((m) => m.key === marketKey) ? marketKey : sortedMarkets[0]?.key;
  const market = markets.find((m) => m.key === active);
  const globalCell = active ? matrix.global[active] : undefined;

  // Classement des championnats : meilleur ROI d'abord (marché actif),
  // ROI manquant en dernier, tie-break sur le nombre de paris (n desc).
  const sortedLeagues = [...matrix.leagues].sort((a, b) => {
    const ra = active ? a.cells[active]?.roiPct : undefined;
    const rb = active ? b.cells[active]?.roiPct : undefined;
    if (ra == null && rb != null) return 1;
    if (rb == null && ra != null) return -1;
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    const na = active ? a.cells[active]?.nBets ?? 0 : 0;
    const nb = active ? b.cells[active]?.nBets ?? 0 : 0;
    return nb - na;
  });

  return (
    <section className="space-y-2 rounded border border-[#f0f0f0] bg-white p-3 text-[#222222]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#222222]">
          📊 Backtest matrice — marchés × championnats
        </h3>
        <span className="text-xs text-[#717171]">
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
      {/* Sélecteur de marché — ascenseur : liste scrollable classée du meilleur
          au moins bon ROI (période courante), miroir du filtre championnats */}
      <div className="flex flex-wrap gap-1.5">
        <Popover open={mOpen} onOpenChange={setMOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-pressed={!!active}
              aria-label="Filtrer par type de marché"
              title={market?.market}
              className="inline-flex max-w-full min-h-[44px] items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background"
            >
              <span aria-hidden="true">📈</span>
              <span className="truncate">
                {market ? `${market.emoji} ${market.label}` : "Tous les marchés"}
              </span>
              <span className={`tabular-nums ${active && mOpen ? "opacity-80" : ""}`}>
                ROI {signedPct(globalCell?.roiPct ?? null)}
              </span>
              <span aria-hidden="true" className="text-[10px] opacity-70">
                ▾
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="w-[min(92vw,22rem)] p-2">
            <div
              role="listbox"
              aria-label="Types de marché"
              className="max-h-[55vh] overflow-y-auto overscroll-contain divide-y divide-[#f0f0f0] rounded-md border border-[#f0f0f0]"
            >
              {sortedMarkets.map((m) => {
                const g = matrix.global[m.key];
                const on = active === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setMarketKey(m.key);
                      setMOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs transition-colors min-h-[40px] ${
                      on
                        ? "bg-foreground font-semibold text-background"
                        : "hover:bg-muted focus-visible:bg-muted"
                    } outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]`}
                  >
                    <span className="truncate" title={m.market}>
                      {m.emoji} {m.label}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className={on ? "opacity-80" : "text-[#717171]"}>
                        {pct(g?.hitRate, 0)}
                      </span>
                      <span
                        className={
                          on ? "opacity-80" : roiCls(g?.roiPct ?? null)
                        }
                      >
                        {signedPct(g?.roiPct)}
                        {!g?.sampleOk && " ⚠️"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-[#717171]">
              Triés du meilleur au moins bon ROI · hit + ROI globaux (période
              courante) · ⚠️ échantillon &lt; 10 paris
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <HandballTableCaption>Performance par championnat — triés par ROI ↓</HandballTableCaption>          <thead>
            <tr className="border-b border-[#f0f0f0] text-left text-[#717171]">
              <th className="py-1.5 pr-2 font-medium">Championnat</th>
              <th className="px-2 py-1.5 text-right font-medium">Matchs</th>
              <th className="px-2 py-1.5 text-right font-medium">Paris</th>
              <th className="px-2 py-1.5 text-right font-medium">Hit</th>
              <th className="px-2 py-1.5 text-right font-medium">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {/* Ligne global (toutes ligues) */}
            <tr className="bg-[#f5f5f5]">
              <td className="py-1.5 pr-2 font-semibold">🌍 Toutes ligues</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{matrix.nMatches}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {globalCell?.nBets ?? 0}
              </td>
              <CellView cell={globalCell} />
            </tr>
            {sortedLeagues.map((l) => {
              const cell = active ? l.cells[active] : undefined;
              return (
                <tr key={l.league}>
                  <td className="py-1.5 pr-2">
                    <span className="block max-w-[180px] truncate sm:max-w-none" title={l.league}>
                      {l.league}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-[#717171]">
                    {l.nMatches}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-[#717171]">
                    {cell?.nBets ?? 0}
                  </td>
                  <CellView cell={cell} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] leading-snug text-[#717171]">
        {market ? `${market.market} · cote simulée ${market.odds ?? "—"}` : ""} — walk-forward
        anti-lookahead, cotes 1xbet simulées (ROI indicatif), ⚠️ = échantillon &lt;{" "}
        {matrix.minSampleBets} paris.{" "}
        <span title={matrix.methodology}>Source : table handball_match_history.</span>
      </p>
    </section>
  );
}
