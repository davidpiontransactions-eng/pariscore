# Mission : Snooker Northern Ireland Open — Scraping + Top 10 Stratégies

**Début** : 2026-09-13 12:00 UTC
**Fin** : 2026-09-13 15:30 UTC
**Statut** : ✅ Terminé

---

## Objectif

1. Scraper les matchs + cotes du Northern Ireland Open depuis Oddsportal
2. Fusionner les données FlashScore + Oddsportal dans l'API
3. Redesigner le Top 10 avec des probabilités multi-modèles (≥50%)
4. Ajouter les date/heure françaises des matchs
5. Automatiser le scraping quotidien

---

## Livrables

### Fichiers créés

| Fichier | Description |
|---------|-------------|
| `scripts/scrape_oddsportal_nio.mjs` | Scraper Playwright pour Oddsportal NIO (matchs + cotes) |
| `scripts/cron_snooker.sh` | Script cron quotidien (FlashScore + Oddsportal) |
| `missions/snooker-nio.md` | Ce fichier de traçabilité |

### Fichiers modifiés

| Fichier | Changements |
|---------|-------------|
| `src/components/snooker/snooker-tab-content.tsx` | 5 stratégies prédictives, tableau Oddsportal, probabilités multi-modèles, date/heure FR |
| `src/app/api/v1/snooker/matches/route.ts` | Fusion 2 sources (FlashScore + Oddsportal), déduplication prioritaire odds, scheduled_at Oddsportal |
| `scripts/scrape_flashscore_snooker.mjs` | Fix import Playwright (path absolu) |
| `package.json` | Scripts `snooker:scrape`, `snooker:scrape:flash`, `snooker:scrape:nio` |

---

## Architecture technique

### Scraper Oddsportal NIO

- **Technologie** : Playwright headless Chrome
- **URL** : `https://www.oddsportal.com/snooker/northern-ireland/northern-ireland-open/`
- **Sélecteurs DOM** :
  - Lignes de match : `div.flex.w-full.items-stretch.border-b.border-l.border-black-borders`
  - Joueurs : `p.order-1` / `p.order-2`
  - Cotes : `ul p` (valeurs décimales)
  - Statut/heure : `div.w-max.whitespace-nowrap p` → regex `/^\d{1,2}:\d{2}$/` pour les scheduled
- **Sortie** : `data/oddsportal_nio.json`

### API Fusionnée

```
GET /api/v1/snooker/matches
├── FlashScore (data/odds_flashscore_snooker.json) → matchs du jour
├── Oddsportal NIO (data/oddsportal_nio.json) → NIO + cotes
├── Déduplication : prioriser Odds khi a les cotes
└── Transform : OddsportalMatch → SnookerMatch (scheduled_at depuis time field)
```

### Modèles prédictifs (Top 10)

5 modèles combinés par moyenne pondérée :

| Modèle | Source | Poids base |
|--------|--------|------------|
| **Elo** | `eloRating` DB | 1 |
| **Forme** | `winPct` × 0.7 + `deciderWinPct` × 0.3 | 1 (×2 si stratégie "Forme") |
| **Scoring** | `centuryRate` × 0.55 + `avgBreak` × 0.45 | 1 (×2 si stratégie "Scoring") |
| **Clutch** | `deciderWinPct` | 1 (×2 si stratégie "Clutch") |
| **Cotes** | Probabilité implicite déviggée (1/odds normalisé) | 1 |

**Filtrage** : uniquement les matchs où le favori a ≥50% de probabilité.

### Bandes de confiance

| Probabilité | Badge | Couleur |
|-------------|-------|---------|
| ≥70% | Élevée | Vert `#00985f` |
| ≥60% | Moyenne | Orange `#FF6D00` |
| ≥50% | Correcte | Bleu `#2196F3` |
| <50% | — | Gris (exclu du Top 10) |

---

## Données scrapées

### Résultat du 2026-09-13

| Source | Matchs | Avec cotes | Live | Terminés |
|--------|--------|------------|------|----------|
| FlashScore | 17 | 0 | 5 | — |
| Oddsportal NIO | 16 | 16 | 0 | 7 |
| **Fusionné** | **17** | **16** | **5** | **7** |

### Format Oddsportal NIO

```json
{
  "id": "brown-oliver-hAuj3Jx5",
  "home": "Brown O.",
  "away": "Kowalski A.",
  "time": "17:00",
  "status": "scheduled",
  "odds1": 3.27,
  "odds2": 1.25,
  "href": "/snooker/h2h/brown-oliver-hAuj3Jx5/..."
}
```

---

## Cron

### Configuration VPS

```bash
# Ajouter au crontab :
0 6 * * * cd /home/ubuntu/pariscore && bash scripts/cron_snooker.sh >> logs/snooker-cron.log 2>&1
```

### Logs

- Local : `logs/snooker-cron.log`
- VPS : `/tmp/pariscore-deploy.log`

---

## Tests

| Test | Résultat |
|------|----------|
| `npx tsc --noEmit` | ✅ 0 erreurs |
| Scraper Oddsportal NIO | ✅ 16 matchs, 16 avec cotes |
| Scraper FlashScore | ✅ 17 matchs, 5 live |
| API fusion | ✅ 17 matchs, 16 avec cotes |
| scheduled_at Oddsportal | ✅ "17:00" → `2026-09-13T15:00:00Z` |
| Top 10 probabilités | ✅ Affiche % ≥50% |

---

## Problèmes rencontrés

1. **Import Playwright** : le chemin `from "playwright"` ne résolvait pas → fix avec `file:///` absolu
2. **Sélecteur Oddsportal** : `span.max-md:hidden.min-md:inline` ne marchait que pour "Finished" → fix avec `div.w-max.whitespace-nowrap p`
3. **Déduplication** : Oddsportal matches écrasés par FlashScore → fix : prioriser Oddsportal quand odds disponibles
4. **scheduled_at null** : le champ `time` n'était pas extrait → fix scraper + API pour construire la date depuis `time`

---

## Suite

- [ ] Scraper les bookmakers individuels (page détaillée par match)
- [ ] Ajouter le form récent (last 5 matchs) depuis CueTracker
- [ ] Backtesting des modèles prédictifs
- [ ] Cron VPS à configurer manuellement
