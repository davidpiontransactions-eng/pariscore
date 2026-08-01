import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketTopEntry } from "@/lib/league-stats";

const MARKET_CONFIG: {
  key: string;
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

export function LeagueMarketWidget({
  label,
  icon,
  entries,
  higherIsBetter,
  format,
}: {
  label: string;
  icon: string;
  entries: MarketTopEntry[];
  higherIsBetter: boolean;
  format: (v: number) => string;
}) {
  const sorted = higherIsBetter
    ? [...entries].sort((a, b) => b.value - a.value)
    : [...entries].sort((a, b) => a.value - b.value);

  const max = sorted[0]?.value ?? 1;
  const min = sorted[sorted.length - 1]?.value ?? 0;
  const range = max - min || 1;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold tracking-tight">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1.5">
        {sorted.slice(0, 5).map((entry, i) => (
          <div key={entry.teamId} className="flex items-center gap-2">
            <span className="w-4 text-[11px] font-mono text-muted-foreground text-right">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium truncate">
                  {entry.shortName}
                </span>
                <span className="text-[11px] font-mono font-semibold tabular-nums ml-1">
                  {format(entry.value)}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{
                    width: `${Math.max(5, ((entry.value - min) / range) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-2">
            Données insuffisantes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
