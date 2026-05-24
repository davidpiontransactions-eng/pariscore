# VPS Deployment Checklist — 2026-05-24

**Latest Commits Ready for Deploy:**
- `8ac1e19` fix(nav): white background for proper text contrast
- `28dce32` docs(rcmw): audit C1-C7 epic completion
- `e779169` feat(tennis): WElo (Weighted Elo) integration

---

## Deploy Steps (SSH to OVH VPS)

### 1. Pull Latest Code
```bash
cd /home/ubuntu/pariscore
git pull origin main
# Expected: Already up to date (or Fast-forward X commits)
```

### 2. Verify Node Modules (if needed)
```bash
node --version  # Should be >= 16
npm list 2>/dev/null | head -3  # Verify zero deps (vanilla Node.js)
```

### 3. Restart Service
```bash
pm2 restart pariscore
pm2 logs pariscore --lines 50 --nostream
```

### 4. Health Check
```bash
# Wait 5-10s for boot
sleep 10

# Check HTTP availability
curl -s http://localhost:3000/ > /dev/null && echo "✓ HTTP OK" || echo "✗ HTTP FAILED"

# Check API endpoint
curl -s http://localhost:3000/api/v1/status | jq '.uptime_seconds, .total_matches' 2>/dev/null || echo "API check timeout"
```

### 5. Verify Nav Fix Deployed
```bash
# Check CSS in live HTML (should have white background)
curl -s http://localhost:3000/ | grep -A2 "nav {" | grep "background: #ffffff" && echo "✓ Nav white background deployed" || echo "⚠ Check nav CSS"
```

### 6. Monitor Logs (5 min)
```bash
pm2 logs pariscore --lines 100 --nostream | grep -E "error|Error|ERROR|boot|ready|WARNING" || echo "✓ No errors in logs"
```

---

## Post-Deploy Validation

- [ ] HTTP endpoint responsive (<2s TTFB)
- [ ] /api/v1/status returns valid JSON
- [ ] Nav bar displays white background (visual check via browser)
- [ ] No CPU pegging (>80%) in first 30s
- [ ] Mobile Premium (rcmw) features accessible on `/` homepage
- [ ] WElo tennis API routes accessible: `/api/v1/tennis/elo/rankings`, `/api/v1/tennis/elo/stats`

---

## Rollback (if needed)
```bash
cd /home/ubuntu/pariscore
git log --oneline -3  # Find previous commit
git revert HEAD       # or git reset --soft HEAD~1
pm2 restart pariscore
```

---

**Deployed by:** Claude Code (automated)  
**Date:** 2026-05-24 16:09 GMT+2  
**Branch:** main @ 8ac1e19  
**Changes:** Nav CSS fix + rcmw docs + tennis Elo docs
