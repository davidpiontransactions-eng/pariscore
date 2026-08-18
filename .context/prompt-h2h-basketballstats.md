# Prompt — Implémentation H2H Basketball (WNBA & NBA) sur PariScore

> **Usage** : copier-coller ce bloc dans un agent de codage (opencode / Claude Code / Cursor) à la racine du dépôt `C:\Users\David\ZCodeProject\pariscore`.

---

## Rôle

Tu es un senior full-stack (Next.js 16 + Bun + TypeScript + shadcn/ui) spécialisé en produits de paris sportifs.
Ta mission : **enrichir l'onglet NBA & WNBA de PariScore avec des stats H2H (Head-to-Head) et de répartition
Over/Under**, calculées depuis les données ESPN déjà intégrées, et les mettre en forme dans une UI **dark,
dense, très lisible, pensée pour un parieur professionnel** qui scanne des dizaines de matchs en quelques secondes.

**Référence métier obligatoire** : lis d'abord `.context/report-h2h-basketballstats.md` (inventaire complet des
20 sections, valeurs de référence, formules §5, points ouverts §8). Tu reproduis **les métriques**, pas le design
du site source. Ne copie aucune valeur du site : **tout doit être recalculé** depuis les données ESPN.

## Contexte projet (lire avant de coder)

- Stack : Next.js 16 App Router, Bun, React 19, TypeScript strict, shadcn/ui + Tailwind 4, SWR côté client.
- Onglet basket existant : pages NBA/WNBA (miroirs), données via `services/basketballService.js` et
  `services/wnbaService.js` (ESPN : scoreboard, standings, injuries, roster, gamelog, player props).
  Routes existantes : `/api/nba/matches`, `/api/wnba/matches`, props par match. Hooks : `src/hooks/use-basketball-matches.ts`.
- **Design system : `DESIGN_CHARTER.md`** (à la racine) — tokens à respecter scrupuleusement :
  - Fond : `#0b0e17` (page) / `#0e121e` (cartes) / `#131722` (hover) / `#161c2a` (actif)
  - Accent : `#00e676` (vert néon), fonctionnels : `--green #00e676`, `--amber #fbbf24`, `--red #ff3856`, `--blue #29b6f6`, `--purple #ab47bc`
  - Fonts : Poppins (headings), Inter (body), **DM Mono (tous les nombres/stats — non négociable pour un parieur)**
  - Tailles console : xs 10px, sm 11px, md 13px, lg 15px, xl 18px, 2xl 24px, 3xl 32px
- **COMPONENTS.md** liste les 135 composants existants — **ne réinvente pas** : vérifie avant de créer, mets à jour le fichier si tu ajoutes des composants.
- Conventions : commentaires en français, camelCase, routes `app/api/v1/.../route.ts`, ES modules.
- **RÈGLE CRITIQUE — Shell** : l'outil shell exécute CMD, jamais Bash. `ls`→`dir /b`, `cat`→`type`, pas de `$VAR` ni `2>/dev/null`. Jamais de glob `**/*` sur `.next/` (890 Mo) — scope sur `src/`, `services/`, `app/`.

## Objectifs

1. **Backend** : service de calcul H2H + répartitions Over/Under + stats équipes/joueurs, exposé en API REST, alimenté par ESPN (gratuit, déjà en place).
2. **Frontend** : dans l'onglet NBA et WNBA, une **sous-navigation « H2H »** (au même niveau que le flux de matchs) avec sélecteur de paire d'équipes, 3 tabs (Stats · Confrontations · Joueurs), et une UI dense, tabulaire, sémantique, responsive.
3. **Qualité** : typecheck + lint propres, rendu vérifié via Playwright (screenshots), aucune régression sur les onglets existants.

---

## PARTIE A — Backend

### A.1 Sources de données (ESPN, endpoints déjà utilisés dans `services/wnbaService.js`)

| Besoin | Endpoint ESPN |
|---|---|
| Matchs + box scores (par quartier, FG, REB, AST, BLK, STL) | `site.api.espn.com/apis/site/v2/sports/basketball/{nba|wnba}/scoreboard?dates=YYYYMMDD` + `.../summary?event={id}` (pour l'historique, itérer sur les dates de la saison) |
| Roster + stats joueurs | `/teams/{id}/roster`, `/athletes/{id}/stats` (déjà utilisés) |
| Classement | `/apis/v2/sports/basketball/{league}/standings` |

Implémente un **cache mémoire avec TTL (ex. 6 h)** côté service + header `Cache-Control` sur les routes.
Toutes les données de la saison courante (WNBA : mai→sept, NBA : oct→juin) sont nécessaires ; itère sur les jours de la saison en conservant les résultats (stockage JSON en mémoire ou `data/basketball_h2h_{league}.json` — le projet utilise déjà ce pattern pour `data/nba_elo.json`).

### A.2 Nouveau service `services/basketballH2HService.js` (partagé NBA/WNBA via param `league`)

Fonctions à implémenter (formules exactes au §5 du rapport) :

1. `getH2H(league, teamAId, teamBId)` →
   - `split`: { aWins, bWins, total, aPct, bPct } (historique complet 2 équipes, toutes saisons si dispo, sinon saison courante — documenter le périmètre dans la réponse)
   - `dataPoints`: Wins, PPG_A/B, PointSpread (PPG_A−PPG_B), 3P%, FG%, **Assists Per Game** et **Rebounds Per Game** calculées sur l'échantillon H2H — **Offensive Rating supprimée** (bug site, valeurs 84.67/84.67 identiques, décision validée 2026-08-14)
   - `matches`: liste { date, season, league, home, away, homeScore, awayScore } triée décroissante
2. `getTeamSeasonStats(league, teamId)` → par venue (overall/home/away) : winPct, ppg, papg, fgPct, leadAtHalfPct (mène à la mi-temps), pace (possessions estimées), offRating, defRating, netRating (**= marge moyenne**, décision validée 2026-08-14 — pas la valeur « spread » du site), form6 (séquence W/L des 6 derniers), results5
3. `getTeamOverStats(league, teamId)` → `{ avg, points: [{ threshold: 70.5, pct }, ...] }` pour les points équipe (seuils 70.5→130.5, pas de 1) **et** par quartier (Q1-Q4, seuils 19.5→35.5) **et** par mi-temps (1H/2H, seuils 40.5→78.5)
4. `getTeamSpreadStats(league, teamId)` → positive/negative : `[{ threshold, pct }]` sur la distribution de la marge (seuils 0.5→19.5 et -0.5→-19.5) + `avgMargin` (= marge moyenne, décision validée 2026-08-14)
5. `getMatchOverStats(league, teamAId, teamBId)` → total match des 2 équipes, colonnes A/B/moyenne (seuils 171.5→250.5)
6. `getBTTSStats(league, teamAId, teamBId, scope)` → `FT|1H|2H|1Q|2Q|3Q|4Q`, seuils par scope (FT: 59.5→129.5, 1H/2H: 29.5→90.5, Q: 17.5→60.5), 3 colonnes A/B/avg
7. `getPlayerSeasonStats(league, teamId)` → par joueur : ppg, threesMade, rebounds (o/d/t), fgm (avec gamesPlayed pour le format `x.x (total/games)`), fgPct, assists, blocks, steals, plusMinus, minutes, position, photo, slug — **pas de « Rating » composite** (décision validée 2026-08-14)
8. `getStandings(league)` → { rank, team, wins, losses, winPct } (existe déjà en partie dans les services — réutiliser)

### A.3 Routes API

- `GET /api/v1/basketball/h2h?league=nba|wnba&teamA={id}&teamB={id}` → `{ split, dataPoints, matches, teamA: { seasonStats, overStats, spreadStats }, teamB: {...}, matchOver, btts: { ft, h1, h2, q1..q4 } }`
- `GET /api/v1/basketball/h2h/teams?league=nba|wnba` → liste des équipes (id, nom, logo) pour le sélecteur
- `GET /api/v1/basketball/h2h/players?league=nba|wnba&team={id}` → stats joueurs + standings

Réponses typées en TypeScript (types partagés dans `src/lib/types/basketball-h2h.ts`). Erreurs : `{ error, details }` + code HTTP approprié, wrapper try/catch comme les routes existantes.

---

## PARTIE B — Frontend : design & UX (le cœur de la demande)

### B.1 Principes « parieur pro »

- **Densité maîtrisée** : chaque écran d'informations utile doit tenir sans scroll horizontal ; tailles console DESIGN_CHARTER (10-13px), pas de blanc inutile.
- **Scan en 3 secondes** : hiérarchie visuelle stricte — verdict / chiffres clés / détails. Le parieur doit comprendre **qui gagne et de combien** avant de lire le reste.
- **Tous les nombres en DM Mono** (tabulaire) ; chiffres alignés à droite dans les tableaux.
- **Sémantique couleur systématique** : vert `#00e676` = positif/OVER/win, rouge `#ff3856` = négatif/UNDER/loss, ambre `#fbbf24` = seuil, bleu `#29b6f6` = info, violet `#ab47bc` = insight IA. Jamais de couleur seule sans symbole (▲/▼, +/−) — accessibilité.
- **Dark first** : le dark navy est le thème par défaut ; le composant doit être parfait dans les deux thèmes (tokens CSS var).
- **Comparaison côte à côte** : les deux équipes toujours en miroir (gauche/droite) avec un header sticky aux couleurs des équipes.
- **Micro-interactions** : hover row highlight (`--bg3`), tooltips explicatifs sur chaque métrique (définition + formule), transition 150ms. Pas d'animation lourde.

### B.2 Structure UI (dans l'onglet NBA et WNBA, côté `pariscore.html` legacy ET/OU composants React — privilégier React/shadcn, le legacy est en migration)

**Sous-navigation** : l'onglet basket gagne une seconde vue « **H2H** » accessible depuis les onglets de page existants (même pattern que la navigation onglets actuelle).

**Écran H2H — layout** :

1. **Barre de sélection** (sticky top) : deux dropdowns équipes (avec logos), bouton « Inverser » ⇄, le match le plus récent entre les deux pré-sélectionné par défaut.
2. **En-tête duel** (hero card) :
   - Logos + noms des 2 équipes, badge « DOMICILE »/« EXTÉRIEUR »
   - **Badge de forme** : libellé qualitatif + valeur, code couleur (ex. ≥+8 « Forme excellente » vert, +4/+8 vert pâle, −4/+4 neutre ambre, −8/−4 rouge pâle, ≤−8 « Forme très mauvaise » rouge) + séquence W/L en 6 pastilles (V vert / D rouge)
   - **Split de victoires H2H** : barre de progression proportionnelle 45.59 % / 54.41 % avec les % en DM Mono
   - Verdict en une phrase : « Atlanta Dream domine le H2H (37-31) »
3. **Tabs** (shadcn Tabs) :
   - **Stats** :
     - Tableau **Data Points** (8 rows) en 3 colonnes (Métrique | Équipe A | Équipe B) avec la valeur gagnante en vert + flèche
     - **Stats saison par venue** : 2 cards miroir (Overall/Home/Away) — le sélecteur Home/Away peut être un mini toggle ou les 3 colonnes en table
     - **Répartitions Over** (points équipe, quartiers Q1-Q4, mi-temps 1H/2H) : composant `OverUnderTable` réutilisable — header sticky, seuil en première colonne, % en barre de progression inline (background `--accent-bg`, fill `--green`), OVER utile (>50 %) en vert, UNDER en rouge, le seuil « money » (le plus proche de la moyenne) surligné en ambre
     - **Point Spread O/U** : distribution marge, même composant, + carte `avgMargin`
     - **Match Over & BTTS** : table 3 colonnes (A/B/Moyenne) avec barres
   - **Confrontations** : liste verticale dense, lignes `Date · Compétition · Score`, victoire colorée (vert/rouge), tri décroissant, séparateur par saison
   - **Joueurs** : tableau par équipe avec stats (PPG, 3PM, REB, AST, BLK, STL, FG%, **±** — pas de rating composite), tri par colonne, sticky header, pastille photo, row hover
4. **Side panel** (desktop, `lg:`+) : classement de la ligue (W-L, Win %, barre de win rate), replié en accordéon sur mobile.

### B.3 Composants à créer (vérifier COMPONENTS.md d'abord, nommer sans collision)

- `BasketballH2H` (conteneur page, state SWR)
- `H2HTeamSelector` (2 dropdowns + inversion)
- `H2HHeader` (hero duel : badges forme, split, verdict)
- `H2HDataPoints` (tableau 8 métriques miroir)
- `OverUnderTable` (générique : seuils + barres % + option 2-3 colonnes) — **le composant le plus réutilisé**, soigner la densité
- `H2HSplitBar` (barre proportionnelle win %)
- `FormDots` (pastilles W/L)
- `H2HMatchesList`, `H2HPlayersTable`, `H2HStandingsPanel`
- Hook `useBasketballH2H.ts` (SWR, pattern `use-basketball-matches.ts`)

---

## PARTIE C — Conventions & contraintes

- Mettre à jour **COMPONENTS.md** si tu ajoutes des composants ; **DESIGN_CHARTER.md** uniquement si tu ajoutes des tokens.
- ESLint (`bun run lint`) + `tsc --noEmit` propres avant livraison.
- Ne pas casser les pages NBA/WNBA existantes (vérifier `bun run build`).
- Ne rien committer sans demande explicite. Rédiger la doc dans `.context/` si besoin.

## PARTIE D — Critères d'acceptation (QA)

1. `bun run lint` et `tsc --noEmit` passent.
2. **Repro du rapport** : pour la paire Connecticut Sun / Atlanta Dream (WNBA), les métriques recalculées correspondent aux valeurs du snapshot §4 du rapport (tolérances : PPG ±0.3, %, win split exact, formes 6 derniers exactes). Utiliser le script de validation `scripts/validate-h2h.js` (à créer) qui compare API vs. valeurs du rapport et affiche PASS/FAIL.
3. Playwright : screenshot desktop 1440px + mobile 390px de l'écran H2H — **aucun débordement horizontal**, header sticky fonctionnel, tabs cliquables.
4. Responsive : tables Over passent en scroll horizontal maîtrisé sur mobile (avec `-webkit-overflow-scrolling: touch` + ombre d'indication), ou en stacked cards — au choix mais cohérent.
5. Temps de chargement : 1er écran < 2 s (cache service), navigation tabs sans re-fetch.
6. Dark/light : parfait dans les 2 thèmes (vérifier les deux screenshots).

## PARTIE E — Livrables

- `services/basketballH2HService.js` + routes `/api/v1/basketball/h2h*`
- Types `src/lib/types/basketball-h2h.ts`
- Hook `src/hooks/use-basketball-h2h.ts`
- Composants (B.3) + intégration sous-navigation H2H dans les onglets NBA & WNBA
- `scripts/validate-h2h.js` (validation vs. rapport) + screenshots Playwright dans `.context/qa-h2h/`
- Mise à jour COMPONENTS.md (+ CHANGELOG.md si pertinent)

---

**Commence par** : lire `.context/report-h2h-basketballstats.md` et `DESIGN_CHARTER.md`, explorer `services/wnbaService.js` + `use-basketball-matches.ts`, puis proposer un plan d'implémentation en 3-5 étapes avant d'écrire du code.
