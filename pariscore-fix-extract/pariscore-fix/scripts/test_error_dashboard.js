/*
 * Test P1.2 — error dashboard counters
 * Vérifie que _recordError et _inferErrorContext fonctionnent correctement.
 */
const path = require('path');
const fs = require('fs');

const serverSrc = fs.readFileSync(path.join('/home/z/my-project/pariscore', 'server.js'), 'utf8');

// Extraire les fonctions et constantes par évaluation ciblée
const fnRegex = /(const _errorCounters = new Map\(\);[\s\S]*?function _recordError[\s\S]*?\n\})/;
const match = serverSrc.match(fnRegex);
if (!match) {
  console.error('FAIL: impossible d\'extraire _recordError');
  process.exit(1);
}

const sandbox = {};
eval(match[0].replace('const _errorCounters', 'sandbox._errorCounters')
             .replace('const _ERROR_COUNTER_MAX', 'sandbox._ERROR_COUNTER_MAX')
             .replace('function _inferErrorContext', 'sandbox._inferErrorContext = function _inferErrorContext')
             .replace('function _recordError', 'sandbox._recordError = function _recordError'));

const { _errorCounters, _inferErrorContext, _recordError, _ERROR_COUNTER_MAX } = sandbox;

console.log('--- Test 1 : _inferErrorContext (sans stack spécifique) ---');
const ctx1 = _inferErrorContext();
console.log(`  page: ${ctx1.page} (devrait etre 'global')`);
console.log(`  sport: ${ctx1.sport}`);
console.log(`  OK: ${ctx1.page === 'global' ? 'OK' : 'ECHEC'}`);

console.log('\n--- Test 2 : _recordError incrémente le compteur ---');
_recordError('tennis', 'safeFixed_null', 'tennis');
_recordError('tennis', 'safeFixed_null', 'tennis');
_recordError('tennis', 'safeFixed_nan', 'tennis');
_recordError('matchs', 'safePercent_invalid', 'football');
console.log(`  Entries: ${_errorCounters.size} (devrait etre 3)`);
console.log(`  OK: ${_errorCounters.size === 3 ? 'OK' : 'ECHEC'}`);

console.log('\n--- Test 3 : compteurs incrémentés ---');
const tennisNull = _errorCounters.get('tennis|safeFixed_null|tennis');
const tennisNan = _errorCounters.get('tennis|safeFixed_nan|tennis');
const matchsPct = _errorCounters.get('matchs|safePercent_invalid|football');
console.log(`  tennis|safeFixed_null: ${tennisNull.count} (devrait etre 2)`);
console.log(`  tennis|safeFixed_nan: ${tennisNan.count} (devrait etre 1)`);
console.log(`  matchs|safePercent_invalid: ${matchsPct.count} (devrait etre 1)`);
const ok3 = tennisNull.count === 2 && tennisNan.count === 1 && matchsPct.count === 1;
console.log(`  OK: ${ok3 ? 'OK' : 'ECHEC'}`);

console.log('\n--- Test 4 : agrégation par page ---');
const byPage = {};
for (const e of _errorCounters.values()) {
  if (!byPage[e.page]) byPage[e.page] = 0;
  byPage[e.page] += e.count;
}
console.log(`  tennis: ${byPage.tennis} (devrait etre 3)`);
console.log(`  matchs: ${byPage.matchs} (devrait etre 1)`);
const ok4 = byPage.tennis === 3 && byPage.matchs === 1;
console.log(`  OK: ${ok4 ? 'OK' : 'ECHEC'}`);

console.log('\n--- Test 5 : anti-flood (limite _ERROR_COUNTER_MAX) ---');
for (let i = 0; i < _ERROR_COUNTER_MAX + 50; i++) {
  _recordError('flood', `src_${i}`, null);
}
console.log(`  Size: ${_errorCounters.size} (devrait etre <= ${_ERROR_COUNTER_MAX})`);
const ok5 = _errorCounters.size <= _ERROR_COUNTER_MAX;
console.log(`  OK: ${ok5 ? 'OK' : 'ECHEC'}`);

console.log('\n=== RESUME ===');
// Recompte final (le test 5 a ajouté beaucoup d'entrées flood)
const finalCount = _errorCounters.size;
console.log(`  Final entries: ${finalCount} (limite max ${_ERROR_COUNTER_MAX})`);
const allOk = ctx1.page === 'global' && ok3 && ok4 && ok5 && finalCount <= _ERROR_COUNTER_MAX;
console.log(allOk ? 'TOUS LES TESTS PASSENT' : 'ECHEC');
process.exit(allOk ? 0 : 1);
