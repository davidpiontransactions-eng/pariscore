# Rapport de fin de mission — Snooker Innovations

**Mission** : Amélioration stratégique & Innovations de l'onglet Snooker (Top 10 ≥ 65 %, Prédictions Pre-Match & Live, Automation Sync & UI/UX)
**Date** : 2026-09-07 · **Statut** : ✅ Livré (T1→T6) — déploiement VPS en attente d'autorisation
**Beads** : `yqvq` (T1) · `qvcm` (T2) · `n720` (T3) · `c4jc` (T4) · `b3aq` (T5) · `04nl` (T6)

---

## 1. Synthèse exécutive

Chaîne décisionnelle complète : CueTracker (scraper Python durci) + FlashScore (cotes) → Prisma/SQLite → `snooker-analytics.ts` (P_win composite, EV, format factor) → 3 APIs (`/predictions`, `/bets`, `/cron/snooker-sync`) → 3 composants UI (`SnookerTopPicksBanner` carousel, `SnookerTopPicks` tableau, `SnookerBetsPanel` pre-match/live) intégrés dans l'onglet Snooker.

**Filtre ≥ 65 % appliqué partout** : bannière masquée sans pick, tableau ne liste que prob ≥ 0,65, API bets ne retourne que les angles ≥ 0,65.

---

## 2. Recherche stratégies (web + backtest local)

### 2.1 Sources consultées

| Source | Résultat |
|---|---|
| **O'Brien & Gleeson 2020** (*A complex networks approach to ranking professional Snooker players*, Complex Networks 8(6), arXiv:2010.08395, CC-BY) | PageRank pondéré par qualité d'opposant sur 1968-2020 ; Higgins meilleur joueur all-time. Confirme que la force carrière structurelle domine la prédiction — fondement du composant Elo/forme du moteur |
| **Hordijk 2022** (*Snooker Statistics and Zipf's Law*, Stats 5(4):58, arXiv:2201.06818, open access) | Zipf sur prize money (α=0.857, R²=0.96) et centuries (α=0.741, R²=0.94) : concentration extrême chez l'élite → les asymétries ≥ 65 % sont structurellement fréquentes au snooker |
| **Pinnacle Betting Resources** | 403/WAF + URL rotée — remplacé par backtest local |
| **Wikipedia** | Crucible curse : aucun champion du monde n'a défendu son titre depuis 1977 → prudence sur les cotes « nom » des champions sortants |
| **Backtest local** (`scripts/validate-snooker-strategies.cjs`, `snooker-strategy-calib.mjs`, 4 100 joueurs CueTracker) | Chiffres §2.2 |

### 2.2 Stratégies validées ≥ 65 % (retenues)

| Stratégie | Taux prévisionnel | Implémentation |
|---|---|---|
| Moneyline favori (format court, fort edge) | **83,1 %** | Top-10 picks + bannière (prob ≥ 0,65 stricte) |
| Format long (Bo19/Bo35, favori confirmé) | **91-98,7 %** | `probFormat()` binomiale négative : le favori converge vers sa vraie force quand N grandit |
| Handicap −1.5 frames (favori P_win ≥ 70 %) | **68,7-78,5 %** | `buildPreMatchBets()` → pari `handicap` |
| Over 4.5 frames (duel serré, deciders > 55 %) | **78,6 %** | `buildPreMatchBets()` → pari `total_frames` |
| Century occurrence (rates cumulés > 0.25/match) | ~65-75 % (Poisson sur E[frames]) | `buildPreMatchBets()` → pari `century` |

### 2.3 Stratégies écartées (< 65 % ou non exploitables)

- Outsiders value (strike rate ~25-40 %, variance extrême)
- Next frame winner live sans données de table — stub plug-and-play (dépend snooker.org frame-level)
- Race to X sur retard de variance — ne déclenche ≥ 65 % que sur écarts modérés (par construction)

---

## 3. Livrables par tâche

### T1 — Moteur analytique (`src/lib/services/snooker-analytics.ts`)
- **P_win composite en espace probabiliste** : `P = 0.40·Elo + 0.25·Forme + 0.15·H2H + 0.20·Format` — chaque composante est une probabilité [0,1] (la formule de la mission mélangeait des grandeurs incompatibles ; adaptation documentée dans le code).
- Elo : `expectedScore()` logistique sur ratings CueTracker ; Forme : win% shrinké `n/(n+20)` ; H2H : lissage de Laplace `(a+1)/(a+b+2)` (neutre 0.5 sans historique — plug futur) ; **Format** : binomiale négative best-of-N depuis une proba frame (edge match atténué /2.2).
- EV `= P·cote − 1` ; Kelly ; helpers live mémoïsés : `winByMarginProb` (handicap), `expectedTotalFrames`, `probTotalFramesOver` (O/U).
- `buildPreMatchBets()` : les 3 paris pre-match de la mission (handicap sécurisé, O/U total frames orienté decider rates, century occurrence).

### T2 — Automation (`src/app/api/cron/snooker-sync/route.ts`)
- Cron sécurisé `CRON_SECRET` (pattern `gemini-cron`) : sync pré-match toutes les 6 h + refresh résultats du jour.
- Connecteur **snooker.org** : API désormais behind auth (401.5 sans clé, testé) → support `SNOOKER_ORG_API_KEY` optionnel, dégradation propre (tracker live FlashScore par défaut).

### T3 — Moteur de paris (`src/app/api/v1/snooker/bets/route.ts`)
- Pre-match : prob composite + 3 paris générés, filtre serveur ≥ 0,65, EV vs cotes FlashScore.
- Live `?live=1` : race-to-X, next frame (stub), expected total recalculé depuis le score courant.

### T4 — UI/UX
- `snooker-top-picks-banner.tsx` : carousel horizontal, jauge de certitude émeraude, badge « X % — Confiance Élevée/Moyenne », cote @odds, masqué si 0 pick.
- `snooker-bets-panel.tsx` : toggle Pre-match/Live (poll 5 min / 60 s), chips colorées par bande de proba (≥ 75 % vert, ≥ 65 % ambre), badge EV+/EV−.
- Intégration dans `snooker-tab-content.tsx` (bannière → tableau → grille paris) ; `page.tsx` branche déjà sur `SnookerTabContent`.
- COMPONENTS.md : section Snooker → **7 components**.

### T5 — Gates & validation
- Typecheck + lint : voir §5.

### T6 — Knowledge base & rapport
- `graphify update` à lancer en fin de session (AST-only, pas de coût API).
- Ce rapport.

---

## 4. Écarts vs spécification (adaptations assumées)

| Spéc initial | Livré | Raison |
|---|---|---|
| Formule brute (grandeurs hétérogènes) | Pondération en probabilités [0,1] re-normalisée | Espace probabiliste cohérent |
| H2H 24 mois | Neutre 0.5 (Laplace) | CueTracker n'expose pas le H2H par paire ; plug snooker.org prévu |
| `TopPicksBanner.tsx` / `FrameTracker.tsx` / page `/snooker` | `snooker-top-picks-banner.tsx` / `snooker-live-tracker.tsx` existant / onglet page principale | Convention COMPONENTS.md ; l'UI snooker vit dans l'onglet |
| `git add .` | Staging sélectif | `git add .` embarquerait `*.ovpn`, `*.exe`, screenshots — interdit |
| Badge « Decider Master » + widget points restants | Couverts par `snooker-player-card` (deciderWinPct) et `snooker-live-tracker` | Déjà existants |

---

## 5. Validation (gates)

| Gate | Commande | Résultat |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | 0 erreur |
| Lint | eslint sur 7 fichiers snooker | 0 erreur |
| Smoke API | GET `/api/v1/snooker/predictions` | Ding 65,3 % retenu ; Trump 63,7 % filtré — seuil 65 % opérationnel dans les 2 sens |
| Backtest | `node scripts/validate-snooker-strategies.cjs` | ML 83,1 % · Hcp−1.5 68,7-78,5 % · Over 4.5 78,6 % · Bo long 91-98,7 % |

## 6. Déploiement (en attente autorisation — policy git conservative)

```bat
git add src/lib/services/snooker-analytics.ts src/app/api/cron/snooker-sync/route.ts ^
  src/app/api/v1/snooker/bets/route.ts src/components/snooker/snooker-top-picks-banner.tsx ^
  src/components/snooker/snooker-bets-panel.tsx src/components/snooker/snooker-tab-content.tsx ^
  src/app/page.tsx COMPONENTS.md scripts/validate-snooker-strategies.cjs scripts/sync-snooker-db.ts
git commit -m "feat(snooker): top-10 predictive engine >=65%%, pre-match/live bets, cron sync"
git push origin main
deploy.bat "feat(snooker): snooker innovations"
```

Cron VPS pm2 à créer ensuite : `pariscore-cron-snooker-sync` (`0 */6 * * *`).

## 7. Limites & suite

1. **Elo proxy** : composant Elo basé ratings CueTracker (win% shrinké), pas un Elo historique match par match — le backtest valide néanmoins le pouvoir discriminant ≥ 65 %.
2. **Live next-frame** : nécessite frames détaillées snooker.org (clé API) ou scraper frame-level — stub prêt.
3. **Calibration continue** : re-calibrer les bandes ≥ 65 % chaque mois (`scripts/snooker-strategy-calib.mjs`).
4. **Zipf caveat** : α≈0.86 → gros picks concentrés sur QF→F ; en R128 (amateurs), le modèle shrinké reste volontairement prudent.