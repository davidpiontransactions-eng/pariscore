// tools/audit-tofixed-server.js — bd izsn
// Audit + classify .toFixed() in server.js (raw vs ternary-guarded vs parseFloat-wrapped).
// Wraps RAW + TERNARY candidates with safeFixed(); leaves parseFloat-storage + paren-expr untouched.
// Special exclusion: `+ident.toFixed(N)` (unary numeric coercion) — leave alone.
//
// Usage: node tools/audit-tofixed-server.js [--apply]
//   --apply : rewrite file in-place. Otherwise dry-run + preview.

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'server.js');
const apply = process.argv.includes('--apply');

const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split(/\r?\n/);

const RX = /([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])*)\.toFixed\((\d+)\)/g;

const cats = { ternary: 0, parenExpr: 0, parseFloatStorage: 0, unaryPlus: 0, alreadyGuarded: 0, raw: 0, commentSkip: 0 };
const changes = [];

const newLines = lines.map((line, idx) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
    const m = line.match(RX);
    if (m) cats.commentSkip += m.length;
    return line;
  }
  const allMatches = [...line.matchAll(RX)];
  if (!allMatches.length) return line;

  let modified = '';
  let cursor = 0;
  let lineChanged = false;
  for (const m of allMatches) {
    const matchIdx = m.index;
    const ident = m[1];
    const digits = m[2];
    modified += line.slice(cursor, matchIdx);

    const prev = matchIdx > 0 ? line[matchIdx - 1] : '';
    if (prev === ')') {
      cats.parenExpr++;
      modified += m[0];
      cursor = matchIdx + m[0].length;
      continue;
    }

    const before30 = line.slice(Math.max(0, matchIdx - 30), matchIdx);
    if (before30.includes('safeFixed(')) {
      cats.alreadyGuarded++;
      modified += m[0];
      cursor = matchIdx + m[0].length;
      continue;
    }

    // parseFloat(IDENT.toFixed(N)) — storage rounding, leave intact (intentional rounding).
    const before100 = line.slice(Math.max(0, matchIdx - 100), matchIdx);
    const pfIdx = before100.lastIndexOf('parseFloat(');
    if (pfIdx !== -1) {
      const inside = before100.slice(pfIdx + 'parseFloat('.length);
      let depth = 1;
      for (const c of inside) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        if (depth === 0) break;
      }
      if (depth > 0) {
        cats.parseFloatStorage++;
        modified += m[0];
        cursor = matchIdx + m[0].length;
        continue;
      }
    }

    // +IDENT.toFixed(N) — unary numeric coercion (e.g. `edge: +x.toFixed(2)`). Leave.
    const beforeIdentChar = matchIdx > 0 ? line[matchIdx - 1] : '';
    if (beforeIdentChar === '+') {
      const beforePlus = matchIdx > 1 ? line[matchIdx - 2] : '';
      if (!/[\w)\]]/.test(beforePlus)) {
        cats.unaryPlus++;
        modified += m[0];
        cursor = matchIdx + m[0].length;
        continue;
      }
    }

    // Ternary-guarded: `?`, `&&`, `||` just before — still wrap (NaN protection over `!= null`).
    const before20 = line.slice(Math.max(0, matchIdx - 20), matchIdx);
    if (/(\?|&&|\|\|)\s*$/.test(before20)) {
      cats.ternary++;
    } else {
      cats.raw++;
    }
    modified += `safeFixed(${ident}, ${digits})`;
    cursor = matchIdx + m[0].length;
    lineChanged = true;
  }
  modified += line.slice(cursor);

  if (lineChanged) {
    changes.push({ lineNo: idx + 1, before: line, after: modified });
  }
  return modified;
});

console.log('=== AUDIT .toFixed() — server.js ===');
console.log(JSON.stringify(cats, null, 2));
console.log('Lines modified candidates :', changes.length);

if (changes.length && !apply) {
  console.log('\n--- DIFF PREVIEW (first 30 changes) ---');
  changes.slice(0, 30).forEach(c => {
    console.log(`L${c.lineNo}:`);
    console.log(`  - ${c.before.trim().slice(0, 160)}`);
    console.log(`  + ${c.after.trim().slice(0, 160)}`);
  });
  if (changes.length > 30) console.log(`... + ${changes.length - 30} more`);
  console.log('\nRun with --apply to write changes.');
} else if (apply) {
  fs.writeFileSync(FILE, newLines.join('\n'), 'utf8');
  console.log(`\nWrote ${changes.length} line(s) to ${FILE}`);
}
