# Bug Report — Classements métriques figés `#9/18` / `#10/18` (Football)

**Statut :** FIX APPLIQUÉ — review APPROUVE (code-reviewer), 49/49 tests verts, `tsc --noEmit` OK (hors erreur pré-existante tennis hors périmètre).

---

## 1. Cause racine

Sur les cartes `FootballMatchCard` / `MetricsComparative`, les badges de rang affichés sous les barres
comparatives (Corners, Tirs cadrés, Cartons, Fautes) étaient **identiques sur tous les matchs et toutes
les ligues** : `#9/18` (domicile) et `#10/18` (extérieur).

Le diagnostic remonte à deux fonctions de `src/lib/football-predictions.ts` :

1. **`computeTeamComparisons(…)`** — en l'absence de `live_stats` BSD (cas de tous les matchs
   *prematch/notstarted*), elle renvoie un split par défaut fixe **55/45** pour chaque catégorie
   (Corners, Tirs cadrés, Cartons, Fautes).

2. **`computeTeamSeasonStats()`** (ancien code, supprimé dans le fix) — à partir de ce 55/45, elle
   **fabricait** un rang « simulateur » :
   - `LEAGUE_TOTAL = 18` codé en dur (peu importe la vraie taille de la ligue) ;
   - `homeRank = round(RANK_TOTAL - (homeAvg / (leagueAvg*2)) * (RANK_TOTAL - 1))` → **toujours 9** ;
   - `awayRank` symétrique → **toujours 10** ;
   - `homeRankTotal/awayRankTotal = 18`.

Résultat : pour un match prematch quelconque, `homeProb=awayProb` du 55/45 par défaut → `homeAvg`/`awayAvg`
proportionnels → rangs toujours `9` et `10`, total toujours `18`. Le badge n'avait aucune relation
avec la ligue, l'équipe ou la métrique affichée.

**Aucune donnée réelle de classement par métrique (Corners / Tirs cadrés / Cartons / Fautes) n'existe
dans le pipeline BSD** — le seul classement réel disponible est par PPG/buts (`metricStats`,
`standingStats`, `metricRankings`) via `bsd-football-fetcher.ts` (`fetchBSDLeagueData` →
`rankByPpg` / `buildGoalRankMaps`, toutes déjà branchées sur la vraie UI).

---

## 2. Fichiers impactés & modifiés

| Fichier | Modification |
|---|---|
| `src/lib/football-predictions.ts` | `computeTeamSeasonStats()` : suppression de la fabrication de rangs. Type de retour `homeRank: number \| null`, `awayRank: number \| null` ; retourne désormais `null`/`0` pour les rangs et totaux. Les moyennes (homeAvg/awayAvg) restent des estimations balisées `[0.1, 25]`. |
| `src/lib/football-data.ts` | Type `Prediction.teamSeasonStats` : `homeRank`/`awayRank` passent de `number` à `number \| null`. Les 4 entrées mock/démo dans `ALL_FOOTBALL_MATCHES` ont leurs rangs codés en dur supprimés (`null`/`0`) — cohérence : ne jamais montrer un rang simulé, même en fallback mock. |
| `src/components/football/football-match-card.tsx` | Badge `( #{rank}/{rankTotal} )` rendu **uniquement** si `homeRank != null && homeRankTotal > 0` (idem `awayRank`). Sans rang réel → seule la moyenne est affichée (ex : `5.7/m`), conformément à la spec « no fake data ». Les vrais rangs (PPG standings, metricStats, metricRankings) restent affichés partout où existent des données réelles. |
| `src/lib/__tests__/football-predictions.test.ts` | + 5 tests `computeTeamSeasonStats` (rangs toujours null, bornes des moyennes, labels, domination sans rang fabriqué) + correction d'un test stale `computeXGd` (contrat réel `null`, le test attendait `0`). |
| (hors périmètre, présent dans l'arbre) `scripts/deploy-vps.bat` | Non lié au bug — changement de déploiement pré-existant, à committer séparément. |

---

## 3. Règles de validation QA

Procédure pour vérifier que les classements sont désormais dynamiques / fidèles aux données réelles :

1. **Tests automatiques** :
   - `bun test src/lib/__tests__/football-predictions.test.ts` → **49 pass / 0 fail** (dont 5 nouveaux
     tests garantissant que `computeTeamSeasonStats` ne renvoie jamais de rang simulé).
   - `npx tsc --noEmit` → zéro erreur sur les fichiers modifiés. L'erreur restante
     (`src/components/tennis/predictive-bets.tsx:88`, TS2322 dans un `useMemo`) est **pré-existante**,
     hors périmètre football — à traiter séparément.

2. **Navigation manuelle (cartes `FootballMatchCard`)** :
   - Ouvrir un match football **prematch** (pas lancé) dans l'onglet Football → les barres comparatives
     `Corners / Tirs cadrés / Cartons / Fautes` affichent la moyenne (`ex. 5.2/m`) **sans** badge
     `(#9/18)` ni `(#10/18)`.
   - Ouvrir un match en direct/avec standing réel : les **vrais rangs PPG** (badge `#rank/rankTotal`
     dans `PpgCell`) ET les **vrais classements par métrique** (buts) restent affichés.
   - Changer de match / de ligue → les moyennes varient selon les comparatifs ; aucun badge numérique
     répété identique entre deux matchs différents dans le cas sans source réelle.
   - Onglet « Classements » (tab rankings) → `MetricLeaderboardTable` alimenté par `metricRankings`
     réels du championnat (inchangé).

3. **Grep de non-régression** (aucun littéraux codés en dur ne doit réapparaître) :
   - `LEAGUE_TOTAL` / `RANK_TOTAL` dans `src/` → plus aucune référence à un total 18 codé en dur
     dans la fabrication de rangs.
   - Chercher `#9/18` / `#10/18` hors commentaires → ne doit exister dans aucun JSX.

4. **Contrat type** : tout code qui lit `teamSeasonStats.homeRank` doit gérer `null`
   (parse à jour via `tsc --noEmit`).

---

## 4. Ce qui reste (recommandé, non bloquant)

- **Test de bout en bout visuel** (Playwright) : screenshot d'une carte prematch pour confirmer la
  suppression du badge simulé côté rendu (le reviewer suggère un smoke rapide).
- **Amélioration future (architecture)** : quand une comparaison correspond à une colonne réelle du
  standings (ex : « Attaque » → rang buts-pour, « Défense » → rang buts-contre), basculer
  `computeTeamSeasonStats` pour recevoir les vrais rangs depuis `metricStats` au lieu de `null`
  — c'est le seul moyen de réafficher un rang pour Corners/Tirs/Cartons/Fautes sans source réelle.
- Séparer `scripts/deploy-vps.bat` de ce commit côté git.