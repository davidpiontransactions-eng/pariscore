# Rapport QA — Sidebar multi-sports (1xBet) — bugs à corriger

Date: 2026-08-15 · Cible: `https://pariscore.fr` (déployée) · Méthode: Playwright E2E visuel (desktop 1440px + mobile 390px) + capture réseau HTTP + revue sur l'arbre réel.

**Contexte d'urgence** : la toute première QA a révélé un **incident de prod** (site en 502). Il a été traité en priorité (commit `ac789e0c`). La QA ci-dessous a été rejouée après restauration de la prod.

---

## 🔴 CRITIQUE — BUG-1 : Déploiement a mis la prod en 502 (incident, traité)

- **Symptôme** : après `deploy.bat` (commit `1811d701`), le site entier répond **502 Bad Gateway** (nginx → `127.0.0.1:3005` refusée). `pariscore-next` en **crash-loop** (252 redémarrages) : `Cannot find module .../.next/standalone/server.js`.
- **Cause racine** : `scripts/deploy.bat` fait `git add -u` (fichiers **trackés** uniquement) et commit `football-match-detail-dialog.tsx` (tracké, modifié pré-session) **qui importe 3 fichiers untracked** : `src/components/football/live-stats-breakdown.tsx`, `src/components/football/pressure-duo-donuts.tsx`, `src/lib/football-live-thresholds.ts`. Sur le VPS, `update_vps.sh` fait `git reset --hard origin/main` → ces 3 fichiers absents → `next build` échoue `Module not found` → l'étape standalone ne produit **pas** `.next/standalone/server.js` → pm2 crash.
- **En plus** : `update_vps.sh` a quand même affiché `VPS_DEPLOY_OK` et « health OK » **malgré le build cassé** → le déploiement ne détecte pas un build défaillant.
- **Résolution** : commit `ac789e0c` (ajout des 3 fichiers manquants + `src/app/api/v1/basketball/*`, `src/lib/types/`) + redéploiement `--no-commit`. `pariscore-next` online, health OK, site rétabli.
- **À corriger pour éviter récidive** :
  1. `update_vps.sh` : **stopper (exit ≠ 0) et marquer `ERR:` si `next build` échoue** ET si `.next/standalone/server.js` est absent après build. Ne jamais conclure VPS_DEPLOY_OK tant que la prod ne répond pas.
  2. `scripts/deploy.bat`/workflow : alerter quand un fichier **tracké** importe des fichiers **untracked** (check `git ls-files` des deps avant push), ou passer à `git add -A` **de `src/`** de façon cohérente.
  3. Imposer `npx tsc --noEmit` **échouant le déploiement** (zéro erreur) — le repo avait des erreurs dont `football-round-groups.tsx` etc.

---

## 🟠 BUG-2 : Bloc « Favoris & top championnats » jamais affiché

- **Symptôme** : aucun header « Favoris », aucune étoile (`polygon` SVG = 0) dans l'aside, sur desktop et mobile.
- **Cause** : `FavoritesBlock` (sports-sidebar.tsx) renvoie `null` tant que `favorites.length === 0`. Les favoris par défaut (Champions League, Premier League, Ligue 1, **Grand Slam**, **NBA**) sont résolus **depuis l'arbre chargé** ; or tennis=0 (503) et NBA/MMA/WNBA=0 → GS et NBA introuvables → bloc vide masqué.
- **Attendu (spec §2.1 bloc 3)** : bloc **fixe, toujours visible**, avec ces 5 ligues épinglées même si leurs données de match sont dégradées.
- **Piste de correctif** : résoudre les favoris par défaut indépendamment de la disponibilité des endpoints (catalogue statique des top ligues) plutôt que depuis le seul arbre chargé ; ou au minimum ne pas masquer le bloc quand un fallback existe.

## 🟠 BUG-3 : `/api/tennis/prematch` → 503, nœud Tennis silencieusement vide

- **Symptôme** : `useSportsTree` → l'appel `/api/tennis/prematch` renvoie **503** ; le nœud Tennis de la sidebar affiche `Tennis | 0` (aucun match, aucun tournoi).
- **Cause** : l'agrégateur (`src/hooks/use-sports-tree.ts`, `loadTennis`) n'a **pas de fallback** alors que `usePrematchMatches` (l'API existante de l'onglet tennis) en a un (cache → odds-api → mock). Résultat : mismatch entre l'onglet (qui montre des matchs) et la sidebar (vide).
- **Piste de correctif** : réutiliser le même chemin de fallback que `usePrematchMatches` dans `loadTennis()`, et de manière générale **dégradé → indéterministe** : afficher un état « données indisponibles » plutôt qu'un 0 trompeur.

## 🟠 BUG-4 : Compteurs « matchs » incohérents entre sports

- **Symptôme** : Rugby affiche **320**, Football 129, Baseball 31, F1 23, CS2 17… L'ordre de grandeur Rugby > 2× Football est suspect.
- **Cause** : rugby = somme de `upcomingCount` (fenêtre future large « à venir ») alors que football/baseball = matchs du jour/limites de fenêtre. Deux sémantiques de badge différentes.
- **Piste de correctif** : unifier la définition d'un « match disponible » pour les badges (même fenêtre temporelle partout) et documenter le sens de chaque compteur dans le tooltip (ex. rugby = prochains matchs programmés).

## 🟡 OBS-5 : Requêtes d'agrégation multiples en erreur au chargement

- 10+ endpoints appelés au montage ; avec les endpoints en panne, on observe des 4xx/5xx en console à chaque render (bruit + latence). On-dema reverser `Promise.allSettled` → tolérant (bon) mais chaque erreur fait du bruit réseau.
- **Piste** : graReplace les sond foires en un seul agrégat serveur (`/api/v1/sports-tree`) côté VPS pour limiter le N+1 et centraliser les fallbacks.

## 🟡 OBS-6 : Responsive / ergonomie header

- Le drawer mobile **s'ouvre** (pass), mais le bouton `ListFilter` est dans le header **AutoHideHeader** (masqué au scroll) avec `lg:hidden` ; sur mobile, risquer de perdre l'accès au drawer pendant le scroll. À vérifier : bouton flottant dédié (hors header) comme le propose la spec.

## 🟡 OBS-7 (choix assumé — pas un bug)

- Accent **emerald** pour l'état actif (au lieu du bleu de la spec) pour rester cohérent avec le design system PariScore (dark navy + vert néon). Validation produit souhaitée.

---

## Méthode / artéfacts

- Script QA : `scripts/qa_sidebar_visual.py`, `scripts/qa_probe.py`, `scripts/qa_diag.py`.
- Rapport machine : `scripts/qa_sidebar_report.json`.
- Captures : `scripts/qa_sidebar_desktop_full.png`, `scripts/qa_sidebar_desktop_open.png`, `scripts/qa_sidebar_mobile.png`.
- Chemin de reproduction : ouvrir `https://pariscore.fr` (viewport 1440x900) → sidebar présente, 5 blocs repérés, rechercher « liga » (La Liga non remonté), bloquer favoris vide, endpoint tennis 503.