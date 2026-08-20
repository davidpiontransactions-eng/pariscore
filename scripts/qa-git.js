const { execSync } = require('child_process');
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || '') + e.message; }
}
console.log(run('git diff --stat'));
console.log('--- stash ---');
console.log(run('git stash list'));