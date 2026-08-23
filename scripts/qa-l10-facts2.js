const fs = require('fs');
const r = require('child_process');
function run(cmd) { try { return r.execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }
console.log('=== src/lib/tennis-elo/ ===');
console.log(run('dir /b src\\lib\\tennis-elo'));
console.log('=== cacheFilePath ===');
const s = fs.readFileSync('src/lib/tennis-elo/scraper.ts', 'utf8');
const tail = s.slice(s.indexOf('cacheFilePath'));
console.log(tail.slice(0, 600));
console.log('=== PRISMA TennisMatch ===');
const pr = fs.readFileSync('prisma/schema.prisma', 'utf8');
const m = pr.match(/model TennisMatch \{[\s\S]*?\n\}/);
console.log(m ? m[0] : 'NOT FOUND');
console.log('=== types tennis location ===');
console.log(run('node -e "const fs=require(\'fs\');const d=\'src/types\';console.log(fs.existsSync(d)?fs.readdirSync(d,{recursive:true}).filter(f=>/tennis/i.test(f)).join(\'\\n\'):\'no src/types\')"'));