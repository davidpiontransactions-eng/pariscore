#!/usr/bin/env node
/**
 * Backtest Brier A/B — latéralité (hand matchup) gaucher/droitier.
 * Increment #1 article SPW/RPW (sportbotai). bd c0li-adjacent.
 *
 * USAGE INTERNE / RECHERCHE. Lit tennis_matches (Sackmann) pour DÉCIDER si la
 * latéralité améliore la calibration avant câblage dans l'ajustement SPW/RPW
 * du moteur (computeTennisMatchProb consumers). Rien shippé.
 *
 * Hypothèse tennis : un gaucher a un edge face à un droitier (service côté ad,
 * effet de balle inhabituel). Features testées (diff p1−p2) :
 *   lefty_adv : avantage gaucher-vs-droitier orienté
 *   lefty_raw : être gaucher (indépendant de l'adversaire)
 *
 *   node tools/backtest-hand-matchup-brier.js [--tour=ATP|WTA] [--db=pariscore.db]
 */
'use strict';
const path = require('path');
const Database = require('better-sqlite3');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true];
}));
const TOUR = (args.tour || 'ATP').toUpperCase();
const DB_PATH = args.db || path.join(__dirname, '..', 'pariscore.db');
const db = new Database(DB_PATH, { readonly: true });

// ── Elo incrémental + dataset GS ─────────────────────────────────────────────
const K = 32, ELO_BASE = 1500;
const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
const elo = new Map();
const getElo = (n) => elo.has(n) ? elo.get(n) : ELO_BASE;
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
const lpts = (x) => Math.log(Math.max(1, x));

const rows = db.prepare(`
  SELECT winner_name, loser_name, winner_rank, loser_rank,
         winner_rank_points, loser_rank_points, winner_hand, loser_hand,
         tourney_date, tourney_level, match_num
  FROM tennis_matches
  WHERE tour = ? AND winner_name IS NOT NULL AND loser_name IS NOT NULL
  ORDER BY tourney_date ASC, match_num ASC
`).all(TOUR);

const samples = [];
for (const r of rows) {
  const eW = getElo(r.winner_name), eL = getElo(r.loser_name);
  const isGS = r.tourney_level === 'G';
  const complete = r.winner_rank != null && r.loser_rank != null
    && r.winner_rank_points != null && r.loser_rank_points != null
    && (r.winner_hand === 'R' || r.winner_hand === 'L')
    && (r.loser_hand === 'R' || r.loser_hand === 'L');
  if (isGS && complete) {
    const year = Math.floor(r.tourney_date / 10000);
    const p1IsWinner = (hash(r.winner_name + '|' + r.loser_name + '|' + r.tourney_date) & 1) === 0;
    const W = { rank: r.winner_rank, pts: r.winner_rank_points, elo: eW, hand: r.winner_hand };
    const L = { rank: r.loser_rank, pts: r.loser_rank_points, elo: eL, hand: r.loser_hand };
    const p1 = p1IsWinner ? W : L, p2 = p1IsWinner ? L : W;
    samples.push({ year, y: p1IsWinner ? 1 : 0, p1, p2 });
  }
  const eup = expected(eW, eL);
  elo.set(r.winner_name, eW + K * (1 - eup));
  elo.set(r.loser_name, eL + K * (0 - (1 - eup)));
}
if (!samples.length) { console.error('Aucun échantillon.'); process.exit(1); }
const years = [...new Set(samples.map(s => s.year))].sort();
const leftyShare = samples.reduce((a, s) => a + ((s.p1.hand === 'L') + (s.p2.hand === 'L')), 0) / (samples.length * 2);
console.log(`Dataset : ${samples.length} matchs ${TOUR} GS ${years[0]}–${years[years.length - 1]} · gauchers ${(leftyShare * 100).toFixed(1)}%`);

// ── Logistique (GD, L2) ──────────────────────────────────────────────────────
function standardize(rows, keys, stats) {
  const st = stats || {};
  if (!stats) for (const k of keys) {
    const v = rows.map(r => r.f[k]);
    const mu = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) || 1;
    st[k] = { mu, sd };
  }
  return { X: rows.map(r => keys.map(k => (r.f[k] - st[k].mu) / st[k].sd)), st };
}
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
function trainLogistic(X, y, { iters = 3000, lr = 0.15, l2 = 1e-3 } = {}) {
  const n = X.length, d = X[0].length; let w = new Array(d).fill(0), b = 0;
  for (let it = 0; it < iters; it++) {
    const gw = new Array(d).fill(0); let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b; for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const e = sigmoid(z) - y[i];
      for (let j = 0; j < d; j++) gw[j] += e * X[i][j]; gb += e;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]); b -= lr * (gb / n);
  }
  return { w, b };
}
const predict = (m, X) => X.map(row => { let z = m.b; for (let j = 0; j < row.length; j++) z += m.w[j] * row[j]; return sigmoid(z); });
function metrics(p, y) {
  let br = 0, ll = 0, c = 0;
  for (let i = 0; i < y.length; i++) {
    br += (p[i] - y[i]) ** 2;
    const q = Math.min(1 - 1e-12, Math.max(1e-12, p[i]));
    ll += y[i] * Math.log(q) + (1 - y[i]) * Math.log(1 - q);
    if ((p[i] >= 0.5 ? 1 : 0) === y[i]) c++;
  }
  return { brier: br / y.length, logloss: -ll / y.length, classif: c / y.length, n: y.length };
}

// ── Features par variante ────────────────────────────────────────────────────
function featurize(s, variant) {
  const f = {
    d_rank: s.p2.rank - s.p1.rank,
    d_lpoints: lpts(s.p1.pts) - lpts(s.p2.pts),
    d_elo: s.p1.elo - s.p2.elo,
  };
  const p1L = s.p1.hand === 'L', p2L = s.p2.hand === 'L';
  if (variant === 'lefty_adv') {
    f.d_hand = ((p1L && !p2L) ? 1 : 0) - ((p2L && !p1L) ? 1 : 0); // gaucher vs droitier orienté
  } else if (variant === 'lefty_raw') {
    f.d_hand = (p1L ? 1 : 0) - (p2L ? 1 : 0);
  }
  return f;
}
const keysOf = (v) => v === 'base' ? ['d_rank', 'd_lpoints', 'd_elo'] : ['d_rank', 'd_lpoints', 'd_elo', 'd_hand'];
const frows = (arr, v) => arr.map(s => ({ y: s.y, f: featurize(s, v) }));

// ── Expanding window ─────────────────────────────────────────────────────────
const VARIANTS = ['base', 'lefty_adv', 'lefty_raw'];
function run(v, ty) {
  const tr0 = samples.filter(s => s.year < ty), te0 = samples.filter(s => s.year === ty);
  if (tr0.length < 100 || !te0.length) return null;
  const keys = keysOf(v);
  const tr = standardize(frows(tr0, v), keys);
  const model = trainLogistic(tr.X, tr0.map(s => s.y));
  const te = standardize(frows(te0, v), keys, tr.st);
  return metrics(predict(model, te.X), te0.map(s => s.y));
}
const testYears = years.slice(1);
const agg = Object.fromEntries(VARIANTS.map(v => [v, []]));
console.log('\n── Expanding window — Brier ──');
console.log('année |   n  |  base  | lefty_adv | lefty_raw');
for (const ty of testYears) {
  const r = Object.fromEntries(VARIANTS.map(v => [v, run(v, ty)]));
  if (!r.base) continue;
  for (const v of VARIANTS) if (r[v]) agg[v].push(r[v]);
  console.log(`${ty}  | ${String(r.base.n).padStart(4)} | ${r.base.brier.toFixed(4)} | ${r.lefty_adv.brier.toFixed(4)}    | ${r.lefty_raw.brier.toFixed(4)}`);
}
const mean = (a, k) => a.reduce((x, m) => x + m[k], 0) / a.length;
console.log('\n── Moyenne (vs baseline) ──');
const bB = mean(agg.base, 'brier'), bL = mean(agg.base, 'logloss'), bC = mean(agg.base, 'classif');
console.log(`baseline    Brier=${bB.toFixed(4)}  LogLoss=${bL.toFixed(4)}  Classif=${(bC * 100).toFixed(1)}%`);
let best = 'base', gain = 0;
for (const v of VARIANTS.slice(1)) {
  const vB = mean(agg[v], 'brier'), vL = mean(agg[v], 'logloss'), vC = mean(agg[v], 'classif');
  console.log(`${v.padEnd(11)} Brier=${vB.toFixed(4)}  ΔBrier=${(vB - bB >= 0 ? '+' : '') + (vB - bB).toFixed(4)}  LogLoss=${vL.toFixed(4)}  Classif=${(vC * 100).toFixed(1)}%`);
  if (bB - vB > gain) { gain = bB - vB; best = v; }
}
console.log('\nVERDICT : ' + (gain > 0.0010
  ? `"${best}" réduit Brier de ${gain.toFixed(4)} (>0.001) → GO wire ajustement SPW/RPW (re-valider ATP+WTA).`
  : gain > 0.0005
    ? `"${best}" gain ${gain.toFixed(4)} marginal → GO prudent sous cohérence ATP+WTA.`
    : 'Aucune variante > +0.0005 Brier → NO-GO, latéralité non prédictive ici.'));
db.close();
