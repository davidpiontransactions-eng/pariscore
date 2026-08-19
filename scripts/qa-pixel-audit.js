// scripts/qa-pixel-audit.js - compare green/red/blue presence in screenshots
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('@playwright/test');

const files = process.argv.slice(2);
if (!files.length) { console.log('usage: node scripts/qa-pixel-audit.js <png1> <png2> ...'); process.exit(1); }

(async () => {
  const served = {};
  const srv = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.slice(1) || '');
    if (name === '') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><canvas id=c></canvas>');
      return;
    }
    const abs = served[name];
    if (!abs) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(abs));
  });
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch();
  const p = await b.newPage();

  const results = [];
  for (const f of files) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) { console.log('MISSING ' + f); continue; }
    const name = 'f' + Math.random().toString(36).slice(2) + '.png';
    served[name] = abs;
    await p.goto('http://localhost:' + port + '/');
    const r = await p.evaluate(async (name) => {
      const img = new Image();
      img.src = name;
      await new Promise(res => { img.onload = res; img.onerror = res; });
      if (!img.naturalWidth) return { w: 0, error: 'img-not-loaded' };
      const c = document.getElementById('c');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let green = 0, red = 0, blue = 0, gray = 0, bright = 0;
      const total = c.width * c.height;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], bl = d[i + 2];
        if (g > 140 && g > r * 1.4 && g > bl * 1.4) green++;
        if (r > 140 && r > g * 1.4 && r > bl * 1.4) red++;
        if (bl > 140 && bl > r * 1.4 && bl > g * 1.4) blue++;
        const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
        if (mx - mn < 12 && mx > 40 && mx < 220) gray++;
        if (mx > 200) bright++;
      }
      return { w: c.width, h: c.height, green, red, blue, gray, bright, total };
    }, name);
    console.log(f + ' => ' + JSON.stringify(r));
    results.push({ f, ...r });
  }
  await b.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });