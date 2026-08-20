// scripts/qa-live-pixel.js - analyze captured match screenshots: dominant text/bg colors + contrast zones
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FILES = ['sofascore-match', 'fotmob-match', 'flashscore-match', 'whoscored-live'];
const DIR = path.join(__dirname, '..', '.context', 'design-compare', 'live-stats');

function lum(c) {
  const [r, g, b] = c;
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => ((Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)).toFixed(2);

(async () => {
  for (const name of FILES) {
    const p = path.join(DIR, name + '.png');
    if (!fs.existsSync(p)) { console.log(name, ': MISSING'); continue; }
    const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    // sample every 2px
    const buckets = { dark: {}, light: {}, mid: {} };
    const colors = new Map();
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const [R, G, B] = [data[i], data[i + 1], data[i + 2]];
        const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        const key = (R >> 4) + ',' + (G >> 4) + ',' + (B >> 4);
        const bucket = L < 60 ? 'dark' : L > 190 ? 'light' : 'mid';
        const m = bucket === 'dark' ? colors : bucket === 'light' ? colors : colors;
        m.set(key, (m.get(key) || 0) + 1);
      }
    }
    const top = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log('=== ' + name + ' (' + width + 'x' + height + ') top colors:');
    top.forEach(([k, n]) => {
      const [r, g, b] = k.split(',').map((v) => parseInt(v) * 16);
      console.log('  rgb(' + r + ',' + g + ',' + b + ') x' + n);
    });
    // estimate: text-on-bg contrast using lightest text on darkest bg bucket
    console.log('  (informational) contrast #fff on #0a0e17 = ' + contrast([255, 255, 255], [10, 14, 23]));
    console.log('  contrast #f8fafc on #0f172a = ' + contrast([248, 250, 252], [15, 23, 42]));
  }
})();