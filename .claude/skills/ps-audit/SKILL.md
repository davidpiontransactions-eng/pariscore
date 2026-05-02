---
name: ps-audit
description: Full audit of PariScore project state — reads CLAUDE.md roadmap, verifies implementations in server.js and pariscore.html, and produces a punch list of done vs pending vs blocked items.
---

# PariScore — Audit de l'État du Projet

## Déclencheur
Quand l'utilisateur veut savoir où en est le projet, ce qui est réellement implémenté, et quoi faire ensuite.

## Procédure d'audit

### 1. Lire la roadmap
Lire `CLAUDE.md` sections :
- `## 15. TODOLIST` — Roadmap P0 / P1 / P2-P3
- `## 16. Tâches Accomplies` — Features hors roadmap principale

### 2. Vérifier l'implémentation réelle

**server.js** — vérifier :
- `const STRATEGIES = {` → liste des stratégies disponibles
- Routes `/api/v1/*` → endpoints actifs
- `const LEAGUE_CRON_MS` → gestion quotas T1/T2
- `db.statsUpdateByLeague` → tracking par ligue
- Smart Polling `fixtures?live=all` → SSE ou polling 5min ?
- `sendValueBetAlerts()` → alertes Telegram actives ?

**pariscore.html** — vérifier :
- `const STRATEGIES_UI = [` → synchronisé avec server.js ?
- Onglets présents : Accueil / Matchs / Prédictions / Tendances / Alertes / Tarifs / Top Stratégies / Historique
- `initStrategiesPage` / `initHistoriquePage` → appelées dans `showPage()` ?

**CLAUDE.md** — vérifier cohérence :
- Items `[x]` correspondent-ils à du code réel ?
- Items `[ ]` sont-ils vraiment manquants ?

### 3. Rapport à produire

Format de sortie :

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AUDIT PARISCORE — [DATE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ FAIT & VÉRIFIÉ
  - [liste des items confirmés dans le code]

⚠️  MARQUÉ FAIT MAIS NON VÉRIFIÉ
  - [items [x] dans CLAUDE.md mais code non trouvé]

❌ EN ATTENTE (roadmap)
  P1: [liste P1 non commencés]
  P2: [liste P2]

🔧 QUICK WINS (< 2h)
  - [items P1 ou P2 estimés courts]

🎯 RECOMMANDATION PROCHAIN SPRINT
  [1 item prioritaire avec justification]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Après l'audit
Si des incohérences CLAUDE.md ↔ code sont trouvées → proposer de les corriger immédiatement.
Si un item `[ ]` est en réalité déjà implémenté → le marquer `[x]` avec la date.

## Contraintes
- Lire les fichiers avant de conclure — ne pas s'appuyer uniquement sur CLAUDE.md
- Signaler explicitement si un `[ ]` semble partiellement implémenté
- Toujours terminer par une recommandation actionnable (1 sprint)
