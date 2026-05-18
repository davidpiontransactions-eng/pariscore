// Régénère CLASSEMENT_POWERSCORE.md depuis pariscore.db (lecture seule).
// Usage : node gen-powerscore-md.js
const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('pariscore.db', { readonly: true });

const ymdAgo = n => { const d = new Date(Date.now() - n * 864e5); return d.getUTCFullYear() * 1e4 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
const rankPts = o => (o && o >= 1 && o <= 10) ? 3 : (o && o <= 50) ? 2 : (o && o <= 100) ? 1 : 0.5;

function pf(pid, surf, elo) {
  const rows = db.prepare(`SELECT winner_id,winner_rank,loser_rank FROM tennis_matches
    WHERE surface=? AND (winner_id=? OR loser_id=?) ORDER BY tourney_date DESC,match_num DESC LIMIT 10`).all(surf, pid, pid);
  if (!rows.length) return null;
  let l5 = 0, l10 = 0;
  rows.forEach((m, i) => { const w = m.winner_id === pid; const p = w ? rankPts(m.loser_rank) : 0; l10 += p; if (i < 5) l5 += p; });
  const wr = db.prepare(`SELECT SUM(CASE WHEN winner_id=? THEN 1 ELSE 0 END) wins,COUNT(*) tot FROM tennis_matches
    WHERE surface=? AND tourney_date>=? AND (winner_id=? OR loser_id=?)`).get(pid, surf, ymdAgo(364), pid, pid);
  const winRate = (wr && wr.tot > 0) ? wr.wins / wr.tot : 0;
  const en = elo ? Math.max(0, Math.min(1, (elo - 1500) / 900)) : 0;
  const ff = Math.max(0, Math.min(1, l10 / 30));
  const ps = Math.round(100 * (0.5 * en + 0.3 * winRate + 0.2 * ff));
  return { ps, l5: Math.round(l5 * 10) / 10, l10: Math.round(l10 * 10) / 10, wr: Math.round(winRate * 100), elo: Math.round(elo) };
}

const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
let md = `# Classement PowerScore — Tennis\n\n> Indicateur /100 = **0.5 Elo surface normalisé + 0.3 WinRate 52 sem + 0.2 Facteur Forme (L10 pts)**.\n> Joueurs actifs (≤ 425 j). Source 100% locale (Sackmann/Tennis Abstract sync SQLite). Classement par circuit + surface.\n>\n> **Généré : ${now} UTC** — régénérer : \`node gen-powerscore-md.js\`\n`;

for (const tour of ['ATP', 'WTA']) {
  for (const surf of ['Hard', 'Clay', 'Grass']) {
    const rows = db.prepare(`SELECT player_id,player_name,elo FROM tennis_elo
      WHERE tour=? AND surface=? AND last_match_date IS NOT NULL AND last_match_date>=? ORDER BY elo DESC`)
      .all(tour, surf, ymdAgo(425));
    const sc = [];
    for (const r of rows) { if (!r.player_id || !r.player_name) continue; const p = pf(r.player_id, surf, r.elo); if (!p) continue; sc.push(Object.assign({ n: r.player_name }, p)); }
    sc.sort((a, b) => b.ps - a.ps);
    md += `\n## ${tour} — ${surf} (${sc.length} joueurs actifs)\n\n`;
    md += `| # | Joueur | PowerScore | Elo | WinRate 52s | L5 | L10 |\n|---|--------|-----------|-----|-------------|----|----|\n`;
    sc.slice(0, 100).forEach((x, i) => { md += `| ${i + 1} | ${x.n} | **${x.ps}** | ${x.elo} | ${x.wr}% | ${x.l5} | ${x.l10} |\n`; });
  }
}

fs.writeFileSync('CLASSEMENT_POWERSCORE.md', md);
db.close();
console.log(`CLASSEMENT_POWERSCORE.md écrit (${md.length} octets)`);
