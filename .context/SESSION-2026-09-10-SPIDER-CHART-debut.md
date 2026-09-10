# Session SPIDER-CHART — début de mission
Réf : `SESSION-2026-09-10-SPIDER-CHART`
Date : 2026-09-10 · Demandeur : David

## Mission
1. Recherche web : écrits académiques/scientifiques sur les spider/radar charts au tennis → compilation des données.
2. Proposition d'un spider chart tennis "waouh" pour les popups prematch, basé sur :
   - https://tenngrand.com/tennis-statistics-explained-a-beginners-guide-to-reading-advanced-match-data/
   - https://tenngrand.com/wp-content/uploads/2026/01/image-1.png
3. Implémentation + QA + traçabilité de fin (`.context/SESSION-2026-09-10-SPIDER-CHART-trace.md`).

## Gantt (1 tâche = 1 skill)
| # | Tâche | Skill | État | Vérif |
|---|-------|-------|------|-------|
| T1 | Recherche académique spider/radar tennis | agent-reach (web Exa + Jina) | done | §résultat ci-dessous |
| T2 | Lecture guide tenngrand + analyse image | agent-reach (web) | bloqué | CAPTCHA tenngrand (article + image inaccessibles) |
| T3 | Spec design spider (metrics, normalisation, wow) | ui-ux-pro-max | done | 6 axes PowerScore, recharts, dégradés + badge duel |
| T4 | Implémentation composant radar tennis | (build) | done | tennis-radar-chart.tsx, tsc+eslint 0 |
| T5 | Câblage popup prematch (MatchDetailDialog) | (build) | done | après PlayerVsBlock, hors synthétiques |
| T6 | QA visuelle + fonctionnelle (Playwright prod ou local) | web-design-guidelines | pending | screenshots + 0 erreur |
| T7 | Trace de fin + commit/push (+deploy sur ordre) | (build) | pending | trace .md |
| T8 | Heatmap 2×6 popup + US Open dames Top10/PowerScore (Pegula, Gauff, Rybakina) | (build) | done | tennis-heatmap.tsx, greffe elo-data |

## T1 — Compilation recherche (résumé)
- Serve = facteur n°1 des swings (GBDT Kappa 0.96 ; Liu et al. 2025) ; retour = 2e (PMC 2022 : % retours gagnés ↔ victoire).
- Points courts 0-4 décisifs à Wimbledon, homogènes H/F (Fitzpatrick) ; 1ère balle arme tactique (Antoun).
- Surface et momentum généralisables (Wimbledon → RG/AO) ; modèles XGBoost/CatBoost > 0.96.
- Données de référence : Tennis Abstract MCP (serve/return/rally/tactics, 52 sem.).
→ Justifie les 6 axes : Service, Retour, Forme, Élo surface, SPS, Fraîcheur.

## Règles
- Simplicité : réutiliser `football-radar-chart` si adaptable, sinon composant tennis dédié.
- Données : uniquement signaux existants (Élo, forme, service, retour, SPS, fatigue, H2H) — pas de signaux fabriqués.
- Gates : `tsc` 0, `eslint` 0, tests verts si moteur touché.
