# Session — Insights v2 « Brief Match » (2026-08-25)

**Bead** : `ParisScorebis-w3dk` · **Statut** : ✅ livré (QA passée)
**Scope** : Redesign complet du popup prematch foot (`#insights-modal`, `openInsights`) — hero décisionnel + verdict Poisson vs marché + nav 5 zones consolidées + sparkline cotes.

## Décisions de conception validées

| Décision | Choix |
|---|---|
| Structure | Option 1 « Brief Match » : hero sticky + verdict permanent + 5 zones |
| Zones | ⚡ Analyse / 👥 Joueurs / 📊 Historique / 🌍 Contexte / 🤖 IA (+ 🔴 Live conditionnel si `live_score`) |
| Mapping 13 onglets | Analyse: stats+graphique+corners · Joueurs: joueurs+compos · Historique: h2h+classement+shotmap · Contexte: resume («Dossier match») · IA: powerscore+scouting |
| Socle v1 | Chart Modèle vs Marché, timeline forme L10, sparklines cotes, 3 choses à savoir, histoire du match |
| Stratégie | Transformation in place du modal existant (rollback = git revert), builders des onglets réutilisés tels quels |

## Journal d'exécution

### Phase 0 — Setup traçabilité ✅
- Bead créée et claimed : `ParisScorebis-w3dk`
- Fichier traçabilité créé : ce fichier

### Phase 1 — Shell v2 (`pariscore.html`) ✅
- Remplacement header/tabs → hero (`ins2-hero`, countdown `ins2-countdown`, barre cotes `ins2-oddsbar`, chips `ins2-chips`) + verdict repliable (`ins2-verdict`, bars/edge/conf/facts/story/formline) + zonebar/subtabs
- CSS `ins2-*` inséré après `.ins-tab.active` (~l.4573) : tokens charter, thème clair (`body[data-cf-light="1"]`), mobile bottom-sheet (`html.ps-mobile-v2`)
- Largeur panel portée à 920px desktop
- **Verify** : structure HTML valide, classes compatibles legacy conservées (`.ins-tabs` sur subtabs pour `_toggleBsdTabs`)

### Phase 2/3 — Moteur JS (`pariscore.js`) ✅
- Section « INSIGHTS V2 » insérée avant `buildScoutingTab` : config zones, `insShowZone()`, `ins2RenderSubtabs()`, countdown, `ins2ComputeVerdict()` (Poisson `m.poisson` vs dévigé `m.fair`, edge ≥4 pts), `ins2Confidence()` ★1-5 heuristique complétude, `ins2BuildFacts()` (scoring edge/rangs/arbitre/séries/overs), `ins2BuildStory()` (templates zéro-LLM), `ins2FormTimeline()` (L10 depuis `homeAllFixtures/awayAllFixtures`, fallback form string)
- Hooks : `ins2PreRender(m)` pré-fetch dans `openInsights` (fonctionne même hors Pro) ; `ins2Enrich(d,m)` post-fetch ; flag `window._ins2BsdVisible` ; cleanup timer dans `closeInsights`
- Bug corrigé en QA : typo `_ins2esc`→`_ins2e` + signature `_ins2BarsRow(srcLabel, vals, isMarket)` avec classes segments h/d/a
- **Verify** : `node --check pariscore.js` OK

### Phase 4 — Sparklines cotes ✅
- `server.js` : store mémoire `_prematchOddsHistory` (dédup 4 min, cap 120 pts ~24h), `recordPrematchOddsSnapshot()` appelé après CHAQUE enrichissement (cron 5 min + route on-demand) — pas seulement le flux multi-books BSD (souvent vide localement)
- Route publique hors gate Pro : `GET /api/v1/odds-history/:id` (downsample 60 pts, direction shortening/drifting/flat)
- Client : `ins2LoadSpark()` SVG polyline couleur vert (cote baisse = argent entrant) / rouge (dérive), label `COTE 1 x→y ▲▼`, cachée < 3 points
- Piège découvert : la page charge **pariscore.app.js** (bundle copie de pariscore.js, réf. `pariscore.html:26004`) → sync obligatoire `copy /Y pariscore.js pariscore.app.js`
- **Verify** : snapshots capturés 5/5 matchs candidats ; rendu validé par mock Playwright (`visible:true, svg:true, "COTE 1 2.10→1.85 ▼", #00e676`)

### Phase 5 — Qualité & QA ✅
| Gate | Résultat |
|---|---|
| `node --check server.js` / `pariscore.js` | ✅ OK |
| QA Playwright desktop 1366px (`scripts/qa-insights-v2.cjs`) | ✅ ok:true — 6 zones, subtabs 3, bars ✓, edge ✓, conf ★★★☆☆, facts 2, story ✓, formdots 12, countdown ✓ |
| QA Playwright mobile 390×844 (bottom-sheet) | ✅ ok:true — mêmes métriques |
| Sparkline mock (`scripts/qa-spark-v2.cjs`) | ✅ visible + SVG + couleur direction |
| Captures | `.context/qa-insights-v2-desktop.png` · `.context/qa-insights-v2-mobile.png` |
| `bun run lint` | ⚠️ 3 erreurs **préexistantes** `src/app/api/v1/basketball/h2h/*` (hors périmètre, non touchées) — 0 erreur sur fichiers modifiés |
| `bun run typecheck` | ⚠️ bruit préexistant `tools/*` vendored — 0 erreur sur fichiers modifiés |

## Environnement QA local (reproductible)
```
copy /Y pariscore.js pariscore.app.js        # sync bundle servi par la page
scripts\qa-start-server.cmd                  # PORT=3210 + MATCHES_AUTH_BYPASS=1 + TENNIS_DEV_BYPASS=1
node scripts/_probe-insights.cjs http://localhost:3210   # sonde diagnostic moteur
node scripts/qa-insights-v2.cjs http://localhost:3210    # QA E2E desktop+mobile
node scripts/qa-spark-v2.cjs http://localhost:3210       # rendu sparkline mocké
```

## Limitations connues / suite
- Snapshots cotes démarrent au déploiement : sparklines pleines après ~15 min d'accumulation prod (cron 5 min)
- Insights payload reste gated Pro : verdict/hero/facts pré-fetch fonctionnent pour tous ; enrich complet réservé Pro (fallback gracieux sans crash)
- `pariscore.app.js` doit être resynchronisé à chaque évolution de `pariscore.js` (convention trio legacy, déjà géré par deploy si les deux fichiers sont commités)
- Zone IA fusionnée visuellement plus tard (Power Score et Scout gardent leurs flux SSE distincts pour l'instant)

## Fichiers modifiés
- `pariscore.html` — shell DOM v2 + CSS `ins2-*`
- `pariscore.js` — moteur INSIGHTS V2 + hooks openInsights/closeInsights (+ copie `pariscore.app.js`)
- `server.js` — snapshots cotes prematch + route `/api/v1/odds-history/:id`
- `scripts/{qa-start-server.cmd, qa-insights-v2.cjs, _probe-insights.cjs, qa-spark-v2.cjs}` — outillage QA réutilisable
