/**
 * Weekly Marquee Tournaments — R8 curation (2026-07-22).
 *
 * Détermine les tournois "phares de la semaine" à mettre en avant
 * (section "À la une" de la home tennis). Source de vérité = mapping
 * codé en dur `ISO_WEEK → [tournamentNames]`.
 *
 * On utilise les NOMS des tournois (pas les ids) car les matchs BSD/Odds
 * transportent `match.tournament` comme string libre. La résolution se
 * fait par recherche normalisée insensible à la casse/accents (cf.
 * `normalize()`), similaire à `resolveTournamentCategory`.
 *
 * Fallback : si la semaine courante n'a pas d'entrée, retourne une config
 * vide (la section "À la une" disparaît proprement).
 */

/** Semaine ISO au format "YYYY-Www" (ex: "2026-W29"). */
export type IsoWeek = string;

export interface WeeklyMarqueeConfig {
  /** Noms des tournois phares (ex: ["Kitzbühel", "Estoril", "Hambourg"]). */
  tournamentNames: string[];
  /** Numéro de semaine pour affichage (ex: 29). */
  weekNumber: number;
  /** Optionnel : ordre d'affichage prioritaire. */
  order?: string[];
}

/**
 * Mapping codé en dur. À mettre à jour chaque lundi (ou en batch annuel
 * depuis le calendrier ATP/WTA officiel).
 *
 * Notes S29 2026 :
 *   - Kitzbühel (Autriche) = Generali Open, ATP 250, terre battue
 *   - Estoril (Portugal) = Estoril Open, ATP 250, terre battue
 *   - Hambourg (Allemagne) = Hamburg Open, ATP 500, terre battue
 */
export const WEEKLY_MARQUEE: Record<IsoWeek, WeeklyMarqueeConfig> = {
  "2026-W29": {
    tournamentNames: ["Hambourg", "Hamburg", "Estoril", "Kitzbühel", "Kitzbuhel"],
    weekNumber: 29,
    order: ["Hamburg", "Hambourg", "Estoril", "Kitzbühel", "Kitzbuhel"],
  },
  // R8 QA (2026-07-21) : les tournois ATP de juillet 2026 (Kitzbühel + Estoril
  // + Hambourg) chevauchent W29/W30 car la semaine ATP va lundi→dimanche et
  // les finales tombent le dimanche 19 juillet (W29) ET dimanche 26 juillet
  // (W30). On étend donc le marquee à W30 pour couvrir toute la quinzaine.
  "2026-W30": {
    tournamentNames: ["Hambourg", "Hamburg", "Estoril", "Kitzbühel", "Kitzbuhel"],
    weekNumber: 30,
    order: ["Hamburg", "Hambourg", "Estoril", "Kitzbühel", "Kitzbuhel"],
  },
};

/** Vide si la semaine n'est pas configurée. */
const EMPTY_MARQUEE: WeeklyMarqueeConfig = {
  tournamentNames: [],
  weekNumber: 0,
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcule la semaine ISO courante au format "YYYY-Www".
 * Inspiré de https://week-number.net/about
 */
export function getCurrentIsoWeek(now: Date = new Date()): IsoWeek {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Renvoie les tournois phares pour une semaine donnée (ou la semaine courante). */
export function getWeekMarquee(week?: IsoWeek): WeeklyMarqueeConfig {
  const key = week ?? getCurrentIsoWeek();
  return WEEKLY_MARQUEE[key] ?? EMPTY_MARQUEE;
}

/**
 * Vrai si un nom de tournoi fait partie du marquee de la semaine.
 * Recherche normalisée (insensible casse/accents) + match partiel
 * (ex: "Hamburg Open" contient "hamburg").
 */
export function isMarqueeTournament(
  tournamentName: string | undefined | null,
  week?: IsoWeek,
): boolean {
  if (!tournamentName) return false;
  const marquee = getWeekMarquee(week);
  if (marquee.tournamentNames.length === 0) return false;
  const norm = normalize(tournamentName);
  if (!norm) return false;
  return marquee.tournamentNames.some((m) => {
    const mn = normalize(m);
    if (mn.length < 4) return false;
    return norm.includes(mn) || mn.includes(norm);
  });
}
