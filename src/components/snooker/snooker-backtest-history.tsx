"use client";

import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Backtest historique snooker — panneau du sous-onglet « Backtesting ».
// Données : GET /api/v1/snooker/backtest?window=full|d365|season (HTTP 200
// toujours, état vide porté par nMatches === 0 / error). Walk-forward Elo sur
// les matchs SnookerDB : on mesure la QUALITÉ des probabilités (accuracy,
// Brier, LogLoss, calibration) — pas de ROI, l'historique ne contient pas de
// cotes. Découpes : saison, catégorie, tournoi, format (bestOf), écart Elo.
// ---------------------------------------------------------------------------

type BtWindow = "full" | "d365" | "season";

type BtCalibrationPoint = {
  range: string;
  avgPredicted: number;
  actualRate: number;
  count: number;
};

type BtSegment = {
  key: string;
  label: string;
  nMatches: number;
  accuracy: number;
  brier: number;
};

type BtDimension = {
  key: string;
  label: string;
  segments: BtSegment[];
};

/** Type local fidèle au contrat de l'API backtest (aucun `any`). */
type SnookerBacktestResponse = {
  window: BtWindow;
  from: string;
  to: string;
  nMatches: number;
  source: string;
  attribution: string;
  computedAt: string;
  metrics: { accuracy: number; brier: number; logLoss: number };
  baseline: { label: string; accuracy: number; n: number };
  calibration: BtCalibrationPoint[];
  dimensions: BtDimension[];
  error: string | null;
};

const WINDOWS: ReadonlyArray<{ key: BtWindow; label: string }> = [
  { key: "full", label: "Tout" },
  { key: "d365", label: "365 jours" },
  { key: "season", label: "Saison" },
];

const nfInt = new Intl.NumberFormat("fr-FR");
const fmtInt = (v: number) => nfInt.format(v);
const fmt1 = (v: number) => v.toFixed(1).replace(".", ",");
const fmt3 = (v: number) => v.toFixed(3).replace(".", ",");
const signed1 = (v: number) => `${v > 0 ? "+" : ""}${fmt1(v)}`;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const fetcher = async (url: string): Promise<SnookerBacktestResponse> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json: unknown = await r.json();
  if (!isBacktestPayload(json)) throw new Error("Payload backtest invalide");
  return json;
};

/** Contrôle de forme du payload (anti crash : l'UI ne doit jamais jeter). */
function isBacktestPayload(d: unknown): d is SnookerBacktestResponse {
  if (!isObj(d)) return false;
  if (!isNum(d.nMatches)) return false;
  if (typeof d.window !== "string" || !WINDOWS.some((w) => w.key === d.window)) return false;
  if (d.error !== null && typeof d.error !== "string") return false;
  // Branche « erreur API » : forme minimale acceptée, l'état vide s'affiche
  // avant tout accès à metrics/baseline (voir l'ordre des tests du rendu).
  if (typeof d.error === "string" && d.error.length > 0) return true;
  if (
    !isObj(d.metrics) ||
    !isNum(d.metrics.accuracy) ||
    !isNum(d.metrics.brier) ||
    !isNum(d.metrics.logLoss)
  ) {
    return false;
  }
  if (
    !isObj(d.baseline) ||
    typeof d.baseline.label !== "string" ||
    !isNum(d.baseline.accuracy) ||
    !isNum(d.baseline.n)
  ) {
    return false;
  }
  return (
    Array.isArray(d.calibration) &&
    Array.isArray(d.dimensions) &&
    typeof d.from === "string" &&
    typeof d.to === "string" &&
    typeof d.source === "string" &&
    typeof d.attribution === "string" &&
    typeof d.computedAt === "string"
  );
}

function MetricCard({
  label,
  value,
  unit,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  unit?: string;
  color: string;
  subtitle?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums" style={{ color }}>
        {value}
        {unit ? <span className="text-sm font-normal text-gray-500">{unit}</span> : null}
      </div>
      {subtitle ? <div className="mt-0.5 text-[11px] text-gray-500">{subtitle}</div> : null}
    </div>
  );
}

/** Barre d'un bucket de calibration : marqueur prédit + point réel. */
function CalibrationRow({ p }: { p: BtCalibrationPoint }) {
  const diff = p.actualRate - p.avgPredicted;
  const ok = Math.abs(diff) <= 5;
  const clamp = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  return (
    <div
      className="flex items-center gap-2"
      title={`Écart réel − prédit : ${signed1(diff)} pts`}
    >
      <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-gray-500">
        {p.range}
      </span>
      <div className="relative h-4 min-w-0 flex-1 rounded bg-gray-50">
        <div
          className="h-4 rounded bg-[#00985f]/20"
          style={{ width: clamp(p.avgPredicted) }}
        />
        <div
          className="absolute top-0 h-4 w-px bg-[#00985f]"
          style={{ left: clamp(p.avgPredicted) }}
        />
        <div
          className="absolute top-0 h-4 w-1.5 -translate-x-1/2 rounded-full"
          style={{
            left: clamp(p.actualRate),
            backgroundColor: ok ? "#10b981" : "#f59e0b",
          }}
        />
      </div>
      <div className="flex w-20 shrink-0 items-center gap-1 text-[10px] tabular-nums">
        <span className={cn("font-semibold", ok ? "text-gray-700" : "text-amber-600")}>
          {fmt1(p.actualRate)} %
        </span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">{fmt1(p.avgPredicted)} %</span>
      </div>
      <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-gray-500">
        n={fmtInt(p.count)}
      </span>
    </div>
  );
}

export function SnookerBacktestHistory() {
  const [win, setWin] = useState<BtWindow>("full");
  const [openDim, setOpenDim] = useState<string | null>("season");

  const { data, error: swrError } = useSWR<SnookerBacktestResponse>(
    `/api/v1/snooker/backtest?window=${win}`,
    fetcher,
    {
      keepPreviousData: true,
      refreshInterval: 0,
      revalidateOnFocus: false,
    },
  );

  // Données d'une autre fenêtre encore affichées pendant la bascule : on
  // atténue plutôt que de vider le panneau (anti clignotement).
  const stale = !!data && data.window !== win;

  const body = (() => {
    if (!data) {
      if (swrError) {
        return (
          <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
            <p className="text-xs text-gray-500">
              Backtest indisponible — l&rsquo;API /api/v1/snooker/backtest n&rsquo;a pas
              répondu.
            </p>
            <p className="mt-1 text-[10px] text-gray-400">{swrError.message}</p>
          </div>
        );
      }
      return (
        <div className="space-y-2" aria-live="polite">
          <p className="sr-only">Chargement du backtest historique…</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      );
    }

    // État vide : base absente ou erreur remontée par l'API. Testé AVANT tout
    // accès à metrics / baseline / calibration.
    if (data.error !== null || data.nMatches === 0) {
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
          <p className="text-sm font-medium text-gray-700">
            Base absente — lancez{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
              node scripts/fetch-snooker-history.mjs
            </code>
          </p>
          <p className="mt-1.5 text-xs text-gray-500">
            Aucun match backtesté sur cette fenêtre (
            {WINDOWS.find((w) => w.key === data.window)?.label ?? data.window}).
          </p>
          {data.error ? (
            <p className="mt-2 text-[10px] text-rose-500">{data.error}</p>
          ) : null}
        </div>
      );
    }

    const { metrics, baseline, calibration, dimensions } = data;
    const delta = metrics.accuracy - baseline.accuracy;
    const brierColor =
      metrics.brier < 0.2 ? "#10b981" : metrics.brier < 0.25 ? "#f59e0b" : "#ef4444";
    const logLossColor =
      metrics.logLoss < 0.5 ? "#10b981" : metrics.logLoss < 0.7 ? "#f59e0b" : "#ef4444";
    const maxCount = calibration.length
      ? Math.max(1, ...calibration.map((c) => c.count))
      : 1;

    return (
      <div className="space-y-3">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Matchs backtestés"
            value={fmtInt(data.nMatches)}
            color="#222222"
            subtitle={`${data.from} → ${data.to}`}
          />
          <MetricCard
            label="Accuracy"
            value={fmt1(metrics.accuracy)}
            unit=" %"
            color="#00985f"
            subtitle="Prédictions correctes"
          />
          <MetricCard
            label="Brier"
            value={fmt3(metrics.brier)}
            color={brierColor}
            subtitle="0 = parfait, 1 = pire"
          />
          <MetricCard
            label="LogLoss"
            value={fmt3(metrics.logLoss)}
            color={logLossColor}
            subtitle="Plus bas = meilleur"
          />
          <MetricCard
            label={baseline.label}
            value={fmt1(baseline.accuracy)}
            unit=" %"
            color="#222222"
            subtitle={
              <>
                <span className={delta >= 0 ? "text-emerald-600" : "text-rose-500"}>
                  Δ modèle {signed1(delta)} pts
                </span>{" "}
                · n {fmtInt(baseline.n)}
              </>
            }
          />
        </div>

        {/* Calibration */}
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
            Calibration — Prédit vs Réel
          </h3>
          {calibration.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun bucket de calibration.</p>
          ) : (
            <>
              <div className="space-y-2">
                {calibration.map((p) => (
                  <CalibrationRow key={p.range} p={p} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-px bg-[#00985f]" /> Prédit (barre +
                  trait)
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                  Réel — écart ≤ 5 pts
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />{" "}
                  Écart &gt; 5 pts
                </span>
                <span className="text-[10px] text-gray-400">
                  Largeur de barre proportionnelle à n (max {fmtInt(maxCount)})
                </span>
              </div>
            </>
          )}
        </div>

        {/* Segmentations */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">
            Segmentations
          </h3>
          {dimensions.map((dim) => {
            const open = openDim === dim.key;
            const top = [...dim.segments]
              .sort((a, b) => b.nMatches - a.nMatches)
              .slice(0, 15);
            const rest = dim.segments.length - top.length;
            return (
              <div
                key={dim.key}
                className="rounded-xl border border-gray-100 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenDim(open ? null : dim.key)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                    {dim.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] tabular-nums text-gray-500">
                    {dim.segments.length} segment{dim.segments.length > 1 ? "s" : ""}
                    <svg
                      className={cn(
                        "h-3.5 w-3.5 text-gray-400 transition-transform",
                        open && "rotate-180",
                      )}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto border-t border-gray-100">
                    <table className="w-full text-xs">
                      <caption className="sr-only">
                        Performance par segment — {dim.label}
                      </caption>
                      <thead>
                        <tr className="th-broadcast border-b border-gray-100 text-left text-gray-500 text-[12px]">
                          <th className="px-4 py-1.5">Segment</th>
                          <th className="px-2 py-1.5 text-right">Matchs</th>
                          <th className="px-2 py-1.5 text-right">Accuracy</th>
                          <th className="px-4 py-1.5 text-right">Brier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {top.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-3 text-center text-gray-500"
                            >
                              Aucun segment sur cette fenêtre.
                            </td>
                          </tr>
                        ) : (
                          top.map((s) => (
                            <tr key={s.key}>
                              <td className="px-4 py-1.5">
                                <span
                                  className="block max-w-[200px] truncate sm:max-w-none"
                                  title={s.label}
                                >
                                  {s.label}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                                {fmtInt(s.nMatches)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                                {fmt1(s.accuracy)} %
                              </td>
                              <td className="px-4 py-1.5 text-right tabular-nums text-gray-500">
                                {fmt3(s.brier)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {rest > 0 ? (
                      <p className="px-4 py-1.5 text-[10px] text-gray-400">
                        … {rest} autre{rest > 1 ? "s" : ""} segment
                        {rest > 1 ? "s" : ""} non affiché{rest > 1 ? "s" : ""} (top 15 par
                        volume)
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  })();

  return (
    <section className="space-y-3">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#00985f]/10">
            <svg
              className="h-3.5 w-3.5 text-[#00985f]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-gray-900">
              Backtest historique
            </h2>
            <p className="text-[11px] leading-snug text-gray-500">
              Walk-forward Elo sur les matchs SnookerDB 1907 → 2026 — précision et
              calibration du modèle. Pas de ROI : l&rsquo;historique ne contient pas de
              cotes.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
          {data?.attribution ?? "SnookerDB / CueTracker (GPL-3.0)"}
        </span>
      </div>

      {/* Fenêtre temporelle */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fenêtre d'analyse">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => setWin(w.key)}
            aria-pressed={win === w.key}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              win === w.key
                ? "border-transparent bg-[#00985f] text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50",
            )}
          >
            {w.label}
          </button>
        ))}
        {stale ? (
          <span className="self-center text-[10px] text-gray-400" aria-live="polite">
            Mise à jour…
          </span>
        ) : null}
      </div>

      <div className={cn(stale && "opacity-60 transition-opacity")}>{body}</div>

      {/* Footer */}
      {data ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
          <span>Calculé le {fmtDateTime(data.computedAt)}</span>
          <span>Source : {data.source}</span>
          <span>{data.attribution}</span>
        </div>
      ) : null}
    </section>
  );
}
