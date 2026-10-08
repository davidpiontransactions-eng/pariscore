/**
 * Mapping Flashscore handball → HandballMatch (source partagée routes).
 * Bug fixé (debug 2026-09-23) : home.id = away.id = 0 effondrait le form-store
 * dans un unique bucket "0" → toutes les stratégies form-based identiques.
 * Ids d'équipe = hash déterministe du nom (join finished ↔ upcoming).
 */

import { resolveDataFile } from "./data-dir";
import type { HandballMatch, HandballOpeningOdds } from "./handball-data";

/**
 * Résout data/<name> quel que soit le cwd ET quel que soit le dossier de
 * données vivant (voir `data-dir.ts` : la prod a deux racines, `DATA_DIR` +
 * le dépôt).
 *
 * ⚠️ Ne PAS réintroduire une marche à `cwd` ± N niveaux ici : le premier
 * candidat (`cwd/data`) est la COPIE figée par `next build`, servie parce que
 * le serveur standalone fait `process.chdir(__dirname)`. C'est exactement ce
 * qui faisait que l'API handball servait un snapshot de 2 h de retard pendant
 * que le cron écrivait un fichier frais (constaté le 2026-10-08).
 */
export function resolveHandballDataFile(name: string): string | null {
  return resolveDataFile(name);
}

export type FlashscoreMatch = {
  id?: string;
  time?: string;
  home: string;
  away: string;
  score?: string | null;
  isLive?: boolean;
  isFinished?: boolean;
  league?: string;
  country?: string;
  odds?: number[];
  homeHalf?: number;
  awayHalf?: number;
  minute?: number;
  /**
   * Cotes d'ouverture étendues (totaux/handicap/BTTS) quand le scrape
   * les capture. Snapshot actuel = 1X2 seul via `odds` ; ces champs
   * restent absents jusqu'à extension du scraper.
   */
  openingOver55?: number;
  openingUnder62?: number;
  openingHandicap?: number;
  openingBtts30?: number;
};

/** Hash djb2 → entier positif stable (jamais 0 : clé de map vide interdite). */
function hashId(input: string): number {
  let h = 5381;
  const s = input.toLowerCase().trim();
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Id stable d'une équipe (indépendant de l'index de tableau). */
export function teamHashId(name: string): number {
  return hashId(`team:${name}`);
}

/** Âge du snapshot Flashscore en ms. null si absente/invalide. */
export function flashscoreAgeMs(
  scrapedAt: string | undefined | null,
  now: number = Date.now(),
): number | null {
  if (!scrapedAt) return null;
  const ts = Date.parse(scrapedAt);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, now - ts);
}

/** Seuil de fraîcheur : au-delà, le snapshot est déclaré stale (fix audit I13). */
export const FLASHSCORE_MAX_AGE_MS = 20 * 3_600_000; // 20h

/**
 * Snapshot Flashscore frais ? scraped_at absent/vieux → false.
 * Les routes exposent alors `stale: true` (ou basculent sur le fallback).
 */
export function isFlashscoreFresh(
  scrapedAt: string | undefined | null,
  now: number = Date.now(),
): boolean {
  const age = flashscoreAgeMs(scrapedAt, now);
  return age != null && age <= FLASHSCORE_MAX_AGE_MS;
}

/**
 * Cycle de vie RÉEL d'un match (bead 4pvy) — les flags du feed Flashscore
 * mentent : un match fini peut rester `isLive: true` (statut périmé dans le
 * feed J-x, snapshot non rafraîchi). Règle : le COUP DE SIFFLET FINAL prime.
 *   - `isFinished` → terminé ;
 *   - coup d'envoi dépassé de +3 h (régulation + MT + prolongation + marge) → terminé ;
 *   - flag live ET coup d'envoi ≥ maintenant − 15 min → live ;
 *   - sinon → à venir.
 */
export type HandballLifecycle = "finished" | "live" | "upcoming";

export const HANDBALL_MAX_DURATION_MS = 3 * 3_600_000;

export function resolveHandballLifecycle(
  m: { time?: string | null; isLive?: boolean; isFinished?: boolean },
  now: number = Date.now(),
): HandballLifecycle {
  if (m.isFinished) return "finished";
  const t = m.time ? Date.parse(m.time) : NaN;
  if (Number.isFinite(t)) {
    if (now > t + HANDBALL_MAX_DURATION_MS) return "finished";
    if (m.isLive && now >= t - 15 * 60_000) return "live";
    return "upcoming";
  }
  // Pas d'heure exploitable : seul le flag parle (jamais de faux « finished »).
  return m.isLive ? "live" : "upcoming";
}

export function toHandballMatch(m: FlashscoreMatch, _idx: number): HandballMatch {
  let score: { home: number; away: number; homeHalf?: number; awayHalf?: number } | undefined;
  if (m.score && m.score !== "- - -") {
    const parts = m.score.split(/\s*-\s*/);
    if (parts.length >= 2) {
      const home = parseInt(parts[0], 10) || 0;
      const away = parseInt(parts[1], 10) || 0;
      if (home > 0 || away > 0) {
        score = { home, away };
        if (m.homeHalf != null) score.homeHalf = m.homeHalf;
        if (m.awayHalf != null) score.awayHalf = m.awayHalf;
      }
    }
  }

  let status: "live" | "finished" | "not_started" = "not_started";
  if (m.isLive) status = "live";
  else if (m.isFinished) status = "finished";
  // Fix 4pvy : le temps écoulé prime sur le flag live périmé — un match dont
  // le coup de sifflet final est passé (+3 h) sort DU LIVE partout (onglet
  // live, compteur Résultats, prematch) et devient « finished ».
  if (resolveHandballLifecycle(m) === "finished") status = "finished";

  let odds: { home?: number; draw?: number; away?: number } | undefined;
  if (m.odds && m.odds.length >= 2) {
    odds = { home: m.odds[0], away: m.odds[m.odds.length >= 3 ? 2 : 1] };
    if (m.odds.length >= 3) odds.draw = m.odds[1];
  }

  // Cotes d'ouverture 1xbet = proxy CLV (snapshot capturé pré-match).
  // fav1x2 depuis odds[] ; autres marchés en passthrough si présents.
  let openingOdds: HandballOpeningOdds | undefined;
  const hasFav = odds?.home != null || odds?.away != null;
  const hasMarkets =
    m.openingOver55 != null ||
    m.openingUnder62 != null ||
    m.openingHandicap != null ||
    m.openingBtts30 != null;
  if (hasFav || hasMarkets) {
    openingOdds = {};
    if (hasFav) openingOdds.fav1x2 = { ...odds };
    if (m.openingOver55 != null) openingOdds.over55 = m.openingOver55;
    if (m.openingUnder62 != null) openingOdds.under62 = m.openingUnder62;
    if (m.openingHandicap != null) openingOdds.handicap = m.openingHandicap;
    if (m.openingBtts30 != null) openingOdds.btts30 = m.openingBtts30;
  }

  // matchId = hash équipes + ligue + heure → stable entre re-scrapes (pas l'index)
  const matchId = hashId(`${m.league ?? ""}|${m.home}|${m.away}|${m.time ?? ""}`);

  return {
    id: matchId,
    // Fix review G6-4 : id=0 effondrait TOUTES les ligues d'un pays en un
    // nœud `handball:0` du sports-tree → hash du nom (2 ligues ≠ 2 ids).
    league: {
      id: teamHashId(m.league || "Handball"),
      name: m.league || "Handball",
      country: m.country || "",
      countryCode: "",
    },
    home: { id: teamHashId(m.home), name: m.home || "" },
    away: { id: teamHashId(m.away), name: m.away || "" },
    kickoff: m.time || new Date().toISOString(),
    status,
    score,
    minute: m.minute,
    odds,
    openingOdds,
  };
}

/**
 * Match testable CLV = terminé + au moins un marché d'ouverture présent.
 * Le backtest CLV croît avec les données (scrape PM2 quotidien).
 */
export function isCLVTestable(m: HandballMatch): boolean {
  if (m.status !== "finished" || !m.score) return false;
  const o = m.openingOdds;
  if (!o) return false;
  return (
    o.over55 != null ||
    o.under62 != null ||
    o.handicap != null ||
    o.btts30 != null ||
    o.fav1x2?.home != null ||
    o.fav1x2?.away != null
  );
}
