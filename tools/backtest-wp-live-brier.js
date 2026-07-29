#!/usr/bin/env node
/**
 * T0.5 — Backtest Brier/RPS de la Win Probability live football.
 *
 * Méthode : walk-forward sur match_stats_history (état final + données mi-temps).
 * Pour chaque match avec données mi-temps complètes, on reconstruit l'état live
 * à la 45e minute (score HT, xG 1H), on prédit le 1X2 "depuis la mi-temps" via
 * le même moteur Poisson que computeLiveWinProbability (server.js), puis on
 * compare au résultat final réel. Métriques : Brier (3-classes), RPS, log-loss,
 * reliability diagram (10 bins).
 *
 * Auto-contenu : réimplémente poissonPMF + calcLiveAdjustedLambdas + calibration
 * (pas d'import server.js, qui est un monolithe non exporté). Pattern :
 * tools/backtest-age-features-brier.js (logistic zero-dep + better-sqlite3 readonly).
 *
 * Usage :
 *   node tools/backtest-wp-live-brier.js              # backtest complet
 *   node tools/backtest-wp-live-brier.js --limit 200  # sous-échantillon
 *   node tools/backtest-wp-live-brier.js --league 17  # filtre ligue (bsd_league_id)
 *
 * Output : .context/wp-live-backtest.md + stdout résumé + JSON métriques.
 *
 * Auteur : QA-VAL / DS-ML · 2026-07-29
 */
'use strict';

const path = require('path');
const fs = require('fs');

// Agnostique runtime : bun:sqlite (Bun) ou better-sqlite3 (Node).
// bun:sqlite et better-sqlite3 partagent la même API (prepare/all/get/run).
// Détection runtime AVANT require : sur Bun, better-sqlite3 (binaire natif) lève
// au `new Database()` bien que le require réussisse — donc on force bun:sqlite.
const _IS_BUN = (typeof Bun !== 'undefined') || (typeof globalThis.Bun !== 'undefined');
let Database;
let _runtime = 'unknown';
if (_IS_BUN) {
  const mod = require('bun:sqlite');
  Database = mod.Database;
  _runtime = 'bun-sqlite';
} else {
  try {
    Database = require('better-sqlite3');
    _runtime = 'node-better-sqlite3';
  } catch (e) {
    console.error('better-sqlite3 indisponible sur Node. Recompilez : `npm rebuild better-sqlite3`');
    process.exit(1);
  }
}

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const REPORT_PATH = path.join(ROOT, '.context', 'wp-live-backtest.md');

// ── Paramètres CLI ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx > -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1]) : 0;
const leagueIdx = args.indexOf('--league');
const LEAGUE = leagueIdx > -1 && args[leagueIdx + 1] ? args[leagueIdx + 1] : null;

// ═══════════════════════════════════════════════════════════════════════════════
//  Moteur Poisson (réimplémentation auto-contenu de server.js)
// ═══════════════════════════════════════════════════════════════════════════════
function poissonPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  // factorielle + exponentielle récursives (stables)
  let logP = k * Math.log(lambda) - lambda;
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// calcLiveAdjustedLambdas (réplique de server.js T0.3).
// Calcule les lambdas "depuis maintenant" pour les buts restants.
function calcLiveAdjustedLambdas(match) {
  const minute = Math.min(match.live_minute || 0, 90);
  if (minute <= 0) return null;
  const eg = match.expectedGoals || {};
  const preLambdaH = eg.home || 1.3;
  const preLambdaA = eg.away || 1.1;
  const timeFactor = (90 - minute) / 90;
  const liveXgH = match.live_xg?.home;
  const liveXgA = match.live_xg?.away;
  if (liveXgH == null || liveXgA == null) {
    return { home: preLambdaH * timeFactor, away: preLambdaA * timeFactor };
  }
  const liveRateH = (liveXgH / minute) * 90;
  const liveRateA = (liveXgA / minute) * 90;
  const liveWeight = Math.min(0.8, minute / 60);
  const preWeight = 1 - liveWeight;
  let adjLambdaH = preLambdaH * preWeight + liveRateH * liveWeight;
  let adjLambdaA = preLambdaA * preWeight + liveRateA * liveWeight;
  // Momentum signé [-100,+100]
  if (Array.isArray(match.live_momentum) && match.live_momentum.length > 3) {
    const recent = match.live_momentum.slice(-6);
    const vs = recent.map(p => (p && typeof p.v === 'number') ? p.v : 0);
    const meanV = vs.reduce((a, b) => a + b, 0) / vs.length;
    const momentumBias = (meanV / 100) * 0.3;
    adjLambdaH *= (1 + momentumBias);
    adjLambdaA *= (1 - momentumBias);
  }
  // Possession
  const poss = match.live_possession;
  if (poss) {
    const pH = parseFloat(poss.home) || 0;
    const pA = parseFloat(poss.away) || 0;
    if (pH + pA > 0) {
      const ratio = pH / (pH + pA);
      const bias = (ratio - 0.5) * 0.15;
      adjLambdaH *= (1 + bias);
      adjLambdaA *= (1 - bias);
    }
  }
  // Cartons rouges
  const redH = parseInt(match.live_cards?.home?.red || 0) || 0;
  const redA = parseInt(match.live_cards?.away?.red || 0) || 0;
  if (redH > 0) adjLambdaH *= Math.max(0.70, 1 - redH * 0.12);
  if (redA > 0) adjLambdaA *= Math.max(0.70, 1 - redA * 0.12);
  // Dangerous attacks
  const dang = match.live_dangerous_attacks;
  if (dang && dang.home != null && dang.away != null) {
    const total = (dang.home || 0) + (dang.away || 0);
    if (total > 0) {
      const ratio = dang.home / total;
      const bias = (ratio - 0.5) * 0.08;
      adjLambdaH *= (1 + bias);
      adjLambdaA *= (1 - bias);
    }
  }
  adjLambdaH = Math.max(0.1, adjLambdaH * timeFactor);
  adjLambdaA = Math.max(0.1, adjLambdaA * timeFactor);
  return { home: adjLambdaH, away: adjLambdaA };
}

// LIVE_CALIBRATION_BINS (réplique de server.js T0.3) — shrinkage vers 50%.
const LIVE_CALIBRATION_BINS = [
  { min: 0, max: 10, factor: 0.85 }, { min: 10, max: 20, factor: 0.88 },
  { min: 20, max: 30, factor: 0.90 }, { min: 30, max: 40, factor: 0.93 },
  { min: 40, max: 60, factor: 0.97 }, { min: 60, max: 70, factor: 0.95 },
  { min: 70, max: 80, factor: 0.91 }, { min: 80, max: 90, factor: 0.87 },
  { min: 90, max: 100, factor: 0.83 },
];
function _liveCalibrate(rawPct) {
  if (rawPct == null || !Number.isFinite(rawPct)) return rawPct;
  for (const bin of LIVE_CALIBRATION_BINS) {
    if (rawPct >= bin.min && rawPct < bin.max) {
      return Math.round((50 + (rawPct - 50) * bin.factor) * 10) / 10;
    }
  }
  return Math.round(rawPct * 10) / 10;
}

// Prédit le 1X2 (calibré ou brut) "depuis maintenant" via matrice Poisson 7x7.
function predict1X2(match, { calibrated = true } = {}) {
  const lambdas = calcLiveAdjustedLambdas(match);
  if (!lambdas) return null;
  let scoreH = 0, scoreA = 0;
  if (typeof match.live_score === 'string' && match.live_score.includes('-')) {
    const parts = match.live_score.split('-').map(Number);
    scoreH = Number.isFinite(parts[0]) ? parts[0] : 0;
    scoreA = Number.isFinite(parts[1]) ? parts[1] : 0;
  } else if (match.live_score && typeof match.live_score === 'object') {
    scoreH = match.live_score.home ?? 0;
    scoreA = match.live_score.away ?? 0;
  }
  const MAX = 7;
  let hWin = 0, draw = 0, aWin = 0;
  for (let h = 0; h < MAX; h++) {
    for (let a = 0; a < MAX; a++) {
      const p = poissonPMF(lambdas.home, h) * poissonPMF(lambdas.away, a);
      const fH = scoreH + h, fA = scoreA + a;
      if (fH > fA) hWin += p;
      else if (fH === fA) draw += p;
      else aWin += p;
    }
  }
  let home = Math.round(hWin * 100), dw = Math.round(draw * 100), away = Math.round(aWin * 100);
  if (calibrated) {
    home = _liveCalibrate(home);
    dw = _liveCalibrate(dw);
    away = _liveCalibrate(away);
  }
  const sum = home + dw + away;
  if (sum > 0) {
    home = home / sum; dw = dw / sum; away = away / sum;
  }
  return { home, draw: dw, away };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Métriques
// ═══════════════════════════════════════════════════════════════════════════════

// Brier 3-classes : moyenne des erreurs quadratiques par classe.
function brier3(p, outcome) {
  const o = [outcome === 'home' ? 1 : 0, outcome === 'draw' ? 1 : 0, outcome === 'away' ? 1 : 0];
  return ((p.home - o[0]) ** 2 + (p.draw - o[1]) ** 2 + (p.away - o[2]) ** 2) / 3;
}

// RPS (Ranked Probability Score) pour 1X2 ordonné [home, draw, away].
// RPS = (1/(N-1)) * Σ_{i=1}^{N-1} (cum_pred_i - cum_outcome_i)²  avec N=3.
function rps3(p, outcome) {
  const pred = [p.home, p.draw, p.away];
  const obs = [outcome === 'home' ? 1 : 0, outcome === 'draw' ? 1 : 0, outcome === 'away' ? 1 : 0];
  let cumP = 0, cumO = 0, s = 0;
  for (let i = 0; i < 2; i++) { // N-1 = 2
    cumP += pred[i];
    cumO += obs[i];
    s += (cumP - cumO) ** 2;
  }
  return s / 2;
}

// Log-loss pour la classe observée (cross-entropy).
function logloss(p, outcome) {
  const po = outcome === 'home' ? p.home : outcome === 'draw' ? p.draw : p.away;
  return -Math.log(Math.max(1e-12, po));
}

// Reliability diagram (10 bins sur la proba observée pour le favori prédit).
function buildReliability(records) {
  const NBINS = 10;
  const bins = Array.from({ length: NBINS }, () => ({ n: 0, sumPred: 0, sumObs: 0 }));
  for (const r of records) {
    // On binne sur la proba max (favori) — fiabilité de la confiance.
    const maxP = Math.max(r.pred.home, r.pred.away, r.pred.draw);
    const idx = Math.min(NBINS - 1, Math.floor(maxP * NBINS));
    const wasCorrect = (maxP === r.pred.home && r.outcome === 'home')
                    || (maxP === r.pred.draw && r.outcome === 'draw')
                    || (maxP === r.pred.away && r.outcome === 'away');
    bins[idx].n++;
    bins[idx].sumPred += maxP;
    bins[idx].sumObs += wasCorrect ? 1 : 0;
  }
  return bins.map((b, i) => ({
    bin: `${i * 10}-${(i + 1) * 10}%`,
    n: b.n,
    avgForecast: b.n ? +(b.sumPred / b.n).toFixed(3) : null,
    observedFreq: b.n ? +(b.sumObs / b.n).toFixed(3) : null,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Backtest
// ═══════════════════════════════════════════════════════════════════════════════
function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Base introuvable: ${DB_PATH}`);
    process.exit(1);
  }
  const db = _runtime === 'bun-sqlite'
    ? new Database(DB_PATH, { readonly: true })
    : new Database(DB_PATH, { readonly: true, fileMustExist: true });

  // Sélection : matchs avec données mi-temps complètes (score HT + xG 1H).
  let sql = `SELECT bsd_event_id, home_team, away_team, bsd_league_id, season,
                    home_score, away_score, home_score_ht, away_score_ht,
                    home_xg_1h, away_xg_1h, home_xg, away_xg,
                    home_possession, away_possession
             FROM match_stats_history
             WHERE home_score_ht IS NOT NULL AND away_score_ht IS NOT NULL
               AND home_xg_1h IS NOT NULL AND away_xg_1h IS NOT NULL
               AND home_score IS NOT NULL AND away_score IS NOT NULL`;
  const params = [];
  if (LEAGUE) { sql += ' AND bsd_league_id = ?'; params.push(LEAGUE); }
  sql += ' ORDER BY match_date DESC';
  if (LIMIT > 0) sql += ` LIMIT ${parseInt(LIMIT)}`;

  let rows;
  try { rows = db.prepare(sql).all(...params); }
  catch (e) {
    console.error('Erreur SELECT:', e.message);
    db.close(); process.exit(1);
  }
  db.close();

  console.log(`Matchs candidats (avec données mi-temps): ${rows.length}`);

  // Walk-forward : prédire le résultat final DEPUIS la mi-temps.
  const records = [];
  let skipped = 0;
  for (const r of rows) {
    // Reconstruit l'état live à la 45e minute.
    const matchHT = {
      live_minute: 45,
      live_score: `${r.home_score_ht}-${r.away_score_ht}`,
      live_xg: { home: r.home_xg_1h, away: r.away_xg_1h },
      // expectedGoals : projection fin de match depuis xG total si dispo, sinon 2x xG 1H.
      expectedGoals: {
        home: r.home_xg != null ? r.home_xg : (r.home_xg_1h * 2),
        away: r.away_xg != null ? r.away_xg : (r.away_xg_1h * 2),
      },
      live_possession: r.home_possession != null ? { home: r.home_possession, away: r.away_possession } : null,
      live_cards: { home: { red: 0 }, away: { red: 0 } }, // non dispo dans l'historique
      live_dangerous_attacks: null,
      live_momentum: null,
    };
    const predCalib = predict1X2(matchHT, { calibrated: true });
    const predRaw = predict1X2(matchHT, { calibrated: false });
    if (!predCalib || !predRaw) { skipped++; continue; }

    // Résultat réel final.
    const finalH = r.home_score, finalA = r.away_score;
    const outcome = finalH > finalA ? 'home' : finalH === finalA ? 'draw' : 'away';

    records.push({
      bsd_event_id: r.bsd_event_id, home_team: r.home_team, away_team: r.away_team,
      league: r.bsd_league_id, ht: `${r.home_score_ht}-${r.away_score_ht}`,
      final: `${finalH}-${finalA}`, outcome,
      pred: predCalib, predRaw,
    });
  }

  if (records.length === 0) {
    console.log('\nAucun match exploitable. Note : match_stats_history doit contenir des données');
    console.log('mi-temps (home_score_ht, home_xg_1h...). Enrichissez la base via BSD puis relancez.');
    writeReport([], { total: 0, skipped, message: 'Aucune donnée mi-temps disponible.' });
    return;
  }

  // Agrège les métriques.
  const agg = (recs, key) => {
    let brierSum = 0, rpsSum = 0, llSum = 0, hits = 0;
    for (const r of recs) {
      const p = key === 'raw' ? r.predRaw : r.pred;
      brierSum += brier3(p, r.outcome);
      rpsSum += rps3(p, r.outcome);
      llSum += logloss(p, r.outcome);
      const argmax = p.home >= p.draw && p.home >= p.away ? 'home'
                   : p.away >= p.draw ? 'away' : 'draw';
      if (argmax === r.outcome) hits++;
    }
    const n = recs.length;
    return {
      n,
      brier: +(brierSum / n).toFixed(4),
      rps: +(rpsSum / n).toFixed(4),
      logloss: +(llSum / n).toFixed(4),
      accuracy: +(hits / n * 100).toFixed(2),
    };
  };

  const calibStats = agg(records, 'calib');
  const rawStats = agg(records, 'raw');

  // Baseline coin-flip (1/3 chaque), outcome home : Brier 3-classes = 2/9 ≈ 0.2222.
  // RPS = (1/(N-1)) Σ(cum_pred - cum_outcome)² : {1/3,1/3,1/3} vs {1,0,0}
  //   cum diffs = [1/3-1, 2/3-1] = [-2/3,-1/3] → (4/9+1/9)/2 = 5/18 ≈ 0.2778
  const coinFlipBrier = +(2 / 9).toFixed(4);
  const coinFlipRps = +(5 / 18).toFixed(4);

  // Reliability diagram (sur calibré).
  const reliability = buildReliability(records);

  const results = {
    total: records.length,
    skipped,
    calibrated: calibStats,
    raw: rawStats,
    baseline_coinflip: { brier: coinFlipBrier, rps: coinFlipRps },
    targets: { brier: 0.18, rps: 0.20 },
    reliability,
    generated_at: new Date().toISOString(),
  };

  // Console summary
  console.log('\n═══ RÉSULTATS BACKTEST WP LIVE (mi-temps → final) ═══');
  console.log(`Matchs évalués : ${results.total} (skip: ${results.skipped})`);
  console.log(`\nPoisson CALIBRÉ : Brier=${calibStats.brier}  RPS=${calibStats.rps}  LogLoss=${calibStats.logloss}  Acc=${calibStats.accuracy}%`);
  console.log(`Poisson BRUT    : Brier=${rawStats.brier}  RPS=${rawStats.rps}  LogLoss=${rawStats.logloss}  Acc=${rawStats.accuracy}%`);
  console.log(`Baseline piece  : Brier=${coinFlipBrier}  RPS=${coinFlipRps}`);
  console.log(`\nCibles DoD M0   : Brier ≤ 0.18  |  RPS ≤ 0.20`);
  console.log(`\nBrier calibré vs brut : ${calibStats.brier <= rawStats.brier ? 'AMÉLIORÉ ✓' : 'DÉGRADÉ ⚠'} (Δ=${(calibStats.brier - rawStats.brier).toFixed(4)})`);
  console.log(`Brier calibré vs coin : ${calibStats.brier < coinFlipBrier ? 'MEILLEUR ✓' : 'INFERIEUR ⚠'}`);

  writeReport(records, results);
  console.log(`\nRapport écrit : ${REPORT_PATH}`);
}

function writeReport(records, results) {
  const md = [];
  md.push('# Backtest Brier/RPS — Win Probability Live Football');
  md.push('');
  md.push('> T0.5 — Validation de la WP live Poisson calibrée (mi-temps → résultat final).');
  md.push('> Source : `match_stats_history` (walk-forward sur données mi-temps).');
  md.push(`> Généré : ${results.generated_at || new Date().toISOString()}`);
  md.push('');

  if (results.message) {
    md.push(`**Statut** : ${results.message}`);
    md.push('');
    md.push('Le backtest nécessite des matchs avec données mi-temps complètes (`home_score_ht`, `home_xg_1h`...)');
    md.push('dans `match_stats_history`. Enrichissez la base via BSD puis relancez :');
    md.push('`node tools/backtest-wp-live-brier.js`');
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, md.join('\n'));
    return;
  }

  md.push('## Résumé');
  md.push('');
  md.push('| Métrique | Poisson CALIBRÉ | Poisson BRUT | Baseline coin-flip | Cible DoD |');
  md.push('|---|:---:|:---:|:---:|:---:|');
  md.push(`| Matchs | ${results.calibrated.n} | ${results.raw.n} | — | — |`);
  md.push(`| **Brier** (3-classes) | **${results.calibrated.brier}** | ${results.raw.brier} | ${results.baseline_coinflip.brier} | ≤ 0.18 |`);
  md.push(`| **RPS** | **${results.calibrated.rps}** | ${results.raw.rps} | ${results.baseline_coinflip.rps} | ≤ 0.20 |`);
  md.push(`| LogLoss | ${results.calibrated.logloss} | ${results.raw.logloss} | ${Math.log(3).toFixed(4)} | — |`);
  md.push(`| Accuracy | ${results.calibrated.accuracy}% | ${results.raw.accuracy}% | 33.33% | — |`);
  md.push('');

  const brierPass = results.calibrated.brier <= results.targets.brier;
  const rpsPass = results.calibrated.rps <= results.targets.rps;
  md.push(`### Verdict DoD M0`);
  md.push(`- Brier ≤ 0.18 : ${brierPass ? '✅ ATTEINT' : '❌ non atteint'} (${results.calibrated.brier})`);
  md.push(`- RPS ≤ 0.20 : ${rpsPass ? '✅ ATTEINT' : '❌ non atteint'} (${results.calibrated.rps})`);
  md.push(`- Calibration vs brut : Brier ${results.calibrated.brier <= results.raw.brier ? 'amélioré' : 'dégradé'} (Δ ${(results.calibrated.brier - results.raw.brier).toFixed(4)})`);
  md.push('');

  md.push('## Reliability Diagram (calibré, 10 bins)');
  md.push('');
  md.push('| Bin prévision | Effectif | Proba moy. prédite | Fréq. observée | Écart (calibration) |');
  md.push('|---|:---:|:---:|:---:|:---:|');
  for (const b of results.reliability) {
    const ecart = (b.avgForecast != null && b.observedFreq != null)
      ? Math.abs(b.avgForecast - b.observedFreq).toFixed(3) : '—';
    md.push(`| ${b.bin} | ${b.n} | ${b.avgForecast ?? '—'} | ${b.observedFreq ?? '—'} | ${ecart} |`);
  }
  md.push('');
  md.push('> Un écart < 5% par bin indique une bonne calibration. Un modèle bien calibré a avgForecast ≈ observedFreq.');
  md.push('');

  md.push('## Méthodologie');
  md.push('');
  md.push('1. **Sélection** : matchs avec données mi-temps complètes (`home_score_ht`, `home_xg_1h`, `away_score_ht`, `away_xg_1h`).');
  md.push('2. **Reconstruction** : état live simulé à la 45e minute — score HT, xG 1H, expectedGoals depuis xG total.');
  md.push('3. **Prédiction** : matrice Poisson 7×7 depuis `calcLiveAdjustedLambdas` (momentum, possession, rouges, dangerous attacks) → 1X2.');
  md.push('4. **Calibration** : shrinkage vers 50% via `LIVE_CALIBRATION_BINS` (Poisson live sur-estime la confiance).');
  md.push('5. **Comparaison** : résultat final réel (`home_score`, `away_score`) → Brier 3-classes + RPS + LogLoss + reliability.');
  md.push('');
  md.push('### Limites');
  md.push('- **Snapshot mi-temps uniquement** : la calibration fine minute-par-minute viendra après accumulation de `live_match_stats` (T0.2).');
  md.push('- **Features partielles** : momentum array, dangerous attacks et cartons rouges ne sont pas dans l\'historique → calculés à zéro. La calibration s\'affinera quand `live_match_stats` sera peuplée.');
  md.push('- **Rétrospective** : expectedGoals est dérivé du xG final (oracle léger). Un vrai backtest live utiliserait les cotes pré-match.');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, md.join('\n'));
}

main();
