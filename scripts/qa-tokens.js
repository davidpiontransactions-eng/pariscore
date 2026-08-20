const fs = require('fs');
const g = fs.readFileSync('src/app/globals.css', 'utf8');
const lines = g.split(/\r?\n/);
lines.forEach((l, i) => {
  if (/--muted-foreground|--card|--background|--foreground|--accent|--primary/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim());
});