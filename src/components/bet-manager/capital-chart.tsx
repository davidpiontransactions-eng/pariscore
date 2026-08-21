"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { CapitalPoint } from "@/lib/bet-manager/types";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as CapitalPoint;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1117] px-3 py-2 shadow-xl">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">
        {p.key === "start" ? "Départ" : p.key}
      </div>
      <div className="font-mono text-sm font-semibold text-white">
        {Number(p.bankroll).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
      </div>
      {p.profit !== 0 && (
        <div className={cn("font-mono text-xs", p.profit > 0 ? "text-emerald-400" : "text-red-400")}>
          {p.profit > 0 ? "+" : ""}
          {p.profit.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
        </div>
      )}
    </div>
  );
}

export function CapitalChart({ curve, currency }: { curve: CapitalPoint[]; currency: string }) {
  const data = curve.map((p) => ({ ...p, label: p.key === "start" ? "Départ" : p.key }));
  const positive = (curve[curve.length - 1]?.bankroll ?? 0) >= (curve[0]?.bankroll ?? 0);
  const stroke = positive ? "#10b981" : "#f43f5e";
  const fill = positive ? "#10b981" : "#f43f5e";

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Évolution du capital
        </h3>
        <span className="font-mono text-[11px] text-zinc-500">{currency}</span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
            <defs>
              <linearGradient id="capitalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity={0.25} />
                <stop offset="100%" stopColor={fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => `${Math.round(v)}`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="bankroll"
              stroke={stroke}
              strokeWidth={2}
              fill="url(#capitalFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}