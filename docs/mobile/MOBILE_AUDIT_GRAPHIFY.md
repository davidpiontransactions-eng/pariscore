# Audit Mobile PariScore — Graphify Chart & Analyse d'Impact Capacitor

> Date : 2026-08-07 · Graphe `.graphify/graph.json` (build du 2026-08-05) ·
> Généré avec `graphify` CLI. Suivi beads : `ParisScorebis-f5ps`.

## 0. Artefacts Graphify Chart (cartographie visuelle)

| Artefact | Chemin | Régénération |
|---|---|---|
| Graphe SVG statique (9 MB) | `docs/mobile/graph-architecture.svg` | `graphify export svg --out docs/mobile/graph-architecture.svg` |
| Studio interactif (11.9 MB, autonome) | `docs/mobile/graphify-studio/studio.html` | `graphify studio export docs/mobile/graphify-studio` |
| Graphe source | `.graphify/graph.json` | `graphify update .` |

**Métriques du graphe** : 15 742 nœuds, 31 794 arêtes, 645 communautés,
densité 0.0003, degré moyen 4.04.

**Hubs principaux** (nœuds les plus connectés) :
1. `cn()` — `src/lib/utils.ts`, degré 153 → utilitaire de classes Tailwind,
   traversé par quasiment tous les composants UI.
2. `apiFetch()` — degré 75 (couches legacy `pariscore.js` / `server.js`) →
   tout le data-fetching legacy converge vers ce point unique.
3. Communautés 0-1 = backend legacy `server.js` ; communautés 2-4 = frontend
   legacy `pariscore.js` ; l'app Next.js (`src/`) est distribuée sur plusieurs
   communautés (UI tennis communauté 7/9/13/26, dashboard communauté 15…).

## 1. RSC vs Client Components (scan `src/`)

- **375 fichiers** TS/TSX dans `src/`, dont **206 `'use client'`** (55 %).
- L'app est une quasi-SPA : les pages sont des client components qui chargent
  les données via SWR/fetch ; les Server Components sont des coquilles minces.

| Route | Type | Chargement données |
|---|---|---|
| `/` (`src/app/page.tsx`) | Client | SWR + providers (`DashboardDataProvider`) |
| `/setpoint` | Client (ré-export de `/`) | idem |
| `/league/[league_id]/stats` | Client | `useSWR('/api/v1/leagues/{id}/stats')` |
| `/tennis/player/[slug]` | RSC mince → vue client | API player-stats |
| `/tennis/tournament/[slug]` | RSC mince → vue client | API BSD |
| `/tennis/stats` | Client | API stats-leaderboard |

**Routes dynamiques** `[league_id]`, `[slug]` **sans `generateStaticParams`** →
incompatibles telles quelles avec `output: 'export'` (aucun paramètre statique
pré-généré ; il faudrait lister tous les ids/slugs au build).

## 2. Dépendances serveur bloquantes pour un bundle local

- **55 route handlers** (`src/app/api/**/route.ts`) : v1, v2, tennis/bsd,
  football, mma, nba, wnba, cs2, f1, cycling, push, email, ai, stream.
  → `output: 'export'` **interdit** les route handlers : le build statique de
  l'app actuelle échoue immédiatement.
- `serverExternalPackages: ["better-sqlite3", "pariscore-services"]` (base
  native `pariscore.db`), Prisma, `fs` (caches JSON `data/`), `web-push`,
  `nodemailer` → server-only.
- `next.config.ts` : `output: "standalone"` (serveur Node/Bun requis).

## 3. APIs navigateur — compatibilité WebView Android

| API | Fichiers | Verdict WebView |
|---|---|---|
| `localStorage` | 11 (`use-favorites`, `use-bet-slip`, `use-bankroll`, `use-paper-trading`, `consent-provider`…) | ✅ OK (stockage isolé par app) |
| `EventSource` (SSE live) | `src/lib/live-stream-client.ts` | ✅ OK |
| `recharts` (charts SVG) | composants analytics/tennis | ✅ OK (SVG, pas de dépendance Canvas exotique) |
| Service worker + Web Push (`public/sw.js`) | PWA | ⚠️ inactif en WebView Capacitor → remplacer par FCM (`@capacitor/push-notifications`) en Phase 2 |
| `next/image` (optimiseur serveur) | partout | ✅ en mode remote (serveur) ; en mode local : `images.unoptimized` requis |
| `socket.io-client` | déclaré en dépendance, usage live legacy | ✅ OK |

## 4. Appels `/api` relatifs à reconfigurer (mode local uniquement)

- **23 occurrences** `fetch('/api/...')` + fetchers SWR construits sur des
  chemins relatifs (`useSWR('/api/...')`).
- **Mode remote (retenu)** : aucun changement — même origine que le serveur.
- **Mode local bundle (Phase 2)** : introduire `NEXT_PUBLIC_API_URL`
  (ex. `https://pariscore.fr`) + helper central `apiBase(path)` ; convertir
  les 23 fetchs + clés SWR ; ajouter CORS ou origine WebView
  (`capacitor://localhost`) côté serveur.

## 5. Décision d'architecture

**Phase 1 (livrée dans cette boucle d'ingénierie)** — **mode remote** :
le WebView Capacitor charge `https://pariscore.fr` (`capacitor.config.ts →
server.url`). Zéro refactorisation de l'app ; toutes les fonctionnalités
(API, SSE, push PWA via le site, auth) fonctionnent immédiatement.
`dist/` ne contient qu'une page fallback de redirection (hors-ligne).

**Phase 2 (roadmap)** — mode local bundle :
1. Déplacer `src/app/api` hors du build export (ou variante `next.config`).
2. `output: 'export'` + `generateStaticParams` pour les 3 routes dynamiques.
3. Base API absolue (`NEXT_PUBLIC_API_URL`) + CORS `capacitor://localhost`.

## 6. Risques & mitigations (Phase 1)

| Risque | Mitigation en place |
|---|---|
| Cleartext http (dev local) | `server.cleartext` calculé dynamiquement + `allowMixedContent` |
| Navigation hors domaine | `server.allowNavigation` restreint (`pariscore.fr` + localhost dev) |
| Bouton retour Android | géré nativement par `@capacitor/app` (history back) |
| Disque C: saturé (1,2 Go) | Projet natif + Gradle + builds sur E: (628 Go) |
| Icône source 394 px | upscale lanczos3 vers 1024 ; prévoir une source vectorielle dédiée avant publication Play |

## 7. Engineering Loop (boucle à 5 étapes)

Script canonique : `scripts/mobile-build.ps1` (wrappers npm `mobile:*`) :

| # | Étape | Commande | Artefact |
|---|---|---|---|
| 1 | assets | `gen-mobile-assets.js` + `capacitor-assets generate android` | `resources/icon.png` (1024²), `resources/splash.png` (2732²), 74 mipmaps/drawables |
| 2 | sync | `cap sync android` | assets web + plugins natifs dans `android/` |
| 3 | debug | `gradlew assembleDebug` | `app-debug.apk` |
| 4 | release | `gradlew assembleRelease` | `app-release.apk` (signé keystore) |
| 5 | verify | `apksigner verify` + `aapt2 dump badging` (+ `adb install`) | certificat + versionCode/name |

```bash
bun run mobile:apk          # boucle complète (1→5)
bun run mobile:release      # uniquement l'APK release signé
bun run mobile:verify       # vérification signature + badging
```

### Toolchain installée

| Élément | Chemin / version |
|---|---|
| **Projet Android natif** | **`E:\Android\Pariscore`** (jonction Windows : `./android` dans le repo) |
| JDK 21 LTS | `D:\Android\jdk\jdk-21.0.12+8` (Eclipse Temurin — requis par Capacitor 8 ; le JDK 17 `jdk-17.0.20+8` reste installé mais insuffisant : `invalid source release: 21`) |
| Android SDK | `D:\Android\Sdk` — platforms 36 (+34), build-tools 34/35/36, platform-tools |
| Gradle home | `E:\Android\gradle-home` (dist 8.14.3 + cache AGP 8.13.0) |
| Build outputs | `E:\Android\Pariscore\app\build\outputs\apk\{debug,release}` |
| Keystore | `D:\Android\keystore\pariscore-release.keystore` (RSA 2048, 10 000 jours, alias `pariscore`) |
| Secrets signature | `android/keystore.properties` (gitignoré ; template `.example` commité) |

> **Pourquoi E:** le disque C: est saturé (1,2 Go libre). Le projet natif, le
> cache Gradle et tous les artefacts de build vivent sur E: (628 Go libres).
> La jonction `mklink /J android E:\Android\Pariscore` rend le déplacement
> transparent pour `cap sync`, les scripts npm et git. Si le projet est
> re-cloné ailleurs, recréer la jonction ou déplacer le dossier `android/`.

### Configuration clé
- `capacitor.config.ts` : `appId=fr.pariscore.app`, `webDir=dist`,
  `server.url` surchargable via `CAPACITOR_SERVER_URL`
  (émulateur : `http://10.0.2.2:3000`), splash `#0E1217`.
- `android/app/build.gradle` : signature release depuis `keystore.properties`,
  `versionName 0.3.0` / `versionCode 3` (surcharge env `VERSION_NAME`/`VERSION_CODE`),
  buildDir délocalisable via `ANDROID_BUILD_DIR`.
- `android/variables.gradle` : compileSdk 36, targetSdk 36, minSdk 24
  (exigence Play ≥ 35 respectée).

4. Push natif FCM via `@capacitor/push-notifications`.
5. Cache offline (SWR persist ou `@capacitor/filesystem`).

## 6. Risques & mitigations (Phase 1)

| Risque | Mitigation en place |
|---|---|
| Cleartext http (dev local) | `server.cleartext` calculé dynamiquement + `allowMixedContent` |
| Navigation hors domaine | `server.allowNavigation` restreint (`pariscore.fr` + localhost dev) |
| Bouton retour Android | géré nativement par `@capacitor/app` (history back) |
| Disque C: saturé (1.2 Go) | JDK/SDK/Gradle/build sur D: (`scripts/mobile-build.ps1`) |
| Icône source 394 px | upscale lanczos3 → 1024 ; prévoir une source vectorielle dédiée |

## 7. Boucle d'ingénierie (5 étapes)

Implémentée dans `scripts/mobile-build.ps1` (+ scripts npm `mobile:*`) :

```
1. assets   → resources/ (icon 1024, splash 2732, dist fallback) + déclinaisons natives
2. sync     → npx cap sync android
3. debug    → gradlew assembleDebug        → app-debug.apk
4. release  → gradlew assembleRelease      → app-release.apk (signé keystore)
5. verify   → apksigner verify + aapt2 badging (+ adb install -Install)
```
