const fs = require('fs');
const p = require('path').join(__dirname, '..', 'src/components/tennis/match-card-broadcast.tsx');
let s = fs.readFileSync(p, 'utf8');
const n = (s.match(/tTennis\("offline"\)/g) || []).length;
s = s.split('tTennis("offline")').join('t("offline")');
fs.writeFileSync(p, s);
console.log('replaced', n, 'occurrences of tTennis("offline") -> t("offline")');