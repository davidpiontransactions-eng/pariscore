# Rapport QA — Audit Visuel + Design Leaders (20/08/2026)

## Résultat final : 19/19 PASS ✅ (premier run 100% vert de la session)

Audit complet `node scripts/qa-visual-audit.js` contre prod `https://pariscore.fr` :
- token-accent (vert néon `lab(75.82% -64.96 22.47)`), token-bg-deep `#0a0e17`, motion tokens ✅
- font-sans (geist, archivo), font-min-11px (sub11=0) ✅
- overflow-desktop + **overflow-mobile-375** ✅ (passait avant en flaky, désormais stable)
- hero-lucide-icons, football-page, sw-cache-version v6, no-js-errors **clean** ✅

## Changements de cette session (design leaders)

1. **Onglet sport actif** : `text-white` → `text-emerald-400` (accent vert néon, pattern « accent unique » Sofascore/FotMob) — `sport-tabs.tsx`
2. **Cards matchs plates** : suppression du lift (translate/shadow) → `hover:border-emerald-500/40 hover:bg-muted/10`, radius 2xl→xl (pattern FotMob rows denses) — `match-card.tsx`
3. **Score display** : `font-mono text-xs` → `font-display text-sm font-bold` (Archivo enfin utilisé, pattern Sofascore « score = donnée dominante ») — `set-scoreline.tsx`
4. **Échelle type data 12px** : 180 occurrences `text-[11px]` → `text-xs` sur les cartes/data matchs (football-match-card 60, football-live-card 29, pip-bet-panel 23, etc.) — 10 composants
5. **Fix i18n** : `tTennis("offline")` → `t("offline")` (clé `match.offline`, MISSING_MESSAGE éliminé) — `match-card-broadcast.tsx`
6. **Fix SW** : SKIP_WAITING uniquement quand `hadController` (vraie mise à jour), premier claim sans reload fantôme — `sw-register.tsx`

## Bugs QA résolus (tests)

- **Polling `/api/v1/odds/live` toutes les 15s** cassait `waitUntil: 'networkidle'` (jamais stable) → tous les goto passent en `domcontentloaded` + settle 3,5s. Le polling est légitime (cotes live).
- Diagnostic complet mobile : pas de double-reload du SW en cause (les 4 navigations = soft navs Next + prefetch RSC, identiques desktop/mobile).

## Livrables

- Rapport comparatif : `.context/DESIGN_COMPARE_REPORT_2026-08-20.md` (5 sites : Sofascore, FotMob, Flashscore, Forebet, WhoScored — data + pixel)
- Données comparatives : `.context/design-compare/<site>/{desktop-clean.png, mobile.png, tokens.json, structure.json}`
- Scripts réutilisables : `qa-compare-sites.js`, `qa-compare-sites2.js`, `qa-pariscore-current.js`, `qa-mobile-*.js` (diag SW/polling), `migrate-11px-data.js`, `qa-11px-scan.js`

## Commits

`57741509` ui patterns leaders · `50af3e5c` fix sw SKIP_WAITING · `691f41c9` qa audit + i18n + rapport — tous poussés, VPS déployé (`build_ran 1`, health OK).