# Backlog : Corners Tab Overhaul v12.72

**Projet** : PariScore — Refonte onglet Corners  
**Date de création** : 2026-06-10  
**Porteur** : CTO/Lead Data Scientist  

---

## TODO

| # | Description | Priorité | Estimation |
|---|-------------|----------|------------|
| 1 | Créer le script ETL seed_historique_bsd_corners.js pour charger 3 saisons de données corners depuis l'API BSD | HIGH | 4h |
| 2 | Créer la table SQLite corner_history dans server.js avec la structure adaptée au stockage de l'historique des corners sur 3 saisons | HIGH | 2h |
| 3 | Modifier la fonction fetchBSDTeamCornerHistory pour utiliser les données locales de la table corner_history au lieu d'interroger systématiquement l'API BSD | HIGH | 3h |
| 4 | Développer la nouvelle fonction fetchBSDCornerOdds(bsdEventId) pour récupérer les cotes corners depuis l'API BSD avec implémentation du fallback vers la cote théorique IA | HIGH | 3h |
| 5 | Intégrer fetchBSDCornerOdds dans handleCornersRoute pour enrichir l'objet pred.odds avec les cotes pour chaque seuil (6.5, 7.5, 8.5, 9.5, 10.5) | HIGH | 2h |
| 6 | Restructurer la fonction buildCornersTab dans pariscore.js pour afficher la colonne Odds avec le nouveau layout : Label Over + Barre progression + Badge Odds orange + Pourcentage | HIGH | 4h |
| 7 | Refonte CSS complète de toutes les classes .cr-* avec le design dark immersif (linear-gradient #1a2548 / #111a36 pour .cr-rec-card, #0f2d1f pour .cr-rec-yes) | HIGH | 3h |
| 8 | Créer le fichier plan.md documentant l'architecture technique et les décisions de conception | MED | 1h |
| 9 | Créer le fichier backlog.md listant toutes les tâches avec priorités et statut | MED | 1h |
| 10 | Mettre à jour CLAUDE.md avec la roadmap v12.72 et les nouvelles fonctionnalités implémentées | MED | 1h |
| 11 | Valider l'intégration complète en environnement de staging avec tests de tous les flux de données | HIGH | 3h |
| 12 | Commit et push vers le repository Git avec message structuré documentant les modifications | HIGH | 30min |

---

## IN PROGRESS

| # | Description | Début | Avancement |
|---|-------------|-------|------------|
| 7 | Créer le fichier plan.md (ce document) | 2026-06-10 | 100% |
| 8 | Créer le fichier backlog.md | 2026-06-10 | En cours |

---

## DONE

| # | Description | Date |
|---|-------------|------|
| - | Audit backend complet réalisé par gsd-code-fixer — aucun bug trouvé dans fetchBSDTeamCornerHistory, predictCorners, et handleCornersRoute | 2026-06-10 |
| - | Audit CSS réalisé par gsd-ui-auditor — problème identifié : classes .cr-rec-card avec background blanc détruisant la charte dark | 2026-06-10 |
| - | Recherche frontend réalisée par gsd-ui-researcher — nouvelle structure visuelle pour buildCornersTab avec colonne Odds | 2026-06-10 |
| - | Décision architecturale : création script ETL seed_historique_bsd_corners.js car aucune source corners 3 saisons n'existe | 2026-06-10 |

---

## Notes techniques

### Estimation totale du projet : 28h30

### Dépendances entre tâches

Les tâches 1, 2 et 3 sont dépendantes entre elles et doivent être réalisées dans l'ordre. La tâche 1 (script ETL) nourrit la tâche 2 (table SQLite) qui nourrit la tâche 3 (modification fetchBSDTeamCornerHistory).

Les tâches 4 et 5 sont indépendantes et peuvent être réalisées en parallèle avec les tâches 1-3.

Les tâches 6 et 7 peuvent commencer dès que les tâches 4 et 5 sont terminées.

La tâche 11 (validation staging) doit être réalisée avant le commit final (tâche 12).

### Critères de validation

- Toutes les fonctions fetchBSD retournent des données non nulles pour les matches de test
- Le design dark est cohérent visuellement avec le reste de l'application PariScore
- Les cotes BSD sont affichées quand disponibles, le fallback théorique quand indisponible
- Le script ETL charge successfully 3 saisons de données sans timeout
- Les tests de staging passent avec un taux de succès de 100%