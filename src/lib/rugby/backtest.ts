/**
 * Backtest du marché handicap (spread) Rugby4Cast.
 *
 * Au moment où une prédiction est générée pour un match à venir, on enregistre
 * la ligne du spread et les probabilités (snapshot) ; quand le match est
 * terminé, on note le résultat réel et on mesure la couverture :
 *   home couvre si marge réelle > ligne ; away couvre si marge réelle < ligne.
 *
 * L'évaluation se fait donc avec LA ligne du moment (jamais recalculée avec les
 * ratings actuels) — c'est la seule façon honnête de mesurer la valeur du spread.
 *
 * Persistance : data/rugby-backtest.json (best-effort, jamais bloquant pour le
 * pipeline de sync). Écriture atomique (tmp + rename) et sérialisée par un
 * mutex pour éviter les pertes entre syncs concurrentes.
 */

import fs from "fs";
import path from "path";
import type {
  BacktestBand,
  BacktestEntry,
  BacktestStats,
  RugbyMatch,
  RugbyPrediction,
} from "./types";

const STORE_FILE = path.join(process.cwd(), "data", "rugby-backtest.json");
const MAX_ENTRIES = 3000;

/* ------------------------------------------------------------------ */
/* Mutex : les syncs concurrentes (pool) ne doivent jamais s'écraser.  */
/* ------------------------------------------------------------------ */

let lock: Promise<void> = Promise.resolve();

function queue<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/* ------------------------------------------------------------------ */
/* Lecture / écriture du store                                         */
/* ------------------------------------------------------------------ */

interface Store {
  entries: BacktestEntry[];
}

interface Cache {
  entries: BacktestEntry[];
  mtime: number;
}

let cache: Cache | null = null;

function readStoreSync(): Store {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const stat = fs.statSync(STORE_FILE);
      if (cache && stat.mtimeMs === cache.mtime) {
        return { entries: cache.entries };
      }
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      const entries = Array.isArray(raw?.entries) ? raw.entries : [];
      cache = { entries, mtime: stat.mtimeMs };
      return { entries };
    }
  } catch {
    // Fichier corrompu ou illisible → on repart d'un store vide (best-effort).
  }
  return { entries: [] };
}

async function writeStore(entries: BacktestEntry[]): Promise<void> {
  try {
    const dir = path.dirname(STORE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2), "utf8");
    fs.renameSync(tmp, STORE_FILE);
    try {
      const stat = fs.statSync(STORE_FILE);
      cache = { entries, mtime: stat.mtimeMs };
    } catch {
      cache = null;
    }
  } catch (err) {
    console.warn("[rugby/backtest] écriture du store échouée (best-effort):", (err as Error).message);
  }
}

/** Enregistre les prédictions ouvertes et règle les matchs terminés. */
async function settleAndRecord(
  slug: string,
  matches: RugbyMatch[],
  predictions: Map<string, RugbyPrediction>
): Promise<void> {
  const store = readStoreSync();
  const byId = new Map<string, BacktestEntry>();
  for (const e of store.entries) byId.set(e.matchId, e);

  let changed = false;
  const nowCutoff = Date.now() - 2 * 3600000;

  // 1. Snapshot des prédictions ouvertes (match à venir + prédiction).
  for (const m of matches) {
    if (m.status !== "scheduled" || new Date(m.date).getTime() < nowCutoff) continue;
    const pred = predictions.get(m.id);
    if (!pred) continue;
    if (byId.has(m.id)) continue;
    byId.set(m.id, {
      matchId: m.id,
      slug,
      date: m.date,
      handicapLine: pred.handicap.line,
      expectedHomeScore: pred.expectedHomeScore,
      expectedAwayScore: pred.expectedAwayScore,
      homeWinProb: pred.homeWinProb,
      awayWinProb: pred.awayWinProb,
      actualHomeScore: null,
      actualAwayScore: null,
      settledAt: null,
    });
    changed = true;
  }

  // 2. Settlement des matchs terminés.
  for (const m of matches) {
    if (m.status !== "finished" || m.homeScore === null || m.awayScore === null) continue;
    const e = byId.get(m.id);
    if (!e || e.settledAt !== null) continue;
    e.actualHomeScore = m.homeScore;
    e.actualAwayScore = m.awayScore;
    e.settledAt = new Date().toISOString();
    changed = true;
  }

  if (!changed) return;

  const entries = [...byId.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-MAX_ENTRIES);
  await writeStore(entries);
}

/** Statistiques de couverture du spread (toutes comps si slug === null). */
export function getBacktestStats(slug: string | null): BacktestStats {
  const store = readStoreSync();
  const entries = slug ? store.entries.filter((e) => e.slug === slug) : store.entries;

  const bands: { label: string; test: (p: number) => boolean }[] = [
    { label: "< 40 %", test: (p) => p < 0.4 },
    { label: "40-60 %", test: (p) => p >= 0.4 && p < 0.6 },
    { label: "≥ 60 %", test: (p) => p >= 0.6 },
  ];

  const settled = entries.filter((e) => e.settledAt !== null && e.actualHomeScore !== null && e.actualAwayScore !== null);
  const rate = (covers: number, n: number): number | null => (n > 0 ? covers / n : null);

  const bandRows: BacktestBand[] = bands.map((b) => {
    const rows = settled.filter((e) => b.test(e.homeWinProb));
    let homeCovers = 0;
    let awayCovers = 0;
    for (const e of rows) {
      const margin = (e.actualHomeScore ?? 0) - (e.actualAwayScore ?? 0);
      if (margin > e.handicapLine) homeCovers++;
      else if (margin < e.handicapLine) awayCovers++;
    }
    return {
      label: b.label,
      n: rows.length,
      homeCoverRate: rate(homeCovers, rows.length),
      awayCoverRate: rate(awayCovers, rows.length),
    };
  });

  let homeCovers = 0;
  let awayCovers = 0;
  for (const e of settled) {
    const margin = (e.actualHomeScore ?? 0) - (e.actualAwayScore ?? 0);
    if (margin > e.handicapLine) homeCovers++;
    else if (margin < e.handicapLine) awayCovers++;
  }

  return {
    slug,
    bands: bandRows,
    total: {
      n: settled.length,
      homeCoverRate: rate(homeCovers, settled.length),
      awayCoverRate: rate(awayCovers, settled.length),
    },
  };
}

/** Nombre d'entrées enregistrées (diagnostic). */
export function backtestEntryCount(slug: string | null): number {
  const store = readStoreSync();
  return slug ? store.entries.filter((e) => e.slug === slug).length : store.entries.length;
}

/** Point d'entrée appelé par le moteur (fire-and-forget, jamais bloquant). */
export function recordBacktests(
  slug: string,
  matches: RugbyMatch[],
  predictions: Map<string, RugbyPrediction>
): void {
  void queue(() => settleAndRecord(slug, matches, predictions)).catch((err) => {
    console.warn("[rugby/backtest] mise à jour échouée (best-effort):", (err as Error).message);
  });
}