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

function runMonteCarlo(playerStats, N) {
  const titleCount = Object.create(null);
  const finalCount = Object.create(null);
  const sfCount = Object.create(null);
  const n = playerStats.length;
  if (n < 2) return { titleCount, finalCount, sfCount, totalRounds: 0 };
  const totalRounds = Math.max(1, Math.round(Math.log2(Math.max(2, n))));

  // Elo TypedArray (Float64) + pré-calcul win-prob[i*n+j] = P(i bat j).
  const elos = new Float64Array(n);
  for (let i = 0; i < n; i++) elos[i] = playerStats[i].clay_elo || 1500;
  const wp = new Float32Array(n * n);
  for (let a = 0; a < n; a++) {
    const ea = elos[a];
    for (let b = 0; b < n; b++) {
      wp[a * n + b] = 1 / (1 + Math.pow(10, (elos[b] - ea) / 400));
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
      let nextLen = 0;
      const pairs = aliveLen - (aliveLen & 1);
      for (let m = 0; m < pairs; m += 2) {
        const a = alive[m], b = alive[m + 1];
        const winner = Math.random() < wp[a * n + b] ? a : b;
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

  return { titleCount, finalCount, sfCount, totalRounds };
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
