---
description: Éval GO/NO-GO d'un repo modèle externe (tennis/foot/ML) vs PariScore. Usage: /eval-repo <github-url>
argument-hint: <github-url>
---

Tu es le GM/CTO PariScore. Évalue le repo externe ci-dessous pour décider s'il vaut le coup de l'incorporer.

**Repo cible : $ARGUMENTS**

## Étapes (autonome, pas de question avant le rapport)

1. **Fetch** le repo via WebFetch : README + fichier modèle principal (`.ipynb`/`.py`/`.js`). Cible les raw URLs `raw.githubusercontent.com/<owner>/<repo>/<main|master>/<file>`.
2. **Extrais (cite verbatim)** :
   - Modèle/algo exact (archi, layers, loss, optimizer, hyperparams)
   - Features/inputs (liste complète) + target
   - Données (source, taille, format, licence)
   - Métriques reportées (accuracy, Brier, ROI, calibration)
   - Stack/deps + licence repo
3. **Analyse avantages vs PariScore** — table critères :
   - Edge marché réel (bat-il la cote, ou la consomme-t-il en feature ? → circulaire = pas d'edge)
   - Calibration/UQD (IC, Brier, reliability — règle CLAUDE.md : pas de prod sans IC)
   - Redondance vs existant (Elo dynamique, Klaassen-Magnus SPW/RPW, Poisson bivarié, bayesianBlend, bootstrap UQD)
   - Features inédites vs déjà dans `buildMatchRecord`
   - Compat stack (PariScore = Node zero-dep sauf better-sqlite3 ; Python/TF = sidecar VPS coûteux)
   - Leçons passées (age/hand features = NO-GO, edge absorbé par Elo)
4. **Recommandation GM** : GO / NO-GO / GO-partiel (ex: garder juste le dataset pour backtest). Justifier en 3 points. Estimer effort.
5. **Écris rapport** `.context/eval-repo-<slug>-<YYYY-MM-DD>.md` (slug = nom repo). Termine par "Attente : ton GO/NO-GO".
6. **STOP. Attends GO explicite utilisateur** avant tout code (workflow BSD §8 CLAUDE.md). Sur GO → ouvre bd ticket + implémente.

## Contraintes
- Cote bookmaker EN ENTRÉE du modèle = signal d'alerte fort (modèle circulaire, pas d'edge value bet).
- Vérifie licence (MIT/Apache OK ; CC-NC/GPL = flag legal, cf. leçon TML-Database).
- Pas de question avant le rapport — analyse autonome puis attente du verdict.
