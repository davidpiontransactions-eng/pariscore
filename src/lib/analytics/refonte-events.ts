/**
 * Événements PostHog pour la refonte UI/UX v1 (P1-P4).
 *
 * Chaque nouveau composant émet un événement lors de l'interaction utilisateur.
 * Utilisé pour mesurer l'adoption et l'engagement post-refonte.
 *
 * Usage: import { trackRefonte } from "@/lib/analytics/refonte-events";
 *        trackRefonte.dashboardViewed();
 *
 * RGPD : les événements sont silencieusement ignorés si PostHog n'est pas
 * initialisé (consentement non donné ou NEXT_PUBLIC_POSTHOG_KEY absent).
 */

import posthog from "posthog-js";

type EventProps = Record<string, unknown>;

/** Émet un événement seulement si PostHog est initialisé ET le consentement est donné. */
function safeTrack(event: string, props?: EventProps): void {
  if (typeof window === "undefined") return;
  try {
    // posthog-js exposes __loaded / has_opted_out_capturing
    const ph = posthog as unknown as {
      __loaded?: boolean;
      has_opted_out_capturing?: () => boolean;
      capture: (event: string, props?: EventProps) => void;
    };
    if (!ph.__loaded) return;
    if (ph.has_opted_out_capturing?.()) return;
    ph.capture(event, props);
  } catch {
    // Silencieux — pas de PostHog, pas d'erreur
  }
}

export const trackRefonte = {
  /** P1 — Navigation mobile */
  bottomNavTabClicked: (tab: string) =>
    safeTrack("refonte_bottom_nav_tab_clicked", { tab }),
  sportSwiped: (from: string, to: string) =>
    safeTrack("refonte_sport_swiped", { from, to }),
  drawerOpened: (component: string) =>
    safeTrack("refonte_drawer_opened", { component }),

  /** P2 — Data Viz */
  confidenceRingViewed: (sport: string) =>
    safeTrack("refonte_confidence_ring_viewed", { sport }),
  eloChartViewed: () =>
    safeTrack("refonte_elo_chart_viewed", {}),
  formTimelineViewed: (sport: string) =>
    safeTrack("refonte_form_timeline_viewed", { sport }),
  radarChartViewed: () =>
    safeTrack("refonte_radar_chart_viewed", {}),
  momentumStorylineViewed: () =>
    safeTrack("refonte_momentum_storyline_viewed", {}),

  /** P3 — Nouveaux Modules */
  oddsMatrixViewed: () =>
    safeTrack("refonte_odds_matrix_viewed", {}),
  h2hAdvancedViewed: () =>
    safeTrack("refonte_h2h_advanced_viewed", {}),
  scenarioSimulated: (params: Record<string, unknown>) =>
    safeTrack("refonte_scenario_simulated", params),
  valueHeatmapViewed: () =>
    safeTrack("refonte_value_heatmap_viewed", {}),

  /** P4 — Dashboard Global */
  dashboardViewed: () =>
    safeTrack("refonte_dashboard_viewed", {}),
  topValueBetClicked: (sport: string, edge: number) =>
    safeTrack("refonte_top_value_bet_clicked", { sport, edge }),
  liveNowCardClicked: (sport: string) =>
    safeTrack("refonte_live_now_card_clicked", { sport }),
  quickFilterUsed: (filter: string) =>
    safeTrack("refonte_quick_filter_used", { filter }),
  aiInsightViewed: () =>
    safeTrack("refonte_ai_insight_viewed", {}),

  /** Transversal */
  refonteVersionLoaded: (version: string) =>
    safeTrack("refonte_version_loaded", { version }),
};
