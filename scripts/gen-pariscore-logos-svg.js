// scripts/gen-pariscore-logos-svg.js - generate 3 SVG logo concepts + render PNG via Playwright
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '.context', 'logos');
fs.mkdirSync(OUT, { recursive: true });

const svgA = `<?xml version="1.0" encoding="UTF-8"?>
<!-- PariScore Logo Concept A - Arrow Score (prediction curve + balls + score badge) -->
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#0d1320"/>
      <stop offset="100%" stop-color="#06080e"/>
    </radialGradient>
    <linearGradient id="trend" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#00e676"/>
      <stop offset="55%" stop-color="#00c853"/>
      <stop offset="100%" stop-color="#29b6f6"/>
    </linearGradient>
    <linearGradient id="badgeFill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101725"/>
      <stop offset="100%" stop-color="#0a101b"/>
    </linearGradient>
    <linearGradient id="tennisG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7ec49"/>
      <stop offset="100%" stop-color="#d9c31c"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00e676" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#00e676" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="20" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="470" r="375" fill="url(#halo)"/>
  <circle cx="512" cy="470" r="355" fill="none" stroke="#1b2436" stroke-width="3"/>
  <circle cx="512" cy="470" r="332" fill="none" stroke="#121a29" stroke-width="1"/>

  <path d="M 218 640 C 330 612, 372 540, 452 516 C 528 494, 560 430, 648 396 C 716 370, 760 336, 824 268"
        fill="none" stroke="url(#trend)" stroke-width="22" stroke-linecap="round" filter="url(#glow)" opacity="0.5"/>
  <path d="M 218 640 C 330 612, 372 540, 452 516 C 528 494, 560 430, 648 396 C 716 370, 760 336, 824 268"
        fill="none" stroke="url(#trend)" stroke-width="13" stroke-linecap="round"/>

  <g transform="translate(226 650)">
    <circle r="34" fill="#f2f5fa" stroke="#cdd6e4" stroke-width="2"/>
    <path d="M 0 -34 L 12 -9 L 0 0 L -12 -9 Z" fill="#16202f"/>
    <path d="M 0 0 L 28 19 M 0 0 L -28 19 M 12 -9 L 34 10 M -12 -9 L -34 10" stroke="#16202f" stroke-width="3.5" fill="none"/>
  </g>

  <g transform="translate(470 522)">
    <circle r="28" fill="url(#tennisG)" stroke="#c9b318" stroke-width="2"/>
    <path d="M -25 -13 A 28 28 0 0 1 25 13 M -25 13 A 28 28 0 0 0 25 -13" stroke="#c9b318" stroke-width="5" fill="none" opacity="0.8"/>
  </g>

  <g transform="translate(660 392)">
    <circle r="26" fill="#e8761f" stroke="#c25e12" stroke-width="2"/>
    <path d="M 0 -26 L 0 26 M -26 0 L 26 0" stroke="#8a3f08" stroke-width="2.5" fill="none"/>
    <path d="M -13 -23 A 26 26 0 0 0 -13 23 M 13 -23 A 26 26 0 0 1 13 23" stroke="#8a3f08" stroke-width="2.5" fill="none"/>
  </g>

  <path d="M 824 268 L 786 312 L 806 322 Z" fill="#00e676" filter="url(#glow)"/>
  <path d="M 824 268 L 786 312 L 806 322 Z" fill="#00e676"/>

  <g transform="translate(285 238)">
    <rect width="220" height="110" rx="22" fill="url(#badgeFill)" stroke="#00e676" stroke-width="4" filter="url(#glow)"/>
    <rect width="220" height="110" rx="22" fill="url(#badgeFill)" stroke="#00e676" stroke-width="3"/>
    <text x="110" y="57" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="58" fill="#ffffff">2<tspan fill="#00e676">-</tspan><tspan fill="#29b6f6">1</tspan></text>
  </g>

  <text x="512" y="900" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="84" letter-spacing="2" fill="#f4f7fb">PARI<tspan fill="#00e676">SCORE</tspan></text>
  <text x="512" y="948" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="26" letter-spacing="9" fill="#5b6b82">PREDICTIONS SPORTIVES</text>
</svg>`;

const svgB = `<?xml version="1.0" encoding="UTF-8"?>
<!-- PariScore Logo Concept B - PS Monogram + rising trend (geometric) -->
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#0c1220"/>
      <stop offset="100%" stop-color="#05070d"/>
    </radialGradient>
    <linearGradient id="gA" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#00e676"/>
      <stop offset="100%" stop-color="#29b6f6"/>
    </linearGradient>
    <linearGradient id="gB" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00e676" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#00e676" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="18" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="460" r="350" fill="url(#halo)"/>
  <circle cx="512" cy="460" r="330" fill="none" stroke="#1b2436" stroke-width="3"/>

  <g transform="translate(512 460)">
    <polygon points="0,-230 200,-140 200,140 0,230 -200,140 -200,-140" fill="none" stroke="#00e676" stroke-width="10" stroke-linejoin="round" filter="url(#glow)" opacity="0.6"/>
    <polygon points="0,-230 200,-140 200,140 0,230 -200,140 -200,-140" fill="none" stroke="#00e676" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="0,-160 120,-80 120,80 0,160 -120,80 -120,-80" fill="none" stroke="#16202f" stroke-width="2"/>

    <path d="M -150 60 C -80 10, -40 -30, 20 -60 L 130 -20" fill="none" stroke="url(#gA)" stroke-width="16" stroke-linecap="round" filter="url(#glow)" opacity="0.7"/>
    <path d="M -150 60 C -80 10, -40 -30, 20 -60 L 130 -20" fill="none" stroke="url(#gA)" stroke-width="9" stroke-linecap="round"/>

    <circle cx="-150" cy="60" r="16" fill="#f7ec49"/>
    <circle cx="20" cy="-60" r="16" fill="#e8761f"/>
    <polygon points="145,-18 118,6 134,14" fill="#00e676"/>
    <polygon points="145,-18 118,6 134,14" fill="none" stroke="#00e676" stroke-width="3" filter="url(#glow)"/>
  </g>

  <text x="512" y="850" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="150" fill="#ffffff">P<tspan fill="#00e676">S</tspan></text>
  <text x="512" y="930" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="44" letter-spacing="12" fill="#8fa0b8">PARISCORE</text>
</svg>`;

const svgC = `<?xml version="1.0" encoding="UTF-8"?>
<!-- PariScore Logo Concept C - Shield + score + lightning prediction -->
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#0d1320"/>
      <stop offset="100%" stop-color="#06080e"/>
    </radialGradient>
    <linearGradient id="shieldG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#141d2e"/>
      <stop offset="100%" stop-color="#0b111d"/>
    </linearGradient>
    <linearGradient id="boltG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00e676"/>
      <stop offset="100%" stop-color="#00c853"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#00e676" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#00e676" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="16" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="440" r="340" fill="url(#halo)"/>

  <g transform="translate(512 430)">
    <path d="M 0 -280 L 200 -200 L 200 60 C 200 190, 110 270, 0 320 C -110 270, -200 190, -200 60 L -200 -200 Z"
          fill="url(#shieldG)" stroke="#00e676" stroke-width="7" filter="url(#glow)" opacity="0.85"/>
    <path d="M 0 -280 L 200 -200 L 200 60 C 200 190, 110 270, 0 320 C -110 270, -200 190, -200 60 L -200 -200 Z"
          fill="url(#shieldG)" stroke="#00e676" stroke-width="5"/>

    <path d="M 8 -185 L -88 25 L -4 25 L -24 185 L 96 -35 L 12 -35 Z" fill="url(#boltG)" stroke="#00e676" stroke-width="3" filter="url(#glow)" opacity="0.9"/>
    <path d="M 8 -185 L -88 25 L -4 25 L -24 185 L 96 -35 L 12 -35 Z" fill="url(#boltG)"/>
  </g>

  <text x="512" y="852" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="110" letter-spacing="1" fill="#f4f7fb">PARI<tspan fill="#00e676">SCORE</tspan></text>
  <text x="512" y="908" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="30" letter-spacing="10" fill="#5b6b82">PARIS SPORTIFS - SCORES - PREDICTIONS</text>
  <text x="512" y="952" text-anchor="middle" font-family="Arial, sans-serif" font-weight="500" font-size="20" letter-spacing="6" fill="#39465c">PREDICTION EN 1 CLIC</text>
</svg>`;

const files = {
  'concept-a-arrow-score.svg': svgA,
  'concept-b-monogram-ps.svg': svgB,
  'concept-c-shield-bolt.svg': svgC,
};

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), content);
  console.log('wrote ' + name);
}

// render to PNG via Playwright
(async () => {
  const { chromium } = require('@playwright/test');
  const b = await chromium.launch();
  for (const name of Object.keys(files)) {
    const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
    await p.goto('file:///' + path.join(OUT, name).replace(/\\/g, '/'));
    await p.waitForTimeout(300);
    const png = path.join(OUT, name.replace('.svg', '.png'));
    await p.screenshot({ path: png });
    console.log('rendered ' + png + ' ' + fs.statSync(png).size + ' bytes');
    await p.close();
  }
  await b.close();
})();