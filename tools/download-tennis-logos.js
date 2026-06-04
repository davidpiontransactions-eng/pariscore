#!/usr/bin/env node
/**
 * download-tennis-logos.js
 * 1. Get article wikitext → parse logo= from infobox
 * 2. Try Wikimedia Commons imageinfo URL
 * 3. Fallback: try English Wikipedia imageinfo URL (local files)
 * 4. Download and save to assets/tennis-logos/
 * 5. Write map.json (only entries with valid files on disk)
 */
'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'tennis-logos');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Purge junk on startup (< 5KB likely wrong file)
for (const f of fs.readdirSync(OUT_DIR).filter(f => f !== 'map.json')) {
  const p = path.join(OUT_DIR, f);
  if (fs.statSync(p).size < 5000) {
    fs.unlinkSync(p);
    process.stdout.write(`🗑 purged junk: ${f}\n`);
  }
}

const ARTICLES = {
  'Roland Garros':           'French_Open',
  'Wimbledon':               'The_Championships,_Wimbledon',
  'US Open':                 'US_Open_(tennis)',
  'Australian Open':         'Australian_Open',
  'Cincinnati':              'Western_%26_Southern_Open',
  'Western & Southern Open': 'Western_%26_Southern_Open',
  'Madrid':                  'Madrid_Open_(tennis)',
  'Madrid Open':             'Madrid_Open_(tennis)',
  'Monte-Carlo':             'Monte-Carlo_Masters',
  'Indian Wells':            'BNP_Paribas_Open',
  'Miami':                   'Miami_Open_(tennis)',
  'Miami Open':              'Miami_Open_(tennis)',
  'Rome':                    'Italian_Open_(tennis)',
  'Italian Open':            'Italian_Open_(tennis)',
  'Canadian Open':           'National_Bank_Open',
  'Shanghai':                'Shanghai_Masters',
  'Paris Bercy':             'Paris_Masters',
  'ATP Finals':              'Nitto_ATP_Finals',
  'Barcelona':               'Barcelona_Open',
  'Halle':                   'Halle_Open',
  "Queen's Club":            "Queen%27s_Club_Championships",
  'Vienna':                  'Erste_Bank_Open',
  'Dubai':                   'Dubai_Duty_Free_Tennis_Championships',
  'Hamburg':                 'Hamburg_Open_(tennis)',
};

function slugify(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'PariScore/1.0 (logo-downloader; david.piontransactions@gmail.com)' },
      timeout: 20000,
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : 'https://en.wikipedia.org' + res.headers.location;
        fetchUrl(loc).then(resolve).catch(reject); return;
      }
      if (res.statusCode === 429) { reject(new Error('rate-limit')); return; }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ data: Buffer.concat(c), ct: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseLogoFromWikitext(text) {
  const pats = [
    /\|\s*logo\s*=\s*([^\|\}\n]+)/i,
    /\|\s*logo_image\s*=\s*([^\|\}\n]+)/i,
    /\|\s*image\s*=\s*([^\|\}\n]+)/i,
  ];
  for (const re of pats) {
    const m = text.match(re);
    if (!m) continue;
    let f = m[1].trim()
      .replace(/\[\[(?:File|Image):/i, '')
      .replace(/\]\].*$/, '')
      .replace(/^(?:File|Image):/i, '')
      .split('|')[0].trim();
    if (f.length > 3) return f;
  }
  return null;
}

async function getInboxLogo(article) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${article}&prop=wikitext&format=json&section=0&redirects=1`;
  const r = await fetchUrl(url);
  const j = JSON.parse(r.data.toString());
  if (!j.parse) throw new Error('no parse');
  const logo = parseLogoFromWikitext(j.parse.wikitext['*']);
  if (!logo) throw new Error('no logo in infobox');
  return logo;
}

async function resolveImageUrl(filename) {
  // Try Wikimedia Commons first
  for (const base of ['https://commons.wikimedia.org', 'https://en.wikipedia.org']) {
    try {
      const u = `${base}/w/api.php?action=query&prop=imageinfo&iiprop=url&titles=File:${encodeURIComponent(filename)}&format=json&redirects=1`;
      const r = await fetchUrl(u);
      const j = JSON.parse(r.data.toString());
      const page = Object.values(j.query.pages)[0];
      if (page && page.imageinfo && page.imageinfo[0] && page.imageinfo[0].url) {
        const imgUrl = page.imageinfo[0].url;
        // Verify it's not a placeholder (too small)
        return imgUrl;
      }
    } catch (_) {}
    await sleep(300);
  }
  throw new Error(`not found on Commons or Wikipedia`);
}

function extFrom(url, ct) {
  const u = (url || '').toLowerCase().split('?')[0];
  if (u.endsWith('.svg') || (ct && ct.includes('svg'))) return '.svg';
  if (u.endsWith('.png') || (ct && ct.includes('png'))) return '.png';
  if (u.endsWith('.gif') || (ct && ct.includes('gif'))) return '.gif';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg') || (ct && ct.includes('jpeg'))) return '.jpg';
  return '.png';
}

async function downloadOne(name) {
  const slug = slugify(name);
  // Check valid cache (>= 5KB)
  for (const ext of ['.svg', '.png', '.jpg', '.jpeg', '.gif']) {
    const p = path.join(OUT_DIR, slug + ext);
    if (fs.existsSync(p) && fs.statSync(p).size >= 5000) {
      process.stdout.write(`  ✓ cached  ${name} (${slug}${ext})\n`);
      return `/assets/tennis-logos/${slug}${ext}`;
    }
  }

  const article = ARTICLES[name];
  if (!article) return null;

  try {
    const logoFile = await getInboxLogo(article);
    await sleep(500);
    const imgUrl = await resolveImageUrl(logoFile);
    await sleep(300);
    const res = await fetchUrl(imgUrl);

    // Skip if too small (likely an error page or placeholder)
    if (res.data.length < 1000) throw new Error(`file too small (${res.data.length}b) — likely wrong`);

    const ext = extFrom(imgUrl, res.ct);
    const out = path.join(OUT_DIR, slug + ext);
    fs.writeFileSync(out, res.data);
    process.stdout.write(`  ✓ ${name} → ${slug}${ext}  [${logoFile.substring(0,45)}]  ${res.data.length}b\n`);
    return `/assets/tennis-logos/${slug}${ext}`;
  } catch (e) {
    process.stdout.write(`  ✗ ${name}: ${e.message}\n`);
    return null;
  }
}

async function main() {
  const names = [...new Set(Object.keys(ARTICLES))];
  console.log(`\nDownloading ${names.length} tournament logos…\n`);

  const map = {};
  for (const name of names) {
    const local = await downloadOne(name);
    if (local) map[name] = local;
    await sleep(800);
  }

  // Rebuild map only from valid files on disk
  const finalMap = {};
  for (const [name, loc] of Object.entries(map)) {
    const abs = path.join(__dirname, '..', loc);
    if (fs.existsSync(abs) && fs.statSync(abs).size >= 1000) {
      finalMap[name] = loc;
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'map.json'), JSON.stringify(finalMap, null, 2));
  console.log(`\n✓ Done — ${Object.keys(finalMap).length}/${names.length} valid logos`);
  for (const [k,v] of Object.entries(finalMap)) console.log(`   ${k}: ${v}`);
}

main().catch(e => { console.error(e); process.exit(1); });
