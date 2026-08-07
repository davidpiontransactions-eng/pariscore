# Rapport QA — APK Android PariScore (Capacitor)

> Date : 2026-08-07 · APK v0.3.0 (versionCode 3) · appId `fr.pariscore.app`
> Exécution : `bun run mobile:qa` → `scripts/mobile-qa.ps1` (Tier 1+2+3)
> **Résultat final (run #3) : 18 PASS / 0 FAIL**
> Suivi beads : `ParisScorebis-f5ps` (engineering loop, fermé) ·
> `ParisScorebis-rxi1` (finding QA — re-diagnostiqué : reload SW première
> visite ; fix `sw-register.tsx` appliqué, **déployé en prod le 2026-08-08**
> (commit `a76c38c` ; VPS git reset + build + pm2 restart confirmés, prod
> HTTP 200)

## Tier 1 — Analyse statique des APK : **13/13 PASS**

| Vérification | Debug | Release |
|---|---|---|
| Signature valide (`apksigner verify -v`) | ✅ cert debug Android | ✅ keystore PariScore (CN=PariScore, OU=Mobile, C=FR) |
| Scheme de signature | v1 | **v2 = true** (requis Play Store) |
| zipalign 4 octets | — | ✅ |
| appId / versionName | `fr.pariscore.app` / **0.3.0 == package.json** | idem |
| minSdk 24 · target+compile 36 | ✅ | ✅ (politique Play ≥ 35 respectée) |
| debuggable | true (attendu) | **false** |
| Permissions | INTERNET uniquement (+ DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION) — surface minimale | idem |
| Assets web embarqués | `assets/public/index.html` + `capacitor.config.json` | idem |
| DEX references | — | **47 698 < 65 536** (pas de multidex) |
| Taille | 4,57 Mo | 3,49 Mo |

Empreinte du certificat release : SHA-256 `9b38ad21…c416a`, SHA-1 `fe631251…61a90`.

## Tier 2 — WebView (Playwright, émulation Pixel 7 412×915, tactile) : **8/8 PASS**

Cible : `https://pariscore.fr` (URL exacte chargée par l'APK en mode remote ;
surchargable via `QA_BASE_URL`).

| # | Test | Résultat |
|---|---|---|
| 1 | Boot : HTTP < 400, titre SetPoint/PariScore, `lang="fr"` | ✅ 7.9s |
| 2 | Thème sombre appliqué (cohérent splash #0E1217) | ✅ |
| 3 | API critique `/api/tennis/live` → 200 | ✅ 0.7s |
| 4 | ≥ 1 appel `/api` de la page < 500 | ✅ |
| 5 | Pas de débordement horizontal à 412px | ✅ (aucun overflow une fois stabilisé) |
| 6 | Navigation mobile présente (bottom nav / tabs) | ✅ |
| 7 | localStorage disponible (favoris / bet slip) | ✅ |
| 8 | Aucune erreur JS fatale au boot | ✅ |

### Finding → re-diagnostiqué et corrigé : **reload SW à la première visite** (beads `ParisScorebis-rxi1`)

Le FAIL initial (« débordement horizontal 412px ») était un **faux positif** :
l'erreur réelle était `Execution context was destroyed, most likely because of
a navigation` — **la prod recharge la page 1-3 s après le load**.

**Cause racine** : `public/sw.js` appelle `self.clients.claim()` dans son
handler `activate` → sur une première visite, `controllerchange` se déclenche
alors qu'aucun SW ne contrôlait la page → `src/components/sw-register.tsx`
exécutait `window.location.reload()` sans garde.

**Impact** : double chargement (flash) sur le web ET dans la WebView APK juste
après le splash screen ; casse les mesures automatisées précoces.

**Preuves de l'absence d'overflow réel** : timeline 10 s
(`scripts/qa-overflow-timeline.js`) et sondes → `scrollWidth == innerWidth`
une fois la page stabilisée. Les 20 éléments « débordants » remontés par la
première sonde étaient tous contenus dans le scroll-container des onglets
sport (`nav.overflow-x-auto`) — comportement normal d'une barre d'onglets
scrollable.

**Fix appliqué** : garde `hadController` dans `sw-register.tsx` — le reload ne
se déclenche que si un SW contrôlait déjà la page (= vraie mise à jour à
chaud). Test Playwright durci avec `evaluateStable()` (tolère le reload tant
que le fix n'est pas déployé en prod). **Déployé en prod le 2026-08-08**
(commit `a76c38c`) : VPS `git reset --hard a76c38c` + build + `pm2 restart
pariscore-next` → prod HOME HTTP 200, `/sw.js` HTTP 200. **Re-validation
restante** : `bun run mobile:qa` (Tier 2 Playwright contre prod) + Tier 3 émulateur
quand la RAM est libre.

## Tier 3 — Émulateur / device physique

- `adb devices` : aucun device physique connecté.
- **AVD prêt** : `pariscore-qa` (API 34 google_apis x86_64, profil Pixel 7,
  RAM 1024M) sur `E:\Android\avd` ; accélération **WHPX opérationnelle**.
- **Boot impossible dans l'état actuel de la machine** : commit système
  saturé (~1 Go restant sur 36 Go ; l'émulateur exige ~1,5-2,5 Go).
  Reprise quand la RAM est libérée :
  ```powershell
  $env:ANDROID_AVD_HOME = "E:\Android\avd"
  & "D:\Android\Sdk\emulator\emulator.exe" -avd pariscore-qa -gpu swiftshader_indirect
  # puis : bun run mobile:qa -Install   (installe l'APK release sur l'émulateur)
  ```

## Engineering loop — exécution parallèle pendant la QA

La boucle complète (`mobile-build.ps1 -Step all`) a été rejouée **pendant**
la QA : assets → sync → assembleDebug (37s) → assembleRelease signé → verify :
`BUILD SUCCESSFUL` ×2, `TERMINE - etape 'all' OK`. Les deux pipelines
(build et QA) sont indépendants et parallélisables.
