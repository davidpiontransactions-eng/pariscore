// scripts/gen-pariscore-logos.js - generate PariScore logo variants via Gemini
// Reads GEMINI_API_KEY from repo .env, spawns the design-skill python generator.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const GEN = path.join(ROOT, '.opencode', 'skills', 'design', 'scripts', 'logo', 'generate.py');
const OUT = path.join(ROOT, '.context', 'logos');

const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const keyLine = envContent.split(/\r?\n/).find(l => l.startsWith('GEMINI_API_KEY='));
const key = keyLine ? keyLine.split('=').slice(1).join('=').replace(/"/g, '').trim() : '';
if (!key) { console.error('GEMINI_API_KEY not found in .env'); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });

const variants = process.argv.slice(2).length
  ? JSON.parse(process.argv[2])
  : [
      {
        name: 'v1-gradient-sports',
        prompt: 'Modern colorful sports betting logo for PariScore: a bold abstract mark combining a rising prediction chart arrow with a soccer ball and tennis ball, glowing neon green (#00e676) and vibrant gradient accents (cyan, purple, amber) on dark navy background, dynamic score digits, clean vector style, centered, no text',
        style: 'gradient',
      },
      {
        name: 'v2-neon-score',
        prompt: 'Neon glow logo for PariScore sports predictions app: stylized scoreboard with glowing green numbers 2-1 and a lightning prediction bolt, dark navy background with neon green (#00e676) glow and purple/cyan secondary accents, futuristic esports style, vector, centered, no text',
        style: 'modern',
      },
      {
        name: 'v3-emblem-sports',
        prompt: 'Colorful emblem badge logo for PariScore: circular crest combining football, tennis, basketball, boxing glove and rising arrow chart elements around a central glowing score number, vibrant sports colors on dark navy, premium vector badge, no text',
        style: 'emblem',
      },
      {
        name: 'v4-abstract-prediction',
        prompt: 'Abstract geometric logo for PariScore betting predictions: a glowing neon green (#00e676) upward arrow forming a graph line through a dark navy circle, with small colorful sports ball dots (football, tennis, basketball) placed on the chart points, purple and cyan accents, modern vector logo, no text',
        style: 'abstract',
      },
      {
        name: 'v5-pro-gradient-sports',
        prompt: 'Modern colorful sports betting logo for PariScore: a bold abstract mark combining a rising prediction chart arrow with a soccer ball and tennis ball, glowing neon green (#00e676) and vibrant gradient accents (cyan, purple, amber) on dark navy background, dynamic score digits, clean vector style, centered, no text',
        style: 'gradient',
        pro: true,
      },
    ];

function run(args) {
  return cp.spawnSync('python', args, {
    cwd: path.dirname(GEN),
    encoding: 'utf8',
    env: { ...process.env, GEMINI_API_KEY: key },
    timeout: 240000,
  });
}

(async () => {
  for (const v of variants) {
    console.log('\n=== ' + v.name + ' ===');
    const outFile = path.join(OUT, v.name + '.png');
    const args = ['generate.py', '--brand', 'PariScore', '--prompt', v.prompt, '--style', v.style, '--output', outFile];
    if (v.pro) args.splice(1, 0, '--pro');
    const r = run(args);
    const out = (r.stdout || '') + (r.stderr || '');
    console.log(out.split('\n').filter(Boolean).slice(0, 8).join('\n'));
    if (fs.existsSync(outFile)) {
      console.log('OK ' + outFile + ' ' + fs.statSync(outFile).size + ' bytes');
    } else {
      console.log('FAILED: ' + out.slice(0, 300));
    }
  }
})();