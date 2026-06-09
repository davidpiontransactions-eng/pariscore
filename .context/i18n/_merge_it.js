const fs = require('fs');
const dir = 'C:/Users/david/Documents/dev PariScore/ParisScorebis/.context/i18n/';

const canon = JSON.parse(fs.readFileSync(dir + 'fr-canonical.json', 'utf8'));
const stage = JSON.parse(fs.readFileSync(dir + '_it_netnew_stage.json', 'utf8'));
const target = JSON.parse(fs.readFileSync(dir + 'tr-it.json', 'utf8'));

const canonKeys = Object.keys(canon);
const stageKeys = Object.keys(stage);

// 1. Key coverage: every canonical key must have a translation, byte-identical key.
const missing = canonKeys.filter(k => !(k in stage));
const extra = stageKeys.filter(k => !(k in canon));
if (missing.length) { console.error('MISSING translations for keys:', missing); process.exit(1); }
if (extra.length) { console.error('EXTRA keys not in canonical:', extra); process.exit(1); }

// 2. Placeholder preservation: the multiset of {..} tokens must match between fr and it.
function tokens(s) {
  const m = (s.match(/\{[^}]*\}/g) || []).slice().sort();
  return m;
}
const phErrors = [];
for (const k of canonKeys) {
  const a = tokens(canon[k]).join(',');
  const b = tokens(stage[k]).join(',');
  if (a !== b) phErrors.push({ key: k, fr: a, it: b });
}
if (phErrors.length) { console.error('PLACEHOLDER mismatches:', JSON.stringify(phErrors, null, 2)); process.exit(1); }

// 3. Brand "PariScore" must never be translated/altered: if fr value contains PariScore, it must too (same count).
const brandErrors = [];
for (const k of canonKeys) {
  const cf = (canon[k].match(/PariScore/g) || []).length;
  const ci = (stage[k].match(/PariScore/g) || []).length;
  if (cf !== ci) brandErrors.push({ key: k, fr: cf, it: ci });
}
if (brandErrors.length) { console.error('BRAND PariScore mismatches:', JSON.stringify(brandErrors, null, 2)); process.exit(1); }

// 4. Collision check vs existing target (should be zero per earlier grep).
const collisions = stageKeys.filter(k => k in target);

// 5. Untranslated guard: values identical to French (excluding intentionally code-like/brand tokens).
// Just report, do not fail — many are legitimately identical (ROI, Flat, Sharp, LAN, etc.).
const identical = canonKeys.filter(k => canon[k] === stage[k]);

// Merge: preserve existing target keys, add net-new translated keys.
const merged = Object.assign({}, target, stage);

fs.writeFileSync(dir + 'tr-it.json', JSON.stringify(merged, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  canonical_keys: canonKeys.length,
  translated: stageKeys.length,
  collisions_with_existing: collisions.length,
  collision_keys: collisions.slice(0, 20),
  identical_to_fr_count: identical.length,
  identical_sample: identical.slice(0, 30),
  target_keys_before: Object.keys(target).length,
  target_keys_after: Object.keys(merged).length,
  net_new_added: Object.keys(merged).length - Object.keys(target).length
}, null, 2));
