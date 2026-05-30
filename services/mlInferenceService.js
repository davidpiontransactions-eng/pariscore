'use strict';
/**
 * services/mlInferenceService.js — Service d'inférence ML multi-moteur pour PariScore.
 *
 * Généralise le pattern inline `_runCatBoostBatchInference()` (server.js:4400) en un
 * service réutilisable supportant plusieurs moteurs de gradient boosting :
 *   - catboost  (en production — features catégorielles natives)
 *   - xgboost   (pré-match foot/tennis — robustesse, meta-learner)
 *   - lightgbm  (live — latence, gros volumes, faible RAM)
 *
 * ARCHITECTURE — Option B (subprocess Python via child_process.spawn) :
 *   Node.js  ──spawn + stdin JSON──▶  python ml/infer_<engine>.py  (process éphémère)
 *            ◀──stdout JSON──────────  └─ charge modèles, prédit batch, exit
 *
 * Contrat IPC (identique à ml/infer_catboost.py, donc déjà compatible) :
 *   stdin  : { features: [ {id, home_team, away_team, league, commence_time, poisson, fair, ...} ], sport }
 *   stdout : { predictions: { "<matchId>": { home, draw, away, over25, btts } } }
 *   exit≠0 / timeout / stdout invalide  → predictions vides → fallback math natif (Poisson/Elo).
 *
 * RÉSILIENCE : aucune exception ne remonte au caller. Tout échec (spawn, timeout, parse,
 * modèle absent, flag désactivé) résout sur {} → le caller bascule sur son modèle classique.
 * L'interface utilisateur n'est JAMAIS vide.
 *
 * Zéro dépendance npm (modules natifs Node uniquement) — conforme à l'architecture PariScore.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Racine projet = parent de services/
const ROOT = path.resolve(__dirname, '..');
const ML_DIR = path.join(ROOT, 'ml');
const MODELS_DIR = path.join(ROOT, 'models');

// Binaire Python — venv isolé sous Windows, python3 sur le VPS Linux.
const PY_BIN = process.env.CATBOOST_PYTHON_BIN ||
  (process.platform === 'win32'
    ? path.join(ROOT, '.venv-data', 'Scripts', 'python.exe')
    : 'python3');

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Registre des moteurs ML. Chaque entrée décrit comment invoquer un moteur.
 *   inferScript    : script Python d'inférence (lit stdin, écrit stdout JSON)
 *   modelSentinel  : modèle dont la présence conditionne l'activation (skip si absent)
 *   enabledEnv     : variable .env qui doit valoir 'true' pour activer le moteur
 */
const ML_ENGINES = {
  catboost: {
    inferScript: path.join(ML_DIR, 'infer_catboost.py'),
    modelSentinel: path.join(MODELS_DIR, 'catboost_football_1x2_v1.cbm'),
    enabledEnv: 'CATBOOST_ENABLED',
  },
  xgboost: {
    inferScript: path.join(ML_DIR, 'infer_xgboost.py'),
    modelSentinel: path.join(MODELS_DIR, 'xgb_football_1x2_v1.ubj'),
    enabledEnv: 'XGBOOST_ENABLED',
  },
  lightgbm: {
    inferScript: path.join(ML_DIR, 'infer_lightgbm.py'),
    modelSentinel: path.join(MODELS_DIR, 'lgbm_football_1x2_v1.txt'),
    enabledEnv: 'LIGHTGBM_ENABLED',
  },
};

/**
 * Parse la sortie stdout du subprocess Python.
 * Le script peut émettre des warnings sur stdout avant le JSON final ; on ne retient
 * que la DERNIÈRE ligne commençant par '{' (dérivé de _cbParseOut, server.js:4394).
 * @throws si aucune sortie exploitable.
 */
function parseStdout(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) throw new Error('subprocess produced no JSON output');
  const jsonLines = trimmed.split('\n').filter((l) => l.trim().startsWith('{'));
  return JSON.parse(jsonLines.length ? jsonLines[jsonLines.length - 1] : trimmed);
}

/**
 * Transforme une liste de matchs PariScore en vecteurs de features pour le modèle.
 * Le schéma DOIT correspondre au FEATURE_NAMES du script train_<engine>.py.
 * Foot : sorties Poisson + cotes fair + métadonnées temporelles + catégoriel (équipes/ligue).
 * Tennis : Elo, Dominance Ratio, momentum (extension — cf. buildTennisFeatures).
 */
function buildFootballFeatures(matches) {
  return (matches || [])
    .filter((m) => !(m.sport || '').startsWith('tennis_') && m.sport !== 'tennis')
    .map((m) => ({
      id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      league: m.league || 'unknown',
      commence_time: m.commence_time,
      poisson: m.poisson
        ? {
            homeWin: m.poisson.homeWin, draw: m.poisson.draw, awayWin: m.poisson.awayWin,
            over25: m.poisson.over25, over15: m.poisson.over15,
            btts: m.poisson.btts, cs00: m.poisson.cs00,
          }
        : null,
      fair: m.fair || null,
    }));
}

/**
 * Features tennis (live + pré-match). Stub d'extension : à aligner avec train_lightgbm.py
 * quand le modèle tennis sera entraîné. Expose Elo, Dominance Ratio et delta de momentum.
 */
function buildTennisFeatures(matches) {
  return (matches || [])
    .filter((m) => (m.sport || '').startsWith('tennis') || m.sport === 'tennis')
    .map((m) => ({
      id: m.id,
      player1: m.home_team || m.player1,
      player2: m.away_team || m.player2,
      tournament: m.tournament || m.league || 'unknown',
      surface: m.surface || 'unknown',
      elo_p1: m.elo_p1 != null ? m.elo_p1 : (m.welo_p1 != null ? m.welo_p1 : null),
      elo_p2: m.elo_p2 != null ? m.elo_p2 : (m.welo_p2 != null ? m.welo_p2 : null),
      dominance_ratio: m.dominance_ratio != null ? m.dominance_ratio : null,
      momentum_delta: m.momentum_delta != null ? m.momentum_delta : null,
      commence_time: m.commence_time,
    }));
}

function buildFeatures(matches, sport) {
  return sport === 'tennis' ? buildTennisFeatures(matches) : buildFootballFeatures(matches);
}

/**
 * Lance l'inférence ML sur un batch de matchs via subprocess Python.
 * NE LÈVE JAMAIS d'exception : tout échec résout sur {} (→ le caller fait son fallback).
 *
 * @param {Object}  opts
 * @param {string}  opts.engine     - 'catboost' | 'xgboost' | 'lightgbm'
 * @param {string}  opts.sport      - 'football' | 'tennis'
 * @param {Array}   opts.matches    - matchs PariScore bruts
 * @param {number} [opts.timeoutMs] - timeout dur (défaut 30s)
 * @returns {Promise<Object>} map { matchId: { ...probas } } ou {} si échec.
 */
function runInference({ engine, sport = 'football', matches, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const cfg = ML_ENGINES[engine];

  // Garde-fous — tout résout sur {} (le caller bascule sur Poisson/Elo).
  if (!cfg) {
    console.warn(`[ML:${engine}] moteur inconnu — fallback`);
    return Promise.resolve({});
  }
  if (process.env[cfg.enabledEnv] !== 'true') {
    return Promise.resolve({}); // moteur désactivé volontairement
  }
  if (!fs.existsSync(cfg.inferScript)) {
    console.warn(`[ML:${engine}] script absent (${cfg.inferScript}) — fallback`);
    return Promise.resolve({});
  }
  if (!fs.existsSync(cfg.modelSentinel)) {
    console.warn(`[ML:${engine}] modèle absent — entraîner d'abord — fallback`);
    return Promise.resolve({});
  }

  const features = buildFeatures(matches, sport);
  if (!features.length) return Promise.resolve({});

  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };

    let cp;
    try {
      cp = spawn(PY_BIN, [cfg.inferScript], {
        cwd: ROOT,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      console.warn(`[ML:${engine}] spawn impossible: ${err.message} — fallback`);
      return done({});
    }

    let out = '';
    cp.stdout.on('data', (d) => { out += d.toString(); });
    cp.stderr.on('data', (d) => process.stderr.write(`[ML:${engine}] stderr: ${d}`));

    const timer = setTimeout(() => {
      try { cp.kill(); } catch (_) { /* déjà mort */ }
      console.warn(`[ML:${engine}] timeout ${timeoutMs}ms — fallback`);
      done({});
    }, timeoutMs);

    cp.on('close', () => {
      clearTimeout(timer);
      try {
        const parsed = parseStdout(out);
        done(parsed.predictions && typeof parsed.predictions === 'object' ? parsed.predictions : {});
      } catch (e) {
        console.warn(`[ML:${engine}] parse error: ${e.message} — fallback`);
        done({});
      }
    });

    cp.on('error', (err) => {
      clearTimeout(timer);
      console.warn(`[ML:${engine}] erreur process: ${err.message} — fallback`);
      done({});
    });

    try {
      cp.stdin.write(JSON.stringify({ features, sport }));
      cp.stdin.end();
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[ML:${engine}] écriture stdin échouée: ${err.message} — fallback`);
      done({});
    }
  });
}

/**
 * Wrapper FALLBACK STRICT — try/catch garanti.
 * Tente l'inférence ML ; si elle retourne du vide OU lève, exécute le modèle
 * mathématique classique (Poisson foot / Elo+DR tennis) passé en `fallbackFn`.
 * L'interface n'est JAMAIS laissée sans prédiction.
 *
 * @param {Array}    matches
 * @param {Object}   opts        - { engine, sport, timeoutMs }
 * @param {Function} fallbackFn  - (matches) => predictionsMap  (synchrone ou async)
 * @returns {Promise<{ source:'ml'|'fallback', engine:string, predictions:Object }>}
 */
async function predictWithFallback(matches, opts, fallbackFn) {
  const engine = opts && opts.engine;
  try {
    const preds = await runInference({ matches, ...opts });
    const n = preds && typeof preds === 'object' ? Object.keys(preds).length : 0;
    if (n > 0) {
      return { source: 'ml', engine, predictions: preds };
    }
    console.warn(`[ML:${engine}] 0 prédiction — bascule modèle classique`);
  } catch (e) {
    // runInference ne lève normalement jamais, mais ceinture + bretelles.
    console.warn(`[ML:${engine}] exception inattendue: ${e.message} — bascule modèle classique`);
  }
  // ── Fallback math natif ──────────────────────────────────────────────────
  try {
    const fb = typeof fallbackFn === 'function' ? await fallbackFn(matches) : {};
    return { source: 'fallback', engine, predictions: fb || {} };
  } catch (e) {
    console.warn(`[ML] fallback lui-même en échec: ${e.message}`);
    return { source: 'fallback', engine, predictions: {} };
  }
}

/**
 * Convertit une cote décimale ↔ probabilité, et mappe les probas du modèle vers
 * les variables métier PariScore (`proba_live`, `odds_player1`, `odds_player2`).
 * Clamp défensif pour éviter les divisions par ~0 et les cotes aberrantes.
 */
function probaToDecimalOdds(p) {
  const prob = Math.min(0.999, Math.max(0.001, Number(p) || 0));
  return Math.round((1 / prob) * 100) / 100; // cote décimale, 2 décimales
}

/**
 * Mappe une prédiction modèle → variables consommées par le frontend / pipeline.
 *  - Football : { proba_home, proba_draw, proba_away, odds_home/draw/away, proba_over25, proba_btts }
 *  - Tennis   : { proba_live, odds_player1, odds_player2 }  (probas binaires p1/p2)
 */
function mapProbasToMarket(pred, sport = 'football') {
  if (!pred || typeof pred !== 'object') return null;

  if (sport === 'tennis') {
    // Modèle tennis : pred.home = P(victoire joueur 1)
    const p1 = Number(pred.home != null ? pred.home : pred.p1);
    const p2 = pred.away != null ? Number(pred.away) : (1 - p1);
    return {
      proba_live: Math.round(p1 * 1000) / 10, // % à 1 décimale (proba live joueur 1)
      odds_player1: probaToDecimalOdds(p1),
      odds_player2: probaToDecimalOdds(p2),
    };
  }

  // Football 1X2 + marchés dérivés
  return {
    proba_home: Math.round((pred.home || 0) * 1000) / 10,
    proba_draw: Math.round((pred.draw || 0) * 1000) / 10,
    proba_away: Math.round((pred.away || 0) * 1000) / 10,
    odds_home: probaToDecimalOdds(pred.home),
    odds_draw: probaToDecimalOdds(pred.draw),
    odds_away: probaToDecimalOdds(pred.away),
    proba_over25: pred.over25 != null ? Math.round(pred.over25 * 1000) / 10 : null,
    proba_btts: pred.btts != null ? Math.round(pred.btts * 1000) / 10 : null,
  };
}

module.exports = {
  ML_ENGINES,
  runInference,
  predictWithFallback,
  mapProbasToMarket,
  probaToDecimalOdds,
  buildFeatures,
  buildFootballFeatures,
  buildTennisFeatures,
  // exporté pour tests unitaires
  _parseStdout: parseStdout,
};

/* ───────────────────────────────────────────────────────────────────────────
   EXEMPLE D'INTÉGRATION dans server.js (buildMatchRecord / cron refresh) :

   const ml = require('./services/mlInferenceService');

   // Foot pré-match — XGBoost avec fallback Poisson natif
   const { source, predictions } = await ml.predictWithFallback(
     db.matches,
     { engine: 'xgboost', sport: 'football', timeoutMs: 30000 },
     (matches) => {
       // modèle classique déjà calculé dans buildMatchRecord → renvoyer la map Poisson
       const out = {};
       for (const m of matches) {
         if (m.poisson) out[m.id] = {
           home: m.poisson.homeWin / 100, draw: m.poisson.draw / 100,
           away: m.poisson.awayWin / 100, over25: m.poisson.over25 / 100,
           btts: m.poisson.btts / 100,
         };
       }
       return out;
     }
   );
   for (const m of db.matches) {
     if (predictions[m.id]) {
       m.ml_pred = predictions[m.id];
       m.ml_source = source;                       // 'ml' ou 'fallback' — traçabilité
       m.ml_market = ml.mapProbasToMarket(predictions[m.id], 'football');
     }
   }

   // Tennis live — LightGBM (latence) avec fallback Elo+DR
   const tn = await ml.predictWithFallback(
     liveTennisMatches,
     { engine: 'lightgbm', sport: 'tennis', timeoutMs: 8000 },
     (matches) => computeEloDRFallback(matches)    // modèle math tennis existant
   );
   ─────────────────────────────────────────────────────────────────────────── */
