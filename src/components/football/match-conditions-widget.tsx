"use client";

import { cn } from "@/lib/utils";
import { CloudRain, Sun, Cloud, Thermometer, MapPin, User } from "lucide-react";

export type RefereeConditions = {
  refereeName?: string | null;
  refereeYellowAvg?: number | null;
  refereeRedAvg?: number | null;
  stadium?: string | null;
  weather?: string | null;
};

type Props = {
  conditions?: RefereeConditions | null;
};

function severityColor(avg: number): { bar: string; label: string; cls: string } {
  if (avg >= 5) return { bar: "bg-rose-500", label: "Très sévère", cls: "text-rose-400" };
  if (avg >= 3.5) return { bar: "bg-amber-500", label: "Sévère", cls: "text-amber-400" };
  if (avg >= 2) return { bar: "bg-emerald-500", label: "Modéré", cls: "text-emerald-400" };
  return { bar: "bg-sky-500", label: "Clément", cls: "text-sky-400" };
}

function WeatherIcon({ weather }: { weather?: string | null }) {
  const w = (weather ?? "").toLowerCase();
  if (w.includes("pluie") || w.includes("rain")) return <CloudRain className="h-5 w-5 text-sky-400" />;
  if (w.includes("nuage") || w.includes("cloud")) return <Cloud className="h-5 w-5 text-slate-400" />;
  return <Sun className="h-5 w-5 text-amber-400" />;
}

export function MatchConditionsWidget({ conditions }: Props) {
  if (!conditions) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 text-sm text-slate-500">
        Conditions du match indisponibles
      </div>
    );
  }

  const { refereeName, refereeYellowAvg, refereeRedAvg, stadium, weather } = conditions;
  const sev = refereeYellowAvg != null ? severityColor(refereeYellowAvg) : null;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Conditions de match</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Arbitre */}
        <div className="flex items-start gap-3 rounded-lg bg-slate-800/40 p-3">
          <User className="mt-0.5 h-4 w-4 text-slate-500" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">Arbitre</div>
            <div className="truncate font-medium text-slate-200">{refereeName ?? "—"}</div>
            {sev && (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className={sev.cls}>{sev.label}</span>
                  <span className="text-slate-500">{refereeYellowAvg?.toFixed(1)} jaunes/match</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={cn("h-full rounded-full transition-all", sev.bar)}
                    style={{ width: `${Math.min(100, ((refereeYellowAvg ?? 0) / 6) * 100)}%` }}
                  />
                </div>
                {refereeRedAvg != null && refereeRedAvg > 0 && (
                  <div className="mt-1 text-[10px] text-slate-500">{(refereeRedAvg * 10).toFixed(1)} rouges/10 matchs</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stade + Météo */}
        <div className="flex items-start gap-3 rounded-lg bg-slate-800/40 p-3">
          <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">Stade</div>
            <div className="truncate font-medium text-slate-200">{stadium ?? "—"}</div>
            {weather && (
              <div className="mt-2 flex items-center gap-2">
                <WeatherIcon weather={weather} />
                <span className="text-xs text-slate-300">{weather}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
