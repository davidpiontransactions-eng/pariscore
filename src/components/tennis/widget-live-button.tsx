"use client";

// Raccourci « Widget Live » : ouvre le PiP de marchés directement sur le match
// de la carte, en 1 clic.
//
// Pourquoi il lit le store directement plutôt que de recevoir des props : le
// widget PiP n'affiche QUE les matchs épinglés (favoris ∪ `selectedMatchIds`).
// Un bouton qui ne ferait que `expandedMatchId = id` sur un match non épinglé
// ne produirait AUCUN affichage — il faut donc ALSO épingler. Passer par le
// store rend l'opération atomique et lisible sur n'importe quelle carte.
import { useCallback } from "react";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { cn } from "@/lib/utils";

type Props = {
  /** Id du match (même base que la sidebar : `bsd-tn-<num>`). */
  matchId: string;
  className?: string;
  /** Libellé compact ; par défaut « Widget Live ». */
  label?: string;
};

export function WidgetLiveButton({ matchId, className, label = "Widget Live" }: Props) {
  const isSelected = useSportsSidebarStore((s) => s.selectedMatchIds.includes(matchId));
  const toggleMatchSelection = useSportsSidebarStore((s) => s.toggleMatchSelection);
  const expandedMatchId = useSportsSidebarStore((s) => s.expandedMatchId);
  const setExpandedMatchId = useSportsSidebarStore((s) => s.setExpandedMatchId);

  const isOpen = expandedMatchId === matchId;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // La carte entière est cliquable : sans stopPropagation, un clic sur le
      // bouton déclencherait aussi l'ouverture du détail du match.
      e.stopPropagation();
      e.preventDefault();
      // Épingle S'IL NE L'EST PAS déjà (toggle = retirerait un favori).
      if (!isSelected) toggleMatchSelection(matchId);
      setExpandedMatchId(isOpen ? null : matchId);
    },
    [isSelected, toggleMatchSelection, setExpandedMatchId, matchId, isOpen]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isOpen}
      title={
        isOpen
          ? "Replier le Widget Live de ce match"
          : "Ouvrir le Widget Live (marchés live) sur ce match"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all cursor-pointer",
        isOpen
          ? "border-emerald-500/60 bg-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
          : "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)]",
        className
      )}
    >
      <span aria-hidden>🎯</span>
      {label}
    </button>
  );
}