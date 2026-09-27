// Pilule de bandeau filtre — charte Flashscore actuelle (`live_tabs.css`,
// `.filters__tab` / `.filters__group`) relevée sur flashscore.com en 2026 :
// pilule pleine sans bordure, texte 700 uppercase 12px (letter-spacing .4px),
// neutre #eee / survol #c8cdcd sur texte #555e61, sélection rouge #ff0046.
// Partagée : bandeau des vues + filtres de moment + déclencheur championnats.

/** Base commune à toutes les pilules de filtre (hauteur 32px = cible tactile). */
export const PILL_BASE =
  "flex min-h-[32px] shrink-0 items-center rounded-lg px-3 py-1 text-[12px] font-bold uppercase leading-3 tracking-[0.4px] transition-colors";

/** Pilule neutre (non active). */
export const PILL_NEUTRAL =
  "bg-[#eeeeee] text-[#555e61] hover:bg-[#c8cdcd] hover:text-[#001e28]";

/** Pilule active (état sélectionné / filtre engagé). */
export const PILL_SELECTED = "bg-[#ff0046] text-white";

/** Classes complètes d'une pilule selon son état. */
export const pillClass = (selected: boolean): string =>
  `${PILL_BASE} ${selected ? PILL_SELECTED : PILL_NEUTRAL}`;
