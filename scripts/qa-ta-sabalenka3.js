// scripts/qa-ta-sabalenka3.js - parse jsfrags match data
const fs = require('fs');
async function fetchJsfrag(name) {
  const url = `https://www.tennisabstract.com/jsfrags/${name}.js`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const txt = await res.text();
  console.log('==', name, 'status', res.status, 'len', txt.length);
  fs.writeFileSync(`scripts/tmp-${name}.js`, txt);
  // print first 2500 chars
  console.log(txt.slice(0, 2500));
  return txt;
}
(async () => {
  await fetchJsfrag('ArynaSabalenka');
  console.log('\n\n############################################\n');
  await fetchJsfrag('SaraBejlek');
})();