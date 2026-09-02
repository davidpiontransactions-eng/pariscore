"use client";

import { useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Settings, Search } from "lucide-react";
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
 * Niveau 1 (56px) : Logo shield + Recherche + Actions + Sport athlete image
 * Niveau 2 (40px) : Onglets sport scrollables
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
      <AutoHideHeader className="relative overflow-hidden">
        {/* Gradient background — multi-layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#060a14] via-[#0c1220] to-[#0a0f1a]" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/8 via-transparent to-sky-500/5" />
        
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Sports athlete image — right side with splash effect */}
        <div className="absolute right-0 top-0 h-full w-[400px] pointer-events-none">
          <Image
            src="/sports-athlete-header.svg"
            alt=""
            fill
            className="object-cover object-right opacity-80"
            priority
          />
          {/* Fade gradient to blend with header */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#060a14] via-[#060a14]/60 to-transparent" />
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

        {/* Content — Niveau 1 (56px) */}
        <div className="relative mx-auto flex h-[56px] max-w-7xl items-center justify-between gap-x-4 px-4 sm:px-6">
          {/* Gauche : Logo Shield */}
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-lg px-1 py-1.5 transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            aria-label="PariScore — Accueil"
          >
            {/* Shield logo SVG */}
            <div className="relative">
              <Image
                src="/logo-header.svg"
                alt="PariScore Shield"
                width={48}
                height={48}
                className="h-[48px] w-[48px] transition-all group-hover:drop-shadow-[0_0_12px_rgba(0,230,118,0.5)]"
                priority
              />
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/0 transition-all group-hover:bg-emerald-500/10" />
            </div>
            
            {/* Texte logo */}
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-white leading-none">
                PARI<span className="text-emerald-400">SCORE</span>
              </span>
              <span className="text-[10px] font-medium tracking-[0.25em] text-zinc-500 leading-none mt-1">
                MULTISPORT DATA & PRÉDICTIONS
              </span>
            </div>
          </Link>

          {/* Centre : Barre de recherche (desktop) */}
          <div className="flex-1 flex justify-center max-w-xl mx-8">
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className={cn(
                "group hidden items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-xs text-zinc-500 transition-all w-full",
                "hover:border-emerald-500/20 hover:bg-white/[0.05] hover:text-zinc-300 hover:shadow-lg hover:shadow-emerald-500/5",
                "sm:flex",
              )}
              aria-label="Rechercher (Ctrl+K)"
            >
              <Search className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-emerald-400" />
              <span className="flex-1 text-left">Rechercher un match, équipe, ligue...</span>
              <kbd className="ml-auto rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-zinc-600 transition-colors group-hover:border-emerald-500/20 group-hover:text-zinc-500">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Droite : Actions */}
          <div className="flex items-center gap-2">
            {/* Icône recherche (mobile) */}
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-white hover:shadow-lg hover:shadow-black/20 sm:hidden"
              aria-label="Rechercher"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Notifications */}
            <NotificationsDropdown />

            {/* Profil / Menu utilisateur */}
            <UserMenu />

            {/* Réglages */}
            <Link
              href="/settings"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-white hover:shadow-lg hover:shadow-black/20"
              aria-label="Paramètres"
              title="Paramètres"
            >
              <Settings className="h-5 w-5" />
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
