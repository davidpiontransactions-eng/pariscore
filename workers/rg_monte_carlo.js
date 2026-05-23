/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  PariScore — Worker Monte Carlo Roland Garros bracket
 * ══════════════════════════════════════════════════════════════════════════════
 *  Décharge la simulation lourde (10 000 itérations × ~128 joueurs × 7 tours)
 *  hors du thread principal Node.js pour ne pas bloquer l'event loop (SSE, API
 *  REST, /api/v1/live, etc.) pendant 1–3 s de compute synchrone.
 *
 *  Reçoit via workerData : { playerStats: [{name, clay_elo, ...}], N }
 *  Renvoie via parentPort : { ok, result: {titleCount, finalCount, sfCount,
 *                            totalRounds}, ms }
 *
 *  Note : titleCount/finalCount/sfCount sont des plain objects (et non Map)
 *  pour rester structuredClone-compatible avec postMessage. Le main thread
 *  les reconvertit en Map pour préserver l'interface de _monteCarloRG().
 * ══════════════════════════════════════════════════════════════════════════════
 */
'use strict';

const { workerData, parentPort } = require('worker_threads');

// Pilier 1 — Fatigue universelle round-based. Compresse l'écart Elo des
// dernières rounds pour modéliser : champions fatigués en deuxième semaine
// = matches plus serrés = plus d'upsets. Coefficient appliqué à
// (eloB - eloA) avant le calcul Elo standard. V1 universelle (chaque
// joueur a même decay). V2 (post-launch) : per-player fatigue depuis BSD
// player matches duration_minutes.
// Index = round (0-based depuis R128 si draw 128). totalRounds=7 pour RG.
// Tableau 1.0 = no decay (R128/R64), descend à 0.78 en finale.
const FATIGUE_BY_ROUND = [1.00, 1.00, 0.97, 0.93, 0.88, 0.83, 0.78];

function runMonteCarlo(playerStats, N) {
  const titleCount = Object.create(null);
  const finalCount = Object.create(null);
  const sfCount = Object.create(null);
  const n = playerStats.length;
  if (n < 2) return { titleCount, finalCount, sfCount, totalRounds: 0 };
  const totalRounds = Math.max(1, Math.round(Math.log2(Math.max(2, n))));

  // Elo TypedArray (Float64) + pré-calcul win-prob[round, a, b] = P(a bat b)
  // au round R avec fatigue. Mémoire : totalRounds × n × n × 4 bytes.
  // Pour n=128, totalRounds=7 → ~458 KB Float32. OK.
  const elos = new Float64Array(n);
  for (let i = 0; i < n; i++) elos[i] = playerStats[i].clay_elo || 1500;
  const wp = new Float32Array(totalRounds * n * n);
  for (let r = 0; r < totalRounds; r++) {
    const fatigueCoef = FATIGUE_BY_ROUND[Math.min(r, FATIGUE_BY_ROUND.length - 1)];
    for (let a = 0; a < n; a++) {
      const ea = elos[a];
      for (let b = 0; b < n; b++) {
        // Compresse l'écart Elo proportionnellement au coefficient fatigue
        const diff = (elos[b] - ea) * fatigueCoef;
        wp[r * n * n + a * n + b] = 1 / (1 + Math.pow(10, diff / 400));
      }
    }
  }

  const titleC = new Int32Array(n);
  const finalC = new Int32Array(n);
  const sfC = new Int32Array(n);
  const alive = new Int32Array(n);
  const next = new Int32Array(n);
  const sfRound = totalRounds - 3;
  const finRound = totalRounds - 2;

  for (let i = 0; i < N; i++) {
    for (let k = 0; k < n; k++) alive[k] = k;
    let aliveLen = n;
    for (let round = 0; round < totalRounds; round++) {
      const wpRoundBase = round * n * n;
      let nextLen = 0;
      const pairs = aliveLen - (aliveLen & 1);
      for (let m = 0; m < pairs; m += 2) {
        const a = alive[m], b = alive[m + 1];
        const winner = Math.random() < wp[wpRoundBase + a * n + b] ? a : b;
        next[nextLen++] = winner;
        if (round === sfRound) sfC[winner]++;
        else if (round === finRound) finalC[winner]++;
      }
      if (aliveLen & 1) next[nextLen++] = alive[aliveLen - 1]; // bye
      for (let k = 0; k < nextLen; k++) alive[k] = next[k];
      aliveLen = nextLen;
    }
    if (aliveLen > 0) titleC[alive[0]]++;
  }

  for (let i = 0; i < n; i++) {
    const sk = String(playerStats[i].name || '').toLowerCase();
    if (titleC[i]) titleCount[sk] = (titleCount[sk] || 0) + titleC[i];
    if (finalC[i]) finalCount[sk] = (finalCount[sk] || 0) + finalC[i];
    if (sfC[i]) sfCount[sk] = (sfCount[sk] || 0) + sfC[i];
  }

  // Expose fatigue config in result for traceability (frontend debug)
  return { titleCount, finalCount, sfCount, totalRounds, fatigue_by_round: Array.from(FATIGUE_BY_ROUND.slice(0, totalRounds)) };
}

try {
  const t0 = Date.now();
  const playerStats = (workerData && workerData.playerStats) || [];
  const N = (workerData && workerData.N) || 10000;
  const result = runMonteCarlo(playerStats, N);
  parentPort.postMessage({ ok: true, result, ms: Date.now() - t0 });
} catch (err) {
  parentPort.postMessage({ ok: false, error: String((err && err.message) || err) });
}
