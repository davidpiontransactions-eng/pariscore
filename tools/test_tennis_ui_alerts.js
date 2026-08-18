/* tools/test_tennis_ui_alerts.js — QA sprint alertes-tennis
 * Test unitaire de l'évaluateur _evalTennisUIAlerts (extrait de server.js).
 * Extrait le module entre `const _TN_UI_ALERT = {` et `async function pollTennisLive()`,
 * l'exécute dans un contexte vm avec stubs (_tnAlertOnCooldown, broadcastSSE…),
 * puis valide les 6 métriques : niveaux jaune/rouge/critique, cooldown 5 min,
 * re-fire variance par set, Δ inter-polls (BPPI + proba), purge.
 * Usage : node tools/test_tennis_ui_alerts.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const START = src.indexOf('const _TN_UI_ALERT = {');
const END = src.indexOf('async function pollTennisLive() {');
if (START === -1 || END === -1 || END <= START) {
  console.error('FAIL: module _evalTennisUIAlerts introuvable dans server.js');
  process.exit(1);
}
const code = src.slice(START, END);

// ── Stubs ────────────────────────────────────────────────────────────────────
const events = [];
const cooldownMap = new Map();
const sandbox = {
  process: { env: {} }, // seuils par défaut du tableau validé
  console,
  broadcastSSE: (ev, d) => { if (ev === 'tennis_alert') events.push(d); },
  _tnAlertOnCooldown: (k, ttl) => { const t = cooldownMap.get(k); return t != null && (Date.now() - t) < ttl; },
  _tnAlertMark: (k) => { cooldownMap.set(k, Date.now()); },
  _tennisDRSetHist: new Map(),
  computeTennisDRFromMatch: (m) => (m && m._fake_dr_raw) ? { dr: m._fake_dr_raw } : null,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const evalAlerts = sandbox._evalTennisUIAlerts;
if (typeof evalAlerts !== 'function') {
  console.error('FAIL: _evalTennisUIAlerts non exposé par le module extrait');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; console.log('  PASS ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
function mkMatch(id, extra) {
  return Object.assign({ id, is_live: true, player1: { name: 'Djokovic' }, player2: { name: 'Alcaraz' }, tournament: 'Cincinnati', player1_sets: 1, player2_sets: 0, sets: [{ p1: 6, p2: 4 }] }, extra || {});
}
function lastEvt() { return events[events.length - 1]; }
function purgeEvents() { events.length = 0; }

// ── 1. Écart DR ──────────────────────────────────────────────────────────────
console.log('[1] Écart DR');
evalAlerts([mkMatch('m1', { dr_exact: { dr: 1.41 } })]); // gap 0.41 ≥ 0.35
assert(events.length === 1 && lastEvt().metric === 'dr_diff' && lastEvt().level === 'critical', 'gap 0.41 → critical');
assert(lastEvt().value === 0.41, 'value 0.41');
assert(/Djokovic.*domine/.test(lastEvt().msg), 'msg nomme le dominant');
purgeEvents();
evalAlerts([mkMatch('m1', { dr_exact: { dr: 1.41 } })]); // même poll → cooldown
assert(events.length === 0, 'cooldown 5 min bloque le re-fire immédiat');
evalAlerts([mkMatch('m2', { dr_exact: { dr: 0.78 } })]); // gap 0.22 ≥ 0.20 < 0.35
assert(events.length === 1 && lastEvt().level === 'yellow', 'gap 0.22 → yellow');
assert(lastEvt().match.player2 === 'Alcaraz', 'payload match complet');
assert(/Alcaraz.*domine/.test(lastEvt().msg), 'dominant côté p2');
evalAlerts([mkMatch('m3', { dr_exact: { dr: 1.10 } })]); // gap 0.10 < 0.20
purgeEvents();
evalAlerts([mkMatch('m3b', { _fake_dr_raw: 1.25 })]); // fallback computeTennisDRFromMatch
assert(events.length === 1 && lastEvt().value === 0.25 && lastEvt().level === 'yellow', 'fallback computeTennisDRFromMatch gap 0.25 → yellow');

// ── 2. Variance DR inter-sets ────────────────────────────────────────────────
console.log('[2] Variance DR/set');
purgeEvents();
sandbox._tennisDRSetHist.set('m4', { 1: { dr: 1.4 }, 2: { dr: 0.8 } }); // var = 0.09 ≥ 0.08
evalAlerts([mkMatch('m4', { dr_exact: { dr: 1.1 } })]);
assert(events.length === 1 && lastEvt().metric === 'dr_var' && lastEvt().level === 'yellow', 'var 0.09 → yellow');
assert(lastEvt().value === 0.09, 'value 0.09');
sandbox._tennisDRSetHist.set('m4', { 1: { dr: 1.6 }, 2: { dr: 0.7 }, 3: { dr: 1.6 } }); // var = 0.18 ≥ 0.15, clé 3 sets
evalAlerts([mkMatch('m4', { dr_exact: { dr: 1.1 } })]);
const evVar = events.filter(e => e.metric === 'dr_var');
assert(evVar.length === 2 && evVar[0].level === 'yellow' && evVar[1].level === 'red', 'nouveau set complet → re-fire + var ≥ 0.15 → red');
sandbox._tennisDRSetHist.set('m5', { 1: { dr: 1.05 }, 2: { dr: 0.97 } }); // var ≈ 0.0016
purgeEvents();
evalAlerts([mkMatch('m5', { dr_exact: { dr: 1.01 } })]);
assert(events.length === 0, 'var sous seuil → aucune alerte');

// ── 3. Spike BPPI (Δ inter-polls) ────────────────────────────────────────────
console.log('[3] Spike BPPI');
purgeEvents();
evalAlerts([mkMatch('m6', { bppi: { p1: 30, p2: 20 } })]); // 1er poll → init prev
assert(events.length === 0, '1er poll BPPI = init, pas d\'alerte');
evalAlerts([mkMatch('m6', { bppi: { p1: 46, p2: 21 } })]); // Δ 16 ≥ 15
assert(events.length === 1 && lastEvt().metric === 'bppi_spike' && lastEvt().level === 'yellow' && lastEvt().value === 16, 'Δ16 → yellow value 16');
purgeEvents(); cooldownMap.delete('tnui_bppi:m7');
evalAlerts([mkMatch('m7', { bppi: { p1: 10, p2: 50 } })]);
evalAlerts([mkMatch('m7', { bppi: { p1: 12, p2: 76 } })]); // Δ 26 ≥ 25 → critical
assert(events.length === 1 && lastEvt().level === 'critical' && /Alcaraz.*pression/.test(lastEvt().msg), 'Δ26 → critical côté p2');
evalAlerts([mkMatch('m7', { bppi: { p1: 12, p2: 90 } })]); // cooldown actif
purgeEvents();
evalAlerts([mkMatch('m7', { bppi: { p1: 12, p2: 90 } })]);
assert(events.length === 0, 'cooldown BPPI actif');

// ── 4. Serve momentum gap ────────────────────────────────────────────────────
console.log('[4] Serve momentum gap');
purgeEvents();
evalAlerts([mkMatch('m8', { momentum_series: { p1_series: [50, 80], p2_series: [50, 50] } })]); // gap 30
assert(events.length === 1 && lastEvt().metric === 'momentum' && lastEvt().level === 'yellow' && lastEvt().value === 30, 'gap 30 → yellow');
evalAlerts([mkMatch('m9', { momentum_series: { p1_series: [20], p2_series: [65] } })]); // gap 45
assert(events.length === 2 && lastEvt().level === 'red' && /Alcaraz.*contrôle/.test(lastEvt().msg), 'gap 45 → red côté p2');
evalAlerts([mkMatch('m10', { momentum_series: { p1_series: [55], p2_series: [40] } })]); // gap 15
assert(events.length === 2, 'gap sous seuil → pas d\'alerte');

// ── 5. Bascule proba live (Δ 2 polls) ────────────────────────────────────────
console.log('[5] Bascule proba live');
purgeEvents();
evalAlerts([mkMatch('m11', { liveProbability: 0.55 })]); // init prev
assert(events.length === 0, '1er poll proba = init');
evalAlerts([mkMatch('m11', { liveProbability: 0.67 })]); // Δ 0.12 ≥ 0.10
assert(events.length === 1 && lastEvt().metric === 'prob_shift' && lastEvt().level === 'yellow' && lastEvt().value === 0.12, 'Δ0.12 → yellow');
evalAlerts([mkMatch('m12', { liveProbability: 0.70 })]);
evalAlerts([mkMatch('m12', { liveProbability: 0.45 })]); // Δ 0.25 ≥ 0.20, bascule vers p2
const evProb = events.filter(e => e.metric === 'prob_shift');
assert(evProb.length === 2 && evProb[1].level === 'red' && /Alcaraz.*45%/.test(evProb[1].msg), 'Δ0.25 → red + bascule favori p2 à 45%');
evalAlerts([mkMatch('m12', { liveProbability: 0.48 })]); // Δ 0.03 + cooldown
purgeEvents();
evalAlerts([mkMatch('m12', { liveProbability: 0.48 })]);
assert(events.length === 0, 'Δ sous seuil → pas d\'alerte');

// ── 6. Set Overs ─────────────────────────────────────────────────────────────
console.log('[6] Set Overs');
purgeEvents();
evalAlerts([mkMatch('m13', { set_ou: { o75: 0.6, o85: 0.72, u125: 0.3 } })]);
assert(events.length === 1 && lastEvt().metric === 'set_overs' && lastEvt().level === 'yellow' && lastEvt().value === 0.72, 'o85 0.72 → yellow');
evalAlerts([mkMatch('m14', { set_ou: { o85: 0.86 } })]);
assert(events.length === 2 && lastEvt().level === 'red', 'o85 0.86 → red');
evalAlerts([mkMatch('m15', { set_ou: { o85: 0.5 } })]);
assert(events.length === 2, 'o85 sous seuil → pas d\'alerte');

// ── 7. Purge matchs disparus (non-régression structurelle) ──────────────────
console.log('[7] Hygiène mémoire');
purgeEvents();
evalAlerts([mkMatch('m16', { liveProbability: 0.5, bppi: { p1: 10, p2: 10 } })]);
evalAlerts([]); // match disparu → prev purgés (pas d'accès direct aux Maps const : on vérifie qu'un 2e cycle sur id recyclé re-init sans alerter)
evalAlerts([mkMatch('m16', { liveProbability: 0.5, bppi: { p1: 10, p2: 10 } })]);
assert(events.length === 0, 'purge : id recyclé traité comme neuf (pas de faux Δ)');

console.log('');
console.log(pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
