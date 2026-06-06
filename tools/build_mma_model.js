'use strict';
/**
 * build_mma_model.js — OFFLINE one-time build of PariScore's own MMA win model.
 *
 * Implements the KTH 2024 thesis method (logistic regression, 4 features:
 * striking effectiveness + control %, fighter vs opponent, rolling avg of last-5
 * fights). Reads the Greco1899 ufcstats export (GPL-v3 — kept local, NEVER
 * committed; only the DERIVED model + per-fighter feature snapshot are emitted).
 *
 * Inputs  (.context/_mma_data/, gitignored):
 *   ufc_fight_stats.csv   per fighter per round (SIG.STR. "x of y", CTRL "m:ss")
 *   ufc_fight_results.csv per bout (OUTCOME W/L, BOUT "A vs. B", ROUND, TIME)
 *   ufc_event_details.csv per event (DATE)
 * Outputs (committed — own derived facts, not the GPL CSV):
 *   services/mma_model.json            trained logistic weights
 *   services/mma_fighter_features.json slug -> latest rolling-5 features (runtime)
 *
 * Run:  node tools/build_mma_model.js
 */

const fs   = require('fs');
const path = require('path');
const ml   = require('../services/mmaService'); // for fighterSlug (consistency w/ runtime)
const logit = require('../services/mlLogistic');

const DATA = path.join(__dirname, '..', '.context', '_mma_data');
const OUT_MODEL = path.join(__dirname, '..', 'services', 'mma_model.json');
const OUT_FEATS = path.join(__dirname, '..', 'services', 'mma_fighter_features.json');

// ── tiny quote-aware CSV parser ──
function parseCSV(text) {
  const rows = []; let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function toObjects(rows) {
  const hdr = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.length >= hdr.length).map(r => {
    const o = {}; hdr.forEach((h, i) => o[h] = (r[i] || '').trim()); return o;
  });
}
function toSec(mmss) { const m = String(mmss || '').match(/(\d+):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : 0; }
function parseOf(s) { const m = String(s || '').match(/(\d+)\s*of\s*(\d+)/i); return m ? { l: +m[1], a: +m[2] } : { l: 0, a: 0 }; }
function key(ev, bout) { return ev.trim() + '||' + bout.trim(); }

console.log('[build] reading CSVs…');
const events  = toObjects(parseCSV(fs.readFileSync(path.join(DATA, 'ufc_event_details.csv'), 'utf8')));
const results = toObjects(parseCSV(fs.readFileSync(path.join(DATA, 'ufc_fight_results.csv'), 'utf8')));
const stats   = toObjects(parseCSV(fs.readFileSync(path.join(DATA, 'ufc_fight_stats.csv'), 'utf8')));
let tott = []; try { tott = toObjects(parseCSV(fs.readFileSync(path.join(DATA, 'ufc_fighter_tott.csv'), 'utf8'))); } catch (_) {}

// Tale-of-the-tape: reach/height (inches) + DOB (epoch) per fighter — the thesis'
// explicit "future work" (reach known to matter, omitted there).
function parseHeight(h) { const m = String(h || '').match(/(\d+)'\s*(\d+)/); return m ? (+m[1]) * 12 + (+m[2]) : null; }
function parseReach(r) { if (String(r || '').indexOf('--') >= 0) return null; const m = String(r).match(/([\d.]+)/); return m ? +m[1] : null; }
function parseDOB(d) { const t = Date.parse(d); return isNaN(t) ? null : t; }
const tottMap = {};
for (const t of tott) { const f = (t.FIGHTER || '').trim(); if (f) tottMap[f] = { height: parseHeight(t.HEIGHT), reach: parseReach(t.REACH), dob: parseDOB(t.DOB) }; }
const YEAR = 365.25 * 864e5;
function ageAt(dob, when) { return dob ? (when - dob) / YEAR : null; }
function diff(a, b) { return (a != null && b != null) ? a - b : 0; }

// event -> epoch date
const eventDate = {};
for (const e of events) { const t = Date.parse(e.DATE); if (!isNaN(t)) eventDate[e.EVENT.trim()] = t; }

// aggregate per (event,bout,fighter): sum sig_str landed/attempted + ctrl over rounds
const agg = {}; // key -> { fighterName -> {l,a,ctrl} }
for (const s of stats) {
  const k = key(s.EVENT, s.BOUT), f = (s.FIGHTER || '').trim();
  if (!f) continue;
  const ss = parseOf(s['SIG.STR.']); const td = parseOf(s.TD);
  (agg[k] = agg[k] || {});
  const cur = (agg[k][f] = agg[k][f] || { l: 0, a: 0, ctrl: 0, td: 0, kd: 0 });
  cur.l += ss.l; cur.a += ss.a; cur.ctrl += toSec(s.CTRL); cur.td += td.l; cur.kd += (parseInt(s.KD, 10) || 0);
}

// build per-fighter chronological fight list with the per-fight raw stats + outcome
const hist = {}; // fighterName -> [{date, strk, ctrl, won}]
let usedFights = 0;
for (const r of results) {
  const ev = r.EVENT.trim(), bout = r.BOUT.trim();
  const date = eventDate[ev]; if (!date) continue;
  const parts = bout.split(/\s+vs\.?\s+/i); if (parts.length !== 2) continue;
  const A = parts[0].trim(), B = parts[1].trim();
  const out = (r.OUTCOME || '').toUpperCase().replace(/\s/g, '');
  let aWon; if (out === 'W/L') aWon = 1; else if (out === 'L/W') aWon = 0; else continue; // skip draw/NC
  const dur = Math.max(1, (parseInt(r.ROUND, 10) - 1 || 0) * 300 + toSec(r.TIME));
  const k = key(ev, bout); const ag = agg[k]; if (!ag || !ag[A] || !ag[B]) continue;
  const featOf = (st) => ({ strk: (st.a ? st.l / st.a : 0) * (st.l / dur), ctrl: st.ctrl / dur, td: st.td / dur, kd: st.kd / dur });
  const fa = featOf(ag[A]), fb = featOf(ag[B]);
  (hist[A] = hist[A] || []).push({ date, strk: fa.strk, ctrl: fa.ctrl, td: fa.td, kd: fa.kd, won: aWon });
  (hist[B] = hist[B] || []).push({ date, strk: fb.strk, ctrl: fb.ctrl, td: fb.td, kd: fb.kd, won: 1 - aWon });
  usedFights++;
}
for (const f in hist) hist[f].sort((x, y) => x.date - y.date);
console.log(`[build] ${usedFights} decisive fights, ${Object.keys(hist).length} fighters`);

// rolling-5 average of a fighter's fights strictly BEFORE index idx
const MINH = 3, WINDOW = 5;
function rolling(list, idx) {
  const past = list.slice(Math.max(0, idx - WINDOW), idx);
  if (past.length < MINH) return null;
  let sw = 0, s = 0, c = 0, t = 0, k = 0;
  past.forEach((p, i) => { const w = i + 1; sw += w; s += w * p.strk; c += w * p.ctrl; t += w * p.td; k += w * p.kd; }); // recency-weighted
  return { strk: s / sw, ctrl: c / sw, td: t / sw, kd: k / sw };
}

// training set: each fight where BOTH fighters have >= MINH prior fights
const samples = []; // {date, x:[a.strk,b.strk,a.ctrl,b.ctrl], y}
for (const r of results) {
  const ev = r.EVENT.trim(), bout = r.BOUT.trim(); const date = eventDate[ev]; if (!date) continue;
  const parts = bout.split(/\s+vs\.?\s+/i); if (parts.length !== 2) continue;
  const A = parts[0].trim(), B = parts[1].trim();
  const out = (r.OUTCOME || '').toUpperCase().replace(/\s/g, '');
  let aWon; if (out === 'W/L') aWon = 1; else if (out === 'L/W') aWon = 0; else continue;
  const ha = hist[A], hb = hist[B]; if (!ha || !hb) continue;
  const ia = ha.findIndex(p => p.date === date && Math.abs(p.won - aWon) < 0.5);
  const ib = hb.findIndex(p => p.date === date && Math.abs(p.won - (1 - aWon)) < 0.5);
  if (ia < 0 || ib < 0) continue;
  const ra = rolling(ha, ia), rb = rolling(hb, ib); if (!ra || !rb) continue;
  const ta = tottMap[A] || {}, tb = tottMap[B] || {};
  samples.push({ date, x: [ra.strk, rb.strk, ra.ctrl, rb.ctrl, ra.td, rb.td, ra.kd, rb.kd,
    diff(ta.reach, tb.reach), diff(ta.height, tb.height), diff(ageAt(ta.dob, date), ageAt(tb.dob, date))], y: aWon });
}
samples.sort((a, b) => a.date - b.date);
console.log(`[build] ${samples.length} training samples (both fighters >= ${MINH} prior fights)`);

// time-split: train older 85%, test newest 15% (out-of-sample forecasting, like the thesis)
const split = Math.floor(samples.length * 0.85);
const trX = samples.slice(0, split).map(s => s.x), trY = samples.slice(0, split).map(s => s.y);
const teX = samples.slice(split).map(s => s.x), teY = samples.slice(split).map(s => s.y);

const model = logit.train(trX, trY, { lr: 0.2, epochs: 6000, l2: 0.02 });
const trAcc = logit.accuracy(model, trX, trY), teAcc = logit.accuracy(model, teX, teY);
const teLL = logit.logLoss(model, teX, teY);
console.log(`[build] train acc ${(trAcc * 100).toFixed(1)}% | TEST acc ${(teAcc * 100).toFixed(1)}% | test logloss ${teLL.toFixed(3)}`);
console.log(`[build] weights ${model.weights.map(w => w.toFixed(3))} bias ${model.bias.toFixed(3)}`);

// per-fighter latest rolling-5 snapshot (for runtime prediction of upcoming fights)
const feats = {};
for (const f in hist) {
  const list = hist[f]; if (list.length < MINH) continue;
  const last = list.slice(Math.max(0, list.length - WINDOW));
  let sw = 0, s = 0, c = 0, t = 0, k = 0; last.forEach((p, i) => { const w = i + 1; sw += w; s += w * p.strk; c += w * p.ctrl; t += w * p.td; k += w * p.kd; });
  const rnd = v => Math.round(v / sw * 1e6) / 1e6;
  const tt = tottMap[f] || {};
  feats[ml.fighterSlug(f)] = { strk: rnd(s), ctrl: rnd(c), td: rnd(t), kd: rnd(k), reach: tt.reach || null, height: tt.height || null, dob: tt.dob || null, n: list.length };
}

fs.writeFileSync(OUT_MODEL, JSON.stringify({
  weights: model.weights, bias: model.bias, mean: model.mean, std: model.std,
  features: ['fighter_strike_eff', 'opp_strike_eff', 'fighter_ctrl_pct', 'opp_ctrl_pct', 'fighter_td_rate', 'opp_td_rate', 'fighter_kd_rate', 'opp_kd_rate', 'reach_diff', 'height_diff', 'age_diff'],
  test_accuracy: Math.round(teAcc * 1000) / 1000, train_accuracy: Math.round(trAcc * 1000) / 1000,
  n_train: trX.length, n_test: teX.length, window: WINDOW, min_history: MINH,
  source: 'KTH 2024 thesis method; ufcstats facts via Greco1899', built_from_fights: usedFights,
}, null, 2));
fs.writeFileSync(OUT_FEATS, JSON.stringify(feats));
console.log(`[build] wrote ${OUT_MODEL} + ${OUT_FEATS} (${Object.keys(feats).length} fighters)`);
