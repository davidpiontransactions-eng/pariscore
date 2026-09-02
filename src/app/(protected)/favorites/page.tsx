"use client";

import { useTranslations } from "next-intl";
import { Heart, Users, Trophy, Zap, Trash2 } from "lucide-react";
import { useFollowStore, type FollowEntry } from "@/stores/use-follow-store";
import { FollowButton } from "@/components/shared/follow-button";
import { cn } from "@/lib/utils";

/**
 * Page Favoris / Suivis.
 *
 * Affiche :
 * - Liste des joueurs suivis
 * - Liste des équipes suivies
 * - Liste des ligues suivies
 * - Liste des matchs suivis
 * - Actions : supprimer, activer/désactiver notifications
 *
 * Pattern FotMob "My Teams" : gestion centralisée des follows.
 */

const CATEGORY_CONFIG = {
  player: { icon: Users, label: "Mes joueurs", color: "text-sky-500" },
  team: { icon: Trophy, label: "Mes équipes", color: "text-amber-500" },
  league: { icon: Zap, label: "Mes ligues", color: "text-emerald-500" },
  match: { icon: Heart, label: "Mes matchs", color: "text-rose-500" },
} as const;

function FollowSection({
  category,
  entries,
}: {
  category: keyof typeof CATEGORY_CONFIG;
  entries: FollowEntry[];
}) {
  const { remove, setNotifications } = useFollowStore();
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.color)} />
        <h3 className="text-sm font-semibold">{config.label}</h3>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {entries.length}
        </span>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded-md border border-border/20 px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{entry.name}</div>
                {entry.sport && (
                  <div className="text-[10px] text-muted-foreground">
                    {entry.sport}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle notifications */}
              <button
                onClick={() => setNotifications(entry.id, !entry.notifications)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                  entry.notifications
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-muted text-muted-foreground",
                )}
                aria-label={
                  entry.notifications
                    ? "Désactiver les notifications"
                    : "Activer les notifications"
                }
              >
                {entry.notifications ? "🔔" : "🔕"}
              </button>

              {/* Supprimer */}
              <button
                onClick={() => remove(entry.id)}
                className="rounded-md p-1 text-muted-foreground hover:text-red-500 transition-colors"
                aria-label={`Ne plus suivre ${entry.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const t = useTranslations("favorites");
  const { follows, getByCategory, clearAll } = useFollowStore();

  const players = getByCategory("player");
  const teams = getByCategory("team");
  const leagues = getByCategory("league");
  const matches = getByCategory("match");

  const totalFollows = players.length + teams.length + leagues.length + matches.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {totalFollows} {t("follows")}
          </p>
        </div>

        {totalFollows > 0 && (
          <button
            onClick={clearAll}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            {t("clearAll")}
          </button>
        )}
      </div>

      {/* Follows grid */}
      {totalFollows === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <h3 className="mb-1 text-sm font-medium">{t("emptyTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FollowSection category="player" entries={players} />
          <FollowSection category="team" entries={teams} />
          <FollowSection category="league" entries={leagues} />
          <FollowSection category="match" entries={matches} />
        </div>
      )}
    </div>
  );
}
