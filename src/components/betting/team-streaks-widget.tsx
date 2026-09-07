"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TeamStreak {
  teamName: string;
  streakType: string;
  count: number;
  isActive: boolean;
  venue?: string;
}

function streakLabel(type: string): string {
  const labels: Record<string, string> = {
    WIN: "Victoires",
    LOSS: "Défaites",
    BTTS: "Les 2 marquent",
    OVER25: "Over 2.5",
    UNDER25: "Under 2.5",
    CLEAN_SHEET: "Clean Sheet",
    SCORED: "Marque",
    CONCEDED: "Encaisse",
    UNBEATEN: "Invaincu",
  };
  return labels[type] || type;
}

function streakColor(type: string, count: number): string {
  if (["WIN", "UNBEATEN", "SCORED", "CLEAN_SHEET"].includes(type)) {
    if (count >= 5) return "text-emerald-400";
    if (count >= 3) return "text-emerald-300";
    return "text-zinc-400";
  }
  if (["LOSS", "CONCEDED"].includes(type)) {
    if (count >= 5) return "text-red-400";
    if (count >= 3) return "text-red-300";
    return "text-zinc-400";
  }
  return "text-zinc-400";
}

export function TeamStreaksWidget({ streaks }: { streaks: TeamStreak[] }) {
  if (!streaks || streaks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>🔥</span> Séquences Équipes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">Aucune séquence active</p>
        </CardContent>
      </Card>
    );
  }

  // Group by team
  const byTeam = streaks.reduce<Record<string, TeamStreak[]>>((acc, s) => {
    if (!acc[s.teamName]) acc[s.teamName] = [];
    acc[s.teamName].push(s);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>🔥</span> Séquences Équipes
          <Badge variant="outline" className="text-[10px] ml-auto">{Object.keys(byTeam).length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[300px] overflow-y-auto">
        {Object.entries(byTeam).map(([team, streakList]) => (
          <div key={team} className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-300">{team}</h4>
            <div className="flex flex-wrap gap-1">
              {streakList.map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono",
                    "bg-zinc-800/50 border border-zinc-700/50",
                    streakColor(s.streakType, s.count)
                  )}
                >
                  <span>{streakLabel(s.streakType)}</span>
                  <span className="font-bold">×{s.count}</span>
                  {s.venue && <span className="text-zinc-600">({s.venue})</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
