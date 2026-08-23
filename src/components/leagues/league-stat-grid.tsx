import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatsSection } from "@/lib/leagues-stats/types";

// Traduction FR des libellés connus ; fallback = libellé source (EN).
const LABEL_FR: Record<string, string> = {
  games_played: "Matchs joués",
  home_wins: "Victoires domicile",
  draws: "Matchs nuls",
  away_wins: "Victoires extérieur",
  total_goals: "Buts totaux",
  goals_per_game: "Buts / match",
  home_goals: "Buts domicile",
  away_goals: "Buts extérieur",
  cards: "Cartons",
  home_cards: "Cartons domicile",
  away_cards: "Cartons extérieur",
  btts: "BTTS (les 2 marquent)",
  corners: "Corners",
  home_corners: "Corners domicile",
  away_corners: "Corners extérieur",
};

const SECTION_TITLES_FR: Record<string, string> = {
  general: "Stats générales",
  over_under: "Buts Over/Under",
  halves: "Buts par mi-temps",
  cards: "Cartons",
  btts: "BTTS",
  corners: "Corners",
};

function itemLabel(key: string, fallback: string): string {
  return LABEL_FR[key] ?? fallback;
}

export function LeagueStatGrid({ section }: { section: StatsSection }) {
  const title = SECTION_TITLES_FR[section.id] ?? section.title;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {section.items.map((item) => (
          <div
            key={item.key}
            className="rounded-lg border bg-card p-2.5 flex flex-col gap-1"
          >
            <span className="text-[11px] leading-tight text-muted-foreground line-clamp-2">
              {itemLabel(item.key, item.label)}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tabular-nums leading-none">
                {item.value ?? "—"}
              </span>
              {item.pct !== null && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {item.pct}%
                </span>
              )}
              {item.avg !== null && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  moy. {item.avg}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
