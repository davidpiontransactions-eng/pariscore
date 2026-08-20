const fs = require('fs');
const s = fs.readFileSync('src/components/football/football-live-card.tsx', 'utf8');
const lines = s.split(/\r?\n/);
lines.forEach((l, i) => {
  if (/metric|possession|shots|Shots|Possession|corner|Stats|stat|LiveStats/i.test(l)) {
    console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 130));
  }
});