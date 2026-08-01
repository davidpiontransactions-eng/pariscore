"use client";

import type { MarketTops } from "@/lib/league-stats";
import { LeagueMarketWidget } from "./league-market-widget";

const MARKETS: {
  key: keyof MarketTops;
  label: string;
  icon: string;
  higherIsBetter: boolean;
  format: (v: number) => string;
}[] = [
  { key: "pointsPerGame", label: "PPG", icon: "📊", higherIsBetter: true, format: (v) => v.toFixed(1) },
  { key: "over15Pct", label: "Over 1.5 %", icon: "🎯", higherIsBetter: true, format: (v) => `${v}%` },
  { key: "under35Pct", label: "Under 3.5 %", icon: "🛡️", higherIsBetter: true, format: (v) => `${v}%` },
  { key: "bttsYesPct", label: "BTTS Yes %", icon: "🥅", higherIsBetter: true, format: (v) => `${v}%` },
  { key: "xG", label: "Attaque (xG)", icon: "⚽", higherIsBetter: true, format: (v) => v.toFixed(1) },
  { key: "xGA", label: "Défense (xGA)", icon: "🧤", higherIsBetter: false, format: (v) => v.toFixed(1) },
];

export function LeagueMarketTops({ tops }: { tops: MarketTops }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {MARKETS.map((mkt) => (
        <LeagueMarketWidget
          key={mkt.key}
          label={mkt.label}
          icon={mkt.icon}
          entries={tops[mkt.key] ?? []}
          higherIsBetter={mkt.higherIsBetter}
          format={mkt.format}
        />
      ))}
    </div>
  );
}
