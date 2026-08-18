// Démarre le dev server Next en detached (pattern validé).
const { spawn } = require('child_process');
const fs = require('fs');

const log = fs.openSync('dev-qa.log', 'a');
const p = spawn('C:\\Users\\David\\.bun\\bin\\bun.exe', ['run', 'dev'], {
  cwd: process.cwd(),
  detached: true,
  stdio: ['ignore', log, log],
});
console.log('PID', p.pid);
p.unref();