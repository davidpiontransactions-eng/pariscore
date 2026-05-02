---
name: ps-add-strategy
description: Scaffold a new betting strategy for PariScore — adds it to server.js STRATEGIES const, pariscore.html STRATEGIES_UI array, and marks it in CLAUDE.md.
---

# PariScore — Ajouter une Stratégie de Paris

## Déclencheur
Quand l'utilisateur veut ajouter une nouvelle stratégie (ex: "Under 1.5", "CS Home", "Over 3.5", un marché custom).

## Ce que tu dois faire

### 1. Identifier les paramètres
Demande à l'utilisateur (si pas fournis) :
- **Clé** (ex: `UNDER_1_5`) — snake_case majuscule
- **Label** (ex: "Moins de 1.5 buts") — texte affiché
- **Icône** emoji (ex: `🛡️`)
- **Logique** `getProb(m)` : quelle valeur du match `m` utilise-t-on comme % de confiance ?
  - `m.poisson.over15`, `m.poisson.btts`, `m.poisson.homeWin`, etc.
  - Ou une expression calculée ex: `100 - m.poisson.over15`
- **Filtre** (optionnel) : condition `return null` si le match ne correspond pas
- **Cote associée** `getOdds(m)` : `m.odds.home`, `m.odds.away`, `m.odds.draw`, ou `null`

### 2. Modifier server.js
Fichier : `server.js`
Section : const `STRATEGIES = { ... }` (chercher `// ─── /api/v1/top-strategy`)

Ajouter l'entrée en respectant le format exact :
```javascript
CLE_STRATEGIE: {
  label: 'Label affiché',
  icon: '🎯',
  getProb: m => {
    if (!m.poisson) return null;
    // filtre optionnel
    return m.poisson.CHAMP;
  },
  getOdds: m => m.odds?.home || null, // ou () => null si pas de cote directe
},
```

### 3. Modifier pariscore.html
Fichier : `pariscore.html`
Section : `const STRATEGIES_UI = [` (chercher `TOP STRATÉGIES`)

Ajouter à la fin du tableau :
```javascript
{ key: 'CLE_STRATEGIE', label: 'Label', icon: '🎯' },
```

### 4. Vérifier la syntaxe
Toujours exécuter après modification :
```bash
node --check server.js
```
Si erreur → corriger avant de continuer.

### 5. Mettre à jour CLAUDE.md
Dans la section `## 15. TODOLIST` ou `## 16. Tâches Accomplies`, ajouter une ligne :
```
- [x] **Stratégie CLE_STRATEGIE** ✅ FAIT (DATE)
  - Description courte de la logique
```

## Contraintes importantes
- **Zéro dépendance npm** — n'utilise que les champs déjà présents dans l'objet match
- Si la stratégie nécessite des données non disponibles (ex: corners réels), utilise un proxy (xG, over25, etc.) et note la limitation dans CLAUDE.md §14
- Ne pas modifier la fonction `getTopMatchesByStrategy()` — la config centralisée suffit
- La `minConfidence` par défaut est 50% — si ta stratégie produit des confiances basses, signale-le

## Champs disponibles dans un objet match `m`
```
m.poisson.btts       m.poisson.over05    m.poisson.over15
m.poisson.over25     m.poisson.over35    m.poisson.under15
m.poisson.cs00       m.poisson.homeWin   m.poisson.draw
m.poisson.awayWin    m.poisson.topScores
m.expectedGoals.home m.expectedGoals.away
m.odds.home          m.odds.draw         m.odds.away
m.stats.home.ppg     m.stats.home.avgScored   m.stats.home.avgConceded
m.stats.away.ppg     m.stats.away.avgScored   m.stats.away.avgConceded
m.best_edge.edge     m.best_edge.label   m.best_edge.odds
m.home_form          m.away_form         (ex: "WWDLW")
m.commence_time      m.league            m.sport
```
