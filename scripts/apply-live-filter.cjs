// Remplacements CRLF-safe dans sports-tree.ts :
// 1) matchInTimeWindow : filtre live par fenêtre glissante passée.
const fs = require('fs');
const p = 'src/lib/sports-tree.ts';
let s = fs.readFileSync(p, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
let ok = 0;

function rep(oldStr, newStr) {
  const o = oldStr.replace(/\n/g, eol);
  const n = newStr.replace(/\n/g, eol);
  const count = s.split(o).length - 1;
  if (count !== 1) { console.log(`MISS (${count}) :`, oldStr.slice(0, 60).replace(/\n/g, ' | ')); return; }
  s = s.replace(o, n);
  ok++;
}

rep(
`function matchInTimeWindow(m: TreeMatchSummary, tf: TimeFilterHours, now: Date): boolean {
  if (m.isLive) return true; // les matchs en direct restent visibles
  const { hours, today } = parseTimeFilter(tf);
  if (hours !== null) {
    return filterByStartWindow([m], hours, (x) => x.scheduledAt, now).length > 0;
  }
  if (today) {
    return filterByToday([m], (x) => x.scheduledAt, now).length > 0;
  }
  return true;
}`,
`function matchInTimeWindow(m: TreeMatchSummary, tf: TimeFilterHours, now: Date): boolean {
  const { hours, today } = parseTimeFilter(tf);
  if (hours !== null) {
    // Live : fenêtre glissante passée [now − Nh, now] (coup d'envoi déjà eu
    // lieu) ; prematch : fenêtre à venir [now − tolérance, now + Nh].
    const fn = m.isLive ? filterLiveByWindow : filterByStartWindow;
    return fn([m], hours, (x) => x.scheduledAt, now).length > 0;
  }
  if (today) {
    return filterByToday([m], (x) => x.scheduledAt, now).length > 0;
  }
  return true;
}`
);

// Import de filterLiveByWindow depuis match-view.
rep(
`import {
  filterByStartWindow,
  filterByToday,
  parseTimeFilter,
} from "@/lib/match-view";`,
`import {
  filterByStartWindow,
  filterByToday,
  filterLiveByWindow,
  parseTimeFilter,
} from "@/lib/match-view";`
);

fs.writeFileSync(p, s, 'utf8');
console.log(`appliqués ${ok}/2`);