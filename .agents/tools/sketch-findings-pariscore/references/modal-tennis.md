# Modal Analyse Tennis

## Design Decisions
- **Tableau H2H 3 colonnes (P1 / Label / P2)** retenu — densite maximale pour les utilisateurs pro
- **Header**: tournoi + surface badge a droite, layout flex
- **Hero**: avatars circulaires avec initiales, nom + rang en-dessous, VS circle au centre
- **H2H Widget**: bandeau #131722 entre hero et tableau, police DM Mono 11px
- **Footer**: source BSD, modele, IC90, bordure superieure rgba(255,255,255,0.04)

## CSS Patterns
```css
.modal { max-width: 640px; background: linear-gradient(180deg, #131722, #0b0e17); border: 1px solid rgba(255,255,255,0.08); }
.m-header { padding: 18px 22px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.m-hero { display: flex; align-items: center; justify-content: center; gap: 20px; padding: 22px; }
.m-avatar { width: 54px; height: 54px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.08); }
.m-name { font-family: 'Instrument Sans'; font-size: 15px; font-weight: 700; color: #e8eaed; }
.row { display: grid; grid-template-columns: 1fr 1.5fr 1fr; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
```

## HTML Structures
```html
<div class="modal">
  <div class="m-header">Tournament + Badge</div>
  <div class="m-hero">P1 Avatar + Name + VS + P2 Avatar + Name</div>
  <div class="h2h-widget">H2H: P1 X-Y P2 | Surface: X-Y</div>
  <div class="table-section">
    <div class="row"><span class="p1">val</span><span class="label">METRIC</span><span class="p2">val</span></div>
    <!-- ~15 rows -->
  </div>
  <div class="m-footer">Source: BSD · Modele · MAJ</div>
</div>
```

## What to Avoid
- Cartes 2-colonnes (Variant B) → trop aerees, perte de densite pour les pros
- Accordeon (Variant C) → cache l'information, necessite des clics supplementaires
- Plus de 15 lignes dans le tableau → regrouper les metriques secondaires

## Origin
Synthesized from sketch: 002
Source: sources/002-modal-analyse-tennis/
