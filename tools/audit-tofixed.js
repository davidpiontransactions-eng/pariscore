// tools/audit-tofixed.js — bd izsn
// Audit .toFixed() unguarded vs safeFixed() wrapped in pariscore.html
// Usage : node tools/audit-tofixed.js [--apply]
//   --apply : ré-écrit le fichier avec transformations (sinon dry-run + diff preview)

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'pariscore.html');
const apply = process.argv.includes('--apply');

const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split(/\r?\n/);

// Pattern wave 2 : identifier (avec .member ou [idx] ou ?.) suivi de .toFixed(N)
// Exclut paren expressions ((a+b).toFixed) car le caractère précédent est ')'.
const RX = /([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])*)\.toFixed\((\d+)\)/g;

// Heuristiques skip ciblées (pas guard global)
function shouldSkipMatch(line, matchIdx, identStr) {
  // Comment line
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return true;
  // Numeric literal LHS (rare : 0.5.toFixed) — pattern n'attrape pas mais safety
  if (/^\d/.test(identStr)) return true;
  // Char précédent : si ')', le LHS est une paren expression que notre regex n'a pas capturé
  // dans ce cas notre match commence APRES la paren, sur un sous-ident — skip pour ne pas casser
  const prev = matchIdx > 0 ? line[matchIdx - 1] : '';
  if (prev === ')') return true;
  // Si déjà dans safeFixed(... .toFixed) — pattern bizarre, ne devrait pas exister mais safe
  const before = line.slice(Math.max(0, matchIdx - 20), matchIdx);
  if (before.includes('safeFixed(')) return true;
  return false;
}

let totalMatches = 0;
let safeFixedCount = 0;
let toBeWrapped = 0;
let skippedGuarded = 0;
const changes = []; // { lineNo, before, after }

const newLines = lines.map((line, idx) => {
  // count safeFixed occurrences
  const sfMatches = line.match(/safeFixed\(/g);
  if (sfMatches) safeFixedCount += sfMatches.length;

  let lineChanged = false;
  const allMatches = [...line.matchAll(RX)];
  if (!allMatches.length) return line;

  // Per-match replace avec skip granulaire
  let modified = '';
  let cursor = 0;
  for (const m of allMatches) {
    totalMatches++;
    const matchIdx = m.index;
    const ident = m[1];
    const digits = m[2];
    modified += line.slice(cursor, matchIdx);
    if (shouldSkipMatch(line, matchIdx, ident)) {
      skippedGuarded++;
      modified += m[0];
    } else {
      // ?.member dans ident => safeFixed le gère (renvoie '—' si val null)
      modified += `safeFixed(${ident}, ${digits})`;
      toBeWrapped++;
      lineChanged = true;
    }
    cursor = matchIdx + m[0].length;
  }
  modified += line.slice(cursor);

  if (lineChanged) {
    changes.push({ lineNo: idx + 1, before: line, after: modified });
  }
  return modified;
});

console.log('=== AUDIT .toFixed() — pariscore.html ===');
console.log(`Total .toFixed() matches (member access pattern) : ${totalMatches}`);
console.log(`Existing safeFixed() calls                       : ${safeFixedCount}`);
console.log(`Lines skipped (already guarded)                  : ${skippedGuarded}`);
console.log(`Candidates wrapped                               : ${toBeWrapped}`);
console.log(`Lines modified                                   : ${changes.length}`);

if (changes.length && !apply) {
  console.log('\n--- DIFF PREVIEW (first 20 changes) ---');
  changes.slice(0, 20).forEach(c => {
    console.log(`L${c.lineNo}:`);
    console.log(`  - ${c.before.trim().slice(0, 140)}`);
    console.log(`  + ${c.after.trim().slice(0, 140)}`);
  });
  if (changes.length > 20) console.log(`... + ${changes.length - 20} more`);
  console.log('\nRun with --apply to write changes.');
} else if (apply) {
  fs.writeFileSync(FILE, newLines.join('\n'), 'utf8');
  console.log(`\n✓ Wrote ${changes.length} line(s) to ${FILE}`);
}
