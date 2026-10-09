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

import { useCallback, useMemo, useState } from "react";
import { useLiveStream } from "@/hooks/use-live-stream";
import { useFavorites } from "@/hooks/use-favorites-adapter";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { useBetNotify } from "@/hooks/use-bet-notify";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { sameBsdMatch } from "@/lib/bsd-id";
import type { LivePlayerBrief } from "@/lib/live-state-builder";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import type { ServeStats } from "@/lib/prediction/total-games";
import { PipMatchRow } from "@/components/tennis/pip-match-row";
import { PipBetPanel } from "@/components/tennis/pip-bet-panel";

type Props = {
  /** Match sur lequel l'utilisateur a cliqué « Widget live » (carte ou détail).
   *  Épinglé en tête du widget même s'il n'est pas encore en direct — sinon le
   *  widget s'ouvre vide alors que l'utilisateur vient de choisir ce match. */
  focusMatch?: TennisMatch | null;
};

/** Une ligne du widget : un match + son état live (absent si pas encore en direct). */
type WidgetRow = {
  match: TennisMatch;
  liveState: LiveMatchState | undefined;
  /** false = match ciblé pas encore joué (état "en attente du live"). */
  isLive: boolean;
  /** true = match ciblé par le clic sur le bouton. */
  isFocus: boolean;
};

/** Normalisation d'un nom pour le lookup dans playerStatsMap.
 *  Doit matcher `normForLookup` côté match-card (sinon lookup rate). */
function normForLookup(name: string): string {
  return name.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Tronque un nom de joueur : garde le nom de famille (dernier mot) en uppercase.
 *  Cohérent avec pip-match-row.tsx / pip-bet-panel.tsx. */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || fullName).toUpperCase();
}

/** Construit un TennisMatch synthétique minimal depuis une entrée live BSD.
 *  Seuls les champs utilisés par PipMatchRow/PipBetPanel sont remplis.
 *  On réutilise la logique de tennis-tab-content.tsx:234-277 (match synthétique). */
function buildSyntheticMatch(
  id: string,
  playerA: LivePlayerBrief,
  playerB: LivePlayerBrief,
  tournamentName?: string,
  roundName?: string,
): TennisMatch {
  const shortA = playerA.name.trim().split(/\s+/).pop() || playerA.name;
  const shortB = playerB.name.trim().split(/\s+/).pop() || playerB.name;
  // R7.9 : lelo et le rang viennent du flux live enrichi. `eloKnown: false` →
  // on ne fabrique plus de 1500, la ligne affiche « — ».
  const mkPlayer = (brief: LivePlayerBrief, short: string, color: string) => ({
    name: brief.name,
    shortName: short.toUpperCase(),
    id: brief.name.toLowerCase().replace(/\s+/g, "-"),
    rank: brief.rank,
    elo: brief.eloKnown ? brief.elo : 0,
    eloKnown: brief.eloKnown,
    surfaceElo: brief.surfaceElo,
    sps: brief.sps ?? undefined,
    spsRank: brief.spsRank ?? undefined,
    photoUrl: brief.photoUrl || undefined,
    color,
    form: brief.form,
  });
  return {
    id,
    tournament: tournamentName || "Live",
    round: roundName || "En direct",
    scheduledAt: new Date().toISOString(),
    playerA: mkPlayer(playerA, shortA, "#22c55e"),
    playerB: mkPlayer(playerB, shortB, "#3b82f6"),
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

export function MatchPipWidget({ focusMatch = null }: Props = {}) {
  const { favorites, remove: removeFavorite } = useFavorites();
  const { liveStates, liveMatchList, connectionStatus } = useLiveStream();
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);
  const removeMatchSelection = useSportsSidebarStore((s) => s.removeMatchSelection);
  // Ouverture 1-clic depuis une carte live (« 🎯 Widget Live »). Reste piloté
  // localement pour que le widget garde son comportement autonome (clic sur
  // une ligne), mais le store prend la main dès qu'une carte le demande.
  const storeExpandedId = useSportsSidebarStore((s) => s.expandedMatchId);
  const setStoreExpandedId = useSportsSidebarStore((s) => s.setExpandedMatchId);
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null);
  const expandedId = storeExpandedId ?? localExpandedId;
  const setExpandedId = useCallback(
    (id: string | null) => {
      setLocalExpandedId(id);
      setStoreExpandedId(id);
    },
    [setStoreExpandedId]
  );

  // Dépingle un match des DEUX sources (★ follows + sélection sidebar) : le
  // widget lit leur union, laisser l'un des deux would le ferait réapparaître au
  // prochain tick. Les deux retraits sont idempotents.
  const unpinMatch = useCallback(
    (matchId: string) => {
      removeMatchSelection(matchId);
      removeFavorite(matchId);
      setExpandedId(expandedId && sameBsdMatch(expandedId, matchId) ? null : expandedId);
    },
    [removeMatchSelection, removeFavorite, setExpandedId, expandedId],
  );

  // Lignes du widget, dans l'ordre : (1) le match ciblé, toujours présent ;
  // (2) les favoris / matchs sélectionnés en direct. La comparaison d'id passe
  // par `sameBsdMatch` (le flux live et la sidebar n'utilisent pas le même
  // préfixe : `bsd-<num>` vs `bsd-tn-<num>`).
  const rows = useMemo<WidgetRow[]>(() => {
    const result: WidgetRow[] = [];
    const pushed = new Set<string>();

    if (focusMatch) {
      const lm = liveMatchList.find((m) => sameBsdMatch(m.id, focusMatch.id));
      result.push({
        match: focusMatch,
        liveState: lm ? liveStates[lm.id] : undefined,
        isLive: Boolean(lm?.isLive),
        isFocus: true,
      });
      pushed.add(focusMatch.id);
    }

    for (const lm of liveMatchList) {
      if (pushed.has(lm.id)) continue;
      // Match si favori ★ OU sélectionné dans la sidebar (comparaison d'id normalisée).
      // ponytail: ni filtre `isLive` ni filtre `liveState` — le widget montrait
      // « Aucun match en live » parce qu'il SKIPPAIT les matchs épinglés qui
      // n'étaient pas encore dans le flux ou n'avaient pas de state (les 2
      // conditions sont vraies juste après l'épinglage). PipMatchRow et
      // PipBetPanel gèrent tous deux `liveState === undefined` (rendu « prématch »).
      const pinned =
        favorites.has(lm.id) ||
        selectedMatchIds.some((id) => sameBsdMatch(id, lm.id));
      if (!pinned) continue;
      const liveState = liveStates[lm.id];
      result.push({
        match: buildSyntheticMatch(
          lm.id,
          lm.playerA,
          lm.playerB,
          lm.tournamentName,
          lm.roundName,
        ),
        liveState,
        isLive: Boolean(lm.isLive),
        isFocus: false,
      });
      pushed.add(lm.id);
    }

    return result;
  }, [focusMatch, favorites, liveMatchList, liveStates, selectedMatchIds]);

  const liveFavoriteMatches = rows;

  // Récupère les stats serve pour TOUS les joueurs affichés (1 seul call SWR).
  // Comme dans match-card.tsx:117 — on concatène les noms.
  const allNames = useMemo(() => {
    return liveFavoriteMatches
      .map((m) => `${m.match.playerA.name},${m.match.playerB.name}`)
      .join(",");
  }, [liveFavoriteMatches]);
  // FIX surface (2026-07-28) : avant hardcodée "Dur" → drMoyen5m faussé sur
  // terre/gazon. On prend la surface du 1er match (les matchs d'un même widget
  // sont quasi toujours sur la même surface — même tournoi). Si mixte, on
  // pourrait faire un call par surface, mais overkill pour un MVP.
  const widgetSurface = liveFavoriteMatches[0]?.match?.stats?.surface || "Dur";
  const { data: playerStatsMap } = usePlayerStats(allNames, widgetSurface);

  // Notifications natives feu tricolore ✅. Le hook gère l'anti-spam
  // (transition !bet→bet + cooldown 2 min) en interne via une Map en ref.
  const betNotify = useBetNotify();

  // Wrapper stable pour passer à PipMatchRow. On mémorise le label du match
  // (nom A vs B) au moment de l'appel — le hook fait le reste.
  const makeBetSignal = useCallback(
    (matchId: string, label: string) =>
      (level: Parameters<typeof betNotify.notifyBet>[2]) => {
        betNotify.notifyBet(matchId, label, level);
      },
    [betNotify],
  );

  // Wrapper pour les value alerts (≥ 2 jeux d'écart + DR leader ≥ 1.2).
  // Notification native 🔥 indépendante du feu tricolore (propre tag/cooldown).
  const makeValueAlert = useCallback(
    (matchId: string) =>
      (label: { title: string; body: string }) => {
        betNotify.notifyValueAlert(matchId, label);
      },
    [betNotify],
  );

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
          <span className="text-[11px] text-muted-foreground/70">
            · {liveFavoriteMatches.length} match{liveFavoriteMatches.length > 1 ? "s" : ""} · {statusLabel}
          </span>
        </div>
        {/* Toggle notifs feu tricolore — opt-in explicite (pas de spam surprise) */}
        {betNotify.supported && (
          <button
            type="button"
            onClick={() => betNotify.toggle()}
            title={
              betNotify.permission === "denied"
                ? "Permission notifications refusée — réactivez-la dans les paramètres du navigateur"
                : betNotify.enabled
                  ? "Notifications ACTIVÉES — alerte quand un match passe à ✅ PARIE"
                  : "Activer les notifications (alerte quand un match passe à ✅ PARIE)"
            }
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
              betNotify.enabled
                ? "bg-emerald-500/20 text-emerald-300"
                : betNotify.permission === "denied"
                  ? "bg-rose-500/15 text-rose-400/70 cursor-not-allowed"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {betNotify.permission === "denied" ? "🔔 bloqué" : betNotify.enabled ? "🔔 ON" : "🔔 off"}
          </button>
        )}
      </div>

      {/* Liste des matchs */}
      {liveFavoriteMatches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-6 text-center">
          <p className="text-[11px] text-muted-foreground/70">
            Aucun match en live.
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            Épingle des matchs ★ (ou sélectionne-les dans la sidebar) pour les voir ici — ✕ pour dépingler.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {liveFavoriteMatches.map(({ match, liveState, isLive, isFocus }) => {
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
              <div key={match.id} className="relative">
                {/* Bouton X : dépingle immédiatement. Doit être un FRÈRE de
                    PipMatchRow (dont la racine est un <button>) — un <button>
                    imbriqué serait du HTML invalide et déclencherait onToggle. */}
                <button
                  type="button"
                  onClick={() => unpinMatch(match.id)}
                  aria-label={`Dépingler ${match.playerA.name} vs ${match.playerB.name}`}
                  title="Dépingler ce match du widget"
                  className="absolute right-1 top-1 z-30 rounded p-0.5 text-[11px] leading-none text-muted-foreground/70 transition-colors hover:bg-rose-500/20 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ✕
                </button>
                {isFocus && (
                  <div className="mb-0.5 flex items-center gap-1.5 px-0.5">
                    <span className="rounded bg-emerald-500/20 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                      Sélectionné
                    </span>
                    {!isLive && (
                      <span className="text-[9px] text-muted-foreground/60">
                        pas encore en direct
                      </span>
                    )}
                  </div>
                )}
                <PipMatchRow
                  match={match}
                  liveState={liveState}
                  expanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : match.id)}
                  onBetSignal={makeBetSignal(
                    match.id,
                    `${shortName(match.playerA.name)} vs ${shortName(match.playerB.name)}`,
                  )}
                  onValueAlert={makeValueAlert(match.id)}
                  drMoyenA={statsA?.drMoyen5m ?? null}
                  drMoyenB={statsB?.drMoyen5m ?? null}
                  serveStatsA={serveStatsA}
                  serveStatsB={serveStatsB}
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
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            Clic sur un match → 5 bets prédictifs. <br />
            Feu tricolore : ✅ parier · ⚠️ attendre · ❌ éviter. <br />
            Décision finale = toi (le widget est une aide, pas une garantie).
          </p>
        </div>
      )}
    </div>
  );
}
