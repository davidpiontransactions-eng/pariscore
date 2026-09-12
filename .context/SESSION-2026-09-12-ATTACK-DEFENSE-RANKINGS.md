# Mission : Classement Attaque/Défense Home/Away avec xG + Arrêts gardien

**Date début** : 2026-09-12
**Date fin** : 2026-09-12
**Statut** : ✅ TERMINÉE

## Résumé

Implémentation d'un système de scores composites Attaque/Défense pour les matchs de football prematch, basé sur des données académiques (xG, arrêts gardien, tirs cadrés).

## Livrables

### Phase 1 — Données
| Fichier | Action | Statut |
|---|---|---|
| `scripts/scrape_team_attack_defense.py` | Enrichi avec patterns keeper (saves, save%, PSxG, goals prevented) | ✅ |
| `src/lib/football-fbref-advanced.ts` | **Créé** — Charge les stats FBref avancées (keeper, shooting) depuis `data/fbref_advanced/` | ✅ |
| `src/lib/bsd-football-fetcher.ts` | Modifié — Intègre les stats FBref dans `attachDerivedData()` + enrichit `metricStats.shots/sot` | ✅ |

### Phase 2 — Modèle
| Fichier | Action | Statut |
|---|---|---|
| `src/lib/football-attack-defense.ts` | **Créé** — Scores composites attaque (35% xG + 25% buts pg + 25% tirs cadrés pg + 15% conversion) et défense (35% xGA + 25% buts encaissés + 25% save% + 15% CS%) | ✅ |

### Phase 3 — UI
| Fichier | Action | Statut |
|---|---|---|
| `src/components/football/fotmob-match-stats.tsx` | Modifié — Ajout lignes "Attaque" et "Défense" avec labels (elite/fort/moyen/faible) | ✅ |
| `src/lib/football-data.ts` | Modifié — Ajout type `FbrefTeamAdvancedStats` + champ `fbrefAdvanced` dans `Prediction` | ✅ |

## Quality Gates
- `bun run typecheck` : ✅ 0 erreurs
- `bun run lint` : ✅ 0 erreurs (3 warnings pré-existants)

## Données disponibles

| Métrique | Source | Dispo |
|---|---|---|
| Buts marqués/encaissés pg | BSD standings | ✅ |
| xG for, xGA | Understat (Big 5) | ✅ (dans `xGa`) |
| Tirs/match, Tirs cadrés/match | FBref via soccerdata | ✅ (dans `fbrefAdvanced`) |
| Arrêts gardien (saves, save%) | FBref via soccerdata | ✅ (dans `fbrefAdvanced`) |
| Clean sheets, CS% | FBref via soccerdata | ✅ (dans `fbrefAdvanced`) |
| PSxG, Goals prevented | FBref (non extrait) | ❌ — à ajouter si besoin |

## Journal de boucle

### [START] 2026-09-12T12:00Z
- Mission initialisée
- Skills vérifiés : agent-reach, websearch, scrapling, crawl4ai

### [TASK 1.1] 2026-09-12T12:15Z — FBref keeper stats
- Modifié `scrape_team_attack_defense.py` : ajout patterns `_KP_SAVES_PATTERNS`, `_KP_SAVE_PCT_PATTERNS`, `_KP_PSXG_PATTERNS`, `_KP_PSXG_MINUS_GA_PATTERNS`
- Ajout extraction dans `merge_team_data()` et `compute_metrics()`
- **Résultat** : patterns prêts, extraction possible quand le scraper tourne

### [TASK 1.2] 2026-09-12T12:30Z — FBref advanced loader
- Créé `src/lib/football-fbref-advanced.ts`
- Parse les JSON de `data/fbref_advanced/` (déjà générés par `scrape_advanced_stats.py`)
- Extrait keeper (saves, save%, GA, SoTA, CS, CS%) + shooting (Sh, Sh/90, SoT, SoT/90)
- Cache mémoire par ligue+saison

### [TASK 1.3] 2026-09-12T12:45Z — Wiring prematch pipeline
- Ajouté type `FbrefTeamAdvancedStats` dans `football-data.ts`
- Ajouté champ `fbrefAdvanced` dans `Prediction`
- Modifié `bsd-football-fetcher.ts` : `attachDerivedData()` charge les stats FBref
- Enrichi `metricStats.shots/sot` avec les données FBref quand BSD retourne null

### [TASK 2] 2026-09-12T13:00Z — Score attaque/défense
- Créé `src/lib/football-attack-defense.ts`
- Formule attaque : 35% xG + 25% buts pg + 25% tirs cadrés pg + 15% conversion
- Formule défense : 35% xGA inv + 25% buts encaissés inv + 25% save% + 15% CS%
- Bornes typiques Big 5 (xG: 0.5-2.5, SOT: 3-8, save%: 55-80, CS%: 10-50)
- Labels UI : elite (≥75), fort (≥55), moyen (≥35), faible (<35)

### [TASK 3] 2026-09-12T13:15Z — UI popup
- Modifié `fotmob-match-stats.tsx`
- Importé `computeAttackDefense`, `attackDefenseLabel`, `attackDefenseColor`
- Ajouté lignes "Attaque" et "Défense" après les stats existantes
- Affiche score 0-100 + label (ex: "72 elite", "45 moyen")

### [GATES] 2026-09-12T13:30Z
- typecheck : ✅ 0 erreurs
- lint : ✅ 0 erreurs

## Prochaines étapes
1. **Commit + deploy** — Pousser les changements et déployer sur le VPS
2. **Enrichir les données** — Exécuter `scrape_advanced_stats.py` pour les autres ligues (actuellement seulement EPL)
3. **Ajouter PSxG** — Modifier le scraper FBref pour extraire PSxG (Post-Shot xG) si besoin
4. **Tests** — Ajouter des tests unitaires pour `computeAttackDefense()`
