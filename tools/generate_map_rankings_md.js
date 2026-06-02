'use strict';
/**
 * generate_map_rankings_md.js
 * ───────────────────────────
 * Génère data/hltv_map_rankings.md + data/hltv_map_rankings.json
 * depuis les fichiers HLTV locaux disponibles.
 *
 * Sources (par ordre de priorité) :
 *   data/hltv_mapstats_3m.json   — 3 mois (si disponible)
 *   data/hltv_mapstats_6m.json   — 6 mois
 *   data/hltv_mapstats_1y.json   — 12 mois
 *   data/hltv_team_mapstats.json — all-time (toujours disponible)
 *   data/hltv_rankings.json      — rang HLTV mondial par équipe
 *
 * Run : node tools/generate_map_rankings_md.js
 * Cron VPS (tous les 15j) :
 *   0 6 1,15 * * cd /home/ubuntu/pariscore && node tools/generate_map_rankings_md.js
 */

const fs   = require('fs');
const path = require('path');

const DATA  = path.join(__dirname, '..', 'data');
const OUT_MD   = path.join(DATA, 'hltv_map_rankings.md');
const OUT_JSON = path.join(DATA, 'hltv_map_rankings.json');

const ACTIVE_MAPS = ['Mirage','Inferno','Nuke','Ancient','Anubis','Vertigo','Dust2'];

function loadJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) { return null; }
}

function buildByTeam(raw) {
  if (!raw) return null;
  const out = {};
  for (const t of (raw.teams || [])) {
    if (!t.name || !Object.keys(t.maps||{}).length) continue;
    const key = t.name.toLowerCase();
    out[key] = { name: t.name, hltv_id: t.hltv_id || null, maps: t.maps };
  }
  return Object.keys(out).length ? out : null;
}

function getWR(maps, mapLabel) {
  // Try capitalized ("Mirage"), lowercase ("mirage"), de_ prefix ("de_mirage")
  return maps[mapLabel]
      ?? maps[mapLabel.toLowerCase()]
      ?? maps['de_' + mapLabel.toLowerCase()]
      ?? null;
}

function buildRankings(byTeam, hltvRanks) {
  const rankings = {};
  for (const map of ACTIVE_MAPS) {
    const entries = [];
    for (const [, t] of Object.entries(byTeam)) {
      const wr = getWR(t.maps, map);
      if (wr == null) continue;
      const rk = hltvRanks[t.name.toLowerCase()] || {};
      entries.push({ name: t.name, wr, hltv_rank: rk.rank || null, hltv_pts: rk.points || null });
    }
    entries.sort((a, b) => b.wr - a.wr);
    entries.forEach((e, i) => { e.rank = i + 1; });
    rankings[map] = entries;
  }
  return rankings;
}

function mdTable(entries, topN = 20) {
  const rows = entries.slice(0, topN).map(e =>
    `| ${String(e.rank).padStart(2)} | ${e.name.padEnd(22)} | ${String(e.wr + '%').padStart(5)} | ${e.hltv_rank != null ? '#' + e.hltv_rank : '—'} |`
  ).join('\n');
  return '| # | Team                   |   WR | HLTV |\n|---|------------------------|------|------|\n' + rows;
}

function main() {
  // Load available sources
  const raw3m = loadJson(path.join(DATA, 'hltv_mapstats_3m.json'));
  const raw6m = loadJson(path.join(DATA, 'hltv_mapstats_6m.json'));
  const raw1y = loadJson(path.join(DATA, 'hltv_mapstats_1y.json'));
  const rawAt = loadJson(path.join(DATA, 'hltv_team_mapstats.json'));
  const rawRk = loadJson(path.join(DATA, 'hltv_rankings.json'));

  const hltvRanks = {};
  for (const t of (rawRk?.teams || [])) {
    if (t.name) hltvRanks[t.name.toLowerCase()] = { rank: t.rank, points: t.points };
  }

  const bt3m = buildByTeam(raw3m);
  const bt6m = buildByTeam(raw6m);
  const bt1y = buildByTeam(raw1y);
  // all-time: hltv_team_mapstats.json has { teams: [{name, hltv_id, maps}] }
  const btAt = buildByTeam(rawAt);

  const available = [];
  if (bt3m) available.push('3m');
  if (bt6m) available.push('6m');
  if (bt1y) available.push('1y');
  if (btAt) available.push('all-time');

  if (!available.length) {
    console.error('[MapRankMD] No data files found. Run refresh_hltv_team_mapstats.js first.');
    process.exit(1);
  }
  console.log(`[MapRankMD] Sources available: ${available.join(', ')}`);

  const today = new Date().toISOString().slice(0, 10);

  // Build rankings per window
  const windows = [];
  if (bt3m) windows.push({ key: '3m', label: '3 mois', data: bt3m });
  if (bt6m) windows.push({ key: '6m', label: '6 mois', data: bt6m });
  if (bt1y) windows.push({ key: '1y', label: '12 mois', data: bt1y });
  if (btAt && !bt1y) windows.push({ key: 'all', label: 'All-time', data: btAt });

  // If no time windows, use all-time for everything
  if (!windows.length && btAt) windows.push({ key: 'all', label: 'All-time', data: btAt });

  const jsonOutput = { generated: today, windows: {}, source_files: available };
  let md = `# CS2 — Classements HLTV par Carte\n`;
  md += `> Généré le ${today} · Sources : ${available.join(' + ')} · Top 30 HLTV\n\n`;
  md += `> Auto-refresh : tous les 15j via \`node tools/generate_map_rankings_md.js\`\n\n`;

  for (const w of windows) {
    const rankings = buildRankings(w.data, hltvRanks);
    jsonOutput.windows[w.key] = { label: w.label, rankings };
    md += `---\n\n## Fenêtre : ${w.label.toUpperCase()}\n\n`;
    for (const map of ACTIVE_MAPS) {
      const entries = rankings[map] || [];
      if (!entries.length) continue;
      md += `### ${map}\n\n`;
      md += mdTable(entries, 20);
      md += '\n\n';
    }
  }

  // Cross-window trend table (if 3m and 6m available)
  if (bt3m && bt6m) {
    md += `---\n\n## Tendances (3m vs 6m)\n\n`;
    for (const map of ACTIVE_MAPS) {
      const r3 = (jsonOutput.windows['3m']?.rankings[map] || []).slice(0, 15);
      const r6idx = {};
      for (const e of (jsonOutput.windows['6m']?.rankings[map] || [])) r6idx[e.name] = e;
      if (!r3.length) continue;
      const hasChange = r3.some(e => r6idx[e.name] && Math.abs(e.wr - r6idx[e.name].wr) >= 5);
      if (!hasChange) continue;
      md += `### ${map}\n\n`;
      md += `| # | Team | 3m | 6m | Δ | Signal |\n|---|------|----|-----|---|--------|\n`;
      for (const e of r3) {
        const prev = r6idx[e.name];
        if (!prev) continue;
        const delta = e.wr - prev.wr;
        if (Math.abs(delta) < 5) continue;
        const sig = delta >= 5 ? 'RISING' : 'DECLINING';
        md += `| ${e.rank} | ${e.name} | ${e.wr}% | ${prev.wr}% | ${delta > 0 ? '+' : ''}${delta}pp | ${sig} |\n`;
      }
      md += '\n';
    }
  }

  md += `---\n\n## Usage Automatique\n\n`;
  md += `Ce fichier est lu par cs2Service.js pour enrichir les matchs **BO3 et BO5** :\n`;
  md += `- Onglet **MAPS** du Scout Drawer : rang mondial par carte + tendance\n`;
  md += `- Signal de valeur si ∆ winrate ≥ 20pp entre T1 et T2 sur la carte veto\n\n`;
  md += `### Refresh manuel (15j)\n\n`;
  md += `\`\`\`bash\n# VPS cron : 0 6 1,15 * * cd ~/pariscore && node tools/generate_map_rankings_md.js\n`;
  md += `# Ou déclencher manuellement :\nnode tools/generate_map_rankings_md.js\n\`\`\`\n`;

  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(OUT_MD, md, 'utf8');
  fs.writeFileSync(OUT_JSON, JSON.stringify(jsonOutput, null, 2), 'utf8');
  console.log(`[MapRankMD] Written → ${path.basename(OUT_MD)} (${(md.length/1024).toFixed(1)}KB)`);
  console.log(`[MapRankMD] Written → ${path.basename(OUT_JSON)}`);
}

main();
