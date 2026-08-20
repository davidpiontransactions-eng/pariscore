const { execSync } = require('child_process');
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}
console.log('ADD:', run('git add -A'));
console.log(run('git commit -m "ui: lisibilite metrics live card football (font-display Archivo 14px bold blanc + labels slate-400 AA, barres 6px)"').slice(0, 300));
console.log('--- log ---');
console.log(run('git log --oneline -3'));