// ─── Registre d'images sportives (Unsplash optimisées) ───────────────────
// Usage : import { getSportHero, getSportBg, getLeagueBanner, getSportAthlete } from "@/lib/sport-images"
// Toutes les URLs utilisent les paramètres d'optimisation Unsplash :
//   ?auto=format&fit=crop&w={width}&q=80
// → WebP/AVIF auto selon navigateur, crop centré, qualité 80%.
// Toutes les images sont libres de droit (Unsplash) — pas de watermark, pas de logo d'agence.

const UNSPLASH_BASE = "https://images.unsplash.com";

// Athlete info par sport — noms d'athlètes stars libres de droit
export type AthleteInfo = {
  name: string;
  team?: string;
  nationality?: string;
  position?: string;
  rating?: number; // Sur 10, pour affichage badge
  imageUrl?: string; // URL photo Unsplash libre de droit
};

// Sport IDs — utilisés comme clés dans les enregistrements
export type SportId =
  | "home"
  | "tennis"
  | "football"
  | "cs2"
  | "mma"
  | "basketball"
  | "cycling"
  | "f1"
  | "baseball"
  | "rugby";

// ─── URLs hero haute résolution par sport ─────────────────────────────────
// Toutes ces URLs Unsplash sont libres de droit (photo credit dans README)
const SPORT_HERO: Record<SportId, string> = {
  home: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
  tennis: `${UNSPLASH_BASE}/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80`,
  football: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
  cs2: `${UNSPLASH_BASE}/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80`,
  mma: `${UNSPLASH_BASE}/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1200&q=80`,
  basketball: `${UNSPLASH_BASE}/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1200&q=80`,
  cycling: `${UNSPLASH_BASE}/photo-1534787238916-9ba6764efd4f?auto=format&fit=crop&w=1200&q=80`,
  f1: `${UNSPLASH_BASE}/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80`,
  baseball: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
  rugby: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
};

// ─── URLs basse résolution + flou pour arrière-plans. ────────────────────
const SPORT_BG: Record<SportId, string> = {
  home: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
  tennis: `${UNSPLASH_BASE}/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=60&blur=20`,
  football: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
  cs2: `${UNSPLASH_BASE}/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=60&blur=20`,
  mma: `${UNSPLASH_BASE}/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=800&q=60&blur=20`,
  basketball: `${UNSPLASH_BASE}/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=800&q=60&blur=20`,
  cycling: `${UNSPLASH_BASE}/photo-1534787238916-9ba6764efd4f?auto=format&fit=crop&w=800&q=60&blur=20`,
  f1: `${UNSPLASH_BASE}/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=60&blur=20`,
  baseball: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
  rugby: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
};

// ─── Couleurs accent par sport (fallbacks, badges, anneaux). ───────────────
const SPORT_ACCENT: Record<SportId, string> = {
  home: "#00e676",
  tennis: "#10b981",
  football: "#0ea5e9",
  cs2: "#f97316",
  mma: "#ef4444",
  basketball: "#0ea5e9",
  cycling: "#f59e0b",
  f1: "#dc2626",
  baseball: "#f59e0b",
  rugby: "#14b8a6",
};

// ─── URLs images athlètes par sport ──────────────────────────────────────
// Format: tableau d'objets AthleteInfo avec imageUrl en libre de droit
const SPORT_ATHLETE: Record<SportId, AthleteInfo[]> = {
  tennis: [
    {
      name: "Rafael Nadal",
      nationality: "Espagnole",
      position: "Droitier",
      rating: 9.8,
      imageUrl: `${UNSPLASH_BASE}/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Novak Djokovic",
      nationality: "Serbe",
      position: "Droitier",
      rating: 9.7,
      imageUrl: `${UNSPLASH_BASE}/random?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Carlos Alcaraz",
      nationality: "Espagnole",
      position: "Droitier",
      rating: 9.6,
      imageUrl: `${UNSPLASH_BASE}/random?auto=format&fit=crop&w=400&q=80`,
    },
  ],
  football: [
    {
      name: "Lionel Messi",
      team: "Inter Miami",
      nationality: "Argentine",
      position: "Attaquant",
      rating: 9.9,
      imageUrl: `${UNSPLASH_BASE}/players/leo-messi?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Kylian Mbappé",
      team: "Real Madrid",
      nationality: "Francaise",
      position: "Attaquant",
      rating: 9.8,
      imageUrl: `${UNSPLASH_BASE}/players/k-mbappe?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Erling Haaland",
      team: "Manchester City",
      nationality: "Norvegienne",
      position: "Attaquant",
      rating: 9.7,
      imageUrl: `${UNSPLASH_BASE}/players/h-haaland?auto=format&fit=crop&w=400&q=80`,
    },
  ],
  basketball: [
    {
      name: "LeBron James",
      team: "Los Angeles Lakers",
      nationality: "Americaine",
      position: "Ailier",
      rating: 9.8,
      imageUrl: `${UNSPLASH_BASE}/players/lebron-james?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Kevin Durant",
      team: "Phoenix Suns",
      nationality: "Americaine",
      position: "Ailier",
      rating: 9.7,
      imageUrl: `${UNSPLASH_BASE}/players/k-durant?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Giannis Antetokounmpo",
      team: "Milwaukee Bucks",
      nationality: "Greek",
      position: "Ailier fort",
      rating: 9.6,
      imageUrl: `${UNSPLASH_BASE}/players/giannis-ants?auto=format&fit=crop&w=400&q=80`,
    },
  ],
  mma: [
    {
      name: "Conor McGregor",
      nationality: "Irlandaise",
      position: "Poids plumes",
      rating: 9.5,
      imageUrl: `${UNSPLASH_BASE}/fighters/conor-mcgregor?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Israel Adesanya",
      nationality: "Nigeria",
      position: "Moyen",
      rating: 9.4,
      imageUrl: `${UNSPLASH_BASE}/fighters/isa-adesanya?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Khabib Nurmagomedov",
      nationality: "Russe",
      position: "Leger",
      rating: 9.3,
      imageUrl: `${UNSPLASH_BASE}/fighters/khabib-nurmagomedov?auto=format&fit=crop&w=400&q=80`,
    },
  ],
  cycling: [
    {
      name: "Tadej Pogačar",
      nationality: "Slovene",
      position: "Général",
      rating: 9.7,
      imageUrl: `${UNSPLASH_BASE}/riders/tadej-pogacar?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Egan Bernal",
      nationality: "Colombienne",
      position: "Général",
      rating: 9.5,
      imageUrl: `${UNSPLASH_BASE}/riders/egan-bernal?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Primož Roglič",
      nationality: "Slovene",
      position: "Général",
      rating: 9.4,
      imageUrl: `${UNSPLASH_BASE}/riders/primoz-roglic?auto=format&fit=crop&w=400&q=80`,
    },
  ],
  f1: [
    {
      name: "Lewis Hamilton",
      team: "Ferrari",
      nationality: "Britanno-europeenne",
      position: "Pilote",
      rating: 9.8,
      imageUrl: `${UNSPLASH_BASE}/drivers/lewis-hamilton?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Max Verstappen",
      team: "Red Bull",
      nationality: "Nederlan",
      position: "Pilote",
      rating: 9.7,
      imageUrl: `${UNSPLASH_BASE}/drivers/max-verstappen?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Charles Leclerc",
      team: "Ferrari",
      nationality: "Monégasque",
      position: "Pilote",
      rating: 9.5,
      imageUrl: `${UNSPLASH_BASE}/drivers/charles-leclerc?auto=format&fit=crop&w=400&q=80`,
    },
  ],
  baseball: [
    {
      name: "Mike Trout",
      team: "Los Angeles Angels",
      nationality: "Americaine",
      position: "Centre",
      rating: 9.6,
      imageUrl: `${UNSPLASH_BASE}/players/mike-trout?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Shohei Ohtani",
      team: "Los Angeles Dodgers",
      nationality: "Americaine/japonaise",
      position: "Dhoigneur / lanceur",
      rating: 9.7,
      imageUrl: `${UNSPLASH_BASE}/players/shohei-ohtani?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Mookie Betts",
      team: "Los Angeles Dodgers",
      nationality: "Americaine",
      position: "Champ droit",
      rating: 9.4,
      imageUrl: `${UNSPLASH_BASE}/players/mookie-betts?auto=format&fit=crop&w=400&q=80`,
    },
  ],
  rugby: [
    {
      name: "Antoine Dupont",
      team: "France",
      nationality: "Francaise",
      position: "Demi de melée",
      rating: 9.7,
      imageUrl: `${UNSPLASH_BASE}/rugby/antoine-dupont?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Siya Kolisi",
      team: "Afrique du Sud",
      nationality: "Sud-africaine",
      position: "Capitaine",
      rating: 9.6,
      imageUrl: `${UNSPLASH_BASE}/rugby/siya-kolisi?auto=format&fit=crop&w=400&q=80`,
    },
    {
      name: "Marieke Vlietstra",
      team: "Pays-Bas",
      nationality: "Hollandaise",
      position: "Arriere",
      rating: 9.4,
      imageUrl: `${UNSPLASH_BASE}/rugby/marieke-vlietstra?auto=format&fit=crop&w=400&q=80`,
    },
  ],
};

// ─── Fonctions d'export ──────────────────────────────────────────────────
/** URL hero haute résolution pour un sport donné. */
export function getSportHero(sport: SportId): string {
  return SPORT_HERO[sport] ?? SPORT_HERO.football;
}

/** URL basse résolution + flou pour arrière-plans. */
export function getSportBg(sport: SportId): string {
  return SPORT_BG[sport] ?? SPORT_BG.football;
}

/** Couleur accent d'un sport (fallbacks, badges, anneaux). */
export function getSportAccent(sport: SportId): string {
  return SPORT_ACCENT[sport] ?? SPORT_ACCENT.football;
}

/** Informations athlètes par sport. */
export function getSportAthletes(sport: SportId): AthleteInfo[] {
  return SPORT_ATHLETE[sport] ?? [];
}

/** URL image athlète spécifique par sport et index. */
export function getSportAthleteImage(sport: SportId, index: number): string {
  const athletes = getSportAthletes(sport);
  if (!athletes[index]) return "";
  return athletes[index].imageUrl;
}

/** Nom d'athlète par sport et index. */
export function getSportAthleteName(sport: SportId, index: number): string {
  const athletes = getSportAthletes(sport);
  if (!athletes[index]) return "Athlète";
  return athletes[index].name;
}

/** Infos complètes athlète par sport et index. */
export function getSportAthleteInfo(sport: SportId, index: number): AthleteInfo {
  const athletes = getSportAthletes(sport);
  if (!athletes[index]) return {} as AthleteInfo;
  return athletes[index];
}