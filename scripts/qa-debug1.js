const { execSync } = require('child_process');
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}
console.log('=== Recent commits touching football ===');
console.log(run('git log --oneline -12 -- src/components/football/ src/lib/football-data.ts src/app/api/football/'));
console.log('=== DIFF of football-live-card (last commit) ===');
console.log(run('git show 890d1f38 --stat').slice(0, 500));