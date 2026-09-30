"use client";

/**
 * BasketballStandings — sous-onglet « Stats & Classements ».
 * 1) Tableau classement triable/filtrable par métrique (PPG Home/Away, Points
 *    saison, FG%, RPG, AST, TO…) + filtre conférence East/West/All.
 * 2) Heatmap de rangs style matplotlib (équipes × métriques, vert = 1er,
 *    rouge = dernier, avec barre de couleur) comme la référence produit.
 * Charte FotMob light (fond clair, cf. fotmob-theme).
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useBasketballStandings } from "@/hooks/use-basketball-standings";
import {
  METRICS,
  computeRanks,
  filterConference,
  rankColor,
  resolveMetric,
  sortByMetric,
  type MetricDef,
} from "@/lib/basketball-standings";

type Conf = "all" | "East" | "West";

function Skeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-black/[0.06]" />
      ))}
    </div>
  );
}

/** Barre de couleur de la heatmap (légende 1er → dernier). */
function Colorbar() {
  const stops = Array.from({ length: 12 }, (_, i) => rankColor(i + 1, 12));
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[#717171]">
      <span>1er</span>
      <div className="flex h-3 w-28 overflow-hidden rounded-sm border border-black/10">
        {stops.map((c, i) => (
          <div key={i} style={{ background: c }} className="h-full flex-1" />
        ))}
      </div>
      <span>dernier</span>
    </div>
  );
}

export function BasketballStandings({ className }: { className?: string }) {
  const [league, setLeague] = useState<"nba" | "wnba">("nba");
  const { data, isLoading, error } = useBasketballStandings(league);

  const [conf, setConf] = useState<Conf>("all");
  const [metricKey, setMetricKey] = useState<string>("ppg");
  const [heatmap, setHeatmap] = useState(false);

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[1];

  const teams = useMemo(() => data?.teams ?? [], [data]);
  const confTeams = useMemo(() => filterConference(teams, conf), [teams, conf]);
  const sorted = useMemo(() => sortByMetric(confTeams, metric), [confTeams, metric]);
  const ranks = useMemo(() => computeRanks(confTeams), [confTeams]);

  const fmt = (t: (typeof teams)[number], m: MetricDef): string => {
    const v = resolveMetric(t, String(m.key));
    if (v == null) return "—";
    return v.toFixed(m.decimals);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre de contrôle */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Ligue */}
        <div className="flex rounded-lg bg-black/[0.06] p-0.5">
          {(["nba", "wnba"] as const).map((lg) => (
            <button
              key={lg}
              onClick={() => setLeague(lg)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold uppercase transition-colors",
                league === lg ? "bg-white text-[#00985f] shadow-sm" : "text-[#717171]",
              )}
            >
              {lg}
            </button>
          ))}
        </div>
        {/* Conférence */}
        <div className="flex rounded-lg bg-black/[0.06] p-0.5">
          {([["all", "Toutes"], ["East", "Est"], ["West", "Ouest"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setConf(id)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                conf === id ? "bg-white text-[#222] shadow-sm" : "text-[#717171]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Toggle tableau / heatmap */}
        <div className="flex rounded-lg bg-black/[0.06] p-0.5">
          <button
            onClick={() => setHeatmap(false)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              !heatmap ? "bg-white text-[#222] shadow-sm" : "text-[#717171]",
            )}
          >
            📋 Classement
          </button>
          <button
            onClick={() => setHeatmap(true)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              heatmap ? "bg-white text-[#222] shadow-sm" : "text-[#717171]",
            )}
          >
            🔥 Heatmap
          </button>
        </div>
        {/* Filtre métrique (tableau) */}
        {!heatmap && (
          <label className="flex items-center gap-1.5 text-xs text-[#717171]">
            Trier par
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-[#222]"
            >
              {METRICS.map((m) => (
                <option key={String(m.key)} value={String(m.key)}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">
          Classements indisponibles : {error}
        </div>
      )}

      {isLoading && <Skeleton />}

      {!isLoading && !error && sorted.length === 0 && (
        <div className="rounded-xl border border-black/5 bg-white p-8 text-center text-sm text-[#717171]">
          Aucune donnée de classement pour cette ligue.
        </div>
      )}

      {/* ── Vue tableau ─────────────────────────────────────────────── */}
      {!isLoading && !error && sorted.length > 0 && !heatmap && (
        <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-black/10 text-left text-[#717171]">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Équipe</th>
                <th className="px-3 py-2 font-medium">V-D</th>
                {METRICS.map((m) => (
                  <th
                    key={String(m.key)}
                    className={cn(
                      "cursor-pointer whitespace-nowrap px-3 py-2 font-medium hover:text-[#222]",
                      m.key === metric.key && "text-[#00985f]",
                    )}
                    onClick={() => setMetricKey(String(m.key))}
                    title={m.label}
                  >
                    {m.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-3 py-2 text-[#717171]">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {t.logo && (
                         
                        <img src={t.logo} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                      )}
                      <span className="font-medium text-[#222]">{t.name}</span>
                      <span className="text-[10px] uppercase text-[#717171]">{t.conference?.[0] ?? ""}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[#717171]">
                    {t.wins != null && t.losses != null ? `${t.wins}-${t.losses}` : "—"}
                  </td>
                  {METRICS.map((m) => (
                    <td
                      key={String(m.key)}
                      className={cn(
                        "px-3 py-2 tabular-nums",
                        m.key === metric.key ? "font-semibold text-[#222]" : "text-[#545454]",
                      )}
                    >
                      {fmt(t, m)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vue heatmap ─────────────────────────────────────────────── */}
      {!isLoading && !error && sorted.length > 0 && heatmap && (
        <div className="rounded-xl border border-black/5 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-[#222]">
              {conf === "all" ? "Classements par stat" : conf === "East" ? "Eastern Conference" : "Western Conference"} — rangs {league.toUpperCase()}
            </div>
            <Colorbar />
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[#222]">Équipe</th>
                  {METRICS.map((m) => (
                    <th key={String(m.key)} className="h-24 w-9 px-1 align-bottom">
                      <span className="inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-[10px] font-medium text-[#545454]">
                        {m.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const rk = ranks.get(t.id) ?? {};
                  const maxRank = confTeams.length;
                  return (
                    <tr key={t.id}>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-[#222]">
                        {t.logo && (
                           
                          <img src={t.logo} alt="" className="mr-1.5 inline h-4 w-4 object-contain align-middle" loading="lazy" />
                        )}
                        {t.name}
                      </td>
                      {METRICS.map((m) => {
                        const r = rk[String(m.key)];
                        const val = resolveMetric(t, m.key);
                        return (
                          <td
                            key={String(m.key)}
                            className="px-1 py-0.5 text-center font-medium tabular-nums"
                            style={{ background: r ? rankColor(r, maxRank) : "#f5f5f5" }}
                            title={val != null ? `${m.label} : ${val.toFixed(m.decimals)} (rang ${r ?? "—"})` : m.label}
                          >
                            {r ?? ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-[#717171]">
            Chaque cellule = rang de l&apos;équipe pour la stat (1 = meilleur, vert · dernier = rouge).
            PPG Home/Away & points : calculés sur {league.toUpperCase()} {data?.season} (basketball_match_history) ·
            pourcentages & moyennes : ESPN.
          </p>
        </div>
      )}
    </div>
  );
}
