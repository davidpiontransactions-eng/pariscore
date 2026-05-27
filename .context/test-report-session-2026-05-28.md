# Test Report — Session Fixes 2026-05-28
**Date** : 2026-05-28  
**Scope** : lzdg Phase 2 (defer boot), TennisVB e→m, BetMines Accept-Encoding, hgad/rcmw/zia closures

---

## ✅ Tests passés

- **Syntaxe** : `node --check server.js` → OK · `node --check pariscore.js` → OK
- **TennisVB fix** : `e.youtube_url` → `m.youtube_url` ligne 29612. Seul `e.youtube_url` restant = `toCanonicalTennisMatch(e)` paramètre légitime — vérifié.
- **BetMines body += c** : Buffer plaintext (sans gzip) → string concat UTF-8 propre → JSON.parse OK
- **BetMines Accept-Encoding** : header `gzip, deflate, br` absent de la requête — logs lisibles sur 403
- **lzdg Phase 2** : `setTimeout(_bootStatsDelay)` enveloppe `withBootTimeout` — server.listen() écoute avant ETL
- **lzdg ordre correct** : `server.listen()` ligne 38242 → `bootInit()` ligne 38246 → `setTimeout(30s)` → `fetchStats`
- **zia flag opt-in** : `USE_API_FOOTBALL_ODDS` off par défaut — pas d'activation accidentelle prod
- **SPS confidence flag** : `pariscore.js:2498-2501` — `conf ? '#00e676' : '#ffa726'` + `⚠` icon présents
- **rcmw mobile** : `bottom-nav`, `haptic`, `pan-zoom` présents dans pariscore.js

---

## ⚠️ Avertissements (non bloquants)

### W1 — parseInt NaN guard `BOOT_STATS_DELAY_MS`
**Localisation** : `server.js:38225`  
**Problème** : `parseInt('abc', 10)` → `NaN` → `setTimeout(fn, NaN)` fire immédiat (pas de defer)  
**Fix appliqué** : `parseInt(...) || 30000` — NaN remplacé par défaut 30s  
**Statut** : ✅ corrigé dans cette session

### W2 — BetMines 403 IP ban persistant
**Localisation** : `fetchBetminesFixtures` VPS  
**Problème** : betmines.com bloque l'IP du VPS (bot detection CF) — non fixable en code  
**Impact** : fixtures BetMines absentes (non critiques, fallback BSD/ESPN actif)  
**Recommandation** : surveiller, envisager désactivation cron (`BETMINES_ENABLED=false`) si 403 persiste >7j

---

## ❌ Bugs détectés

Aucun.

---

## 💡 Recommandations

1. **Deploy VPS lzdg fix** : `git pull && pm2 restart pariscore` — valider avec `time curl http://localhost:3000/api/v1/status` TTFB <500ms
2. **Monitor SPS cron 02:00** : vérifier `player_surface_scores` > 0 demain matin (`SELECT count(*) FROM player_surface_scores`)
3. **BetMines** : si 403 >7j → ajouter `BETMINES_ENABLED=false` `.env` VPS + disable cron
