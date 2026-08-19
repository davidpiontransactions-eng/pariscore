"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVE_MAP_POOL } from "@/lib/prediction/cs2/cs2-predictive-ml-engine";
import type { Cs2Enrichment } from "@/lib/cs2/types";
import {
  displayTeamName,
  abbrevTeamName,
  formatCS2Winrate,
  smoothWinrate,
} from "@/lib/cs2/format";

function trendIcon(trend: "rising" | "declining" | "stable" | null | undefined) {
  if (trend === "rising") return <TrendingUp className="h-3.5 w-3.5 text-[#00E676]" />;
  if (trend === "declining") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  if (trend === "stable") return <Minus className="h-3.5 w-3.5 text-zinc-500" />;
  return null;
}

function WinrateBars({ t1, t2 }: { t1: number | null; t2: number | null }) {
  const a = t1 ?? 0;
  const b = t2 ?? 0;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
      <div className="bg-orange-500/80" style={{ width: `${a}%` }} />
      <div className="w-0.5 bg-white/20" />
      <div className="bg-blue-500/80" style={{ width: `${b}%` }} />
    </div>
  );
}

function h2hDateLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function CS2MapPoolAnalytics({ enrichment }: { enrichment: Cs2Enrichment }) {
  const t1 = enrichment.team1;
  const t2 = enrichment.team2;
  const h2h = enrichment.h2h;
  const pistol = enrichment.pistol_index;
  const t1Name = displayTeamName(t1.name);
  const t2Name = displayTeamName(t2.name);

  return (
    <div className="space-y-8">
      {/* ── Map Pool 3-6 mois ── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-white">🗺️ Map Pool — winrate 3 mois (vs 6 mois)</h3>
        {ACTIVE_MAP_POOL.some((map) => {
          const m1 = t1.map_trends?.[map] ?? null;
          const m2 = t2.map_trends?.[map] ?? null;
          return m1?.wr_3m != null || m2?.wr_3m != null;
        }) ? (
          <div className="space-y-3">
            {ACTIVE_MAP_POOL.map((map) => {
              const m1 = t1.map_trends?.[map] ?? null;
              const m2 = t2.map_trends?.[map] ?? null;
              // Lissage bayésien des extrêmes (0%/100% = artefacts de faible échantillon)
              const wr1 = smoothWinrate(m1?.wr_3m ?? null);
              const wr2 = smoothWinrate(m2?.wr_3m ?? null);
              if (wr1 == null && wr2 == null) return null;
              return (
                <div key={map} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">{map}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[11px] text-orange-400">
                        {trendIcon(m1?.trend)} {formatCS2Winrate(wr1)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-blue-400">
                        {formatCS2Winrate(wr2)} {trendIcon(m2?.trend)}
                      </span>
                    </div>
                  </div>
                  <WinrateBars t1={wr1} t2={wr2} />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>
                      {t1Name} {m1?.wr_6m != null ? `· 6m ${formatCS2Winrate(m1.wr_6m)}` : ""}
                      {m1?.map_rank_3m ? ` · #${m1.map_rank_3m}` : ""}
                    </span>
                    <span>
                      {m2?.map_rank_3m ? `#${m2.map_rank_3m} · ` : ""}
                      {m2?.wr_6m != null ? `6m ${formatCS2Winrate(m2.wr_6m)} · ` : ""}
                      {t2Name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Données map pool indisponibles pour ce duel (équipes absentes des fichiers HLTV).
          </p>
        )}
      </section>

      {/* ── CT/T + Pistol ── */}
      {(t1.map_stats_meta || t2.map_stats_meta || pistol) && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-white">🎯 Côtés CT/T & Pistol</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <p className="mb-1 text-[11px] text-zinc-400">{t1Name}</p>
              <div className="flex gap-4 text-xs">
                <span className="text-sky-400">
                  CT <span className="font-bold">{formatCS2Winrate(t1.map_stats_meta?.round_winrate_ct)}</span>
                </span>
                <span className="text-amber-400">
                  T <span className="font-bold">{formatCS2Winrate(t1.map_stats_meta?.round_winrate_t)}</span>
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <p className="mb-1 text-[11px] text-zinc-400">{t2Name}</p>
              <div className="flex gap-4 text-xs">
                <span className="text-sky-400">
                  CT <span className="font-bold">{formatCS2Winrate(t2.map_stats_meta?.round_winrate_ct)}</span>
                </span>
                <span className="text-amber-400">
                  T <span className="font-bold">{formatCS2Winrate(t2.map_stats_meta?.round_winrate_t)}</span>
                </span>
              </div>
            </div>
          </div>
          {pistol && (
            <p className="mt-2 text-[11px] text-zinc-500">
              Pistol index : ΔCT {pistol.ct_delta}pp · ΔT {pistol.t_delta}pp
              {pistol.trade_signal ? ` — ${pistol.trade_signal}` : ""}
            </p>
          )}
        </section>
      )}

      {/* ── H2H ── */}
      {h2h && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-white">⚔️ Historique direct (H2H)</h3>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-lg font-bold text-orange-400">{h2h.t1wins}</p>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{t1Name}</p>
            </div>
            <span className="text-xs font-semibold text-zinc-500">vs</span>
            <div className="flex-1 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-lg font-bold text-blue-400">{h2h.t2wins}</p>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{t2Name}</p>
            </div>
          </div>

          {/* Séquence W/L (chronologique) */}
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {h2h.results.map((r, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold",
                  r === "T1" && "bg-orange-500/20 text-orange-400",
                  r === "T2" && "bg-blue-500/20 text-blue-400",
                  r === "N" && "bg-white/5 text-zinc-500",
                )}
              >
                {r === "T1" ? "W" : r === "T2" ? "W" : "–"}
              </span>
            ))}
            <span className="ml-2 text-[11px] text-zinc-600">({h2h.n} derniers)</span>
          </div>

          {/* Détail par confrontation */}
          {h2h.detail && h2h.detail.length > 0 && (
            <div className="space-y-1.5">
              {h2h.detail.slice(0, 10).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-1.5 text-[11px]"
                >
                  <span className="w-16 shrink-0 text-zinc-500">{h2hDateLabel(d.date)}</span>
                  <span
                    className={cn(
                      "w-8 text-center font-bold",
                      d.winner === "T1" && "text-orange-400",
                      d.winner === "T2" && "text-blue-400",
                      d.winner === "N" && "text-zinc-500",
                    )}
                  >
                    {d.winner === "T1" ? abbrevTeamName(t1.name) : d.winner === "T2" ? abbrevTeamName(t2.name) : "N"}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5">
                    {d.maps.map((mp, j) => (
                      <span key={j} className="text-zinc-400">
                        <span className="text-zinc-600">{mp.name ? mp.name.replace("de_", "") : "?"}</span>{" "}
                        <span className="font-mono tabular-nums">
                          {mp.k1_score ?? "–"}–{mp.k2_score ?? "–"}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
