const fs = require('fs');
const r = require('child_process');
function run(cmd) { try { return r.execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }
console.log('=== src/types dir ===');
console.log(run('dir /b src\\types 2>nul'));
console.log('=== TennisMatch type def ===');
const bf = fs.readFileSync('src/lib/bsd-tennis-service.ts', 'utf8');
const m = bf.match(/export (?:interface|type) TennisMatch[\s\S]*?\n\}/);
console.log(m ? m[0] : 'not in bsd-tennis-service');
console.log('=== tennis dirs ===');
console.log(run('dir /b src\\lib | findstr /i tennis'));