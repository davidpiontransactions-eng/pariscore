/**
 * Identifiants des sous-onglets tennis — source unique de vérité.
 *
 * Pourquoi un module pur (ni React, ni i18n) : ces valeurs sont consommées par
 * la rangée de tête (`src/components/layout/sport-sub-tabs.tsx`), par le store
 * zustand (`use-sports-sidebar-store.ts`, qui n'est pas un composant) et par la
 * migration de la persistance. Un `.tsx` avec des icônes React rendrait le store
 * dépendant de React, et un libellé en dur créerait un point d'entrée français
 * hors i18n.
 *
 * ⚠️ INVARIANT : `TENNIS_SUB_TABS` doit rester aligné sur
 * `SPORT_SUB_TABS.tennis` (`src/components/layout/sport-sub-tabs.tsx`) — c'est
 * la même clé `sportSubTabs.tennis` qui est lue/écrite des deux côtés. La
 * position compte autant que l'id, et deux règles s'y opposent :
 *   - le **défaut est le 1ᵉʳ** onglet (convention maison : `calendrier` pour
 *     football, `matchs` pour basketball) ;
 *   - `cards` est **3ᵉ** et pas 1ᵉʳ, parce que cette vue CONTIENT `live` et
 *     `prematch` ; en tête elle deviendrait le défaut et changerait ce que voit
 *     l'utilisateur à l'ouverture.
 */

/** Les 7 identifiants canoniques, dans l'ordre d'affichage. */
export const TENNIS_SUB_TAB_IDS = [
  "prematch",
  "live",
  "cards",
  "tournaments",
  "list",
  "rankings",
  "strategies",
] as const;

export type TennisSubTabId = (typeof TENNIS_SUB_TAB_IDS)[number];

/**
 * Sous-onglet par défaut de l'onglet tennis = le 1ᵉʳ de `TENNIS_SUB_TABS`.
 * `prematch` porte le contenu historique de l'ancien onglet `today`, qui était
 * déjà l'état initial (`tennis-tab-content.tsx`, `useState<TennisSubTab>("today")`).
 */
export const DEFAULT_TENNIS_SUB_TAB: TennisSubTabId = "prematch";

/**
 * Anciens identifiants persistés → identifiants canoniques.
 * `today` et `calendar` ont été renommés quand les sections tennis sont
 * devenues de vrais sous-onglets de tête (rangée Flashscore) au lieu d'un
 * `useState` local. Un utilisateur qui a `today` en persistance doit retomber
 * sur la bonne vue, pas sur le défaut.
 */
const LEGACY_SUB_TAB_ALIASES: Record<string, TennisSubTabId> = {
  today: "prematch",
  calendar: "strategies",
};

/** Métadonnées d'affichage d'un sous-onglet tennis. */
export type TennisSubTabMeta = {
  id: TennisSubTabId;
  /** Clé i18n sous le namespace `tennis` (résolue par les rangées de nav). */
  labelKey: string;
};

/** Les 7 sous-onglets, dans l'ordre — l'ordre fait partie du contrat. */
export const TENNIS_SUB_TABS: readonly TennisSubTabMeta[] = [
  { id: "prematch", labelKey: "subTabPrematch" },
  { id: "live", labelKey: "subTabLive" },
  { id: "cards", labelKey: "subTabCards" },
  { id: "tournaments", labelKey: "subTabTournaments" },
  { id: "list", labelKey: "subTabList" },
  { id: "rankings", labelKey: "subTabRankings" },
  { id: "strategies", labelKey: "subTabStrategies" },
];

/** `value` est-il un identifiant canonique ? */
export function isTennisSubTabId(value: unknown): value is TennisSubTabId {
  return (
    typeof value === "string" &&
    (TENNIS_SUB_TAB_IDS as readonly string[]).includes(value)
  );
}

/**
 * Normalise une valeur brute (store, URL `?sub=`, props) vers un
 * sous-onglet tennis valide.
 *
 * Sans ce normaliseur, un identifiant périmé en persistance affiche **zéro**
 * onglet actif : la rangée ne trouve aucun `tab.id === active` et l'utilisateur
 * tombe sur une page vide sans comprendre pourquoi.
 */
export function parseTennisSubTab(
  value: string | null | undefined,
): TennisSubTabId {
  if (isTennisSubTabId(value)) return value;
  const legacy = value != null ? LEGACY_SUB_TAB_ALIASES[value] : undefined;
  return legacy ?? DEFAULT_TENNIS_SUB_TAB;
}

/**
 * Migration de la valeur persistée d'un sous-onglet tennis.
 *
 * Renvoie `undefined` quand rien n'est persisté : à l'appelant de décider
 * d'injecter le défaut (le store le fait pour un sport absent de
 * `sportSubTabs`, pas ici) — on ne veut pas qu'un `undefined` tennis écrase
 * une autre valeur du même objet.
 */
export function migrateTennisSubTab(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const legacy = LEGACY_SUB_TAB_ALIASES[value];
  if (legacy) return legacy;
  return isTennisSubTabId(value) ? value : undefined;
}
