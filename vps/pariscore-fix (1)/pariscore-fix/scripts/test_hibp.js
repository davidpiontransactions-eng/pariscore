/*
 * Test P1 secu — HIBP k-anonymity helper
 * Test 1 : password faible "password" → doit être breached
 * Test 2 : password fort aléatoire → ne doit pas être breached (ou erreur réseau acceptable)
 */
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const serverSrc = fs.readFileSync(path.join('/home/z/my-project/pariscore', 'server.js'), 'utf8');

// Extraire la fonction _hibpCheckPassword et les constantes associées
const fnMatch = serverSrc.match(/(const HIBP_API_URL[\s\S]*?async function _hibpCheckPassword[\s\S]*?\n\})/);
if (!fnMatch) {
  console.error('FAIL: impossible d\'extraire _hibpCheckPassword');
  process.exit(1);
}

const sandbox = { https, crypto, console };
sandbox.process = { env: {} };
const wrapper = `(function(https, crypto, console, process) { ${fnMatch[0]}; return _hibpCheckPassword; })`;
const _hibpCheckPassword = eval(wrapper)(https, crypto, console, sandbox.process);

async function runTests() {
  console.log('--- Test 1 : password faible "password" ---');
  const t1 = await _hibpCheckPassword('password');
  console.log(`  ok: ${t1.ok}`);
  console.log(`  breached: ${t1.breached}`);
  console.log(`  count: ${t1.count}`);
  console.log(`  ms: ${t1.ms}`);
  const ok1 = t1.ok && t1.breached && t1.count > 100000;
  console.log(`  OK: ${ok1 ? 'OK' : 'ECHEC'}`);

  console.log('\n--- Test 2 : password fort aléatoire ---');
  const strong = 'xK9#mQ7vLp$2nW' + Math.random().toString(36).slice(2);
  const t2 = await _hibpCheckPassword(strong);
  console.log(`  ok: ${t2.ok}`);
  console.log(`  breached: ${t2.breached}`);
  console.log(`  count: ${t2.count || 0}`);
  console.log(`  ms: ${t2.ms}`);
  const ok2 = t2.ok && !t2.breached;
  console.log(`  OK: ${ok2 ? 'OK' : 'ECHEC'}`);

  console.log('\n--- Test 3 : input invalide ---');
  const t3 = await _hibpCheckPassword(null);
  console.log(`  ok: ${t3.ok} (devrait etre false)`);
  console.log(`  error: ${t3.error}`);
  const ok3 = !t3.ok && t3.error === 'invalid_input';
  console.log(`  OK: ${ok3 ? 'OK' : 'ECHEC'}`);

  console.log('\n=== RESUME ===');
  const allOk = ok1 && ok2 && ok3;
  console.log(allOk ? 'TOUS LES TESTS PASSENT' : 'ECHEC (peut etre reseau HIBP KO)');
  process.exit(allOk ? 0 : 1);
}

runTests().catch(e => {
  console.error('Erreur test:', e.message);
  process.exit(1);
});
