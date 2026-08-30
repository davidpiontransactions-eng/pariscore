# Session: US Open Draw Forecast Update (2026-08-26)

## Résumé

Mise à jour des tableaux forecast ATP & WTA US Open 2026 depuis TennisAbstract.
Pipeline complet : scraping → DB → API → frontend.

## Données source

| Tournoi | URL | Joueurs |
|---------|-----|---------|
| US Open Men | `tennisabstract.com/current/2026USOpenMenForecast.html` | 128 |
| US Open Women | `tennisabstract.com/current/2026USOpenWomenForecast.html` | 128 |

## Fichiers modifiés/créés

| Fichier | Action | Description |
|---------|--------|-------------|
| `scripts/scrape-usopen-draw.js` | **Créé** | Scraper dédié US Open — parse HTML natif (`<td>`, `<a href>`) |
| `src/app/api/tennis/tournament/[slug]/draw/route.ts` | **Modifié** | Ajout `us-open-women` dans `TOURNAMENT_META` |

## Architecture du pipeline

```
TennisAbstract HTML
       ↓
scrape-usopen-draw.js (parse HTML → JSON)
       ↓
pariscore.db / tennis_draw_forecast (UPSERT)
       ↓
GET /api/tennis/tournament/[slug]/draw?year=2026
       ↓
useTournamentDraw(slug) → SWR hook
       ↓
Frontend (tournament draw component)
```

## Détails du scraper

### Approche

Le scraper `scrape-tennis-draw.js` existant attend la variable JS `proj32` (format historique).
Les pages US Open 2026 utilisent un format HTML natif avec des `<table>`/<`<tr>`/<`<td>`.
Scraper dédié créé pour parser ce format spécifique.

### Parsing HTML

```html
<tr>
  <td>(1)<a href="...?p=AlexanderZverev">Alexander Zverev</a> (GER)</td>
  <td>&nbsp;</td>  <!-- spacer -->
  <td>91.8%</td>  <!-- R64 -->
  <td>84.0%</td>  <!-- R32 -->
  <td>75.2%</td>  <!-- R16 -->
  <td>66.4%</td>  <!-- QF -->
  <td>48.3%</td>  <!-- SF -->
  <td>35.9%</td>  <!-- F -->
  <td>22.7%</td>  <!-- W -->
</tr>
```

### Extraction

- **TA ID** : depuis `href="?p=XXX"` (ex: `AlexanderZverev`)
- **Seed/Qualifier** : `(1)` → seed, `(Q)`/`(WC)`/`(LL)`/`(PR)` → qualifier
- **Pays** : `(GER)` en fin de cellule
- **Probabilités** : 7 colonnes R64→W, stockées en DB comme R16→W (5 colonnes)

### Mapping DB

| Colonne DB | Source |
|------------|--------|
| `tournament_slug` | `"us-open"` (H) / `"us-open-women"` (F) |
| `prob_r16` | Colonne 3 (R16) |
| `prob_qf` | Colonne 4 (QF) |
| `prob_sf` | Colonne 5 (SF) |
| `prob_f` | Colonne 6 (F) |
| `prob_win` | Colonne 7 (W) |

## Top 10 probabilités de titre

### ATP (us-open)

| # | Joueur | Pays | Seed | Win % |
|---|--------|------|------|-------|
| 1 | Alexander Zverev | GER | #1 | 22.7% |
| 2 | Novak Djokovic | SRB | #4 | 16.6% |
| 3 | Arthur Fils | FRA | #10 | 10.2% |
| 4 | Carlos Alcaraz | ESP | #2 | 6.5% |
| 5 | Felix Auger-Aliassime | CAN | #3 | 6.2% |
| 6 | Alex De Minaur | AUS | #6 | 4.8% |
| 7 | Daniil Medvedev | RUS | #7 | 4.8% |
| 8 | Ben Shelton | USA | #8 | 4.5% |
| 9 | Rafael Jodar | ESP | #12 | 4.0% |
| 10 | Taylor Fritz | USA | #9 | 3.0% |

### WTA (us-open-women)

| # | Joueur | Pays | Seed | Win % |
|---|--------|------|------|-------|
| 1 | Aryna Sabalenka | BLR | #1 | 28.0% |
| 2 | Elena Rybakina | KAZ | #2 | 17.0% |
| 3 | Coco Gauff | USA | #4 | 11.7% |
| 4 | Jessica Pegula | USA | #3 | 10.7% |
| 5 | Iga Swiatek | POL | #8 | 9.9% |
| 6 | Elina Svitolina | UKR | #9 | 4.5% |
| 7 | Marta Kostyuk | UKR | #11 | 3.5% |
| 8 | Mirra Andreeva | RUS | #5 | 2.7% |
| 9 | Linda Noskova | CZE | #6 | 1.4% |
| 10 | Alexandra Eala | PHI | #17 | 1.3% |

## Commandes

```bash
# Scraper les deux tableaux
node scripts/scrape-usopen-draw.js --all

# Scraper un seul tableau
node scripts/scrape-usopen-draw.js --tournament=us-open-men
node scripts/scrape-usopen-draw.js --tournament=us-open-women

# Dry-run (affichage sans écriture DB)
node scripts/scrape-usopen-draw.js --tournament=us-open-men --dry-run

# Forcer FlareSolverr (VPS/datacenter)
node scripts/scrape-usopen-draw.js --all --flaresolverr
```

## Notes techniques

- **HTTPS natif** : module `https` de Node, zéro dépendance externe
- **FlareSolverr fallback** : automatique sur 403/timeout (IP datacenter/VPS)
- **UPSERT** : `ON CONFLICT(tournament_slug, year, player_name) DO UPDATE` — re-exécution safe
- **Cache API** : 5 min TTL via `createTtlCache`
- **R64/R32** : probabilités de match disponibles dans le HTML mais non stockées en DB (colonnes R16→W uniquement, schéma existant)
