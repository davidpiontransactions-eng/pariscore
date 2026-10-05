/**
 * src/lib/hockey/khl-schedule.ts
 *
 * Lecture du calendrier KHL officiel produit par `scripts/scrape-khl-schedule.mjs`
 * (HockeyTech `view=schedule`, 748 matchs pour la saison 2026-2027).
 *
 * Pourquoi ce fichier existe : c'est la SEULE source fixtures KHL exploitable
 * aujourd'hui. Mesuré le 2026-10-05 —
 *   - `view=scorebar` : 0/6, le proxy tronque le flux (~137 767 o, point de
 *     coupure variable, durée ~41 s → timeout upstream) ;
 *   - `view=schedule` : 748 matchs, 748/748 datés et scorés, 573 ms à 18,8 s ;
 *   - Annabet : coupe le TCP depuis le VPS (IP datacenter) ;
 *   - BetExplorer : dépend d'un Chromium qui ne démarre pas en local.
 *
 * La fenêtre J-7/J+10 est appliquée À LA LECTURE, pas au scrape : le fichier
 * porte la saison entière, donc un cron quotidien suffit et l'historique
 * reste disponible sans re-scraper.
 */

import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

export type KhlMatch = {
  id: string;
  seasonId: string;
  date: string | null;
  scheduledAt: string | null;
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  homeId: string | null;
  awayId: string | null;
  homeCity: string | null;
  awayCity: string | null;
  venue: string | null;
  status: string | null;
  isFinished: boolean;
  /** Toujours `false` : une source fixtures ne prouve pas qu'un match est en cours. */
  isLive: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  overtime: boolean;
  shootout: boolean;
  useShootouts: boolean;
  /** Vrai si les deux clubs sont résolus contre le classement réel. */
  predictionsAvailable: boolean;
  predictionsUnavailableReason: string | null;
};

export type KhlSchedule = {
  updatedAt: string;
  source: string;
  league: { id: string; name: string; country: string };
  season: { id: string; name: string };
  counts: {
    matches: number;
    finished: number;
    upcoming: number;
    overtime: number;
    shootout: number;
    predictionsAvailable: number;
    predictionsUnavailable: number;
  };
  window: { firstUpcoming: string; lastUpcoming: string; upcomingDays: number } | null;
  matches: KhlMatch[];
};

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");

/** `null` si le fichier est absent ou illisible — jamais un tableau vide fabriqué. */
export function loadKhlSchedule(): KhlSchedule | null {
  return loadOfficialHockeySchedule("khl");
}

/**
 * Cache mémoire par fichier, invalidé sur le `mtimeMs`.
 *
 * Mesuré le 2026-10-05 : `khl_schedule.json` fait 511 Ko et `nhl_schedule.json`
 * 518 Ko. Les relire et les reparser à CHAQUE requête coûtait ~8 ms de
 * `readFileSync` + `JSON.parse` chacun, sur le thread de l'event loop — donc
 * du temps où la route ne répond à personne d'autre. Deux appels par requête
 * (KHL + NHL), à chaque clic sur l'onglet.
 *
 * `mtimeMs` plutôt qu'un TTL fixe : le cron réécrit ces fichiers une fois par
 * jour, et le invalidation doit être immédiate après un scrape, pas jusqu'à
 * l'expiration d'un cache. Le `statSync` coûte ~0,02 ms.
 */
type CacheEntree = { mtimeMs: number; data: KhlSchedule | null };
const cacheMemo = new Map<string, CacheEntree>();

function lireScheduleCache(path: string): KhlSchedule | null {
  let mtimeMs = 0;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    cacheMemo.delete(path);
    return null;
  }

  const entree = cacheMemo.get(path);
  if (entree && entree.mtimeMs === mtimeMs) return entree.data;

  let data: KhlSchedule | null = null;
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as KhlSchedule;
    data = json && Array.isArray(json.matches) && json.matches.length > 0 ? json : null;
  } catch {
    data = null;
  }
  cacheMemo.set(path, { mtimeMs, data });
  return data;
}

/**
 * Lecteur GÉNÉRIQUE des calendriers officiels hockey.
 *
 * `khl_schedule.json` (HockeyTech, 748 matchs) et `nhl_schedule.json` (ESPN,
 * 1344 matchs) partagent le MÊME schéma — c'est délibéré : deux lecteurs
 * quasi identiques divergeraient, et la fenêtre comme les garde-fous
 * resteraient à dupliquer. Un nouveau calendrier (Magnus, LEB…) n'a qu'à
 * respecter le schéma.
 */
export function loadOfficialHockeySchedule(league: "khl" | "nhl"): KhlSchedule | null {
  return lireScheduleCache(join(DATA_DIR, `${league}_schedule.json`));
}

/** Vide le cache mémoire (tests, et après un scrape dans le même process). */
export function clearHockeyScheduleCache(): void {
  cacheMemo.clear();
}

export type KhlWindow = {
  /** ISO date. */
  debut: string;
  fin: string;
  /** Nombre de matchs dans la fenêtre. */
  matches: number;
  upcoming: number;
  finished: number;
  predictionsAvailable: number;
};

/**
 * Découpe la saison en passé récent / à venir.
 *
 * Les bornes sont DÉRIVÉES du contenu (et non fixées en dur) pour qu'un
 * décalage de calendrier KHL ne vide pas silencieusement l'onglet. `avant` est
 * borné par `now` : un match « à venir » ne doit jamais apparaître dans le
 * passé, quoi que dise la date du fichier.
 */
export function khlCalendarWindow(
  data: KhlSchedule,
  options: { joursAvant?: number; joursApres?: number; maintenant?: Date } = {},
): { fenetre: KhlWindow | null; matchs: KhlMatch[] } {
  const joursAvant = options.joursAvant ?? 7;
  const joursApres = options.joursApres ?? 10;
  const maintenant = options.maintenant ?? new Date();

  const debut = decale(isoDay(maintenant), -joursAvant);
  const fin = decale(isoDay(maintenant), joursApres);

  const matchs = data.matches.filter((m) => {
    if (!m.date) return false;
    return m.date >= debut && m.date <= fin;
  });

  if (!matchs.length) return { fenetre: null, matchs: [] };

  const aVenir = matchs.filter((m) => !m.isFinished);
  return {
    fenetre: {
      debut,
      fin,
      matches: matchs.length,
      upcoming: aVenir.length,
      finished: matchs.length - aVenir.length,
      predictionsAvailable: matchs.filter((m) => m.predictionsAvailable).length,
    },
    matchs,
  };
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function decale(isoDate: string, jours: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}
