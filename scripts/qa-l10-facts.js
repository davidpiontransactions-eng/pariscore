const fs = require('fs');
const r = require('child_process');
function run(cmd) { try { return r.execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }

console.log('=== PRISMA SCHEMA (models) ===');
const pr = fs.readFileSync('prisma/schema.prisma', 'utf8');
pr.split(/\r?\n/).forEach((l) => { if (/^model /.test(l)) console.log(l.trim()); });
console.log('=== CRON SCRIPTS (package.json) ===');
const pj = JSON.parse(fs.readFileSync('package.json', 'utf8'));
Object.entries(pj.scripts || {}).filter(([k]) => /cron|schedule|scrape/.test(k)).forEach(([k, v]) => console.log(k, '=>', v.slice(0, 90)));
console.log('=== TENNIS SERVICE ===');
console.log(run('dir /b src\\services').slice(0, 400));
console.log('=== TENNIS TYPES (L10?) ===');
const tt = fs.readFileSync('src/types/tennis.ts', 'utf8');
console.log('L10 mention:', /L10/i.test(tt) ? 'YES' : 'NO');
console.log('=== ELO existing? ===');
const rg = run('node -e "const fs=require(\'fs\');const f=\'src/lib/tennis-elo.ts\';console.log(fs.existsSync(f)?\'lib/tennis-elo.ts EXISTS\':\'no lib/tennis-elo.ts\')"');
console.log(rg);