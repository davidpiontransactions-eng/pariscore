// Stats joueurs HBL (1.HBL + DHB-Pokal) — popup prématch handball.
//
// Source : data/hbl_players.json, produit par scripts/scrape-hbl-players.js
// (API Synergy/Sportradar de daikin-hbl.de → opel-hbl.de, probe 2026-09-24).
// Lecture readonly + cache mémoire module — pattern football-understat-players
// avec DATA_DIR env comme hockey/prematch-data (VPS : /opt/pariscorebis/data).

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { normHandballName } from "./handball-logos";

/** Poste pour la popup : gardien ou joueur de champ. */
export type HblPosition = "GK" | "Field";

export type HblPlayer = {
  name: string;
  /** Nom complet du club (ex. "TVB Stuttgart", "Füchse Berlin"). */
  team: string;
  /** Code 3 lettres source (ex. "TVB", "BER"). */
  teamCode?: string;
  /** Compétition d'origine quand le snapshot est en mode "all". */
  competition?: "hbl" | "dhb-pokal";
  position: HblPosition;
  goals: number;
  assists?: number;
  games: number;
  /** Minutes jouées (arrondi, ISO 8601 converti par le scraper). */
  minutes?: number;
  /** % d'arrêts (GK uniquement). */
  savePct?: number;
  /** Arrêts (GK uniquement). */
  saves?: number;
  /** Buts encaissés (GK uniquement). */
  goalsAgainst?: number;
  /** Buts à 7 m (Field uniquement). */
  sevenMGoals?: number;
  /** Buts / match (Field uniquement). */
  avgGoals?: number;
};

export type HblPlayersSnapshot = {
  scraped_at: string;
  /** "all" | "hbl" | "dhb-pokal" */
  competition: string;
  /** Libellé saison (ex. "2026/27"). */
  season: string;
  source: string;
  total?: number;
  teams?: number;
  players: HblPlayer[];
};

/** Top-N joueurs d'un club : GK triés par % d'arrêts, Field par buts. */
export type HblTeamTopPlayers = {
  /** Nom canonique du club matché (tel que dans le snapshot). */
  team: string;
  gk: HblPlayer[];
  field: HblPlayer[];
};

// Cache mémoire module : undefined = pas encore lu, null = fichier absent.
let _cache: HblPlayersSnapshot | null | undefined;

/** Lit data/hbl_players.json (DATA_DIR env prioritaire, comme sur le VPS). */
export function loadHblPlayers(): HblPlayersSnapshot | null {
  if (_cache !== undefined) return _cache;
  try {
    const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
    const file = join(dataDir, "hbl_players.json");
    if (!existsSync(file)) {
      _cache = null;
      return null;
    }
    const data = JSON.parse(readFileSync(file, "utf8")) as HblPlayersSnapshot;
    _cache = data && Array.isArray(data.players) ? data : null;
  } catch {
    _cache = null;
  }
  return _cache;
}

/** Purge du cache (tests / hot-reload du fichier après un scrape). */
export function clearHblPlayersCache(): void {
  _cache = undefined;
}

/**
 * Le club matche-t-il la requête ? Égalité normalisée d'abord, puis inclusion
 * réciproque (comme teamLogoUrl) : "Stuttgart" ⊂ "tvbstuttgart",
 * "berlin" ⊂ "fuchseberlin". Garde-fou : chaîne la plus courte ≥ 4 caractères
 * pour éviter les faux positifs du type "hc".
 */
function teamsMatch(playerTeam: string, wantedNorm: string): boolean {
  const t = normHandballName(playerTeam);
  if (!t || !wantedNorm) return false;
  if (t === wantedNorm) return true;
  if (Math.min(t.length, wantedNorm.length) < 4) return false;
  return t.includes(wantedNorm) || wantedNorm.includes(t);
}

function byGoals(a: HblPlayer, b: HblPlayer): number {
  if (b.goals !== a.goals) return b.goals - a.goals;
  const ba = b.assists ?? 0;
  const aa = a.assists ?? 0;
  if (ba !== aa) return ba - aa;
  return a.name.localeCompare(b.name);
}

function bySavePct(a: HblPlayer, b: HblPlayer): number {
  const pa = a.savePct ?? -1;
  const pb = b.savePct ?? -1;
  if (pb !== pa) return pb - pa;
  const sa = a.saves ?? 0;
  const sb = b.saves ?? 0;
  if (sb !== sa) return sb - sa;
  return a.name.localeCompare(b.name);
}

/**
 * Meilleurs joueurs d'une équipe pour la popup prématch.
 * Sépare GK et Field, trie les Field par buts (assists puis nom en départage)
 * et les GK par % d'arrêts (arrêts puis nom). `n` s'applique par liste.
 *
 * Snapshot absent ou équipe inconnue → listes vides (l'UI dégrade proprement).
 */
export function topPlayersForTeam(
  snapshot: HblPlayersSnapshot | null | undefined,
  teamName: string,
  n: number = 5
): HblTeamTopPlayers {
  const wanted = normHandballName(teamName);
  const players = snapshot?.players;
  if (!wanted || !players || !players.length || n < 1) {
    return { team: teamName, gk: [], field: [] };
  }

  const matched = players.filter((p) => teamsMatch(p.team, wanted));
  if (!matched.length) return { team: teamName, gk: [], field: [] };

  const field = matched.filter((p) => p.position === "Field").sort(byGoals).slice(0, n);
  const gk = matched.filter((p) => p.position === "GK").sort(bySavePct).slice(0, n);

  return { team: matched[0].team, gk, field };
}
