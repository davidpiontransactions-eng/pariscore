# Rapport PM — Améliorations & innovations à apporter à la sidebar multi-sports

Date : 2026-08-15 · Destinataire : Chef de projet · Rédigé à partir du benchmark comparatif des **5 meilleures plateformes de prédictions & paris** (Bet365, 1xBet, Flashscore, Sofascore, PredictZ/Forebet) par une équipe de 5 experts (ingénieur frontend data, ingénieur serveur, webdesigner, marketeur, expert paris sportifs).

> Objet : éclairer les **améliorations** et **innovations** à apporter à la sidebar 1xBet de PariScore (`src/components/layout/sports-sidebar.tsx` + agrégateur `use-sports-tree.ts` + tree `sports-tree.ts`) **avant implémentation**.

---

## 1. Contexte & méthode

- **État actuel** : sidebar type 1xBet livrée et déployée (5 blocs : recherche, pills horaires, favoris épinglés, arborescence Sport→Pays→Ligue→Matchs, toggle Live/Line ; persistance URL `?sport=&league=&time=&q=&view=`, store Zustand, agrégation SWR des 10 sports).
- **Informations qualité déjà décidées** : la QA (`.context/pm/qa-sidebar-bugs.md`) + corrections code reviewer (`.context/pm/sidebar-end-of-mission-report.md`) ont traité les bugs **fonctionnels**. Ce rapport porte sur les **évolutions produit** (pas les bugs).
- **Lecture** : chaque recommandation est priorisée **P0** (désirable si possible pour un 1er lot), **P1** (prochain lot), **P2** (backlog). Les recettes idées venant de plusieurs experts sont fusionnées.

---

## 2. Verdict exécutif

Le point fort actuel de PariScore est **déjà en avance** : persistance/URL partageable, agrégation single-call, modélisation `degraded`, tri par volume. 

**Le vrai gap stratégique (récurrent chez 4/5 experts)** : la sidebar est un **filtre géographique seul** — aucun **signal prédictif/valeur** au niveau ligue ni match, pas de cotes cliquables, pas de navigation « prediction-first ». Concrètement, un pronostiqueur doit faire 4 clics (Sport→Pays→Ligue→Match) sans jamais voir une valeur/probabilité/confiance dans le panneau.

**Direction recommandée** : transformer le filtre en **surface « ligne de pari + signaux de confiance »** (comme 1xBet/Forebet), tout en le rendant **personnel & monétisable** (favoris sync, provenance) et **conforme** (prédiction ≠ garantie, ANJ). Ceci maximise à la fois l'audience (SEO + onboarding) et l'innovation (calibrage du modèle affiché = différenciateur que ni Bet365 ni 1xBet ne peuvent revendiquer).

---

## 3. Roadmap consolidée (priorités)

### 🟥 P0 — premier lot (impact le plus fort)

| # | Domaine | Recommandation | Impact | Effort | Source(s) |
|---|---|---|---|---|---|
| P0-1 | **Cotes & quick-bet** | Dans `MatchRow` (niveau 4) : afficher 3 mini-boutons cotes **1/N/2 cliquables** + meilleure cote bookmaker **surlignée** + micro-flèche de tendance (↑/↗/↘). Transforme l'arbre en **vraie ligne de pari** (pattern 1xBet/Bet365/Sofascore). | Très fort | M | frontend data + expert paris |
| P0-2 | **Signaux prédictifs/edge** | Enrichir `LeagueNode` : `avgValue`, `fiabilité/calibrage`, `modelConfidence` (de-vig `1/odd` normalisée vs `homeProb`). Afficher un badge **edge moyen (%) par ligue** (pattern Forebet). Le calcul `edge` existe déjà coté grille → le remonter dans l'arbre. | Très fort | M | frontend data + expert paris |
| P0-3 | **Quick-links « Prédictions »** | 1-2 rangées de raccourcis **pre-médiés** en tête de panneau (Top matchs du jour, Value bets, Live, Top paris) sur un bloc **plat** (sans arbre) ; profondeur 4→1 (pattern Forebet/PredictZ). | Fort | M | frontend data |
| P0-4 | **Favoris account-bound** | Migrer `favoriteLeagueIds` vers le **backend (Prisma)** + merge au login → **sync multi-appareils** + épinglage (rang) dans le filtre. Débloque reco + notifications « vos ligues ». | Fort | L | frontend data + marketeur |
| P0-5 | **Monétisation contextuelle** | Plage bannière **contextuelle** (bas du panneau) ciblée par ligue via `?league=` + rubrique « pronostics partenaires » (affiliation bookmaker cliquable, label **« parrainé »**). | Fort | Faible | marketeur |
| P0-6 | **Landing SEO + og:image** | Landing par championnat/top-match (titre+meta+og:image par sport) + bouton **« partager ce filtre »** (copie URL complète). SEO prévisiteur presque gratuit. | Fort | M | marketeur |
| P0-7 | **Conformité / jeu responsable** | Bandeau « prédictions, pas une garantie » + lien **joueurs-exclusifs.fr / ANJ** + retirer tout lexique de garantie ; garder le générateur de combiné en **documentation** (pas d'incitation à miser). Avantage confiance + requis France si cotes affichées. | Fort | Faible | expert paris |
| P0-8 | **Onboarding par sport favori** | Flow 3 étapes (sport favori → ligues → notifications) qui **remplit la sidebar** dès la 1ère visite. | Fort | Faible | marketeur |
| P0-9 | **a11y hiérarchie** | `aria-hidden` sur fallback drapeau + `aria-label` « Élargir/Reducer {pays} » sur chevrons (éviter lecture triple) ; connecteurs d'arbre (grille 6/8/12px) ; chemin actif propagé sport→pays→ligue. | Élevé (SNR) | Faible–M | webdesigner |

### 🟧 P1 — second lot

| # | Domaine | Recommandation | Impact | Effort | Source(s) |
|---|---|---|---|---|---|
| P1-1 | **Temporisation serveur** | Route BFF **`GET /api/v1/sports-tree`** agrégée serveur + cache SWR + `Cache-Control` ; le client passe de 10 requêtes non-cacheables à **1 requête cacheable** (TTI + réduction bruit). | Fort | M | ingénieur serveur |
| P1-2 | **Cache-last-known + offline** | Servir le **dernier état** avec `Age`+`degraded` même si toutes les sources tombent ; service-worker cache la dernière réponse `sports-tree` (offline au boot). | Fort | Faible–M | ingénieur serveur |
| P1-3 | **Déploiement : health bloquant + rollback** | Health-check « warn » → **bloquant** + **rollback auto** vers commit précédent (`git reset --hard $PREV` + rebuild) + `exit 1` (le garde-fou `server.js` existe déjà). | Fort | Faible | ingénieur serveur |
| P1-4 | **Filtre combiné « signal »** | Toggle **« seulement avec pronostic / value>X »** (et croiser temps + championnat + signal), en plus des pills horaires. | Moyen | S | frontend data + expert paris |
| P1-5 | **Badge probabilité/confiance + tri par edge** | Badge % + shading valeur dans le panneau ; **tri de l'arbre par edge décroissant** (toggle) — première compétition = la plus avantageuse. | Moyen–Fort | M | expert paris + frontend data |
| P1-6 | **Filtre par type de marché** | Second axe pour naviguer par **marché (1X2, Over/Under 2.5, BTTS, double chance, Handicap)** en plus du championnat (pattern Bet365/PredictZ). | Fort | Élevé | expert paris |
| P1-7 | **Temps réel : SSE delta live** | SSE sur les écrans **live uniquement** (deltas scores/cotes), *baseline* polling 5 min conservé (coût borné). | Fort | L | ingénieur serveur |
| P1-8 | **Confiance : calibrage affiché** | **Gauge de calibrage par sport** au niveau `SportNode` (« Football : 58 % exacts / 120 tirages ») + badges « tendance » par ligue — différenciateur défendable (personne ne montre son calibrage). | Moyen–Fort | M | marketeur + expert paris |
| P1-9 | **Mobile : swipe + bottom-tab / FAB** | Activer swipe-to-close du Sheet + safe-area (`env(...)`) ; passer le trigger en **bottom-tab / FAB dédié** (pattern Sofascore) plutôt que hamburger du header auto-hide. | Moyen | M | webdesigner |
| P1-10 | **Skeleton 5 blocs** | Remplacer le faux état vide (`emptyTree`) par un **skeleton 5 blocs** pendant le premier chargement (perception perf). | Élevé | Moyen | webdesigner |
| P1-11 | **Signaux de confiance par ligue** | Taux de réussite par ligue + curation « populaire dans votre région » (géoloc IP) en section dédiée. | Moyen | M | marketeur |

### 🟨 P2 — backlog / exploration

| # | Domaine | Recommandation | Impact | Effort | Source(s) |
|---|---|---|---|---|---|
| P2-1 | Micro-interactions | Expand/collapse animé (`grid-rows 0fr→1fr`, respect `prefers-reduced-motion`) ; accoradjustement contraste AA (slate-400/500→ clair, badges ≥11px). | Moyen | M | webdesigner |
| P2-2 | Mobile | Recherche vocale (Web Speech API) sur `SearchBar` ; persistance scroll du drawer. | Faible | S | webdesigner + frontend data |
| P2-3 | Innovation | Sparklines de forme (mini W/D/L) dans les ligues favorites + **drag-to-pin** favoris ; chip combinée `[temps][championnat]`. | Prometteur | Élevé | webdesigner |
| P2-4 | Fidélisation | Onglet « Continuer où vous étiez » + historique récent ; notifications « vos ligues » (web-push existant). | Moyen | M | marketeur |
| P2-5 | Freemium | X favoris épinglés gratuits, illimité premium (abonnement) — tracking clic affiliation par ligue. | Moyen | M | marketeur |
| P2-6 | Serveur | Déploiement `releases/` + symlink (zero-downtime) ; ETL cotes en cron → snapshot détaché. | Moyen | Moyen | ingénieur serveur |
| P2-7 | Données dégradées | Généraliser `degraded` à tous les sports + champ `age`/`source` dans la réponse. | Faible | S | ingénieur serveur |

---

## 4. Ordre d'implémentation proposé (phases)

1. **Phase A (P0 fonctionnel/signal)** : P0-1 cotes, P0-2 edge par ligue, P0-3 quick-links prédictions. → La sidebar devient une vraie « ligne de pari ».
2. **Phase B (fondations)*strategy* : P0-9 a11y, P1-1 BFF, P1-2 cache-last-known, P1-3 deploy rollback. → robustesse + perf + accessibilité.
3. **Phase C (audience/money)** : P0-4 favoris sync, P0-5 monétisation, P0-6 SEO, P0-8 onboarding.
4. **Phase D (confiance/conformité)** : P0-7 jeu responsable, P1-8 calibrage, P1-11 tendance régionale.
5. **Phase E (temps réel & marchés)** : P1-7 SSE live, P1-6 filtre par marché, puis backlog P2.

**Pré-requis transverses** : (a) décision compte utilisateur + backend Prisma (bloque P0-4, P2-4) ; (b) décision monétisation/affiliation bookmaker (bloque P0-5, P2-5) ; (c) validation visuelle par un référent produit (P0-7 couleurs/texte responsable) ; (d) budget VPS pour SSE/cache (P1-7).

---

## 5. Récap CSV

```
Priorité,Domaine,Recommandation,Impact,Effort
P0,Cotes Et Quick-Bet,Cotes 1/N/2 cliquables + meilleure cote surlignée + tendance,Très fort,M
P0,Signaux Prédictifs,Edge moyen + fiabilité par ligue (de-vig),Très fort,M
P0,Navigation,Quick-links Prédictions flat (profondeur 4→1),Fort,M
P0,Persistance,Favoris account-bound + épinglage (sync multi-device),Fort,L
P0,Monétisation,Bannière contextuelle + affiliation par ligue (`?league=`),Fort,Faible
P0,Acquisition,Landing SEO + og:image par sport + partage de filtre,Fort,M
P0,Conformité,"Bandeau prédiction≠garantie + ANJ/joueurs-exclusifs",Fort,Faible
P0,Onboarding,Flow 3 étapes sport→ligues→notifs,Fort,Faible
P0,A11y,aria-hidden fallback + labels expand + connecteurs + chemin actif,Élevé,Faible
P1,Serving,BFF /api/v1/sports-tree agrégé serveur + cache HTTP,Fort,M
P1,Résilience,Cache-last-known + SW offline panneau,Fort,Faible
P1,Déploiement,Health bloquant + rollback auto $PREV,Fort,Faible
P1,Filtres,Toggle seulement-avec-pronostic/value>X,Élevé,Faible
P1,Signaux,Badge probabilité + tri arbre par edge,Moyen,Faible
P1,Marchés,Filtre par type de marché (1X2/O/U/BTTS/2CH),Fort,Élevé
P1,Temps réel,SSE delta live (baseline polling conservé),Fort,L
P1,Confiance,Calibrage par sport + badges tendance,Moyen,Faible
P1,Mobile,Swipe-to-close + safe-area + bottom-tab/FAB,Moyen,M
P1,Perception,Skeleton 5 blocs,Moyen,M
P1,Audience,Popular dans votre région,Moyen,M
P2,Micro,Expand animé + contraste AA,Moyen,M
P2,Mobile,Recherche vocale + scroll drawer,Faible,S
P2,Innovation,Sparklines forme + drag-to-pin + chip temps+championnat,Prometteur,Élevé
P2,Fidélisation,Continuer où vous étiez + notifs vos ligues,Moyen,M
P2,Freemium,X favoris gratuits → illimité premium,Moyen,M
P2,Serveur,Deploiement releases/ symlink + ETL cotes cron,Moyen,M
P2,Dégradé,Généraliser degraded + age/source,Faible,S
```

---

## 6. Verdict PM (synthèse 5 lignes)

1. **Priorité stratégique** : apporter les **signaux de valeur** (edge/cotes/confiance) dans le filtre — c'est ce que ni un simple bookmaker ni un comparateur ne fait lisiblement (P0-1/P0-2).
2. **Différenciateur défendable** : afficher le **calibrage du modèle** par sport/ligue — preuve de confiance rare dans le secteur (P1-8).
3. **Audience** : l'URL de filtre existante est une **surface SEO gratuite** sous-exploitée → landing + partage (P0-6).
4. **Monétisation propre** : affiliation **contextuelle par ligue** plutôt que bannières génériques, avec label « parrainé » (P0-5).
5. **Non négociable** : conformité jeu responsable **dès que des cotes/pronostics sont affichés** (P0-7) — liée à la décision de monétisation.

> Diligence : ne **pas** lancer P1-6 (marchés) ni P1-7 (SSE) avant validation P0 ; P0-4 nécessite l'architecture compte. Validation visuelle produit requise sur P0-1 (densité) avant implémentation.

---

*Équipe : Ing. Frontend Data · Ing. Serveur · Webdesigner · Marketeur · Expert paris sportifs. Consolidé le 15/08/2026.*