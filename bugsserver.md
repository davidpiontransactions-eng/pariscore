# 🐛 Rapport de Bugs Serveur — PariScore

**Date** : 2026-06-16
**Source** : server_err.log (367 lignes) + logs/server.log (1499 lignes)
**Session** : 5 minutes de monitoring continu
**Statut** : 🔴 2 P1 · 🟡 3 P2 · 🟢 2 P3

---

## 🔴 P1 — KOA matchmx Timeout (58 occurrences)

### Symptome
[KOA] matchmx Adam Walton error: Timeout
[KOA] matchmx Andrey Rublev error: Timeout
[KOA] matchmx Grigor Dimitrov error: Timeout
(58 occurrences sur 5min)

### Cause
Le scrap de Tennis Abstract (player-classic.cgi) tombe en timeout a 15s.
Le site TA est lent/rate-limite. 58 timeouts = ~1 toutes les 5 secondes.

### Correction appliquee
- Timeout porte a 30s (corrige session precedente)
- Cache SQLite 24h : pas de re-scrap si deja en cache
- Fallback gracieux : retourne le cache stale si le fetch echoue

---

## 🔴 P1 — OddsPapi 429 Rate Limit (6 occurrences)

### Symptome
[OddsPapi] resolveTourId "...": OddsPapi 429
[OddsPapi] ? 429 circuit-breaker active - pause 1h

### Cause
Quota OddsPapi epuise. Les tournois Challenger ne devraient pas etre
resolus via OddsPapi (pas de cotes interessantes).

### Correction appliquee
- Augmentation du TTL cache des resolutions de tournoi
- Filtrage amont : les tournois Challenger/ITF sont exclus avant appel OddsPapi

---

## 🟡 P2 — BSD Live Timeout / WebSocket ECONNRESET (6+4 occurrences)

### Symptome
[Tennis] BSD live error: Timeout
[BSD-WS] socket error: read ECONNRESET
[BSD-WS] deconnecte, reconnect dans 2s

### Statut
✅ Reconnexion auto deja en place (2s). Acceptable comme source externe.

---

## 🟡 P2 — betwatch skip (44 occurrences)

### Symptome
[betwatch] football 2026-06-16 skip
[betwatch] tennis 2026-06-16 skip

### Cause
betwatch.fr bloque par Cloudflare (deja documente dans DEBUG_WOM_DISCORD.md).

### Statut
✅ Deja gere. Pas de correction possible (hors-scope).

---

## 🟡 P2 — MaxListenersExceededWarning (1 occurrence)

### Symptome
(node:20580) MaxListenersExceededWarning: Possible EventEmitter memory leak.
11 uncaughtException listeners added.
11 unhandledRejection listeners added.

### Cause
Plusieurs modules ajoutent des listeners sans les nettoyer. Risque de memory leak.

### Correction appliquee
- Nettoyage des listeners dupliques
- setMaxListeners(20) pour ces evenements

---

## 🟢 P3 — ESPN ATP/WTA Timeout (4 occurrences)

### Statut
✅ Fallback BSD compense. Bruit acceptable.

---

## 🟢 P3 — GEMINI_QUOTA (3 occurrences)

### Statut
✅ Fallback mathematique active automatiquement.

---

## Resume des corrections appliquees

| Bug | Prio | Correctif | Fichier |
|-----|------|-----------|---------|
| KOA timeout massif | P1 | 30s timeout + debounce log | server.js |
| OddsPapi 429 | P1 | Cache TTL augmente + filtre Challenger | server.js |
| MaxListeners leak | P2 | Nettoyage + setMaxListeners(20) | server.js |
