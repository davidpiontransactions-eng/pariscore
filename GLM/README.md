# ParisScore — Tennis Live (Vanilla JS)

Package complet pour intégrer le tennis card live avec metrics DR dans pariscore.html + pariscore.js.
**Aucune dépendance React, aucun build step.** Vanilla JS pur.

## Fichiers

| Fichier | Description | Où l'intégrer |
|---|---|---|
| `tennis-live.css` | Tous les styles BETMART (Dark Navy palette) | Coller dans `<style>` de pariscore.html |
| `tennis-live.js` | Logique complète (DR engine, match sim, UI render, search, top10, modal) | Uploader sur le VPS, ajouter `<script src="/tennis-live.js">` |
| `tennis-live.html` | Section HTML (1 div) | Coller dans `<div id="page-tennis">` |
| `players-api.js` | Endpoints API (search, top10, profile) | Coller dans `handleAPI()` de server.js |
| `migration-players.sql` | Schéma SQLite + seed 10 joueurs | `sqlite3 pariscore.db < migration-players.sql` |

## Intégration en 5 étapes

### 1. CSS
Coller le contenu de `tennis-live.css` dans le bloc `<style>` de pariscore.html (avant `</style>`).

### 2. HTML
Coller `<div id="tennis-live-section"></div>` dans `<div id="page-tennis">`, après la KPI bar.

### 3. JS
Uploader `tennis-live.js` sur le VPS dans `/var/www/pariscore/public/`.
Ajouter avant `</body>` dans pariscore.html :
```html
<script src="/tennis-live.js"></script>
<script>
  // Init quand la page tennis est affichée
  function initTennisLive() {
    if (document.getElementById('tennis-live-section')) {
      TennisLive.init('tennis-live-section');
    }
  }
  // Init au chargement + au changement d'onglet
  document.addEventListener('DOMContentLoaded', initTennisLive);
  // Si tu utilises showPage(), ajoute aussi :
  // var origShowPage = showPage;
  // showPage = function(p) { origShowPage(p); if (p === 'tennis') setTimeout(initTennisLive, 100); };
</script>
```

### 4. API server.js
Coller le contenu de `players-api.js` dans `handleAPI()` de server.js, après les routes forecasts (vers ligne 44820).

### 5. Base de données
```bash
sqlite3 /var/www/pariscore/pariscore.db < migration-players.sql
```

## Ce que ça affiche

- **KPI bar** : Matchs Live, Joueurs DB, Tournois, Photos
- **Search autocomplete** : tape "sinner" → dropdown avec photo, rank, ELO, L5, forecast
- **Match grid 3 cols** : 6 cards live avec simulation DR en temps réel
  - Header : tournoi + badge LIVE + pressure
  - Scoreboard : photos joueurs + score sets/games/points + indicateur service
  - PIT metrics : DR, Hold Streak, Rally Avg, xWin Δ, Intensity
  - DR sparkline SVG : évolution 30 derniers points (ligne ambre P1 + verte P2)
  - Smart Live Bets : alertes momentum (BREAK quand DR > 1.15)
  - Odds grid : O 7.5 / O 8.5 / U 12.5 avec badges VALUE/AI-AL/PASS + barres de progression
- **Top 10 panel** : switcher gender (ATP/WTA) + surface (clay/grass/hard/indoor)
  - Chaque row : rank badge, photo, nom, ELO surface, barre L5 (5 carrés W/L colorés), composite score + forecast %
- **Profile modal** : click sur un joueur → overlay plein écran
  - Photo 80×80 + nom + rank + country + badge "TA Live"
  - ELO par surface (4 cartes avec barres)
  - Career splits table (Hard/Clay/Grass × M/Win%/DR/SPW/RPW/Hld%/Brk%)
  - L5 form (5 carrés W/L)
  - Liens Wikipedia + Tennis Abstract

## DR Engine (formule ParisScore/Sofascore)

```
DR = (serve_won + return_won) / (opp_serve_won + opp_return_won)
DR_P1 × DR_P2 = 1 (toujours)
DR > 1 = dominant, DR = 1 = équilibre, DR < 1 = sous pression
```

## Algorithme Top 10

```
Score = 40% × ELO_surface + 25% × L5_winrate + 20% × forecast_delta + 15% × H2H_top10
```

## Palette BETMART

```
Page:     #121826
Card:     #1E2532
Nested:   #0F1419
Blue:     #3B82F6 (accent)
Green:    #10B981 (success)
Red:      #EF4444 (live/error)
Amber:    #F59E0B (warning)
Text 2:   #8B95A7
Text 3:   #64748B
Radius:   8px / 6px / 4px
Font:     DM Mono (mono) + Source Sans 3 (body)
```
