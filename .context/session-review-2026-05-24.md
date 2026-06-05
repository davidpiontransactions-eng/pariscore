---
status: findings
files_reviewed: 2
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
---

# Session Review — 2026-05-24 (commits 80e3830 → 5bda7de)

Reviewed sections: server.js (7 patches) · pariscore.html (1 patch)
Depth: standard (surgical — specified line ranges only)

---

## Critical Issues

### CR-01: N+1 SQLite prepare() inside hot per-match loop

`server.js:28890` — `_getPlayerRank` is defined **inside** the match enrichment loop and calls `sqldb.prepare()` on every invocation. `better-sqlite3` compiles a new statement object on every `prepare()` call. On a 200-match ATP+WTA day slate this fires 400+ compiles per enrichment cycle, adds measurable latency, and risks statement handle exhaustion under concurrent calls.

**Fix:** Hoist the prepared statement to module scope (or at minimum to the top of `_buildTennisValueBetsCore`) and reuse it:

```javascript
// Module scope, next to other sqldb.prepare() calls:
const _stmtGetPlayerRank = sqldb.prepare(
  `SELECT atp_rank, wta_rank FROM tennis_players_elo
   WHERE LOWER(player_name) = LOWER(?) AND tour = ? LIMIT 1`
);

// Inside loop — just call .get():
const _getPlayerRank = (name, tour) => {
  if (!name || !tour) return null;
  try {
    const row = _stmtGetPlayerRank.get(name.trim(), tour);
    if (!row) return null;
    return tour === 'WTA' ? (row.wta_rank || null) : (row.atp_rank || null);
  } catch (_) { return null; }
};
```

---

### CR-02: NaN silently stored in expectedGoals when BSD xG value is a non-numeric string

`server.js:7780,7784` — `Number(raw.bsd_xg.home)` returns `NaN` when the field is a string like `"—"`, `"N/A"`, or an empty string. `NaN.toFixed(2)` throws `TypeError` in some engines and returns `"NaN"` in others; `parseFloat("NaN")` produces `NaN`. This `NaN` is then stored in `record.expectedGoals.home` and passed downstream into Poisson computations that use division and `Math.exp()`, silently corrupting probability outputs for the match without any log or fallback.

The guard `_rawXg.home != null` only filters `null` and `undefined` — it passes strings through.

**Fix:** Add an explicit numeric guard before writing to `expectedGoals`:

```javascript
if (record.bsd_xg.home != null) {
  const _hv = Number(record.bsd_xg.home);
  if (Number.isFinite(_hv)) {
    record.expectedGoals.home = parseFloat(_hv.toFixed(2));
    record.expectedGoals.home_source = 'bsd_real';
  }
  // else: leave Poisson value intact
}
if (record.bsd_xg.away != null) {
  const _av = Number(record.bsd_xg.away);
  if (Number.isFinite(_av)) {
    record.expectedGoals.away = parseFloat(_av.toFixed(2));
    record.expectedGoals.away_source = 'bsd_real';
  }
}
```

---

## Warnings

### WR-01: tourGuess gender-check skips unambiguous male player with no gender field

`server.js:28703-28718` — The logic is: exact match → gender field → prefix. The comment correctly notes BSD sometimes mislabels women's ITF events as "ATP". However, consider Novak Djokovic in BSD with `circuit="ATP 250"` and no `player1.gender` field (field absent, not `"M"`). The exact-match branch returns `'ATP'` only for the literal string `"ATP"`. `"ATP 250"` falls through to the gender check, finds no gender field, falls through to `t.startsWith('ATP')` — returns `'ATP'` correctly.

This path is **correct** but fragile in one specific failure mode: if BSD returns `circuit="ATP 250"` for a women's ITF event **and** includes `player1.gender = "M"` (wrong data), the gender check overrides and returns `'ATP'` for a WTA match. The code accepts gender as more authoritative than circuit without validating against both players. A cross-check would harden this:

```javascript
// After gender check, also check p2 gender to confirm:
const p2g = m.player2 && (m.player2.gender || m.player2.sex);
if (p1g && p2g) {
  // Both present — use consensus or flag mismatch
}
```

This is a logic robustness issue rather than a current crash, but BSD data quality is the risk vector.

---

### WR-02: surfaceClean drops multi-word surfaces silently

`server.js:28728` — `_surfNorm = _surfRaw.charAt(0).toUpperCase() + _surfRaw.slice(1).toLowerCase()` normalises `"Hard Court"` to `"Hard court"` (second word lowercased). If `TENNIS_ELO_SURFACES` contains `"Hard Court"` (title case each word) this will never match, `surfaceClean` becomes `null`, and the entire Elo/surf_rank enrichment is skipped with only a console.warn. Common BSD values like `"Hard Court"` or `"Clay Court"` are silently dropped.

**Fix:** Either normalise to the exact case stored in `TENNIS_ELO_SURFACES`, or map known variants:

```javascript
const _SURFACE_ALIASES = { 'hard court': 'Hard', 'clay court': 'Clay', 'grass court': 'Grass', 'indoor hard': 'Hard' };
const _surfKey = _surfRaw ? _surfRaw.toLowerCase() : null;
const _surfNorm = _surfKey
  ? (_SURFACE_ALIASES[_surfKey] || (_surfRaw.charAt(0).toUpperCase() + _surfRaw.slice(1).toLowerCase()))
  : null;
```

Also check what `TENNIS_ELO_SURFACES` actually contains — if it's `['Hard','Clay','Grass','Carpet']` then single-word values work fine but `"Hard Court"` still breaks.

---

### WR-03: BSD live-match cache TTL hardcoded 30min — comment promises 5min but code does not implement it

`server.js:28548` — The comment says "TTL: 30min for scheduled (pre-match), 5min when live matches present (fresher enrichment)" but the actual call always passes `30 * 60 * 1000` regardless of whether live matches are in the response. The conditional 5-min TTL described in the comment is never applied. During a live match window this means stale enrichment data for up to 30 minutes — the exact data-loss scenario the commit was intended to fix.

**Fix:** Apply the dynamic TTL after filtering:

```javascript
const bsd = await handleTennisBSD(suffix, ck, 30 * 60 * 1000);
if (bsd.status === 200) {
  let _extracted = _extractBsdMatchesList(bsd.body);
  // ... filter finished ...
  const hasLive = _extracted.some(m => {
    const st = String(m.status || '').toLowerCase();
    return st === 'live' || st === 'inprogress' || st === 'in_progress';
  });
  if (hasLive) {
    // Invalidate cache entry so next call re-fetches at 5min
    // (depends on handleTennisBSD's cache invalidation API)
  }
}
```

Alternatively, pass the TTL after fetching — but since `handleTennisBSD` likely reads the cache before fetching, the TTL needs to be decided before the fetch or the cache layer needs an invalidation path.

---

### WR-04: `_TENNIS_SURFACE_KEYWORDS` ' utr ' keyword with embedded spaces — double-wrapping risk

`server.js:22662,22667` — The lookup function wraps the normalised tournament name with leading and trailing spaces: `' ' + name + ' '`. The keyword `' utr '` already contains leading and trailing spaces. This means the effective pattern matched in the padded string is `'  utr  '` (double space), which will **never match** `' utr '` in the padded string unless the raw tournament name itself contains double spaces around "utr". The other UTR keywords (`'utr ptt'`, `'utr pro'`) do not have this problem because they have no surrounding spaces.

**Fix:** Remove the surrounding spaces from the keyword:

```javascript
// Change:
' utr '
// To:
'utr'  // or 'utr ' if disambiguation from 'saturn' etc. is needed
```

Or change the keyword check to `s.includes(' utr ')` with single spaces, which the double-padded `s` correctly handles since `' ' + 'utr pro tour' + ' '` → `' utr pro tour '` which contains `' utr '`.

Wait — re-reading: the padded `s` is `' utr pro tour '`. `s.includes(' utr ')` → `true` because `' utr '` appears at position 0-4. The keyword in the array is `' utr '` and `s.includes(' utr ')` does work correctly here because the leading space of the padded string provides the left anchor. The double-space risk only materialises if the raw name starts with "utr" with no preceding text, which the pad handles. **This is actually safe in the common case** — but if a tournament is named exactly `" UTR "` with surrounding spaces in the raw feed, the padded string becomes `"  utr  "` and `includes(' utr ')` still matches (substring). Low risk but worth documenting; the real concern is false positives: `'toronto'` in the Hard keywords matches any tournament name containing the substring "toronto" — including hypothetical non-hard-court events in the Toronto area. Not an immediate bug since Toronto (Rogers Cup) is always hard court, but the keyword approach has no disambiguation from tournament type.

---

### WR-05: localStorage snapshot — cross-tab write race corrupts snapshot silently

`pariscore.html:19936` — `localStorage.setItem(_TN_SNAP_STORAGE_KEY + '_ls', ...)` is called from `_tnSnapshotPersist()` which fires on every match poll cycle across every open tab. Two tabs on the same origin write to the same localStorage key without coordination. Tab A's 50-entry LRU slice can overwrite Tab B's more-recent entries. The user ends up with whichever tab last wrote winning, potentially losing enrichment data from the other tab's session.

The `catch (_) {}` silences both quota errors and the write race — there is no `storage` event listener to merge concurrent writes.

**Fix (minimal):** Use a `storage` event listener to merge incoming changes from other tabs:

```javascript
window.addEventListener('storage', function(ev) {
  if (ev.key !== _TN_SNAP_STORAGE_KEY + '_ls') return;
  if (!ev.newValue) return;
  try {
    var _incoming = JSON.parse(ev.newValue);
    var _now = Date.now();
    for (var _k in _incoming) {
      if (!Object.prototype.hasOwnProperty.call(_incoming, _k)) continue;
      var _ie = _incoming[_k];
      if (!_ie || !_ie.ts || (_now - _ie.ts) >= _TN_SNAP_TTL_MS) continue;
      var _existing = window._tnPrematchSnapshot.get(_k);
      if (!_existing || _ie.ts > _existing.ts) window._tnPrematchSnapshot.set(_k, _ie);
    }
  } catch (_) {}
});
```

---

## Info

### IN-01: `_surfRaw.charAt(0)` silently truncates single-character surface codes

`server.js:28728` — If BSD sends surface as `"H"` (single char shorthand for Hard), `_surfNorm` becomes `"H"` (char 0 uppercased + `"h".toLowerCase()` = `"H"`). `TENNIS_ELO_SURFACES.includes("H")` is almost certainly false. `surfaceClean` becomes null and Elo enrichment is silently skipped. No log at this point. The `_surfaceFromKeywords` fallback (called earlier in the pipeline) would handle the tournament name, but if that also fails, the surface is lost with no diagnostic.

**Fix:** Add a shorthand expansion map before the `includes` check:
```javascript
const _SURF_SHORT = { 'H': 'Hard', 'C': 'Clay', 'G': 'Grass', 'I': 'Hard' };
const _surfNorm = _surfRaw
  ? (_SURF_SHORT[_surfRaw.toUpperCase()] || (_surfRaw.charAt(0).toUpperCase() + _surfRaw.slice(1).toLowerCase()))
  : null;
```

---

### IN-02: `post` in `_TN_VB_FINISHED` set — ambiguous status string

`server.js:28554` — `'post'` is included in the finished-match guard set. BSD does not document a `"post"` status in public schemas. If BSD introduces a status like `"postponed_rain"` that normalises (after `.replace(/[\s_-]/g, '')`) to `"postponedrain"`, it correctly misses. But `"post"` as a standalone value is unusual — if any match ever has `status: "post"` meaning something other than finished in a future BSD schema update, it will be silently dropped from the table. Low risk today but worth a comment explaining the origin of this value.

---

_Reviewed: 2026-05-24T16:50:00Z_
_Reviewer: Claude (adversarial code review)_
_Depth: standard (surgical — specified line ranges)_
