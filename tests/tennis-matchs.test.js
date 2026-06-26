// ═══ tennis-matchs.test.js — Tests unitaires sur les fonctions pures ═══
//
// Couvre :
//   - decodeHtmlEntities (HTML entity decoding)
//   - texEscapeRegex (regex special chars escaping)
//   - upsetScore (upset probability scoring)
//   - sortTexMatchs (7 sort filters: time, elo_delta, value, drift, elite, rating, upset)
//   - computeMatchRating (composite 0-100 score + 1-5 stars + breakdown)
//
// Run :  node tests/tennis-matchs.test.js
// Sortie : rapport coloré + exit code 0 si tout passe, 1 sinon.

'use strict';
const assert = require('assert');
const logic = require('./lib/tennis-logic.js');

const { decodeHtmlEntities, texEscapeRegex, upsetScore, sortTexMatchs, computeMatchRating, inferMatchStatus } = logic;

// ─────────────────────────────────────────────────────────────────────────
// Mini framework de test (zéro dépendance)
// ─────────────────────────────────────────────────────────────────────────
const results = { passed: 0, failed: 0, skipped: 0, failures: [] };
function test(name, fn) {
  try {
    fn();
    results.passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    results.failed++;
    results.failures.push({ name, error: e });
    console.log('  ✗ ' + name + ' — ' + (e.message || e));
  }
}
function skip(name) { results.skipped++; console.log('  ⊘ ' + name + ' (skipped)'); }
function eq(actual, expected, msg) { assert.strictEqual(actual, expected, msg); }
function approx(actual, expected, eps, msg) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error((msg || '') + ` expected ~${expected} got ${actual} (eps=${eps})`);
  }
}
function deepEq(actual, expected, msg) { assert.deepStrictEqual(actual, expected, msg); }

// ─────────────────────────────────────────────────────────────────────────
// Fixtures : 4 matchs représentatifs
// ─────────────────────────────────────────────────────────────────────────
const fixture = {
  grandSlamElite: {
    id: 'tex_1',
    time_utc: '14:00',
    tournament: 'Roland Garros',
    surface: 'Clay',
    round: '1/4',
    player1: { slug: 'jannik-sinner', name: 'Jannik Sinner' },
    player2: { slug: 'carlos-alcaraz', name: 'Carlos Alcaraz' },
    elo_surface: { p1: 2150, p2: 2080, delta: 70, favorite: 'p1' },
    odds_current: { p1: 1.85, p2: 2.05 },
    odds_drift_pct: { p1: -3.5, p2: +3.0 },
  },
  challengerNoElo: {
    id: 'tex_2',
    time_utc: '9:30',
    tournament: 'Tenerife Challenger',
    surface: 'Hard',
    round: '1/8',
    player1: { slug: 'john-doe', name: 'John Doe' },
    player2: { slug: 'jane-roe', name: 'Jane Roe' },
    elo_surface: null,
    odds_current: { p1: 1.50, p2: 2.60 },
    odds_drift_pct: null,
  },
  atp500Mid: {
    id: 'tex_3',
    time_utc: '02:15',
    tournament: 'Halle Open',
    surface: 'Grass',
    round: '1/2',
    player1: { slug: 'daniil-medvedev', name: 'Daniil Medvedev' },
    player2: { slug: 'alexander-zverev', name: 'Alexander Zverev' },
    elo_surface: { p1: 2050, p2: 1980, delta: 70, favorite: 'p1' },
    odds_current: { p1: 2.10, p2: 1.80 },
    odds_drift_pct: { p1: +5.0, p2: -4.0 },
  },
  atp250NoOdds: {
    id: 'tex_4',
    time_utc: '18:45',
    tournament: 'ATP 250 Newport',
    surface: 'Grass',
    round: 'Final',
    player1: { slug: 'unknown-a', name: 'Unknown A' },
    player2: { slug: 'unknown-b', name: 'Unknown B' },
    elo_surface: { p1: 1650, p2: 1600, delta: 50, favorite: 'p1' },
    odds_current: null,
    odds_drift_pct: null,
  },
};

// ═════════════════════════════════════════════════════════════════════════
// SUITE 1 — decodeHtmlEntities
// ═════════════════════════════════════════════════════════════════════════
console.log('\n── Suite 1 : decodeHtmlEntities ──');

test('null/undefined returns input as-is', () => {
  eq(decodeHtmlEntities(null), null);
  eq(decodeHtmlEntities(undefined), undefined);
  eq(decodeHtmlEntities(''), '');
});

test('&nbsp; → space', () => {
  eq(decodeHtmlEntities('John&nbsp;Doe'), 'John Doe');
});

test('&amp; → & (must come after &nbsp; to avoid double-decode)', () => {
  eq(decodeHtmlEntities('Tom &amp; Jerry'), 'Tom & Jerry');
});

test('Numeric entity &#39; → apostrophe', () => {
  eq(decodeHtmlEntities('O&#39;Connell'), "O'Connell");
});

test('Hex entity &#x27; → apostrophe', () => {
  eq(decodeHtmlEntities('O&#x27;Brien'), "O'Brien");
});

test('Multiple spaces collapsed to single', () => {
  eq(decodeHtmlEntities('John    Doe'), 'John Doe');
});

test('Mixed entities decoded', () => {
  eq(decodeHtmlEntities('ATP&nbsp;&amp;&nbsp;WTA &#39;26'), "ATP & WTA '26");
});

test('Trim leading/trailing whitespace', () => {
  eq(decodeHtmlEntities('  hello  '), 'hello');
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 2 — texEscapeRegex
// ═════════════════════════════════════════════════════════════════════════
console.log('\n── Suite 2 : texEscapeRegex ──');

test('Plain text unchanged', () => {
  eq(texEscapeRegex('Sinner'), 'Sinner');
});

test('Question mark escaped', () => {
  eq(texEscapeRegex('Sinner?'), 'Sinner\\?');
});

test('All special chars escaped (. * + ? ^ $ { } ( ) | [ ] \\)', () => {
  const input = '.*+?^${}()|[]\\';
  const expected = '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\';
  eq(texEscapeRegex(input), expected);
});

test('Empty/null returns empty string', () => {
  eq(texEscapeRegex(''), '');
  eq(texEscapeRegex(null), '');
  eq(texEscapeRegex(undefined), '');
});

test('Escaped query builds valid regex (regression L27)', () => {
  const escaped = texEscapeRegex('Sin(er?');
  const re = new RegExp(escaped, 'i');
  // Should not throw — L27 bug was RegExp('Sin(er?') throwing SyntaxError
  eq(re.test('Sinner'), false);  // 'Sin(er?' literally doesn't match 'Sinner'
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 3 — upsetScore
// ═════════════════════════════════════════════════════════════════════════
console.log('\n── Suite 3 : upsetScore ──');

test('Returns 0 when no elo_surface', () => {
  eq(upsetScore({}), 0);
  eq(upsetScore({ elo_surface: null }), 0);
});

test('Returns 0 when elo_surface.delta is null/undefined', () => {
  eq(upsetScore({ elo_surface: { delta: null } }), 0);
  eq(upsetScore({ elo_surface: { delta: undefined } }), 0);
  eq(upsetScore({ elo_surface: {} }), 0);
});

test('delta=0 → upsetElo=100 (max competitive)', () => {
  eq(upsetScore({ elo_surface: { delta: 0, favorite: 'p1' }, odds_drift_pct: null }), 100);
});

test('delta=100 → upsetElo=0 (no upset possible)', () => {
  eq(upsetScore({ elo_surface: { delta: 100, favorite: 'p1' }, odds_drift_pct: null }), 0);
});

test('delta=200 → clamped to 0 (not negative)', () => {
  eq(upsetScore({ elo_surface: { delta: 200, favorite: 'p1' }, odds_drift_pct: null }), 0);
});

test('delta=50 → upsetElo=50', () => {
  eq(upsetScore({ elo_surface: { delta: 50, favorite: 'p1' }, odds_drift_pct: null }), 50);
});

test('Drift bonus when outsider has negative drift (favorite=p1, p2 drift<0)', () => {
  // delta=50 → upsetElo=50; p2 drift=-10 → upsetDrift=30 → total=80
  eq(upsetScore({ elo_surface: { delta: 50, favorite: 'p1' }, odds_drift_pct: { p1: 0, p2: -10 } }), 80);
});

test('No drift bonus when outsider has positive drift', () => {
  // delta=50 → upsetElo=50; p2 drift=+10 → no bonus → 50
  eq(upsetScore({ elo_surface: { delta: 50, favorite: 'p1' }, odds_drift_pct: { p1: 0, p2: 10 } }), 50);
});

test('Drift bonus works for favorite=p2 too', () => {
  // delta=50 → upsetElo=50; p1 drift=-5 → upsetDrift=15 → total=65
  eq(upsetScore({ elo_surface: { delta: 50, favorite: 'p2' }, odds_drift_pct: { p1: -5, p2: 0 } }), 65);
});

test('Result is rounded to 1 decimal', () => {
  // delta=33 → upsetElo=67; p2 drift=-1.5 → upsetDrift=4.5 → total=71.5
  eq(upsetScore({ elo_surface: { delta: 33, favorite: 'p1' }, odds_drift_pct: { p2: -1.5 } }), 71.5);
});

test('Fixture grandSlamElite (delta=70, p1 drift=-3.5)', () => {
  // delta=70 → upsetElo=30; favorite=p1, so check p2 drift: p2=+3.0 (positive) → no bonus → 30
  eq(upsetScore(fixture.grandSlamElite), 30);
});

test('Fixture atp500Mid (delta=70, favorite=p1, p2 drift=-4.0)', () => {
  // delta=70 → upsetElo=30; p2 drift=-4 → upsetDrift=12 → total=42
  eq(upsetScore(fixture.atp500Mid), 42);
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 4 — sortTexMatchs
// ═════════════════════════════════════════════════════════════════════════
console.log('\n── Suite 4 : sortTexMatchs ──');

// Build enriched fixtures (run computeMatchRating on each)
const enriched = [
  computeMatchRating(fixture.grandSlamElite),
  computeMatchRating(fixture.challengerNoElo),
  computeMatchRating(fixture.atp500Mid),
  computeMatchRating(fixture.atp250NoOdds),
];

test('sortTexMatchs does not mutate input (returns new array)', () => {
  const input = enriched.slice();
  const out = sortTexMatchs(input, 'time');
  eq(input.length, 4);
  eq(out.length, 4);
  assert(out !== input, 'should return a new array');
});

test('filter="time" : chronological order with zero-padded hours', () => {
  const out = sortTexMatchs(enriched, 'time');
  // atp500Mid=02:15, challengerNoElo=9:30, grandSlamElite=14:00, atp250NoOdds=18:45
  // Note: '9:30' must zero-pad to '09:30' so it sorts AFTER '02:15' (L2 fix)
  eq(out[0].id, 'tex_3');  // 02:15
  eq(out[1].id, 'tex_2');  // 09:30 (zero-padded)
  eq(out[2].id, 'tex_1');  // 14:00
  eq(out[3].id, 'tex_4');  // 18:45
});

test('filter="time" : zero-padding is critical — without it "9:30" > "18:45"', () => {
  // Regression: localeCompare without zero-pad would sort '9:30' AFTER '18:45'
  // because '9' > '1' lexicographically
  const out = sortTexMatchs(enriched, 'time');
  assert(out.findIndex(m => m.id === 'tex_2') < out.findIndex(m => m.id === 'tex_4'),
    '09:30 must come before 18:45 (zero-pad fix)');
});

test('filter="elo_delta" : biggest delta first', () => {
  const out = sortTexMatchs(enriched, 'elo_delta');
  // grandSlamElite delta=70, atp500Mid delta=70, atp250NoOdds delta=50, challengerNoElo delta=null→0
  // Equal deltas: stable sort keeps original order
  eq(out[0].elo_surface.delta, 70);
  eq(out[out.length - 1].id, 'tex_2');  // challengerNoElo (no Elo → 0)
});

test('filter="value" : highest value_score first', () => {
  const out = sortTexMatchs(enriched, 'value');
  // Verify descending order
  for (let i = 1; i < out.length; i++) {
    assert((out[i - 1].value_score || 0) >= (out[i].value_score || 0),
      `expected ${out[i - 1].value_score} >= ${out[i].value_score}`);
  }
});

test('filter="drift" : highest max_drift first', () => {
  const out = sortTexMatchs(enriched, 'drift');
  // grandSlamElite drift max=3.5, atp500Mid drift max=5.0, others=0
  eq(out[0].id, 'tex_3');  // atp500Mid max_drift=5.0
  eq(out[1].id, 'tex_1');  // grandSlamElite max_drift=3.5
});

test('filter="elite" : elite matches first, then by Elo sum descending', () => {
  const out = sortTexMatchs(enriched, 'elite');
  // grandSlamElite (2150+2080=4230) + atp500Mid (2050+1980=4030) are elite (both ≥1900)
  // atp250NoOdds (1650+1600=3250) NOT elite, challengerNoElo not elite
  assert(out[0].is_elite === true, 'first should be elite');
  assert(out[1].is_elite === true, 'second should be elite');
  assert(out[2].is_elite !== true, 'third should not be elite');
  eq(out[0].id, 'tex_1');  // grandSlamElite (higher sum)
  eq(out[1].id, 'tex_3');  // atp500Mid
});

test('filter="rating" : highest match_rating.score first', () => {
  const out = sortTexMatchs(enriched, 'rating');
  for (let i = 1; i < out.length; i++) {
    const prev = (out[i - 1].match_rating && out[i - 1].match_rating.score) || 0;
    const curr = (out[i].match_rating && out[i].match_rating.score) || 0;
    assert(prev >= curr, `expected ${prev} >= ${curr}`);
  }
});

test('filter="upset" : highest upsetScore first', () => {
  const out = sortTexMatchs(enriched, 'upset');
  // Compute upset scores:
  // - atp250NoOdds: delta=50 → upsetElo=50, no drift → total=50
  // - atp500Mid: delta=70 → upsetElo=30, p2 drift=-4 → +12 → total=42
  // - grandSlamElite: delta=70 → upsetElo=30, p2 drift=+3 → no bonus → 30
  // - challengerNoElo: no Elo → 0
  eq(out[0].id, 'tex_4');  // atp250NoOdds (50)
  eq(out[1].id, 'tex_3');  // atp500Mid (42)
  eq(out[2].id, 'tex_1');  // grandSlamElite (30)
  eq(out[3].id, 'tex_2');  // challengerNoElo (0)
});

test('filter=undefined → defaults to "time" sort', () => {
  const out = sortTexMatchs(enriched, undefined);
  eq(out[0].id, 'tex_3');  // 02:15
});

test('filter="unknown" → defaults to "time" sort', () => {
  const out = sortTexMatchs(enriched, 'unknown_filter');
  eq(out[0].id, 'tex_3');  // 02:15
});

test('Empty array returns empty array', () => {
  const out = sortTexMatchs([], 'time');
  eq(out.length, 0);
});

test('Single match returns single match', () => {
  const out = sortTexMatchs([enriched[0]], 'rating');
  eq(out.length, 1);
  eq(out[0].id, 'tex_1');
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 5 — computeMatchRating
// ═════════════════════════════════════════════════════════════════════════
console.log('\n── Suite 5 : computeMatchRating ──');

test('Does not mutate input match', () => {
  const input = JSON.parse(JSON.stringify(fixture.grandSlamElite));
  const out = computeMatchRating(input);
  // input should still not have value_score/is_elite/match_rating
  eq(input.value_score, undefined);
  eq(input.is_elite, undefined);
  eq(input.match_rating, undefined);
  // out should have them
  assert(out.value_score != null);
  assert(out.match_rating != null);
});

test('Score is an integer between 0 and 100', () => {
  const out = computeMatchRating(fixture.grandSlamElite);
  assert(Number.isInteger(out.match_rating.score), 'score must be integer');
  assert(out.match_rating.score >= 0 && out.match_rating.score <= 100, 'score in [0, 100]');
});

test('Stars is integer between 1 and 5', () => {
  const out = computeMatchRating(fixture.grandSlamElite);
  assert(Number.isInteger(out.match_rating.stars), 'stars must be integer');
  assert(out.match_rating.stars >= 1 && out.match_rating.stars <= 5, 'stars in [1, 5]');
});

test('Score 0 → stars=1 (clamped)', () => {
  // Construct a match that scores ~0
  const m = {
    tournament: 'Unknown Challenger',
    elo_surface: { p1: 1500, p2: 1500, delta: 0 },
    odds_current: null,
    odds_drift_pct: null,
  };
  const out = computeMatchRating(m);
  // eloScore = (1500-1600)/6 = -16.66 → clamped 0
  // compScore = 100 - 0*0.5 = 100
  // prestigeScore = 20 (default)
  // bettingValueScore = 0
  // oddsScore = 0
  // composite = 0*0.30 + 100*0.25 + 20*0.20 + 0*0.15 + 0*0.10 = 29
  eq(out.match_rating.score, 29);
  eq(out.match_rating.stars, 2);  // ceil(29/20) = 2
});

test('Score 100 → stars=5', () => {
  const m = {
    tournament: 'Wimbledon',
    elo_surface: { p1: 2200, p2: 2200, delta: 0 },
    odds_current: { p1: 1.90, p2: 1.90 },
    odds_drift_pct: { p1: -10, p2: -10 },
  };
  const out = computeMatchRating(m);
  // eloScore = 100
  // compScore = 100 (delta=0)
  // prestigeScore = 100 (wimbledon)
  // bettingValueScore = min(100, 10*10) = 100
  // oddsScore = 100
  // composite = 100*0.30 + 100*0.25 + 100*0.20 + 100*0.15 + 100*0.10 = 100
  eq(out.match_rating.score, 100);
  eq(out.match_rating.stars, 5);
});

test('Elite flag true when both players ≥ 1900', () => {
  const out = computeMatchRating(fixture.grandSlamElite);
  eq(out.is_elite, true);
});

test('Elite flag false when one player < 1900', () => {
  const m = {
    tournament: 'Test',
    elo_surface: { p1: 1950, p2: 1899, delta: 51, favorite: 'p1' },
    odds_current: { p1: 1.5, p2: 2.5 },
    odds_drift_pct: null,
  };
  const out = computeMatchRating(m);
  eq(out.is_elite, false);
});

test('Elite flag false when no Elo data', () => {
  const out = computeMatchRating(fixture.challengerNoElo);
  eq(out.is_elite, false);
});

test('value_score = 0 when no Elo delta + no negative drift', () => {
  const out = computeMatchRating(fixture.challengerNoElo);
  eq(out.value_score, 0);
});

test('value_score combines Elo delta + negative drift (L4 config)', () => {
  const out = computeMatchRating(fixture.grandSlamElite);
  // delta=70 → 70*0.5 = 35
  // p1 drift=-3.5 → 3.5*2 = 7
  // p2 drift=+3.0 → no bonus (positive)
  // total = 42 → rounded 42.0
  eq(out.value_score, 42);
});

test('value_score rounded to 1 decimal', () => {
  const m = {
    tournament: 'Test',
    elo_surface: { p1: 2000, p2: 1900, delta: 33, favorite: 'p1' },
    odds_current: { p1: 1.5, p2: 2.5 },
    odds_drift_pct: { p1: -1.55, p2: 0 },
  };
  const out = computeMatchRating(m);
  // delta=33 → 16.5; p1 drift=-1.55 → 3.1; total = 19.6 → rounded 19.6
  eq(out.value_score, 19.6);
});

test('max_drift = max(|p1 drift|, |p2 drift|)', () => {
  const out = computeMatchRating(fixture.grandSlamElite);
  // p1 drift=-3.5 → |3.5|; p2 drift=+3.0 → |3.0|; max = 3.5
  approx(out.max_drift, 3.5, 0.001);
});

test('max_drift = 0 when no odds_drift_pct', () => {
  const out = computeMatchRating(fixture.challengerNoElo);
  eq(out.max_drift, 0);
});

test('Prestige: Grand Slam → 100', () => {
  const out = computeMatchRating(fixture.grandSlamElite);  // Roland Garros
  eq(out.match_rating.breakdown.tournament_prestige, 100);
});

test('Prestige: ATP 500 → 60', () => {
  const out = computeMatchRating(fixture.atp500Mid);  // Halle Open
  eq(out.match_rating.breakdown.tournament_prestige, 60);
});

test('Prestige: ATP 250 → 40', () => {
  const out = computeMatchRating(fixture.atp250NoOdds);  // ATP 250 Newport
  eq(out.match_rating.breakdown.tournament_prestige, 40);
});

test('Prestige: Challenger/unknown → 20 (default)', () => {
  const out = computeMatchRating(fixture.challengerNoElo);  // Tenerife Challenger
  eq(out.match_rating.breakdown.tournament_prestige, 20);
});

test('L3 fix: "paris" alone should NOT match Masters (no more false positive)', () => {
  // Old regex /paris/ would match "Paris Challenger" → wrong prestige=80
  // New regex /paris\s*masters/ only matches "Paris Masters"
  const m = {
    tournament: 'Paris Challenger',
    elo_surface: { p1: 1700, p2: 1700, delta: 0 },
    odds_current: { p1: 1.5, p2: 2.5 },
    odds_drift_pct: null,
  };
  const out = computeMatchRating(m);
  eq(out.match_rating.breakdown.tournament_prestige, 20);  // NOT 80
});

test('L3 fix: "Paris Masters" matches correctly', () => {
  const m = {
    tournament: 'Paris Masters',
    elo_surface: { p1: 2000, p2: 1900, delta: 100 },
    odds_current: { p1: 1.5, p2: 2.5 },
    odds_drift_pct: null,
  };
  const out = computeMatchRating(m);
  eq(out.match_rating.breakdown.tournament_prestige, 80);
});

test('Breakdown contains all 5 criteria', () => {
  const out = computeMatchRating(fixture.grandSlamElite);
  assert(out.match_rating.breakdown.elo_quality != null);
  assert(out.match_rating.breakdown.competitiveness != null);
  assert(out.match_rating.breakdown.tournament_prestige != null);
  assert(out.match_rating.breakdown.betting_value != null);
  assert(out.match_rating.breakdown.odds_availability != null);
});

test('Weights sum to 1.0 (sanity check)', () => {
  const w = logic.TEX_RATING_CONFIG.weights;
  const sum = w.elo + w.comp + w.prestige + w.betting + w.odds;
  approx(sum, 1.0, 0.001, 'weights must sum to 1.0');
});

test('odds_availability = 100 when both odds present, 0 otherwise', () => {
  const withOdds = computeMatchRating(fixture.grandSlamElite);
  eq(withOdds.match_rating.breakdown.odds_availability, 100);
  const noOdds = computeMatchRating(fixture.atp250NoOdds);
  eq(noOdds.match_rating.breakdown.odds_availability, 0);
});

test('Competitiveness: delta=0 → 100, delta=200 → 0', () => {
  const m1 = { tournament: 'T', elo_surface: { p1: 2000, p2: 2000, delta: 0 }, odds_current: null };
  eq(computeMatchRating(m1).match_rating.breakdown.competitiveness, 100);
  const m2 = { tournament: 'T', elo_surface: { p1: 2200, p2: 2000, delta: 200 }, odds_current: null };
  eq(computeMatchRating(m2).match_rating.breakdown.competitiveness, 0);
});

test('Elo quality: avg<1600 → 0, avg=2200 → 100, avg=1900 → 50', () => {
  const m1 = { tournament: 'T', elo_surface: { p1: 1500, p2: 1500, delta: 0 }, odds_current: null };
  eq(computeMatchRating(m1).match_rating.breakdown.elo_quality, 0);
  const m2 = { tournament: 'T', elo_surface: { p1: 2200, p2: 2200, delta: 0 }, odds_current: null };
  eq(computeMatchRating(m2).match_rating.breakdown.elo_quality, 100);
  const m3 = { tournament: 'T', elo_surface: { p1: 1900, p2: 1900, delta: 0 }, odds_current: null };
  eq(computeMatchRating(m3).match_rating.breakdown.elo_quality, 50);
});

test('Betting value: drift=0 → 0, drift=5 → 50, drift=10+ → 100 (capped)', () => {
  const m0 = { tournament: 'T', elo_surface: { p1: 2000, p2: 2000, delta: 0 }, odds_current: null, odds_drift_pct: { p1: 0, p2: 0 } };
  eq(computeMatchRating(m0).match_rating.breakdown.betting_value, 0);
  const m5 = { tournament: 'T', elo_surface: { p1: 2000, p2: 2000, delta: 0 }, odds_current: null, odds_drift_pct: { p1: 5, p2: 0 } };
  eq(computeMatchRating(m5).match_rating.breakdown.betting_value, 50);
  const m15 = { tournament: 'T', elo_surface: { p1: 2000, p2: 2000, delta: 0 }, odds_current: null, odds_drift_pct: { p1: 0, p2: 15 } };
  eq(computeMatchRating(m15).match_rating.breakdown.betting_value, 100);
});

test('Match with no Elo + no odds still returns valid rating (graceful)', () => {
  const out = computeMatchRating(fixture.challengerNoElo);
  assert(out.match_rating.score >= 1, 'score must be at least 1 (clamp)');
  assert(out.match_rating.stars >= 1, 'stars must be at least 1');
});

// ═════════════════════════════════════════════════════════════════════════
// SUITE 6 — inferMatchStatus (NEW)
// ═════════════════════════════════════════════════════════════════════════
console.log('\n── Suite 6 : inferMatchStatus ──');

// Helper : construit un timestamp UTC pour aujourd'hui à HH:MM
function todayAt(hh, mm) {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm);
}

test('Returns "unknown" when time_utc is null/empty', () => {
  deepEq(inferMatchStatus(null, [], []), { status: 'unknown', starts_in_minutes: null });
  deepEq(inferMatchStatus('', [], []), { status: 'unknown', starts_in_minutes: null });
});

test('Returns "unknown" when time_utc is malformed', () => {
  deepEq(inferMatchStatus('invalid', [], []), { status: 'unknown', starts_in_minutes: null });
  // 'abc' ne matche pas la regex \d{1,2}:\d{2}
  deepEq(inferMatchStatus('abc', [], []), { status: 'unknown', starts_in_minutes: null });
  deepEq(inferMatchStatus('14', [], []), { status: 'unknown', starts_in_minutes: null }); // pas de :MM
});

test('Match in the future with no scores → "upcoming"', () => {
  // Match dans 2h (utilise time_utc dynamique)
  const now = Date.now();
  const future = new Date(now + 2 * 3600 * 1000);
  const hh = String(future.getUTCHours()).padStart(2, '0');
  const mm = String(future.getUTCMinutes()).padStart(2, '0');
  const result = inferMatchStatus(hh + ':' + mm, [], [], now);
  eq(result.status, 'upcoming');
  assert(result.starts_in_minutes > 60 && result.starts_in_minutes <= 120, 'should be ~120 min');
});

test('Match started 30min ago, no scores → "live"', () => {
  const now = Date.now();
  const past = new Date(now - 30 * 60 * 1000);
  const hh = String(past.getUTCHours()).padStart(2, '0');
  const mm = String(past.getUTCMinutes()).padStart(2, '0');
  const result = inferMatchStatus(hh + ':' + mm, [], [], now);
  eq(result.status, 'live');
  assert(result.starts_in_minutes < 0 && result.starts_in_minutes >= -35, 'should be ~-30 min');
});

test('Match started 10min ago, 1 set played → "live" (not finished)', () => {
  const now = Date.now();
  const past = new Date(now - 10 * 60 * 1000);
  const hh = String(past.getUTCHours()).padStart(2, '0');
  const mm = String(past.getUTCMinutes()).padStart(2, '0');
  // 1 set joué (best-of-3 pas encore fini)
  const result = inferMatchStatus(hh + ':' + mm, ['6'], ['3'], now);
  eq(result.status, 'live');
});

test('Match with 3+ sets played → "finished" (best-of-3 with 2-1)', () => {
  const now = Date.now();
  const future = new Date(now + 2 * 3600 * 1000);
  const hh = String(future.getUTCHours()).padStart(2, '0');
  const mm = String(future.getUTCMinutes()).padStart(2, '0');
  // 3 sets joués (6-3, 4-6, 6-2)
  const result = inferMatchStatus(hh + ':' + mm, ['6', '4', '6'], ['3', '6', '2'], now);
  eq(result.status, 'finished');
});

test('Match with 3 sets but no time → still "unknown" (cannot infer)', () => {
  // Sans time_utc, on ne peut pas savoir si le match est aujourd'hui
  const result = inferMatchStatus(null, ['6', '4', '6'], ['3', '6', '2']);
  eq(result.status, 'unknown');
});

test('Match started 6h ago with scores → "finished" (>5h threshold)', () => {
  const now = Date.now();
  const past = new Date(now - 6 * 3600 * 1000); // 6h ago
  const hh = String(past.getUTCHours()).padStart(2, '0');
  const mm = String(past.getUTCMinutes()).padStart(2, '0');
  // 1 set joué mais ça fait 6h → considéré fini
  const result = inferMatchStatus(hh + ':' + mm, ['6'], ['3'], now);
  eq(result.status, 'finished');
});

test('Match started 6h ago without scores → "live" (no scores to confirm finish)', () => {
  // Edge case : 6h passé mais aucun score → on ne peut pas confirmer fini
  // L'heuristique dit : startsInMin < -300 && hasScores → finished
  // Donc sans scores, ça reste live (même si c'est probablement fini en réalité)
  const now = Date.now();
  const past = new Date(now - 6 * 3600 * 1000);
  const hh = String(past.getUTCHours()).padStart(2, '0');
  const mm = String(past.getUTCMinutes()).padStart(2, '0');
  const result = inferMatchStatus(hh + ':' + mm, [], [], now);
  eq(result.status, 'live');
});

test('starts_in_minutes is rounded to integer', () => {
  const now = Date.now();
  const future = new Date(now + 90 * 1000); // 1.5 min
  const hh = String(future.getUTCHours()).padStart(2, '0');
  const mm = String(future.getUTCMinutes()).padStart(2, '0');
  const result = inferMatchStatus(hh + ':' + mm, [], [], now);
  assert(Number.isInteger(result.starts_in_minutes), 'starts_in_minutes must be integer');
});

test('Fixture grandSlamElite with time_utc "14:00" — status depends on current time', () => {
  // Test avec un time fixe ; on vérifie juste que la fonction ne plante pas
  const result = inferMatchStatus('14:00', [], []);
  assert(['upcoming', 'live', 'finished', 'unknown'].includes(result.status), 'valid status');
  // starts_in_minutes peut être négatif ou positif selon l'heure du test
  assert(result.starts_in_minutes !== null, 'starts_in_minutes computed');
});

// ═════════════════════════════════════════════════════════════════════════
// RAPPORT FINAL
// ═════════════════════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════');
console.log('  RAPPORT TESTS UNITAIRES — Tennis MATCHS');
console.log('════════════════════════════════════════════════');
console.log('  Passés : ' + results.passed);
console.log('  Échoués: ' + results.failed);
console.log('  Skip   : ' + results.skipped);
console.log('  Total  : ' + (results.passed + results.failed + results.skipped));
console.log('════════════════════════════════════════════════');

if (results.failures.length) {
  console.log('\nDétails des échecs :');
  results.failures.forEach(f => {
    console.log('  • ' + f.name);
    console.log('    → ' + (f.error.stack || f.error.message || f.error));
  });
}

process.exit(results.failed > 0 ? 1 : 0);
