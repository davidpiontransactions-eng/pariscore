"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MatchCardBroadcast } from "@/components/tennis/match-card-broadcast";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { useOnexLiveOdds } from "@/hooks/use-onex-live-odds";
import type { TennisMatch } from "@/lib/tennis-data";

type Props = {
  match: TennisMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Card Live en surimpression — ouverte au clic sur une ligne live du
 * calendrier tennis (`TennisCalendarSection`).
 *
 * Réutilise `MatchCardBroadcast` tel quel avec le `LiveMatchState` du flux SSE :
 * score set par set, jeu en cours, serveur, MomentumDR, courbe de proba live,
 * matrice « La Fourche », cotes 1xBet et boutons Stats live / Décisions.
 * L'ancienne cible (MatchDetailDialog sur un match synthétique) n'affichait que
 * des placeholders 50 % /  IC [0, 100].
 */
export function TennisLiveCardDialog({ match, open, onOpenChange }: Props) {
  const { liveStates, connectionStatus } = useLiveMatches();
  const id = open && match ? match.id : "";
  const liveState = liveStates[id];

  // Requête de cotes : 1 seule entrée, vide quand le dialog est fermé (le hook
  // ne fetch pas si le tableau est vide).
  const onexRequest = useMemo(
    () =>
      id && match
        ? [{ matchId: id, nameA: match.playerA.name, nameB: match.playerB.name }]
        : [],
    [id, match],
  );
  const { odds } = useOnexLiveOdds(onexRequest, liveStates);

  const nameA = match?.playerA.name ?? "";
  const nameB = match?.playerB.name ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto p-4 sm:p-6"
      >
        <DialogTitle className="sr-only">
          {match ? `Card live — ${nameA} vs ${nameB}` : "Card live"}
        </DialogTitle>
        {match && (
          <MatchCardBroadcast
            match={match}
            liveState={liveState}
            liveOdds={odds[id] ?? null}
            disconnected={connectionStatus === "disconnected"}
            defaultOpen
          />
        )}
      </DialogContent>
    </Dialog>
  );
}