const fs = require('fs');
const s = fs.readFileSync('ecosystem.config.js', 'utf8');
const i = s.indexOf("name: 'pariscore-next'");
console.log(s.slice(Math.max(0, i - 600), i + 700));