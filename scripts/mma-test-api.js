require('dotenv').config();
var s = require('./services/mmaService');
s.getMMAFights(process.env.ODDS_API_KEY).then(function(r) {
  console.log('total events:', r.length);
  var total = 0;
  r.forEach(function(e) {
    console.log(' ', e.event_name, ':', e.fights.length, 'fights');
    total += e.fights.length;
    e.fights.forEach(function(f) {
      console.log('    ', f.fighter_a, 'vs', f.fighter_b, 'prob:', f.prob_a);
    });
  });
  console.log('TOTAL fights:', total);
}).catch(function(e) {
  console.log('ERROR:', e.message);
});
