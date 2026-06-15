# Sprint : Refonte UI Tennis — Dark Betting Premium v12.81

**Date** : 2026-06-15  
**Version** : v12.81  
**Porteur** : CTO/Lead Data Scientist  
**Type** : Refonte UI/UX — Design System  

---

## 1. Diagnostic — État actuel

### 1.1 Constat

L'onglet Tennis (`#page-tennis`) utilise déjà un système de classes `tn2-*` avec une palette sommaire (#0e131f, #182030). Cependant :
- Les fonds ne sont pas assez profonds (manque le bleu nuit ultra-sombre `#0e1420`)
- Les cartes manquent de relief (pas de dégradé, pas de glassmorphism)
- Les cotes (odds) n'ont pas de style dédié premium avec hover bleu électrique
- Les bordures sont trop visibles (doivent être `1px solid rgba(255,255,255,0.05)`)
- Pas de système de tokens CSS réutilisables

### 1.2 Référence

L'image de référence "image_ad30a6.jpg" (Dark Betting & Crypto-Trading Premium) définit les tokens suivants :

| Token | HEX | Usage |
|-------|-----|-------|
| Main Background | `#0e1420` | Fond d'écran global |
| Card Background | `#172132` | Cartes matchs, KPI, modales |
| Nested Layout | `#111a28` | En-têtes, tableaux, zones imbriquées |
| CTA / Highlights | `#00e676` | Boutons actifs, EV+, value bets |
| Active Tabs / Badges | `#0077ff` | Onglets sélectionnés, hover odds |

---

## 2. Tokens de Design — Application

### 2.1 Mapping classes existantes → nouveaux tokens

| Classe existante | Rôle | Nouveau fond |
|-----------------|------|-------------|
| `#page-tennis`, `.tn2-main` | Conteneur racine | `#0e1420` |
| `.tn2-match-card` | Carte match | `#172132` |
| `.tn2-kpi-item` | Bloc KPI | `#172132` |
| `.tn2-section-header` | En-tête de section | `#111a28` |
| `.tn2-th` | Cellule d'en-tête tableau | `#111a28` |
| `.tn2-tab-btn.active` | Onglet actif | `color: #0077ff` |
| `.tennis-odds-box-premium` | **NOUVEAU** — badge cote | `#111a28`, hover `#0077ff` |

### 2.2 Nouvelles classes premium

Nouvelles classes CSS ajoutées dans pariscore.html :
- `.tennis-odds-box-premium` — badge cote rectangulaire style Betmart
- `.tennis-match-card-premium` — carte match premium alternative
- `.tennis-grid-header` — en-tête de tableau premium
- `.tennis-tab-root-container` — conteneur racine alternatif

---

## 3. Modifications CSS (pariscore.html)

### 3.1 Bloc existant (lignes ~18800-18946)

- `#0e131f` → `#0e1420` (background global)
- `#182030` → `#172132` (cards, KPI)
- Nouveau token `--accent-blue: #0077ff`

### 3.2 Ajouts

- Design tokens en CSS custom properties
- Classes premium pour odds, cartes, headers
- Hover bleu `#0077ff` sur éléments interactifs
- Border-radius normalisé : 4-10px
- Bordures : `1px solid rgba(255,255,255,0.05)`

### 3.3 Hover odds bleu

```css
.tennis-odds-box-premium:hover {
    background: #0077ff !important;
    cursor: pointer;
}
```

---

## 4. Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| pariscore.html | Bloc CSS Tennis — update tokens + nouvelles classes |
| plan.md | Ce document |
| backlog.md | Réécriture avec les tâches UI |
| CLAUDE.md | Ajout roadmap v12.81 |

---

## 5. Risques

| Risque | Mitigation |
|--------|-----------|
| Régressions thème clair | Tester body[data-cf-light="1"] |
| Classes tn2 utilisées en JS dynamique | Vérifier sélecteurs JS |
| Contraste insuffisant | Vérifier WCAG AA 4.5:1 |

---

## 6. Fix Crash Layout — all:initial + margin:0 auto

### 6.1 Problème
`.tn2-main` (ligne 22255) avait `all: initial` qui réinitialisait les custom properties `--tn2-*`, ET `margin: 0 auto` sur un élément CSS Grid qui forçait le shrink-wrap (~800px au lieu de `1fr`).

### 6.2 Correction
- `all: initial` → supprimé (les custom properties redeviennent héritées)
- `max-width: 1440px; margin: 0 auto` → supprimé (la colonne grid gère la largeur)
- `width: 100%; min-width: 0; box-sizing: border-box` → ajouté

### 6.3 Résultat
Le conteneur central remplit pleinement la colonne 2 de la grille, les boutons de navigation reprennent leur espacement normal, le layout redevient fluide.

---

## 7. Pipeline Photos Athlètes — Cartes Live Tennis

### 7.1 Problème
Les cartes Live Tennis affichaient les initiales des joueurs dans des cercles colorés (ex: 'J', 'H') — aspect amateur, pas de reconnaissance visuelle immédiate.

### 7.2 Solution
- Nouvelle fonction `window.getPlayerPhotoUrl(player)` générant l'URL photo depuis l'ID BSD ou le nom
- Les initiales sont remplacées par `<img class="athlete-live-img">` avec `onerror` fallback vers les initiales
- CSS dédié : 32px, border-radius 50%, object-fit cover

### 7.3 Flux
```
BSD/ESPN player.id → getPlayerPhotoUrl() → https://images.pariscore.fr/players/tennis/{id}.png
                                                      ↓ si 404
                                          fallback: initiales colorées
```

### 7.4 Fichier modifié
- `pariscore.html` : JS dans `tn2RenderLiveCards()` + CSS `.athlete-live-img`/`.athlete-live-fallback`

## 8. Fix Décalage Layout Grille Tennis

### 8.1 Problème
Le bloc de cartes live était déporté vers la droite avec un grand espace vide à gauche.

### 8.2 Causes
1. .tn2-main avait padding: 12px 16px qui s'ajoutait au gap: 0 20px de la grille
2. En mobile (ps-mobile-v2), la sidebar était display:none mais la colonne 280px était toujours réservée par grid-template-columns: 280px 1fr
3. .tn2-card-grid n'avait pas width: 100%

### 8.3 Corrections
- .tn2-main : padding: 12px 16px → padding: 12px 0
- .tn2-tab-panel.active : ajout padding: 0 16px
- .tn2-card-grid : ajout width: 100%
- Mobile : grid-template-columns: 1fr quand sidebar cachée

## 9. CRITICAL : Layout Revert + Stabilisation

### 9.1 Contexte
La correction v12.81d a détruit le layout : padding déplacé sur `.tn2-tab-panel.active` a tout compressé.

### 9.2 Actions
- **Revert** : `.tn2-main` padding remis à `12px 16px`
- **Revert** : Règle mobile `grid-template-columns:1fr` supprimée
- **Ajout** : `overflow: hidden` + `max-width: 100%` sur les cartes
- **Todo** : Trouver la vraie cause du décalage droite SANS modifier le padding structurel
