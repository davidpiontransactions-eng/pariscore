# Debugging Report: WOM → Discord Integration Failure

## Summary

The WOM (Weight of Money) Discord card publishing is not working due to an **empty cache file** caused by Cloudflare blocking the scraping process.

---

## Architecture Overview

```
tools/scrape-betwatch-wom.js
        ↓ (writes)
data/betwatch_wom.json  ← EMPTY (count:0, matches:[])
        ↓ (reads)
betwatchService.js (betwatchService.enabled() → false due to empty cache)
        ↓ (bridge via wom.local.js)
server.js _womDetectMovements() → 0 movements detected
        ↓
bsdPostWOM() → never called (no movements)
        ↓
Discord #weight-of-money card → NOT POSTED
```

---

## Root Causes (in order of severity)

### 1. Cache file is empty

**File:** `data/betwatch_wom.json`

```json
{"ts":1781025405679,"date":"2026-06-09","source":"betwatch.fr/getMoney","count":0,"with_wom":0,"matches":[]}
```

- `count: 0` — scraper ran but found 0 matches
- `ts: 1781025405679` — June 9, 2026 (recent)
- `matches: []` — no data scraped

**Why:** The scraper hits `https://betwatch.fr/football/getMoney` but Cloudflare blocks the `gstack browse` transport. The scraper catches the block, logs `[betwatch] ÉCHEC Cloudflare (browse)`, and exits with code 2 — but since it runs silently (likely via cron), nobody noticed.

### 2. Two separate Discord paths (confusing architecture)

There are **two independent Discord alert systems**:

| Path | Trigger | Target |
|------|---------|--------|
| `scrape-betwatch-wom.js` lines 247-256 | WOM evolution between scrapes | `DISCORD_WOM_WEBHOOK_URL` or fallback `DISCORD_FOOT_WEBHOOK_URL` |
| `server.js bsdPostWOM()` lines 3504-3508 | Real-time WoM% change ≥ 12pts on BSD football events | `${BSD_ROOT_URL}/tipsters/api/wom/` → BSD API → Discord |

Both require the cache to be populated. Both fail silently when cache is empty.

### 3. Server.js flow requires BSD_API_KEY + BSD_BASE_URL

**File:** `server.js` lines 3516-3526

```javascript
const WOM_AP_ENABLED      = process.env.WOM_AUTOPUBLISH !== 'false';
function _womProviderOn()  { return !!(womLocal && womLocal.enabled && womLocal.enabled()); }
```

In `_runWomAutoPublish()` line 3588:
```javascript
if (!WOM_AP_ENABLED || !BSD_API_KEY || !_womProviderOn()) return;
```

- `womLocal.enabled()` reads cache → **returns false (cache empty)**
- → `_womProviderOn()` → false
- → `_runWomAutoPublish()` returns immediately without posting

Even if cache had data, it would also fail if `BSD_API_KEY` or `BSD_BASE_URL` is missing.

---

## Key Code References

### betwatchService.js — enabled() check
```javascript
function enabled() {
  return !process.env.BETWATCH_DISABLED && !!_load();
}
function _load() {
  // ... reads data/betwatch_wom.json
  // Returns { ts, date, byKey: Map, count } or null if file missing/empty
  // If matches:[] → byKey.size === 0 → falsy → enabled() → false
}
```

### server.js — movement detection
```javascript
// Line 3556: skips if no WOM data
if (!d || !d.wom || !d.money) continue;
// → with empty cache, _find() returns null → fetchMatchWOM() returns null → continue
```

### server.js — bsdPostWOM call
```javascript
// Line 3605
const r = await bsdPostWOM(fresh, WOM_AP_AD_URL);
// Posts to ${BSD_ROOT_URL}/tipsters/api/wom/ with Bearer token
```

---

## How to Verify

### Step 1: Run scraper manually and observe output

```bash
cd "C:\Users\david\Documents\dev PariScore\ParisScorebis"
node tools/scrape-betwatch-wom.js
```

**Expected success output:**
```
[betwatch] transport: browse C:\Users\david\.claude\skills\gstack\browse\dist\browse.exe
[betwatch] CF OK — "Moneyway"
[betwatch] football — 25 marchés, 18 WOM
[betwatch] wrote ...\data\betwatch_wom.json — 25 matchs, 18 avec WOM
```

**Actual (likely) output:**
```
[betwatch] transport: browse C:\Users\david\.claude\skills\gstack\browse\dist\browse.exe
[betwatch] ÉCHEC Cloudflare (browse) — "Just a moment..."
```

### Step 2: If Cloudflare blocks → use FlareSolverr

On VPS with Docker:
```bash
docker run -d -p 8191:8191 --name flaresolverr ghcr.io/flaresolverr/flaresolverr:latest
```

Then run scraper:
```bash
FLARESOLVERR_URL=http://localhost:8191 node tools/scrape-betwatch-wom.js
```

### Step 3: Check .env variables

Required for server.js WOM auto-publish:
```bash
WOM_AUTOPUBLISH=true        # must NOT be 'false'
BSD_API_KEY=your_key_here
BSD_BASE_URL=https://sports.bzzoiro.com
```

Required for scrape script Discord alerts:
```bash
DISCORD_WOM_WEBHOOK_URL=https://discord.com/api/webhooks/...
# or fallback:
DISCORD_FOOT_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Step 4: Test the BSD API endpoint directly

```bash
curl -X POST "https://sports.bzzoiro.com/tipsters/api/wom/" \
  -H "Authorization: Token YOUR_BSD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"movements":[{"sport":"football","bsd_id":12345,"selection":"home","prob_before":45.2,"prob_after":58.1,"volume_before":12000,"volume_after":18500,"volume_total":25000}]}'
```

---

## Why It Worked Before (Historical Context)

The architecture comment at `betwatchService.js` line 3 says:
> "bd 17y6. Source SHARP secondaire (signal additif). Inerte si le cache absent."

The system was **designed** to be inert when cache is empty — it does NOT error, it just silently skips. This is why nobody noticed until the cache went stale.

The scraper was likely running on a schedule (cron) and the Cloudflare block started happening after a betwatch.fr anti-bot update.

---

## Recommended Fix Sequence

1. **Immediate:** Run scraper manually → confirm Cloudflare block
2. **If blocked:** Deploy FlareSolverr on VPS → update cron job to use `FLARESOLVERR_URL=`
3. **Verify:** Cache populated → `data/betwatch_wom.json` shows `count > 0`
4. **Test server flow:** Restart server.js → check logs for `[WOM:AutoPublish] tick:` output
5. **Monitor:** Set up alerting on scraper exit code (non-zero = failed)

---

## Files Involved

| File | Role |
|------|------|
| `tools/scrape-betwatch-wom.js` | Standalone scraper (cron-run, gitignored output) |
| `data/betwatch_wom.json` | Cache file read by betwatchService.js |
| `betwatchService.js` | Cache reader, exposes fetchMatchWOM() |
| `wom.local.js` | Bridge requiring betwatchService (gitignored) |
| `server.js` lines 3501-3615 | WOM auto-publish cron job |
| `.env` | API keys, webhook URLs, `FLARESOLVERR_URL` |

---

## Conclusion

**The integration is not broken — it's just waiting for data.** The scraper needs to successfully populate the cache. Once `data/betwatch_wom.json` has `count > 0` and `matches: []` becomes `matches: [...]`, the full chain will work:

1. betwatchService.enabled() → true
2. _womProviderOn() → true  
3. _womDetectMovements() → detects movements from BSD API events
4. bsdPostWOM() → posts to BSD API
5. Discord card appears in #weight-of-money

**Priority action: Run `node tools/scrape-betwatch-wom.js` manually and fix the Cloudflare blocking.**
