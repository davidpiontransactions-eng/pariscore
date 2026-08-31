/**
 * CatBoost Bridge — inférence ML via subprocess Python.
 *
 * Pattern hérité de server.js:_runCatBoostBatchInference + services/mlInferenceService.js.
 * Spawne `python ml/infer_catboost.py`, envoie les features par stdin JSON,
 * reçoit les prédictions par stdout JSON. Le process est mis en cache (réutilisé)
 * tant qu'il reste en vie.
 *
 * Kill-switch : CATBOOST_ENABLED !== 'true' → retourne null immédiatement.
 * Toute erreur résout sur null (le caller fait son fallback Poisson/Elo).
 */

import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────────────────────

export type CatBoostPrediction = {
  home: number;
  draw: number;
  away: number;
  over25: number;
  btts: number;
};

type CatBoostFeatures = {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  commence_time: string;
  poisson: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    over15: number;
    btts: number;
    cs00: number;
  } | null;
  fair: { home: number; draw: number; away: number } | null;
};

type CatBoostRequest = {
  features: CatBoostFeatures[];
  sport: string;
};

type CatBoostResponse = {
  predictions?: Record<string, CatBoostPrediction>;
  error?: string;
};

// ── Configuration ──────────────────────────────────────────────────────────

const ROOT = process.cwd();
const ML_DIR = join(ROOT, "ml");
const MODELS_DIR = join(ROOT, "models");

/** Binaire Python — venv isolé sous Windows, python3 sur VPS Linux. */
const PY_BIN: string =
  process.env.CATBOOST_PYTHON_BIN ||
  (process.platform === "win32"
    ? join(ROOT, ".venv-data", "Scripts", "python.exe")
    : "python3");

const INFER_SCRIPT = join(ML_DIR, "infer_catboost.py");
const MODEL_SENTINEL = join(MODELS_DIR, "catboost_football_1x2_v1.cbm");
const TIMEOUT_MS = 30_000;

// ── Process mis en cache ───────────────────────────────────────────────────
// On ne garde PAS le process Python en vie entre les batches (mode éphémère)
// car infer_catboost.py charge les modèles au démarrage et exit. Le coût de
// spawn est négligeable (~50ms) vs risque de process zombie.
// Si on voulait réutiliser, il faudrait un protocol stdin/stdout persistent.

// ── Fonctions ──────────────────────────────────────────────────────────────

/** Vérifie que le bridge est disponible (flag + modèle + script). */
function isAvailable(): boolean {
  if (process.env.CATBOOST_ENABLED !== "true") return false;
  if (!existsSync(INFER_SCRIPT)) return false;
  if (!existsSync(MODEL_SENTINEL)) return false;
  return true;
}

/** Parse la sortie stdout du subprocess Python. Dernière ligne JSON uniquement. */
function parseStdout(raw: string): CatBoostResponse {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("[CatBoost] subprocess sans sortie JSON");
  const jsonLines = trimmed.split("\n").filter((l) => l.trim().startsWith("{"));
  return JSON.parse(jsonLines.length ? jsonLines[jsonLines.length - 1] : trimmed);
}

/**
 * Convertit des matchs PariScore en vecteurs de features pour CatBoost.
 * Le schéma correspond exactement à FEATURE_NAMES dans train_catboost.py.
 */
export function buildCatBoostFeatures(
  matches: Array<{
    id?: string;
    home_team?: string;
    away_team?: string;
    league?: string;
    commence_time?: string;
    sport?: string;
    poisson?: {
      homeWin?: number;
      draw?: number;
      awayWin?: number;
      over25?: number;
      over15?: number;
      btts?: number;
      cs00?: number;
    } | null;
    fair?: { home?: number; draw?: number; away?: number } | null;
  }>,
): CatBoostFeatures[] {
  return matches
    .filter((m) => !(m.sport || "").startsWith("tennis_") && m.sport !== "tennis")
    .map((m) => ({
      id: String(m.id || ""),
      home_team: m.home_team || "unknown",
      away_team: m.away_team || "unknown",
      league: m.league || "unknown",
      commence_time: m.commence_time || "",
      poisson: m.poisson
        ? {
            homeWin: m.poisson.homeWin ?? 33,
            draw: m.poisson.draw ?? 33,
            awayWin: m.poisson.awayWin ?? 34,
            over25: m.poisson.over25 ?? 50,
            over15: m.poisson.over15 ?? 65,
            btts: m.poisson.btts ?? 50,
            cs00: m.poisson.cs00 ?? 30,
          }
        : null,
      fair: m.fair
        ? {
            home: m.fair.home ?? 0.33,
            draw: m.fair.draw ?? 0.33,
            away: m.fair.away ?? 0.34,
          }
        : null,
    }));
}

/**
 * Lance l'inférence CatBoost sur un batch de matchs.
 *
 * NE LÈVE JAMAIS d'exception : tout échec résout sur null
 * (→ le caller fait fallback Poisson/Elo).
 *
 * @param matches  - matchs PariScore bruts
 * @returns predictions par matchId, ou null si indisponible/erreur
 */
export async function predictCatBoost(
  matches: Array<Record<string, unknown>>,
): Promise<Record<string, CatBoostPrediction> | null> {
  if (!isAvailable()) return null;

  const features = buildCatBoostFeatures(matches as Parameters<typeof buildCatBoostFeatures>[0]);
  if (!features.length) return null;

  return new Promise((resolve) => {
    let settled = false;
    const done = (val: Record<string, CatBoostPrediction> | null) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    let cp: ChildProcess;
    try {
      cp = spawn(PY_BIN, [INFER_SCRIPT], {
        cwd: ROOT,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      console.warn(`[CatBoost] spawn impossible: ${(err as Error).message} — fallback`);
      return done(null);
    }

    let out = "";
    cp.stdout?.on("data", (d: Buffer) => {
      out += d.toString();
    });
    cp.stderr?.on("data", (d: Buffer) => {
      process.stderr.write(`[CatBoost] stderr: ${d}`);
    });

    const timer = setTimeout(() => {
      try {
        cp.kill();
      } catch {
        // déjà mort
      }
      console.warn(`[CatBoost] timeout ${TIMEOUT_MS}ms — fallback`);
      done(null);
    }, TIMEOUT_MS);

    cp.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed = parseStdout(out);
        if (parsed.error) {
          console.warn(`[CatBoost] erreur Python: ${parsed.error} — fallback`);
          return done(null);
        }
        done(parsed.predictions ?? null);
      } catch (e) {
        console.warn(`[CatBoost] parse error: ${(e as Error).message} — fallback`);
        done(null);
      }
    });

    cp.on("error", (err) => {
      clearTimeout(timer);
      console.warn(`[CatBoost] process error: ${err.message} — fallback`);
      done(null);
    });

    // Envoie les features par stdin
    const payload: CatBoostRequest = { features, sport: "football" };
    try {
      cp.stdin?.write(JSON.stringify(payload));
      cp.stdin?.end();
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[CatBoost] stdin write failed: ${(err as Error).message} — fallback`);
      done(null);
    }
  });
}
