# 📋 Tâches en cours — Session Tennis Prematch (15/07/2025)

> État en fin de session. **Tout le backend/data est livré en prod.**
> Seule la **refonte UI** reste à faire demain.

## ✅ TERMINÉ (ne pas retoucher)

- [x] P1 Diagnostic : cause racine = `resolveTennisSurfaceSync` échouait (Nordea Open) → Elo —
- [x] P2 Data : cron SPS réparé + backfill (11032 rows) + pm2 `pariscore-cron-sps`
- [x] P3 Backend : `_getPlayerRank` fallback winner_rank + Elo Surface fallback ALL
- [x] P4 Frontend : premierCard affiche les 6 métriques (basique, à refondre)
- [x] P5 Validation : 6/6 métriques confirmées sur pariscore.fr via Playwright
- [x] Brainstorming multi-expertise : spec + Gantt livrés

## 🔴 À FAIRE DEMAIN

### Tâche principale : Refonte UI statline 6 métriques
- [ ] **Décider le design** (3 options dans le HANDOFF, §"Les 3 options de design")
- [ ] **Corriger 3 bugs UI** :
  - [ ] B1 : `.sc-premier-surfrank` 15px blanc → 9px pill tennis-yellow
  - [ ] B2 : `.sc-premier-prank` `#475569` → `var(--text2)` `#94a3b8`
  - [ ] B3 : restaurer `.sc-premier-pelo` ou style `--text3` pour Elo
- [ ] **Appliquer `var(--font-mono)`** aux valeurs numériques (Elo, SPS, rank)
- [ ] **Tester** : `node scripts/validate-css-conventions.js` + Playwright
- [ ] **Déployer** : commit + push + ssh VPS + pm2 restart pariscore

### Tâches secondaires (optionnel)
- [ ] Installer package `gantt_chart_skill` pour rendu SVG (actuel = ASCII)
- [ ] Finaliser câblage Graphify auto sur ZCode (binaire hors PATH)
- [ ] Valider visuellement avec l'utilisateur (il n'a pas encore confirmé le rendu)

## 📖 CONTEXTES À LIRE DEMAIN (par ordre d'importance)

1. **`docs/superpowers/specs/2026-07-15-HANDOFF-reprise-demain.md`** — le fichier maître
2. **`DESIGN_CHARTER.md`** — la charte à respecter
3. **`pariscore.html` L25299-25341** (CSS) + **L26045-26133** (template premierCard)
