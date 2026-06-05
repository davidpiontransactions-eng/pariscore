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
    const lpts = (x) => Math.log(Math.max(1, x)); // points très skewés → log
    samples.push({
      year,
      y: p1IsWinner ? 1 : 0,
      p1age: p1.age, p2age: p2.age,             // âges bruts → features dérivées par variante
      f: {
        d_rank:   p2.rank - p1.rank,            // rang bas = fort → (p2−p1) positif si p1 mieux classé
        d_lpoints: lpts(p1.pts) - lpts(p2.pts),
        d_elo:    p1.elo - p2.elo,
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

// ── 4. Features dérivées par variante (peak recalibré par circuit) ───────────
const peakdist = (a, peak) => Math.abs(a - peak);
const intdist = (a, lo, hi) => a < lo ? lo - a : a > hi ? a - hi : 0;
const C = 28; // centrage âge pour la variante quadratique (stabilité GD)

// featurize : retourne un objet f selon la variante. peak = pic recalibré.
function featurize(s, variant, peak) {
  const f = { d_rank: s.f.d_rank, d_lpoints: s.f.d_lpoints, d_elo: s.f.d_elo };
  if (variant === 'base') return f;
  if (variant === 'fixed30') {            // paper : pic fixe 30, intervalle [28,32]
    f.d_agepk = peakdist(s.p2age, 30) - peakdist(s.p1age, 30);
    f.d_ageint = intdist(s.p2age, 28, 32) - intdist(s.p1age, 28, 32);
  } else if (variant === 'recal') {       // pic recalibré + intervalle [pic-2, pic+2]
    f.d_agepk = peakdist(s.p2age, peak) - peakdist(s.p1age, peak);
    f.d_ageint = intdist(s.p2age, peak - 2, peak + 2) - intdist(s.p1age, peak - 2, peak + 2);
  } else if (variant === 'quad') {        // âge libre : modèle trouve l'optimum (âge + âge²)
    const a1 = s.p1age - C, a2 = s.p2age - C;
    f.d_age = a1 - a2;
    f.d_age2 = a1 * a1 - a2 * a2;
  }
  return f;
}
function keysOf(variant) {
  if (variant === 'base') return ['d_rank', 'd_lpoints', 'd_elo'];
  if (variant === 'quad') return ['d_rank', 'd_lpoints', 'd_elo', 'd_age', 'd_age2'];
  return ['d_rank', 'd_lpoints', 'd_elo', 'd_agepk', 'd_ageint'];
}
function featurizeRows(rows, variant, peak) {
  return rows.map(s => ({ y: s.y, year: s.year, f: featurize(s, variant, peak) }));
}

// ── 5. Dérivation du pic d'âge par circuit (grid search in-sample logloss) ────
// Sur le dataset complet : pour chaque pic candidat, on ajoute |age-pic| (diff)
// au modèle base et on garde le pic minimisant la logloss. Estimation coarse
// d'hyperparamètre (recherche, pas de prod).
function derivePeak(rows) {
  let best = { peak: 30, ll: Infinity };
  for (let peak = 18; peak <= 36; peak += 0.5) {
    const fr = rows.map(s => ({ y: s.y, f: {
      d_rank: s.f.d_rank, d_lpoints: s.f.d_lpoints, d_elo: s.f.d_elo,
      d_agepk: peakdist(s.p2age, peak) - peakdist(s.p1age, peak),
    } }));
    const keys = ['d_rank', 'd_lpoints', 'd_elo', 'd_agepk'];
    const tr = standardize(fr, keys);
    const model = trainLogistic(tr.X, fr.map(r => r.y), { iters: 900, lr: 0.2 });
    const m = metrics(predict(model, tr.X), fr.map(r => r.y));
    if (m.logloss < best.ll) best = { peak, ll: m.logloss };
  }
  return best.peak;
}
const PEAK = derivePeak(samples);
console.log(`\nPic d'âge recalibré (data-driven, ${TOUR}) : ${PEAK} ans  (paper fixe = 30)`);

// ── 6. Expanding window — comparaison 4 variantes ────────────────────────────
const VARIANTS = ['base', 'fixed30', 'recal', 'quad'];
const MIN_TRAIN_YEARS = 1;
function runVariant(variant, testYear) {
  const train = featurizeRows(samples.filter(s => s.year < testYear), variant, PEAK);
  const test = featurizeRows(samples.filter(s => s.year === testYear), variant, PEAK);
  if (train.length < 100 || !test.length) return null;
  const keys = keysOf(variant);
  const tr = standardize(train, keys);
  const model = trainLogistic(tr.X, train.map(r => r.y));
  const te = standardize(test, keys, tr.st);
  return metrics(predict(model, te.X), test.map(r => r.y));
}

const testYears = years.filter((_, i) => i >= MIN_TRAIN_YEARS);
const agg = Object.fromEntries(VARIANTS.map(v => [v, []]));
console.log('\n── Expanding window — Brier par variante ──');
console.log('année |   n  |  base  | fixed30 | recal@' + PEAK + ' |  quad  ');
for (const ty of testYears) {
  const r = Object.fromEntries(VARIANTS.map(v => [v, runVariant(v, ty)]));
  if (!r.base) continue;
  for (const v of VARIANTS) if (r[v]) agg[v].push(r[v]);
  console.log(`${ty}  | ${String(r.base.n).padStart(4)} | ${r.base.brier.toFixed(4)} | ${r.fixed30.brier.toFixed(4)}  | ${r.recal.brier.toFixed(4)}   | ${r.quad.brier.toFixed(4)}`);
}

function mean(arr, k) { return arr.reduce((a, m) => a + m[k], 0) / arr.length; }
console.log('\n── Moyenne sur fenêtres (vs baseline) ──');
const bB = mean(agg.base, 'brier'), bL = mean(agg.base, 'logloss'), bC = mean(agg.base, 'classif');
console.log(`baseline   Brier=${bB.toFixed(4)}  LogLoss=${bL.toFixed(4)}  Classif=${(bC * 100).toFixed(1)}%`);
let bestVar = 'base', bestGain = 0;
for (const v of VARIANTS.slice(1)) {
  const vB = mean(agg[v], 'brier'), vL = mean(agg[v], 'logloss'), vC = mean(agg[v], 'classif');
  const dB = vB - bB;
  console.log(`${v.padEnd(10)} Brier=${vB.toFixed(4)}  ΔBrier=${(dB >= 0 ? '+' : '') + dB.toFixed(4)}  LogLoss=${vL.toFixed(4)}  Classif=${(vC * 100).toFixed(1)}%`);
  if (bB - vB > bestGain) { bestGain = bB - vB; bestVar = v; }
}
console.log('\nVERDICT : ' + (bestGain > 0.0010
  ? `Variante "${bestVar}" réduit le Brier de ${bestGain.toFixed(4)} (>0.001) → candidat GO blend (re-valider sur l'autre circuit).`
  : bestGain > 0.0005
    ? `Meilleure variante "${bestVar}" gain ${bestGain.toFixed(4)} — marginal, GO prudent sous réserve cohérence ATP+WTA.`
    : 'Aucune variante ne dépasse +0.0005 Brier → NO-GO blend, garder exposé/UI.'));
db.close();
