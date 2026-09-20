var path = require('path');
var s = require(path.join(__dirname, '..', 'services', 'mmaService'));
var g = s.getOdds1xBet();
console.log('raw fights:', g ? g.fights.length : 0);
if (g && g.fights.length) {
  var now = Date.now();
  var f = g.fights[0];
  console.log('first fight:', f.fighter1, 'vs', f.fighter2);
  console.log('start_time:', f.start_time, 'commence_time:', f.commence_time);
  var isoDate = new Date(f.start_time * 1000).toISOString();
  console.log('isoDate:', isoDate);
  var parsedDate = new Date(isoDate).getTime();
  console.log('parsedMs:', parsedDate, 'now:', now, 'diff:', parsedDate - now);
}
