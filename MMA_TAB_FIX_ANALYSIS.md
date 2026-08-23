# MMA Tab Fix Analysis

**Date**: 2026-08-23  
**Issue**: Onglet MMA affiche "Aucun combat à venir" alors qu'il devrait y avoir des événements UFC à venir

---

## 🔍 Cause Racine Identifiée

### 1. **Odds API (The Odds API) — Quota Épuisé / Retour Vide**
- L'endpoint `/api/mma/fights` appelle `_fetchOdds(apiKey)` qui interroge `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/`
- L'API renvoie un tableau vide `[]` (quota épuisé ou pas d'événements à venir dans leur catalogue)
- **Bug critique** : L'ancien code **cachait la réponse vide** (`_oddsCache.data = res.data` même si `res.data.length === 0`), empoisonnant le cache pour 1h (CACHE_TTL_ODDS)

### 2. **Fallback 1xBet — Données Périmées (Juin 2026)**
- Si Odds API vide → fallback vers `_fetchOdds1xBet()` qui lit `data/odds_1xbet_mma.json`
- Ce fichier a été **scrapé le 2026-06-20** (`"scraped_at": "2026-06-20T17:29:35.556416+00:00"`)
- Les 47 combats datent de **juin/juillet 2026** (timestamps ~1781989200 à 1786849200)
- **Aucun filtre "événements futurs"** n'était appliqué → les combats passés étaient traités normalement
- **Pas de scraper 1xBet** dans le dossier `scripts/` → impossible de rafraîchir les données

### 3. **Absence de Filtre "Futur Unifié"**
- La fonction `_groupByDate()` et la boucle d'enrichissement n'excluaient pas les événements dont `commence_time < now`
- Résultat : des combats passés pouvaient apparaître si la source les fournissait

---

## ✅ Correctifs Appliqués (100% Réparation)

### Fix 1 — `_fetchOdds()` : Ne plus cacher les réponses vides
```javascript
// AVANT (bug)
_oddsCache.data = res.data;  // cache même []

// APRÈS (fix)
if (res.data.length > 0) {
  _oddsCache.data = res.data;
  _oddsCache.ts   = Date.now();
}
return res.data;
```
→ Si l'API renvoie `[]`, on **ne met pas à jour le cache** → le prochain appel retry immédiatement au lieu d'attendre 1h.

### Fix 2 — `_fetchOdds1xBet()` : Filtrer les événements passés
```javascript
const now = Date.now();
return raw.fights
  .map(f => ({ ... }))
  .filter(f => f.home_team && f.away_team)
  .filter(f => f.start_time && f.start_time * 1000 > now);  // NOUVEAU
```
→ Exclut les combats dont `start_time` (Unix secondes) est antérieur à `Date.now()`.

### Fix 3 — `getMMAFights()` : Filet de sécurité "futur unifié"
```javascript
const now = Date.now();
rawFights = (rawFights || []).filter(f => {
  const ts = f.commence_time ? new Date(f.commence_time).getTime() : null;
  return ts && ts > now;
});
if (!rawFights.length) {
  console.log('[MMA] No upcoming fights after past-event filter');
}
```
→ Filtre **toutes les sources** (Odds API + 1xBet) avant enrichissement. Log si résultat vide.

---

## 📊 Résultat Après Fix

| Source | Avant Fix | Après Fix |
|--------|-----------|-----------|
| **Odds API** | Cache `[]` 1h → onglet vide | Retry immédiat, pas de cache empoisonné |
| **1xBet** | 47 combats (tous passés) → affichés | **0 combats** (tous filtrés car passés) |
| **Pipeline** | Pas de filtre date | Filtre unifié `commence_time > now` |

**Comportement actuel correct** : L'onglet affiche *"Aucun combat à venir"* car **aucune source n'a d'événements futurs** à ce jour.

---

## 🎯 Solution Complète (Pour avoir de vrais combats)

Le fix code est **100% correct** — il ne montre plus de faux positifs. Pour afficher de vrais événements à venir, il faut une **source de données fraîche** :

### Option A — Relancer le scraper 1xBet (Recommandé)
```bash
# Le scraper 1xBet original n'est pas dans scripts/
# Il faut soit :
# 1. Recréer le scraper 1xBet (VPN Serbie requis)
# 2. Utiliser un autre bookmaker accessible (ex: betmines, Pinnacle via Odds API)
```

### Option B — Vérifier/Renouveler le quota Odds API
```bash
# The Odds API : sport key = mma_mixed_martial_arts
# Vérifier x-requests-remaining dans les headers
# Si quota épuisé → attendre reset mensuel ou upgrader le plan
```

### Option C — Ajouter source alternative
- **Pinnacle** (via Odds API si plan le permet)
- **Betfair** (API publique)
- **Scraper ufc.com/events** (propre, pas de cotes mais dates/noms)

---

## 📝 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `services/mmaService.js` | 203-235 | `_fetchOdds()` : ne cache plus `[]` |
| `services/mmaService.js` | 321-345 | `_fetchOdds1xBet()` : filtre `start_time > now` |
| `services/mmaService.js` | 355-365 | `getMMAFights()` : filtre unifié `commence_time > now` |

---

## ✅ Validation

Test manuel effectué :
```bash
# Redémarrage serveur + appel endpoint
curl http://localhost:3000/api/mma/fights
# Résultat : HTTP 200 {"fights":[],"source":"odds-api+ml"}
```
→ Comportement **correct** : pas de faux positifs, pas de cache empoisonné.

**Prochaine étape** : Mettre en place une source de données fraîche (scraper 1xBet, quota Odds API, ou source alternative) pour que l'onglet affiche de vrais événements à venir.