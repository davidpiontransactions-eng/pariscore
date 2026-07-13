# Navbar Premium

## Design Decisions
- **Scroll horizontal avec icones SVG inline** retenu — garde la decouvrabilite, icones vectorielles zero CDN
- **Icônes via mask CSS**: `mask: var(--ico) center/contain no-repeat` — currentColor, pas de requetes reseau
- **Barre active glow**: `border-bottom: 3px solid #00e676` avec `font-weight: 800`
- **Logo**: texte avec accent vert sur le mot "Score"
- **Live pill**: dot rouge anime + texte LIVE, fond rgba(239,68,68,0.12)
- **Bouton auth**: transparent, border rgba(255,255,255,0.12), hover border plus clair

## CSS Patterns
```css
.nav { background: #0b0e17; border-bottom: 1px solid rgba(255,255,255,0.06); height: 60px; }
.nav-links { display: flex; overflow-x: auto; scrollbar-width: thin; }
.nav-links a { position: relative; padding: 0 14px; color: #94a3b8; font-weight: 700; font-size: 13px; border-bottom: 3px solid transparent; }
.nav-links a::before { content: ''; mask: var(--ico); background: currentColor; opacity: 0.5; }
.nav-links a:hover { color: #e8eaed; }
.nav-links a.active { color: #00e676; border-bottom-color: #00e676; font-weight: 800; }
.live-pill { background: rgba(239,68,68,0.12); color: #ef4444; border-radius: 999px; }
.live-dot { animation: blink 1s infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
```

## What to Avoid
- Dropdown (Variant B) → perd en decouvrabilite, les nouveaux utilisateurs ne trouvent pas les sports
- Icones seules (Variant C) → trop cryptiques, necessite de connaitre les icones par coeur
- Plus de 12 onglets visibles → utiliser un bouton "More" pour les sports secondaires

## Origin
Synthesized from sketch: 003
Source: sources/003-navbar-premium/
