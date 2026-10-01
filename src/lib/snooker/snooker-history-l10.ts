/**
 * snooker-history-l10.ts — chargement des matchs bruts pour le PowerScore L5/L10.
 *
 * Séparé de `snooker-history-db.ts` (backtest) car les besoins diffèrent :
 * ici on veut la colonne `scores` parsée et un slug de joueur normalisé, pas
 * une ligne aplatie par match.
 *
 * RÈGLE DE LECTURE, alignée sur `loadSnookerBacktestRows` :
 *   - walkover exclu (`LOWER(walkover) NOT IN ('1','true')`) ;
 *   - une frame « 65-65 » est une frame reprise : le score de base la compte
 *     une fois, le parseur l'écarte, donc les deux peuvent diverger — c'est
 *     voulu, on ne veut pas compter une reprise deux fois ;
 *   - égalités et 0-0 exclus (aucun vainqueur) ;
 *   - date : `COALESCE(NULLIF(m.date,''), t.start_date)` — ~65 000 lignes
 *     historiques n'ont pas de date de match mais ont une date de tournoi.
 *
 * PERFORMANCE — `LOWER()` sur la colonne d'index casse l'index. Le tri se fait
 * donc en mémoire, une seule fois, sur le jeu complet filtré. Les deux index
 * `idx_matches_player_X_url` servent au filtrage amont par joueur quand
 * `players` est fourni.
 *
 * ⚠️ LA BASE STOCKE LE VAINQUEUR EN SLOT 1 (96,7 % des lignes). C'est le piège
 * n°1 de cette source : voir `resolveWinnerSlug` plus bas et
 * `docs/snooker/PLAFFOND-PREDICTIF.md`.
 */

import { existsSync } from "fs";
import { join } from "path";
import { parseFrameScores, type FrameScore } from "./parse-frame-scores";
import type { SnookerMatchRow } from "./elo-walkforward";

/**
 * Slug joueur depuis une URL CueTracker.
 *
 * CASSE : `players.url` utilise `/Players/x` (majuscule) alors que
 * `matches.player_1_url` utilise `/players/x` (minuscule) — vérifié sur les
 * 30 748 lignes de la table. Sans `toLowerCase()` avant comparaison, chaque
 * joueur existe en deux îlots et son échantillon est coupé en deux.
 * Mesuré : 73 195 / 73 202 correspondances (100.0 %), les 7 manques étant des
 * suffixes de désambiguïsation (`-ii`).
 */
export function snookerSlug(url: string | null | undefined): string {
  if (!url) return "";
  const tail = url.split("/").pop() ?? "";
  return tail.toLowerCase();
}

type Driver = {
  query: (sql: string, ...params: unknown[]) => Record<string, unknown>[];
  close: () => void;
};

function openDb(): Driver | null {
  const path = process.env.SNOOKER_HISTORY_DB || join(process.env.DATA_DIR || join(process.cwd(), "data"), "snooker_history.db");
  if (!existsSync(path)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as { Database: new (p: string, o: unknown) => Driver };
    return new Database(path, { readonly: true, create: false });
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BetterSqlite3 = require("better-sqlite3") as new (p: string, o: unknown) => Driver;
      return new BetterSqlite3(path, { readonly: true, fileMustExist: true });
    } catch {
      return null;
    }
  }
}

const SQL = `
  SELECT m.match_id, m.date, m.stage, m.best_of, m.scores,
         m.player_1_score, m.player_2_score,
         m.player_1, m.player_1_url, m.player_2, m.player_2_url,
         m.winner, m.winner_url,
         t.start_date, t.name AS tournament
  FROM matches m JOIN tournament t ON m.tourn_id = t.tourn_id
  WHERE COALESCE(NULLIF(m.date,''), t.start_date) IS NOT NULL
    AND LOWER(m.walkover) NOT IN ('1','true')
    AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER)
    AND CAST(m.player_1_score AS INTEGER) > 0
    AND m.winner_url IS NOT NULL AND m.winner_url <> ''
`;

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** `best_of` absent ou 0 → 9 (convention du lecteur de backtest). */
const bestOfOf = (v: unknown): number => {
  const n = num(v, 9);
  return n > 0 ? n : 9;
};

/**
 * Slug du vainqueur, déduit de `winner_url` en priorité.
 *
 * `winner_url` est fiable : sur 18 189 matchs 2020+, il désigne l'un des deux
 * joueurs dans 100 % des cas. Le repli par NOM existe seulement pour les lignes
 * sans `winner_url` — et il est nettement moins sûr (« R. O'Sullivan » vs
 * « Ronnie O'Sullivan »), donc il ne retient que la correspondance exacte après
 * normalisation.
 */
function resolveWinnerSlug(r: Record<string, unknown>): string {
  const fromUrl = snookerSlug((r.winner_url as string) || null);
  if (fromUrl) return fromUrl;

  const target = normName(r.winner);
  if (!target) return "";
  const s1 = normName(r.player_1);
  const s2 = normName(r.player_2);
  if (target && target === s1) return snookerSlug((r.player_1_url as string) || null) || "";
  if (target && target === s2) return snookerSlug((r.player_2_url as string) || null) || "";
  return "";
}

/** Normalisation de nom : minuscules, sans apostrophe/point/accents. */
function normName(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .toLowerCase()
    .replace(/['\u2019.]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Frames gagnés par le SLOT 1 d'après le parsing de `scores`, ou `null` si
 * indécidable (égalité ou liste vide).
 */
function framesWonInSlots(frames: FrameScore[]): number | null {
  if (frames.length === 0) return null;
  let a = 0;
  let b = 0;
  for (const f of frames) {
    if (f.a > f.b) a++;
    else if (f.b > f.a) b++;
  }
  return a === b ? null : a;
}

/**
 * Charge tous les matchs exploitables, convertis en lignes `SnookerMatchRow`.
 *
 * `players` : sous-ensemble de slugs à conserver (tout le monde si absent).
 *
 * `since` NE FILTRE QUE LA FENÊTRE D'AFFICHAGE, PAS L'HISTORIQUE ÉLO.
 * Raison : l'Élo est un rating ITÉRATIF. Tronquer le corpus en 2015 fait
 * repartir chaque joueur de 1500 en 2015, donc le MÊME joueur a un PowerScore
 * différent selon le paramètre `?since=` de l'URL, sans aucun avertissement.
 * On charge donc tout l'historique pour l'Élo, et la borne `since` n'est
 * appliquée qu'au moment de choisir les N derniers matchs.
 *
 * Le tri se fait en mémoire (une seule fois) : `LOWER()` sur la colonne
 * d'index casserait l'index.
 *
 * Renvoie `[]` si la base est absente ou illisible — jamais d'exception, comme
 * le reste des lecteurs snooker.
 */
export function loadSnookerL10Rows(players?: Set<string>): SnookerMatchRow[] {
  const db = openDb();
  if (!db) return [];

  try {
    const raw = db.query(SQL);
    const out: SnookerMatchRow[] = [];

    for (const r of raw) {
      const slot1 = snookerSlug((r.player_1_url as string) || null);
      const slot2 = snookerSlug((r.player_2_url as string) || null);
      if (!slot1 || !slot2 || slot1 === slot2) continue;

      // ⚠️ LA BASE STOCKE LE VAINQUEUR EN PREMIER. Mesuré sur 2015+ : le
      // vainqueur est le slot 1 dans 96,72 % des lignes (et 121 343 / 121 345
      // sur l'historique complet). Donc `player_1_score > player_2_score` est
      // vrai presque TOUJOURS : prendre ce champ comme indicateur du vainqueur
      // donne une étiquette constante et un modèle « 98 % de bonnes
      // prédictions » sans la moindre information.
      //
      // La paire d'URL, elle, est fiable : `winner_url` désigne l'un des deux,
      // jamais un tiers (18 189 / 18 189 sur 2020+). On reconstruit donc le
      // couple (vainqueur, perdant) depuis `winner_url`, et les frames depuis le
      // côté correspondant.
      const winner = resolveWinnerSlug(r);
      if (!winner || (winner !== slot1 && winner !== slot2)) continue;
      const winnerIsSlot1 = winner === slot1;

      const date = String(r.date || r.start_date || "");
      const bestOf = bestOfOf(r.best_of);
      const parsed = parseFrameScores(r.scores as string | null, { bestOf });

      // Frames PAR SLOT (colonnes de la base), pas par vainqueur : le contrat
      // veut `scoreA` = frames du slot A. Le module aval résout qui a gagné via
      // `winner`. On garde donc l'ordre d'origine.
      let framesSlot1: number;
      let framesSlot2: number;
      const sideAFrames = framesWonInSlots(parsed.frames as FrameScore[]);
      if (sideAFrames !== null && parsed.frames.length > 1) {
        const sideBFrames = parsed.frames.length - sideAFrames;
        framesSlot1 = sideAFrames;
        framesSlot2 = sideBFrames;
      } else {
        framesSlot1 = num(r.player_1_score);
        framesSlot2 = num(r.player_2_score);
      }
      // Garde-fou : le vainqueur (connu par identité) doit avoir gagné PLUS de
      // frames que l'autre. Les lignes qui contredisent cette règle (3,35 %
      // mesurés) sont des saisies incohérentes : on les écarte plutôt que de
      // deviner quel des deux chiffres est faux.
      const framesWinner = winnerIsSlot1 ? framesSlot1 : framesSlot2;
      const framesLoser = winnerIsSlot1 ? framesSlot2 : framesSlot1;
      if (framesWinner <= framesLoser) continue;

      // Contrat aval : `playerA` / `playerB` restent les deux participants dans
      // l'ordre de la base, et c'est `winner` qui dit qui a gagné. Les modules
      // aval (`buildEloHistory`, `recordFor`) ne supposent PLUS que A == vainqueur.
      const playerA = slot1;
      const playerB = slot2;
      if (players && (!players.has(playerA) || !players.has(playerB))) continue;

      out.push({
        matchId: String(r.match_id ?? ""),
        date,
        bestOf,
        scoreA: framesSlot1,
        scoreB: framesSlot2,
        playerA,
        playerB,
        winner,
        frames: parsed.frames as FrameScore[],
        stage: (r.stage as string) ?? null,
        tournament: (r.tournament as string) ?? null,
      });
    }

    return out;
  } catch (err) {
    console.warn("[snooker-l10] lecture snooker_history.db échouée:", err instanceof Error ? err.message : err);
    return [];
  } finally {
    try {
      db.close();
    } catch {
      /* fermeture best-effort */
    }
  }
}

/** Slugs présents dans la base historique (utile pour lier aux ids CueTracker). */
export function loadSnookerHistorySlugs(): Set<string> {
  const db = openDb();
  if (!db) return new Set();
  try {
    const rows = db.query("SELECT url FROM players");
    const set = new Set<string>();
    for (const r of rows) {
      const s = snookerSlug(r.url as string);
      if (s) set.add(s);
    }
    return set;
  } catch {
    return new Set();
  } finally {
    try {
      db.close();
    } catch {
      /* fermeture best-effort */
    }
  }
}