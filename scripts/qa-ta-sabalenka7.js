// scripts/qa-ta-sabalenka7.js - deep-inspect jsfrags content
const fs = require('fs');
const src = fs.readFileSync('scripts/tmp-ArynaSabalenka.js', 'utf8');
console.log('len', src.length);
const tbodies = src.match(/<tbody>([\s\S]*?)<\/tbody>/gs) || [];
console.log('tbodies:', tbodies.length);
const trs = src.match(/<tr[\s\S]*?<\/tr>/gs) || [];
console.log('trs:', trs.length);
// look for multiple tables ids
const ids = [...new Set([...src.matchAll(/<table[^>]*id="([^"]+)"/g)].map((m) => m[1]))];
console.log('table ids:', ids);
// look for other data URLs
const urls = [...new Set([...src.matchAll(/["']([^"']*(?:classic|matches|matchlog|results|all)[^"']*)["']/gi)].map((m) => m[1]))].slice(0, 15);
console.log('data url refs:', urls);
// check the classic file for jsfrags refs
const cl = fs.readFileSync('scripts/tmp-classic-ArynaSabalenka.html', 'utf8');
const jsrefs = [...new Set([...cl.matchAll(/["']([^"']*jsfrags[^"']*)["']/g)].map((m) => m[1]))];
console.log('classic jsfrags refs:', jsrefs);
// check if classic page has inline match data variables
for (const v of ['matches', 'allmatches', 'matchlist', 'fullmatches', 'results']) {
  if (cl.includes('var ' + v)) console.log('classic has var ' + v);
}
// maybe classic page includes a jsfrags file with 'AllResults' or 'Classic'
const alljs = [...new Set([...cl.matchAll(/["'](?:https?:\/\/[^"']*)?\/?jsfrags\/([^"']+)["']/g)].map((m) => m[1]))];
console.log('classic jsfrags:', alljs);