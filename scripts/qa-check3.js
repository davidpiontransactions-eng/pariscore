const { execSync } = require('child_process');
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || '') + e.message; }
}
const tsc = run('npx tsc --noEmit');
const tscLines = tsc.split(/\r?\n/).filter((l) => /football-live-card|live-stats-breakdown|football-match-card/.test(l));
console.log('--- TSC (3 files) ---');
console.log(tscLines.length ? tscLines.slice(0, 10).join('\n') : 'CLEAN');
const lint = run('npx eslint src/components/football/football-live-card.tsx src/components/football/live-stats-breakdown.tsx src/components/football/football-match-card.tsx');
console.log('--- ESLINT ---');
console.log(lint.trim() ? lint.trim().slice(0, 1200) : 'CLEAN');