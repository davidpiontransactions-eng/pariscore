import type { MatchViewMode, TimeFilterKey } from "@/lib/match-view";

/** Fenêtre temporelle de filtrage des coups d'envoi (pills horaires). */
export type TimeFilterHours = TimeFilterKey;

/** Résumé léger d'un match pour le niveau 4 de l'arborescence. */
export interface TreeMatchSummary {
  id: string;
  /** Équipe / joueur à domicile. */
  homeName: string;
  /** Équipe / joueur à l'extérieur. */
  awayName: string;
  /** Date/heure ISO du coup d'envoi. */
  scheduledAt: string;
  /** Match en direct (affiche un point rouge à la place de l'heure). */
  isLive?: boolean;
}

/** Niveau 3 — Championnat / ligue / compétition. */
export interface LeagueNode {
  id: string;
  name: string;
  matchCount: number;
  isFavorite?: boolean;
  /** Sport porteur (permet de basculer l'onglet central au clic). */
  sportId: string;
  /** Prochaines rencontres (niveau 4, optionnel). */
  matches?: TreeMatchSummary[];
}

/** Niveau 2 — Pays / région (ou catégorie de circuit au tennis). */
export interface CountryNode {
  id: string;
  name: string;
  /** Code ISO 3166-1 alpha-2 pour le drapeau (« INT » → globe). */
  countryCode: string;
  leagues: LeagueNode[];
}

/** Niveau 1 — Sport. `icon` = nom d'icône Lucide. */
export interface SportNode {
  id: string;
  name: string;
  icon: string;
  totalMatches: number;
  /** Nombre de matchs en direct (badge rouge). */
  liveMatches: number;
  countries: CountryNode[];
}

export type SidebarMode = MatchViewMode;

/** Clés d'onglet central — identiques aux ids de sport de l'arborescence. */
export type SportTabId =
  | "tennis"
  | "football"
  | "cs2"
  | "mma"
  | "nba"
  | "wnba"
  | "cycling"
  | "f1"
  | "baseball"
  | "rugby";
