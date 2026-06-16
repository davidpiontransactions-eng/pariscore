# Backlog : Sprint Performance & Refonte UI Tennis v12.81

**Projet** : PariScore — Optimisation latence TOP 10 + Refonte UI/UX onglet Tennis  
**Date de création** : 2026-06-15  
**Porteur** : CTO/Lead Data Scientist  
**Dernière mise à jour** : 2026-06-16

---

**Note :** Le CRITICAL_BLOCKED layout a été résolu (v12.81e). Les tâches Tennis/F1 sont débloquées.

## 🚨 SPRINT PERFORMANCE — LATENCE TOP 10 (2026-06-16)

### Contexte
Le clic sur l'onglet 'TOP' subit une latence serveur désastreuse qui affiche 'Données indisponibles'. La fonction backend `buildTennisValueBets()` prend ~15-20s (cold build sur 420 matchs × Elo/Glicko/Momentum/Markov/odds BSD) et le cache TTL est trop court (60s/30s).

### TODO Performance

| # | Description | Priorité | Estimation | Statut |
|---|-------------|----------|------------|--------|
| P1 | Augmenter TTL cache TOP 10 : 60s→5min (viewer), 30s→3min (bettor) | CRITICAL | 15min | ✅ DONE |
| P2 | Implémenter warmer boot TOP 10 (pré-calcul après 120s) | CRITICAL | 30min | ✅ DONE |
| P3 | Ajouter fallback gracieux sur ancien cache en cas d'erreur rebuild | HIGH | 20min | ✅ DONE |
| P4 | Cron background refresh 5min pour rafraîchir cache TOP 10 | MEDIUM | 30min |  TODO |
| P5 | Tests performance (avant/après) — mesurer temps de réponse | HIGH | 45min | ⏳ TODO |
| P6 | Documentation CHANGELOG.md v12.82 | LOW | 15min | ⏳ TODO |

---

## 🧩 SPRINT MODULE H2H SURFACE — TABLEAU COMPARATIF (2026-06-16)

### Contexte
Module d'analyse avancée spécifique à la surface dans la modale Premium TOP 10. Tableau 4 lignes : ELO/Classement, PowerScore, Historique édition précédente, Forme L10.

### TODO H2H

| # | Description | Priorité | Estimation | Statut |
|---|-------------|----------|------------|--------|
| H1 | Backend : ajouter l5_pts/l10_pts/ps_rank/ps_total au payload détail | HIGH | 10min | ✅ DONE |
| H2 | Backend : créer _tennisPlayerTournamentHistory() + intégration payload | HIGH | 30min | ✅ DONE |
| H3 | HTML : table comparative H2H après .tam-grid | HIGH | 15min | ✅ DONE |
| H4 | CSS : styles .tennis-surface-h2h-table, .h2h-*, .cyan-text, .green-text | HIGH | 15min | ✅ DONE |
| H5 | JS : populate 4 métriques + couleurs conditionnelles | HIGH | 20min | ✅ DONE |
| H6 | **FIX DATA : || null tue l10_pts=0 — remplacer par != null ? val : null** | CRITICAL | 10min | ✅ DONE |
| H7 | **FIX DATA : round NULL dans tennis_matches_internal — défaut "Participant"** | CRITICAL | 5min | ✅ DONE |
| H8 | **FIX DATA : l10_pts/l5_pts jamais init si 0 matchs — défaut 0** | CRITICAL | 5min | ✅ DONE |
| H9 | **FIX UI : fallback N/A pour historique et forme si null** | MEDIUM | 10min | ✅ DONE |
| H10 | Tests performance avant/après H2H | LOW | 30min | ⏳ TODO |

### Critères de Validation Performance
- [ ] Temps de réponse TOP 10 < 100ms (cache hit)
- [ ] Temps de réponse TOP 10 < 5s (cache miss avec fallback)
- [ ] Zéro affichage "Données indisponibles" en conditions normales
- [ ] Cache rafraîchi toutes les 5min maximum
- [ ] `node --check server.js` passe sans erreur

---

## 🎨 SPRINT UI TENNIS — REFONTE VISUELLE (2026-06-15)

### TODO UI

| # | Description | Priorité | Estimation | Statut |
|---|-------------|----------|------------|--------|
| 1 | Appliquer le fond global `#0e1420` à `#page-tennis` et tous les conteneurs tn2-* | HIGH | 30min | ⏳ TODO |
| 2 | Changer le fond des cartes matchs/KPI de `#182030` à `#172132` avec ombre portée | HIGH | 30min |  TODO |
| 3 | Appliquer `#111a28` aux en-têtes de section, tableaux et zones imbriquées | HIGH | 30min | ⏳ TODO |
| 4 | Créer la nouvelle classe `.tennis-odds-box-premium` avec hover bleu `#0077ff` | HIGH | 45min | ⏳ TODO |
| 5 | Créer les classes `.tennis-match-card-premium` et `.tennis-grid-header` | HIGH | 30min | ⏳ TODO |
| 6 | Normaliser les bordures en `1px solid rgba(255,255,255,0.05)` sur tous les composants tn2 | MED | 30min | ⏳ TODO |
| 7 | Ajouter l'effet de survol subtil `rgba(255,255,255,0.02)` sur les cartes | MED | 20min | ⏳ TODO |
| 8 | Remplacer l'accent vert des onglets sélectionnés par le bleu `#0077ff` sur les tab-btn actifs | MED | 15min | ⏳ TODO |
| 9 | Ajuster la typographie : Inter/Roboto, font-weight 700 titres, 500 secondaire, tailles 11-12px métriques | LOW | 30min | ⏳ TODO |
| 10 | Ajouter les design tokens CSS en variables `--tennis-bg`, `--tennis-card`, `--tennis-nested`, `--tennis-accent-blue` | MED | 20min | ⏳ TODO |
| 11 | Tester la régressions thème clair (body[data-cf-light="1"]) pour chaque modification | HIGH | 45min |  TODO |
| 12 | Mettre à jour plan.md, backlog.md et CLAUDE.md avec la roadmap v12.81 | MED | 20min | ⏳ TODO |
| 13 | Commit et push avec message structuré | HIGH | 15min | ⏳ TODO |
| 14 | Fix crash layout Tennis — supprimer all:initial + margin:0 auto sur .tn2-main | CRITICAL | 30min | ✅ DONE |
| 15 | Pipeline photos athlètes — remplacer initiales par <img> dans les cartes Live Tennis | HIGH | 1h | 🔄 IN PROGRESS |
| 16 | Fix décalage layout droite — padding tn2-main, grid mobile, width:100% card-grid | HIGH | 30min | ✅ DONE |

---

## IN PROGRESS

| # | Description | Début | Avancement |
|---|-------------|-------|------------|
| 15 | Pipeline photos athlètes — remplacer initiales par <img> dans les cartes Live Tennis | 2026-06-16 | 30% |
| 16 | **Refonte UI Premium TOP 10 Tennis** — charte sombre, contours nets, odds boxes chirurgicales, style trading dashboard | 2026-06-16 | ✅ DONE |

---

## DONE

| # | Description | Date |
|---|-------------|------|
| - | Diagnostic complet du système CSS tn2 existant — mapping des classes tn2 vers les nouveaux tokens | 2026-06-15 |
| - | Analyse du HTML de page-tennis (sidebar, KPI, tabs, panels, modals, legacy sections) | 2026-06-15 |
| - | Spécification des design tokens issue de l'image de référence "image_ad30a6.jpg" | 2026-06-15 |
| - | **FIX CRITIQUE KPI Tennis** — tn2-kpi-bets et tn2-kpi-top restaient bloqués à 0 car tn2UpdateKPI n'était jamais appelée avec ces champs. Correction : calcul unifié bets/top dans tn2RenderLiveCards + appel KPI dans tn2RenderTopCards + préservation des KPIs dans tn2RenderTournaments | 2026-06-15 |
| - | **FIX CRITIQUE LAYOUT** — overflow:hidden sur .tn2-card-grid coupait les cartes + code photo resetait cache à chaque onglet + tab-btn manquaient flex-shrink:0 | 2026-06-15 |
 | - | **Documentation architecture** — Création de architecture_pariscore.md (arborescence, data pipeline, cycle d'analyse) | 2026-06-16 |
| - | **Compression UI Tennis** — Suppression des encarts FORECASTS vides, remplacement par injection conditionnelle avec `is-empty`, nettoyage CSS obsolète | 2026-06-16 |
| - | **Optimisation cache TOP 10** — TTL augmenté (5min/3min) + warmer boot + fallback gracieux | 2026-06-16 |
| - | **Module H2H Surface TOP 10** — Tableau comparatif 4 lignes (ELO, PowerScore, Historique, Forme L10) dans modale analyse premium | 2026-06-16 |
| - | **FIX DATA H2H : Bugs || null** — l10_pts/l5_pts/ps_rank/ps_total écrasés par || null quand valeur = 0. Remplacement par != null ? val : null. | 2026-06-16 |
| - | **FIX DATA H2H : round NULL historique** — tennis_matches_internal.round NULL → défaut "Participant" pour éviter affichage vide | 2026-06-16 |
| - | **FIX DATA H2H : l10_pts jamais init** — _tennisPowerForm ne settait pas l10_pts=0 si aucun match sur la surface | 2026-06-16 |
| - | **FIX UI H2H : fallback N/A** — Affichage "N/A" explicite quand données historiques/disponibles manquantes | 2026-06-16 |

---

## Notes techniques

### Estimation totale du projet UI : 6h30
### Estimation sprint performance : 2h30

### Dépendances entre tâches UI

Les tâches 1, 2, 3 sont la base et doivent précéder les autres. Les tâches 4-10 peuvent être réalisées en parallèle. La tâche 11 (test régressions) doit être faite APRÈS toutes les modifications. La tâche 12 ferme la boucle documentation.

### Critères de validation UI

- Le fond global est `#0e1420` (vérifié à l'inspection)
- Les cartes utilisent `#172132` avec ombre
- Les en-têtes utilisent `#111a28`
- Les odds badges ont le hover bleu `#0077ff`
- Aucune régression sur le thème clair
- Les bordures sont semi-transparentes fines

### Architecture technique — Références

- **Documentation complète** : `architecture_pariscore.md` (créé 2026-06-16)
- **Route TOP 10** : `GET /api/v1/tennis/top10?mode=viewer|bettor` (server.js:21628)
- **Fonction scoring** : `computeScoreTop10Tennis(e, mode)` (server.js:25549)
- **Cache variables** : `_tnTop10Cache`, `_tennisVBCache`, `_bsdTennisOddsCache`
- **Frontend poll** : `setInterval(fetchTennisTop10, 60_000)` (pariscore.js:4487)
