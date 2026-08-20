const hex2rgb = (h) => { const n = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255); };
const relLum = (rgb) => {
  const [r, g, b] = rgb.map((v) => { const s = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return s; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const l1 = relLum(a), l2 = relLum(b); return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2); };
const card = hex2rgb('#2e2e2e'); // card oklch(0.205)
console.log('emerald-400 #34d399 sur card =', ratio(hex2rgb('#34d399'), card), ':1');
console.log('sky-400 #38bdf8 sur card     =', ratio(hex2rgb('#38bdf8'), card), ':1');
console.log('blanc #f5f5f5 sur card       =', ratio(hex2rgb('#f5f5f5'), card), ':1');
console.log('grill #9ca3af sur card       =', ratio(hex2rgb('#9ca3af'), card), ':1');
console.log('grill clair #cbd5e1 sur card =', ratio(hex2rgb('#cbd5e1'), card), ':1');
console.log('muted actuel #8a8a8a sur card=', ratio(hex2rgb('#8a8a8a'), card), ':1');
console.log('zinc-200 #e4e4e7 sur card    =', ratio(hex2rgb('#e4e4e7'), card), ':1');
console.log('emerald-300 #6ee7b7 sur card =', ratio(hex2rgb('#6ee7b7'), card), ':1');