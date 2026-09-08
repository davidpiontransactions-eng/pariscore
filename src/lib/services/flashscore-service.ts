// Service Flashscore — interface TypeScript pour le scraper Python.
// Appelle scripts/flashscore_scraper.py via child_process, parse la sortie JSON
// et expose des types stricts pour les routes API Next.js.
//
// Usage :
//   import { flashscoreService } from "@/lib/services/flashscore-service";
//   const live = await flashscoreService.getLiveScores({ leagues: ["en", "fr"] });

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

// ─── Types ──────────────────────────────────────────────────────────────────

/** Informations sur la ligue d'un match. */
export type LeagueInfo = {
  country: string;
  name: string;
};

/** Cotes 1X2 d'un match. */
export type MatchOdds = {
  home: number | null;
  draw: number | null;
  away: number | null;
  timestamp: string;
};

/** Mouvement de cote sur un marché donné. */
export type OddsMovement = {
  opening: number;
  current: number;
  /** Pourcentage de variation depuis l'ouverture. */
  change_pct: number;
  /** Vrai si la variation dépasse le seuil (>10%). */
  dropping: boolean;
};

/** Mouvements de cotes pour un match complet. */
export type MatchOddsMovements = {
  home?: OddsMovement;
  draw?: OddsMovement;
  away?: OddsMovement;
};

/** Événement de match (but, carton, remplacement). */
export type MatchEvent = {
  type: "goal" | "red_card" | "yellow_card" | "second_yellow" | "substitution" | "var_review" | "penalty" | "own_goal" | "unknown";
  time: string;
  player: string;
};

/** Match Flashscore normalisé. */
export type FlashscoreMatch = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  /** Statut du match : "Live", "HT", "FT", ou temps en cours. */
  status: string;
  league: LeagueInfo;
  odds?: MatchOdds | null;
  odds_movements?: MatchOddsMovements | null;
  /** Vrai si au moins une cote a bougé de >10% depuis l'ouverture. */
  dropping_odds?: boolean;
  events?: MatchEvent[];
};

/** Réponse complète du service Flashscore. */
export type FlashscoreResponse = {
  scraped_at: string;
  total_matches: number;
  matches: FlashscoreMatch[];
  errors: string[];
};

/** Options de requête pour le service Flashscore. */
export type FlashscoreOptions = {
  /** Filtrer par codes de ligues (ISO 3166-1 alpha-2 minuscule). */
  leagues?: string[];
  /** Inclure le suivi des cotes (défaut: true). */
  includeOdds?: boolean;
  /** Inclure les événements de match (défaut: true). */
  includeEvents?: boolean;
  /** Nombre max de matchs à retourner (défaut: 100). */
  limit?: number;
};

// ─── Service principal ──────────────────────────────────────────────────────

/** Chemin vers le script Python. */
const SCRAPER_PATH = path.join(
  process.cwd(),
  "scripts",
  "flashscore_scraper.py",
);

/** Timeout par défaut (30 secondes). */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Cache en mémoire avec TTL. */
const cache = new Map<string, { data: FlashscoreResponse; expires: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Génère une clé de cache basée sur les options.
 * Deux appels avec les mêmes options retournent le même cache.
 */
function cacheKey(opts: FlashscoreOptions): string {
  return JSON.stringify({
    leagues: (opts.leagues ?? []).sort(),
    odds: opts.includeOdds ?? true,
    events: opts.includeEvents ?? true,
    limit: opts.limit ?? 100,
  });
}

/**
 * Vérifie que le script Python existe.
 * Retourne false si le script est absent ou inaccessible.
 */
async function scraperExists(): Promise<boolean> {
  try {
    const fs = await import("node:fs/promises");
    await fs.access(SCRAPER_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Appelle le script Python Flashscore et retourne les données parsées.
 *
 * Gestion d'erreurs :
 * - Script non trouvé → erreur explicative
 * - Python non disponible → erreur explicative
 * - Timeout → interruption propre
 * - JSON invalide → erreur avec brut stdout
 *
 * @param opts - Options de requête
 * @returns Réponse Flashscore typée
 */
export async function getLiveScores(
  opts: FlashscoreOptions = {},
): Promise<FlashscoreResponse> {
  const key = cacheKey(opts);
  const now = Date.now();

  // Vérifier le cache
  const cached = cache.get(key);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  // Vérifier que le script existe
  if (!(await scraperExists())) {
    return {
      scraped_at: new Date().toISOString(),
      total_matches: 0,
      matches: [],
      errors: [
        `Script Python non trouvé: ${SCRAPER_PATH}`,
        "Installer les dépendances: pip install scrapling",
      ],
    };
  }

  // Construire les arguments Python
  const args: string[] = [SCRAPER_PATH];

  if (opts.leagues && opts.leagues.length > 0) {
    args.push("--leagues", opts.leagues.join(","));
  }
  if (opts.includeOdds === false) {
    args.push("--no-odds");
  }
  if (opts.includeEvents === false) {
    args.push("--no-events");
  }
  if (opts.limit && opts.limit !== 100) {
    args.push("--limit", String(opts.limit));
  }

  try {
    const { stdout, stderr } = await execFileAsync("python", args, {
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10 Mo
      encoding: "utf-8",
    });

    if (stderr) {
      console.error("[flashscore-service]", stderr.trim());
    }

    const parsed: FlashscoreMatch[] = JSON.parse(stdout);
    const response: FlashscoreResponse = {
      scraped_at: new Date().toISOString(),
      total_matches: parsed.length,
      matches: parsed,
      errors: [],
    };

    // Mettre en cache
    cache.set(key, { data: response, expires: now + CACHE_TTL_MS });

    return response;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[flashscore-service] Erreur:", errMsg);

    return {
      scraped_at: new Date().toISOString(),
      total_matches: 0,
      matches: [],
      errors: [`Exécution Python échouée: ${errMsg}`],
    };
  }
}

/**
 * Récupère uniquement les matchs avec dropping odds (>10% de mouvement).
 * Utile pour les alertes et notifications.
 */
export async function getDroppingOdds(
  opts: Omit<FlashscoreOptions, "includeOdds"> = {},
): Promise<FlashscoreMatch[]> {
  const response = await getLiveScores({ ...opts, includeOdds: true });
  return response.matches.filter((m) => m.dropping_odds === true);
}

/**
 * Récupère les scores live pour une ligue spécifique.
 * Raccourci pratique pour getLiveScores({ leagues: [league] }).
 */
export async function getLeagueScores(league: string): Promise<FlashscoreMatch[]> {
  const response = await getLiveScores({ leagues: [league] });
  return response.matches;
}

/**
 * Récupère les événements récents (buts, cartons) pour tous les matchs live.
 * Utile pour un dashboard d'activité en temps réel.
 */
export async function getRecentEvents(): Promise<
  Array<{ match: FlashscoreMatch; event: MatchEvent }>
> {
  const response = await getLiveScores({ includeEvents: true });
  const events: Array<{ match: FlashscoreMatch; event: MatchEvent }> = [];

  for (const match of response.matches) {
    if (match.events && match.events.length > 0) {
      for (const event of match.events) {
        events.push({ match, event });
      }
    }
  }

  return events;
}

/**
 * Invalide le cache manuellement.
 * Utile après un déploiement ou un rafraîchissement forcé.
 */
export function clearCache(): void {
  cache.clear();
}

/** Service exporté comme namespace. */
export const flashscoreService = {
  getLiveScores,
  getDroppingOdds,
  getLeagueScores,
  getRecentEvents,
  clearCache,
} as const;
