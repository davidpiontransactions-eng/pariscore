const fs = require('fs');
const p = '.next/BUILD_ID';
console.log('BUILD_ID:', fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : 'MISSING');
console.log('standalone server:', fs.existsSync('.next/standalone/server.js') ? 'OK' : 'MISSING');