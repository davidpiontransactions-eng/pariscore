// scripts/qa-contrast-report.js - compute precise WCAG contrast ratios for current + proposed
const oklch2rgb = (L, C, H) => {
  const h = (H || 0) * Math.PI / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const f = (x) => {
    const x3 = Math.pow(x, 3);
    return x3 > 0.0031308 ? 1.055 * Math.pow(x3, 1 / 2.4) - 0.055 : 12.92 * x;
  };
  return [f(l_), f(m_), f(s_)]; // roughly linear-ish
};

const relLum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return s;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const l1 = relLum(a), l2 = relLum(b);
  return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
};
const hex2rgb = (h) => {
  const n = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
};
const oklch = (L, C, H) => {
  // approximate: convert oklch L to linear then sRGB via a simple gray assumption for C=0
  if (!C) { const v = L; const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return [s, s, s]; }
  return oklch2rgb(L, C, H);
};

const card = oklch(0.205, 0, 0);      // current card bg
const fgWhite = oklch(0.985, 0, 0);   // card-foreground
const muted = oklch(0.708, 0, 0);     // current muted-foreground

console.log('=== PASCORE ACTUEL (card #2e2e2e) ===');
console.log('label muted-foreground vs card  =', ratio(muted, card), ':1  <-- WCAG AA exige 4.5');
console.log('valeur foreground vs card       =', ratio(fgWhite, card), ':1');
console.log('');

console.log('=== PROPOSITIONS (valeurs sur card) ===');
const cand = [
  ['valeurs 14px blanc pur fgWhite', fgWhite, card],
  ['valeurs 14px accent #00e676', oklch(0.77, 0.19, 162), card],
];
for (const [name, fg, bg] of cand) console.log(name, '=', ratio(fg, bg), ':1');

console.log('');
console.log('=== PROPOSITIONS (labels sur card) ===');
const labelCands = [
  ['text-foreground/70 sur card', 0.985 * 0.7 + 0.205 * 0.3, 0],
  ['text-foreground/75 sur card', 0.985 * 0.75 + 0.205 * 0.25, 0],
  ['slate-400 #9ca3af', hex2rgb('#9ca3af'), 0],
  ['slate-300 #cbd5e1', hex2rgb('#cbd5e1'), 0],
  ['zinc-300 #d4d4d8', hex2rgb('#d4d4d8'), 0],
];
for (const [name, fg, isHex] of labelCands) {
  const c = isHex === 0 ? oklch(fg, 0, 0) : fg;
  console.log(name, '=', ratio(c, card), ':1');
}

console.log('');
console.log('=== CONCURRENTS (pour reference) ===');
console.log('FotMob valeur #000 sur #fff      =', ratio(hex2rgb('#000000'), hex2rgb('#ffffff')), ':1');
console.log('FotMob label #383838 sur #fff    =', ratio(hex2rgb('#383838'), hex2rgb('#ffffff')), ':1');
console.log('Flashscore #00141E sur #fff      =', ratio(hex2rgb('#00141e'), hex2rgb('#ffffff')), ':1');
console.log('Flashscore label #555E61 sur #fff=', ratio(hex2rgb('#555e61'), hex2rgb('#ffffff')), ':1');
console.log('Sofascore #1d1f24 sur #f7f7f8    =', ratio(hex2rgb('#1d1f24'), hex2rgb('#f7f7f8')), ':1');