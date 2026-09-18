/**
 * CLV (Closing Line Value) — Métrique de validation du modèle.
 *
 * CLV = (Cote obtenue / Cote de clôture) − 1
 *   - CLV positif consistant = le modèle bat le marché → edge réel
 *   - CLV négatif = le modèle sous-performe le marché
 *
 * Ce module stocke les prédictions et les cotes de clôture pour
 * calculer le CLV par match et agrégé par compétition.
 *
 * Stockage : data/rugby-clv.json (local, pas de DB).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const CLV_FILE = join(DATA_DIR, "rugby-clv.json");

export interface ClvEntry {
  matchId: string;
  slug: string;
  date: string;
  /** Probabilité modèle (0-1). */
  modelProb: number;
  /** Cote au moment de la prédiction. */
  openingOdds: number;
  /** Cote de clôture (closing line). */
  closingOdds: number | null;
  /** CLV calculé : (openingOdds / closingOdds) − 1. null si pas de closing. */
  clv: number | null;
  /** Résultat réel : true = le pari aurait gagné. */
  outcome: boolean | null;
  /** Date de settlement. */
  settledAt: string | null;
}

export interface ClvStats {
  total: number;
  settled: number;
  avgClv: number | null;
  positiveClvRate: number | null;
  /** Taux de couverture du modèle (si outcome renseigné). */
  modelHitRate: number | null;
  /** ROI si on avait parié à chaque fois (flat 1u). */
  flatRoi: number | null;
}

function loadEntries(): ClvEntry[] {
  if (!existsSync(CLV_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CLV_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveEntries(entries: ClvEntry[]): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(CLV_FILE, JSON.stringify(entries, null, 2));
}

/**
 * Enregistre ou met à jour une entrée CLV.
 */
export function recordClv(entry: Omit<ClvEntry, "clv" | "outcome" | "settledAt">): void {
  const entries = loadEntries();
  const existing = entries.findIndex((e) => e.matchId === entry.matchId);

  const clv =
    entry.closingOdds != null && entry.closingOdds > 0
      ? Math.round(((entry.openingOdds / entry.closingOdds) - 1) * 10000) / 10000
      : null;

  const record: ClvEntry = {
    ...entry,
    clv,
    outcome: null,
    settledAt: null,
  };

  if (existing >= 0) {
    entries[existing] = { ...entries[existing], ...record };
  } else {
    entries.push(record);
  }

  saveEntries(entries);
}

/**
 * Settle une entrée CLV avec le résultat réel.
 */
export function settleClv(matchId: string, outcome: boolean): void {
  const entries = loadEntries();
  const entry = entries.find((e) => e.matchId === matchId);
  if (entry) {
    entry.outcome = outcome;
    entry.settledAt = new Date().toISOString();
    saveEntries(entries);
  }
}

/**
 * Met à jour la cote de clôture d'un match.
 */
export function updateClosingOdds(matchId: string, closingOdds: number): void {
  const entries = loadEntries();
  const entry = entries.find((e) => e.matchId === matchId);
  if (entry) {
    entry.closingOdds = closingOdds;
    entry.clv =
      closingOdds > 0
        ? Math.round(((entry.openingOdds / closingOdds) - 1) * 10000) / 10000
        : null;
    saveEntries(entries);
  }
}

/**
 * Calcule les stats CLV agrégées.
 */
export function getClvStats(slug?: string): ClvStats {
  const entries = loadEntries();
  const filtered = slug ? entries.filter((e) => e.slug === slug) : entries;

  if (filtered.length === 0) {
    return { total: 0, settled: 0, avgClv: null, positiveClvRate: null, modelHitRate: null, flatRoi: null };
  }

  const withClv = filtered.filter((e) => e.clv != null);
  const settled = filtered.filter((e) => e.outcome != null);

  const avgClv =
    withClv.length > 0
      ? Math.round((withClv.reduce((sum, e) => sum + (e.clv || 0), 0) / withClv.length) * 10000) / 10000
      : null;

  const positiveClvRate =
    withClv.length > 0
      ? Math.round((withClv.filter((e) => (e.clv || 0) > 0).length / withClv.length) * 100) / 100
      : null;

  const modelHitRate =
    settled.length > 0
      ? Math.round((settled.filter((e) => e.outcome === true).length / settled.length) * 100) / 100
      : null;

  // Flat ROI: gain net / nombre de paris
  let flatRoi: number | null = null;
  if (settled.length > 0) {
    let netGain = 0;
    for (const e of settled) {
      if (e.outcome === true) {
        netGain += e.openingOdds - 1; // gain net = cote - 1
      } else {
        netGain -= 1; // perte = 1 unité
      }
    }
    flatRoi = Math.round((netGain / settled.length) * 100) / 100;
  }

  return {
    total: filtered.length,
    settled: settled.length,
    avgClv,
    positiveClvRate,
    modelHitRate,
    flatRoi,
  };
}

/**
 * Retourne toutes les entrées (pour debug/affichage).
 */
export function getAllEntries(slug?: string): ClvEntry[] {
  const entries = loadEntries();
  return slug ? entries.filter((e) => e.slug === slug) : entries;
}
