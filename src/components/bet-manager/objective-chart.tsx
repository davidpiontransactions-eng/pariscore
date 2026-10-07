"use client";

// Graphique Réel vs Objectif (mission 2026-10-07) : gains cumulés réels du
// plan de paris contre la trajectoire théorique du plan +20 %/j. Les zones
// entre les deux courbes sont colorées par un empilement à base transparente :
//   base = min(réel, objectif) (invisible) + avance (vert) / retard (rouge)
// → le remplissage occupe exactement l'écart entre les courbes.
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addDaysKey,
  cumulativeProfitAt,
  cumulativeProfitByDay,
  objectiveGainsAt,
  todayKey,
  type BankLoan,
  type PlanParams,
} from "@/lib/bet-manager/plan";
import type { Bet } from "@/lib/bet-manager/types";

type Row = {
  key: string;
  reel: number;
  objectif: number;
  base: number;
  avance: number;
  retard: number;
};

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  const delta = row.reel - row.objectif;
  return (
    <div className="rounded-lg border border-white/10 bg-white px-3 py-2 shadow-xl">
      <div className="text-[10px] uppercase tracking-widest text-[#6B5B8D]">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-emerald-600">Réel {fmt(row.reel)} €</div>
      <div className="font-mono text-sm font-semibold text-slate-500">Objectif {fmt(row.objectif)} €</div>
      <div className={delta >= 0 ? "font-mono text-xs text-emerald-600" : "font-mono text-xs text-red-500"}>
        {delta >= 0 ? "Avance" : "Retard"} {fmt(Math.abs(delta))} €
      </div>
    </div>
  );
}

export function ObjectiveChart({
  bets,
  planParams,
  loan,
}: {
  bets: Bet[];
  planParams: PlanParams;
  /** Emprunt banque : l'objectif affiché inclut l'amortissement cumulé. */
  loan?: BankLoan | null;
}) {
  const data = useMemo<Row[]>(() => {
    const cum = cumulativeProfitByDay(bets);
    const today = todayKey();
    const endKey = addDaysKey(planParams.startDate, planParams.days - 1);
    const last = today < endKey ? today : endKey;
    if (planParams.startDate > last) return [];
    // Granularité : au plus ~180 points (plans longs → pas de plusieurs jours)
    const step = planParams.days > 180 ? Math.ceil(planParams.days / 180) : 1;
    const out: Row[] = [];
    for (let j = 0; j < planParams.days; j += step) {
      const key = addDaysKey(planParams.startDate, j);
      if (key > last) break;
      const objectif = objectiveGainsAt(planParams, key, loan) ?? 0;
      const reel = cumulativeProfitAt(cum, key);
      const delta = reel - objectif;
      out.push({
        key,
        reel,
        objectif,
        base: Math.min(reel, objectif),
        avance: Math.max(0, delta),
        retard: Math.max(0, -delta),
      });
    }
    return out;
  }, [bets, planParams, loan]);

  if (data.length === 0) {
    return (
      <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Objectif vs Réel</h2>
        <p className="mt-2 text-xs text-zinc-500">
          Le plan commence le {planParams.startDate} — aucune donnée à afficher avant cette date.
        </p>
      </section>
    );
  }

  const lastRow = data[data.length - 1];
  const delta = lastRow.reel - lastRow.objectif;

  return (
    <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Objectif vs Réel</h2>
          <p className="mt-0.5 text-[11px] text-[#6B5B8D]">
            Gains cumulés · objectif +{planParams.targetPct} %/j depuis le {planParams.startDate} ({planParams.days} j)
          </p>
        </div>
        <span
          className={
            "rounded-lg px-2 py-1 font-mono text-xs font-semibold " +
            (delta >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")
          }
          title={delta >= 0 ? "Avance sur l'objectif" : "Retard sur l'objectif"}
        >
          {delta >= 0 ? "▲ Avance" : "▼ Retard"} {fmt(Math.abs(delta))} €
        </span>
      </div>

      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="key"
              tickFormatter={(k: string) => k.slice(5).replace("-", "/")}
              tick={{ fill: "#6B5B8D", fontSize: 10 }}
              stroke="hsl(var(--border))"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "#6B5B8D", fontSize: 10 }}
              stroke="hsl(var(--border))"
              width={48}
              tickFormatter={(v: number) => `${fmt(v)} €`}
            />
            <Tooltip content={<ChartTooltip />} />
            {/* Empilement à base transparente : le remplissage couvre l'écart exact. */}
            <Area type="monotone" dataKey="base" stackId="delta" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area
              type="monotone"
              dataKey="avance"
              stackId="delta"
              stroke="none"
              fill="#10b981"
              fillOpacity={0.25}
              name="Avance"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="retard"
              stackId="delta"
              stroke="none"
              fill="#ef4444"
              fillOpacity={0.25}
              name="Retard"
              isAnimationActive={false}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Line type="monotone" dataKey="objectif" stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={2} dot={false} name="Objectif" />
            <Line type="monotone" dataKey="reel" stroke="#10b981" strokeWidth={2.5} dot={false} name="Réel" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-[#6B5B8D]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-emerald-500" /> Réel cumulé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-slate-400" style={{ borderTop: "2px dashed #94a3b8", background: "transparent", height: 0 }} />{" "}
          Objectif théorique
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/40" /> Avance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/40" /> Retard
        </span>
      </div>
    </section>
  );
}
