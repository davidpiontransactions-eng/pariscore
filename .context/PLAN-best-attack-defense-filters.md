# Plan — Filtres « Meilleure Attaque / Meilleure Défense » Football

> **Date** : 2026-08-09 | **Statut** : 🟡 En attente de GO

## 1. Résumé

Le composant `TopTeamsPresetsBar` a 10 presets dont 2 utilisent des données simulées :
- `topAttack` → `prediction.homeProb >= 55` (heuristique, pas de stats réelles)
- `topDefense` → `prediction.awayProb >= 55` (idem)

**Objectif** : scraper FBref + Understat → JSON statiques CDN → hook SWR → TopTeamsPresetsBar avec données réelles.

## 2. Métriques cibles

### Attaque
| Métrique | Source | Colonne |
|----------|--------|---------|
| Goals scored | FBref `standard` | `Gls/MP` |
| Shots per game | FBref `shooting` | `Sh/90` |
| xG | Understat API | `xG` par équipe |
| Attack frequency | FBref | `G/Sh` (buts/tir %) |

### Défense
| Métrique | Source | Colonne |
|----------|--------|---------|
| Goals conceded | FBref `standard` | `GA/MP` |
| Clean sheets | FBref `keeper` | `CS%` |
| Tackles won | FBref `misc` | `TklW/MP` |
| Defensive actions | FBref `misc` | `(Tkl+Int+Clr)/MP` |

## 3. Architecture

```
Understat API + FBref (soccerdata)
        ↓
scrape_team_attack_defense.py  →  public/data/metrics/team_stats_{slug}.json
        ↓
CDN (VPS nginx / Vercel static)
        ↓
use-team-attack-defense-stats.ts  (hook SWR, pattern = use-cornervalue-stats)
        ↓
TopTeamsPresetsBar  →  applyPresetFilter() étendu "topAttack"/"topDefense"
        ↓
FootballTabContent  →  passe adData au presets bar
```

## 4. Fichiers à créer/modifier

| Fichier | Action | Durée |
|---------|--------|-------|
| `scripts/scrape_team_attack_defense.py` | Nouveau — scrap FBref+Understat → JSON | 2h |
| `src/lib/football-data.ts` | Ajout types `TeamAttackStats`, `TeamDefenseStats` | 30 min |
| `src/hooks/use-team-attack-defense-stats.ts` | Nouveau — hook SWR | 30 min |
| `src/components/football/top-teams-presets-bar.tsx` | Logique réelle topAttack/topDefense | 1h |
| `src/components/football/football-tab-content.tsx` | Intégration hook + props | 15 min |
| `public/data/metrics/team_stats_*.json` | Générés par le scraper | auto |

## 5. Format JSON output

```json
{
  "meta": { "leagueName":"PL", "leagueSlug":"england", "season":"2025-2026", "source":"FBref+Understat" },
  "teams": [{
    "teamName": "Manchester City",
    "attack": { "goalsPerGame":2.4, "shotsPerGame":15.2, "xGPerGame":2.1, "attackFrequency":15.8, "rank":1 },
    "defense": { "concededPerGame":0.8, "cleanSheetPct":45, "tacklesPerGame":12.3, "defActionsPerGame":35.1, "rank":2 }
  }]
}
```

## 6. Sources — Évaluation

| Source | Dispo | Couverture | Limitations |
|--------|-------|------------|-------------|
| **FBref (soccerdata)** | ✅ Déjà utilisé | Big5+Champ, 22 stat types | 10 req/min |
| **Understat** | ✅ Déjà utilisé | Big5, xG/xGA/PPDA | 5 ligues max, pas tacles |
| **StatsHub** | ⚠️ À investiguer | 100+ ligues, gratuit | SPA JS, pas d'API visible |

→ **Recommandé**: FBref + Understat pour 32 ligues extensibles.

## 7. Calendrier total : ~5h

1. Scraper Python — 2h
2. Types TS — 30 min
3. Hook SWR — 30 min
4. TopTeamsPresetsBar — 1h
5. FootballTabContent — 15 min
6. Test local + JSON — 30 min
7. Déploiement VPS — 15 min

## 8. Risques

- **FBref 403** → soccerdata gère rate-limit (7s between)
- **Saison 2026/27 vide** (août) → fallback 2025/26
- **Noms équipes ≠ BSD** → `team_name_mapping.py` + fuzzy match
- **Ligues mineures sans données** → badge "Bientôt disponible"

## 9. Questions pour GO

1. **Saison** : 2025/2026 d'abord (2026/27 trop tôt) ?
2. **Ligues** : Top 5 uniquement ou les 32 ligues existantes ?
3. **StatsHub** : investiguer leur endpoint en post-MVP ?

---

*En attente de validation GO avant implémentation.*
