"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SnookerPlayerStats {
  id: string;
  name: string;
  nationality?: string;
  ranking?: number;
  eloRating: number;
  winPct?: number;
  centuryRate?: number;
  break50Rate?: number;
  deciderWinPct?: number;
  avgBreak?: number;
  formLast10?: string;
}

function getCountryFlag(nationality?: string): string {
  const flags: Record<string, string> = {
    England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    China: "🇨🇳", "Hong Kong": "🇭🇰", Australia: "🇦🇺", Belgium: "🇧🇪",
    Iran: "🇮🇷", Thailand: "🇹🇭", Malta: "🇲🇹", Germany: "🇩🇪",
    Netherlands: "🇳🇱", Brazil: "🇧🇷", India: "🇮🇳",
  };
  return flags[nationality || ""] || "🎱";
}

function FormIndicator({ form }: { form: string }) {
  if (!form) return null;
  return (
    <div className="flex gap-0.5">
      {form.slice(-10).split("").map((c, i) => (
        <div
          key={i}
          className={cn(
            "w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold",
            c === "W" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

function StatBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-300">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SnookerPlayerCard({ player }: { player: SnookerPlayerStats }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg">
            {getCountryFlag(player.nationality)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{player.name}</h3>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              {player.nationality && <span>{player.nationality}</span>}
              {player.ranking && <span>#{player.ranking}</span>}
              <span className="font-mono text-emerald-400">Elo {Math.round(player.eloRating)}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        {player.formLast10 && (
          <div className="mb-3">
            <div className="text-[10px] text-zinc-500 mb-1">Forme (10 derniers)</div>
            <FormIndicator form={player.formLast10} />
          </div>
        )}

        {/* Stats */}
        <div className="space-y-2">
          {player.winPct != null && <StatBar label="Win Rate" value={player.winPct} />}
          {player.centuryRate != null && <StatBar label="Century Rate" value={player.centuryRate} />}
          {player.break50Rate != null && <StatBar label="Break 50+ Rate" value={player.break50Rate} />}
          {player.deciderWinPct != null && <StatBar label="Decider Win %" value={player.deciderWinPct} />}
          {player.avgBreak != null && (
            <div className="flex justify-between text-[10px] pt-1">
              <span className="text-zinc-500">Avg Break</span>
              <span className="font-mono text-zinc-300">{player.avgBreak.toFixed(0)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
