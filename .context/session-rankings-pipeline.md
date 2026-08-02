# Session: Pipeline Rankings Home/Away (2026-02-08)

## État final — Tous les livrables

### Fichiers créés (8)

| Fichier | Lignes | Statut |
|---------|--------|--------|
| `DATA_RANKINGS_PIPELINE.md` | 455 | ✅ Rapport d'architecture complet |
| `scripts/requirements-rankings.txt` | 6 | ✅ Dépendances Python |
| `scripts/team_name_mapping.py` | 83 | ✅ 150+ overrides noms d'équipes (8 ligues) |
| `scripts/scrape_rankings_poc.py` | 238 | ✅ PoC 1 ligue (compatible homeaway.asp) |
| `scripts/scrape_rankings.py` | 189 | ✅ Production multi-ligues (8/8 OK) |
| `.github/workflows/refresh-rankings.yml` | 75 | ✅ CRON quotidien 04:00 + 02:00 WE |
| `src/hooks/use-league-rankings.ts` | 41 | ✅ Hook SWR CDN |
| `src/app/api/football/rankings/route.ts` | 54 | ✅ Route API proxy |

### Résultat scraping (2026-08-02)

8 ligues scrapées avec succès → `public/data/rankings/` :
- epl.json (20), championship.json (24), ligue1.json (18), laliga.json (20)
- bundesliga.json (18), seriea.json (20), eredivisie.json (18), primeira_liga.json (18)

### URLs scraper (homeaway.asp)

```
https://www.soccerstats.com/homeaway.asp?league={slug}
```

### Structure JSON générée

```json
{
  "meta": { "schemaVersion": 1, "leagueId": "epl", "leagueName": "England",
            "season": "2026-27", "source": "soccerstats.com", "teamCount": 20 },
  "home": { "ppg": [{ "rank": 1, "teamId": "", "teamName": "Arsenal",
                       "value": 2.55, "played": 12 }], ... },
  "away": { ... },
  "metricDefs": { "ppg": { "label": "PPG", "higherIsBetter": true, "unit": "pts" }, ... }
}
```

### Métriques dispo sur homeaway.asp (8)

PPG, Pts, GF, GA, GD, W, D, L (GP pour le contexte)
→ Shots/SOT/Attacks/Corners nécessitent d'autres pages (à scraper plus tard)

## Comment ajouter une ligue

1. **Ajouter l'URL** dans `LEAGUES` (scrape_rankings.py ligne ~42) :
   ```python
   "scotland": ("https://www.soccerstats.com/homeaway.asp?league=scotland", "scot_prem"),
   ```

2. **Ajouter le mapping** si nouveau : `LEAGUE_ID_MAP` dans `team_name_mapping.py`

3. **Ajouter les noms d'équipes** dans `TEAM_NAME_OVERRIDES` (team_name_mapping.py)
   - Format : `"nom soccerstats": "Nom PariScore"`

4. **Tester** :
   ```bash
   python scripts/scrape_rankings.py --league scotland --output-dir public/data/rankings
   ```

5. **Commit** :
   ```bash
   git add scripts/ public/data/rankings/ .github/workflows/ src/hooks/ src/app/api/
   ```

## Debug rapide d'une nouvelle ligue

```python
# Créer _debug.py :
import requests; from bs4 import BeautifulSoup
url = "https://www.soccerstats.com/homeaway.asp?league=SCOTLAND"
r = requests.get(url, headers={"User-Agent": "Mozilla/5.0..."})
soup = BeautifulSoup(r.text, "lxml")
for t in soup.find_all("table"):
    rows = t.find_all("tr")
    if len(rows) > 5:
        prev = t.find_previous(["h2","h3","b","strong","div","font"])
        ctx = prev.get_text(strip=True) if prev else ""
        if "home table" in ctx.lower() or "away table" in ctx.lower():
            print(ctx)
```

## Validations

- ✅ Python syntax: 3/3 scripts OK
- ✅ TypeScript: `tsc --noEmit` → 0 erreur
- ✅ Scraping test: 8/8 ligues OK
- ✅ JSON valide: schéma conforme à `LeagueRankingsFile`

## Prochaines étapes (Phase 4-5)

- [ ] Intégrer `useLeagueRankings` dans `MetricLeaderboardTable`
- [ ] Scraper shots/SOT/attacks/corners depuis les pages dédiées
- [ ] Ajouter ligues: Scotland, Turkey, Greece, Belgium, Austria, Denmark, Switzerland, Norway...
- [ ] Activer le CRON GitHub Actions
