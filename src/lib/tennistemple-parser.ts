/**
 * TennisTemple parser — extrait les données de schedule depuis le HTML
 * de en.tennistemple.com/competitions/atp/<year> (ou wta).
 *
 * ⚠️ TennisTemple n'a pas d'API publique (vérifié 2026-07-20 via WebSearch).
 * Ce parser s'appuie sur le format de page observé : une liste de matchs
 * en haut (live/aujourd'hui) avec format "<joueur1> <joueur2> <heure>", puis
 * une grille de tournois par mois avec catégorie + dates + ville + tenant.
 *
 * Source format observée (sample 2026-07-20) :
 *   "Lehecka Nava 10:30 Cobolli Comesana 13:30 ..."
 *   "Hong Kong ATP 250 • 730,000 $ 5 Jan - 11 Jan Bublik A"
 *
 * robots.txt : "index, follow" → scraping respectueux autorisé.
 */

export type RawTennisTempleEntry = {
  tournamentName: string;
  player1Name: string;
  player2Name: string;
  /** Heure telle qu'affichée (ex: "10:30") — timezone implicite du tournoi */
  rawTime: string;
  /** Date ISO du jour scrapped (ex: "2026-07-20") */
  rawDate: string;
  /** Timezone IANA du tournoi (best-effort, déduite du nom) */
  rawTimezone?: string;
};

export type ParsedScheduleEntry = {
  player1Name: string;
  player2Name: string;
  tournamentName: string;
  /** Heure UTC ISO (ex: "2026-07-20T08:30:00.000Z" si timezone Europe/Paris) */
  scheduledAtUTC: string;
  /** Timezone IANA du tournoi (ex: "Europe/Paris") */
  timezone: string;
  /** Heure locale au tournoi (ex: "10:30") */
  localTime: string;
  source: "tennistemple";
};

export type ParsedTournament = {
  name: string;
  category: string; // "Grand Slam" | "ATP Masters 1000" | "ATP 500" | "ATP 250" | ...
  city?: string;
  country?: string;
  prizeMoney?: string;
  startDate: string; // ISO
  endDate: string; // ISO
  defendingChampion?: string;
};

// Map nom tournoi → timezone IANA (best-effort basé sur la ville)
const TOURNAMENT_TIMEZONES: Record<string, string> = {
  "Australian Open": "Australia/Melbourne",
  "Roland Garros": "Europe/Paris",
  "French Open": "Europe/Paris",
  Wimbledon: "Europe/London",
  "US Open": "America/New_York",
  Indian Wells: "America/Los_Angeles",
  Miami: "America/New_York",
  MonteCarlo: "Europe/Monaco",
  "Monte-Carlo": "Europe/Monaco",
  Madrid: "Europe/Madrid",
  Rome: "Europe/Rome",
  Cincinnati: "America/New_York",
  Paris: "Europe/Paris",
  Shanghai: "Asia/Shanghai",
  Turin: "Europe/Rome",
  Brisbane: "Australia/Brisbane",
  Adelaide: "Australia/Adelaide",
  Auckland: "Pacific/Auckland",
  Doha: "Asia/Qatar",
  Dubai: "Asia/Dubai",
  Acapulco: "America/Mexico_City",
  Barcelone: "Europe/Madrid",
  Barcelona: "Europe/Madrid",
  Munich: "Europe/Berlin",
  Hambourg: "Europe/Berlin",
  Hamburg: "Europe/Berlin",
  Geneva: "Europe/Zurich",
  Stuttgart: "Europe/Berlin",
  Halle: "Europe/Berlin",
  Londres: "Europe/London",
  London: "Europe/London",
  Gstaad: "Europe/Zurich",
  Umag: "Europe/Zagreb",
  Bastad: "Europe/Stockholm",
  Estoril: "Europe/Lisbon",
  Kitzbuhel: "Europe/Vienna",
  "Los Cabos": "America/Mazatlan",
  Montpellier: "Europe/Paris",
  Dallas: "America/Chicago",
  Rotterdam: "Europe/Amsterdam",
  "Buenos Aires": "America/Argentina/Buenos_Aires",
  "Rio de Janeiro": "America/Sao_Paulo",
  "Delray Beach": "America/New_York",
  Santiago: "America/Santiago",
  Houston: "America/Chicago",
  Marrakech: "Africa/Casablanca",
  Bucharest: "Europe/Bucharest",
  Bucarest: "Europe/Bucharest",
  Hong: "Asia/Hong_Kong",
  "National Bank Open": "America/Toronto",
  "Winston-Salem": "America/New_York",
  Chengdu: "Asia/Shanghai",
  Hangzhou: "Asia/Shanghai",
  Pekin: "Asia/Shanghai",
  Tokyo: "Asia/Tokyo",
  Lyon: "Europe/Paris",
  Almaty: "Asia/Almaty",
  Vienne: "Europe/Vienna",
  Vienna: "Europe/Vienna",
  Bâle: "Europe/Zurich",
  Basel: "Europe/Zurich",
  Bruxelles: "Europe/Brussels",
  Stockholm: "Europe/Stockholm",
};

// Heures à 2 chiffres suivies de : et 2 chiffres (10:30, 13:30, 09:00)
const TIME_REGEX = /\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/g;

// Plage de dates type "5 Jan - 11 Jan" ou "18 Jan - 1 Feb"
const DATE_RANGE_REGEX = /(\d{1,2})\s+(\w{3})\s*[-–]\s*(\d{1,2})\s+(\w{3})/;

// Catégories ATP connues
const CATEGORIES = [
  "Grand Slam",
  "ATP Masters 1000",
  "ATP 500",
  "ATP 250",
  "ATP Finals",
  "Challenger",
  "ITF Men",
  "ITF Women",
];

const MONTH_TO_NUM: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Devine la timezone d'un tournoi à partir de son nom.
 * Fallback UTC si inconnu.
 */
export function guessTimezone(tournamentName: string): string {
  for (const [key, tz] of Object.entries(TOURNAMENT_TIMEZONES)) {
    if (tournamentName.toLowerCase().includes(key.toLowerCase())) {
      return tz;
    }
  }
  return "UTC";
}

/**
 * Parse le schedule du jour depuis le HTML TennisTemple.
 *
 * Le format scrapé contient en haut des séquences "Joueur1 Joueur2 HH:MM"
 * répétées. Comme le HTML vient du webReader (markdown-ifié), on extrait
 * via regex les noms (motsCapitalisés) autour des heures.
 *
 * @param html Contentu HTML ou markdown TennisTemple
 * @param defaultDate Date ISO du jour scrapped (YYYY-MM-DD), défaut aujourd'hui
 * @param tournamentName Nom du tournoi actuel (pour timezone) — optionnel
 */
export function parseTennisTempleSchedule(
  html: string,
  defaultDate?: string,
  tournamentName?: string,
): ParsedScheduleEntry[] {
  const dateStr =
    defaultDate ?? new Date().toISOString().slice(0, 10);

  // Trouver toutes les heures dans le texte
  const times: { time: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  TIME_REGEX.lastIndex = 0;
  while ((m = TIME_REGEX.exec(html)) !== null) {
    times.push({ time: m[0], index: m.index });
  }

  const entries: ParsedScheduleEntry[] = [];
  const seen = new Set<string>();

  for (const { time, index } of times) {
    // Chercher les 2 noms avant l'heure. Les noms sont Capitalisés, sans chiffres.
    // On prend une fenêtre de 80 chars avant l'heure et on extrait les mots capitalisés.
    const window = html.slice(Math.max(0, index - 80), index);
    const words = window
      .split(/[\s\n]+/)
      .filter((w) => /^[A-ZÀ-Ý][a-zà-ÿ-]+$/.test(w));

    // Prendre les 2 derniers mots capitalisés (joueurs)
    if (words.length < 2) continue;
    const player1 = words[words.length - 2];
    const player2 = words[words.length - 1];

    // Filtrer les faux positifs (noms trop courts ou connus comme "ATP")
    if (player1.length < 3 || player2.length < 3) continue;
    if (["ATP", "WTA", "ITF", "Jan", "Feb", "Mar", "Apr"].includes(player1)) continue;
    if (["ATP", "WTA", "ITF", "Jan", "Feb", "Mar", "Apr"].includes(player2)) continue;

    const key = `${player1}-${player2}-${time}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tz = tournamentName
      ? guessTimezone(tournamentName)
      : "UTC";

    // Construire l'ISO UTC : combiner dateStr + time dans tz → convertir en UTC
    const [hh, mm] = time.split(":").map(Number);
    const [y, mo, d] = dateStr.split("-").map(Number);
    // Construire la date en supposant que l'heure est dans tz
    const localDate = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
    // Ajustement timezone : soustraire l'offset de tz par rapport à UTC.
    // Simplifié : utiliser Intl.DateTimeFormat pour calculer l'offset.
    const offsetMin = getTimezoneOffsetMinutes(tz, localDate);
    const utcMs = localDate.getTime() - offsetMin * 60_000;

    entries.push({
      player1Name: player1,
      player2Name: player2,
      tournamentName: tournamentName ?? "",
      scheduledAtUTC: new Date(utcMs).toISOString(),
      timezone: tz,
      localTime: time,
      source: "tennistemple",
    });
  }

  return entries;
}

/**
 * Parse la liste des tournois depuis le HTML calendrier TennisTemple.
 */
export function parseTennisTempleTournaments(
  html: string,
  year: number,
): ParsedTournament[] {
  const tournaments: ParsedTournament[] = [];
  const seen = new Set<string>();

  // Pour chaque catégorie connue, chercher les motifs "<NomTournoi> <Catégorie> ..."
  for (const category of CATEGORIES) {
    const catRegex = new RegExp(
      `([A-ZÀ-Ý][\\wÀ-ÿ'\\s-]{2,40})\\s+${escapeRegex(category)}\\s*[•·]?\\s*([^\\n]*?)(?:\\d{1,2}\\s+\\w{3})`,
      "g",
    );
    let m2: RegExpExecArray | null;
    while ((m2 = catRegex.exec(html)) !== null) {
      const name = m2[1].trim();
      const details = m2[2].trim();

      // Extraire ville si présente après "•"
      const cityMatch = details.match(/•\s*([A-Za-zÀ-ÿ''-]+)/);
      const city = cityMatch?.[1];

      // Extraire prize money
      const prizeMatch = details.match(/([\d,]+\s*[€$])/);
      const prizeMoney = prizeMatch?.[1];

      // Extraire dates via DATE_RANGE_REGEX dans une fenêtre autour
      const afterIndex = m2.index ?? 0;
      const afterWindow = html.slice(afterIndex, afterIndex + 200);
      const dateMatch = afterWindow.match(DATE_RANGE_REGEX);
      let startDate = "";
      let endDate = "";
      if (dateMatch) {
        const startDay = parseInt(dateMatch[1], 10);
        const startMonth = MONTH_TO_NUM[dateMatch[2]] ?? 0;
        const endDay = parseInt(dateMatch[3], 10);
        const endMonth = MONTH_TO_NUM[dateMatch[4]] ?? 0;
        startDate = new Date(Date.UTC(year, startMonth, startDay))
          .toISOString()
          .slice(0, 10);
        endDate = new Date(Date.UTC(year, endMonth, endDay))
          .toISOString()
          .slice(0, 10);
      }

      // Defending champion : nom après les dates dans l'afterWindow
      const champMatch = afterWindow.match(
        /(?:\d{1,2}\s+\w{3}\s*[-–]\s*\d{1,2}\s+\w{3})\s*\n?\s*([A-ZÀ-Ý][a-zà-ÿ]+\s+[A-ZÀ-Ý]?)/,
      );
      const defendingChampion = champMatch?.[1]?.trim();

      const key = `${name}-${startDate}`;
      if (seen.has(key)) continue;
      seen.add(key);

      tournaments.push({
        name,
        category,
        city,
        prizeMoney,
        startDate,
        endDate,
        defendingChampion,
      });
    }
  }

  return tournaments;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calcule l'offset en minutes entre une timezone et UTC pour une date donnée.
 * Utilise Intl.DateTimeFormat (standard, pas de dépendance).
 */
function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    const asUTC = Date.UTC(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      parseInt(map.hour === "24" ? "0" : map.hour, 10),
      parseInt(map.minute, 10),
      parseInt(map.second, 10),
    );
    return Math.round((asUTC - date.getTime()) / 60_000);
  } catch {
    return 0;
  }
}
