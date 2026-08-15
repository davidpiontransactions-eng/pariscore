# Rapport de fin de mission — Corrections bugs sidebar multi-sports (1xBet)

Date : 2026-08-15 · Auteur : code reviewer senior · Contexte : `.context/pm/qa-sidebar-bugs.md` (QA post-déploiement `https://pariscore.fr`).

## Résumé

Les 4 bugs référencés par la QA ont été traités : **BUG-1** (garde-fou déploiement, cause de l'incident 502), **BUG-2** (bloc favoris toujours visible, prioritaire), **BUG-3** (nœud tennis trompeur en cas de 503), **BUG-4** (sémantique des compteurs documentée). Aucun commit/push effectué (contenu local uniquement, conformément aux consignes).

---

## Corrections par bug

### BUG-1 — `update_vps.sh` ne doit plus jamais conclure `VPS_DEPLOY_OK` sur un build cassé
**Priorité : critique (cause racine de l'incident prod 502).**

- **Fichier** : `scripts/update_vps.sh`
- **Fonction** : bloc `[4/6] Next.js build...`
- **Contenu du diff** : après `npm run build` (et après le garde `|| exit 1` existant), ajout d'un garde-fou :
  ```bash
  if [ ! -f .next/standalone/server.js ]; then
    echo "ERR: .next/standalone/server.js absent apres next build - deploy aborted"
    exit 1
  fi
  ```
- **Effet** : un `next build` qui réussit mais ne produit pas l'export standalone (le scénario exact de l'incident : `Module not found` + absence de `server.js` → pm2 crash-loop → 502) fait désormais **échouer le script (exit ≠ 0) avant le restart pm2**, donc avant les étapes `VPS_DEPLOY_OK` / « health OK ». Commentaire ajouté pour expliquer le pourquoi.
- **Contrainte respectée** : lignes ajoutées en **ASCII strict** (pas d'accent, pas d'em-dash).

### BUG-2 — Bloc « Favoris & top championnats » toujours visible (prioritaire)
**Priorité : haute (fonctionnalité specs §2.1 bloc 3 carrément absente).**

- **Fichiers** : `src/lib/sports-tree.ts` (catalogue) + `src/components/layout/sports-sidebar.tsx` (`FavoritesBlock`, `FavoriteStar`).
- **Contenu du diff** :
  - `sports-tree.ts` : nouvel export `DEFAULT_FAVORITE_LEAGUES` (catalogue statique détaché de la disponibilité des données) + helper pur `isDefaultFavoriteLeague(id)`. Ids au format `sport:slug-ligue` : `football:champions-league`, `football:premier-league`, `football:ligue-1`, `tennis:grand-slam`, `nba:nba`.
  - `sports-sidebar.tsx` :
    - suppression des patterns locaux `DEFAULT_FAVORITE_PATTERNS` / `isDefaultFavorite` (remplacés par le catalogue partagé — source de vérité unique) ;
    - `FavoritesBlock` : **plus de `return null`**. Résolution en 3 temps : (1) id exact dans l'arbre → (2) ligue par **nom+sport** dans l'arbre (car les ids API `football:42` diffèrent des ids catalogue) pour conserver le vrai compteur → (3) sinon **nœud synthétique** `{ id, name, sportId, matchCount: 0 }`. Si l'utilisateur a retiré tous ses favoris, on retombe sur le catalogue par défaut pour ne pas trouer la sidebar.
    - Clic sur un favori → `onLeagueSelect` existant : `selectLeague(id, sportId)` + bascule de l'onglet central (`onSportChange`). **Fallback** conforme : si la ligue n'est pas dans l'arbre (ex. tennis 503), le clic bascule quand même vers le **sport** de l'onglet via `league.sportId`.
    - `FavoriteStar` utilise désormais `isDefaultFavoriteLeague`.
- **Effet** : le bloc « Favoris » est **fixe et toujours visible** (5 étoiles + header), même sans données matchs (`0` affiché en compteur). Grand Slam / NBA visibles malgré endpoints tennis/NBA en erreur.

### BUG-3 — Tennis 503 → plus de « Tennis | 0 » trompeur
**Priorité : moyenne (incohérence sémantique + UX).**

- **Fichiers** : `src/types/sports-sidebar.ts`, `src/hooks/use-sports-tree.ts`, `src/components/layout/sports-sidebar.tsx`.
- **Contenu du diff** :
  - `types/sports-sidebar.ts` : ajout `degraded?: boolean` sur `SportNode` (idiomatique dans le repo — même concept utilisé par rugby/baseball).
  - `use-sports-tree.ts` (`loadTennis`) : sur échec de `/api/tennis/prematch`, retourne `{ ...emptySportNode("tennis"), degraded: true }` (plus un nœud vide muet). Commentaire : le fallback réel des matchs vit dans l'onglet (`usePrematchMatches`, cache→odds-api→mock) ; la sidebar ne prétend pas qu'il n'y a rien, elle signale l'indisponibilité.
  - `sports-sidebar.tsx` (`SportBlock`) : quand `sport.degraded && totalMatches === 0`, affiche un badge « indispo » (pastille ambre) + tooltip au lieu du compteur `0`.
- **Effet** : un 503 produit un signal visuel explicite, pas une donnée fausse. Note : le rapprochement *sidebar ↔ onglet* réel nécessiterait que l'onglet et l'agrégateur partagent le même état de dégradé — voir Backlog OBS-5.

### BUG-4 — Compteurs « matchs » incohérents entre sports
**Priorité : basse (documentation, pas de refactor risqué).**

- **Fichier** : `src/lib/sports-tree.ts` (`rugbyLeagues` / `rugbySportNode`).
- **Contenu du diff** : commentaire précisant que rugby = somme `upcomingCount` (« prochains matchs programmés », fenêtre future large) alors que football/baseball comptent les matchs de la fenêtre temporelle affichée ; `applyTimeFilter` ne filtre pas ces ligues (pas de détail de matchs) donc leur badge reste « à venir ». Une ligue rugby est donc naturellement plus grande. Choix : **documenter au lieu d'unifier**, pour ne pas casser un comportement délibéré.

---

## Vérifications effectuées

| Contrôle | Commande | Résultat |
|---|---|---|
| Types | `npx tsc --noEmit` | **Aucune erreur sur mes fichiers** (`sports-sidebar*`, `sports-tree`, `use-sports-tree`). Le repo a des erreurs TS pré-existantes hors périmètre (composants football, `tools/`, `scripts/tmp-*`) — non introduites par ce changement. |
| Lint | `npx eslint src/components/layout/sports-sidebar.tsx src/lib/sports-tree.ts src/hooks/use-sports-tree.ts src/types/sports-sidebar.ts` | **0 erreur, exit 0**. |
| Syntaxe script VPS | revue manuelle du bloc ajouté | Bloc simple et valide (`[ -f ... ]` + `exit 1`), ASCII strict. |

---

## Bugs laissés en backlog (avec justification)

- **OBS-5 — Agrégation N+1 serveur** (`/api/v1/sports-tree` centralisé) : sort du périmètre (refactor d'architecture), nécessite une décision produit/infra sur le coût VPS et le couplage. La tolérance `Promise.allSettled` actuelle est fonctionnellement correcte — c'est une optimisation de bruit/réseau.
- **OBS-6 — Bouton `ListFilter` dans `AutoHideHeader` (mobile)** : le drawer s'ouvre, mais le trigger peut disparaître au scroll. Nécessite une décision UX (bouton flottant dédié). Non bloquant pour les bugs critiques.
- **OBS-7 — Accent emerald vs bleu spec** : choix assumé (cohérence design system PariScore dark navy / vert néon). Attente validation **produit**, pas un bug.
- **BUG-3 (partiel) — Mise en cohérence sidebar ↔ onglet tennis en mode dégradé** : la sidebar signale désormais l'indisponibilité, mais l'onglet garde son propre état de chargement. Unification demanderait un état partagé (store dégradé) — à décider avec OBS-5.
- **Alignement TS global** : le repo compile avec ~50 erreurs TS hors périmètre (football, tools/, skyvern, scripts/tmp-*). La QA le mentionne (`football-round-groups.tsx`). À traiter séparément pour rétablir un `tsc --noEmit` **bloquant au déploiement** (recommandation BUG-1 #3).

---

## Note sur l'incident de prod

L'incident 502 (site entier crash-loop, 252 redémarrages) est documenté dans `.context/pm/qa-sidebar-bugs.md` (cause racine : `deploy.bat` committait un fichier tracké important 3 fichiers **untracked** → `tomber reset --hard origin/main` → `next build` cassé → `server.js` absent). L'analyse et la résolution d'urgence (`ac789e0c`) y sont détaillées. **La correction durable = le garde-fou BUG-1** ajouté ici : un build cassé ne peut plus conclure `VPS_DEPLOY_OK` / « health OK ». Correctif complémentaire recommandé côté `deploy.bat` : alerter si un fichier tracké importe des fichiers untracked, ou passer à un `git add -A` cohérent de `src/`.

---

## Reste à faire pour une QA de validation finale

1. **Déployer les corrections** (`deploy.bat` + `update_vps.sh` avec le nouveau garde-fou) et vérifier sur prod que le build standalone passe.
2. **Rejouer la QA Playwright** (`scripts/qa_sidebar_visual.py` / `qa_probe.py`) sur :
   - bloc « Favoris » visible desktop + mobile, 5 étoiles, clic → bascule d'onglet ;
   - badge « indispo » tennis quand `/api/tennis/prematch` renvoie 503 (simuler ou attendre la panne) ;
   - compteurs rugby vs football (cohérence visuelle documentée).
3. **Simuler un build cassé** (ex. casser une import) et confirmer que `update_vps.sh` sort en erreur (`ERR:` + exit ≠ 0) sans toucher à la prod ni conclure `VPS_DEPLOY_OK`.
4. **Backlog produit** : trancher OBS-7 (couleur) et OBS-6 (bouton drawer mobile flottant) ; prioriser OBS-5 si le bruit réseau gêne.
5. **Nettoyage TS** (hors périmètre) pour réactiver un `tsc --noEmit` bloquant au déploiement (recommandation BUG-1 #3).

**Estimation** : ~1 demi-journée de travail + 1 passage QA ciblé (rejouer la suite existante + les 3 cas de validation ci-dessus).