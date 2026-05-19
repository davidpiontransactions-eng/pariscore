# Étude comparative — transfermarkt-api vs stack PariScore actuel
**Date** : 2026-05-19
**Objet** : décider voie d'intégration `felipeall/transfermarkt-api` (valeur marchande / transferts / blessures foot)
**Statut** : étude pré-décision (demandée DG avant arbitrage zero-dep)

---

## 1. Source évaluée

`felipeall/transfermarkt-api` — FastAPI Python, scrape Transfermarkt (pas d'API officielle). MIT. Self-host Docker port 8000. Demo `transfermarkt-api.fly.dev` = "testing only", rate-limit `2/3s`, **injoignable depuis env de test (HTTP 000)**. 398★.

### Endpoints (13)
| Groupe | Routes |
|--------|--------|
| players | `/players/search/{name}` · `/{id}/profile` · `/{id}/market_value` · `/{id}/transfers` · `/{id}/jersey_numbers` · `/{id}/stats` · `/{id}/injuries` · `/{id}/achievements` |
| clubs | `/clubs/search/{name}` · `/clubs/{id}/profile` · `/clubs/{id}/players` |
| competitions | `/competitions/search/{name}` · `/competitions/{id}/clubs` |

---

## 2. Stack PariScore actuel (foot) — ce qui existe déjà

| Donnée | Source actuelle | Localisation | Profondeur |
|--------|-----------------|--------------|------------|
| **Valeur marchande** | BSD player payload | server.js:2042 `p.market_value \|\| null` | **Scalaire courant uniquement** — pas d'historique, présent seulement si fiche joueur fetchée |
| **Transferts** | API-Football `/transfers?team=` | server.js:6604 `fetchAFTransfers` | **Team-scoped, fenêtre 180j**, champs `{date,type,team_in,team_out}` — **pas de montant €**, cache 24h |
| **Blessures** | BSD `unavailable_players` | server.js:5473 | **Par match (contexte live)**, `{reason,type}` — pas d'historique joueur, cache team/saison |
| Profil joueur | BSD | server.js:2035+ | age, birthdate, photo, team, height, weight, preferred_foot, season_stats |

Coût actuel : **zéro dépendance ajoutée** (BSD + API-Football PRO déjà payés/intégrés, Node natif).

---

## 3. Comparatif tête-à-tête

| Axe | PariScore actuel | transfermarkt-api | Verdict |
|-----|------------------|-------------------|---------|
| Valeur marchande **instantanée** | ✅ BSD (scalaire) | ✅ Transfermarkt | Égalité |
| Valeur marchande **historique (série temps)** | ❌ absent | ✅ `/market_value` time-series | **TM gagne** (donnée phare Transfermarkt) |
| Transferts **montant € (fee)** | ❌ absent (AF sans fee) | ✅ historique + fee | **TM gagne** |
| Transferts **historique carrière joueur** | ❌ team-scoped 180j | ✅ `/{id}/transfers` complet | **TM gagne** |
| Blessures **contexte match live** | ✅ BSD unavailable_players | ❌ (historique seulement) | **PariScore gagne** (pertinent paris live) |
| Blessures **historique joueur** | ❌ absent | ✅ `/{id}/injuries` | **TM gagne** (signal fragilité) |
| Palmarès / numéro maillot | ❌ | ✅ achievements/jersey | TM (cosmétique) |
| Fraîcheur / fiabilité | ✅ APIs live payées | ⚠ scrape Transfermarkt (anti-bot, fragile) | **PariScore gagne** |
| Couverture ligues | large (BSD+AF PRO) | large (Transfermarkt) | Égalité |

### Synthèse
**Complémentaire, pas redondant.** PariScore actuel = orienté **contexte match/équipe live** (paris). Transfermarkt = profondeur **carrière joueur** (valeur marchande série temporelle, fee transferts, historique blessures). Recoupement réel uniquement sur valeur marchande instantanée + transferts récents.

---

## 4. Value-add net pour PariScore

Pertinent SI le produit veut des **fiches joueur profondes** :
- Roadmap CLAUDE.md : « Fiche Quant » player cards + Power Score V2 (presse/consensus).
- Signal pari exploitable : historique blessures (fragilité récurrente), trend valeur marchande (forme/cote implicite marché transferts).
- Faible si scope reste match-context live (déjà couvert).

---

## 5. Coût intégration (rappel — bloquant archi)

| Voie | Effort | Dérogation | Risque |
|------|--------|-----------|--------|
| **A — Docker sidecar VPS** | moyen (Dockerfile fourni) | **casse zero-dep** : Python+Docker sur VPS OVH, +RAM, supervision pm2/docker | scrape TM côté service = anti-bot/CF (leur problème mais notre uptime) |
| **B — demo fly.dev** | faible | aucune | ❌ "testing only", rate-limit, indispo observée — rejeté prod |
| **C — port Node natif** | lourd (réécrire scraping TM) | aucune (zero-dep préservé) | anti-bot Transfermarkt à gérer nous-mêmes, maintenance DOM |

ToS Transfermarkt hostile au scraping (flag légal/éthique, idem aiscore).

---

## 6. Recommandation

**Différer sauf si « Fiche Quant joueur » devient priorité produit.**

Raisonnement :
1. Recoupement partiel avec stack actuel (valeur instantanée + transferts récents déjà là, zéro coût).
2. Value-add réel = **historique** (valeur marchande série, fee, blessures carrière) → utile seulement pour fiches joueur profondes, pas pour le cœur paris match-context actuel.
3. Toute voie viable prod (A) **casse le zero-dep** (Python sidecar) → décision DG explicite requise, pas un quick win.
4. Voie C (port Node) = effort lourd + reprise dette anti-bot Transfermarkt — non prioritaire vs roadmap P0/P1.

**Si priorisé** : voie A (Docker sidecar isolé, proxy `httpsGet localhost:8000`, cache agressif 24h+, fallback gracieux), scope limité à `/{id}/market_value` + `/{id}/injuries` + `/{id}/transfers` (les 3 value-add). Budget ~1j (Dockerfile fourni) + supervision.

**Sinon** : rester sur BSD/API-Football actuel — suffisant pour le périmètre paris match-context.

---
*Fin. Décision attendue : prioriser Fiche Quant joueur (→ voie A) ou différer (→ statu quo).*
