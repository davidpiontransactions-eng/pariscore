// Regression test: all 8 fighters of the current UFC card resolve, via the curated
// photo map, to a RESIZED ESPN headshot (combiner) — guards against the map being
// reverted to full-res (10x heavier) or losing an entry. Curated-map hits are
// network-free (map is first in getFighterPhoto's cascade).
const m = require('../services/mmaService');

const EXPECT = {
  'Ketlen Souza':       '4566308',
  'Ariane Carnelossi':  '4565903',
  'Jeisla Chaves':      '5308769',
  'Yuneisy Duben':      '5211223',
  'Jordan Leavitt':     '4686565',
  'Joanderson Brito':   '4422355',
  'Priscila Cachoeira': '4277049',
  'Chelsea Chandler':   '4319785',
};

(async () => {
  let fail = 0;
  for (const [name, id] of Object.entries(EXPECT)) {
    const u = await m.getFighterPhoto(name);
    const ok = !!u && u.includes('/' + id + '.png') && u.includes('combiner') && /w=\d+/.test(u);
    if (!ok) { console.log('FAIL', name, '->', u); fail++; }
  }
  console.log(fail ? ('FAIL ' + fail + '/8') : 'PASS 8/8 curated fighters -> resized ESPN combiner headshot');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(2); });
