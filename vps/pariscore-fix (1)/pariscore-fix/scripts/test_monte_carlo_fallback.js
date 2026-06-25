/*
 * Test rapide du fallback Elo analytique (P1.3, beads cslx)
 * Vérifie que les probabilités sum à ~1.0 et que le favori a la plus haute proba.
 */
const path = require('path');
const fs = require('fs');

// Charger server.js comme module n'est pas viable (trop d'effets de bord).
// On extrait _monteCarloEloFallback et _RG_FATIGUE_BY_ROUND par évaluation ciblée.
const serverSrc = fs.readFileSync(path.join('/home/z/my-project/pariscore', 'server.js'), 'utf8');

// Extraire les constantes et la fonction par regex
const fatigueMatch = serverSrc.match(/const _RG_FATIGUE_BY_ROUND = \[[^\]]+\];/);
const fnMatch = serverSrc.match(/function _monteCarloEloFallback\(playerStats\) \{[\s\S]*?\n\}/);

if (!fatigueMatch || !fnMatch) {
  console.error('FAIL: impossible d\'extraire _monteCarloEloFallback ou _RG_FATIGUE_BY_ROUND');
  process.exit(1);
}

const sandbox = {};
eval(fatigueMatch[0] + '\n' + fnMatch[0].replace('function _monteCarloEloFallback', 'sandbox._monteCarloEloFallback = function _monteCarloEloFallback'));
const _monteCarloEloFallback = sandbox._monteCarloEloFallback;

// Test 1 — 8 joueurs, Elo décroissant → le #1 doit avoir la plus haute proba
console.log('--- Test 1 : 8 joueurs, Elo décroissant ---');
const players8 = [
  { name: 'Sinner', clay_elo: 2200 },
  { name: 'Alcaraz', clay_elo: 2150 },
  { name: 'Djokovic', clay_elo: 2100 },
  { name: 'Medvedev', clay_elo: 2050 },
  { name: 'Rublev', clay_elo: 2000 },
  { name: 'Zverev', clay_elo: 1950 },
  { name: 'Tsitsipas', clay_elo: 1900 },
  { name: 'Ruud', clay_elo: 1850 },
];
const result8 = _monteCarloEloFallback(players8);
const sumTitle8 = Array.from(result8.titleCount.values()).reduce((a, b) => a + b, 0);
const sorted8 = Array.from(result8.titleCount.entries()).sort((a, b) => b[1] - a[1]);
console.log(`  totalRounds: ${result8.totalRounds}`);
console.log(`  Somme titleCount: ${sumTitle8.toFixed(4)} (devrait etre ~1.0)`);
console.log(`  Top 3: ${sorted8.slice(0, 3).map(([n, p]) => `${n}=${(p * 100).toFixed(2)}%`).join(', ')}`);
console.log(`  Favori correct: ${sorted8[0][0] === 'sinner' ? 'OK' : 'ECHEC'}`);
console.log(`  Sum = 1.0: ${Math.abs(sumTitle8 - 1.0) < 0.05 ? 'OK' : 'ECHEC'}`);

// Test 2 — 128 joueurs (draw RG reel) → performance et cohérence
console.log('\n--- Test 2 : 128 joueurs (draw RG) ---');
const players128 = [];
for (let i = 0; i < 128; i++) {
  players128.push({ name: `Player${i}`, clay_elo: 2200 - i * 5 });
}
const t0 = Date.now();
const result128 = _monteCarloEloFallback(players128);
const ms = Date.now() - t0;
const sumTitle128 = Array.from(result128.titleCount.values()).reduce((a, b) => a + b, 0);
console.log(`  Temps: ${ms}ms (devrait etre < 100ms)`);
console.log(`  totalRounds: ${result128.totalRounds}`);
console.log(`  Somme titleCount: ${sumTitle128.toFixed(4)}`);
console.log(`  Performance < 100ms: ${ms < 100 ? 'OK' : 'ECHEC'}`);
console.log(`  Sum = 1.0: ${Math.abs(sumTitle128 - 1.0) < 0.05 ? 'OK' : 'ECHEC'}`);

// Test 3 — 2 joueurs (edge case)
console.log('\n--- Test 3 : 2 joueurs (edge case) ---');
const players2 = [
  { name: 'Favorite', clay_elo: 2000 },
  { name: 'Outsider', clay_elo: 1500 },
];
const result2 = _monteCarloEloFallback(players2);
const sum2 = Array.from(result2.titleCount.values()).reduce((a, b) => a + b, 0);
console.log(`  totalRounds: ${result2.totalRounds}`);
console.log(`  Somme titleCount: ${sum2.toFixed(4)}`);
console.log(`  Favorite proba: ${(result2.titleCount.get('favorite') * 100).toFixed(2)}% (devrait etre > 90%)`);
console.log(`  Sum = 1.0: ${Math.abs(sum2 - 1.0) < 0.05 ? 'OK' : 'ECHEC'}`);

console.log('\n=== RESUME ===');
const allOk = (
  sorted8[0][0] === 'sinner' &&
  Math.abs(sumTitle8 - 1.0) < 0.05 &&
  ms < 100 &&
  Math.abs(sumTitle128 - 1.0) < 0.05 &&
  Math.abs(sum2 - 1.0) < 0.05
);
console.log(allOk ? 'TOUS LES TESTS PASSENT' : 'ECHEC');
process.exit(allOk ? 0 : 1);
