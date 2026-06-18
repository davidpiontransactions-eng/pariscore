# Rapport de Bugs — PowerScore Tennis Top 10

**Date :** 2026-06-18
**Module :** Tennis Top 10 — Mode PowerScore (`⚡ PW SCR`)
**Fichiers concernés :** `pariscore.js`, `server.js`, `pariscore.html`

---

## Résumé exécutif

Le mode PowerScore (`⚡ PW SCR`) de la page Tennis Top 10 est **non fonctionnel**. Le bouton existe dans le HTML mais l'affichage des barres comparatives J1 vs J2 ne fonctionne pas à cause d'un **mismatch de noms de champs** entre le serveur et le frontend.

| Bug | Sévérité | Impact |
|-----|----------|--------|
| [BUG-001](#bug-001--mismatch-nom-champ-powerscore) | 🔴 Critique | Aucun PowerScore affiché |
| [BUG-002](#bug-002--commentaire--et-accolade--sur-meme-ligne) | 🔴 Critique | Serveur ne démarre pas |
| [BUG-003](#bug-003--filtre-rank--120-non-appliqué-côté-frontend) | 🟡 Moyen | Données incohérentes possibles |
| [BUG-004](#bug-004--pas-de-gestion-détat-null-pour-ps1ps2) | 🟡 Moyen | Affichage cassé si données manquantes |

---

## BUG-001 : Mismatch nom champ PowerScore

**Sévérité :** 🔴 Critique — Aucun PowerScore affiché
**Fichier :** `pariscore.js` lignes 4379-4380
**Statut :** ❌ Non corrigé

### Description

Le template de carte `_tnTop10Card()` lit les champs `player1_powerscore` et `player2_powerscore`, mais l'API renvoie `powerscore_p1` et `powerscore_p2`.

### Code défectueux

```javascript
// pariscore.js:4379-4380
const ps1 = m.player1_powerscore != null ? Math.round(m.player1_powerscore) : null;
const ps2 = m.player2_powerscore != null ? Math.round(m.player2_powerscore) : null;
```

### Ce que l'API renvoie réellement

```javascript
// server.js:36209-36210
powerscore_p1: (e.player1 && e.player1.powerscore != null) ? e.player1.powerscore : null,
powerscore_p2: (e.player2 && e.player2.powerscore != null) ? e.player2.powerscore : null,
```

### Vérification API

```
GET /api/v1/tennis/top10?mode=powerscore

→ powerscore_p1: 51    ✅ présent
→ powerscore_p2: 20    ✅ présent
→ player1_powerscore: undefined  ❌ n'existe pas
→ player2_powerscore: undefined  ❌ n'existe pas
```

### Correction proposée

```javascript
// pariscore.js:4379-4380 — REMPLACER PAR :
const ps1 = m.powerscore_p1 != null ? Math.round(m.powerscore_p1) : null;
const ps2 = m.powerscore_p2 != null ? Math.round(m.powerscore_p2) : null;
```

### Impact

Sans ce fix, `ps1` et `ps2` sont toujours `null`, donc la condition `if (ps1 != null && ps2 != null)` (ligne 4381) est toujours `false`, et `psHtml` reste une chaîne vide. Le mode PowerScore affiche les mêmes cartes que le mode FAN.

---

## BUG-002 : Commentaire `//` et accolade `}` sur même ligne

**Sévérité :** 🔴 Critique — Serveur ne démarre pas
**Fichier :** `server.js` ligne 49026
**Statut :** ✅ Corrigé (changement `//` → `/* */`)

### Description

Un commentaire `//` sur la même ligne que l'accolade de fermeture `}` d'un bloc `if` provoque un **erreur de syntaxe** qui empêche le serveur de démarrer.

### Code défectueux (avant fix)

```javascript
// server.js:49026
if (srvIdx == null || retIdx == null) { // console.warn("[BUG-001] ..."); }
//                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                        TOUT ce qui suit // est un commentaire
//                                        DONC la } est COMMENTÉE
//                                        DONC le bloc if n'est JAMAIS fermé
```

### Explication

En JavaScript, `//` commentaire va jusqu'à la fin de la ligne. L'accolade `}` à la fin de la ligne 49026 est donc **incluse dans le commentaire** et ignorée par le parser. Le bloc `if` ouvert avec `{` n'est jamais fermé → `SyntaxError: Unexpected token ')'` à la ligne suivante.

### Correction appliquée

```javascript
// server.js:49026 — APRÈS FIX
if (srvIdx == null || retIdx == null) { /* console.warn("[BUG-001] ..."); */ }
```

Changement de `//` (commentaire ligne) vers `/* */` (commentaire bloc) permet de garder l'accolade `}` en dehors du commentaire.

### Vérification

```bash
node --check server.js  # ✅ Pas d'erreur
node server.js          # ✅ Démarre sur port 3000
```

---

## BUG-003 : Filtre rank ≤ 120 non appliqué côté frontend

**Sévérité :** 🟡 Moyen — Données potentiellement incohérentes
**Fichier :** `server.js` lignes 36219-36225 vs `pariscore.js` ligne 4683
**Statut :** ℹ️ Information

### Description

Le serveur applique un filtre qui exclut les matchs où le meilleur classé (P1 ou P2) est au-delà du Top 120 ATP/WTA :

```javascript
// server.js:36219-36225
var filtered = scored.filter(function(m) {
  var r1 = m.rank_p1, r2 = m.rank_p2;
  if (r1 == null && r2 == null) return true;
  var bestRank = (r1 != null && r2 != null) ? Math.min(r1, r2) : (r1 != null ? r1 : r2);
  return bestRank <= 120;
});
```

Ce filtre est appliqué **avant** le cache, donc le frontend reçoit déjà les données filtrées. Cependant :

1. Le frontend n'a **aucune vérification** de ce filtre — si le cache est corrupt ou si un match passe entre le filtre et l'affichage, rien ne bloque
2. Le mode `pwscr` utilise le **même filtre** que les modes `viewer`/`bettor`, mais le commentaire suggère que ce filtre pourrait ne pas être adapté au mode PowerScore (qui classe par `powerscore` au lieu de `score_top10`)

### Recommandation

Vérifier que le filtre est cohérent avec le mode `pwscr`. Si le mode PowerScore doit avoir un filtre différent (ex: filtrer par `ps_rank` au lieu de `rank_p1`/`rank_p2`), il faut le séparer.

---

## BUG-004 : Pas de gestion d'état null pour ps1/ps2

**Sévérité :** 🟡 Moyen — Affichage cassé si données manquantes
**Fichier :** `pariscore.js` lignes 4381-4416
**Statut :** ❌ Non corrigé

### Description

Le code suppose que `ps1` et `ps2` sont toujours disponibles quand on est en mode `powerscore`. Si un joueur n'a pas de PowerScore (nouveau joueur, données manquantes), la barre comparative ne s'affiche pas du tout — pas de fallback, pas de message.

```javascript
// pariscore.js:4381
if (ps1 != null && ps2 != null) {
  // ... render bar
}
// Si ps1 ou ps2 est null → psHtml reste '' → rien d'affiché
```

### Scénarios à couvrir

| Cas | ps1 | ps2 | Comportement actuel | Comportement attendu |
|-----|-----|-----|--------------------|--------------------|
| Les deux joueurs ont un PS | 51 | 20 | ✅ Barre affichée | OK |
| Joueur 1 sans PS | null | 20 | ❌ Rien affiché | Afficher "PS indisponible" pour J1 |
| Joueur 2 sans PS | 51 | null | ❌ Rien affiché | Afficher "PS indisponible" pour J2 |
| Aucun PS | null | null | ❌ Rien affiché | Afficher message explicatif |

### Correction proposée

```javascript
// pariscore.js:4381 — REMPLACER PAR :
if (ps1 != null || ps2 != null) {
  // Afficher la barre même si un seul PS est disponible
  // Griser le joueur sans PS
}
```

---

## Flux de données complet

```
┌─────────────────────────────────────────────────────────┐
│  BACKEND (server.js)                                    │
│                                                         │
│  _refreshTop10Cache()                                   │
│  ├─ Fetch matchs actifs depuis la DB                    │
│  ├─ Enrichir avec powerscore (getTennisSurfStats)       │
│  │   └─ player1.powerscore, player2.powerscore          │
│  ├─ computeScoreTop10Tennis(e, mode) → score_top10      │
│  ├─ Construire payload:                                 │
│  │   powerscore_p1: player1.powerscore  ← BIEN NOMMÉ   │
│  │   powerscore_p2: player2.powerscore  ← BIEN NOMMÉ   │
│  ├─ Filtre: bestRank <= 120                             │
│  └─ Cache: _tnTop10Cache[mode]                          │
│                                                         │
│  GET /api/v1/tennis/top10?mode=powerscore               │
│  └─ Retourne: { top10: [...], mode, computed_at }       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (pariscore.js)                                │
│                                                         │
│  fetchTennisTop10()                                     │
│  ├─ GET /api/v1/tennis/top10?mode=powerscore            │
│  ├─ Réponse: data.top10 = [                             │
│  │     { powerscore_p1: 51, powerscore_p2: 20, ... }    │
│  │   ]                                                  │
│  └─ Render: top10.map(m => _tnTop10Card(m, i+1))        │
│                                                         │
│  _tnTop10Card(m, rank)                                  │
│  ├─ if (_tnTop10Mode === 'powerscore') {                │
│  │     const ps1 = m.player1_powerscore  ← ❌ BUG      │
│  │     const ps2 = m.player2_powerscore  ← ❌ BUG      │
│  │     // ps1 = undefined, ps2 = undefined              │
│  │     // if (ps1 != null && ps2 != null) → false       │
│  │     // psHtml = '' → rien d'affiché                  │
│  │   }                                                  │
│  └─ Retourne HTML carte sans barre PowerScore            │
└─────────────────────────────────────────────────────────┘
```

---

## Fichiers à modifier

| Fichier | Lignes | Modification |
|---------|--------|-------------|
| `pariscore.js` | 4379-4380 | `m.player1_powerscore` → `m.powerscore_p1` et `m.player2_powerscore` → `m.powerscore_p2` |
| `pariscore.js` | 4381 | Considérer `ps1 != null \|\| ps2 != null` au lieu de `&&` |
| `server.js` | 49026 | ✅ Déjà corrigé (`//` → `/* */`) |

---

## Comment tester

1. Démarrer le serveur : `node server.js`
2. Ouvrir `http://localhost:3000`
3. Aller sur l'onglet **Tennis**
4. Cliquer sur **⚡ PW SCR**
5. **Avant fix :** Les cartes s'affichent mais sans barre PowerScore (identique au mode FAN)
6. **Après fix :** Les cartes affichent une barre comparative verte/grise J1 vs J2 avec les scores PowerScore

---

## Contexte technique

- **API** : `GET /api/v1/tennis/top10?mode=powerscore` — retourne `powerscore_p1`, `powerscore_p2`, `dims` (entropy, ev, stakes, urgency, movement)
- **Cache** : TTL 5 min pour le mode `pwscr`, refresh automatique toutes les 5 min
- **Tri** : En mode `pwscr`, les matchs sont triés par `max(powerscore_p1, powerscore_p2)` décroissant
- **Diversité** : Max 3 matchs par tournoi via `_applyTop10DiversityFilter()`
- **Filtre** : Matchs où le meilleur classé (P1 ou P2) est > Top 120 exclus
