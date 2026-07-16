/**
 * Edite pariscore.html (CP1252) — Refonte UI statline 6 métriques Tennis
 * Mixed design : L1 [#rank · Elo]  L2 [SPS] [#surfrank]
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'pariscore.html');

// Lecture CP1252 via iconv-lite ou latin1 fallback
let iconv;
try { iconv = require('iconv-lite'); } catch (e) {}
const raw = fs.readFileSync(filePath);
const text = iconv ? iconv.decode(raw, 'win1252') : raw.toString('latin1');

// ========== 1. CSS : ajouter classes pill après .sc-premier-pelo ==========
const cssPillBlock = `.sc-premier-pelo{font-size:9px;color:var(--text3,#64748b)}
.sc-premier-surfrank{display:inline-flex;align-items:center;padding:1px 6px;font-size:9px;font-weight:600;font-family:var(--font-mono,DM Mono,monospace);color:var(--sport-accent,#ccff00);background:rgba(204,255,0,0.1);border-radius:var(--radius-pill,999px);line-height:1.5;white-space:nowrap;letter-spacing:.01em}
.sc-premier-sps{display:inline-flex;align-items:center;padding:1px 6px;font-size:9px;font-weight:500;font-family:var(--font-mono,DM Mono,monospace);color:var(--text3,#707e94);background:rgba(255,255,255,0.04);border-radius:var(--radius-pill,999px);line-height:1.5;white-space:nowrap;letter-spacing:.01em}
.sc-premier-metrics{display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap}
.sc-premier-gauge{flex:0 0 auto;padding:0 2px}`;

const oldCss = `.sc-premier-pelo{font-size:9px;color:var(--text3,#64748b)}
.sc-premier-gauge{flex:0 0 auto;padding:0 2px}`;

if (!text.includes(oldCss)) {
  console.error('ERREUR: CSS anchor not found');
  process.exit(1);
}
const afterCss = text.replace(oldCss, cssPillBlock);

// ========== 2. Template P1 : scinder statline en 2 lignes ==========
// L'em dash et bullet en CP1252 — on matche avec une regex
// Pattern P1: le bloc prank + surfrank pour player1
const p1Old = `<div class="sc-premier-prank">#` + // début du prank
  `\\$\\(p1\\.rank\\|\\|'[^']+'\\)` + // rank fallback
  `[\\s\\S]+?` + // flag, sep, Elo, SPS
  `</div>` + // fermeture prank
  `'\\s*\\+` +
  `\\(p1\\.surf_rank\\?` +
  `[\\s\\S]+?` + // surfrank div
  `:''\\)`; 

// Too complex for regex, let me find exact strings by searching
const p1AnchorPrank = `+'<div class="sc-premier-prank">#`;
const p1Idx = afterCss.indexOf(p1AnchorPrank);
if (p1Idx === -1) { console.error('P1 prank anchor not found'); process.exit(1); }

// Find the end of prank + surfrank block
const p1BlockEnd = afterCss.indexOf(`+'</div>'`, p1Idx + 200); // should find the p1 closing </div>
// Actually, let me find the end of the surfrank line which ends with :'') and then a +
const surfrankEndMarker = `:'')+`;
let searchFrom = p1Idx + 50;
// Find the second occurrence of surfrank (for p1)
let surfrankStart = afterCss.indexOf(`+(p1.surf_rank?`, searchFrom);
if (surfrankStart === -1) { console.error('P1 surfrank anchor not found'); process.exit(1); }
let surfrankEnd = afterCss.indexOf(`:'')`, surfrankStart) + 4;
// The prank div ends before surfrank, find its end
let prankEnd = afterCss.indexOf(`+'</div>'`, p1Idx);
if (prankEnd === -1 || prankEnd > surfrankStart) {
  // Try finding just </div>
  prankEnd = afterCss.indexOf(`</div>'`, p1Idx + 80);
}

console.log('P1 prank starts at', p1Idx);
console.log('P1 prank ends at', prankEnd);
console.log('P1 surfrank starts at', surfrankStart);
console.log('P1 surfrank ends at', surfrankEnd);

// Extract the two lines
const p1PrankLine = afterCss.slice(p1Idx, prankEnd + 7); // +7 for '</div>'
const p1SurfrankLine = afterCss.slice(surfrankStart, surfrankEnd);

const p1New = `+'<div class="sc-premier-prank">#` +
  `+(p1.rank||'—')` +
  `+(p1.flag?' <span class="sc-flag">'+flagToCC(p1.flag)+'</span>':'')` +
  `+' <span class="sc-premier-metric-sep">•</span> Elo ` +
  `+(p1.elo_surface||'—')+'</div>'` +
  `\n      ` +
  `+(p1.powerscore!=null||p1.surf_rank?'<div class="sc-premier-metrics">':'')` +
  `+(p1.powerscore!=null?'<span class="sc-premier-sps">SPS '+Math.round(p1.powerscore)+'</span>':'')` +
  `+(p1.surf_rank?'<span class="sc-premier-surfrank">#'+p1.surf_rank+(p1.surf_rank_total?'/'+p1.surf_rank_total:'')+'</span>':'')` +
  `+(p1.powerscore!=null||p1.surf_rank?'</div>':'')`;

const step2 = afterCss.slice(0, p1Idx) + p1New + afterCss.slice(surfrankEnd);

// ========== 3. Template P2 : même pattern pour player2 ==========
const p2AnchorPrank = `+'<div class="sc-premier-prank">#`;
const p2SearchFrom = step2.indexOf(`+'<div class="sc-premier-player p2">`);
const p2Idx = step2.indexOf(p2AnchorPrank, p2SearchFrom);
if (p2Idx === -1) { console.error('P2 prank anchor not found'); process.exit(1); }

const p2SurfrankStart = step2.indexOf(`+(p2.surf_rank?`, p2Idx + 50);
if (p2SurfrankStart === -1) { console.error('P2 surfrank anchor not found'); process.exit(1); }
const p2SurfrankEnd = step2.indexOf(`:'')`, p2SurfrankStart) + 4;

const p2PrankEnd = step2.indexOf(`</div>'`, p2Idx + 80);

console.log('P2 prank at', p2Idx, 'ends at', p2PrankEnd);
console.log('P2 surfrank at', p2SurfrankStart, 'ends at', p2SurfrankEnd);

const p2New = `+'<div class="sc-premier-prank">#` +
  `+(p2.rank||'—')` +
  `+(p2.flag?' <span class="sc-flag">'+flagToCC(p2.flag)+'</span>':'')` +
  `+' <span class="sc-premier-metric-sep">•</span> Elo ` +
  `+(p2.elo_surface||'—')+'</div>'` +
  `\n      ` +
  `+(p2.powerscore!=null||p2.surf_rank?'<div class="sc-premier-metrics">':'')` +
  `+(p2.powerscore!=null?'<span class="sc-premier-sps">SPS '+Math.round(p2.powerscore)+'</span>':'')` +
  `+(p2.surf_rank?'<span class="sc-premier-surfrank">#'+p2.surf_rank+(p2.surf_rank_total?'/'+p2.surf_rank_total:'')+'</span>':'')` +
  `+(p2.powerscore!=null||p2.surf_rank?'</div>':'')`;

const step3 = step2.slice(0, p2Idx) + p2New + step2.slice(p2SurfrankEnd);

// ========== Écriture ==========
const output = iconv ? iconv.encode(step3, 'win1252') : Buffer.from(step3, 'latin1');
fs.writeFileSync(filePath, output);

console.log('✅ pariscore.html modifié avec succès');
console.log('   - CSS : .sc-premier-surfrank, .sc-premier-sps, .sc-premier-metrics ajoutés');
console.log('   - Template P1 + P2 : statline splitée en 2 lignes');
