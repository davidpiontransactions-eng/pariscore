/**
 * Mapping Flashscore handball → HandballMatch (source partagée routes).
 * Bug fixé (debug 2026-09-23) : home.id = away.id = 0 effondrait le form-store
 * dans un unique bucket "0" → toutes les stratégies form-based identiques.
 * Ids d'équipe = hash déterministe du nom (join finished ↔ upcoming).
 */

import { existsSync } from "fs";
import { join } from "path";
import type { HandballMatch, HandballOpeningOdds } from "./handball-data";

/**
 * Résout data/<name> quel que soit le cwd.
 * Prod standalone : cwd = <repo>/.next/standalone → remonte de 2 niveaux.
 * Dev : cwd = racine repo → candidat direct.
 */
export function resolveHandballDataFile(name: string): string | null {
  const candidates = [
    join(process.cwd(), "data", name),
    join(process.cwd(), "..", "data", name),
    join(process.cwd(), "..", "..", "data", name),
    join(process.cwd(), "..", "..", "..", "data", name),
  ];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // chemin illisible → candidat suivant
    }
  }
  return null;
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
    league: { id: 0, name: m.league || "Handball", country: m.country || "", countryCode: "" },
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
