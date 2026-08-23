const fs = require('fs');
const s = fs.readFileSync('ecosystem.config.js', 'utf8');
// find the cron-dr block
const i = s.indexOf('pariscore-cron-dr');
console.log(s.slice(i - 200, i + 2200));