"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Trophy, Settings, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AutoHideHeader } from "@/components/layout/auto-hide-header";
import { SportTabs } from "@/components/layout/sport-tabs";
import SearchModal, { useSearchModal } from "@/components/layout/search-modal";
import { NotificationsDropdown } from "@/components/layout/notifications-dropdown";
import { UserMenu } from "@/components/layout/user-menu";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

/**
 * SiteHeader — Barre du haut unifiée à 2 niveaux.
 *
 * Niveau 1 (44px) : Logo + Recherche + Notifications + Profil
 * Niveau 2 (36px) : Onglets sport scrollables
 *
 * Remplace l'ancien header dispersé dans page.tsx (12 boutons → 5 éléments).
 * Inspiré de Sofascore, FlashScore, TradingView.
 */
export function SiteHeader() {
  const { open, onOpenChange } = useSearchModal();
  const activeSport = useSportsSidebarStore((s) => s.selectedSportId);

  const VALID_SPORTS = new Set(["football", "tennis", "basketball", "rugby", "mma", "cycling", "f1", "baseball", "cs2"]);

  const handleSportChange = useCallback(
    (sport: string) => {
      if (VALID_SPORTS.has(sport)) {
        useSportsSidebarStore.getState().syncSportFromTab(sport);
      }
    },
    [],
  );

  return (
    <>
      <AutoHideHeader className="bg-bg-deep/85 backdrop-blur-md">
        {/* Niveau 1 — Barre principale (44px) */}
        <div className="mx-auto flex h-11 max-w-6xl items-center justify-between gap-x-3 px-4 sm:px-6">
          {/* Gauche : Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-1 py-1.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="PariScore — Accueil"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              PariScore
            </span>
          </Link>

          {/* Droite : Recherche + Actions */}
          <div className="flex items-center gap-1.5">
            {/* Barre de recherche (desktop) */}
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className={cn(
                "hidden items-center gap-2 rounded-lg border border-border/40 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-500 transition-colors",
                "hover:border-border/60 hover:text-zinc-300",
                "sm:flex sm:min-w-[200px] lg:min-w-[280px]",
              )}
              aria-label="Rechercher (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span>Rechercher...</span>
              <kbd className="ml-auto rounded border border-border/40 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                ⌘K
              </kbd>
            </button>

            {/* Icône recherche (mobile) */}
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white sm:hidden"
              aria-label="Rechercher"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <NotificationsDropdown />

            {/* Profil / Menu utilisateur */}
            <UserMenu />

            {/* Réglages — raccourci rapide */}
            <Link
              href="/settings"
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              aria-label="Paramètres"
              title="Paramètres"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Niveau 2 — Onglets sport (36px) */}
        <SportTabs activeSport={activeSport ?? "football"} onSportChange={handleSportChange} />
      </AutoHideHeader>

      {/* Modal recherche Ctrl+K */}
      <SearchModal open={open} onOpenChange={onOpenChange} />
    </>
  );
}
