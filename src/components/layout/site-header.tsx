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

const VALID_SPORTS = new Set(["football", "tennis", "basketball", "rugby", "mma", "cycling", "f1", "baseball", "cs2"]);

/**
 * SiteHeader — Barre du haut unifiée à 2 niveaux, style gradient modern.
 *
 * Niveau 1 (48px) : Logo + Recherche + Notifications + Profil
 * Niveau 2 (40px) : Onglets sport scrollables
 *
 * Gradient : linear-gradient(135deg, #0a0e1a → #111827 → #0f172a)
 * avec bordure inférieure colorée et glassmorphism.
 */
export function SiteHeader() {
  const { open, onOpenChange } = useSearchModal();
  const activeSport = useSportsSidebarStore((s) => s.selectedSportId);

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
      <AutoHideHeader className="relative">
        {/* Gradient background — multi-layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e1a] via-[#111827] to-[#0f172a]" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-sky-500/5" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

        {/* Content — Niveau 1 (48px) */}
        <div className="relative mx-auto flex h-12 max-w-6xl items-center justify-between gap-x-3 px-4 sm:px-6">
          {/* Gauche : Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            aria-label="PariScore — Accueil"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 transition-shadow group-hover:shadow-emerald-500/30">
              <Trophy className="h-4 w-4 text-white" aria-hidden />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              Pari<span className="text-emerald-400">Score</span>
            </span>
          </Link>

          {/* Droite : Recherche + Actions */}
          <div className="flex items-center gap-2">
            {/* Barre de recherche (desktop) */}
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className={cn(
                "group hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3.5 py-2 text-xs text-zinc-500 transition-all",
                "hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-zinc-300 hover:shadow-lg hover:shadow-black/20",
                "sm:flex sm:min-w-[220px] lg:min-w-[300px]",
              )}
              aria-label="Rechercher (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-emerald-400" />
              <span className="flex-1 text-left">Rechercher...</span>
              <kbd className="ml-auto rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 transition-colors group-hover:border-white/[0.12] group-hover:text-zinc-500">
                ⌘K
              </kbd>
            </button>

            {/* Icône recherche (mobile) */}
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-white hover:shadow-lg hover:shadow-black/20 sm:hidden"
              aria-label="Rechercher"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <NotificationsDropdown />

            {/* Profil / Menu utilisateur */}
            <UserMenu />

            {/* Réglages */}
            <Link
              href="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-white hover:shadow-lg hover:shadow-black/20"
              aria-label="Paramètres"
              title="Paramètres"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Niveau 2 — Onglets sport (40px) */}
        <div className="relative">
          {/* Top separator with glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <SportTabs activeSport={activeSport ?? "football"} onSportChange={handleSportChange} />
        </div>
      </AutoHideHeader>

      {/* Modal recherche Ctrl+K */}
      <SearchModal open={open} onOpenChange={onOpenChange} />
    </>
  );
}
