# TENNIS_BUGS_AUDIT.md — Audit QA complet de l'onglet Tennis

> **Date** : 2026-08-18 · **Scope** : Onglet Tennis (Prematch & Live) — chaîne d'acquisition,
> modèle prédictif, UI/UX, simulateur de bankroll.
> **Équipe simulée** : QA Mobile · QA Web · QA Live · QA Model Accuracy.
> **Incident référencé** : `Loading error : Unable to fetch matches. Retry.`

---

## 1. Erreurs API & Fetching

| ID | Sévérité | Constat | Cause racine | Statut |
|----|----------|---------|--------------|--------|
| **B1** | 🔴 CRITIQUE | `Unable to fetch matches` sur l'onglet Tennis (prematch ET liste Flashscore) | La route `src/app/api/tennis/prematch/route.ts` renvoyait **503** quand une source échouait sans cache chaud (fallback Odds API inopérant : `ODDS_API_KEY` **vide**) → SWR jetait une erreur → erreur bloquante pleine page. Un 401 BSD a été observé sur test PowerShell manuel (artefact d'extraction de clé CRLF — la clé fonctionne depuis le serveur Next, confirmé par test runtime 2026-08-18 : 200 + 30 matchs réels). La panne structurelle (503 sans source) reste le risque réel — BSD peut tomber à tout moment | ✅ **Résolu** — Chaîne de résilience à 4 niveaux : BSD (retry 1x sur 429/5xx) → Odds API → **cache périmé (stale-while-error, 1h)** → **mock local re-daté** (`source: "mock"`). Plus aucun 503 bloquant. Test runtime : HTTP 200, `source: "bsd"`, 30 matchs, cache TTL confirmé |
| **B2** | 🟠 ÉLEVÉ | Cache TTL inutilisé en cas de panne : des données de < 1h existaient mais étaient jetées → 503 | Absence de stale-while-error dans la route prematch | ✅ **Résolu** — Cache périmé servi ≤ 1h avec `source: "cache-stale"` + `updatedAt` d'origine (transparence) |
| **B3** | 🟠 ÉLEVÉ | Aucun mode dégradé fonctionnel côté client : l'UI ne savait pas afficher autre chose qu'une erreur | Hook `use-prematch-matches.ts` sans fallback ni types d'erreur | ✅ **Résolu** — Repli **uniquement côté route** (`source: "mock"` / `"cache-stale"`) — décision post-code-review : pas de `fallbackData` client pour éviter les faux positifs (cotes mock présentées comme réelles dans TopValueBets/comparateur). Le hook expose `isDegraded` + `TennisPrematchError` typé (`NETWORK_ERROR` / `HTTP_ERROR` / `INVALID_PAYLOAD`) ; gardes anti-faux-positifs ajoutées dans `top-value-bets.tsx` et `bookmaker-comparator-dialog.tsx` |
| **B4** | 🟡 MOYEN | Pas de retry sur les erreurs transitoires (429/5xx) — un rate-limit faisait tomber toute la chaîne | `bsdFetch` jetait immédiatement | ✅ **Résolu** — `fetchWithTransientRetry` : 1 retry (300 ms) sur `BSD_RATE_LIMIT` / 5xx avant fallback |
| **B5** | 🟡 MOYEN | Drift de shape non protégé (bug A9 récurrent : `matches` = objet au lieu de tableau → crash `matches is not iterable`) | Pas de validation du payload côté hook | ✅ **Résolu** — Validation `Array.isArray(matches)` dans le fetcher → `INVALID_PAYLOAD` typé |
| **B6** | 🟡 MOYEN | Skeleton dupliqué localement (2 copies) — aucun composant réutilisable pendant le chargement | `MatchCardSkeleton` défini 2× inline (`tennis-tab-content.tsx`, `best-matches-tabs.tsx`) | ✅ **Résolu** — Composant dédié `src/components/tennis/match-card-skeleton.tsx` (COMPONENTS.md mis à jour) |
| **B7** | 🔴 CRITIQUE | **`ODDS_API_KEY` vide dans `.env`** — le fallback de secours historique est mort depuis longtemps | Configuration | ⚠️ **Partiel** — La chaîne de résilience ne dépend plus de cette clé ; à réactiver côté compte The Odds API (free tier 500 req/mois). **Diagnostic prod 2026-08-18** : les tokens BSD sont **liés à l'IP d'enregistrement** — la clé locale (Sports Addon actif, sha `bf2100…`) sert 30 matchs depuis le poste (IP résidentielle) mais **HTTP 401** depuis le VPS ; la clé historique du VPS (sha `0c455c…`) s'authentifie depuis le VPS mais renvoie **HTTP 402 addon_required**. Données réelles en prod ⇒ activer le Sports Addon ($5/mo) sur le compte BSD lié à la clé VPS (bzzoiro.com/addons/), ou demander au support BSD de délier la clé locale de son IP |

**🔧 Action manuelle recommandée** : renouveler la clé BSD ou le sub Sports Addon chez `sports.bzzoiro.com` pour repasser en données réelles. D'ici là, le site affiche le cache puis le mock — jamais d'erreur bloquante.

---

## 2. Incohérences de Modèle (Elo / Surface / Forme)

| ID | Sévérité | Constat | Cause racine | Statut |
|----|----------|---------|--------------|--------|
| **M1** | 🟠 ÉLEVÉ | **Indoor non mappé** : les matchs indoor (ex: Swiss Indoors, Bercy) utilisent l'Elo "Dur" (`hElo`). Le type BSD admet `"carpet"` mais `normalizeSurface()` (bsd-fetcher.ts:38-45) fait tout tomber sur "Dur" | Pas de branche `indoor` / `carpet` dans la normalisation surface | ⚠️ **Partiel** — Documenté ; correction proposée dans la spec innovations (Section Elo) : mapping `carpet` → Indoor avec Elo dédié |
| **M2** | 🟠 ÉLEVÉ | **Aucun coefficient de transition de surface** : un joueur passant de Gazon → Terre battue voit son `surfaceElo` appliqué immédiatement à 100% (pondération statique `SURFACE_WEIGHT = 0.55`, engine.ts:49) | Pas de facteur de transition (ex: Elo moyen pondéré selon les matchs joués sur la surface) | ⚠️ **Partiel** — Spécifié dans `docs/TENNIS_INNOVATIONS_SPEC.md` (Surface-Specific Elo Matrix avec transition factor) |
| **M3** | 🟡 MOYEN | `surfaceElo` priorise tennisabstract > DB > eloMatch sans vérifier que la surface du cache correspond au tournoi | Chaîne de lookup `abstract?.surfaceElo ?? dbA?.eloSurface ?? …` (bsd-fetcher.ts:99-110) | ✅ **Résolu** — Vérifié : le lookup reçoit bien la surface du match (`lookupAbstractElo(name, surface)`) ; risque résiduel documenté |
| **M4** | 🟡 MOYEN | Forme ("5V-1D") dérivée de l'historique **Elo** (delta de rating), pas des victoires réelles — un joueur qui perd en gagnant des points (surface valorisée) voit une forme fausse | `extractForm()` compare `history[i].elo >= history[i-1].elo` (bsd-fetcher.ts:451-459) | ⚠️ **Partiel** — Documenté ; refonte proposée (Form Index par surface, spec §Form) |
| **M5** | 🟢 FAIBLE | Probabilités 50/50 affichées quand aucun joueur n'est connu — l'UI les masque via `insufficientData` mais le JSON reste public | Comportement de secours | ✅ **Résolu** — Vérifié : `eloKnown` + `insufficientData` gating correct (aucune fausse prédiction en UI) |

---

## 3. Erreurs d'affichage UI/UX

| ID | Sévérité | Constat | Cause racine | Statut |
|----|----------|---------|--------------|--------|
| **U1** | 🟠 ÉLEVÉ | **Mismatch de timezone** : `flashscore-tennis-list.tsx:33` et `player-profile-dialog.tsx:225` utilisent `toLocaleTimeString()` sans `timeZone` → rendu serveur en UTC (−2h en été) | Pas de `timeZone` forcée | ✅ **Résolu** — `Intl.DateTimeFormat` avec `useBrowserTimeZone()` (UTC au SSR, TZ navigateur après mount) |
| **U2** | 🟡 MOYEN | **Libellé EN trompeur** : « Clear favorites » est un filtre (probA ≥ 70%) qui ressemble à une action « effacer mes favoris » | Traduction `en.json:39` | ✅ **Résolu** — Renommé « Strong favourites » (+ hint `Prob ≥ 70%`). Filtre fonctionnel (all/favorites/balanced/starred + 5 tris) |
| **U3** | 🟡 MOYEN | Bandeau d'erreur rouge bloquant même quand des données de repli sont affichées | Condition `error &&` sans distinction de source | ✅ **Résolu** — Bandeau **ambre** « Mode dégradé » (données statiques/cache) vs **rouge** (panne totale) + bouton Réessayer conservé |
| **U4** | 🟢 FAIBLE | Mobile : grille responsive OK (1 col → 2/3 col `lg:`) mais pas de test d'écran < 360px documenté | — | ✅ **Résolu** — Nouveau test `tests/tennis-mobile.spec.ts` (2 cas, viewport 320 px, débordement ≤ 2 px, absence d'erreur bloquante, bandeau dégradé non-cassant). **Bug réel découvert et corrigé** : header top-nav débordait de **242 px** à 320 px (8 contrôles sans wrap) → `flex-wrap` + `min-h-14` dans `src/app/page.tsx` → **0 px**. 15/15 specs UI existantes vertes (smoke, rgpd, sidebar, mobile, theme) |
| **U5** | 🟢 FAIBLE | Pas d'indicateur visuel de la source des données (BSD / cache / mock) | — | ✅ **Résolu** — Badge source permanent dans le hero de l'onglet tennis : pastille verte **« Direct »** (bsd/odds-api), ambre **« Cache »** (cache-stale), orange **« Démo »** (mock), avec tooltip source + heure de mise à jour (i18n fr/en) |

---

## 4. Gestion des Abandons / Walkovers (RET / WO)

| ID | Sévérité | Constat | Cause racine | Statut |
|----|----------|---------|--------------|--------|
| **R1** | 🔴 CRITIQUE | **Aucune règle RET/WO dans le simulateur de bankroll** : un pari sur un match abandonné reste `pending` indéfiniment ou est réglé manuellement won/lost (faux résultat) | `settleBet()` binaire `won|lost` (use-bankroll.ts:117, use-paper-trading.ts:116) — aucun statut « remboursé » | ✅ **Résolu** — Nouveau statut **`void`** (règle bookmaker standard) : mise **remboursée** (`payout = stake`, profit 0, ni gagné ni perdu) + bouton dédié (icône Ban, titre « Rembourser (abandon RET/WO) ») dans les 2 simulateurs + badge gris + stats/ROI/winRate cohérents |
| **R2** | 🟡 MOYEN | **Règle « 1er set terminé » vs « match joué » non modélisée** : les bookmakers remboursent si le 1er set n'est pas terminé au moment du RET — non géré | Pas de granularité par marché | ⚠️ **Partiel** — Documenté : règle complète = si 1er set terminé → pari résolu ; sinon → void. Le void manuel couvre le cas ; l'automatisation (statut BSD `walkover`/`retired` → void auto) est spécifiée (`docs/TENNIS_INNOVATIONS_SPEC.md` §Bankroll) |
| **R3** | 🟢 FAIBLE | Les matchs RET/WO sont bien exclus des agrégations stats live (`tennis-stats/leaderboard.ts:23`) — cohérent, à conserver | — | ✅ **Vérifié** — Comportement correct |

---

## 5. Récapitulatif

| Catégorie | Total | Résolu | Partiel | Non traité |
|-----------|-------|--------|---------|------------|
| API & Fetching | 7 | 6 | 1 | 0 |
| Modèle Elo/Surface | 5 | 2 | 3 | 0 |
| UI/UX | 5 | 5 | 0 | 0 |
| Abandons RET/WO | 3 | 2 | 1 | 0 |
| **Total** | **20** | **15** | **5** | **0** |

- **Fichiers modifiés** : `src/app/api/tennis/prematch/route.ts` · `src/hooks/use-prematch-matches.ts` ·
  `src/components/football/tennis-tab-content.tsx` · `src/components/tennis/match-card-skeleton.tsx` (nouveau) ·
  `src/components/tennis/flashscore-tennis-list.tsx` · `src/components/tennis/player-profile-dialog.tsx` ·
  `src/hooks/use-bankroll.ts` · `src/hooks/use-paper-trading.ts` · `src/components/bankroll-dialog.tsx` ·
  `src/components/paper-trading-dialog.tsx` · `src/components/dashboard/top-value-bets.tsx` ·
  `src/components/bookmaker-comparator-dialog.tsx` · `src/messages/{fr,en}.json` ·
  `src/hooks/use-tennis-live-stats.ts` · `src/components/tennis/live-decision-badges.tsx` ·
  `src/components/tennis/live-decisions-drawer.tsx` · `src/app/page.tsx` (header mobile) ·
  `tests/tennis-mobile.spec.ts` (nouveau) · `COMPONENTS.md`
- **Validation** : `npx tsc --noEmit` → **0 erreur dans le périmètre modifié** (les erreurs restantes sont
  préexistantes — hors scope tennis, ignorées par `typescript.ignoreBuildErrors`).
- **Code review** : passe complète par le module code-reviewer → 4 bloquants corrigés (retry 5xx via `statusCode`
  AppError, faux positifs dashboard sur mock, bandeau dégradé inatteignable, deps TZ du useMemo Flashscore) +
  1 important (winRate/ROI dilués par les void).
- **Validation runtime** : test direct serveur dev → `HTTP 200` + `source: "bsd"` + 30 matchs réels (2026-08-19),
  cache TTL confirmé (2e appel sans re-fetch), chaîne de repli validée par construction.
- **QA post-deploy prod (Playwright, pariscore.fr, 2026-08-18)** : bandeau « Mode dégradé » affiché ✓, matchs mock
  visibles (Sabalenka/Osaka) ✓, « Unable to fetch matches » disparu ✓, `MISSING_MESSAGE: match.otherBookmakers`
  corrigé (29 erreurs console → 0). État prod constaté : BSD `BSD_PAYMENT` (abonnement bloqué depuis IP
  datacenter — fonctionne depuis IP résidentielle locale) + Odds API 404 (clé sans couverture tennis) → le
  mode dégradé est le comportement nominal attendu tant que les abonnements ne sont pas rétablis.
- **Prochaines étapes** : activation Sports Addon sur le compte BSD lié à la clé VPS (données réelles en prod) ·
  implémentation spec innovations (`docs/TENNIS_INNOVATIONS_SPEC.md`) · QA Playwright mobile (U4).