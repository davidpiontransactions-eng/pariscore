#!/usr/bin/env node
/**
 * Backtest Brier A/B — features d'âge "statistically enhanced" (arXiv 2502.01613)
 * bd c0li Phase 2.
 *
 * USAGE INTERNE / RECHERCHE UNIQUEMENT. Lit tennis_matches (Sackmann) pour
 * DÉCIDER si Age.30/Age.int améliorent la calibration. Aucune donnée Sackmann
 * n'est shippée — sortie = métriques Brier + verdict. Si gain confirmé, la
 * feature produit utilise la source légale BSD DOB (déjà câblée serveur).
 *
 * Modèle : régression logistique (gradient descent zero-dep), features en
 * différence p1−p2 standardisées. Baseline = [d_rank, d_lpoints, d_elo].
 * Enhanced = baseline + [d_age30, d_ageint]. Validation = expanding window
 * par année (train < Y, test = Y). Métriques : Brier ↓, LogLoss ↓, Classif ↑.
 *
 *   node tools/backtest-age-features-brier.js [--tour=ATP] [--db=pariscore.db]
 */
'use strict';
const path = require('path');
const Database = require('better-sqlite3');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true];
}));
const TOUR = (args.tour || 'ATP').toUpperCase();
const DB_PATH = args.db || path.join(__dirname, '..', 'pariscore.db');
const LEVEL = 'G'; // Grand Slam (protocole paper)

const db = new Database(DB_PATH, { readonly: true });

// ── 1. Elo incrémental sur TOUS les matchs du circuit (chronologique) ────────
// Snapshot pré-match pour les matchs GS uniquement.
const K = 32, ELO_BASE = 1500;
function expected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }

const allRows = db.prepare(`
  SELECT winner_name, loser_name, winner_age, loser_age,
         winner_rank, loser_rank, winner_rank_points, loser_rank_points,
         tourney_date, tourney_level, match_num
  FROM tennis_matches
  WHERE tour = ? AND winner_name IS NOT NULL AND loser_name IS NOT NULL
  ORDER BY tourney_date ASC, match_num ASC
`).all(TOUR);

const elo = new Map();
const getElo = (n) => elo.has(n) ? elo.get(n) : ELO_BASE;

// ── 2. Construit le dataset GS avec features + label orienté p1/p2 ───────────
// Orientation déterministe (hash parité) pour éviter le leak "winner=1".
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

const samples = [];
for (const r of allRows) {
  const eW = getElo(r.winner_name), eL = getElo(r.loser_name);
  // Capture features AVANT update Elo, uniquement matchs GS complets.
  const isGS = r.tourney_level === LEVEL;
  const complete = r.winner_age != null && r.loser_age != null
    && r.winner_rank != null && r.loser_rank != null
    && r.winner_rank_points != null && r.loser_rank_points != null;
  if (isGS && complete) {
    const year = Math.floor(r.tourney_date / 10000);
    const p1IsWinner = (hash(r.winner_name + '|' + r.loser_name + '|' + r.tourney_date) & 1) === 0;
    const W = { age: r.winner_age, rank: r.winner_rank, pts: r.winner_rank_points, elo: eW };
    const L = { age: r.loser_age, rank: r.loser_rank, pts: r.loser_rank_points, elo: eL };
    const p1 = p1IsWinner ? W : L, p2 = p1IsWinner ? L : W;
    const age30 = (a) => Math.abs(a - 30);
    const ageint = (a) => a < 28 ? 28 - a : a > 32 ? a - 32 : 0;
    const lpts = (x) => Math.log(Math.max(1, x)); // points très skewés → log
    samples.push({
      year,
      y: p1IsWinner ? 1 : 0,
      f: {
        d_rank:   p2.rank - p1.rank,          // rang bas = fort → (p2−p1) positif si p1 mieux classé
        d_lpoints: lpts(p1.pts) - lpts(p2.pts),
        d_elo:    p1.elo - p2.elo,
        d_age30:  age30(p2.age) - age30(p1.age),   // convention paper J2−J1 (p1 avantagé si plus proche pic)
        d_ageint: ageint(p2.age) - ageint(p1.age),
      },
    });
  }
  // Update Elo (ordre réel winner/loser, indépendant de l'orientation p1/p2)
  const eup = expected(eW, eL);
  elo.set(r.winner_name, eW + K * (1 - eup));
  elo.set(r.loser_name, eL + K * (0 - (1 - eup)));
}

if (!samples.length) { console.error('Aucun échantillon GS complet.'); process.exit(1); }
const years = [...new Set(samples.map(s => s.year))].sort();
console.log(`Dataset : ${samples.length} matchs ${TOUR} Grand Slam, années ${years[0]}–${years[years.length - 1]}`);
console.log(`Label balance p1-win : ${(samples.reduce((a, s) => a + s.y, 0) / samples.length * 100).toFixed(1)}%`);

// ── 3. Régression logistique (gradient descent, L2) ──────────────────────────
function standardize(rows, keys, stats) {
  // stats fournis (train) sinon calcule
  const st = stats || {};
  if (!stats) for (const k of keys) {
    const vals = rows.map(r => r.f[k]);
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / vals.length) || 1;
    st[k] = { mu, sd };
  }
  const X = rows.map(r => keys.map(k => (r.f[k] - st[k].mu) / st[k].sd));
  return { X, st };
}
function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
function trainLogistic(X, y, { iters = 3000, lr = 0.15, l2 = 1e-3 } = {}) {
  const n = X.length, d = X[0].length;
  let w = new Array(d).fill(0), b = 0;
  for (let it = 0; it < iters; it++) {
    const gw = new Array(d).fill(0); let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b; for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const p = sigmoid(z), err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * X[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
  }
  return { w, b };
}
function predict(model, X) {
  return X.map(row => { let z = model.b; for (let j = 0; j < row.length; j++) z += model.w[j] * row[j]; return sigmoid(z); });
}
function metrics(probs, y) {
  const n = y.length;
  let brier = 0, ll = 0, correct = 0;
  for (let i = 0; i < n; i++) {
    brier += (probs[i] - y[i]) ** 2;
    const p = Math.min(1 - 1e-12, Math.max(1e-12, probs[i]));
    ll += y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p);
    if ((probs[i] >= 0.5 ? 1 : 0) === y[i]) correct++;
  }
  return { brier: brier / n, logloss: -ll / n, classif: correct / n, n };
}

// ── 4. Expanding window par année ────────────────────────────────────────────
const BASE_KEYS = ['d_rank', 'd_lpoints', 'd_elo'];
const ENH_KEYS = [...BASE_KEYS, 'd_age30', 'd_ageint'];
const MIN_TRAIN_YEARS = 1; // train requiert ≥1 année antérieure

function runVariant(keys, testYear) {
  const train = samples.filter(s => s.year < testYear);
  const test = samples.filter(s => s.year === testYear);
  if (train.length < 100 || !test.length) return null;
  const tr = standardize(train, keys);
  const model = trainLogistic(tr.X, train.map(s => s.y));
  const te = standardize(test, keys, tr.st);
  return metrics(predict(model, te.X), test.map(s => s.y));
}

const testYears = years.filter((_, i) => i >= MIN_TRAIN_YEARS);
const agg = { base: [], enh: [] };
console.log('\n── Expanding window (train < année, test = année) ──');
console.log('année |   n  | Brier base | Brier +age |  ΔBrier  | Classif base→+age');
for (const ty of testYears) {
  const b = runVariant(BASE_KEYS, ty), e = runVariant(ENH_KEYS, ty);
  if (!b || !e) continue;
  agg.base.push(b); agg.enh.push(e);
  const dB = e.brier - b.brier;
  console.log(`${ty}  | ${String(b.n).padStart(4)} |   ${b.brier.toFixed(4)}   |   ${e.brier.toFixed(4)}   | ${(dB >= 0 ? '+' : '') + dB.toFixed(4)} | ${(b.classif * 100).toFixed(1)}% → ${(e.classif * 100).toFixed(1)}%`);
}

function mean(arr, k) { return arr.reduce((a, m) => a + m[k], 0) / arr.length; }
if (agg.base.length) {
  const bB = mean(agg.base, 'brier'), eB = mean(agg.enh, 'brier');
  const bL = mean(agg.base, 'logloss'), eL = mean(agg.enh, 'logloss');
  const bC = mean(agg.base, 'classif'), eC = mean(agg.enh, 'classif');
  console.log('\n── Moyenne sur fenêtres ──');
  console.log(`Brier    baseline=${bB.toFixed(4)}  +age=${eB.toFixed(4)}  Δ=${(eB - bB >= 0 ? '+' : '') + (eB - bB).toFixed(4)}  (${eB < bB ? 'AGE AIDE' : 'pas de gain'})`);
  console.log(`LogLoss  baseline=${bL.toFixed(4)}  +age=${eL.toFixed(4)}  Δ=${(eL - bL >= 0 ? '+' : '') + (eL - bL).toFixed(4)}`);
  console.log(`Classif  baseline=${(bC * 100).toFixed(1)}%  +age=${(eC * 100).toFixed(1)}%`);
  const gain = bB - eB;
  console.log('\nVERDICT : ' + (gain > 0.0005
    ? `Age features réduisent le Brier de ${(gain).toFixed(4)} → GO wire dans bayesianBlend (bd c0li Phase 3).`
    : gain < -0.0005
      ? 'Age features dégradent le Brier → NO-GO, ne pas câbler dans le blend.'
      : 'Effet négligeable (|Δ|<0.0005) → NO-GO net, garder exposé/UI seulement.'));
}
db.close();
