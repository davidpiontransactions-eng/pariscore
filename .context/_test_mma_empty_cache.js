// Regression test: getMMAFights must NOT poison _fullCache with an empty result.
// Bug: on boot-time Odds API failure, _fetchOdds returns [] -> getMMAFights caches []
// for CACHE_TTL_FULL (20min) -> MMA tab shows "Aucun événement" for 20min after restart.
// We force the empty path with an empty apiKey (no network for odds) and assert the
// empty result is NOT treated as a fresh 20min cache.
const m = require('../services/mmaService');

(async () => {
  const before = m.getCacheStatus().full_age_s;
  await m.getMMAFights('');                 // empty apiKey -> _fetchOdds returns [] -> events=[]
  const after = m.getCacheStatus().full_age_s;
  // Poisoned == empty result cached as "fresh" (age near 0, valid for full 20min TTL).
  const poisoned = after < 60;
  console.log(JSON.stringify({ before, after, poisoned }));
  if (poisoned) {
    console.log('FAIL: empty result cached fresh -> MMA tab stuck empty up to 20min after restart');
    process.exit(1);
  }
  console.log('PASS: empty result not cached fresh -> feed retries on next poll');
  process.exit(0);
})().catch(e => { console.log('TEST ERROR', e.message); process.exit(2); });
