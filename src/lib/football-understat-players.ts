import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { UnderstatPlayer } from "./football-understat-types";

export type { UnderstatPlayer } from "./football-understat-types";
export { per90 } from "./football-understat-types";

type UnderstatFile = {
  meta: { leagueId: string; season: string; playerCount: number };
  teams: Record<string, unknown[]>;
  players: UnderstatPlayer[];
};

const XG_DIR = join(process.cwd(), "public", "data", "xg");

const cache = new Map<string, UnderstatFile | null>();

function readUnderstat(slug: string): UnderstatFile | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  let data: UnderstatFile | null = null;
  try {
    const file = join(XG_DIR, `${slug}.json`);
    if (existsSync(file)) {
      data = JSON.parse(readFileSync(file, "utf-8")) as UnderstatFile;
      // Générer les URLs photos + mapper team_title → team
      if (data?.players) {
        data.players = data.players.map((p) => ({
          ...p,
          team: p.team_title ?? null,
          photo: p.id ? `https://understat.com/player/${p.id}.jpg` : null,
        }));
      }
    }
  } catch {
    data = null;
  }
  cache.set(slug, data);
  return data;
}

/**
 * Tous les joueurs d'une ligue. Retourne null si le fichier n'existe pas
 * ou ne contient pas de données joueurs.
 */
export function understatPlayers(slug: string): UnderstatPlayer[] | null {
  const file = readUnderstat(slug);
  const players = file?.players;
  if (!players || !players.length) return null;
  return players;
}

/**
 * Joueurs d'une équipe spécifique (recherche par team_title fuzzy).
 */
export function understatTeamPlayers(slug: string, teamName: string): UnderstatPlayer[] | null {
  const all = understatPlayers(slug);
  if (!all) return null;
  const lower = teamName.toLowerCase();
  return all.filter(
    (p) => p.team_title?.toLowerCase().includes(lower) ?? false,
  );
}

/**
 * Top N joueurs pour une métrique donnée.
 */
export function understatTopPlayers(
  slug: string,
  metric: keyof Pick<UnderstatPlayer, "xG" | "xAG" | "npxG" | "shots" | "key_passes" | "assists" | "goals">,
  n: number = 10,
): UnderstatPlayer[] | null {
  const all = understatPlayers(slug);
  if (!all) return null;
  return [...all]
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
    .slice(0, n);
}

/**
 * Métadonnées de la ligue (sans les données lourdes).
 */
export function understatMeta(slug: string): { season: string; playerCount: number } | null {
  const file = readUnderstat(slug);
  if (!file?.meta) return null;
  return { season: file.meta.season, playerCount: file.meta.playerCount };
}
