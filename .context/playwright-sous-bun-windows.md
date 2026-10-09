# Playwright sous Bun ne démarre pas Chromium sur Windows

**Statut** : règle d'environnement, vérifiée par mesure le 2026-10-09.
**Applicabilité** : machine Windows du dépôt pariscore (et tout poste où bun wrappe node).

## Symptôme

`chromium.launch()` sous Bun reste muet puis échoue sur `TimeoutError: launch: Timeout 90000ms
exceeded`. Le pid du navigateur **apparaît bien** dans le call log, mais la négociation
`--remote-debugging-pipe` n'aboutit jamais. Ajouter `--disable-gpu`, allonger le timeout, ou
passer par `connectOverCDP` sur un port de debug ouvert à la main : **aucune amélioration**.

## Diagnostic par élimination

Mesures sur cette machine, 2026-10-09 :

| Essai | Résultat |
|---|---|
| Binaire seul `chrome-headless-shell.exe --version` | **exit=0**, `Google Chrome for Testing 153.0.8010.12` |
| Port CDP ouvert à la main (`--remote-debugging-port`) | **s'ouvre**, `/json/version` répond |
| `chromium.launch()` sous **Bun** | **timeout 90 s** (et 180 s sans flags) |
| `connectOverCDP` sous **Bun** | **timeout 30 s** — websocket bloqué aussi |
| `chromium.launch()` sous **Node** | **OK en 384 ms**, 2+2=4, screenshot rendu |

Le moteur n'est pas en cause. Le binaire est sain. Ce qui bloque est la couche processus /
websocket du runtime Bun au contact de Playwright.

## Règle

**Toute spec Playwright se lance sous Node, jamais sous `bun`.**

```bash
npx playwright test tests/quelque.spec.ts    # ✅
bunx playwright test ...                     # ❌ timeout 90 s
```

Le dépôt suivait déjà cette contrainte sans la nommer : `npm test` vaut
`node scripts/run-bun.js test` (`package.json:20`) — bun est wrappé dans node plutôt
qu'invoqué directement. La CLI `playwright` est un script Node, donc `npx` marche.

## Pièges voisins rencontrés au passage

- **Chemin en backslash** : `npx playwright test tests\mon.spec.ts` renvoie
  « No tests found » — Playwright lit l'argument comme une regex. Toujours
  `tests/mon.spec.ts` en slash.
- **`bun run test:visual` n'existait pas** dans `package.json` malgré une mission qui
  l'invoquait. Le script a été ajouté (`tests/pip-visual.spec.ts`,
  `tests/bento-visual-qa.spec.ts`, `tests/match-cards-visual.spec.ts`).
- **`data-state` n'est PAS un sélecteur sûr** : Radix UI (menus, dialogs, dropdowns du
  header) pose `data-state="open"` / `"closed"` sur ses déclencheurs. Un compteur
  `[data-state]` sur une page PariScore compte les menus du header. Discriminer par la
  **structure** : notre badge est un `<span>`, les déclencheurs Radix des `<button>`.
  Voir `tests/match-cards-visual.spec.ts`.
- **`logs/` est purgé par des sessions parallèles** pendant l'exécution. Un rapport écrit
  là-bas disparaît avant lecture et masque une erreur. Écrire dans `%TEMP%` et surtout
  **lire le code de sortie**, qui survit.
- Le serveur dev local met **~57 s** à répondre (`bun run dev`), et la base locale est
  **vide** : aucun match n'est rendu en local. Une QA visuelle locale valide donc le
  rendu de la page, pas le rendu des cartes — il faut la prod, ou des fixtures, pour le
  second.
