# Backlog : Sprint Refonte UI Tennis v12.81

**Projet** : PariScore — Refonte UI/UX onglet Tennis  
**Date de création** : 2026-06-15  
**Porteur** : CTO/Lead Data Scientist  

---

## TODO

| # | Description | Priorité | Estimation |
|---|-------------|----------|------------|
| 1 | Appliquer le fond global `#0e1420` à `#page-tennis` et tous les conteneurs tn2-* | HIGH | 30min |
| 2 | Changer le fond des cartes matchs/KPI de `#182030` à `#172132` avec ombre portée | HIGH | 30min |
| 3 | Appliquer `#111a28` aux en-têtes de section, tableaux et zones imbriquées | HIGH | 30min |
| 4 | Créer la nouvelle classe `.tennis-odds-box-premium` avec hover bleu `#0077ff` | HIGH | 45min |
| 5 | Créer les classes `.tennis-match-card-premium` et `.tennis-grid-header` | HIGH | 30min |
| 6 | Normaliser les bordures en `1px solid rgba(255,255,255,0.05)` sur tous les composants tn2 | MED | 30min |
| 7 | Ajouter l'effet de survol subtil `rgba(255,255,255,0.02)` sur les cartes | MED | 20min |
| 8 | Remplacer l'accent vert des onglets sélectionnés par le bleu `#0077ff` sur les tab-btn actifs | MED | 15min |
| 9 | Ajuster la typographie : Inter/Roboto, font-weight 700 titres, 500 secondaire, tailles 11-12px métriques | LOW | 30min |
| 10 | Ajouter les design tokens CSS en variables `--tennis-bg`, `--tennis-card`, `--tennis-nested`, `--tennis-accent-blue` | MED | 20min |
| 11 | Tester la régressions thème clair (body[data-cf-light="1"]) pour chaque modification | HIGH | 45min |
| 12 | Mettre à jour plan.md, backlog.md et CLAUDE.md avec la roadmap v12.81 | MED | 20min |
| 13 | Commit et push avec message structuré | HIGH | 15min |
| 14 | Fix crash layout Tennis — supprimer all:initial + margin:0 auto sur .tn2-main | CRITICAL | 30min |

---

## IN PROGRESS

| # | Description | Début | Avancement |
|---|-------------|-------|------------|
| - | (rien) | - | - |

| 15 | Pipeline photos athlètes — remplacer initiales par <img> dans les cartes Live Tennis | HIGH | 1h |

---

## DONE

| # | Description | Date |
|---|-------------|------|
| - | Diagnostic complet du système CSS tn2 existant — mapping des classes tn2 vers les nouveaux tokens | 2026-06-15 |
| - | Analyse du HTML de page-tennis (sidebar, KPI, tabs, panels, modals, legacy sections) | 2026-06-15 |
| - | Spécification des design tokens issue de l'image de référence "image_ad30a6.jpg" | 2026-06-15 |

---

## Notes techniques

### Estimation totale du projet : 6h30

### Dépendances entre tâches

Les tâches 1, 2, 3 sont la base et doivent précéder les autres. Les tâches 4-10 peuvent être réalisées en parallèle. La tâche 11 (test régressions) doit être faite APRÈS toutes les modifications. La tâche 12 ferme la boucle documentation.

### Critères de validation

- Le fond global est `#0e1420` (vérifié à l'inspection)
- Les cartes utilisent `#172132` avec ombre
- Les en-têtes utilisent `#111a28`
- Les odds badges ont le hover bleu `#0077ff`
- Aucune régression sur le thème clair
- Les bordures sont semi-transparentes fines
