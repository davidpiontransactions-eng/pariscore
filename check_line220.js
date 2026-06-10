const fs = require('fs');
const code = fs.readFileSync('seed_historique_bsd_corners.js');
const lines = code.toString().split('\n');

const line220 = lines[219]; // 0-indexed
console.log('Line 220:', JSON.stringify(line220));
console.log('Line 220 hex:', Buffer.from(line220).toString('hex'));

// Count quotes in line 220
const quotePositions = [];
for (let i = 0; i < line220.length; i++) {
  if (line220[i] === "'") quotePositions.push(i);
}
console.log('Quote positions in line 220:', quotePositions);
console.log('Characters at quote positions:', quotePositions.map(p => JSON.stringify(line220[p])));

// Check for escape sequences
const escapePositions = [];
for (let i = 0; i < line220.length; i++) {
  if (line220[i] === '\\') escapePositions.push(i);
}
console.log('Escape positions:', escapePositions);