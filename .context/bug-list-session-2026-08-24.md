# Inventaire bugs — session 2026-08-23/24 (Top5 Select + Home)

**Statuts** : ✅ corrigé · ❌ ouvert · ⏸️ dette acceptée

> **Mise à jour post-review** (code reviewer avec droit d'écriture, 2026-08-24) :
> les items ouverts B3, C1, C2, C3, C4, D1, D2 ont été **corrigés et vérifiés**
> (15 fichiers, eslint 0/0, tsc 0 erreur sur fichiers touchés). B2 reste ouvert
> (arbitrage produit requis). Détails en fin de document.

## A. Bugs introduits puis corrigés pendant la session

| # | Fichier | Bug | État |
|---|---|---|---|
| A1 | `qa-top5-probe.js` v1 | Sonde QA cliquait le mauvais bouton « Football » (`.first()` = item arborescence sidebar au lieu de la carte sport) → faux négatif QA | ✅ sélecteur ciblé |
| A2 | `qa-top5-diag.js` | TDZ crash : `diag` déclaré après try/catch → ReferenceError masquant l'erreur réelle si clic échoue | ✅ hoist |
| A3 | `qa-top5-probe.js` | Édition partielle ayant laissé le fichier en syntaxe cassée | ✅ réécriture |
| A4 | `src/app/page.tsx:228` | Directive eslint-disable devenue inutile | ✅ retirée |

## B. Bugs latents du codebase découverts pendant la session

| # | Fichier | Bug | État |
|---|---|---|---|
| B1 | `mobile-bottom-nav.tsx` | Onglet `accueil` jamais géré par page.tsx → contenu vide au clic mobile | ✅ renommé `home` + branchement |
| B2 | `mobile-bottom-nav.tsx` | **4 ids morts restants** (`live`, `value`, `favoris`, `profil`) : clic → rien à l'écran ; le guard SPORT_IDS empêche désormais la pollution store/URL mais les boutons sont inertes | ❌ ouvrir |
| B3 | `tests/smoke.spec.ts:86` | Spec E2E stale : attend `<h1>` contenant « Tennis » alors que la landing est maintenant la vue Accueil → rouge à chaque run E2E | ❌ ouvrir |
| B4 | `sports-sidebar.tsx:844` | Sur home, LiveLineToggle écrivait `modes["home"]` persisté localStorage | ✅ gate fallback football |
| B5 | `home-dashboard.tsx` | CTA primaire `bg-emerald-600` contraste 3.77:1 < AA 4.5:1 | ✅ emerald-700 |
| B6 | `page.tsx` logo | Cible tactile 32px < 44px (règle tactile CRITICAL) | ✅ padding -my-2 py-2 |
| B7 | `globals.css` | Ambiance `data-sport="home"` héritait du vert tennis par défaut | ✅ règle neutre accent |
| B8 | `api/football/top5/route.ts:14` | JSDoc obsolète « Over 3.5 » après renommage under35 | ✅ |

## C. Erreurs TypeScript préexistantes (features potentiellement cassées)

### C1. Module bankroll — ~30 erreurs, feature probablement cassée en prod
- `src/app/bankroll/page.tsx` : utilise `setActiveBankroll`, `createBet`, `updateBankroll`, `bookmaker`, `bankrollsLoading` — **absents du store** (le vrai nom semble être `selectBankroll`) ; `BetForm` utilisé ligne 110 mais jamais importé ; props passées aux composants enfants inexistantes (`bankrollId`, `bankrolls`, `onSelect`… lignes 60-187) ; `onCreate` retourne `Promise<Bankroll>` contre `Promise<void>` attendu
- `src/app/bankroll/bets/new/page.tsx` : mêmes mismatches store + `string | undefined` vs `string | null`
- `src/app/bankroll/bets/page.tsx` : props `bankrollId/currency/bankrolls/…` refusées par les composants (lignes 166-205)
- ➡️ **P1** : la page /bankroll risque un crash runtime (BetForm undefined)

### C2. Football live — affichages potentiellement NaN/null
- `src/components/football/football-live-card.tsx:377-499` : `live.homeShots/awayShots/homeShotsOnTarget/awayShotsOnTarget` typés `number | null` utilisés comme `number` (arithmétique + props obligatoires)
- `src/lib/football-nl-filter.ts:113-117` : mêmes null sur shots/SOT/corners
- `src/components/football/football-match-detail-dialog.tsx:446` : objet stats `{number|null}` passé là où `{number}` exigé
- ➡️ **P1** : risques NaN affichés / crash sur matchs live sans stats

### C3. Divers P2
- `src/components/dashboard/LiveDecisionMomentumWidget.tsx:63` : prop `indicatorClassName` inexistante sur `Progress` (style dégradé perdu)
- `src/lib/bsd-fetcher.ts:444` : clé `p1_second_won` absente du type cible (données tennis perdues silencieusement ?)
- `src/app/bet-manager/bet-form.tsx:243` : `Dispatch<SetStateAction<BetType>>` passé à `(value: string) => void`

### C4. Hygiène P3
- `scripts/test-auto-settle.ts:65` : argument `null` vs `number`
- `scripts/tmp-rss-probe.ts` / `tmp-rss-scan.ts` : variables redéclarées + `await` top-level sans module (fichiers scratch → supprimer ?)
- `tools/skyvern/skyvern-frontend/**` : modules absents (vendored, hors scope projet — ignorer)

## D. Dettes UX/a11y notées (non-bloquantes)

| # | Sujet | État |
|---|---|---|
| D1 | i18n home-dashboard : chaînes FR codées en dur alors que LanguageToggle existe (next-intl) | ⏸️→❌ candidat correction reviewer |
| D2 | SportTabs `role="tablist"` : pas d'arrow-key roving focus ni aria-controls/tabpanel | ❌ ouvrir |
| D3 | Deep-link `/?sport=x` : flash HomeDashboard 1 frame avant bascule | ⏸️ awareness |

## Ordre de priorité proposé pour le reviewer

1. **C1 bankroll** (crash runtime probable — vérifier le store réel et aligner la page)
2. **C2 live-card/nl-filter/dialog** (guards null)
3. **B3 smoke.spec** (E2E rouge)
4. **D1 i18n home** + **D2 roving focus**
5. **C3 divers** (props/types mécaniques)
6. **C4 hygiène** (suppression scratch scripts)
7. B2 : décision produit requise (router vs masquer les 4 boutons) — proposer, ne pas implémenter sans arbitrage

---

# Rapport de correction — code reviewer (2026-08-24)

**Verdict : APPROVE** · 7 groupes traités · 15 fichiers modifiés · rien committé manuellement

| Bug | Statut | Travail effectué | Vérification |
|---|---|---|---|
| **C1** bankroll | ✅ CORRIGÉ | 3 pages alignées sur le vrai store `useBetManager` (`selectBankroll`, `addBet`, `activeId`, `bm.stats`) et les vraies Props des composants bet-manager ; `BetForm` orphelin retiré (rendait une Dialog permanente — flux existant dialog→`/bankroll/bets/new` conservé) ; reload après création de bankroll (pattern page tools) | eslint 0/0 · tsc 0 erreur (≈30 avant) |
| **C2** nulls live foot | ✅ CORRIGÉ | live-card : lignes Tirs/Cadrés/Corners rendues seulement si les 2 côtés ≠ null (pas de zéros silencieux), xG via narrowing `typeof === "number"` ; nl-filter : deltas → `null` si un côté null (contrat documenté) ; detail-dialog : MomentumChart seulement si 4 stats ≠ null | eslint 0/0 · tsc 0 erreur |
| **B3** spec E2E stale | ✅ CORRIGÉ | Assertion `/Tennis/i` → `h1 /Bonjour/i` + `h2 /Bienvenue sur PariScore/i` (réalité post-home) | lecture rendu réel |
| **C3** types mécaniques | ✅ CORRIGÉ | `indicatorClassName` retirée (Progress ne l'expose pas — dette UI notée) ; `p1_second_won/p2_second_won` AJOUTÉS au type live_stats (attendus par zod schema aval) ; cast `as BetType` dans bet-form | eslint 0/0 · tsc 0 |
| **C4** hygiène | ✅ CORRIGÉ | tmp-rss-probe.ts + tmp-rss-scan.ts supprimés (non trackés git) ; test-auto-settle : signature `fx` élargie `number \| null` (cas volontaire Score null) | eslint 0/0 · tsc 0 |
| **D1** i18n home | ✅ CORRIGÉ | Namespace `home` ajouté à fr.json + en.json (2 locales < seuil) ; home-dashboard branché useTranslations("home") y compris aria-label | JSON.parse OK ×2 · eslint 0/0 |
| **D2** roving focus | ✅ CORRIGÉ | sport-tabs : tabIndex roving + ArrowLeft/Right/Home/End avec wrap, pattern ARIA tabs, zéro changement visuel | eslint 0/0 · tsc 0 |
| **B2** ids nav morts | ⏸️ SKIPPED | Garde tel quel (guard anti-pollution déjà posé). Router vs masquer `live/value/favoris/profil` = arbitrage produit requis | — |

### Vérification indépendante (post-review, agent principal)

- `git status` : exactement les 15 fichiers attendus en M
- `tsc --noEmit` filtré sur les 11 chemins touchés : **aucune correspondance = 0 erreur**
- Déployé : commit dédié → deploy.bat (build complet, health OK)

### Dette résiduelle documentée

- Jauge pression LiveDecisionMomentum sans code couleur tant que `ui/progress.tsx` n'expose pas `indicatorClassName`
- B2 : destination des 4 boutons mobile à décider
