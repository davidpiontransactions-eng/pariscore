'use strict';
// Offline unit test — WOM direction + math (no network/creds). bd 17y6.
const b = require('../betfairService');

let fail = 0;
const approx = (a, x, t = 0.6) => Math.abs(a - x) <= t;
const ok = (c, msg) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + msg); if (!c) fail++; };

// Foot : home fortement backé (gros availableToLay = argent qui BACK home).
const footRunners = [
  { selectionId: 1, key: 'home', name: 'Home' },
  { selectionId: 2, key: 'draw', name: 'Draw' },
  { selectionId: 3, key: 'away', name: 'Away' },
];
const footBook = { runners: [
  { selectionId: 1, status: 'ACTIVE', ex: { availableToBack: [{ price: 2.0, size: 100 }], availableToLay: [{ price: 2.02, size: 900 }] } },
  { selectionId: 2, status: 'ACTIVE', ex: { availableToBack: [{ price: 3.5, size: 300 }], availableToLay: [{ price: 3.55, size: 300 }] } },
  { selectionId: 3, status: 'ACTIVE', ex: { availableToBack: [{ price: 4.0, size: 500 }], availableToLay: [{ price: 4.1, size: 100 }] } },
] };
const f = b._computeWom(footRunners, footBook, false);
console.log('foot:', JSON.stringify(f.wom), 'skew=', f.skew);
ok(approx(f.wom.home, 90), 'home backé → wom.home ≈ 90% (got ' + f.wom.home + ')');
ok(approx(f.wom.draw, 50), 'draw équilibré → wom.draw ≈ 50% (got ' + f.wom.draw + ')');
ok(approx(f.wom.away, 16.7), 'away layé → wom.away ≈ 16.7% (got ' + f.wom.away + ')');
ok(f.skew > 0.5, 'skew positif (argent côté home) (got ' + f.skew + ')');
ok(approx(f.odds.home, 2.01, 0.05), 'fair home ≈ mid(2.0,2.02) (got ' + f.odds.home + ')');

// Depth : seuls les 3 meilleurs niveaux comptent.
const depthBook = { runners: [
  { selectionId: 1, status: 'ACTIVE', ex: { availableToBack: [{ price: 2, size: 10 }], availableToLay: [
    { price: 2.1, size: 100 }, { price: 2.2, size: 100 }, { price: 2.3, size: 100 }, { price: 2.4, size: 9999 }] } },
] };
const d = b._computeWom([{ selectionId: 1, key: 'home', name: 'H' }], depthBook, false);
ok(d.sample[0].backMoney === 300, 'top-3 only : backMoney = 300, ignore 4e niveau (got ' + d.sample[0].backMoney + ')');

// Tennis : p2 backé → skew négatif.
const tBook = { runners: [
  { selectionId: 11, status: 'ACTIVE', ex: { availableToBack: [{ price: 1.8, size: 800 }], availableToLay: [{ price: 1.82, size: 200 }] } },
  { selectionId: 12, status: 'ACTIVE', ex: { availableToBack: [{ price: 2.1, size: 100 }], availableToLay: [{ price: 2.15, size: 700 }] } },
] };
const t = b._computeWom([{ selectionId: 11, key: 'p1', name: 'P1' }, { selectionId: 12, key: 'p2', name: 'P2' }], tBook, true);
console.log('tennis:', JSON.stringify(t.wom), 'skew=', t.skew);
ok(t.wom.p2 > t.wom.p1, 'p2 plus backé que p1 (got p1=' + t.wom.p1 + ' p2=' + t.wom.p2 + ')');
ok(t.skew < 0, 'skew négatif (argent côté p2) (got ' + t.skew + ')');

// Garde-fous : book vide / runner removed.
const empty = b._computeWom(footRunners, { runners: [] }, false);
ok(Object.keys(empty.wom).length === 0, 'book vide → wom {} (got ' + JSON.stringify(empty.wom) + ')');
ok(b.enabled() === false, 'enabled() false sans .env (inerte)');

console.log(fail === 0 ? '\nALL PASS ✓' : '\n' + fail + ' FAIL ✗');
process.exit(fail === 0 ? 0 : 1);
