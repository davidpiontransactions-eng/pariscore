/**
 * Géo des ligues baseball — source unique ligue → code ISO + libellé pays.
 *
 * Extrait de `sports-tree.ts` (BASEBALL_LEAGUE_COUNTRY) pour être consommé
 * par les composants baseball (barre de ligues, badge carte) sans dépendre
 * du module sidebar : les drapeaux sont rendus par `ui/CountryFlag`
 * (SVG local `/flags/<iso>.svg`) car les emoji drapeau s'affichent en
 * lettres ("US", "KR"…) sous Windows — cf. `ui/country-flag.tsx`.
 */
export type BaseballLeagueGeo = { country: string; code: string };

export const BASEBALL_LEAGUE_COUNTRY: Record<string, BaseballLeagueGeo> = {
  MLB: { country: "USA", code: "US" },
  KBO: { country: "Corée du Sud", code: "KR" },
  NPB: { country: "Japon", code: "JP" },
  CPBL: { country: "Taïwan", code: "TW" },
  LMB: { country: "Mexique", code: "MX" },
  LIDOM: { country: "Rép. dominicaine", code: "DO" },
  LVBP: { country: "Venezuela", code: "VE" },
};

/** Code ISO du drapeau d'une ligue baseball ("") si inconnue → globe 🌏. */
export function baseballLeagueFlag(league: string): string {
  return BASEBALL_LEAGUE_COUNTRY[league]?.code ?? "";
}
