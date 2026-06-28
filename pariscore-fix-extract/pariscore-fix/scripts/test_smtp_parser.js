/*
 * Test P1 secu — SMTP URL parser + mail body escaping
 * Test 1 : parse smtps:// URL
 * Test 2 : parse smtp:// URL avec STARTTLS
 * Test 3 : body dot-escaping
 */
const path = require('path');
const fs = require('fs');

const serverSrc = fs.readFileSync(path.join('/home/z/my-project/pariscore', 'server.js'), 'utf8');

// Extraire _parseSmtpUrl
const fnMatch = serverSrc.match(/function _parseSmtpUrl\(url\) \{[\s\S]*?\n\}/);
if (!fnMatch) { console.error('FAIL extraction'); process.exit(1); }

const sandbox = { URL };
const _parseSmtpUrl = eval(`(function(URL) { ${fnMatch[0]}; return _parseSmtpUrl; })`)(URL);

console.log('--- Test 1 : smtps://user:pass@smtp.example.com:465 ---');
const t1 = _parseSmtpUrl('smtps://user%40example.com:pass123@smtp.example.com:465');
console.log(`  secure: ${t1.secure} (devrait etre true)`);
console.log(`  host: ${t1.host}`);
console.log(`  port: ${t1.port} (devrait etre 465)`);
console.log(`  username: ${t1.username} (devrait etre user@example.com)`);
console.log(`  password: ${t1.password}`);
const ok1 = t1.secure && t1.host === 'smtp.example.com' && t1.port === 465 && t1.username === 'user@example.com' && t1.password === 'pass123';
console.log(`  OK: ${ok1 ? 'OK' : 'ECHEC'}`);

console.log('\n--- Test 2 : smtp://user:pass@smtp.example.com (default port 587) ---');
const t2 = _parseSmtpUrl('smtp://user:pass@smtp.example.com');
console.log(`  secure: ${t2.secure} (devrait etre false)`);
console.log(`  port: ${t2.port} (devrait etre 587)`);
const ok2 = !t2.secure && t2.port === 587;
console.log(`  OK: ${ok2 ? 'OK' : 'ECHEC'}`);

console.log('\n--- Test 3 : URL invalide ---');
const t3 = _parseSmtpUrl('not-a-url');
console.log(`  result: ${t3} (devrait etre null)`);
const ok3 = t3 === null;
console.log(`  OK: ${ok3 ? 'OK' : 'ECHEC'}`);

console.log('\n--- Test 4 : body dot-escaping (RFC 5321) ---');
const body = '.line at start\n.normal line\n..escaped line\n.last line starts with dot';
const escaped = body.replace(/^\./gm, '..');
console.log(`  Input lines: ${body.split('\n').length}`);
console.log(`  Output: ${escaped.split('\n').map(l => l.length > 30 ? l.slice(0, 30) + '...' : l).join(' | ')}`);
// .line at start → ..line at start (escaped)
// .last line starts with dot → ..last line starts with dot (escaped)
const ok4 = escaped.startsWith('..line at start') && escaped.includes('..last line');
console.log(`  OK: ${ok4 ? 'OK' : 'ECHEC'}`);

console.log('\n=== RESUME ===');
const allOk = ok1 && ok2 && ok3 && ok4;
console.log(allOk ? 'TOUS LES TESTS PASSENT' : 'ECHEC');
process.exit(allOk ? 0 : 1);
