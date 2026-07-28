"use client";

// Conteneur principal du widget Document PiP.
//
// Monté dans `pipWindow.document.body` par `useDocumentPip`. Connexion SSE
// INDÉPENDANTE de la fenêtre principale (le PiP est un autre `document`, donc
// sa propre EventSource).
//
// Affiche une ligne compacte par match favori en live (PipMatchRow). Au clic
// sur une ligne → déploiement du panneau 5 bets (PipBetPanel) en dessous.
// Un seul match déployé à la fois (toggle).

import { useMemo, useState } from "react";
import { useLiveStream } from "@/hooks/use-live-stream";
import { useFavorites } from "@/hooks/use-favorites";
import { usePlayerStats } from "@/hooks/use-player-stats";
import type { TennisMatch } from "@/lib/tennis-data";
import type { ServeStats } from "@/lib/prediction/total-games";
import { PipMatchRow } from "@/components/tennis/pip-match-row";
import { PipBetPanel } from "@/components/tennis/pip-bet-panel";

/** Normalisation d'un nom pour le lookup dans playerStatsMap.
 *  Doit matcher `normForLookup` côté match-card (sinon lookup rate). */
function normForLookup(name: string): string {
  return name.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Construit un TennisMatch synthétique minimal depuis une entrée live BSD.
 *  Seuls les champs utilisés par PipMatchRow/PipBetPanel sont remplis.
 *  On réutilise la logique de tennis-tab-content.tsx:234-277 (match synthétique). */
function buildSyntheticMatch(
  id: string,
  nameA: string,
  nameB: string,
  tournamentName?: string,
  roundName?: string,
): TennisMatch {
  const shortA = nameA.trim().split(/\s+/).pop() || nameA;
  const shortB = nameB.trim().split(/\s+/).pop() || nameB;
  return {
    id,
    tournament: tournamentName || "Live",
    round: roundName || "En direct",
    scheduledAt: new Date().toISOString(),
    playerA: {
      name: nameA,
      shortName: shortA.toUpperCase(),
      id: nameA.toLowerCase().replace(/\s+/g, "-"),
      rank: 0,
      elo: 1500,
      photoUrl: undefined,
      color: "#22c55e",
      form: [],
    },
    playerB: {
      name: nameB,
      shortName: shortB.toUpperCase(),
      id: nameB.toLowerCase().replace(/\s+/g, "-"),
      rank: 0,
      elo: 1500,
      photoUrl: undefined,
      color: "#3b82f6",
      form: [],
    },
    probA: 50,
    probB: 50,
    stats: {
      form: "LIVE",
      eloGap: 0,
      surface: "Dur",
      h2h: "—",
      ic: [0, 100],
      confidence: 0,
    },
    model: "Live",
    modelUpdatedAt: new Date().toISOString(),
    synthetic: true,
  } as unknown as TennisMatch;
}

export function MatchPipWidget() {
  const { favorites } = useFavorites();
  const { liveStates, liveMatchList, connectionStatus } = useLiveStream();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Matchs favoris en live = intersection des favoris et des matchs live.
  // Pour chaque match live non en prematch, on construit un TennisMatch synthétique.
  const liveFavoriteMatches = useMemo(() => {
    const result: Array<{
      match: TennisMatch;
      liveState: (typeof liveStates)[string];
    }> = [];
    for (const lm of liveMatchList) {
      if (!lm.isLive) continue;
      if (!favorites.has(lm.id)) continue;
      const liveState = liveStates[lm.id];
      if (!liveState) continue; // pas encore de state live détaillé
      result.push({
        match: buildSyntheticMatch(
          lm.id,
          lm.playerA.name,
          lm.playerB.name,
          lm.tournamentName,
          lm.roundName,
        ),
        liveState,
      });
    }
    return result;
  }, [favorites, liveMatchList, liveStates]);

  // Récupère les stats serve pour TOUS les joueurs affichés (1 seul call SWR).
  // Comme dans match-card.tsx:117 — on concatène les noms.
  const allNames = useMemo(() => {
    return liveFavoriteMatches
      .map((m) => `${m.match.playerA.name},${m.match.playerB.name}`)
      .join(",");
  }, [liveFavoriteMatches]);
  const { data: playerStatsMap } = usePlayerStats(allNames, "Dur");

  const statusColor =
    connectionStatus === "connected"
      ? "bg-emerald-400"
      : connectionStatus === "connecting"
        ? "bg-amber-400"
        : "bg-rose-400";
  const statusLabel =
    connectionStatus === "connected"
      ? "LIVE"
      : connectionStatus === "connecting"
        ? "…"
        : "HS";

  return (
    <div className="min-h-screen bg-[#0E1217] text-foreground p-2.5 font-sans">
      {/* Header compact */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${statusColor} animate-pulse`} />
          <span className="text-[11px] font-bold tracking-wide">PariScore Live</span>
          <span className="text-[10px] text-muted-foreground/70">
            · {liveFavoriteMatches.length} match{liveFavoriteMatches.length > 1 ? "s" : ""} · {statusLabel}
          </span>
        </div>
      </div>

      {/* Liste des matchs */}
      {liveFavoriteMatches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-6 text-center">
          <p className="text-[11px] text-muted-foreground/70">
            Aucun favori en live.
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Épingle des matchs ★ sur ParisScore pour les voir ici.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {liveFavoriteMatches.map(({ match, liveState }) => {
            const isExpanded = expandedId === match.id;
            // Stats serve pour ce match (lookup normalisé).
            const statsA = playerStatsMap?.[normForLookup(match.playerA.name)];
            const statsB = playerStatsMap?.[normForLookup(match.playerB.name)];
            const serveStatsA: ServeStats | null =
              statsA?.servePtsWonPct != null
                ? {
                    servePtsWonPct: statsA.servePtsWonPct,
                    returnPtsWonPct: statsA.returnPtsWonPct ?? null,
                  }
                : null;
            const serveStatsB: ServeStats | null =
              statsB?.servePtsWonPct != null
                ? {
                    servePtsWonPct: statsB.servePtsWonPct,
                    returnPtsWonPct: statsB.returnPtsWonPct ?? null,
                  }
                : null;

            return (
              <div key={match.id}>
                <PipMatchRow
                  match={match}
                  liveState={liveState}
                  expanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : match.id)}
                />
                {isExpanded && (
                  <PipBetPanel
                    match={match}
                    liveState={liveState}
                    serveStatsA={serveStatsA}
                    serveStatsB={serveStatsB}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Légende footer */}
      {liveFavoriteMatches.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
            Clic sur un match → 5 bets prédictifs. <br />
            Feu tricolore : ✅ parier · ⚠️ attendre · ❌ éviter. <br />
            Décision finale = toi (le widget est une aide, pas une garantie).
          </p>
        </div>
      )}
    </div>
  );
}
