---
name: ps-test
description: QA audit of a PariScore module — checks null safety, server/frontend sync, route validation, UX states, data integrity, and produces a test report in .context/test-report-{module}.md
---

# PariScore — Agent Testeur QA

## Déclencheur
Après livraison d'une feature. L'utilisateur dit "teste", "audit", "QA", "vérifie les bugs de".

## Procédure de test standard

### 1. Synchronisation server ↔ frontend
Lire server.js ET pariscore.html pour vérifier que toute config est bien dupliquée :
- Arrays de configuration (STRATEGIES ↔ STRATEGIES_UI, etc.)
- Clés identiques côté backend et frontend
- Aucune clé orpheline d'un côté ou de l'autre

### 2. Null safety — simuler les cas dégradés
Pour chaque fonction critique, vérifier le comportement si :
- `m.poisson == null` ou `undefined`
- `m.stats == null` / `m.stats.home == null` / `m.stats._real == false`
- `m.odds == null` ou un champ absent
- `m.expectedGoals == null`
- Réponse API vide `[]` ou `{}`
- Réponse API erreur HTTP 429 / 500 / réseau coupé

Signaler tout accès non protégé (ex: `m.stats.home.ppg` sans optional chaining).

### 3. Cohérence données SIM vs LIVE
- Les features qui s'appuient sur des données statistiques (avgConceded, ppg, etc.) doivent vérifier `m.stats?._real === true` avant d'appliquer une logique sensible
- Les données SIM (badge gris) ont des valeurs artificielles — les bonus/malus ne doivent pas s'appliquer sur SIM

### 4. Validation des routes API
- Paramètres manquants → HTTP 400 avec message clair ?
- Paramètres invalides → bornés/sanitisés correctement ?
- Méthode HTTP incorrecte (POST sur une route GET) → ignorée ou 405 ?
- `type` en minuscule vs majuscule → case-insensitive ?
- `db.matches` vide → retourne `[]` proprement ?

### 5. États UI
- **Loading skeleton** → affiché AVANT le fetch (dans renderXxxSkeletons()) ?
- **Empty state** → affiché si 0 résultats après filtre ?
- **Error state** → affiché si fetch HTTP échoue (4xx/5xx) ?
- **Success state** → données correspondent bien à la réponse API ?
- Les skeletons sont-ils remplacés (pas accumulés) après chargement ?

### 6. UX & seuils visuels
- Les seuils de couleur (confClass, etc.) sont-ils adaptés à la plage de valeurs du marché ?
  - Ex: CS_00 a naturellement des probas de 5-20% → seuil >75% = "high" est inapproprié
- Les cotes estimées (`implied_odds`) sont-elles clairement différenciées des vraies cotes (`odds`) ?
- Les badges LIVE/SIM sont-ils visibles et cohérents avec les données affichées ?

### 7. Performance (estimation statique)
- Les `.filter().map().filter().sort().slice()` sur db.matches → O(n log n), OK jusqu'à ~500 matchs
- JSON.stringify de db.matches dans les broadcasts SSE → estimer la taille en prod (150 matchs ≈ 150 Ko)
- Les caches (24h advancedTeamStats, 6h AI Scout) sont-ils vérifiés avant tout appel API ?

### 8. Syntaxe finale
```bash
node --check server.js
```

## Format du rapport
Écrire dans `.context/test-report-{module}.md` :

```markdown
# Test Report — {Module}
**Date** : YYYY-MM-DD

## ✅ Tests passés
- [liste items OK]

## ⚠️ Avertissements (non bloquants)
### W1 — Titre
Localisation, Problème, Recommandation

## ❌ Bugs détectés
### BUG-1 — Titre
Sévérité, Localisation, Code problématique, Fix proposé

## 💡 Recommandations d'amélioration
1. ...
```

## Après le rapport
- Corriger immédiatement les bugs `❌` (BUG-X) avant de déclarer la feature "livrée"
- Les `⚠️` sont à intégrer dans la roadmap P1/P2 de CLAUDE.md si non déjà présents
- Mettre à jour CLAUDE.md : `[ ] Audit QA {module}` → `[x]` avec lien vers le rapport
