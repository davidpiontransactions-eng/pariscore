# Benchmark Rotowire Soccer — Ideas to Steal pour PariScore

> bd ParisScorebis-gz7s · Audit réalisé 2026-05-23 via WebFetch https://www.rotowire.com/soccer/stats.php
> Posture CTO/Quant : focus *edge math + revenue lever*, pas copier sans value ajoutée.

---

## 1. Diagnostic Rotowire Soccer

### Couverture statistique exposée (player-level)

**Playing Time:** GP (games played), ST (starts), MIN (minutes), Y/YR/R (cards)

**Basic Stats:** G (goals), A (assists), SA (shots attempted), SOG (shots on goal), INT (interceptions), FC/FS (fouls committed/suffered), P (passes), AP (pass accuracy %), BLK (blocks), TKL (tackles)

**Advanced Stats:** EG (expected goals = xG), ES (expected shots), AW (aerial wins), BR (ball recovery rate), DW (defensive wins), Touches, Progressive Passes

**Set Pieces (différenciation forte) :** PK / PKG / PKM (penalty kicks taken/scored/missed), Free Kick metrics, CRN / CRNW / CRNACR (corner involvement)

**Goalkeeper/Defense :** GC (goals conceded), CS (clean sheets), SV (saves), PKC (penalty conversions saved)

### Filtres UX (puissants)

- **Ligues 12 :** EPL, EFL, UCL, UEL, La Liga, Serie A, Ligue 1, Bundesliga, MLS, Liga MX, NWSL, World Cup
- **Saisons 2015 → 2026** (rétro 10 ans)
- **Position :** GK, FWD, MID, DEF + hybrid roles
- **Week/Timeframe :** matchweek 1-46 OU cumulatif
- **Mode stats :** Total OU **"Per 90"** (normalisation playing time variance — KILLER feature pour comparer joueurs avec minutes différentes)

### Indicateurs uniques différenciateurs

1. **Dual mode Total / Per 90** — comparaison joueurs équitable (un attaquant 500min vs 2500min : seul Per 90 dit qui est efficace par minute)
2. **Set pieces tracker dédié** — qui tire PK / FK / corners par équipe (info exploitable bet "first goalscorer", "PK pris en match")
3. **xG + xA player-level** par minute jouée (granularité Rotowire >> PariScore actuel team-level only)
4. **Customizable column selection** checkbox-driven UX (50+ métriques sélectionnables)
5. **Betting ecosystem tie-in** — links DraftKings Pick6, FanDuel, BetMGM, Caesars, BetRivers (US-centric, prop bets focus)

### Layout & interactions

- Stats groups organized : Playing Time / Basic / Advanced / Set Pieces / GK-Def
- "Show Stats" button trigger data load post selection params
- Pas d'export CSV/tri/drill-down mentionné dans HTML brut

### Betting-specific integration

Liens vers :
- Soccer Player Props
- Soccer Picks + Top Soccer Picks & Prop Bets
- Premier League Top Goalscorer odds
- Champions League Top Goalscorer odds
- DraftKings Pick6 Cards multi-sportsbook props

---

## 2. Forces / Faiblesses

### Forces Rotowire

| Force | Description | Différenciation vs PariScore |
|---|---|---|
| **Player-level granularité** | 50+ stats par joueur, multi-ligues, multi-saisons | PariScore = team-level only (Poisson bivarié) |
| **Per 90 normalisation** | Mode togglable Total ↔ Per 90 | Absent PariScore |
| **Set pieces specialization** | PK/FK/corners tracker dédié | Absent PariScore — gap betting |
| **xG/xA player-level** | Underlying metrics par joueur | PariScore = xG team-level |
| **Filtres puissants 12 ligues + 10 saisons + position + week** | Filter exhaustif | PariScore = ligue+jour seulement |
| **Customizable columns** | UX power-users 50+ checkboxes | PariScore = colonnes fixes |
| **Betting integration broad** | Multi-sportsbook props links | PariScore = 1xBet affiliate only |

### Faiblesses Rotowire

| Faiblesse | Impact | PariScore avantage |
|---|---|---|
| **Pas d'edge math no-vig** | Pas de "value bet" detection | **PariScore : Poisson bivarié + edge calc + Kelly cap 25%** |
| **Pas de probabilités Poisson** | Stats descriptives sans prédiction | PariScore : Poisson + BTTS + O/U fair odds |
| **Pas de live in-play** | Static page stats refresh manuel | PariScore : SSE live + BSD WS push <5s |
| **US-centric** | DraftKings/FanDuel focus, peu UE | PariScore : EU + €19 SaaS positioning |
| **Pas de backtesting brier** | Pas de score fiabilité modèle | PariScore : `/accuracy` + Brier calibration |
| **Pas d'IA explicative** | Stats brutes sans synthèse | PariScore : Gemini AI Scout + analyse match |
| **No mobile-first** | Desktop-only layout 50 cols | PariScore : v12.49 PWA mobile complète |
| **Pas de bankroll/Kelly** | Pas de gestion stake | PariScore : `Mes Paris` + Kelly + plan 20%/j |
| **Pas de CLV tracker** | Pas de mesure skill parieur | PariScore : CLV by strategy (bd cty/pbf) |

---

## 3. Game Changers prioritaires PariScore (ideas-to-steal)

### 🥇 GC1 — Player Props Tab (PRIORITÉ HAUTE — revenue lever)

**Concept :** Onglet dédié "Joueurs" parallèle au tableau Matchs. Stats player-level par match : top scorers/assistants/cartonnés, xG par joueur, sur 1.5 tirs cadrés, etc.

**Data source actuelle PariScore :** API-Football fournit déjà player stats (`/players/topscorers`, `/teams/statistics`). BSD livedata frames incluent shotmap + buteurs.

**Effort estimé :** 4-6j (2j ETL agrégation player stats + 2j frontend tableau + 1j Poisson player-prop calc + 1j IA analysis player props)

**Revenue impact :** Onglet "Player Props" = +20-30% rétention selon analytics Rotowire engagement. Player props = marché EU explosion 2026.

**Math contribution :** Étendre Poisson bivarié → trivariate avec composante "buteur attendu" (λ_player = team_xG × player_share_attacking_minutes). UQD Bootstrap player-level.

### 🥈 GC2 — Per 90 Normalization Toggle (PRIORITÉ MOYENNE — KPI quality)

**Concept :** Toggle global mode "Total / Per 90" dans tous tableaux PariScore (Matchs, Joueurs, Stratégies). Affichage stats normalisées par minute jouée.

**Effort estimé :** 1-2j (compute Per 90 dans pipeline + UI toggle + cache key suffix)

**Math contribution :** Comparer xG/xA per 90 enlève biais playing time. Edge value bets joueurs sub jouent fortement biaisée sans Per 90.

**UX value :** Killer feature pour parieurs sérieux qui comparent "qui est efficace par minute".

### 🥉 GC3 — Set Pieces Specialists Tracker (PRIORITÉ MOYENNE — niche bet)

**Concept :** Section dans modal Insights "🎯 SPÉCIALISTES — Coup francs / PK / Corners" listing qui tire pour chaque équipe avec stats success rate.

**Data source :** API-Football `/fixtures/events?type=penalty` + `/players/squads` + BSD shotmap (déjà ingéré bd j6pz). Aggregate sur 30j fenêtre par joueur.

**Effort estimé :** 2-3j (ETL aggregation set pieces takers + UI section modal + Poisson edge "first goalscorer" si PK awarded)

**Bet value :** Marché "First Goalscorer" + "Anytime Scorer" + "Penalty Awarded" tous bénéficient. PariScore peut calculer fair odds spécialistes vs cote marché.

### 🏅 GC4 — Customizable Column Selection (PRIORITÉ BASSE — power-user UX)

**Concept :** Cog icon sur tableau Matchs → modal avec 30 checkboxes pour activer/désactiver colonnes (Poisson cols, edge col, xG, form L5/L10/L25, etc). Préférence persistée localStorage.

**Effort estimé :** 1j (UI + state mgmt + persist)

**ROI :** Différenciation UX vs OddAlerts mais power-user only.

### 💎 GC5 — Position-Aware Player Filter (PRIORITÉ BASSE — granularité)

**Concept :** Filtre Position (GK / FWD / MID / DEF / hybrids) appliqué dans onglet Joueurs futur (GC1). Permet "top buteurs MIL position" ou "défenseurs avec le plus d'xG".

**Effort estimé :** Inclus GC1 (filter natif onglet Joueurs)

**Bet niche :** Marchés "Defender to score" / "Midfielder to score 2+" exploitent ce filter.

---

## 4. Recommandation stratégique (CTO/Quant)

**Adopter :** GC1 (Player Props) en P1 avant GC3. Revenue lever clair + différenciation marché EU avec stack Poisson PariScore.

**Skip :** GC4 customizable cols → low ROI vs effort (power-user only, niche audience PariScore).

**Différenciation à préserver :** PariScore reste **edge math no-vig + IA explicative + UQD + Kelly + CLV**. Rotowire = stats descriptives sans value bet. PariScore peut ajouter granularité Rotowire SANS perdre l'edge math.

**Innovation backlog cross-ref :**
- GC1 connecté **Bayesian Value Radar** existing innovation (CLAUDE.md ligne 252) — player-level xG composante
- GC3 connecté à **Context Engine** existing innovation (météo + arbitres + spécialistes PK)
- GC2 Per 90 = quick win composable avec **UQD Bootstrap** (normalize avant perturbation)

**Effort total ideas-to-steal :** ~10-13j dev si GC1+GC2+GC3 priorisés. GC4+GC5 optionnels post-launch.

**Revenue model fit :** Player Props (GC1) justifie un tier Pro Plus €29/mo (vs €19 base) ou matchday pass Player Props €1.50 séparé.

---

## 5. Risques & contre-indications

| Risque | Mitigation |
|---|---|
| Player-level data quota épuisé API-Football | Plan PRO 7500 req/j (déjà actif). Cache 24h player stats. Backup BSD shotmap. |
| Onglet Joueurs dilue focus team-level Poisson | Garder team-level page principale. Joueurs = page séparée Pro+. |
| Set pieces takers data volatile (changement coach) | Refresh hebdo + flag "stale" si >14j. UI badge "à confirmer". |
| Per 90 normalisation trompeur (small sample <500min) | Filter implicite minimum 500min OU badge "sample-low". |

---

## Annexe — Sources analysées

- WebFetch GET https://www.rotowire.com/soccer/stats.php (2026-05-23)
- HTML structure : 50+ checkbox metrics groupés en 5 catégories (Playing/Basic/Advanced/Set Pieces/GK)
- Liens betting partners : DraftKings, FanDuel, BetMGM, Caesars, BetRivers, Pick6

*Document généré par bd `gz7s` 2026-05-23 — CTO/Quant analysis.*
