const { execSync } = require('child_process');
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}
const junk = [
  'scripts/qa-scan-live.js', 'scripts/qa-tokens.js', 'scripts/qa-contrast-report.js',
  'scripts/qa-contrast2.js', 'scripts/qa-scan-statrow.js', 'scripts/qa-check3.js',
  'scripts/qa-git.js', 'scripts/qa-build-check.js', 'scripts/qa-build-id.js',
  'scripts/qa-commit2.js', 'scripts/qa-live-api.js', 'scripts/qa-live-api2.js',
  'scripts/qa-live-api3.js', 'scripts/qa-live-search.js', 'scripts/qa-live-card-capture.js',
  'scripts/qa-findroute.js', 'scripts/qa-live-pixel.js',
];
for (const f of junk) { try { execSync('del /f ' + f, { stdio: 'pipe' }); } catch {} }
console.log('junk removed');
console.log(run('git add -A'));
console.log(run('git commit -m "qa: capture zone stats live prod + scripts comparaison concurrence"').slice(0, 200));
console.log('--- status ---');
console.log(run('git status --short').slice(0, 400) || 'CLEAN');
console.log('--- log ---');
console.log(run('git log --oneline -3'));