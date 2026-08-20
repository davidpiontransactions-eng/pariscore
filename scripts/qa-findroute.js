const { execSync } = require('child_process');
function run(cmd) { try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }
const out = run('git grep -n "sport-tabs" src/app --include=*.tsx');
console.log(out.slice(0, 600));