const fs = require('fs');
const r = require('child_process');
function run(cmd) { try { return r.execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }
console.log('=== .github/workflows ===');
console.log(run('dir /b .github\\workflows'));
console.log('=== refresh-rankings.yml (first 40 lines) ===');
const wf = fs.readFileSync('.github/workflows/refresh-rankings.yml', 'utf8');
console.log(wf.split(/\r?\n/).slice(0, 40).join('\n'));
console.log('=== tennis-elo used where ===');
const rg = run('node -e "const fs=require(\'fs\');function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=d+\'/\'+f.name;if(f.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(f.name)){const s=fs.readFileSync(p,\'utf8\');if(/lookupAbstractElo|tennis-elo/.test(s))console.log(p)}}}walk(\'src\')"');
console.log(rg.slice(0, 800));