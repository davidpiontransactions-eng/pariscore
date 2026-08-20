// scripts/qa-final-commit.js - commit audit report + cleanup
const c = require('child_process');
function run(a) {
  try { return c.execSync('git ' + a, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return 'ERR ' + (e.stderr || e.message).toString().split('\n')[0].slice(0, 150); }
}
console.log('ADD:', run('add -A').slice(0, 80));
console.log(run('commit -m "qa: rapport audit 19/19 + cleanup fichiers temp"').slice(0, 250));
console.log('--- status ---');
console.log((run('status --short') || 'CLEAN').split(/\r?\n/).filter(Boolean).slice(0, 8).join('\n'));