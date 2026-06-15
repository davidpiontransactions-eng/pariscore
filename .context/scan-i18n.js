const fs = require('fs');
const html = fs.readFileSync('pariscore.html', 'utf8');
const di18n = new Set();
const re1 = /data-i18n=['"]([^'"]+)/g;
let m;
while ((m = re1.exec(html)) !== null) di18n.add(m[1]);
console.log('data-i18n keys (' + di18n.size + '):');
[...di18n].sort().forEach(k => console.log('  ' + k));

const ti18n = new Set();
const re2 = /I18N\.t\s*\(\s*['"]([^'"]+)/g;
while ((m = re2.exec(html)) !== null) ti18n.add(m[1]);
console.log('\nI18N.t() keys (' + ti18n.size + '):');
[...ti18n].sort().forEach(k => console.log('  ' + k));

const allWired = new Set([...di18n, ...ti18n]);
console.log('\nTotal wired keys: ' + allWired.size);

const fr = require('./locales/fr.json');
const allKeys = Object.keys(fr);
console.log('Total available keys in fr.json: ' + allKeys.length);
console.log('Keys NOT wired yet: ' + (allKeys.length - allWired.size));
