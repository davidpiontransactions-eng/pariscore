const fs = require('fs');
const r = require('child_process');
function run(cmd) { try { return r.execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }
console.log('=== prisma client usage ===');
console.log(run('findstr /s /n /c:"new PrismaClient" src\\*.ts src\\lib\\*.ts src\\lib\\**\\*.ts 2>nul').slice(0, 800));
console.log('=== existing snapshot-ish code? ===');
console.log(run('findstr /s /n /c:"EloSnapshot" /c:"weekIso" src\\*.ts src\\lib\\*.ts 2>nul').slice(0, 400));