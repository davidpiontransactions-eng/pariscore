# RAPPORT D'INNOVATION : Tennis Table V3.1 — Production Ready
## Corrections Red Team + Architecture Decision Records

> **Date :** 25 mai 2026  
> **Supersède :** V3.0 (RAPPORT_DESIGN_TENNIS_V3.md)  
> **Statut :** Architecture validée — en attente **GO FINAL ABSOLU** production

---

## CORRECTIONS RED TEAM — Récapitulatif des failles V3.0

| # | Faille | Critique | Fix V3.1 |
|---|--------|----------|----------|
| RT-01 | Momentum DR caché dans le drawer pour matchs LIVE | ⛔ Hérésie trader | Colonne SIGNAL devient context-aware SIGNAL/MOMENTUM |
| RT-02 | ELO minibar depuis 0 → écart 248 pts invisible visuellement | ⚠️ Biais dataviz | Normalisation contextuelle dynamique |
| RT-03 | Form sparkline : victoire #300 = victoire Top10 visuellement | ⚠️ Biais données | Dots pondérés taille + opacité selon rang adverse |
| RT-04 | `<table>` tordu en CSS Grid = anti-pattern accessibilité mobile | ⛔ Régression A11Y | ADR-001 : migration `<div role="table">` + CSS Grid natif |
| RT-05 | Zone sticky 386px = effet meurtrière sur 1024px | ⚠️ UX desktop petit écran | Fusion col 2+3 → sticky 252px (-134px) |

---

## ADR-001 : Structure HTML — `<table>` natif vs `<div role="table">` + CSS Grid

**Date :** 2026-05-25  
**Status :** proposed  
**Décideurs :** Lead Frontend Dev, Lead UI/UX

### Contexte

`#tennis-vb-table` est un `<table>` HTML natif avec `table-layout:fixed`. En V3.0, le plan pour transformer ce tableau en "Match Card" sur mobile utilisait `display:block` sur `<table>` + `display:grid` sur `<tr>`.

**Pourquoi ce plan V3.0 est défaillant :**

1. **Accessibilité cassée** : `display:block` sur `<table>` retire le rôle ARIA `table` implicite. Les screen readers (NVDA, VoiceOver) perdent la relation colonnes/données — ils lisent les cellules comme des `<div>` sans contexte.

2. **`position:sticky` invalide** : Le sticky sur les colonnes fonctionne dans un `table formatting context`. Si `<table>` passe en `display:block`, tout le contexte de formatage est détruit — les colonnes ne sont plus sticky.

3. **Comportement navigateur imprévisible** : Safari iOS en particulier a un comportement non-spécifié pour `<table>` avec `display:block`. Régression connue sur iOS 15-17.

4. **Cascade forcée** : Pour que les `<td>` deviennent des grid items, il faut aussi `display:block` sur `<tbody>`, `<tr>` — cascade de `display:block` sur 4 niveaux de DOM = imprévisible.

### Décision

**Phase A (Sprint 1 — immédiat) :** Conserver `<table>` mais corriger les bugs CSS critiques (z-index, overflow, popup absolue). Ajouter les attributs ARIA manquants sur la table existante.

**Phase B (Sprint 3 — +2 semaines) :** Remplacer `<table>` par `<div role="table">` + CSS Grid pour les deux tableaux tennis (`#tennis-vb-table`, `#tennis-live-table`). Les renderers JS (`renderTennisVB`, `renderTennisLive`) émettent du HTML `<div>` au lieu de `<tr>/<td>`.

### Alternatives considérées

**Alternative A : `<table>` + `display:block` sur mobile (V3.0)**
- **Pros :** Zéro refactor JS
- **Cons :** Accessibilité cassée, sticky mort, Safari iOS régression
- **Pourquoi rejeté :** Non-conforme WCAG 2.1 AA (criterion 1.3.1 Info and Relationships)

**Alternative B : Deux implémentations distinctes (table desktop, cards mobile)**
- **Pros :** Chaque version optimale pour son contexte
- **Cons :** Double surface de maintenance JS, synchronisation état complexe
- **Pourquoi rejeté :** Overhead maintenance trop élevé pour une équipe 1 dev

**Alternative C : `<div role="table">` + CSS Grid (retenu)**
- **Pros :** Un seul DOM, ARIA explicite, Grid natif sur toutes plateformes, sticky fonctionne
- **Cons :** Refactor JS `renderTennisVB` (~200 lignes), perte du comportement table natif
- **Pourquoi retenu :** Migration propre, testable, durable

### Conséquences

**Positives :**
- Screen readers lisent correctement grâce aux rôles ARIA explicites
- `position:sticky` fonctionne nativement sur les éléments grid
- CSS `grid-template-areas` = mobile card layout en 5 lignes de CSS
- Plus de contradiction `table-layout:fixed` / `width:1%`

**Négatives :**
- Refactor JS : ~200 lignes dans `renderTennisVB()` + `renderTennisLive()` (estimé 4h)
- Tests de régression A11Y (VoiceOver + NVDA) obligatoires avant ship

**Risques :**
- Risque : oubli d'un attribut ARIA → cellule sans contexte pour screen reader  
- Mitigation : checklist ARIA en section 5 du présent rapport

---

## CORRECTION RT-01 : Momentum DR en T0 pour matchs LIVE

### Principe

La colonne 4 est **context-aware** : son contenu change selon `match.status`.

| Status | Contenu colonne 4 | Données affichées |
|--------|-------------------|-------------------|
| `scheduled` / `upcoming` | SIGNAL chip pré-match | BET FORT/VALUE/PASS + EV% + confiance |
| `live` / `in_progress` | MOMENTUM live | DR trend arrow + odds drift + pressure badge |
| `finished` | Résultat post-match | Issue réelle + badge résultat prédiction |

### Spécification SIGNAL (pré-match)

```
┌─────────────────────┐
│  [● BET FORT]       │  ← chip vert, 12px 700
│  +11.2% EV          │  ← DM Mono 13px, vert
│  ●●●●○  conf 4/5   │  ← 5 dots confiance (voir RT-03)
└─────────────────────┘
```

### Spécification MOMENTUM (LIVE — critique RT-01)

Le Momentum DR (`DR P1~` / `DR P2~`) est la **dérive de la cote en temps réel**. Pour un trader en live, c'est la donnée la plus alpha. En V3.0, il était enfoui dans le drawer — **erreur critique**.

```
┌─────────────────────┐
│  [⚡ LIVE HOT]       │  ← chip rouge pulsant si intensity > 70
│  ↑ DR +0.33         │  ← flèche + delta DR J1 (favori J1 durcit)
│  SERRÉ 61/100       │  ← badge pressure + score intensité
└─────────────────────┘
```

**Logique d'affichage du DR :**

```
Si dr_delta_j1 > 0 → "↑ DR " + dr_j1  (cote J1 durcit → momentum J1)
Si dr_delta_j1 < 0 → "↓ DR " + dr_j1  (cote J1 dérive → momentum J2)
Si dr_delta_j1 == 0 → "→ DR " + dr_j1  (stabilité)

Couleur flèche :
  ↑ (favorable parieur) → #00e676 vert
  ↓ (défavorable)       → #ff4d4d rouge
  → (stable)            → #94a3b8 gris
```

**Badge SERRÉ / DOMINÉ / OUVERT :**

| Score intensité `live_intensity` | Badge | Couleur |
|----------------------------------|-------|---------|
| > 75 | SERRÉ | rouge `#ff4d4d` pulsant |
| 50-75 | CONTRÔLÉ | amber `#ffa726` |
| < 50 | OUVERT | gris `--text3` |

**Ce qui reste dans le drawer (T1) pour les matchs LIVE :**

Les cotes complètes DR J1/set, DR J2/set, le tableau détaillé par set. Le T0 montre uniquement : direction DR + intensité.

---

## CORRECTION RT-02 : ELO Minibar — Normalisation Contextuelle

### Problème V3.0 : Biais de l'échelle absolue

```
Exemple : J1=1902, J2=2150. Échelle 0-3000 (max ATP).
J1 barre : 1902/3000 = 63.4% de largeur
J2 barre : 2150/3000 = 71.7% de largeur
Écart visuel : 8.3% → sur une barre 100px = seulement 8px de différence !
```

Ce delta de 248 points ELO représente pourtant **~80% de chances de victoire** pour J2. La barre de V3.0 le rendait quasi-invisible.

### Fix V3.1 : Scale contextuelle match-relative

**Algorithme de normalisation :**

```javascript
function computeEloBarWidths(elo1, elo2) {
  const BUFFER = 100; // marge visuelle des deux côtés
  const floor  = Math.min(elo1, elo2) - BUFFER;
  const ceil   = Math.max(elo1, elo2) + BUFFER;
  const range  = ceil - floor;
  return {
    pct1:  Math.round((elo1 - floor) / range * 100), // → 22%
    pct2:  Math.round((elo2 - floor) / range * 100), // → 78%
    delta: elo2 - elo1,                               // → 248
    adv:   elo1 >= elo2 ? 'j1' : 'j2',
    warn:  Math.abs(elo2 - elo1) > 200               // seuil signif.
  };
}
// Pour 1902 vs 2150 :
// floor = 1802, ceil = 2250, range = 448
// pct1 = (1902-1802)/448 = 22% ← très visible maintenant
// pct2 = (2150-1802)/448 = 78% ← écart de 56px sur 100px barre ✓
```

**Résultat visuel V3.1 :**

```
J1  ██████░░░░░░░░░░░░░░░  1902
J2  ██████████████████░░░  2150
    ←22%→              ←78%→
    ⚠ Δ248 pts — avantage J2 significatif
```

**Badge de seuil (⚠) :**

| Delta ELO | Badge | Couleur |
|-----------|-------|---------|
| > 300 | ÉCART MAJEUR | rouge `#ff4d4d` |
| 150-300 | AVANTAGE | amber `#ffa726` |
| 75-150 | LÉGER | gris `#94a3b8` |
| < 75 | ÉQUILIBRÉ | vert `#00e676` |

**CSS du composant ELO V3.1 :**

```css
.tvb-elo-wrap {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.tvb-elo-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 600 11px 'DM Mono', monospace;
  color: var(--text2);
}
.tvb-elo-bar-track {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--bg4);
  overflow: hidden;
  position: relative;
}
.tvb-elo-bar-fill {
  height: 100%;
  border-radius: 3px;
  /* width définie inline via JS : style="width:22%" */
  transition: width 0.4s ease;
}
.tvb-elo-bar-fill--j1 { background: #38bdf8; }
.tvb-elo-bar-fill--j2 { background: #a78bfa; }
.tvb-elo-val {
  min-width: 36px;
  text-align: right;
  font-size: 11px;
  color: var(--text2);
}
.tvb-elo-delta {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  letter-spacing: .2px;
}
.tvb-elo-delta--major { background: rgba(255,77,77,.16); color: #ff4d4d; }
.tvb-elo-delta--adv   { background: rgba(255,167,38,.14); color: #ffa726; }
.tvb-elo-delta--light { background: rgba(148,163,184,.12); color: #94a3b8; }
.tvb-elo-delta--even  { background: rgba(0,230,118,.14); color: #00e676; }
```

---

## CORRECTION RT-03 : Form Sparkline — Pondération par Qualité Adverse

### Problème V3.0 : Tous les dots identiques

```
● ● ○ ● ●  ← 5 dots de 7px uniformes
```
Un parieur lit "4W 1L" mais ne sait pas si les victoires valent quelque chose.  
Une victoire sur Djokovic en finale Roland Garros = même dot qu'une victoire sur un joueur non classé.

### Fix V3.1 : Weighted Quality Dots

**Système de pondération Q1→Q5 basé sur le rang de l'adversaire :**

| Rang adversaire | Qualité | Taille dot | Opacité | Signal |
|----------------|---------|-----------|---------|--------|
| Top 10 (1-10) | Q1 | 11px | 100% | ★ victoire majeure |
| Top 30 (11-30) | Q2 | 9px | 90% | victoire solide |
| Top 100 (31-100) | Q3 | 7px | 78% | victoire standard |
| Top 250 (101-250) | Q4 | 5px | 62% | victoire modeste |
| Au-delà / inconnu | Q5 | 4px | 45% | victoire faible |
| **Défaite** (tous rangs) | — | 5px | 50% | uniforme, jamais proéminent |

**Justification dataviz (Cleveland-McGill) :** On encode la qualité via **taille** (variable d'intensité) et **opacité** (variable d'atténuation). La couleur encode uniquement W/L (vert/rouge). Double encoding = redondant = robuste pour daltoniens.

**CSS des dots pondérés :**

```css
/* Base commune */
.tvb-fdot {
  display: inline-block;
  border-radius: 50%;
  vertical-align: middle;
  flex-shrink: 0;
  transition: transform .1s;
}
/* Victoires Q1-Q5 */
.tvb-fdot--w-q1 { width:11px; height:11px; background:#00e676; opacity:1.0; }
.tvb-fdot--w-q2 { width:9px;  height:9px;  background:#00e676; opacity:0.9; }
.tvb-fdot--w-q3 { width:7px;  height:7px;  background:#00e676; opacity:0.78; }
.tvb-fdot--w-q4 { width:5px;  height:5px;  background:#4ade80; opacity:0.62; }
.tvb-fdot--w-q5 { width:4px;  height:4px;  background:#86efac; opacity:0.45; }
/* Défaites — uniformes, toujours discrètes */
.tvb-fdot--l    { width:5px;  height:5px;  background:rgba(255,77,77,.55); opacity:0.5; }
/* Inconnu */
.tvb-fdot--u    { width:4px;  height:4px;  background:var(--bg4); border:1px solid var(--border); opacity:0.6; }
```

**Container dots (alignement vertical centré) :**

```css
.tvb-form-dots {
  display: inline-flex;
  align-items: center;   /* centre verticalement les tailles mixtes */
  gap: 3px;
  min-height: 13px;      /* hauteur min = plus grand dot (Q1 = 11px) + 2px */
}
```

**Tooltip sur hover (natif `title` attr) :**
```html
<span class="tvb-fdot tvb-fdot--w-q1" 
      title="Victoire vs Djokovic #3 (Roland Garros QF)"></span>
```

---

## CORRECTION RT-04 + RT-05 : Nouvelle Structure HTML/CSS

### Structure `<div role="table">` — Base V3.1

L'unité de rendu passe de `<tr>/<td>` à `<div role="row">/<span role="cell">`.

**HTML de référence (structure one match) :**

```html
<div class="tn-vb-grid" role="table" aria-label="Tennis Value Bets — matchs à venir">
  
  <!-- THEAD -->
  <div class="tn-vb-thead" role="rowgroup">
    <div class="tn-vb-header-row" role="row">
      <span class="tn-vb-hcell" role="columnheader" aria-sort="none" data-col="fav">★</span>
      <span class="tn-vb-hcell" role="columnheader" data-col="match">Match</span>
      <span class="tn-vb-hcell" role="columnheader" data-col="signal">Signal</span>
      <span class="tn-vb-hcell" role="columnheader" data-col="score">Score</span>
      <span class="tn-vb-hcell" role="columnheader" data-col="elo">ELO Δ</span>
      <span class="tn-vb-hcell" role="columnheader" data-col="proba">Proba</span>
      <span class="tn-vb-hcell" role="columnheader" data-col="value">Value</span>
      <span class="tn-vb-hcell" role="columnheader" data-col="expand" aria-label="Détails">▸</span>
    </div>
  </div>

  <!-- TBODY -->
  <div class="tn-vb-tbody" role="rowgroup">

    <!-- Match row (répété via JS) -->
    <div class="tn-vb-row" role="row" data-match-id="X" data-status="live" aria-expanded="false">
      
      <span class="tn-vb-cell tn-cell-fav" role="cell" data-col="fav">
        <button class="tn-fav-btn" aria-label="Épingler Samsonova vs Teichmann" aria-pressed="false">★</button>
      </span>

      <span class="tn-vb-cell tn-cell-match" role="cell" data-col="match">
        <!-- Col identité — sticky. Contient : tournoi + surface + heure + J1/J2 + rangs -->
        <div class="tn-match-meta">
          <span class="tn-tournament">Roland Garros</span>
          <span class="tvb-surf-badge tvb-surf-clay">● TERRE BATT</span>
          <span class="tn-time">14:30</span>
        </div>
        <div class="tn-match-players">
          <div class="tn-player tn-player--j1">
            <span class="tn-srv-ball" aria-label="Au service">🎾</span>
            <span class="tn-pname tn-pfav">Samsonova</span>
            <span class="tn-rank">#39</span>
          </div>
          <div class="tn-player tn-player--j2">
            <span class="tn-srv-placeholder" aria-hidden="true"></span>
            <span class="tn-pname">Teichmann</span>
            <span class="tn-rank">#66</span>
          </div>
        </div>
      </span>

      <span class="tn-vb-cell tn-cell-signal" role="cell" data-col="signal" data-match-status="live">
        <!-- Context-aware : JS toggle data-match-status pour swapper le contenu -->
        <!-- PRE-MATCH version -->
        <div class="tn-signal-pre" hidden>
          <span class="tvb-signal-chip tvb-signal-chip--bet">● BET FORT</span>
          <div class="tn-ev">+11.2% EV</div>
          <div class="tvb-form-dots" aria-label="Confiance 4/5">
            <!-- 5 dots confiance -->
          </div>
        </div>
        <!-- LIVE version -->
        <div class="tn-signal-live">
          <span class="tvb-signal-chip tvb-signal-chip--live">⚡ LIVE HOT</span>
          <div class="tn-dr-trend">↑ DR <span class="tn-dr-val">+0.33</span></div>
          <div class="tn-pressure-badge tn-pressure--serre">SERRÉ 61</div>
        </div>
      </span>

      <span class="tn-vb-cell tn-cell-score" role="cell" data-col="score">
        <!-- .tn-sb widget existant conservé -->
        <div class="tn-sb">...</div>
      </span>

      <span class="tn-vb-cell tn-cell-elo" role="cell" data-col="elo">
        <!-- ELO dual minibar V3.1 normalisé -->
        <div class="tvb-elo-wrap">
          <div class="tvb-elo-row">
            <div class="tvb-elo-bar-track">
              <div class="tvb-elo-bar-fill tvb-elo-bar-fill--j1" style="width:22%"></div>
            </div>
            <span class="tvb-elo-val">1902</span>
          </div>
          <div class="tvb-elo-row">
            <div class="tvb-elo-bar-track">
              <div class="tvb-elo-bar-fill tvb-elo-bar-fill--j2" style="width:78%"></div>
            </div>
            <span class="tvb-elo-val">2150</span>
          </div>
          <span class="tvb-elo-delta tvb-elo-delta--adv">Δ248 ↗J2</span>
        </div>
      </span>

      <span class="tn-vb-cell tn-cell-proba" role="cell" data-col="proba">
        <div class="tn-proba-num" style="color:#ffa726">68%</div>
        <div class="tn-proba-bar-track">
          <div class="tn-proba-bar-fill" style="width:68%;background:#ffa726"></div>
        </div>
      </span>

      <span class="tn-vb-cell tn-cell-value" role="cell" data-col="value">
        <div class="tn-odds-val">3.20</div>
        <div class="tn-edge-badge tn-edge-pos">▲ +8.3%</div>
      </span>

      <span class="tn-vb-cell tn-cell-expand" role="cell" data-col="expand">
        <button class="tn-expand-btn" 
                aria-label="Voir les détails de Samsonova vs Teichmann"
                aria-expanded="false"
                aria-controls="drawer-X">▸</button>
      </span>
    </div><!-- /.tn-vb-row -->

    <!-- DRAWER ROW (collapsed by default) -->
    <div class="tn-vb-drawer" id="drawer-X" role="row" hidden aria-label="Détails Samsonova vs Teichmann">
      <span role="cell" class="tn-drawer-cell" colspan-visual="8">
        <div class="tn-drawer-grid">
          <!-- Section Bets DR (ancienne popup absolue) -->
          <div class="tn-drawer-section tn-drawer-section--bets">
            <h4 class="tn-drawer-label">Paris conseillés</h4>
            <!-- DR P1~ / DR P2~ / J1/set / J2/set ici -->
          </div>
          <!-- Section Sets -->
          <div class="tn-drawer-section tn-drawer-section--sets">
            <h4 class="tn-drawer-label">Issues Sets</h4>
          </div>
          <!-- Section Forme pondérée (L5 weighted dots) -->
          <div class="tn-drawer-section tn-drawer-section--form">
            <h4 class="tn-drawer-label">Forme L5</h4>
            <div class="tn-form-row">
              <span class="tn-pname-short">Samsonova</span>
              <div class="tvb-form-dots">
                <span class="tvb-fdot tvb-fdot--w-q2" title="W vs Gauff #3 (Q3)"></span>
                <span class="tvb-fdot tvb-fdot--w-q1" title="W vs Swiatek #1 (SF)"></span>
                <span class="tvb-fdot tvb-fdot--l"    title="L vs Paolini #8 (F)"></span>
                <span class="tvb-fdot tvb-fdot--w-q3" title="W vs Vondrousova #52 (R16)"></span>
                <span class="tvb-fdot tvb-fdot--w-q4" title="W vs Andreeva #145 (R32)"></span>
              </div>
            </div>
          </div>
          <!-- Section Marchés alternatifs -->
          <div class="tn-drawer-section tn-drawer-section--markets">
            <h4 class="tn-drawer-label">Marchés alternatifs</h4>
          </div>
        </div>
      </span>
    </div><!-- /.tn-vb-drawer -->

  </div><!-- /.tn-vb-tbody -->
</div><!-- /.tn-vb-grid -->
```

---

### CSS Grid V3.1 — Correction RT-05 (sticky zone 252px)

**Compressed sticky : ★(32) + Match(220) = 252px (vs 386px en V3.0)**

```css
/* ============================================================
   FONDATION CSS V3.1 — Tennis Value Bets Grid
   Remplace toutes les règles #tennis-vb-table en Phase B
   ============================================================ */

/* Z-index layers (RÉUTILISER les variables V3 déjà définies) */
/* :root { --z-sticky:20; --z-tooltip:100; --z-modal:1000; etc. } */

/* --- Container principal --- */
.tn-vb-grid {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;           /* ✓ ne casse pas le sticky */
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

/* --- Header row --- */
.tn-vb-header-row,
.tn-vb-row {
  display: grid;
  grid-template-columns:
    32px      /* ★ fav */
    220px     /* match + identité fusionnée — STICKY */
    155px     /* signal/momentum */
    145px     /* score */
    130px     /* elo Δ */
    95px      /* proba */
    105px     /* value */
    32px;     /* expand ▸ */
  /* Total : 914px — sticky zone : 252px */
  min-width: 914px;
  align-items: center;
}

/* --- Sticky columns V3.1 (2 cols seulement vs 3 en V3) --- */
/* Col 1 : ★ */
.tn-vb-header-row > span:nth-child(1),
.tn-vb-row > span:nth-child(1) {
  position: sticky;
  left: 0;
  z-index: var(--z-sticky);
  background: var(--bg3);
}
/* Col 2 : Match (fusionnée Date+Surface+Joueurs) */
.tn-vb-header-row > span:nth-child(2),
.tn-vb-row > span:nth-child(2) {
  position: sticky;
  left: 32px;                    /* = largeur col 1 */
  z-index: var(--z-sticky);
  background: var(--bg3);
}
/* Header sticky z-index légèrement supérieur aux TD */
.tn-vb-header-row > span {
  z-index: calc(var(--z-sticky) + 1);
}
/* Séparateur visuel après sticky zone */
.tn-vb-row > span:nth-child(2)::after {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 1px;
  background: var(--border);
  pointer-events: none;
}

/* --- Cellules header --- */
.tn-vb-hcell {
  padding: 8px 10px;
  font: 600 10px/1.2 'DM Mono', monospace;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: var(--bg3);
  border-bottom: 1px solid var(--border);
  user-select: none;
}

/* --- Cellules données --- */
.tn-vb-cell {
  padding: 10px 10px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
  color: var(--text);
  overflow: hidden;              /* ✓ jamais de débordement */
  min-width: 0;                  /* ✓ évite le débordement hors de grid */
}

/* --- Identité match fusionnée (col 2) --- */
.tn-match-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 5px;
}
.tn-tournament {
  font: 500 10px 'DM Mono', monospace;
  color: var(--text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}
.tn-time {
  font: 600 11px 'DM Mono', monospace;
  color: var(--text2);
  white-space: nowrap;
}
.tn-match-players {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tn-player {
  display: flex;
  align-items: center;
  gap: 5px;
}
.tn-pname {
  font: 600 12.5px 'Instrument Sans', sans-serif;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
.tn-pfav { color: var(--green); }
.tn-rank {
  font: 500 10px 'DM Mono', monospace;
  color: var(--text3);
  background: var(--bg4);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* --- Drawer row --- */
.tn-vb-drawer {
  border-top: 1px solid rgba(56,189,248,.15);
  background: var(--bg2);
}
.tn-vb-drawer[hidden] { display: none; }
.tn-drawer-cell {
  padding: 14px 16px;
  grid-column: 1 / -1;           /* span toute la grille */
}
.tn-drawer-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.tn-drawer-label {
  font: 700 10px/1 'DM Mono', monospace;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin: 0 0 8px;
}

/* --- Signal/Momentum column (col 4) --- */
.tn-cell-signal { display: flex; flex-direction: column; gap: 4px; }
.tn-dr-trend {
  font: 700 12px 'DM Mono', monospace;
  color: var(--text2);
}
.tn-dr-trend .tn-dr-val.up   { color: #00e676; }
.tn-dr-trend .tn-dr-val.down { color: #ff4d4d; }
.tn-pressure-badge {
  font: 700 10px 'DM Mono', monospace;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
  align-self: flex-start;
}
.tn-pressure--serre    { background:rgba(239,68,68,.16); color:#ff4d4d; }
.tn-pressure--controle { background:rgba(255,167,38,.14); color:#ffa726; }
.tn-pressure--ouvert   { background:rgba(148,163,184,.1); color:#94a3b8; }

/* --- Win Proba column (col 6) --- */
.tn-proba-num {
  font: 700 18px/1 'DM Mono', monospace;
  margin-bottom: 4px;
}
.tn-proba-bar-track {
  height: 3px;
  background: var(--bg4);
  border-radius: 2px;
  overflow: hidden;
  width: 100%;
}
.tn-proba-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width .3s ease;
}

/* ============================================================
   MOBILE — Match Card Layout (≤768px)
   ============================================================ */
@media (max-width: 768px) {

  .tn-vb-grid {
    overflow-x: visible;         /* ✓ pas de scroll horizontal sur mobile */
  }

  /* Cacher le thead sur mobile */
  .tn-vb-thead { display: none; }

  .tn-vb-tbody {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px;
  }

  /* Chaque row devient une card CSS Grid */
  .tn-vb-row {
    display: grid !important;    /* override le grid desktop */
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "fav  meta    meta"
      "fav  players prob"
      "sig  sig     val";
    grid-template-rows: auto 1fr auto;
    min-width: unset;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    gap: 4px 10px;
    cursor: pointer;
    transition: background .15s;
  }
  .tn-vb-row:hover { background: var(--bg3); }

  /* Mapping colonnes → grid-areas */
  .tn-cell-fav    { grid-area: fav; display: flex; align-items: center; }
  .tn-cell-match  { grid-area: players; min-width: 0; }
  .tn-cell-signal { grid-area: sig; }
  .tn-cell-score  { display: none; }  /* dans le drawer mobile */
  .tn-cell-elo    { display: none; }
  .tn-cell-proba  { grid-area: prob; text-align: right; }
  .tn-cell-value  { grid-area: val; text-align: right; justify-self: end; }
  .tn-cell-expand { display: none; } /* toute la card est tappable */

  /* Meta (tournoi + surface + heure) en header de card */
  .tn-match-meta {
    grid-area: meta;
    margin-bottom: 0;
    font-size: 10px;
  }

  /* Touch targets 44px (WCAG 2.5.5) */
  .tn-fav-btn {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Drawer mobile */
  .tn-vb-drawer {
    border-radius: 0 0 10px 10px;
    margin-top: -8px;
  }
  .tn-drawer-grid {
    grid-template-columns: 1fr 1fr;  /* 2 cols sur mobile vs 4 desktop */
  }
}
```

---

## Checklist ARIA — Prévention régression accessibilité

> À valider avant ship Phase B (migration `<div role="table">`)

| Élément | Attribut requis | Valeur attendue |
|---------|----------------|-----------------|
| Container principal | `role="table"` | — |
| Container `role="table"` | `aria-label` | "Tennis Value Bets — matchs à venir" |
| Zone thead | `role="rowgroup"` | — |
| Zone tbody | `role="rowgroup"` | — |
| Ligne header | `role="row"` | — |
| Cellule header | `role="columnheader"` | — |
| Colonnes triables | `aria-sort` | `"none"` / `"ascending"` / `"descending"` |
| Ligne données | `role="row"` | — |
| Cellule données | `role="cell"` | — |
| Bouton favori | `aria-label` | "Épingler [J1] vs [J2]" |
| Bouton favori | `aria-pressed` | `"true"` / `"false"` |
| Bouton expand | `aria-expanded` | `"true"` / `"false"` |
| Bouton expand | `aria-controls` | `"drawer-[matchId]"` |
| Drawer row | `id` | `"drawer-[matchId]"` |
| Drawer row | `hidden` | présent si collapsed |
| Balle de service | `aria-label` | "Au service" |
| ELO bars | `role="img"` + `aria-label` | "ELO Samsonova 1902 vs Teichmann 2150, avantage J2 Δ248" |
| Form dots | parent `aria-label` | "Forme sur 5 matchs : 4 victoires, 1 défaite" |

---

## ANATOMIE FINALE V3.1

### Desktop 8 colonnes (914px, sticky zone 252px)

```
┌──┬──────────────────────┬─────────────────────┬─────────────┬────────────────────┬──────┬─────────┬──┐
│★ │  Match + Identité    │  SIGNAL/MOMENTUM    │   Score     │   ELO Δ + Proba    │Proba │  Value  │▸ │
│  │  (sticky)            │                     │             │                    │      │         │  │
│32│        220px         │       155px         │   145px     │       130px        │ 95px │  105px  │32│
│  │  STICKY @ 32px       │                     │             │                    │      │         │  │
└──┴──────────────────────┴─────────────────────┴─────────────┴────────────────────┴──────┴─────────┴──┘
 Sticky zone totale : 252px (–134px vs V3.0)
```

**État pre-match :**
```
★  │ Roland Garros          │ [● BET FORT]      │ 6 6 ·15· │ J1 ██░░░░ 1902    │ 68% │ 3.20  │ ▸ │
   │ ● TERRE BATT · 14:30   │ +11.2% EV         │ 4 3      │ J2 ████████ 2150   │ ███ │ ▲8.3% │   │
   │ ● Samsonova  #39       │ ●●●●○ conf 4/5    │          │ Δ248 ↗J2 ⚠AVANTAGE │     │       │   │
   │   Teichmann  #66       │                   │          │                    │     │       │   │
```

**État LIVE (RT-01) :**
```
★  │ Roland Garros          │ [⚡ LIVE HOT]      │ 6 6 ·15· │ J1 ██░░░░ 1902    │ 68% │ 3.20  │ ▸ │
   │ ● TERRE BATT · LIVE    │ ↑ DR +0.33        │ 4 3      │ J2 ████████ 2150   │ ███ │ ▲8.3% │   │
   │ ● Samsonova  #39       │ SERRÉ 61/100      │          │ Δ248 ↗J2           │     │       │   │
   │   Teichmann  #66       │                   │          │                    │     │       │   │
```

### Mobile Card (≤768px)

```
┌─────────────────────────────────────────────────────┐
│  Roland Garros · ● TERRE BATT · 14:30    WTA  R32   │
├─────────────────────────────────────────────────────┤
│ ★ │ ● Samsonova    #39                     68%      │
│   │   Teichmann    #66                    ████████░  │
├─────────────────────────────────────────────────────┤
│  [● BET FORT +11.2%]                 Cote 3.20 ▲    │
│  (tap card to expand drawer)         +8.3% edge     │
└─────────────────────────────────────────────────────┘

[Expanded Drawer]
┌─────────────────────────────────────────────────────┐
│  Score :  6 6 ·15·  /  4 3               J2 au svc  │
├───────────────────────┬─────────────────────────────┤
│  Paris conseillés     │  ELO                        │
│  DR J1  0.33▼ Δ0.00  │  Samsonova ██░░ 1902        │
│  DR J2  3.00▲ Δ0.00  │  Teichmann ████████ 2150    │
│  J1/set S1  0.33~     │  Δ248 ↗J2 ⚠AVANTAGE        │
├───────────────────────┼─────────────────────────────┤
│  Sets                 │  Forme L5                   │
│  2-0  42%  ████       │  Samsonova ⬤⬤○⬤⬤ (+Q1,Q3) │
│  2-1  28%  ██         │  Teichmann ○⬤⬤○⬤  (+Q2)   │
├───────────────────────┴─────────────────────────────┤
│  King Aces: J1 58%  Jeux O8.5: 67%  Mental J1: 72% │
│  [🔔 Alerte IA]                 [📊 Analyse Profonde]│
└─────────────────────────────────────────────────────┘
```

---

## PLAN DE MIGRATION — 4 Sprints

### Sprint 1 — Corrections CSS critiques sur `<table>` existant (Phase A)
> *Pas de refactor JS. Correctifs chirurgicaux. Ship rapide.*

1. **Supprimer la popup absolue** : identifier + retirer `position:absolute` de la popup DR P1~/P2~. Injecter à la place un `<tr class="tvb-drawer-row" hidden>` colspan.
2. **Corriger `td.tvb-score-col`** : retirer `width:1%; white-space:nowrap`. Laisser colgroup gérer.
3. **Implémenter variables `--z-*`** dans `:root`. Remplacer toutes les valeurs hardcodées.
4. **Corriger overflow wrapper** : `overflow-x:auto; overflow-y:visible`. Retirer `!important`.
5. **Sticky z-index** : passer de `z-index:6` à `var(--z-sticky)` (=20) + `thead th` à 21.
6. **Ajouter attributs ARIA** sur `<table>`, `<thead>`, `<tbody>`, `<th>` existants.

### Sprint 2 — Micro-visualisations (sur `<table>` Phase A)
7. ELO bars normalisées (algorithme RT-02) dans colonne Elo existante.
8. Form dots pondérés (RT-03) dans le drawer row Sprint 1.
9. Colonne 4 context-aware SIGNAL/MOMENTUM (RT-01).

### Sprint 3 — Migration `<div role="table">` (Phase B — ADR-001)
10. Refactor `renderTennisVB()` → émet `<div>` avec ARIA.
11. Refactor `renderTennisLive()` idem.
12. Implémenter CSS Grid V3.1 complet (`.tn-vb-grid`).
13. Tests VoiceOver (macOS) + NVDA (Windows) + TalkBack (Android).

### Sprint 4 — Mobile Card + Drawer final
14. CSS mobile card layout via `grid-template-areas`.
15. Drawer expand/collapse JS (toggle `hidden` + `aria-expanded`).
16. Touch targets validation 44px.
17. Test Safari iOS + Chrome Android.

---

## DELTA V3.0 → V3.1 (récapitulatif)

| Dimension | V3.0 | V3.1 |
|-----------|------|------|
| Momentum LIVE en T0 | ❌ dans le drawer | ✅ col SIGNAL context-aware |
| ELO bars depuis | ❌ 0 (écart invisible) | ✅ baseline contextuelle (diff visible) |
| Form sparkline | ❌ dots uniformes | ✅ taille+opacité selon rang adverse |
| Structure mobile | ❌ `<table>` display:block (a11y cassée) | ✅ ADR-001 : `<div role="table">` Phase B |
| Zone sticky | ❌ 386px (3 cols) | ✅ 252px (2 cols fusionnées, –134px) |
| Migration path | Sprint monolithique | ✅ Phase A (correctifs) → Phase B (refactor) |
| ARIA | ❌ table native sans attrs explicites | ✅ checklist 18 attributs documentés |

---

*V3.1 — Table Ronde Design PariScore Tennis*  
*Red Team corrections intégrées · ADR-001 proposé · En attente GO FINAL ABSOLU*
