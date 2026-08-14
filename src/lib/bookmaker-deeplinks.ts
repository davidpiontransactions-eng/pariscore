/**
 * Deep-links bookmakers — Phase 7. Liens DIRECTS (zéro affiliation) vers la fiche
 * ou la recherche d'un match chez les principaux bookmakers. Aucun lien affilié,
 * aucun tracking : cohérent avec la position éditoriale de PariScore.
 *
 * Sans identifiant d'événement côté bookmaker, on pointe vers la recherche interne
 * du site avec les noms d'équipes — l'utilisateur arrive sur la bonne page sport.
 */

export type BookmakerInfo = {
  key: string;
  name: string;
  /** URL de recherche / page sport (non affiliée). */
  buildUrl: (query: string) => string;
};

const BOOKMAKERS: BookmakerInfo[] = [
  {
    key: "bet365",
    name: "Bet365",
    buildUrl: (q) => `https://www.bet365.com/#/IP/B1?q=${encodeURIComponent(q)}`,
  },
  {
    key: "unibet",
    name: "Unibet",
    buildUrl: (q) => `https://www.unibet.fr/sport/search?q=${encodeURIComponent(q)}`,
  },
  {
    key: "winamax",
    name: "Winamax",
    buildUrl: (q) => `https://www.winamax.fr/paris-sportifs/sports/search?q=${encodeURIComponent(q)}`,
  },
  {
    key: "betclic",
    name: "Betclic",
    buildUrl: (q) => `https://www.betclic.fr/search?q=${encodeURIComponent(q)}`,
  },
  {
    key: "1xbet",
    name: "1xBet",
    buildUrl: (q) => `https://1xbet.fr/line/search?q=${encodeURIComponent(q)}`,
  },
];

/** Liste des bookmakers supportés. */
export function getBookmakers(): BookmakerInfo[] {
  return BOOKMAKERS;
}

/** Construit la requête de recherche depuis deux équipes. */
export function buildMatchQuery(teamA: string, teamB: string): string {
  return `${teamA} ${teamB}`;
}

/** Deep-link vers la recherche d'un bookmaker pour un match donné. */
export function buildDeepLink(bookmakerKey: string, teamA: string, teamB: string): string | null {
  const bm = BOOKMAKERS.find((b) => b.key === bookmakerKey);
  if (!bm) return null;
  return bm.buildUrl(buildMatchQuery(teamA, teamB));
}
