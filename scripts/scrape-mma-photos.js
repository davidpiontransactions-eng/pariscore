#!/usr/bin/env node
/**
 * scrape-mma-photos.js — Batch scrape UFC fighter headshots
 *
 * Sources: agentmma.com (primary, robots-allowed) → ESPN fallback
 * Usage:
 *   node scripts/scrape-mma-photos.js                    # all ranked fighters
 *   node scripts/scrape-mma-photos.js --names "Islam Makhachev,Leon Edwards"
 *   node scripts/scrape-mma-photos.js --top 50           # top N ranked fighters
 *
 * Output: updates services/mma_fighter_photos.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PHOTOS_PATH = path.join(__dirname, '..', 'services', 'mma_fighter_photos.json');
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TOP_FIGHTERS = [
  'Jon Jones','Tom Aspinall','Ciryl Gane','Stipe Miocic','Alexander Volkov',
  'Sergei Pavlovich','Curtis Blaydes','Jairzinho Rozenstruik','Tai Tuivasa','Derrick Lewis',
  'Alex Pereira','Jamahal Hill','Jiri Prochazka','Glover Teixeira','Jan Blachowicz',
  'Magomed Ankalaev','Anthony Smith','Nikita Krylov','Johnny Walker','Khalil Rountree',
  'Dricus Du Plessis','Sean Strickland','Israel Adesanya','Robert Whittaker','Paulo Costa',
  'Jared Cannonier','Marvin Vettori','Nassourdine Imavov','Caio Borralho','Roman Kopylov',
  'Belal Muhammad','Leon Edwards','Kamaru Usman','Colby Covington','Gilbert Burns',
  'Stephen Thompson','Jorge Masvidal','Sean Brady','Jack Della Maddalena','Geoff Neal',
  'Islam Makhachev','Charles Oliveira','Dustin Poirier','Justin Gaethje','Beneil Dariush',
  'Michael Chandler','Rafael Fiziev','Mateusz Gamrot','Arman Tsarukyan','Dan Hooker',
  'Ilia Topuria','Max Holloway','Alexander Volkanovski','Yair Rodriguez','Brian Ortega',
  'Arnold Allen','Movsar Evloev','Calvin Kattar','Giga Chikadze','Josh Emmett',
  'Merab Dvalishvili','Sean O\'Malley','Aljamain Sterling','Cory Sandhagen','Peter Yan',
  'Umar Nurmagomedov','Deiveson Figueiredo','Henry Cejudo','Marlon Vera','Rob Font',
  'Alexandre Pantoja','Brandon Moreno','Brandon Royval','Mateus Nicolau','Muhammad Mokaev',
  'Zhang Weili','Rose Namajunas','Jessica Andrade','Mackenzie Dern','Tatiana Suarez',
  'Valentina Shevchenko','Alexa Grasso','Erin Blanchfield','Manon Fiorot',
];

function fighterSlug(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function headUrl(slug) {
  return `https://assets.agentmma.com/${slug}.png`;
}

function httpHead(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname, method: 'HEAD',
      headers: { 'User-Agent': BROWSER_UA },
    }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, type: res.headers['content-type'] || '' });
    });
    req.on('error', () => resolve({ status: 0, type: '' }));
    req.setTimeout(6000, () => { req.destroy(); resolve({ status: 0, type: '' }); });
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  let fighters = TOP_FIGHTERS;

  const namesIdx = args.indexOf('--names');
  if (namesIdx >= 0 && args[namesIdx + 1]) {
    fighters = args[namesIdx + 1].split(',').map(s => s.trim()).filter(Boolean);
  }
  const topIdx = args.indexOf('--top');
  if (topIdx >= 0 && args[topIdx + 1]) {
    fighters = TOP_FIGHTERS.slice(0, parseInt(args[topIdx + 1], 10));
  }

  let existing = {};
  try {
    const raw = JSON.parse(fs.readFileSync(PHOTOS_PATH, 'utf-8'));
    delete raw._doc;
    existing = raw;
  } catch (_) {}

  const added = [];
  const skipped = [];
  const notFound = [];

  for (const name of fighters) {
    const slug = fighterSlug(name);
    if (existing[slug]) { skipped.push(name); continue; }

    const url = headUrl(slug);
    const r = await httpHead(url);
    if (r.status === 200 && r.type.includes('image')) {
      existing[slug] = { url };
      added.push(name);
      process.stdout.write(`  + ${name}\n`);
    } else {
      notFound.push(name);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const doc = "MMA fighter photo memory map. Key = fighterSlug(name). Value = { url } or { sofascore_id }. Scraped from agentmma.com (robots-allowed assets host).";
  fs.writeFileSync(PHOTOS_PATH, JSON.stringify({ _doc: doc, ...existing }, null, 2) + '\n');
  process.stdout.write(`\nDone: +${added.length} added, ${skipped.length} skipped, ${notFound.length} not found\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
