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
import { LiquidGlass } from "@/components/ui/liquid-glass";

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
        {/* Liquid Glass background — tier2 elevated pour la navbar */}
        <LiquidGlass tier="tier2" elevated className="absolute inset-0 bg-white liquid-glass--animated"><></></LiquidGlass>

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(123,63,160,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(123,63,160,0.1) 1px, transparent 1px)",
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
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

        {/* Content — Niveau 1 (56px) */}
        <div className="relative mx-auto flex h-[56px] max-w-7xl items-center justify-between gap-x-4 px-4 sm:px-6">
          {/* Gauche : Logo Shield */}
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-lg px-1 py-1.5 transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50"
            aria-label="PariScore — Accueil"
          >
            {/* Shield logo SVG */}
            <div className="relative">
              <Image
                src="/logo-header.svg"
                alt="PariScore Shield"
                width={48}
                height={48}
                className="h-[48px] w-[48px] transition-all group-hover:drop-shadow-[0_0_12px_rgba(123,63,160,0.3)]"
                priority
              />
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-full bg-purple-500/0 transition-all group-hover:bg-purple-500/10" />
            </div>
            
            {/* Texte logo */}
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-[#1A1145] leading-none">
                PARI<span className="text-[#7B3FA0]">SCORE</span>
              </span>
              <span className="text-[10px] font-medium tracking-[0.25em] text-[#6B5B8D] leading-none mt-1">
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
                "group hidden items-center gap-2.5 rounded-xl border border-[#E0D8F0] bg-white px-4 py-2.5 text-xs text-[#6B5B8D] transition-all w-full",
                "hover:border-[#7B3FA0]/30 hover:bg-[#F8F5FC] hover:text-[#1A1145] hover:shadow-lg hover:shadow-purple-500/5",
                "sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Rechercher (Ctrl+K)"
            >
              <Search className="h-4 w-4 shrink-0 text-[#6B5B8D] transition-colors group-hover:text-[#7B3FA0]" />
              <span className="flex-1 text-left">Rechercher un match, équipe, ligue...</span>
              <kbd className="ml-auto rounded-md border border-[#E0D8F0] bg-[#F8F5FC] px-2 py-1 text-[10px] font-medium text-[#6B5B8D] transition-colors group-hover:border-[#7B3FA0]/30 group-hover:text-[#1A1145]">
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
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#6B5B8D] transition-all hover:bg-[#F8F5FC] hover:text-[#1A1145] hover:shadow-lg hover:shadow-purple-500/5 sm:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#6B5B8D] transition-all hover:bg-[#F8F5FC] hover:text-[#1A1145] hover:shadow-lg hover:shadow-purple-500/5"
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
