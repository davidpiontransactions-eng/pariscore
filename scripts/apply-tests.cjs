// Tests : import helpers + test applyTimeFilter live + nouveaux tests (CRLF-safe).
const fs = require('fs');
const p = 'src/lib/__tests__/sports-tree.test.ts';
let s = fs.readFileSync(p, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
let ok = 0;

function rep(oldLines, newLines) {
  const o = oldLines.join('\n').replace(/\n/g, eol);
  const n = newLines.join('\n').replace(/\n/g, eol);
  const count = s.split(o).length - 1;
  if (count !== 1) { console.log('MISS (' + count + ') :', oldLines[0]); return; }
  s = s.replace(o, n);
  ok++;
}

// 1) Import filterLiveByWindow + filterBySelection.
rep(
[
'import {',
'  parseTimeFilter,',
'  filterByStartWindow,',
'  filterByToday,',
'} from "../match-view";',
],
[
'import {',
'  parseTimeFilter,',
'  filterByStartWindow,',
'  filterByToday,',
'  filterLiveByWindow,',
'  filterBySelection,',
'} from "../match-view";',
]
);

// 2) Mettre à jour le scénario live du test applyTimeFilter : un live hors
//    fenêtre passée est désormais filtré (comportement voulu).
rep(
[
'  test("\'2h\' → ne garde que la fenêtre + les lives", () => {',
'    const out = applyTimeFilter(tree, "2h", now);',
'    expect(out[0].totalMatches).toBe(2);',
'    expect(out[0].liveMatches).toBe(1);',
'  });',
],
[
'  test("\'2h\' → ne garde que la fenêtre (lives inclus, fenêtre passée)", () => {',
'    // live #3 (démarré le 10 août, 4 jours avant now) sort de la fenêtre',
'    // [now − 2h, now] → filtré ; live récent resterait visible.',
'    const out = applyTimeFilter(tree, "2h", now);',
'    expect(out[0].totalMatches).toBe(1);',
'    expect(out[0].liveMatches).toBe(0);',
'  });',
]
);

// 3) Nouveaux tests filterLiveByWindow + filterBySelection.
rep(
[
'// ─── best1x2Edge (P0-2) ────────────────────────────────────────────────────',
],
[
'// ─── filterLiveByWindow ────────────────────────────────────────────────────',
'',
'describe("filterLiveByWindow", () => {',
'  const now = new Date("2026-08-15T14:00:00");',
'  type M = { at: string };',
'',
'  test("hours=null → liste inchangée", () => {',
'    const items: M[] = [{ at: "2026-08-15T10:00:00" }, { at: "2026-08-15T13:00:00" }];',
'    expect(filterLiveByWindow(items, null, (m) => m.at, now)).toHaveLength(2);',
'  });',
'',
'  test("fenêtre 2h → garde les lives démarrés il y a < 2h, exclut les plus vieux", () => {',
'    const items: M[] = [',
'      { at: "2026-08-15T13:30:00" }, // −30 min ✓',
'      { at: "2026-08-15T12:30:00" }, // −1h30 ✓',
'      { at: "2026-08-15T11:00:00" }, // −3h ✗',
'    ];',
'    const out = filterLiveByWindow(items, 2, (m) => m.at, now);',
'    expect(out).toHaveLength(2);',
'  });',
'',
'  test("un live futur (données incohérentes) est exclu", () => {',
'    const items: M[] = [{ at: "2026-08-15T15:00:00" }]; // +1h (pas encore commencé)',
'    expect(filterLiveByWindow(items, 2, (m) => m.at, now)).toHaveLength(0);',
'  });',
'});',
'',
'// ─── filterBySelection ─────────────────────────────────────────────────────',
'',
'describe("filterBySelection", () => {',
'  type M = { id: string };',
'  const items: M[] = [{ id: "a" }, { id: "b" }, { id: "c" }];',
'',
'  test("liste vide → inchangé", () => {',
'    expect(filterBySelection(items, [], (m) => m.id)).toHaveLength(3);',
'  });',
'',
'  test("garde uniquement les ids sélectionnés", () => {',
'    const out = filterBySelection(items, ["a", "c"], (m) => m.id);',
'    expect(out.map((m) => m.id)).toEqual(["a", "c"]);',
'  });',
'',
'  test("ids numériques convertis en string", () => {',
'    const num: Array<{ id: number }> = [{ id: 42 }, { id: 7 }];',
'    expect(filterBySelection(num, ["42"], (m) => m.id)).toHaveLength(1);',
'  });',
'});',
'',
'// ─── best1x2Edge (P0-2) ────────────────────────────────────────────────────',
]
);

fs.writeFileSync(p, s, 'utf8');
console.log('appliqués ' + ok + '/3');