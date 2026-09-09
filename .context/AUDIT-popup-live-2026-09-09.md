# Audit popup live Football — 2026-09-09 (post-deploy deploy-20260909-151857)
**Skills :** `production-audit` + `web-quality-audit` + `metier-audit-qa` (volets fonctionnel/datas, visuel/graphique, tests/prod). Commits audités : `77fa7519`, `22dcf254`. Prod : health legacy OK, next OK, smoke OK.

## A. Bugs à corriger — HIGH

1. **Statuts non-live traités comme LIVE** (`bsd-football-fetcher.ts:362,918`) — la denylist oublie `cancelled` (2 L, utilisé en `bzzoiro-client.ts:82,152`), `FT`, `AET`, `PEN`, `abandoned`, `walkover`… Un match annulé s'affiche `LIVE 0'`. Fix : allowlist `isLive` centralisée (`isBsdLiveStatus()` unique — la logique est tripliquée).
2. **Faux positifs `namesMatch`** (`espn-soccer-fetcher.ts:100-140`) — 1 token ≥4 lettres suffit : `Manchester Utd ↔ Newcastle Utd`, `Real ↔ Atlético Madrid` → timeline du mauvais match injectée. Fix : ≥2 tokens ou Jaccard + départage score BSD/ESPN.
3. **`live-funnel-log` ouvert + 3-4 ops DB/hit** (`live-funnel-log/route.ts:21-67`) — pas d'auth/rate-limit, `signals`/`markets` non validés, index read-modify-write non atomique, 1500 snapshots ≈ 16 matchs (auto-éviction). Fix : valider `signals ⊆ FunnelRuleId`, clamper 0-100, rate-limit 1/min/match, transaction, `MAX_SNAPS` ↑ ou partition par journée.

## B. Bugs à corriger — MEDIUM

4. **Minute clampée à 90** (`football-live-thresholds.ts`) — 90+4, 1-0 → `homeWin:100`, proba d'égalisation écrasée. Fix : minute jusqu'à ~130, plancher `remaining` si `status=LIVE`.
5. **`MAX_GRID=8` tronqué** — queue Poisson jetée puis renormalisée ; `over35/under35` biaisés quand λ grand. Fix : grille adaptative `max(8, λ+6√λ)`.
6. **Possession non clampée** (`bsd-football-fetcher.ts:374` + `live-stats-breakdown.tsx`) — `120 % / -20 %` possible, funnel faussé. Fix : `clamp(0,100)` aux deux niveaux.
7. **Route stats : `matchId` non validé/encodé + cache Map non borné** (`stats/route.ts:56,22-27`) — path BSD forgeable, croissance mémoire. Fix : `^\d+$` + `encodeURIComponent` + LRU 500.
8. **Dialog : pas de timeout, reset async** (`football-match-detail-dialog.tsx:191-225`) — requête pendue = skeleton infini ; flash stats match A sous header B. Fix : `AbortSignal.timeout(15000)`, `encodeURIComponent`, reset synchrone.
9. **Beacon funnel réarmé en boucle** (`live-stats-breakdown.tsx:174-208`) — deps `funnel`/`markets` recréés → >1 POST/min ; pas de gating `document.hidden`. Fix : deps scalaires + refs, skip si hidden.
10. **Latence pire-cas route stats > 60 s** (`stats/route.ts:84-145`) — chaîne séquentielle BSD+meta+DB+3 scoreboards+summary sans timeout global. Fix : `Promise.allSettled` BSD//meta, timeout global 20 s.
11. **Cache stats non multi-worker** — `globalThis Map` par worker → stampede + jamais purgé. Fix : LRU + envisager cache persistant court.
12. **Scope `colorScheme:light` limité au prématch** (`football-match-detail-dialog.tsx:384-401`) — le bloc live résout les tokens dark en mode sombre (fonds ardoise sur carte blanche). Fix : étendre le wrapper au bloc live.
13. **Momentum hors charte** (`momentum-chart.tsx:113,230-236,256-262,300-339,399-429`) — emerald/sky partout, légende/axe illisibles. Fix : migrer vers FOT (`#1a1a1a`/`#bdbdbd`/`#00985f`) ou documenter l'exception.
14. **Bloc prématch emerald/sky/rose** (`football-match-detail-dialog.tsx:66-120,392-519,678-745`) — `D` bleu ciel ~2,4:1, minute `text-rose-500` hors charte. Fix : migrer vers FOT.
15. **Contrastes 11px** — `#00985f` sur blanc ≈ 3,7:1 ; `#717171` sur aplats ≈ 4,3-4,5:1 ; opacités `/50-/80`. Fix : texte 11px en `#007a4c` ou `ink`, jamais d'opacité <100 % sur petit texte.

## C. Bugs à corriger — LOW (+ a11y)

16. Lignes rouges/jaunes/fautes masquées si seul l'away est non-null (tester `||`). 17. `parseMinute("45+3'")` → 45 (parser le stoppage → 48). 18. Attribution corners fragile au format texte (regex tolérante + log formats inconnus). 19. Calendar `degraded` jamais caché → thundering herd si BSD down (TTL 60 s). 20. Clavier bloqué sur buts SVG (`tabIndex`+`onKeyDown`), `role="table"` incomplet, cible ticker 16px (<24px), `aria-live` ticker + pause hover, `motion-reduce`, `useId()` gradients, axe Y décoratif, `shortName` null sans fallback, `truncate`+`title` (header 412px, donuts, légende), `flex-wrap` résumé live, `preserveAspectRatio meet` + `min-h`, `FOT.warn` vs amares en dur, `DialogContent #fafafa` vs `FOT.card`, commentaire OddAlerts faux, tokens `C.*` dupliqués du calendrier → importer FOT, double `%` donuts, libellé "signal(s) funnel", 3 patterns de barres → unifier.

## D. Gaps tests (zéro test composant popup ; routes non couvertes)

- `espn-soccer-fetcher` (namesMatch, alias, slug), `mapLiveState`, branches `estimated/degraded`, `buildFunnelSnapshot`, validation log route, red cards : aucun test. Recommandé : `__tests__/espn-matching.test.ts`, `__tests__/bsd-livestate.test.ts`, `__tests__/stats-route.test.ts`, `__tests__/funnel-log-route.test.ts`, cas rouges + 90+ dans `football-live-thresholds.test.ts`.

## E. Risques prod / runbook

- Après chaque pull avec changement `prisma/` : rejouer `prisma db push && prisma generate` AVANT le gate typecheck (piège rencontré : deploy avorté ce jour). Ajouter l'étape dans `deploy-v2.sh` [3/9].
- Compteurs d'échec BSD vs ESPN (aujourd'hui `console.warn` aveugles) pour l'alerting.
- `.bat` inexécutables depuis ce runner (lignes mangées) : passer par `cmd /c` ou répliquer ssh comme fait ce jour ; `graphify update` idem via `node …/cli.js` direct.

## F. Innovations restantes (backlog priorisé)

P1 : `fotmob-theme.ts` importé partout (calendrier), scope light étendu, migration momentum+prématch vers FOT. P2 : backfill `espnSlug`, Jaccard matching, allowlist statuts, clamps frontières, LRU caches. P3 : grille `MAX_GRID` adaptative, temps additionnel, alertes push surge, calibration seuils sur snapshots `funnellog:*`, xG/tir enrichi (tirs cadrés ratio), timeline xG cumulé.
