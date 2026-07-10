// test-serializer.js — Test du serializer tennis canonique
// Track D / 5.9 : les 3 fonctions sont désormais extraites dans le module
// partagé tennis-serializer.js. Plus de copie/duplication — require direct.
// (Avant : copie conforme avec notice de sync manuelle — source de drift.)

var assert = require('assert');
var tennisSerializer = require('./tennis-serializer');
var _serializeTennisCard = tennisSerializer.serializeTennisCard;
var _normalizeProb = tennisSerializer.normalizeProb;
var _computeSignal = tennisSerializer.computeSignal;

// ── Tests ──────────────────────────────────────────────────────────────────

var mockMatch = {
  id: 'test-1', tour: 'ATP', tournament: 'Doha', surface: 'Hard', round: 'QF',
  best_of: 3, start_time: '2026-07-08T13:00:00Z',
  player1: { id: 'p1', name: 'Djokovic', country: 'SRB', flag: '🇷🇸', photo: 'http://x/p1.jpg', rank: 1, elo_surface: 2150, surf_rank_total: 120, l5_pts: 4, powerscore: 0.85 },
  player2: { id: 'p2', name: 'Sinner', country: 'ITA', flag: '🇮🇹', photo: 'http://x/p2.jpg', rank: 4, elo_surface: 2050, surf_rank_total: 100, l5_pts: 3, powerscore: 0.78 },
  odds: { p1: { odds: 1.85, book: 'Unibet' }, p2: { odds: 2.10, book: 'Unibet' } },
  fair: { p1: 0.62, p2: 0.38, margin: 0.04, method: 'shin' },
  edge: { p1: 0.08, p2: -0.02 },
  best_ev_model: { side: 'p1', player: 'Djokovic', odds: 1.85, book: 'Unibet', ev: 14.7, p_model: 0.62 },
  predictions: { elo: { p1: 0.62, p2: 0.38 }, blended: { p1: 0.62, p2: 0.38 }, bsd: { p1: 0.60, p2: 0.40 } }
};

var out = _serializeTennisCard(mockMatch);

assert.strictEqual(out.id, 'test-1', 'id');
assert.strictEqual(out.tab, 'prematch', 'tab défaut prematch');
assert.strictEqual(out.surface, 'Hard', 'surface');
assert.strictEqual(out.bestOf, 3, 'bestOf');
assert.strictEqual(out.player1.rank, 1, 'rank p1');
assert.ok(out.odds.stale === false, 'odds.stale bool');
assert.ok(typeof out.odds.age_ms === 'number', 'odds.age_ms');
assert.ok(out.signal !== null, 'signal non null');
assert.strictEqual(out.signal.side, 'p1', 'signal side');
assert.ok(out.signal.ev_pct > 0, 'ev_pct positif');
assert.strictEqual(out.signal.confidence, 'medium', 'confidence medium (pas high car surf_rank_total < 150)');
assert.deepStrictEqual(out.traps, [], 'pas de traps');

// ── Tests complémentaires helpers (Track D 5.9) ────────────────────────────
assert.strictEqual(_normalizeProb(0.62), 0.62, 'normalizeProb 0.62');
assert.strictEqual(_normalizeProb(62), 0.62, 'normalizeProb 62 → 0.62');
assert.strictEqual(_normalizeProb(null), null, 'normalizeProb null');
assert.strictEqual(_normalizeProb('abc'), null, 'normalizeProb NaN → null');
assert.strictEqual(_normalizeProb('62'), 0.62, 'normalizeProb "62" → 0.62');
assert.strictEqual(_computeSignal({}, null, null), null, 'computeSignal sans odds → null');

console.log('✅ Track D 5.9 : serializer module OK (extraction + helpers)');
console.log(JSON.stringify(out.signal, null, 2));
