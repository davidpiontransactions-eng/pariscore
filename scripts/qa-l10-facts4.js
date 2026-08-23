const fs = require('fs');
const r = require('child_process');
function run(cmd) { try { return r.execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }

console.log('=== DATABASE_URL (from .env, masked) ===');
try {
  const env = fs.readFileSync('.env', 'utf8');
  const m = env.match(/DATABASE_URL=(.+)/);
  console.log(m ? 'DATABASE_URL=' + m[1].replace(/\/\/.*@/, '//***@').slice(0, 60) + '...' : 'NOT IN .env');
} catch (e) { console.log('no .env'); }

console.log('=== abstract-cache.json git-tracked? ===');
console.log(run('git ls-files src/lib/tennis-elo/'));
console.log('=== .gitignore elo/cache entries ===');
const gi = fs.readFileSync('.gitignore', 'utf8');
gi.split(/\r?\n/).filter((l) => /elo|cache/i.test(l)).forEach((l) => console.log(' ', l));

console.log('=== bsd-fetcher: history/result fields ===');
const bf = fs.readFileSync('src/lib/bsd-fetcher.ts', 'utf8');
for (const pat of ['history', 'recent', 'form', 'wins', 'head2head', 'lastMatches', 'pastMatches']) {
  const idx = bf.indexOf(pat);
  if (idx !== -1) console.log('mentions:', pat, '->', bf.slice(Math.max(0, idx - 60), idx + 80).replace(/\s+/g, ' ').slice(0, 140));
}

console.log('=== pm2 config / cron files ===');
console.log(run('dir /b ecosystem* pm2* 2>nul'));
console.log(run('node -e "const fs=require(\'fs\');[`ecosystem.config.js`,`pm2.config.cjs`,`scripts/pm2*.js`].forEach(f=>{if(fs.existsSync(f))console.log(f)})"'));

console.log('=== TennisMatch result field? ===');
const pr = fs.readFileSync('prisma/schema.prisma', 'utf8');
const tm = pr.match(/model TennisMatch \{[\s\S]*?\n\}/);
console.log(tm[0]);