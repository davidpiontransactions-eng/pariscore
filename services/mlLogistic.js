'use strict';
/**
 * mlLogistic.js — Zero-dependency logistic regression (pure JS, no libs).
 *
 * Implements the core method of the KTH 2024 thesis "Predicting UFC matches
 * using regression models" (Apelgren & Eklund): a logistic model over a small
 * set of standardized features, trained by gradient descent with L2
 * regularization (the thesis hit convergence trouble with too many raw vars —
 * standardization + L2 + few features fixes that).
 *
 * Generic by design: any vertical can train a win model from a feature matrix.
 * PariScore MMA uses it with the thesis' 4 features (striking effectiveness +
 * control %, fighter vs opponent); NBA/others can reuse it.
 *
 * Model object is plain JSON ({ weights, bias, mean, std, meta }) so it
 * serializes straight into SQLite / api_cache and reloads with zero deps.
 */

function sigmoid(z) {
  // Numerically stable logistic.
  if (z >= 0) { const e = Math.exp(-z); return 1 / (1 + e); }
  const e = Math.exp(z); return e / (1 + e);
}

// Column-wise z-score parameters. std floored to 1 to avoid divide-by-zero on
// constant columns (those columns then contribute nothing, which is correct).
function fitStandardizer(X) {
  const n = X.length, d = X[0].length;
  const mean = new Array(d).fill(0), std = new Array(d).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) mean[j] += X[i][j];
  for (let j = 0; j < d; j++) mean[j] /= n;
  for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) { const dv = X[i][j] - mean[j]; std[j] += dv * dv; }
  for (let j = 0; j < d; j++) { std[j] = Math.sqrt(std[j] / n); if (!(std[j] > 1e-9)) std[j] = 1; }
  return { mean, std };
}

function standardizeRow(xRow, mean, std) {
  const out = new Array(xRow.length);
  for (let j = 0; j < xRow.length; j++) out[j] = (xRow[j] - mean[j]) / std[j];
  return out;
}

/**
 * Train a logistic regression model.
 * @param {number[][]} X  feature rows (raw, unstandardized)
 * @param {number[]}   y  binary labels 0/1
 * @param {object} opts   { lr, epochs, l2, tol }
 * @returns {{weights:number[], bias:number, mean:number[], std:number[], meta:object}}
 */
function train(X, y, opts) {
  opts = opts || {};
  const lr = opts.lr != null ? opts.lr : 0.1;
  const epochs = opts.epochs != null ? opts.epochs : 3000;
  const l2 = opts.l2 != null ? opts.l2 : 0.01;
  const tol = opts.tol != null ? opts.tol : 1e-7;
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0])) throw new Error('mlLogistic.train: X must be a non-empty 2D array');
  if (X.length !== y.length) throw new Error('mlLogistic.train: X/y length mismatch');

  const n = X.length, d = X[0].length;
  const { mean, std } = fitStandardizer(X);
  const Xs = X.map(r => standardizeRow(r, mean, std));

  const w = new Array(d).fill(0);
  let b = 0, prevLoss = Infinity;

  for (let ep = 0; ep < epochs; ep++) {
    const gw = new Array(d).fill(0);
    let gb = 0, loss = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Xs[i][j];
      const p = sigmoid(z);
      const err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * Xs[i][j];
      gb += err;
      // clipped log-loss
      const pc = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
      loss += -(y[i] * Math.log(pc) + (1 - y[i]) * Math.log(1 - pc));
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
    loss = loss / n + 0.5 * l2 * w.reduce((s, v) => s + v * v, 0);
    if (Math.abs(prevLoss - loss) < tol) break;
    prevLoss = loss;
  }

  return { weights: w, bias: b, mean, std, meta: { n, d, l2, trainedLoss: Math.round(prevLoss * 1e6) / 1e6 } };
}

/** Predict P(y=1) for one raw feature row using a trained model. */
function predict(model, xRow) {
  if (!model || !model.weights) return null;
  const xs = standardizeRow(xRow, model.mean, model.std);
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) z += model.weights[j] * xs[j];
  return sigmoid(z);
}

/** Evaluation helpers. */
function accuracy(model, X, y) {
  let ok = 0;
  for (let i = 0; i < X.length; i++) if ((predict(model, X[i]) >= 0.5 ? 1 : 0) === y[i]) ok++;
  return ok / X.length;
}
function logLoss(model, X, y) {
  let s = 0;
  for (let i = 0; i < X.length; i++) {
    const p = Math.min(Math.max(predict(model, X[i]), 1e-12), 1 - 1e-12);
    s += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
  }
  return s / X.length;
}

module.exports = { train, predict, accuracy, logLoss, sigmoid, fitStandardizer, standardizeRow };
