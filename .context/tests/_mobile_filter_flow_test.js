// Test statique mobile-filter-flow — garantit que les sélecteurs JS de
// applyFootballPreset restent ancrés aux IDs de row (résistants à _mfsRelocate
// qui déplace day-filter-row / topn-filter-row / period-kickoff-row /
// adv-filter-row hors de #page-matchs sur mobile).
// Pattern zéro-dep aligné sur .context/tests/_tn_predictive_test.js.
//
// Bug racine : ParisScorebis-6cv (P0)
// Rapport : .context/rapport-bug-mobile-page-blanche-filtres-2026.md
// QA : .context/test-report-mobile-filter-flow.md

const fs   = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'pariscore.html'), 'utf8');

// Extraction du corps d'une function nommée (brace-match) — mêmes mécaniques
// que le test predictive tennis.
function extractFn(name) {
  const sig = 'function ' + name + '(';
  const i = HTML.indexOf(sig);
  if (i < 0) throw new Error('not found: ' + name);
  let j = HTML.indexOf('{', i), d = 0;
  for (let k = j; k < HTML.length; k++) {
    if (HTML[k] === '{') d++;
    else if (HTML[k] === '}') { d--; if (d === 0) return HTML.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

let pass = true;
function chk(cond, msg) {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) pass = false;
}

// ─── Test 1 : applyFootballPreset ne contient plus les sélecteurs cassés ────
const applyFootballPresetSrc = extractFn('applyFootballPreset');

chk(
  !/'#page-matchs\s+\.filter-chip\[data-day=/.test(applyFootballPresetSrc),
  'applyFootballPreset : sélecteur day ne dépend PLUS de #page-matchs (résistant _mfsRelocate)'
);
chk(
  !/'#page-matchs\s+\.filter-chip\[data-period=/.test(applyFootballPresetSrc),
  'applyFootballPreset : sélecteur period ne dépend PLUS de #page-matchs'
);
chk(
  !/'#page-matchs\s+\.filter-chip\[data-kick=/.test(applyFootballPresetSrc),
  'applyFootballPreset : sélecteur kickoff ne dépend PLUS de #page-matchs'
);

// ─── Test 2 : applyFootballPreset ancre bien sur les IDs de row ─────────────
chk(
  /#day-filter-row\s+\.filter-chip\[data-day=/.test(applyFootballPresetSrc),
  'applyFootballPreset : sélecteur day ancré sur #day-filter-row'
);
chk(
  /#period-filter-row\s+\.filter-chip\[data-period=/.test(applyFootballPresetSrc),
  'applyFootballPreset : sélecteur period ancré sur #period-filter-row'
);
chk(
  /#kickoff-filter-row\s+\.filter-chip\[data-kick=/.test(applyFootballPresetSrc),
  'applyFootballPreset : sélecteur kickoff ancré sur #kickoff-filter-row'
);

// ─── Test 3 : _mfsRelocate déplace bien les rows attendues (contrat) ────────
const mfsRelocateSrc = extractFn('_mfsRelocate');
['day-filter-row', 'topn-filter-row', 'period-kickoff-row', 'adv-filter-row'].forEach(id => {
  chk(
    mfsRelocateSrc.includes("'" + id + "'"),
    "_mfsRelocate déplace '" + id + "' (contrat documenté)"
  );
});

// ─── Test 4 : closeMobFilters force re-render + feedback ────────────────────
// closeMobFilters est une expression assignée à window — extraction par regex.
const closeMobSrcMatch = HTML.match(
  /window\.closeMobFilters\s*=\s*function\s*\(\s*\)\s*\{[\s\S]*?\n\s*\};/
);
chk(!!closeMobSrcMatch, 'closeMobFilters : fonction trouvée dans pariscore.html');
if (closeMobSrcMatch) {
  const closeMobSrc = closeMobSrcMatch[0];
  chk(
    /renderMatches\s*\(\s*allMatches\s*\)/.test(closeMobSrc),
    'closeMobFilters : appelle renderMatches(allMatches) post-fermeture'
  );
  chk(
    /showNotification\s*\(/.test(closeMobSrc),
    'closeMobFilters : tente showNotification (feedback UX)'
  );
}

// ─── Test 5 : Instrumentation forensique en place (CR-F trace) ──────────────
const psLogoutSrc = extractFn('psLogout');
chk(
  /\[psLogout\]\s+called from/.test(psLogoutSrc),
  'psLogout : trace forensique stack en place (CR-F)'
);

// apiFetch est une async function — extraction custom.
const apiFetchMatch = HTML.match(/async function apiFetch\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
chk(!!apiFetchMatch, 'apiFetch : fonction trouvée');
if (apiFetchMatch) {
  chk(
    /\[apiFetch:401\]/.test(apiFetchMatch[0]),
    'apiFetch : trace forensique 401 en place (CR-F)'
  );
}

// ─── Test 6 : Les IDs de row restent uniques dans la DOM markup ─────────────
// Garantit que les sélecteurs ne matchent pas plusieurs candidats post-relocate.
['day-filter-row', 'period-filter-row', 'kickoff-filter-row', 'topn-filter-row', 'adv-filter-row']
  .forEach(id => {
    const occ = (HTML.match(new RegExp('id="' + id + '"', 'g')) || []).length;
    chk(
      occ === 1,
      'ID "' + id + '" unique dans le DOM (occurrences=' + occ + ')'
    );
  });

// ─── Test 7 : confirmStrategy idempotent — guard dataset.confirming ────────
const confirmStrategySrc = extractFn('confirmStrategy');
chk(
  /dataset\.confirming\s*===\s*['"]1['"]/.test(confirmStrategySrc),
  'confirmStrategy : guard idempotence dataset.confirming === "1"'
);
chk(
  /setup\.dataset\.confirming\s*=\s*['"]1['"]/.test(confirmStrategySrc),
  'confirmStrategy : marque confirming="1" avant timeout'
);

// ─── Fix A (ParisScorebis-amc) — DCL race guard ─────────────────────────────
chk(
  /ps_user_navigated/.test(HTML),
  'Fix A : flag sessionStorage ps_user_navigated présent dans pariscore.html'
);
const dclSrcMatch = HTML.match(
  /window\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)\s*;/
);
chk(!!dclSrcMatch, 'Fix A : handler DOMContentLoaded trouvé');
if (dclSrcMatch) {
  chk(
    /if\s*\(!_navFlag\)\s*\{[\s\S]{0,80}showPage\('accueil'/.test(dclSrcMatch[0]),
    'Fix A : DCL ne route vers accueil QUE si ps_user_navigated absent'
  );
}

// ─── Fix B (ParisScorebis-amc) — renderLockedPage body.dataset.page ─────────
const renderLockedSrc = extractFn('renderLockedPage');
chk(
  /document\.body\.dataset\.page\s*=\s*pageId/.test(renderLockedSrc),
  'Fix B : renderLockedPage met document.body.dataset.page = pageId'
);

// ─── Fix C (ParisScorebis-amc) — apiFetch handle 403 ────────────────────────
const apiFetchMatch2 = HTML.match(/async function apiFetch\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
chk(!!apiFetchMatch2, 'Fix C : apiFetch trouvé');
if (apiFetchMatch2) {
  chk(
    /res\.status\s*===\s*403/.test(apiFetchMatch2[0]),
    'Fix C : apiFetch handle 403'
  );
  chk(
    /PLAN_REQUIRED|FREEMIUM_VIEW_QUOTA/.test(apiFetchMatch2[0]),
    'Fix C : apiFetch reconnaît codes PLAN_REQUIRED / FREEMIUM_VIEW_QUOTA'
  );
  chk(
    /\[apiFetch:403\]/.test(apiFetchMatch2[0]),
    'Fix C : trace forensique [apiFetch:403] présente'
  );
}

// ─── Fix D (ParisScorebis-amc) — showPage anti hub stuck ────────────────────
const showPageSrc = extractFn('showPage');
chk(
  /sport-hub.*style\.display\s*=\s*['"]none['"]/s.test(showPageSrc) ||
  /getElementById\(['"]sport-hub['"]\)[\s\S]*?display\s*=\s*['"]none['"]/.test(showPageSrc),
  'Fix D : showPage force #sport-hub display:none hors flow init'
);
chk(
  /strategy-setup[\s\S]*?display\s*=\s*['"]none['"]/.test(showPageSrc),
  'Fix D : showPage force #strategy-setup display:none hors flow init'
);

// ─── Fix F (ParisScorebis-amc) — confirmStrategy close drawer Plus ──────────
const confirmStrategySrc2 = extractFn('confirmStrategy');
chk(
  /bnCloseMore/.test(confirmStrategySrc2),
  'Fix F : confirmStrategy appelle bnCloseMore avant transition'
);

// ─── Bilan ──────────────────────────────────────────────────────────────────
console.log('\n=== bilan mobile-filter-flow ===');
if (pass) {
  console.log('OK — tous les tests passent.');
  process.exit(0);
} else {
  console.log('KO — au moins un test échoue.');
  process.exit(1);
}
