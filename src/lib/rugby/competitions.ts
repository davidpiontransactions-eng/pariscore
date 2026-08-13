/**
 * Registre curé des compétitions rugby couvertes, mappées vers l'API publique
 * ESPN (site.api.espn.com). Les ids de ligue ESPN sont publics et stables.
 *
 * Deux codes : rugby union (XV) et rugby league (XIII).
 */

import type { CompetitionDef } from "./types";

export const RUGBY_COMPETITIONS: CompetitionDef[] = [
  {
    id: "six-nations",
    slug: "six-nations",
    espnSport: "rugby",
    espnLeagueId: "180659",
    name: "Six Nations",
    code: "UNION",
    country: "Europe",
    description:
      "Le Tournoi des Six Nations — la plus ancienne compétition internationale de rugby au monde, disputée chaque année entre l'Angleterre, la France, l'Irlande, l'Italie, l'Écosse et le pays de Galles.",
    format:
      "Chaque équipe affronte toutes les autres une fois (5 journées, domicile/extérieur alternés) : 4 points par victoire, 2 par nul, plus des bonus offensif (4 essais+) et défensif (défaite ≤ 7 points).",
    featured: true,
    sortOrder: 1,
  },
  {
    id: "rugby-world-cup",
    slug: "rugby-world-cup",
    espnSport: "rugby",
    espnLeagueId: "164205",
    name: "Coupe du Monde",
    code: "UNION",
    country: "Monde",
    description:
      "Le sommet du rugby à XV — 20 nations s'affrontent en poules puis en phases finales pour soulever le Webb Ellis Cup.",
    format:
      "Quatre poules de cinq en round-robin ; les deux premiers de chaque poule filent en quarts, puis demi-finales et finale.",
    featured: true,
    sortOrder: 2,
    lookaheadDays: 520,
  },
  {
    id: "rugby-championship",
    slug: "rugby-championship",
    espnSport: "rugby",
    espnLeagueId: "244293",
    name: "The Rugby Championship",
    code: "UNION",
    country: "Hémisphère Sud",
    description:
      "La compétition internationale elite de l'hémisphère sud : Argentine, Australie, Nouvelle-Zélande et Afrique du Sud.",
    format: "Double round-robin — chaque équipe joue les autres aller-retour (6 journées).",
    featured: true,
    sortOrder: 3,
  },
  {
    id: "super-rugby-pacific",
    slug: "super-rugby-pacific",
    espnSport: "rugby",
    espnLeagueId: "242041",
    name: "Super Rugby Pacific",
    code: "UNION",
    country: "Océanie",
    description:
      "La grande compétition de franchises de l'hémisphère sud : Nouvelle-Zélande, Australie, Fidji et îles du Pacifique.",
    format: "Saison régulière en round-robin, puis quarts, demies et grande finale.",
    featured: true,
    sortOrder: 4,
  },
  {
    id: "united-rugby-championship",
    slug: "united-rugby-championship",
    espnSport: "rugby",
    espnLeagueId: "270557",
    name: "United Rugby Championship",
    code: "UNION",
    country: "Europe & Afrique du Sud",
    description:
      "Compétition transfrontalière réunissant les clubs d'Irlande, du pays de Galles, d'Écosse, d'Italie et d'Afrique du Sud.",
    format:
      "Chaque équipe joue deux fois les équipes de sa poule et une fois celles des autres poules ; classement unique.",
    featured: true,
    sortOrder: 5,
  },
  {
    id: "top-14",
    slug: "top-14",
    espnSport: "rugby",
    espnLeagueId: "270559",
    name: "Top 14",
    code: "UNION",
    country: "France",
    description:
      "L'élite du rugby français — réputé le championnat le plus physique du monde.",
    format:
      "14 clubs en double round-robin (26 journées) ; le top 6 se qualifie pour les phases finales, sacre au Stade de France.",
    featured: true,
    sortOrder: 6,
  },
  {
    id: "premiership",
    slug: "premiership",
    espnSport: "rugby",
    espnLeagueId: "267979",
    name: "Gallagher Premiership",
    code: "UNION",
    country: "Angleterre",
    description:
      "Le championnat professionnel anglais de rugby à XV, réunissant les dix plus grands clubs du pays.",
    format: "Saison régulière aller-retour, puis demi-finales et finale à Twickenham.",
    featured: true,
    sortOrder: 7,
  },
  {
    id: "champions-cup",
    slug: "champions-cup",
    espnSport: "rugby",
    espnLeagueId: "271937",
    name: "Champions Cup",
    code: "UNION",
    country: "Europe",
    description:
      "La compétition européenne elite des clubs, avec les meilleures équipes de l'URC, du Top 14 et de la Premiership.",
    format:
      "Quatre poules de quatre ; les premiers et les trois meilleurs deuxièmes passent en phases finales.",
    featured: true,
    sortOrder: 8,
  },
  {
    id: "nations-championship",
    slug: "nations-championship",
    espnSport: "rugby",
    espnLeagueId: "17567",
    name: "Nations Championship",
    code: "UNION",
    country: "Monde",
    description:
      "La nouvelle compétition internationale annuelle de World Rugby opposant les nations du Six Nations à celles du Rugby Championship.",
    format: "Deux divisions, nations européennes contre nations de l'hémisphère sud, avec promotion/relégation.",
    featured: true,
    sortOrder: 9,
  },
  {
    id: "international-tests",
    slug: "international-tests",
    espnSport: "rugby",
    espnLeagueId: "289234",
    name: "Test-matchs internationaux",
    code: "UNION",
    country: "Monde",
    description:
      "Tests internationaux — tournées d'été, tests d'automne et tout ce qu'il y a entre.",
    format: "Tests isolés et courtes séries entre sélections nationales.",
    featured: false,
    sortOrder: 10,
  },
  {
    id: "nrl",
    slug: "nrl",
    espnSport: "rugby-league",
    espnLeagueId: "3",
    name: "NRL",
    code: "LEAGUE",
    country: "Australie & NZ",
    description:
      "La première compétition mondiale de rugby à XIII, disputée par 17 clubs australiens et néo-zélandais.",
    format: "24 journées de saison régulière, puis le top 8 en phases finales.",
    featured: true,
    sortOrder: 11,
  },
  {
    id: "major-league-rugby",
    slug: "major-league-rugby",
    espnSport: "rugby",
    espnLeagueId: "289262",
    name: "Major League Rugby",
    code: "UNION",
    country: "USA & Canada",
    description: "La compétition professionnelle phare d'Amérique du Nord.",
    format: "Saison régulière avec conférences et play-offs.",
    featured: false,
    sortOrder: 12,
  },
  {
    id: "currie-cup",
    slug: "currie-cup",
    espnSport: "rugby",
    espnLeagueId: "270555",
    name: "Currie Cup",
    code: "UNION",
    country: "Afrique du Sud",
    description:
      "La plus ancienne compétition de rugby de l'hémisphère sud, disputée par les provinces sud-africaines.",
    format: "Round-robin avec demi-finales et finale.",
    featured: false,
    sortOrder: 13,
  },
  {
    id: "npc",
    slug: "npc",
    espnSport: "rugby",
    espnLeagueId: "270563",
    name: "Bunnings NPC",
    code: "UNION",
    country: "Nouvelle-Zélande",
    description:
      "Le championnat provincial néo-zélandais, vivier des All Blacks.",
    format: "Round-robin avec play-offs et traditions Ranfurly Shield.",
    featured: false,
    sortOrder: 14,
  },
];

/** Index par slug pour accès O(1). */
export const COMPETITION_BY_SLUG = new Map(
  RUGBY_COMPETITIONS.map((c) => [c.slug, c])
);

/** Compétitions mises en avant sur la page d'accueil. */
export function featuredCompetitions(): CompetitionDef[] {
  return RUGBY_COMPETITIONS.filter((c) => c.featured).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}
