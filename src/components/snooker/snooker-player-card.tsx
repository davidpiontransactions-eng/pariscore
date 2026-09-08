"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
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
  photoUrl?: string;
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

// ─── Nationalité → code ISO alpha-2 pour CountryFlag ──────────────────────
function nationalityToCode(nat?: string): string | undefined {
  if (!nat) return undefined;
  const map: Record<string, string> = {
    England: "gb", Scotland: "gb", Wales: "gb",
    "Northern Ireland": "gb", Ireland: "ie",
    Australia: "au", China: "cn", "Hong Kong": "hk",
    Belgium: "be", Iran: "ir", Thailand: "th",
    Malta: "mt", Germany: "de", Netherlands: "nl",
    Brazil: "br", Canada: "ca", India: "in",
    Pakistan: "pk",
  };
  return map[nat] ?? undefined;
}

export function SnookerPlayerCard({ player }: { player: SnookerPlayerStats }) {
  return (
    <Card className="group overflow-hidden border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
      {/* Glass shine */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <CardContent className="relative z-10 p-4">
        {/* Header with PlayerAvatar */}
        <div className="flex items-center gap-3 mb-3">
          <PlayerAvatar
            name={player.name}
            photoUrl={player.photoUrl}
            size="md"
            sport="snooker"
            countryCode={nationalityToCode(player.nationality)}
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate text-zinc-100">{player.name}</h3>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              {player.nationality && <span>{player.nationality}</span>}
              {player.ranking && <span>#{player.ranking}</span>}
              <span className="font-mono text-emerald-400 font-semibold">Elo {Math.round(player.eloRating)}</span>
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

        {/* Stats avec barres néon */}
        <div className="space-y-2">
          {player.winPct != null && <StatBar label="Win Rate" value={player.winPct} />}
          {player.centuryRate != null && <StatBar label="Century Rate" value={player.centuryRate} max={20} />}
          {player.break50Rate != null && <StatBar label="Break 50+ Rate" value={player.break50Rate} />}
          {player.deciderWinPct != null && <StatBar label="Decider Win %" value={player.deciderWinPct} />}
          {player.avgBreak != null && (
            <div className="flex justify-between text-[10px] pt-1 border-t border-zinc-800/30">
              <span className="text-zinc-500">Avg Break</span>
              <span className="font-mono text-emerald-400 font-semibold">{player.avgBreak.toFixed(0)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
