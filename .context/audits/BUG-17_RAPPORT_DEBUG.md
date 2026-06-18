# BUG-17 : Rapport de Debugging
## Metriques null - Hamad Medjedovic vs Ugo Humbert

**Date** : 2026-06-18
**Auteur** : Engineering Debug
**Severite** : P1 (1 match Top10 sans metriques)
**Statut** : [X] Corrige (commit a venir)

---

## Resume

**Probleme** : 1 match sur 10 dans le Top10 (Hamad Medjedovic vs Ugo Humbert, ATP London, gazon) avait **toutes ses metriques a null** (srv_pts_won_s, age_30, fatigue, etc.).

**Cause racine** : L'API TennisVB/BSD renvoie `m.player1` sous forme de **string** ("Hamad Medjedovic") pour certains matchs, alors que la majorite le recoit sous forme d'**objet** ({name:"...", age:..., country:...}). La ligne d'extraction du nom (`server.js:36898`) supposait **toujours** un objet.

**Correctif** : Detecter le type de `m.player1`/`m.player2` avant d'extraire le nom (typeof === 'object' ? .name : String(player)).

---

## Chronologie de l'investigation

| Etape | Action | Resultat |
|-------|--------|----------|
| 1 | Audit initial du pipeline metriques | 16 bugs corriges dans computeAllMetrics et ses appels |
| 2 | Verification API Top10 | 9/10 matchs OK, 1 avec toutes les metriques null |
| 3 | Test de repetabilite (x2) | Score stable : 9/10 puis 9/10 |
| 4 | Analyse du match defaillant | Hamad Medjedovic vs Ugo Humbert - live, gazon, ATP London |
| 5 | Verification des try-catch (BUG-16) | Toutes les sous-fonctions protegees - le crash ne vient pas de computeAllMetrics |
| 6 | Analyse de l'appelant - IIFE metrics (l.37275) | La IIFE renvoie {...null...} soit via le guard, soit via le catch |
| 7 | **Decouverte** : p1Name extrait a l.36898 | m.player1 = string, m.player1.name = undefined, p1Name = '' |
| 8 | Verification du guard l.36912 | !p1Name = true, enriched.push(...) sans metriques, continue |
| 9 | Analyse des autres matchs | Les 9/10 ont m.player1 en objet, p1Name extrait correctement |
| 10 | **Conclusion** | Format heterogene dans l'API BSD : parfois objet, parfois string |

---

## Analyse technique detaillee

### Le flux de donnees (avant correction)

1. API BSD envoie `m.player1 = "Hamad Medjedovic"` (string)
2. Ligne 36898 : `let p1Name = (m.player1 && (m.player1.name || m.player1.full_name)) || ...`
   - `m.player1 &&` -> "Hamad Medjedovic" (truthy)
   - `(m.player1.name || ...)` -> undefined || undefined = undefined
   - truthy && undefined = undefined
   - undefined || '' = ''
3. Ligne 36912 : `if (!p1Name || !p2Name)` -> TRUE
4. `enriched.push({...sans metriques...}); continue;`
5. API Top10 -> "metrics": {srv_pts_won_s: null, ...}

### Pourquoi ce match specifiquement ?

Le format string pour `m.player1` est lie a la source de donnees :
- **Matchs sur dur** (9/10) : proviennent d'une source fournissant des objets structurés
- **Match sur gazon** (1/10) : provient d'une source BSD qui renvoie juste le nom du joueur

### Pourquoi les autres matchs n'etaient pas impactes

Les 9 autres matchs recoivent `m.player1` sous forme d'objet :
`m.player1 = { name: "Sadira Ouyang", age: 25, country: "USA" }`
-> `m.player1.name = "Sadira Ouyang"` -> `p1Name` extrait correctement.

---

## Correctif applique

**Fichier** : `server.js` lignes 36898-36899

**Avant** :
```javascript
let p1Name = (m.player1 && (m.player1.name || m.player1.full_name)) || m.player1_name || '';
let p2Name = (m.player2 && (m.player2.name || m.player2.full_name)) || m.player2_name || '';
```

**Apres** :
```javascript
let p1Name = (m.player1 && (typeof m.player1 === 'object'
  ? (m.player1.name || m.player1.full_name)
  : String(m.player1).trim())) || m.player1_name || '';
let p2Name = (m.player2 && (typeof m.player2 === 'object'
  ? (m.player2.name || m.player2.full_name)
  : String(m.player2).trim())) || m.player2_name || '';
```

**Logique** :
- Si `m.player1` est un **objet** -> lit `.name` ou `.full_name` (comportement existant)
- Si `m.player1` est une **string** -> la convertit en string et la trim (nouveau)
- Fallback vers `m.player1_name` ou '' inchange

---

## Fichiers impactes

| Fichier | Changement | Lignes |
|---------|-----------|--------|
| `server.js` | Normalisation type m.player1/m.player2 | 36898-36899 |
| `server.js` | Commentaire BUG-17 | 36897 |

---

## Risques regressifs

| Risque | Probabilite | Mitigation |
|--------|-------------|------------|
| m.player1 est null ou undefined | Faible | Le && short-circuit deja : null && ... = null -> p1Name = '' |
| m.player1 est un Array | Tres faible | typeof [] === 'object' -> branche objet -> .name = undefined -> '' |
| String vide "" | Faible | String("").trim() = "" -> "" || '' = '' -> guard !p1Name fonctionne |

---

## Lecons apprises

1. **Validation de type** : Ne jamais supposer qu'un champ API a un type uniforme - toujours normaliser
2. **Tests de bout en bout** : Un match sur gazon aurait du etre dans le jeu de test
3. **Guard defensif** : Le guard !p1Name a bien protege contre le crash, mais a masque la cause racine
