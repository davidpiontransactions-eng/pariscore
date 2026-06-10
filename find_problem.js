const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('seed_historique_bsd_corners.js', 'utf8');

try {
  new vm.Script(code, { filename: 'seed_historique_bsd_corners.js' });
  console.log('OK - no syntax error');
} catch (e) {
  console.log('Error:', e.message);
  // Try to find where the problem is by checking incrementally
  for (let i = 1; i <= code.split('\n').length; i++) {
    const partial = code.split('\n').slice(0, i).join('\n');
    try {
      new vm.Script(partial + '\nEOF_MARKER');
    } catch (e2) {
      if (e2.message.includes('Unexpected end of input') || e2.message.includes('Unexpected token')) {
        console.log('Problem starts at or before line', i);
        console.log('Line', i, ':', JSON.stringify(code.split('\n')[i-1]));
        break;
      }
    }
  }
}