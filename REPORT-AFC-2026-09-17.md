# Rapport d'Ingénierie - AFC Champions League Integration

## Objectif
Intégrer les compétitions AFC Champions League Elite et Two sur Pariscore via source gratuite FotMob (scraping stealth), sans dépendre d'API payantes.

## Source de données
- **Nom**: FotMob (via scrapling MCP)
- **URL Elite**: https://www.fotmob.com/leagues/525/overview/afc-champions-league-elite
- **URL Two**: https://www.fotmob.com/leagues/9469/overview/afc-champions-league-two
- **Méthode**: Fetcher scrapling + Camoufox stealth (contourne anti-bot)
- **Identifiants**: Elite=525, Two=9469

## Résultat
| Compétition | Groupes | Équipes | Matchs | Déjà joués |
|-------------|---------|---------|--------|------------|
| **ACL Elite** | 2 (West/East) | 32 | 128 | 16 |
| **ACL Two** | 8 | 32 | 99 | 16 |
| **Total** | 10 | 64 | 227 | 32 |

**Dernière mise à jour**: 2026-09-17

## Fichiers modifiés
1. **`scripts/scrape-afc-champions.py`** [nouveau]
   - Scraper Python 3 via scrapling MCP
   - Extrait standings (groupes + équipes), fixtures, saisons
   - Sauvegarde JSON dans `public/data/afc/`
   
2. **`src/lib/league-mapping.ts`** [modifié]
   - Ajout `BSD_UNCOVERED_LEAGUES`: `afc_champions_league_elite`, `afc_champions_league_two`
   - Ajout `FOTMOB_LEAGUE_IDS`: `{afc_champions_league_elite: 525, afc_champions_league_two: 9469}`
   - Ajout `LEAGUE_INFO`: entrées AFC (name, country: "Asia", sport: "football")
   
3. **`src/app/api/v1/afc/route.ts`** [nouveau]
   - Endpoint `GET /api/v1/afc?competition=elite|two|index`
   - Cache HTTP: `s-maxage=300, stale-while-revalidate=600`
   - Servir JSON depuis `public/data/afc/{elite,two,index}.json`

## Qualité
- `bun run typecheck`: ✅ 0 erreur (npx tsc --noEmit)
- `bun run lint` (eslint): ✅ Aucune erreur
- JSON `elite.json`, `two.json`, `index.json`: ✅ Tous valides
- Scraper output: ✅ 2 compétitions complètes extraites

## Suivant
- Planifier scraping quotidien via cron VPS (pm2)
- Ajouter interface predictive-bets.tsx (section "Set en cours")
- Intégrer cotes The-Odds-API si clé disponible à l'avenir
- Vérifier compatibilité avec moteur Markov live existant

## Tracabilité
- **Bead ID**: À clôturer via `bd close <id>`
- **Sync remote**: `bd dolt push`
- **Rapport généré**: 2026-09-17
- **Source**: Skill scrapling (adaptive scraping 3 modes)