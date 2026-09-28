"use client";

import { useState } from "react";
import useSWR from "swr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
  TennisBtCell,
  TennisBtDimKey,
  TennisBtResult,
  TennisBtWindow,
} from "@/lib/tennis-backtest-matrix";

// Backtest tennis — marchés (offre 1xbet) × segments : surface, homme/femme,
// type de tournoi, bande de cote du favori. Miroir UI de
// handball-backtest-matrix.tsx (charte FotMob clair du calendrier) + onglets
// de dimension. Source : GET /api/tennis/backtest-matrix (calcul live sur
// tennis_matches_internal, cache TTL 15 min). Types importés en `import type`
// uniquement : le module moteur importe node:path/bun:sqlite — jamais dans le
// bundle client.

type MatrixPayload = {
  window: TennisBtWindow;
  matrix: TennisBtResult;
};

const DIM_ORDER: ReadonlyArray<{ key: TennisBtDimKey; label: string }> = [
  { key: "surface", label: "Surface" },
  { key: "gender", label: "Hommes / Femmes" },
  { key: "tier", label: "Type de tournoi" },
  { key: "band", label: "Bande de cote" },
];

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/** Contrôle de forme du payload (main anti crash : la branche calendar
 *  tennis-tab-content sort SANS TennisErrorBoundary — cf. review). */
function isValidPayload(d: MatrixPayload | undefined): d is MatrixPayload {
  return (
    !!d?.matrix &&
    Array.isArray(d.matrix.markets) &&
    Array.isArray(d.matrix.dimensions) &&
    !!d.matrix.global &&
    !!d.matrix.thresholds
  );
}

const pct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)} %`);
const signedPct = (v: number | null, d = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)} %`;
const roiCls = (v: number | null) =>
  v == null ? "text-[#717171]" : v > 0 ? "text-emerald-600" : v < 0 ? "text-rose-500" : "text-[#717171]";

/** Pastille de verdict : fiable / norme / sous seuil / échantillon faible. */
function VerdictPill({ cell, minSample }: { cell: TennisBtCell | undefined; minSample: number }) {
  if (!cell) return <td className="px-2 py-1.5 text-right text-[#717171]">—</td>;
  const map: Record<string, { cls: string; label: string }> = {
    good: { cls: "bg-emerald-500/15 text-emerald-700", label: "Fiable" },
    ok: { cls: "bg-amber-500/15 text-amber-700", label: "Norme" },
    bad: { cls: "bg-rose-500/15 text-rose-700", label: "Sous seuil" },
    low: { cls: "bg-zinc-500/10 text-zinc-500", label: "Peu de data" },
  };
  const v = map[cell.verdict] ?? map.low;
  return (
    <td className="px-2 py-1.5 text-right">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${v.cls}`}
        title={
          cell.verdict === "low"
            ? `Moins de ${minSample} paris — échantillon faible, hit non significatif`
            : "Écart hit − cote implicite moyenne : fiable ≥ +5 pts · norme ≥ −3 pts"
        }
      >
        {v.label}
      </span>
    </td>
  );
}

/** Ligne de cellule standard (Hit · Paris · Cote · ROI · Verdict). */
function CellCells({ cell, minSample }: { cell: TennisBtCell | undefined; minSample: number }) {
  return (
    <>
      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
        {cell ? pct(cell.hit, 0) : "—"}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-[#717171]">
        {cell ? cell.n : "—"}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-[#717171]">
        {cell && cell.avgOdds != null ? cell.avgOdds.toFixed(2).replace(".", ",") : "—"}
      </td>
      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${roiCls(cell?.roi ?? null)}`}>
        {cell ? signedPct(cell.roi) : "—"}
        {cell && !cell.sampleOk ? (
          <span title={`Échantillon < ${minSample} paris — bruit`}> ⚠️</span>
        ) : null}
      </td>
      <VerdictPill cell={cell} minSample={minSample} />
    </>
  );
}

export function TennisBacktestMatrix() {
  const [win, setWin] = useState<TennisBtWindow>("full");
  const [dim, setDim] = useState<TennisBtDimKey>("surface");
  const [marketKey, setMarketKey] = useState<string | null>(null);
  const [mOpen, setMOpen] = useState(false);

  const { data, error, isLoading } = useSWR<MatrixPayload>(
    `/api/tennis/backtest-matrix?window=${win}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15 * 60_000 },
  );

  if (isLoading) {
    return (
      <section className="rounded border border-[#f0f0f0] bg-white p-3">
        <div className="py-3 text-center text-sm text-[#717171]" aria-live="polite">
          Chargement du backtest tennis…
        </div>
      </section>
    );
  }
  if (error || !isValidPayload(data)) {
    return (
      <section className="rounded border border-[#f0f0f0] bg-white p-3">
        <p className="py-2 text-center text-xs text-[#717171]">
          Backtest indisponible (base tennis introuvable ou payload invalide —
          vérifier pariscore.db).
        </p>
      </section>
    );
  }

  const { matrix } = data;
  // Fenêtre vide (ex. d30 après un import plus ancien que 30 j) → message
  // explicite plutôt qu'une table vide avec dates nulles.
  if (matrix.nValid === 0) {
    return (
      <section className="rounded border border-[#f0f0f0] bg-white p-3">
        <p className="py-3 text-center text-xs text-[#717171]">
          {win === "d30"
            ? "Aucun match coté sur les 30 derniers jours — la période complète contient encore l'historique (les imports BSD peuvent être en pause)."
            : "Aucun match coté dans la base — vérifier les imports tennis (tennis_matches_internal)."}
        </p>
      </section>
    );
  }

  // Marchés triés du meilleur au moins bon ROI (global, période courante) —
  // le hit n'est pas comparable d'un marché à l'autre (miroir handball).
  const sortedMarkets = [...matrix.markets].sort((a, b) => {
    const ra = matrix.global[a.key]?.roi;
    const rb = matrix.global[b.key]?.roi;
    if (ra == null && rb != null) return 1;
    if (rb == null && ra != null) return -1;
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    return (matrix.global[b.key]?.n ?? 0) - (matrix.global[a.key]?.n ?? 0);
  });
  const active =
    marketKey && matrix.markets.some((m) => m.key === marketKey)
      ? marketKey
      : sortedMarkets[0]?.key;
  const market = matrix.markets.find((m) => m.key === active);
  const globalCell = active ? matrix.global[active] : undefined;
  const dimension = matrix.dimensions.find((d) => d.key === dim) ?? matrix.dimensions[0];
  const minSample = matrix.thresholds.minSample;

  return (
    <section className="space-y-2 rounded border border-[#f0f0f0] bg-white p-3 text-[#222222]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#222222]">
          Backtest Stratégies / Type de marché — tennis
        </h3>
        <span className="text-xs text-[#717171]">
          {matrix.nValid} matchs
          {matrix.from && matrix.to ? ` · ${matrix.from} → ${matrix.to}` : ""}
        </span>
      </div>

      {/* Fenêtre temporelle */}
      <div className="flex flex-wrap gap-1.5">
        {(["full", "d30"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWin(w)}
            aria-pressed={win === w}
            className={`min-h-[44px] rounded-full border px-3 py-1 text-xs transition-colors ${
              win === w
                ? "border-transparent bg-[#222222] text-white"
                : "border-[#e5e5e5] hover:bg-[#f5f5f5]"
            }`}
          >
            {w === "full" ? "Période complète" : "30 jours"}
          </button>
        ))}
      </div>

      {/* Sélecteur de marché (popover trié par ROI) */}
      <div className="flex flex-wrap gap-1.5">
        <Popover open={mOpen} onOpenChange={setMOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={mOpen}
              aria-label="Filtrer par type de marché"
              title={market?.label}
              className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs transition-colors hover:bg-[#f5f5f5] aria-expanded:bg-[#222222] aria-expanded:text-white"
            >
              <span aria-hidden="true">📈</span>
              <span className="truncate">
                {market ? market.label : "Tous les marchés"}
              </span>
              <span className="tabular-nums">Hit {pct(globalCell?.hit ?? null, 0)}</span>
              <span aria-hidden="true" className="text-[10px] opacity-70">
                ▾
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="w-[min(92vw,24rem)] p-2">
            <div
              role="group"
              aria-label="Types de marché"
              className="max-h-[55vh] divide-y divide-[#f0f0f0] overflow-y-auto overscroll-contain rounded-md border border-[#f0f0f0]"
            >
              {sortedMarkets.map((m) => {
                const g = matrix.global[m.key];
                const on = active === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setMarketKey(m.key);
                      setMOpen(false);
                    }}
                    className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      on ? "bg-[#222222] font-semibold text-white" : "hover:bg-[#f5f5f5]"
                    }`}
                  >
                    <span className="truncate" title={m.note ?? m.label}>
                      {m.label}
                      {m.note ? (
                        <span className={`ml-1 text-[10px] ${on ? "opacity-80" : "text-[#717171]"}`}>
                          {m.note}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className={on ? "opacity-80" : "text-[#717171]"}>
                        {pct(g?.hit ?? null, 0)}
                      </span>
                      <span className={on ? "opacity-80" : roiCls(g?.roi ?? null)}>
                        {signedPct(g?.roi ?? null)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-[#717171]">
              Triés du meilleur au moins bon ROI · hit + ROI globaux (période courante) ·
              ⚠️ échantillon &lt; {minSample} paris
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* Onglets de dimension */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dimension d'analyse">
        {DIM_ORDER.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDim(d.key)}
            aria-pressed={dim === d.key}
            className={`min-h-[44px] rounded-full border px-3 py-1 text-xs transition-colors ${
              dim === d.key
                ? "border-transparent bg-emerald-600 text-white"
                : "border-[#e5e5e5] hover:bg-[#f5f5f5]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Table segments */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Performance du marché sélectionné par segment — {dimension?.label}
          </caption>
          <thead>
            <tr className="border-b border-[#f0f0f0] text-left text-[#717171]">
              <th className="py-1.5 pr-2 font-medium">{dimension?.label}</th>
              <th className="px-2 py-1.5 text-right font-medium">Matchs</th>
              <th className="px-2 py-1.5 text-right font-medium">Hit</th>
              <th className="px-2 py-1.5 text-right font-medium">Paris</th>
              <th className="px-2 py-1.5 text-right font-medium">Cote</th>
              <th className="px-2 py-1.5 text-right font-medium">ROI</th>
              <th className="px-2 py-1.5 text-right font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {/* Ligne global */}
            <tr className="bg-[#f5f5f5]">
              <td className="py-1.5 pr-2 font-semibold">🌍 Tous les segments</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{matrix.nValid}</td>
              <CellCells cell={globalCell} minSample={minSample} />
            </tr>
            {dimension?.segments.map((s) => (
              <tr key={s.key}>
                <td className="py-1.5 pr-2">
                  <span className="block max-w-[200px] truncate sm:max-w-none" title={s.label}>
                    {s.label}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[#717171]">
                  {s.nMatches}
                </td>
                <CellCells
                  cell={active ? s.cells[active] : undefined}
                  minSample={minSample}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] leading-snug text-[#717171]">
        {market
          ? `${market.label}${market.odds ? ` · cote simulée ${String(market.odds).replace(".", ",")}` : " · cotes réelles"}`
          : ""}{" "}
        — {matrix.methodology}{" "}
        <span title={matrix.methodology}>
          Source : table tennis_matches_internal (calculé le {matrix.computedAt.slice(0, 10)}).
        </span>
      </p>
    </section>
  );
}
