const r = require('child_process');
const o = r.execSync('findstr /s /n /c:"@/lib/prisma" /c:"@/lib/db" src\\app\\*.ts src\\app\\*.tsx 2>nul', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const lines = o.split(/\r?\n/).filter(Boolean);
console.log('API routes importing prisma/db:', lines.length);
console.log(lines.slice(0, 20).join('\n'));
const { execSync } = require('child_process');
const o2 = execSync('findstr /s /n /c:"lib/db" /c:"lib/prisma" src\\lib\\*.ts 2>nul', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
console.log('\nlib imports:', o2.split(/\r?\n/).filter(Boolean).slice(0, 10).join('\n'));