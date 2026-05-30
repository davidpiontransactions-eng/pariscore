# Test Report — Discord Morning Strategy Picks
**Date** : 2026-05-30

## ✅ Tests passés
- Syntax check `node --check server.js` → clean
- `DISCORD_MORNING_PICKS_WEBHOOK_URL` → fallback sur `DISCORD_FOOT_WEBHOOK_URL` si absent
- `getTopMatchesByStrategy(stratKey, 5, 65)` → retourne `null` si stratégie inconnue, `[]` si aucun pick → géré avec `if (!picks || !picks.length)`
- Null-safety `p.odds != null` guard avant `safeFixed(p.odds, 2)` ✅
- Null-safety `strat.tipsterFlag || ''` + `strat.tipster || 'Modèle ML/Poisson'` ✅
- Chunking Discord : boucle `i += 10` → respecte cap 10 embeds/message ✅
- Cron : `_msUntilNextParisHour(8)` → aligné 8h Paris ✅
- Test route admin-only : JWT role=admin requis → HTTP 403 sinon ✅
- `force: true` dans test route → bypass `automatedAlertsAllowed()` → fonctionne hors NODE_ENV=production ✅
- 5 stratégies par défaut : BTTS_YES, OVER_2_5, OVER_1_5, HOME_WIN, AWAY_WIN ✅
- Couleurs Discord par stratégie (0xf59e0b amber BTTS, 0xff4d4d red OVER_2_5, etc.) ✅
- `model_source` tag ML/DC dans embed (`[ML]` = ml-catboost, `[DC]` = dixon-coles) ✅

## ⚠️ Avertissements (non bloquants)
### W1 — commence_time invalide
Si un match a `commence_time` null/undefined, `new Date(null).toLocaleString()` retourne `"Invalid Date"` dans l'embed.
Risque très faible : `getTopMatchesByStrategy` filtre déjà `new Date(m.commence_time).getTime() > now`.

### W2 — Pas de dedup cross-stratégie
Un même match peut apparaître dans plusieurs embeds (ex: BTTS_YES + OVER_2_5 sur même match).
Non bloquant — intentionnel (chaque stratégie est indépendante).

## 💡 Recommandations
1. VPS `.env` : copier les 3 lignes `DISCORD_*_WEBHOOK_URL` depuis `.env` local
2. Test production immédiat : `POST /api/v1/discord/morning-picks/test` avec header `Authorization: Bearer <admin_jwt>`
3. Variable `DISCORD_MORNING_PICKS_STRATEGIES` configurable via env si besoin d'ajouter DRAW/UNDER_2_5 plus tard
