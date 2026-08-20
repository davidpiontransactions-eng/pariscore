// scripts/qa-commit.js - stage + commit the QA/design work
const c = require('child_process');
function run(a) {
  try { return c.execSync('git ' + a, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return 'ERR ' + (e.stderr || e.message).toString().split('\n')[0].slice(0, 150); }
}
console.log('ADD:', run('add -A').slice(0, 80));
console.log('RESET artifacts:', run('reset -- .context/visual-audit-2026-08-20 build-out5.txt qa-query-out.txt').slice(0, 120));
console.log('COMMIT:');
console.log(run('commit -m "qa: audit networkidle->domcontentloaded (polling odds/live), fix cle i18n tennis.offline, rapport design compare + scripts diag"').slice(0, 400));
console.log('--- status ---');
console.log((run('status --short') || '').split(/\r?\n/).filter(Boolean).slice(0, 6).join('\n'));