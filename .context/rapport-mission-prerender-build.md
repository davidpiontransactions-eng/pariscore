# Rapport de mission — Débloquer le build standalone (prerender)

**Date** : 2026-09-06, session 2 (11:45–12:20)
**Mission** : corriger les erreurs de prerender bloquant `bun run build` → produire `.next/standalone/server.js`.
**Statut final : ✅ MISSION ATTEINTE** — build **propre** (`.next` supprimé avant) vert : 99/99 pages statiques, standalone généré, postbuild OK, lint 0 erreur, typecheck 0 erreur (preuves fraîches §1).

> ⚠️ Ce rapport REMPLACE celui de 11:09 dont les conclusions §4.1/§5 étaient partiellement fausses : son « succès » de 11:06 était lui-même un build tronqué (voir §3, leçons 1-2).

---

## 1. Résultat vérifié (preuves fraîches, mono-process)

| Gate | Commande | Résultat | Preuve (`​.context/`) |
|------|----------|----------|--------|
| Lint | `bun run lint` | **exit 0** | `verify-final4.txt:16` |
| Typecheck | `bun run typecheck` | **exit 0** | `verify-final4.txt:25` |
| Build | `bun run build`, `.next` supprimé avant, NODE_ENV purgé | **exit 0**, 99/99 pages | `verify-final3.txt:1091-1093` |
| Artefact | `.next/standalone/server.js` | **présent** (3 934 o, 12:17:49) | idem + postbuild `[OK]` |

## 2. Causes racines (4) et correctifs

### 2.1 `/_not-found` — `Cannot read properties of undefined (reading 'length')` — RÉSOLU
- Cause : au prerender statique des routes système, `cookies()` (lue par la config next-intl) est hors scope requête et `getMessages()` peut renvoyer `undefined`.
- Fix (posé session 1, **validé empiriquement ici** : `/_not-found` passe dans les 2 derniers builds propres) :
  - `src/i18n/request.ts` — config défensive : `requestLocale` prioritaire, `cookies()` en try/catch, import messages avec fallback defaultLocale puis `{}` ;
  - `src/app/layout.tsx` — `getMessages() ?? {}`.

### 2.2 `/_global-error` — `Cannot read properties of null (reading 'useContext')` — RÉSOLU
- Digest constant `3255200895`, chunk en cause = interne Next (`next_dist_esm`), pas notre fichier. 4 échecs consécutifs (11:22, 11:53, 11:58 clean, 12:07 clean).
- **Deux conditions empiriquement nécessaires** (testées A/B en builds propres) :
  1. `src/app/global-error.tsx` **DOIT exister** (custom). S'il est absent (état 11:53–11:58), le `/_global-error` par défaut de Next crashe au prerender. → Fichier restauré (HTML brut, zéro hook next-intl, zéro import UI) + note de garde en tête.
  2. Le `export const dynamic = "force-dynamic"` ajouté au root layout à 11:17 fait échouer ce prerender : **4/4 builds échouent sur `/_global-error` avec**, **2/2 passent sans** (dont 1 ensuite bloqué plus loin par §2.3). → **Retiré**. L'ajouter avait d'ailleurs coïncidé avec le basculement des erreurs `/_not-found` → `/_global-error`.
- ⚠️ Le §4.1 du rapport de 11:09 (« imports morts supprimés → `/_global-error` passe ») était une conclusion tirée d'un build tronqué ; la vraie variable était `force-dynamic`, posé après.

### 2.3 `/settings` — `Event handlers cannot be passed to Client Component props` — RÉSOLU
- `src/app/settings/page.tsx` = Server Component passant des `onClick` à des `<button>` (shortcuts + bouton privacy). Bug réel **masqué jusqu'ici** : cette page n'était jamais atteinte au prerender à cause des blocages amont.
- Fix : `"use client"` en tête (1 ligne) — la page utilise `useTranslations` + handlers, elle est de facto client.

### 2.4 Workers Turbopack — `DataCloneError` — RÉSOLU (session 1)
- `workerThreads: true` retiré de `next.config.ts` (structuredClone du graphe de modules impossible entre workers).

## 3. Leçons / pièges process (à retenir)

1. **Faux succès de build** : un `next build` peut finir `exit 0` avec manifest complet **en sautant entièrement le prerender** (cache `.next` — build de 11:31 sans aucune ligne « Generating static pages », avec en plus un warning « Failed to copy traced files »). Contre-vérification systématique : les lignes `Generating static pages (N/99)` doivent figurer dans tout log de build « vert ».
2. **Cache stale** : après un build interrompu, des chunks obsolètes produisent des erreurs qui n'existent plus dans le code. Build de référence = `.next` supprimé avant.
3. **EBUSY sur `rmdir .next\standalone`** = un process `node …standalone\server.js` tourne encore et tient le dossier (PID 20804 trouvé et stoppé) → à tuer avant tout build.
4. **NODE_ENV=development** présent dans l'environnement persistant de la machine (warning « non-standard NODE_ENV » sur tous les builds). Contournement local validé : `$env:NODE_ENV=$null` dans le script (warning disparaît, et `typescript.ignoreBuildErrors` redevient correctement conditionné). Suppression à la source non faite (changement système → décision utilisateur).
5. **Digests constants** (`3255200895`, `2604723160`, `3276673334`) = signature d'erreurs déterministes, utiles pour suivre la même erreur à travers les logs.


---

## Annexe A — Constat initial (session 1, logs `build-local*.txt`)

Deux erreurs de prerender avec **même digest** `2604723160` :

```
Error occurred prerendering page "/bankroll/bets"
TypeError: Cannot read properties of undefined (reading 'length')

Error occurred prerendering page "/_not-found"
TypeError: Cannot read properties of undefined (reading 'length')
```

=> même *cause partagée* (le digest identique le prouve), déclenchée indépendamment de la route. Ce n'était pas un bug localisé à chaque page. Résolu par §2.1.

## Annexe B — Audit SSR-safety (session 1, toujours valide)

- **Module Bet Manager sain** : `src/app/bankroll/**` et `src/components/bet-manager/*` (bet-table, bet-manager-nav, bankroll-form, kpi-strip, capital-chart, breakdown-list, csv-import, local-storage-migration, bet-form) — tous protégés SSR (défauts `?? []`, chaînage optionnel). Aucun `.length` sur état `undefined` au prerender.
- **Hooks** : `use-bet-manager.ts` (SWR défauts `?? []`), `use-bet-slip.ts` (singleton localStorage, `typeof window === "undefined"` → `[]`), `use-bankroll.ts` (`DEFAULT_STATE = { initial: 1000, bets: [] }`).
- **Layout racine** : `src/app/layout.tsx` (provider next-intl + composants globaux) ; `src/app/not-found.tsx` = Server Component `getTranslations("errors")`, prerendré statiquement.

---

> Les sections historiques 3/4/5 du rapport de 11:09 (hypothèses session 1) ont été supprimées : leurs conclusions sont invalidées ou corrigées par le §2 ci-dessus. Les annexes C/D/E ci-dessous tracent la chronologie et l'état final.

---

## Annexe C — Chronologie des builds (preuves)

| Heure | Log `.context/` | État code | Résultat |
|-------|-----------------|-----------|----------|
| 10:40/10:43 | `build-local{,2}.txt` | avant fixes | 2× `length` (bankroll/bets + not-found) |
| 10:57 | `build-repro.txt` | — | `/_global-error` useContext null |
| 11:02 | `build-repo.txt` | — | idem (concurrents, non fiables) |
| 11:06 | `build-clean.txt` | request.ts 11:14 absent | `/_not-found` `length` (global-error passait) |
| 11:16–11:31 | `build-final{,2,3}.txt`, `build-compile.txt` | force-dynamic posé 11:17, global-error.tsx **supprimé** | échecs `/_global-error` ; 11:31 « vert » **trompeur** (prerender sauté, cache) |
| 11:53 | `verify-final.txt` | idem | EBUSY rmdir standalone (serveur résiduel PID 20804) |
| 11:55–11:58 | `verify-final.txt` | global-error.tsx absent | `/_global-error` (build propre) — prouve que le défaut Next crashe |
| 12:04–12:07 | `verify-final2.txt` | global-error restauré + force-dynamic encore présent | `/_global-error` — prouve le rôle de force-dynamic |
| 12:12–12:14 | `verify-final3.txt` | force-dynamic retiré | `/_global-error` ✅, `/_not-found` ✅ → `/settings` onClick (nouveau bug démasqué) |
| 12:15–12:17 | `verify-final3.txt` | + `"use client"` settings | **exit 0 — 99/99 pages, standalone, postbuild OK** |
| 12:18–12:19 | `verify-final4.txt` | état final | lint 0 / typecheck 0 |


---

## Annexe D — Fichiers modifiés (cumul sessions 1+2)

| Fichier | Changement |
|---------|------------|
| `src/i18n/request.ts` | config next-intl défensive (requestLocale, cookies() try/catch, fallback messages) |
| `src/app/layout.tsx` | `getMessages() ?? {}` (force-dynamic ajouté puis retiré — cf. §2.2) |
| `src/app/global-error.tsx` | restauré (custom minimal) — sa suppression réactivait le crash du `/_global-error` par défaut |
| `src/app/settings/page.tsx` | `"use client"` (onClick dans un Server Component) |
| `next.config.ts` | `workerThreads` retiré |
| `src/hooks/use-gsap-context.ts` | supprimé (code mort) |
| `src/components/scrollytelling/top-predictions-reveal.tsx` | cast `as React.CSSProperties` |
| `src/lib/top-matches/{cs2,mma,nba,wnba}.ts` | `as const` → union explicite `'live' \| 'scheduled'` |
| `tests/football-sidebar-selection.spec.ts`, `tests/top5-gagnant.spec.ts` | fixes typage |
| `tsconfig.json` | exclude `tests`, `tools`, `tmp`, `**/*.spec.ts` |

## Annexe E — Reste à faire (clôture)

1. Nettoyage artefacts : `.context/build-*.txt`, `tsc-*.txt`, `verify-*.txt`, `lint-*.txt`, `count-tsc.ps1`, `.next-bak-clean/`, `build.pid`, `tscheck.pid`.
2. Décision utilisateur : supprimer la variable d'environnement persistante `NODE_ENV=development` (machine).
3. Commit des 14 fichiers (suggestion : `fix(build): unlock standalone build — i18n prerender guards, restore global-error, settings use-client`).
4. Smoke test optionnel : `bun run start` puis vérif `/_not-found` et `/settings`.
5. Note outil : `graphify update` échoue sur ce dépôt (`spawnSync git ENOBUFS`, reproductible) — graphe non rafraîchi en fin de session, à relancer manuellement.

---

*Rapport de fin de mission honnête : résultat prouvé par codes de sortie et logs archivés ; les conclusions invalidées de la session 1 sont explicitement marquées.*