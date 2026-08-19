// scripts/gen-pariscore-logo-pro.js - single Pro-model logo generation
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const GEN = path.join(ROOT, '.opencode', 'skills', 'design', 'scripts', 'logo', 'generate.py');
const OUT = path.join(ROOT, '.context', 'logos');

const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const keyLine = envContent.split(/\r?\n/).find(l => l.startsWith('GEMINI_API_KEY='));
const key = keyLine ? keyLine.split('=').slice(1).join('=').replace(/"/g, '').trim() : '';
if (!key) { console.error('GEMINI_API_KEY not found'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const name = process.argv[2] || 'v5-pro-gradient-sports';
const prompt = process.argv[3] || 'Modern colorful sports betting logo for PariScore: a bold abstract mark combining a rising prediction chart arrow with a soccer ball and tennis ball, glowing neon green (#00e676) and vibrant gradient accents (cyan, purple, amber) on dark navy background, dynamic score digits, clean vector style, centered, no text';
const style = process.argv[4] || 'gradient';

const r = cp.spawnSync('python', ['generate.py', '--pro', '--brand', 'PariScore', '--prompt', prompt, '--style', style, '--output', path.join(OUT, name + '.png')], {
  cwd: path.dirname(GEN),
  encoding: 'utf8',
  env: { ...process.env, GEMINI_API_KEY: key },
  timeout: 300000,
});
console.log((r.stdout || '').slice(0, 800));
console.log((r.stderr || '').slice(0, 300));
if (fs.existsSync(path.join(OUT, name + '.png'))) {
  console.log('OK ' + fs.statSync(path.join(OUT, name + '.png')).size + ' bytes');
}