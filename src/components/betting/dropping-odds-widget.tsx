"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DroppingOddsMatch {
  league: string;
  time: string;
  home: string;
  away: string;
  dropPct: number;
  drops: string[];
}

function DropBadge({ pct }: { pct: number }) {
  if (pct >= 15) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">🔴 {pct}%</Badge>;
  }
  if (pct >= 10) {
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">🟡 {pct}%</Badge>;
  }
  return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">🟢 {pct}%</Badge>;
}

export function DroppingOddsWidget({ matches }: { matches: DroppingOddsMatch[] }) {
  if (!matches || matches.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>📉</span> Dropping Odds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">Aucune dropping odds détectée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>📉</span> Dropping Odds
          <Badge variant="outline" className="text-[10px] ml-auto">{matches.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
        {matches.map((m, i) => (
          <div key={i} className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">{m.league} · {m.time}</span>
              <DropBadge pct={m.dropPct} />
            </div>
            <div className="text-xs font-medium">
              {m.home} vs {m.away}
            </div>
            {m.drops.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {m.drops.map((d, j) => (
                  <span key={j} className="text-[10px] text-amber-400 font-mono">{d}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
