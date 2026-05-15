# PariScore — Journal des modifications

---

## [v10.15] — 2026-05-15

### Ajouté — Gamme tarifaire par sport + paywall réel (client + serveur)

**Tarifs (pariscore.html)**
- Grille unique 8 offres segmentées par sport : GRATUIT 0€ · MATCHDAY FOOT 1,50€/24h · MATCHDAY TENNIS 1,50€/24h · DUO MATCHDAY 2,50€/24h · PRO FOOT 19,5€/mois · PRO TENNIS 19,5€/mois · DUO PRO 30€/mois · ANNUEL DUO 22€/mois (-27%).
- Réconciliation des 3 surfaces tarifaires divergentes (grille / bannière / upsell quota).
- Inscription obligatoire : `openModal()` redirige vers le vrai formulaire `openAuthModal('register')` ; faux `#modal` neutralisé.

**Verrou client (Phase 1)**
- `psAccess()` dérive foot/tennis/pro du rôle JWT. `showPage()` bloque tout module non autorisé → page verrou + CTA. Liens nav masqués selon le tier.
- Matchs freemium : 5 ligues UE uniquement, AI Scout + boutons IA masqués (`body.ps-free`).

**Verrou serveur (Phase 2 — vrai paywall)**
- `srvAccess(req)` + `srvPlanGate()` centralisé en tête de `http.createServer`.
- `/api/v1/matches` exige un compte (401 sinon) + filtre 5 ligues UE serveur si pas footPro.
- Tennis / ai-scout / strategies / hot-picks / sure-bets / trends / predictions / insights / deep-stats / bets / bankroll / alerts → 403 hors plan.
- Rôles étendus : `pro_foot/pro_tennis/pro_all/matchday_foot/matchday_tennis/matchday_duo` (back-compat `premium`=`pro_all`, `matchday`=foot).

**Quota freemium**
- 10 consultations `/api/v1/matches` par jour et par compte (`incrementMatchesView`, reset 24h). Au-delà → 403 `FREEMIUM_VIEW_QUOTA` + panneau upsell front. Polls live non décomptés.

**Limite connue** : attribution des nouveaux rôles à l'achat non câblée (Stripe : 1 seul price ID, webhook signe `matchday`). Nécessite price IDs distincts + metadata sport → rôle.

---

## [v10.3] — 2026-05-14

### Ajouté — Tennis BSD (REST proxy + MCP passthrough + fallback ESPN)

**Découverte source**
- `/tennis/mcp/` = serveur Model Context Protocol JSON-RPC pour clients LLM (Claude Desktop, ChatGPT, Gemini) — pas un flux REST de données.
- Vraies routes REST tennis BSD : `/tennis/api/v2/matches/` `/matches/live/` `/players/` `/rankings/` `/tournaments/` `/predictions/`.
- Gating : Sports Addon $5/mo. Probe HTTP 402 `{"code":"addon_required"}`.

**Backend (server.js)**
- Constantes `BSD_TENNIS_ENABLED` (flag env, défaut OFF), `BSD_TENNIS_BASE`, `BSD_TENNIS_MCP_URL`, `BSD_TENNIS_UPGRADE_URL`.
- Helper `bsdTennisFetch(pathSuffix, retries=2)` — GET authentifié (`Authorization: Token …`) avec retry exponentiel et mapping `402 addon_required` → throw `ADDON_REQUIRED`.
- Wrapper `handleTennisBSD(suffix, cacheKey, ttlMs)` : gate 503 si flag OFF, cache via `apiCacheGet/Set`, mapping erreurs (402 addon, 502 upstream).
- 7 routes proxy REST + 1 passthrough MCP :
  - `GET /api/v1/tennis/live` (no cache)
  - `GET /api/v1/tennis/matches?date=YYYY-MM-DD` (TTL 30 min)
  - `GET /api/v1/tennis/match/:id` (TTL 5 min, ID validé `[A-Za-z0-9_-]+`)
  - `GET /api/v1/tennis/rankings?tour=ATP|WTA` (TTL 6h)
  - `GET /api/v1/tennis/tournaments` (TTL 6h)
  - `GET /api/v1/tennis/players/:id` (TTL 1h, ID validé)
  - `GET /api/v1/tennis/predictions/:id` (TTL 5 min, ID validé)
  - `POST /api/v1/tennis/mcp` — passthrough JSON-RPC brut vers `/tennis/mcp/`, body `readBodyLimited` 1 Mo.
- Path traversal/injection bloqué : regex `/^[A-Za-z0-9_-]+$/` sur match/player IDs → 400 `invalid_match_id`/`invalid_player_id` avant tout appel BSD.

**Frontend (pariscore.html)**
- Nouveau modal `#tennis-detail-modal` (backdrop blur, animation slide-in, close button) + ~30 lignes CSS dédiées.
- Fonctions `openTennisDetail(matchId)`, `closeTennisDetail()`, `renderTennisDashboard(data, preds)`, `_fetchAndRenderTennisDetail(id)`.
- Polling 30 s automatique tant que modal ouverte, cleared à la fermeture (`_tennisDetailInterval`).
- Dashboard rendu : header (joueurs + ranks + tournoi/round/surface), tableau sets-by-sets, grille serve stats (aces, double fautes, % 1er svc, breakpoints), barre ML prédiction (player1 vs player2 win %), timeline point-by-point (30 derniers).
- États 503/402 : CTA upgrade vers `https://sports.bzzoiro.com/pricing/`.
- `renderTennisLive` : lignes clickables (`tennis-row-clickable` + `onclick="openTennisDetail(id)"`) → ouvre modal détail BSD au clic.

**Configuration**
- Variable env `BSD_TENNIS_ENABLED=false` par défaut — passer à `true` après souscription addon.

**Vérifications réalisées**
- `node --check server.js` — OK.
- Toutes routes BSD avec flag OFF → 503 `{"error":"tennis_bsd_disabled","fallback":"espn"}` (7 REST + MCP POST).
- Path traversal `/api/v1/tennis/match/..%2F..%2Fetc%2Fpasswd` → 400 `invalid_match_id` (regex guard antérieur au call BSD).
- UI : `openTennisDetail('abc123')` → modal s'ouvre, affiche état "Détail BSD désactivé" + CTA addon. `closeTennisDetail()` → interval purgé, `display:none`.

---

## [v10.2] — 2026-05-14

### Ajouté — Tennis live (ESPN ATP+WTA) — onglet dédié + route isolée

**Backend (server.js)**
- Nouvelle route `GET /tennis/api/v2/matches/live/` — retourne tableau JSON normalisé (player1/player2/player1_sets/player2_sets/current_point) + extensions `sets[]`, `current_set_index`, `status`, `tournament`, `court`, `tour`, `serving`, `is_live`, drapeaux pays.
- Source : ESPN public scoreboard ATP + WTA (`site.api.espn.com/.../tennis/{atp,wta}/scoreboard`) — zéro clé API.
- Helpers `fetchESPNTennisLive`, `_normalizeESPNTennisCompetition`, `_tennisStateLabel` + cache module `_tennisLiveCache` (TTL 30 s, mutex `_isFetchingTennis`).
- Poll dédié `pollTennisLive()` toutes les 30 s + bootstrap au boot, indépendant de `pollLiveScores` football.
- Dispatcher d'API étendu pour router `/tennis/*` vers `handleAPI()` (ajout `pathname.startsWith('/tennis/')`).
- Filtre `?live=true` côté route pour ne renvoyer que les compétitions ESPN en état `in`.
- Isolation totale : aucun match tennis n'entre dans `db.matches`, `buildMatchRecord`, Poisson, edge, Football-Data, ou TheSportsDB. `/api/v1/matches?league=tennis` reste `[]`.

**Frontend (pariscore.html)**
- Nouvel onglet `🎾 Tennis` dans la barre de navigation principale.
- Page dédiée `#page-tennis` avec table `#tennis-live-table` (colonnes : Tournoi · Tour · Joueur 1 · Joueur 2 · Sets · Jeux · Point · Statut).
- Renderer `renderTennisLive` + format `formatTennisScore` (`sets | jeux | point`, ex. `1-1 | 4-3 | 40-40` quand disponible — point ESPN public non livré, dégradé `—`).
- Poll client `tickTennisLive()` toutes les 30 s, `startTennisLive` / `stopTennisLive` montés/démontés via `showPage('tennis')`.
- Toggle "Live uniquement" (coché par défaut), bouton 🔄 Actualiser, indicateur d'horodatage live.
- Styles : drapeau pays 18×12 px, vert sur joueur au service (`serving=1|2`), statut LIVE en rouge.

**Vérifications réalisées**
- `node -c server.js` — OK.
- `curl /tennis/api/v2/matches/live/` — JSON array conforme, 5 matchs en direct détectés (Internazionali BNL d'Italia, Parma Ladies Open).
- UI : tab 🎾 Tennis charge 5 lignes en direct, format Sets/Jeux/Point conforme, polling 30 s actif.
- `/api/v1/matches?league=tennis` → `{count:0}` (isolation confirmée).
- Aucune erreur console, aucune régression sur l'onglet Matchs.

**Notes ESPN public scoreboard**
- Point en cours (`40-40`) non disponible en API publique gratuite → frontend affiche `—`. Pour le point live il faudrait `summary?event={id}` ou un partenariat data.
- ESPN agrège ATP+WTA ; doublons rares possibles si même rencontre exposée sur les deux scoreboards. Filtrage future ID-based si problème.

---

## [v9.8.1] — 2026-05-12

### Ajouté — Mes Paris : Plan 20%/jour + Import CSV sécurisé + Sport + Bookmakers ANJ

**Plan bankroll (compound + split 50/50)**
- Table `bankroll_plan` (user_id PK, starting_capital_cents 30000 default, daily_target_pct 20.0, profit_split_pct 50.0, start_date '2026-05-12', floor_cents)
- Routes : `GET/PUT /api/v1/bankroll/plan`, `GET /api/v1/bankroll/daily-tracker`
- Daily tracker calcule jour par jour : capital_cible (compound × 1.20), capital_réel, P&L jour, split 50% banque / 50% capital, cumul banque, écart cible, hit_target boolean
- Onglet "Plan 20%/jour" dans Mes Paris : KPI row (capital départ/actuel/banque/total/cible/écart) + table jour-par-jour + pill statut
- Modal `#plan-modal` : édition capital, target%, split%, start date, floor

**Bookmakers — ANJ FR + 1xbet (11 books)**
- Constante `ALLOWED_BOOKMAKERS` côté serveur, `normalizeBookmaker()` lookup case-insensitive
- Dropdowns dans bet-modal, cash-modal, import-modal, paris-filters
- Liste : 1xbet, Winamax, Betclic, Unibet, PMU, Parions Sport, ZEbet, NetBet, Vbet, Genybet, PartoucheSport
- Cash modal accepte "banque" (épargne séparée)

**Colonne sport (15 sports)**
- Migration idempotente `ALTER TABLE user_bets ADD COLUMN sport TEXT DEFAULT 'football'` + `external_ref` + `source`
- `ALLOWED_SPORTS` + `normalizeSport()` avec alias (foot/basket/tennis/mma/ufc/f1/lol/etc.)
- POST + PATCH /bets acceptent `sport`, listUserBets filtre par sport
- Dropdown sport dans bet-modal + filter dans paris-filters
- Colonne emoji dans table (`SPORT_EMOJI` côté JS)
- Export CSV inclut colonne `sport`

**Import CSV bookmaker (sécurité renforcée)**
- Route `POST /api/v1/auth/reverify` — exige mdp en clair, vérifie via `verifyPasswordSync`, émet token 32-byte hex single-use TTL 5 min, stockage Map en mémoire avec purge auto, log IP côté server
- Route `POST /api/v1/bets/import` — exige JWT + `reverify_token` (consumed-on-use), CSV ≤ 500 Ko, dry_run mode, transactionnel via `sqldb.transaction()`, dédup via `external_ref` (user_id, date|event|odds)
- Parser flexible `parseBetsCSV` : 10 alias colonnes (date/sport/event/market/selection/odds/stake/payout/status/bookmaker/league), séparateur auto-détecté (`,` `;` `\t`), gère "Historique" préfixe 1xbet, dates DD/MM/YYYY + ISO, normalisation status (won/lost/void/cashout/half_won/half_lost)
- Table `bet_import_audit` (user_id, source, filename, rows_parsed/inserted/skipped, ip, user_agent) — forensique
- Route `GET /api/v1/bets/import/audit` (last 50)
- Modal `#import-modal` 2-step : (1) re-verify mdp, (2) upload fichier OU paste CSV + bookmaker default + dry-run/commit, tag "IMP" sur paris importés
- POST /bets stocke `source='manual'` par défaut, import stocke `source='import'`

**Bug TZ corrigé**
- `computeDailyTracker` utilisait `new Date(start + 'T00:00:00')` → interprété en local → décalage 1 jour en CET. Remplacé par `Date.UTC(...split)` partout. Vérifié : daily_pnl correctement attribué au 2026-05-12.

**Frontend (`pariscore.html`)**
- 2 nouveaux modals (`#plan-modal`, `#import-modal`)
- 4ème tab "Plan 20%/jour" + bouton toolbar "⚙ Plan" + "⬆ Importer 1xbet/ANJ"
- Nouveau filtre "Sport" dans paris-filters
- Colonne "Sport" (emoji) dans bets table
- Tag "IMP" sur paris importés
- `SPORT_EMOJI` map (15 entrées)

### Modifié
- `server.js` : +600 lignes (migrations idempotentes, constantes/helpers, 7 routes, parser CSV, reverify token, daily tracker compound)
- `pariscore.html` : +500 lignes (CSS dropdowns, sport column, plan tab, 2 modals, JS handlers)
- `CLAUDE.md` : version → v9.8.1, section v9.8.1 ajoutée

### Sécurité
- Reverify token : 32 bytes crypto-random, single-use, TTL 5 min, purge interval 60s
- Import logs : IP + user_agent en audit pour forensique
- CSV size ≤ 500 Ko (anti-DoS)
- Transactional insert via better-sqlite3 transaction (rollback si crash)
- Dedup hardened via external_ref (date|event|odds, slice 128)

### Tests preview
- Login test@pariscore.fr → plan auto-init (300€/20%/50%/2026-05-12) ✓
- PUT plan → persisté ✓
- Reverify mdp correct → token émis ✓
- Reverify mdp incorrect → 401 + warn log ✓
- Reuse reverify token → 403 ✓
- Import CSV 3 paris (Football/Tennis/Basketball, won/lost/pending) → 3 inserted ✓
- Re-import même CSV → 0 inserted (dedup external_ref) ✓
- Daily tracker : PnL +3.50€ correctement attribué à 2026-05-12, split 1.75/1.75€, écart cible -56.50€ ✓
- UI : emoji sport rendered ⚽🎾🏀, tag IMP visible, Plan tab avec KPI + table OK ✓
- node --check server.js ✓

---

## [v9.8.0] — 2026-05-12

### Ajouté — Module "Mes Paris" (Bet Tracking 1xbet + Bankroll réelle + Kelly + CSV)

**Schéma SQLite**
- Table `user_bets` (FK `users`, 7 statuts via CHECK : pending/won/lost/void/cashout/half_won/half_lost, `payout_cents` persisté, snapshot `model_prob`/`edge_pct`/`kelly_fraction`, INTEGER cents partout)
- Table `bankroll_transactions` (kind : deposit/withdrawal/adjustment, `amount_cents` signé)
- 5 index : `idx_user_bets_user_status`, `idx_user_bets_user_settled`, `idx_user_bets_match`, `idx_user_bets_commence`, `idx_bk_tx_user_date`

**Backend** (`server.js`)
- Helpers : `computeKellyFraction(prob,odds,cap=0.25)`, `suggestStakeCents(bankrollCents,prob,odds,mult=1.0,cap=0.25)`, `requireUserAuth` (exige `user.userId`), `buildBetsWhere`, `listUserBets`, `countUserBets`, `computePayoutCents`, `suggestBetSettlement`, `computeBankrollSummary`
- Routes : `GET/POST/PATCH/DELETE /api/v1/bets`, `POST /api/v1/bets/:id/settle`, `GET /api/v1/bets/suggest-settlement/:id`, `GET /api/v1/bets/kelly`, `GET /api/v1/bets/export.csv`, `GET/POST/DELETE /api/v1/bankroll/tx`, `GET /api/v1/bankroll/summary`
- Alias explicite `GET /api/v1/bankroll/simulated` (route simulée renommée, l'ancienne `/bankroll` reste comme legacy 1 release)
- Hook dans `archivePastMatches` : `UPDATE user_bets SET updated_at` quand match archivé verified → bande jaune `.bet-row-suggest` côté UI (pas d'auto-settle)
- Sécurité : `WHERE user_id = ?` sur 100 % des queries, isolation cross-user validée

**Frontend** (`pariscore.html`)
- Lien nav "Mes Paris" + dispatch `showPage` → `initParisPage`
- Page `#page-paris` : header + toolbar (Nouveau pari / Dépôt-Retrait / Export CSV / chip bookmaker / timestamp)
- 8 KPI tiles : Bankroll, Disponible (avec montant en jeu), P&L cumul, ROI, Win Rate, Drawdown (raw + risk), Ouverts, Longest streak W/L
- Chart Chart.js bankroll réelle (ligne `#29b6f6` + scatter markers triangle vert dépôts / rouge retraits, Y-axis `EUR`, destroy/recreate)
- 3 tabs : Paris ouverts / Historique / Trésorerie
- Filtres : statut, bookmaker, marché, équipe, plage date
- Modal `#bet-modal` : autocomplete matchs (`/api/v1/matches`), 19 préselections marché (1X2/Over/Under/BTTS/DC/AH/FREE), Kelly panel collapsible Full (mis en avant, choix user) / Half / Quarter, edge affiché
- Modal `#settle-modal` : bandeau suggestion auto si match archivé verified + bouton Accepter, radio statut, preview P&L live
- Modal `#cash-modal` : dépôt/retrait/ajustement avec date éditable
- Export CSV : `fetch + blob + a.download`, headers Bearer, OWASP injection guard côté serveur (préfixe `'` si cellule commence par `= + - @`)
- CSS : 60 lignes (`.bet-status-pill` par statut, `.bet-pl-pos/neg`, `.bet-row-suggest` bande jaune, `.kelly-panel`, `.paris-modal`, etc.)
- Patch `/api/v1/bankroll` → `/api/v1/bankroll/simulated` dans `renderBankrollChart` (ligne 12834)

### Modifié
- `server.js` : +900 lignes (schéma, helpers, 13 routes, hook archivage)
- `pariscore.html` : +900 lignes (CSS + nav + page + 3 modals + JS init/render/handlers + Kelly + CSV download)
- `CLAUDE.md` : version → v9.8, section v9.8 ajoutée
- `.claude/CLAUDE.md` : roadmap P2-P3 "Bet Tracking Utilisateur" cochée

### Verrouillé pour la suite (hors scope v9.8)
- Combinés / parlay (junction table `user_bet_legs`)
- Import CSV 1xbet
- Scraping API 1xbet (ToS-incompatible)
- Cashout live suggestion (streaming odds + live model)
- Multi-devise, export fiscalité FR détaillé
- Notification Telegram sur règlement

---

## [v4.6.0] — 2026-04-30

### Ajouté — Wave 6 : Scouting Intelligence (Injuries + Scouting Report)

**Player Absence Impact**
- `fetchTeamInjuries(teamKey)` : appel `/injuries?team={id}&season={year}` API-Football, cache SQLite KV 24h, jusqu'à 5 absences par équipe
- Fire-and-forget dans `fetchStats()` : pré-charge les injuries des 20 premiers matchs à chaque cron (~40 req/cron)
- `buildMatchRecord()` enrichi : `record.injuries {home:[{name,reason}], away:[...]}` + `record.injuryPenalty {home:%, away:%}` (5% par joueur absent, plafond 30%)
- Badge `⚠️ Absences` rouge dans le tableau quand `injuryPenalty.home + away >= 10`, tooltip avec noms des joueurs blessés
- Null safety : erreur réseau/429 → `penalty = 0`, zéro crash

**Scouting Report Gemini**
- `buildScoutingPrompt(match)` : prompt structuré en 4 sections (Tactique, Statistique, Risques, Recommandation) avec injuries, xG, Poisson, edge, form, ranks
- `getScoutReport(match)` : appel Gemini + cache SQLite KV `scout_{matchId}` 24h
- Route `GET /api/v1/scout/:matchId` : retourne `{report, cached}` — handler async pattern `(async()=>{})()` conforme au projet
- Onglet "🕵️ Scouting" dans modal Insights — lazy-load (une seule requête par ouverture), `buildScoutingTab()`, rendu `marked.parse()` avec fallback `<br>`
- Badge CACHE 24H / NOUVEAU dans l'UI scouting

### Modifié
- `server.js` : +4 fonctions (`fetchTeamInjuries`, `buildScoutingPrompt`, `getScoutReport`, `callGemini` helper) + 1 route (`/api/v1/scout/:matchId`) + enrichissement `buildMatchRecord()` + fire-and-forget dans `fetchStats()`
- `pariscore.html` : onglet 🕵️ Scouting dans modal + `buildScoutingTab()` + badge `.badge-absence` CSS + `absenceBadge` dans `renderMatches()` + `insShowTab()` étendu

---

## [v4.5.0] — 2026-04-30

### Ajouté — Wave 5 : HT/FT Market + Acca Generator + Dropping Odds Tracker

**HT/FT Market — 2 nouvelles stratégies (15 stratégies au total)**
- `HT_HOME_FT_HOME` : proxy Poisson `homeWin` filtré (homeWin ≥ 60% ET ppg dom ≥ 1.8) — cote `odds.home` — seuils `{high:68, mid:55}`
- `HT_UNDER_FT_OVER` : signal "match qui s'embrase" = moyenne(over25, under15) si over25 ≥ 65% ET under15 ≥ 25% — seuils `{high:65, mid:50}`
- Ajoutés dans `STRATEGIES` (server.js) + `STRATEGIES_UI` + `CONF_THRESHOLDS` (pariscore.html)

**Acca Generator — 100% mathématique**
- Fonction `getAccaByStrategy(strategyType, size)` : top N matchs par confiance → cote combinée (produit) + proba combinée (produit)
- Route `GET /api/v1/acca?strategy=BTTS_YES&size=3`
- Encart "🎯 Combiné du Jour" dans la page Top Stratégies : cote combinée en grand + liste matchs avec % individuel + disclaimer
- `loadAccaPanel(key)` appelé automatiquement à chaque changement de stratégie
- Estimée si cote directe absente (1 / probabilité)

**Dropping Odds Tracker — backend**
- `buildMatchRecord()` : snapshot SQLite KV `odds_snap_{matchId}` à chaque `fetchOdds()` + calcul `record.odds_delta = {home, draw, away, ts}`
- Route `GET /api/v1/odds-history/:matchId` : retourne cotes actuelles + delta depuis dernier snapshot
- Colonne "Δ Cote" dans le tableau matchs : ↓ rouge si baisse > 0.04, ↑ vert si hausse, — sinon
- `deltaStr` calculé côté client depuis `m.odds_delta`

### Modifié
- `server.js` : `buildMatchRecord()` enrichi + 3 nouvelles routes (`/acca`, `/odds-history`, HT/FT dans STRATEGIES)
- `pariscore.html` : 15 stratégies + encart Acca + colonne Δ Cote + CSS `.acca-*` + `.odds-delta-*`

---

## [v4.4.0] — 2026-04-30

### Ajouté — Power Score Streaming (Wave 4)
- **`POWER_SCORE_SYSTEM_PROMPT`** : constante serveur contenant le prompt expert 5 piliers (Métriques 30% / Tactique 20% / Dynamique 20% / Presse 15% / Psychologie 15%) + format de sortie Markdown structuré 6 sections
- **`buildPowerScorePrompt(match)`** : injecte dynamiquement les données réelles du match dans le prompt (form, xG, λ Poisson, probas over/btts/1N2, cotes, edge, rank, avgScored/Conceded)
- **Route `GET /api/v1/ai-stream/:matchId`** : endpoint SSE streaming Gemini
  - Cache HIT (< 24h dans SQLite KV) → replay immédiat, zéro appel Gemini
  - Cache MISS → pipe `streamGenerateContent` Gemini → chunks SSE → stockage cache à la fin
  - Nettoyage propre si client déconnecté (`req.on('close')`)
- **Route `POST /api/v1/power-score/:matchId/feedback`** : stocke 👍/👎 dans SQLite table `ai_feedback`
- **Table SQLite `ai_feedback`** : `(id, matchId, rating, ts)` — créée dans `initSQLite()`
- **Onglet "⚡ Power Score"** (6ème) dans modal Insights
  - Streaming typewriter : texte apparaît progressivement via `EventSource`
  - `marked.js` CDN (`@12.0.0`) pour rendu Markdown natif
  - Lazy-load : stream déclenché au 1er clic sur l'onglet uniquement
  - Badge "📦 En cache" si l'analyse vient du cache SQLite
- **Export Telegram en 1 clic** : `extractTelegramScript()` parse le bloc ` ```telegram ` + bouton 📋 avec `navigator.clipboard` + fallback `execCommand`
- **Feedback 👍/👎** : boutons post-stream → `POST /api/v1/power-score/:matchId/feedback` → message "Merci !"
- **Boutons sur cartes stratégie** : chaque carte a désormais `✦ Stats` + `⚡ Power Score` en bas (avec `event.stopPropagation()`)
- **`openPowerScore(matchId)`** : ouvre le modal Insights et bascule directement sur l'onglet Power Score
- **CSS Power Score** : styles Markdown dans `#ps-content` (h2 vert, h3 bleu, pre avec fond dark, code monospace)

### Modifié
- `server.js` : `initSQLite()` crée la table `ai_feedback` + ajout `POWER_SCORE_SYSTEM_PROMPT` + `buildPowerScorePrompt()` + 2 nouvelles routes
- `pariscore.html` : modal Insights étendu à 6 onglets + `insShowTab()` gère `powerscore` + `closeInsights()` ferme le stream SSE ouvert

---

## [v4.3.0] — 2026-04-30

### Ajouté — Live Intensity Score (Wave 3)
- **`computeLiveIntensity(fix)`** dans `server.js` : calcule un score composite 0-100 à partir des statistiques live API-Football
  - `getStat(teamStats, type)` : helper null-safe pour extraire une stat par type depuis le tableau `fix.statistics`
  - Score = 40% Tirs totaux (normalisé /25) + 30% Tirs cadrés (/12) + 20% Corners (/15) + 10% Écart possession (/50%)
  - Retourne `null` si `fix.statistics` absent ou incomplet (matchs sans données live)
- **`match.live_intensity`** : champ ajouté dans `pollLiveScores()` — stocké en mémoire sur chaque match live, broadcasté via SSE
- **Badge ⚡ Intensité** dans le tableau matchs (`pariscore.html`) : affiché uniquement si `live_score` + `live_intensity` présents
  - 🔴 Rouge ≥ 60 (match très ouvert), 🟠 Orange ≥ 30 (match actif), 🔵 Bleu < 30 (match fermé)
  - Classes CSS `.badge-intensity.high/.mid/.low` — style cohérent avec `.badge-live`
- **Modal Insights** : affiche `⚡ Intensité X/100` dans `#ins-league` sous le nom du match (coloré selon seuil)

### Modifié
- `server.js` : `pollLiveScores()` stocke `match.live_intensity = computeLiveIntensity(fix)` à chaque poll
- `pariscore.html` : `openInsights()` enrichit le sous-titre du modal avec l'intensité live si disponible

---

## [v4.2.2] — 2026-04-30

### Ajouté
- **Double Chance market — `DC_HOME` (1X) + `DC_AWAY` (X2)** : 2 nouvelles stratégies, portant le total à 13
  - `DC_HOME` : confiance = `homeWin + draw` (Poisson) — l'équipe à domicile ne perd pas
  - `DC_AWAY` : confiance = `awayWin + draw` (Poisson) — l'équipe à l'extérieur ne perd pas
  - `getOdds: () => null` — pas de cote directe disponible via The Odds API h2h, cote estimée affichée (`~X.XX`)
  - `CONF_THRESHOLDS.DC_AWAY` : `{high:65%, mid:50%}` — seuils abaissés car plage naturelle X2 = 25-70%
  - `DC_HOME` utilise le fallback standard `{high:75%, mid:60%}` — plage 1X = 50-90%, cohérent

### Modifié
- `server.js` : `STRATEGIES` étendu de 11 → 13 entrées
- `pariscore.html` : `STRATEGIES_UI` étendu de 11 → 13 entrées + `CONF_THRESHOLDS` complété avec `DC_AWAY`

---

## [v4.2.1] — 2026-04-30

### Corrigé
- **`confClass()` seuils adaptatifs par stratégie (W1)** : les marchés à faible probabilité naturelle ne s'affichent plus systématiquement en rouge
  - `CONF_THRESHOLDS` : CS_00 {high:25%, mid:12%}, DRAW {high:35%, mid:25%}, UNDER_2_5 {high:70%, mid:55%}, VERROU_TACTIQUE {high:72%, mid:58%}
  - Fallback {high:75%, mid:60%} pour les autres stratégies (BTTS, OVER, HOME_WIN…)
  - `confClass(pct, stratKey)` — la clé de stratégie est désormais passée depuis `loadStrategy(key)`
- **`openInsightsById()` guard (W2)** : évite un modal vide si le match n'est pas encore chargé
  - Double guard : chargement de `allMatches` si absent, vérification finale avant ouverture
  - `console.warn` + `return` silencieux si le match reste introuvable après fetch

### Ajouté
- **Filtre par ligue dans Top Stratégies (W3)** : tous les concurrents l'avaient, PariScore aussi maintenant
  - `getTopMatchesByStrategy(..., league)` : filtrage `m.sport === leagueFilter` côté serveur
  - Route `/api/v1/top-strategy?league=soccer_france_ligue1` opérationnelle
  - Dropdown `#strat-league-select` (8 options : Toutes + 7 ligues majeures) dans `#strategy-controls`
  - Variable `activeStratLeague` + handler `onStratLeagueChange()`
- **Slider `minConfidence` dans la page Stratégies (W4)**
  - Slider 0→90% (pas 5%) dans `#strategy-controls`, variable `activeStratConf = 50`
  - Handler `onStratConfChange()` — reload automatique à chaque changement
  - Bouton "✕ Réinitialiser" via `resetStratFilters()` — remet league, slider et label à zéro
- **`#strategy-controls`** : barre de filtres unifiée (ligue + confiance min + reset) insérée entre les pills et la grille de résultats

### Modifié
- `meta.innerHTML` dans `loadStrategy()` : affiche désormais `≥ ${activeStratConf}%` et le nom de la ligue active au lieu du hardcodé "≥ 50%"
- `pariscore.html` : 4 fonctions ajoutées (`onStratLeagueChange`, `onStratConfChange`, `resetStratFilters`, `CONF_THRESHOLDS`)
- `server.js` : signature `getTopMatchesByStrategy` étendue avec param `league`

---

## [v4.2.0] — 2026-04-30

### Ajouté
- **SSE Live (Server-Sent Events)** : route `GET /api/v1/live` — zéro WebSocket, modules Node.js natifs
  - `sseClients` Set + `broadcastSSE(eventName, data)` — notifie tous les clients connectés
  - `buildMeta()` helper réutilisable (lastOddsUpdate, lastStatsUpdate, status, quotas)
  - Snapshot immédiat des matchs à la connexion + heartbeat `: heartbeat` toutes les 30s
  - Broadcast automatique après chaque `fetchOdds()` réussi
- **Smart Polling Live** : `pollLiveScores()` — appel `fixtures?live=all` toutes les 60s, actif 19h–23h (Europe/Paris)
  - Matching par `normName()`, mise à jour `live_score` / `live_status` / `live_minute` dans `db.matches`
  - Broadcast SSE automatique si au moins un score a changé
- **Badge LIVE** : `<span class="badge-live">🔴 score (min′)</span>` dans la colonne Match si `m.live_score` défini
- **`initSSE()`** côté frontend : remplace `startAutoRefresh()` — désactive le polling 5min sur `onopen`, fallback polling sur `onerror`
- **3 Stratégies Avancées** dans le module Top Stratégies (11 stratégies au total)
  - `ANGLE_CORNERS` 📐 : xG total > 2.5 → proxy pression offensive → confiance = Over 2.5 Poisson
  - `VERROU_TACTIQUE` 🔐 : Poisson Under 3.5 > 80% + bonus +5% si avgConceded < 1.2 (deux équipes)
  - `GOLDEN_PPG_GAP` ⭐ : Écart PPG > 1.2 + fort PPG à domicile OU cote > 1.70 → confiance = homeWin/awayWin
- **Gestion Intelligente des Quotas T1/T2**
  - `LEAGUE_CRON_MS` map construite au boot depuis `leagues_config.json`
  - `db.statsUpdateByLeague[lid]` : timestamp par ligue, persisté en SQLite
  - Boucle standings : skip si ligue encore fraîche selon `cron_hours` (T1 = 6h, T2 = 12h)
  - ~60 req/jour économisées sur les 5 ligues T2
- **Skills Claude Code** dans `.claude/skills/`
  - `/ps-add-strategy` : scaffold nouvelle stratégie (server.js + pariscore.html + CLAUDE.md)
  - `/ps-audit` : audit état projet vs roadmap CLAUDE.md
  - `/ps-changelog` : mise à jour CHANGELOG + CLAUDE.md après feature
  - `/ps-deploy` : checklist déploiement Render.com

### Corrigé
- `@keyframes blink` dupliqué dans pariscore.html — suppression de la définition redondante
- `[ ] Système de favoris` dans P1 CLAUDE.md → marqué `[x]` (déjà implémenté le 29 avril)

### Modifié
- `server.js` : `startAutoRefresh()` remplacé par `initSSE()` dans le flux de chargement frontend
- `pariscore.html` : `onMatchesLoaded()` et `loadMatches()` appellent désormais `initSSE()`

---

**Session du 27 avril 2026**

---

## 1. Renommage de la plateforme
- Nom changé de **CoteAlerte** → **PariScore** dans l'ensemble du projet

---

## 2. Structure de navigation (SPA)
- Conversion en **Single Page Application** avec 6 onglets sans rechargement :
  - **Accueil** — page de garde (hero + stats + features)
  - **Matchs** — tableau de données live
  - **Prédictions IA** — cartes de prédiction
  - **Tendances** — statistiques BTTS, buts, etc.
  - **Alertes** — configuration des alertes Telegram
  - **Tarifs** — plans tarifaires
- Chaque section est un `div[data-page]` affiché/masqué par `showPage()`
- Correction du bug : `showPage()` cachait aussi les liens de nav (ciblait `[data-page]` au lieu de `div[data-page]`)
- Bouton hero "Voir les paris du jour" → renommé "Voir les matchs du jour" et redirige vers l'onglet Matchs

---

## 3. Connexion The Odds API
- Intégration de **The Odds API** (`https://api.the-odds-api.com/v4/`)
- Clé API pré-remplie depuis le fichier `.env`
- Ligues couvertes : Ligue 1, Premier League, Champions League, La Liga, Bundesliga, Serie A, Europa League
- Appel `/v4/sports/` d'abord pour récupérer uniquement les ligues **actives** avant de charger les cotes
- Fenêtre de 7 jours (`commenceTimeFrom` / `commenceTimeTo`) — correction du paramètre invalide `daysFrom`
- Calcul d'**edge no-vig** : comparaison des meilleures cotes bookmaker vs probabilités fair (moyenne multi-bookmakers)
- Affichage du quota restant (`x-requests-remaining`) dans l'en-tête du tableau

---

## 4. Système de cache 4h
- Cache `localStorage` clé `pariscore_cache_v1` avec TTL de 4 heures
- Au chargement : si cache valide → affichage immédiat, 0 requête API
- Si cache expiré → appel API → mise en cache → affichage
- Badge dynamique mis à jour toutes les minutes : `il y a 1h23 · prochaine MAJ dans 2h37`
- Bouton **↺ Forcer MAJ** pour vider le cache et recharger immédiatement
- Changement de clé API → vidage automatique du cache

---

## 5. Serveur local Node.js (`server.js`)
- Fichier `server.js` sans aucune dépendance npm (modules natifs Node.js uniquement)
- Proxy HTTP → HTTPS pour contourner les restrictions CORS du navigateur
- Route unique `/proxy?target=URL_ENCODÉE` + headers custom via `h_{nom}={valeur}`
- Sert `pariscore.html` comme fichier statique sur `http://localhost:3000`
- Lancement : `node server.js`

---

## 6. Gestion des erreurs & fallback démo
- **Détection automatique** du protocole `file://` avec bannière d'avertissement
- **Données de démonstration** : 20 matchs fictifs répartis sur 4 jours, avec cotes multi-bookmakers réalistes
- Fallback automatique vers les données démo si l'API échoue (CORS, clé invalide, quota épuisé)
- Messages d'erreur différenciés : 401 (clé invalide), 429 (quota), réseau
- Bouton **"Voir démo"** pour forcer le mode démonstration
- Badge coloré : `Mode démo` (orange) vs `✓ Connecté` (vert) vs `✓ Cache` (vert)

---

## 7. Filtres du tableau des matchs

### Filtre par jour
- 4 boutons : **Tous les jours / Aujourd'hui / Demain / J+2 / J+3**
- Labels dynamiques avec vraies dates (`mer. 30 avr.`, `jeu. 1 mai`)
- Filtre appliqué sur les données déjà chargées (0 requête supplémentaire)

### Filtre par ligue
- 8 boutons : Toutes ligues / Ligue 1 / Premier League / Champions League / La Liga / Bundesliga / Serie A / Europa League
- Attribut `data-sport` mappé aux clés The Odds API
- Combinable avec le filtre jour

---

## 8. Redesign du tableau — Style OddAlerts

### Structure
- Table horizontale scrollable (`min-width: 1400px`, `overflow-x: auto`)
- **Double en-tête** : ligne 1 = nom de la stat, ligne 2 = `Dom` / `Ext`
- Chaque ligne = un match avec 2 équipes affichées verticalement

### 10 colonnes de statistiques
| Colonne | Dom | Ext | Logique couleur |
|---------|-----|-----|-----------------|
| PPG | ✓ | ✓ | vert ≥2.0, orange ≥1.3, rouge |
| Victoires % | ✓ | ✓ | vert >75%, orange >50%, rouge |
| Nuls % | ✓ | ✓ | inversé (haut = mauvais) |
| Défaites % | ✓ | ✓ | inversé |
| BTTS % | ✓ | ✓ | vert >75%, orange >50%, rouge |
| +2.5 Buts % | ✓ | ✓ | vert >75% |
| +1.5 Buts 1MT | ✓ | ✓ | vert >75% |
| Buts Marqués % | ✓ | ✓ | vert >75% |
| Buts Encaissés % | ✓ | ✓ | inversé |
| Moy. Buts | ✓ | ✓ | neutre |

### Code couleur
- 🟢 Vert `#00A551` : valeur > 75% (ou PPG ≥ 2.0)
- 🟠 Orange `#F59E0B` : valeur 50–75% (ou PPG ≥ 1.3)
- 🔴 Rouge `#EF4444` : valeur < 50%

---

## 9. Tri des colonnes
- Clic sur `Dom` ou `Ext` → tri décroissant (↓ meilleur en premier)
- 2ème clic sur la même colonne → tri croissant (↑)
- Indicateur visuel vert sur la colonne active
- Combinable avec les filtres jour et ligue
- Indicateur préservé lors des changements de filtre
- Correction bug : `matchesLoaded` et `activeDay` non déclarés → ajoutés en variables globales

---

## 10. Intégration API-Football
- Clé API pré-remplie : `API_FOOTBALL_KEY`
- Endpoint `/fixtures?next=100` → récupération des ligues actives
- Endpoint `/standings?league={id}&season=2024` → stats home/away par équipe
- **Stats calculées depuis les standings** :
  - Directes : PPG, Victoires %, Nuls %, Défaites %, Moy. Buts
  - Estimées depuis moyennes de buts : BTTS %, +2.5 Buts %, +1.5 Buts 1MT, Buts Marqués %, Buts Encaissés %
- Matching des noms d'équipe par normalisation (minuscules, sans accents) + fuzzy search
- Cache AF séparé (`pariscore_af_cache_v1`) — TTL 4h indépendant du cache Odds
- Re-rendu automatique après chargement des vraies données
- Badge **`LIVE`** (bleu) si données réelles, **`SIM`** (gris) si données simulées
- Classement affiché : `#1 vs #4` dans la colonne Match

---

## 11. Fichiers produits
| Fichier | Description |
|---------|-------------|
| `pariscore.html` | Application complète (SPA, tous onglets, APIs, cache) |
| `server.js` | Proxy Node.js local zéro-dépendance |
| `CHANGELOG.md` | Ce fichier |

---

## APIs utilisées
| API | Usage | Clé | Quota |
|-----|-------|-----|-------|
| The Odds API | Cotes live, ligues actives | `ODDS_API_KEY` | 500 req/mois |
| API-Football | Standings, stats équipes | `API_FOOTBALL_KEY` | 100 req/jour |
| Gemini 1.5 Flash | Analyse IA des matchs | `GEMINI_KEY` | Pay-as-you-go |

---

*PariScore — inspiré d'OddAlerts — session de développement du 27 avril 2026*

---

## 12. Architecture v2.0 — Serveur-Centrique (27 avril 2026, session 2)

### Problème résolu
L'architecture v1 exposait les clés API dans le HTML, gérait le cache côté client avec localStorage, et faisait des appels directs aux APIs tierces depuis le navigateur — causant des problèmes CORS permanents.

### Nouvelle architecture
```
  ┌──────────────────────┐
  │  The Odds API         │──┐
  │  (cotes, 15 min)      │  │
  └──────────────────────┘  │    ┌──────────────────────┐     ┌───────────────┐
                             ├───▶│  server.js (Node.js)  │────▶│ database.json │
  ┌──────────────────────┐  │    │  - Cron jobs           │     └───────────────┘
  │  API-Football         │──┘    │  - Fusion + calculs    │
  │  (stats, 6h)          │       │  - API REST interne    │
  └──────────────────────┘       │  - Proxy Gemini        │
                                  └──────────┬─────────────┘
                                             │ /api/v1/matches
                                  ┌──────────▼─────────────┐
                                  │  pariscore.html         │
                                  │  (Frontend "stupide")   │
                                  │  0 clé · 0 cache        │
                                  └──────────────────────────┘
```

### server.js — Backend complet
- **Zéro dépendance npm** — modules Node.js natifs uniquement
- **Chargement .env** — parser intégré, aucune clé dans le code
- **Cron Job Odds** : `setInterval` toutes les 15 min → The Odds API → sports actifs → cotes 7 jours
- **Cron Job Stats** : `setInterval` toutes les 6h → API-Football → fixtures → standings home/away
- **Fusion** : pour chaque match, les cotes sont croisées avec les stats d'équipe
- **Calcul côté serveur** : edge no-vig, probabilités fair, PPG, BTTS%, Over 2.5%, etc.
- **database.json** : stockage persistant, rechargé au démarrage
- **Fallback démo** : si les APIs échouent, 20 matchs fictifs sont générés automatiquement
- **API REST interne** :
  | Route | Méthode | Description |
  |-------|---------|-------------|
  | `/api/v1/matches` | GET | Matchs fusionnés + stats + edge (filtrable par `?league=` et `?day=`) |
  | `/api/v1/stats/:id` | GET | Stats détaillées d'un match |
  | `/api/v1/status` | GET | État du serveur, compteurs, quota, uptime |
  | `/api/v1/gemini` | POST | Proxy Gemini (clé côté serveur uniquement) |
  | `/api/v1/refresh` | POST | Forcer un rafraîchissement immédiat |

### pariscore.html — Frontend allégé
- **Supprimé** : toute logique API, clés, cache localStorage, proxy CORS, proxyFetch
- **Supprimé** : bannière clé API, bannière file://, bouton "Voir démo"
- **Ajouté** : barre de statut serveur (connecté/démo, dernière MAJ, quota)
- **Un seul appel** : `fetch('/api/v1/matches')` → rendu du tableau
- **Gemini** : via `fetch('/api/v1/gemini')` — aucune clé dans le HTML
- **JS réduit** : 45 Ko → 23 Ko (~50% plus léger)

### Sécurité
- ✅ Aucune clé API dans le HTML
- ✅ Clés chargées depuis `.env` côté serveur uniquement
- ✅ Proxy Gemini pour ne pas exposer la clé Google
- ✅ Pas de localStorage sensible

### Fichiers produits
| Fichier | Description |
|---------|-------------|
| `server.js` | Backend Node.js — cron, fusion, API REST, proxy Gemini |
| `pariscore.html` | Frontend SPA — affichage uniquement |
| `.env` | Clés API (à créer par l'utilisateur) |
| `database.json` | Généré automatiquement par le serveur |
| `CHANGELOG.md` | Ce fichier |

### Consommation API estimée (plan gratuit)
| API | Fréquence | Req/cycle | Req/jour | Req/mois |
|-----|-----------|-----------|----------|----------|
| The Odds API | 15 min | ~8 | ~768 | ~500 (plafonné) |
| API-Football | 6h | ~15 | ~60 | ~1800 |

*Note : The Odds API gratuit = 500 req/mois. En production, espacer à 30 min ou passer au plan payant.*

---

## ⚠ HOTFIX — Quota The Odds API (27 avril 2026)

### Problème
Le cron job Odds était configuré à **15 minutes**, soit ~2880 req/mois. Le plan gratuit The Odds API est limité à **500 req/mois**. La clé aurait été grillée en **~16 heures**.

### Corrections appliquées

**server.js :**
- Cron Odds : `15 min` → `12h` (~8 req/cycle × 2 cycles/jour = ~16 req/jour = **~480 req/mois**)
- Cron Stats (API-Football) : inchangé à 6h
- `nextOddsUpdate` dans `/api/v1/status` : corrigé de 15 min → 12h
- Route `/api/v1/refresh` : réécrite pour `await` les deux fetches (Stats puis Odds) et retourner le résultat complet (matchCount, teamCount, timestamps)

**pariscore.html :**
- Bouton **🔄 Forcer l'actualisation** ajouté dans l'en-tête de la barre de statut
- Feedback visuel : icône qui tourne + label "Mise à jour…" → "✓ 47 matchs" (ou "⚠ Erreur")
- Appelle `POST /api/v1/refresh` → attend la réponse → recharge les matchs

### Consommation révisée
| API | Fréquence | Req/cycle | Req/jour | Req/mois |
|-----|-----------|-----------|----------|----------|
| The Odds API | 12h | ~8 | ~16 | **~480** (< 500 ✅) |
| API-Football | 6h | ~15 | ~60 | ~1800 |

*L'utilisateur peut toujours forcer un refresh ponctuel via le bouton, qui consomme ~8 req supplémentaires.*

---

## Correctifs de l'Audit v2.0 (27 avril 2026)

### 🔴 P0 — Sécurité critique

**S1/S2/S3 — Blindage du serveur de fichiers statiques**
- Ajout d'une liste noire : `.env`, `database.json`, `package.json`, `.gitignore` → réponse `403 Forbidden`
- Ajout d'un blocage des dossiers : `.git/`, `node_modules/` → `403`
- Protection path traversal : vérification `path.resolve(filePath).startsWith(__dirname)` avant tout accès fichier
- Toute tentative d'accès à `http://localhost:3000/.env` ou `../../etc/passwd` retourne maintenant 403

**S5 — Limite de taille POST**
- Nouvelle fonction `readBodyLimited(req, maxSize)` — coupe la connexion si le payload dépasse 1 Mo
- Appliquée sur `/api/v1/gemini` — retourne `413 Payload Too Large`

### 🟠 P1 — Fiabilité backend

**P1 — Verrou anti-race-condition**
- Ajout de deux flags mutex : `isFetchingOdds` et `isFetchingStats`
- Chaque cron job vérifie le flag avant de démarrer, log un avertissement si déjà en cours
- Relâchement du flag dans un bloc `finally` pour garantir la libération même en cas d'erreur

**P2 — saveDB asynchrone**
- `fs.writeFileSync` remplacé par `fs.writeFile` avec callback d'erreur
- L'event loop n'est plus bloquée pendant la sauvegarde de `database.json`

**F1 — Commentaire header corrigé**
- "toutes les 15 min" → "toutes les 12h" dans le header de `server.js`

### 🟡 P1 — Logique frontend

**F2 — Double tri corrigé**
- Avant : tri par stat → immédiatement écrasé par tri par date → le tri par colonne ne fonctionnait pas
- Après : `if (!sortKey) { filtered.sort(by date) }` — le tri par date ne s'applique qu'en l'absence de tri utilisateur

**F3 — Colonne Moy. Buts colorisée**
- Nouveau type `'avg'` dans la fonction `sc()` — vert ≥ 2.0, orange ≥ 1.2, rouge en dessous
- Alignée visuellement avec le style OddAlerts des autres colonnes

### 🟡 P2 — Transparence algorithmique

**A1 — Colonnes estimées marquées**
- Les headers BTTS %, +2.5 Buts %, +1.5 Buts 1MT portent maintenant le symbole `≈` et un tooltip :
  *"Estimation basée sur buts marqués/encaissés — pas un historique brut"*
- Les cellules individuelles de ces colonnes portent le même tooltip au survol
- La fonction `sc()` accepte maintenant un 3ème paramètre `tooltip`

### Vérifications post-correctifs
- ✅ `node --check server.js` — syntaxe valide
- ✅ Braces HTML/JS : 236/236 — équilibrées
- ✅ 0 clé API dans le frontend
- ✅ `isSafePath()` bloque `.env`, `database.json`, path traversal

---

## Phase 3 — Intelligence complète (27 avril 2026, session 3)

### Option A — Distribution de Poisson (complétée)
- `renderMatches()` mis à jour : utilise `m.poisson.*` (données serveur) à la place des anciennes formules linéaires
- Nouvelles colonnes Poisson unifiées : BTTS, O 0.5, O 1.5, O 2.5, O 3.5 (en bleu dans le tableau)
- xG (Expected Goals) affiché depuis `m.expectedGoals.home/away` au lieu de `avgScored`
- Tooltip sur chaque ligne : scores les plus probables (ex: "1-0(14%) 2-0(11%)…")
- Fonction `scp()` dédiée aux cellules Poisson (seuil: >65% vert, >45% orange, <45% rouge)

### Option B — Backtesting (complété)
- `updateStatusBar()` affiche la précision algorithme : "✓ Précision (n=47): O2.5: 68% · BTTS: 61% · Edge: 55%"
- Statut `quota_epuise` géré et affiché correctement en orange
- Auto-refresh frontend toutes les 5 minutes (silencieux, pause si onglet caché via `visibilityState`)

### Option C — AI Scout (complété)
- `loadAIScout()` fetch `/api/v1/ai-scout` en arrière-plan après chargement des matchs
- Affichage dans `#ai-scout-panel` avec horodatage "Généré il y a X min"
- Markdown `**bold**` converti en `<strong>` pour l'affichage

---

## Phase 4 — Fiabilisation (27 avril 2026, session 3)

### server.js
- **Levenshtein distance** : remplacement du fuzzy matching par premier mot par un algorithme de distance éditoriale (seuil: 25% de la longueur du nom ou 3 chars)
- **Saison dynamique** : `currentSeason()` — retourne l'année courante si mois ≥ juillet, sinon année-1
- **Nettoyage automatique** : `cleanExpiredMatches()` supprime les matchs dont le coup d'envoi était il y a >90min après chaque cron Odds
- **Suivi 429** : `db.status = 'quota_epuise'` et `saveDB()` lors d'un HTTP 429 sur The Odds API
- **Telegram alertes** : envoi automatique après chaque cron Odds réussi (threshold configurable via `ALERT_EDGE_THRESHOLD`)

### pariscore.html
- **Filtre Edge minimum** : nouvelle rangée de filtres (Tous / +1% / +3% / +5%★ / +10%) avec compteur "N value bets"
- **Auto-refresh 5 min** : `startAutoRefresh()` lancé après le premier chargement des matchs
- **Gestion 429** : message "Quota API épuisé — données en cache" au lieu du message générique
- **Labels filtres ligue** : ajout d'un préfixe "Ligue :" pour la lisibilité

---

## Phase 5 — Production (27 avril 2026, session 3)

### server.js
- **JWT (HMAC-SHA256, natif crypto)** : `jwtSign()` / `jwtVerify()` sans dépendance npm
  - Route `POST /api/v1/auth/login` → token 7 jours
  - `getAuthUser(req)` → vérifie l'en-tête `Authorization: Bearer {token}`
  - Utilisateurs en mémoire : `admin` (mot de passe via `ADMIN_PASSWORD` dans `.env`) et `demo`
- **Telegram Bot** : `sendTelegramAlert()` / `sendValueBetAlerts()` via API Telegram native (https)
  - Envoi automatique après chaque cron Odds pour les matchs avec edge > seuil
  - Format HTML : équipe, heure, cote, edge, BTTS%, O2.5%
  - Variables `.env` : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS` (CSV), `ALERT_EDGE_THRESHOLD`
- **Route `GET /api/v1/predictions`** : matchs classés par confiance (algo Poisson convergent + edge)
  - Génère `recommendation` textuelle par match ("Victoire PSG", "Plus de 2.5 buts"…)
- **Route `GET /api/v1/trends`** : agrégats BTTS/Over 2.5/xG globaux + par ligue + accuracy
- **Route `GET /api/v1/history`** : archive des matchs vérifiés avec scores réels
- **Route `GET /api/v1/admin/status`** : tableau de bord complet (protégé JWT admin)
  - uptime, mémoire heap, flags mutex, quota, accuracy, chats Telegram, AI Scout cache
- **Route `POST /api/v1/telegram/test`** : envoi manuel d'alertes (protégé JWT admin)
- **CORS configurable** : `ALLOWED_ORIGIN` dans `.env` → restreint en production (wildcard `*` en dev)

### pariscore.html
- **Page Prédictions connectée** : `loadPredictions()` → `/api/v1/predictions` → cartes dynamiques avec barres Poisson, xG, recommandation
- **Page Tendances connectée** : `loadTrends()` → `/api/v1/trends` → tendances globales + par ligue en temps réel
- Chargement déclenché automatiquement à la navigation vers ces onglets (via `showPage()`)

### Nouveaux fichiers
- **`admin.html`** : dashboard admin complet (authentification JWT, KPIs, accuracy, value bets, actions, logs)
  - Connexion avec `admin` / mot de passe configuré dans `.env`
  - Auto-refresh 30s, boutons "Forcer MAJ" et "Test Telegram"
  - Accessible via `http://localhost:3000/admin.html`
- **`render.yaml`** : blueprint de déploiement pour Render.com
  - Disque persistant 1Go pour `database.json` et `history.json`
  - Variables d'environnement documentées (sync:false pour les secrets)
  - `JWT_SECRET` auto-généré par Render

### Variables `.env` complètes (v5.0)
```
PORT=3000
ODDS_API_KEY=...
API_FOOTBALL_KEY=...
GEMINI_API_KEY=...
JWT_SECRET=...              (auto-généré si absent)
ADMIN_PASSWORD=...          (défaut: pariscore2026)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_IDS=...       (IDs séparés par virgule)
ALERT_EDGE_THRESHOLD=8      (edge % minimum pour alertes)
ALLOWED_ORIGIN=*            (restreindre en production)
```

---

## Hotfix — Navigation brisée (27 avril 2026)

### Symptôme
Tous les liens de la barre de navigation (`Accueil`, `Matchs`, `Prédictions IA`, `Tendances`, `Alertes`, `Tarifs`) étaient non fonctionnels après la session Phase 3→5.

### Cause racine : 2 bugs JS imbriqués
**Bug 1 — Code orphelin (SyntaxError fatale)**
- Lors de la migration des onglets Prédictions/Tendances vers les fonctions `loadPredictions()` et `loadTrends()`, le `str_replace` a supprimé le début de l'ancien tableau `const PREDS = [` mais laissé les données restantes en place, suivies d'un `PREDS.forEach(...)` et des données statiques `TRENDS`.
- Ces objets littéraux orphelins (`{ league:'LIGUE 1'... }`) suivis d'un `]` sans ouverture créaient une **SyntaxError au chargement** qui crashait l'intégralité du JS → aucun `onclick` ne fonctionnait.

**Bug 2 — Apostrophe doublement échappée**
- La chaîne `'Forcer l\\'actualisation'` dans `forceRefresh()` contenait un `\\` (double backslash) interprété comme `\'` par le parser JS, ce qui fermait la string prématurément → deuxième erreur de syntaxe en cascade.

### Correction appliquée
- Suppression complète du bloc orphelin (lignes 1455–1499) : données PREDS résiduelles, `PREDS.forEach`, données TRENDS statiques et `TRENDS.forEach`
- Remplacement de `'Forcer l\\'actualisation'` par `"Forcer l'actualisation"` (guillemets doubles) aux 2 occurrences dans `forceRefresh()`

### Vérification post-fix
- `node --check` sur le JS extrait : ✅ syntaxe valide
- Toutes les pages : div présent + lien `showPage()` → ✅ × 6
- Accolades : 276/276 équilibrées ✅

---

## Hotfix — Navigation invisible (opacity:0) (27 avril 2026)

### Symptôme
Les liens de navigation déclenchaient bien `showPage()` (pas d'erreur JS) mais le contenu restait **invisible** après le clic — opacity 0, l'utilisateur voyait une page noire.

### Cause racine : IntersectionObserver + display:none
Toutes les sections secondaires portent la classe `.fade-up` (`opacity: 0; transform: translateY(16px)`). L'`IntersectionObserver` est initialisé au chargement de la page et observe ces éléments. Comme leurs parents (`div[data-page]`) sont en `display:none`, ils ne sont **jamais intersectants** → ils ne reçoivent jamais la classe `.visible` (qui met `opacity: 1`).

Quand `showPage()` affichait la page, le contenu devenait techniquement visible dans le DOM mais restait à **opacity: 0** — invisible pour l'utilisateur.

La page Accueil n'était pas affectée car elle est `display:block` dès le chargement, donc ses sections intersectent l'observer et reçoivent `.visible` normalement.

### Corrections appliquées

**`showPage()` — force `.visible` après affichage :**
```js
page.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
```
Dès qu'une page est affichée, toutes ses sections reçoivent immédiatement `.visible`.

**CSS — animation d'entrée pour les pages SPA :**
```css
@keyframes pageEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
div[data-page][style*="display: block"] > section { animation: pageEnter .35s ease both; }
```
Animation légère (350ms) qui s'applique à chaque section quand sa page devient visible, sans dépendre de l'IntersectionObserver.

### Leçon retenue
> Dans une SPA avec navigation par `display:none/block`, les animations/transitions basées sur `IntersectionObserver` ne fonctionnent pas pour le contenu initialement caché. Toujours forcer la visibilité lors de l'affichage d'un onglet.

---

## Fix — Colonnes Poisson : format + tri (27 avril 2026)

### Problème signalé
Les colonnes BTTS, O 0.5, O 1.5, O 2.5, O 3.5 avaient :
1. **Un format visuel incohérent** — couleur bleue et `rowspan="2"` qui les faisait fusionner les deux lignes d'en-tête, les isolant visuellement du reste du tableau
2. **Aucun tri possible** — pas de bouton ↕ contrairement à toutes les autres colonnes

### Corrections

**HTML — En-têtes :**
- Suppression des 5 `<th rowspan="2" style="color:var(--blue);">` individuels
- Remplacement par un `<th colspan="5" class="stat-group">Poisson</th>` unique en 1ère ligne (style identique aux autres groupes : PPG, Victoires %, etc.)
- Ajout de 5 `<th class="sortable">` dans la 2ème ligne (BTTS, O 0.5, O 1.5, O 2.5, O 3.5) avec `onclick="setSort('poisson_btts', this)"` etc.

**JS — Logique de tri :**
- `setSort()` : inchangé (accepte déjà n'importe quelle clé)
- Bloc de tri dans `renderMatches()` : ajout d'une branche `poisson_*`
```js
if (sortKey.startsWith('poisson_')) {
  const stat = sortKey.slice(8); // 'btts', 'over05', 'over25'…
  va = a.poisson?.[stat] ?? 0;
  vb = b.poisson?.[stat] ?? 0;
}
```
- `slice(8)` correspond exactement à `'poisson_'.length` → les clés extraites (`btts`, `over05`, `over15`, `over25`, `over35`) correspondent aux propriétés de l'objet `poisson` retourné par le serveur

### Résultat
- Les colonnes Poisson s'intègrent visuellement dans le tableau comme les autres groupes
- Tri ↓ (meilleur en premier) / ↑ (moins bon en premier) disponible sur chaque colonne Poisson
- Comportement identique aux autres colonnes : indicateur vert sur la colonne active, préservé lors des changements de filtre

---

## Feature — Power Score IA (Gemini) (27 avril 2026)

### Contexte
Remplacement du simple bouton d'analyse Gemini (texte libre) par un système d'analyse prédictive structuré : le **Power Score PariScore**.

### Nouveau prompt — 5 piliers
1. **Métriques Avancées** (30%) : xG/xGA, volume corners
2. **Analyse Tactique & Effectifs** (20%) : systèmes de jeu, absences, mismatches
3. **Dynamique & Calendrier** (20%) : forme 5 derniers matchs contextualisés, SOS
4. **Presse & Consensus Web** (15%) : L'Équipe, Marca, Kicker, The Athletic, Sofascore, BetMines, Forebet, OddAlerts
5. **Psychologie & H2H** (15%) : historique sur ce terrain, enjeux

### Format de réponse — JSON strict
Gemini retourne un JSON structuré parsé côté client :
- `power_scores` : score/100 dom + ext + couleur de jauge
- `probabilites_pourcent` : 1N2 + Over 1.5 buts + Over 7.5/8.5 corners
- `analyses_detaillees` : tactique, synthèse web, corners
- `top_5_paris` : Safe · Bankroll Builder · Value Bet · Plus Risqué · Corners

### Nouveau modal — `#gemini-panel` redessiné
- **Power Score jauge** : barre proportionnelle avec couleur dynamique (hex Gemini)
- **Grille 1N2** : probabilités en gros chiffres + sous-grille Over 1.5/Corners
- **3 sections texte** : Tactique, Synthèse Presse, Corners
- **Top 5 Paris** : cartes colorées (🔒 Safe, 📈 Bankroll, 💎 Value, ⚡ Risqué, 🎯 Corners)
- **Loading spinner** pendant la génération (≈5-10s)
- Parsing JSON robuste avec fallback `indexOf('{')` si Gemini ajoute des backticks

---

## Hotfix — Modèle Gemini déprécié (27 avril 2026)

- `gemini-1.5-flash` → `gemini-2.0-flash` (3 occurrences dans `server.js`)
- Cause : `gemini-1.5-flash` n'est plus disponible sur le endpoint `v1beta/generateContent`
- Erreur initiale : `HTTP 404 — models/gemini-1.5-flash is not found for API version v1beta`

---

## Document — Audit Compétitif OddAlerts (27 avril 2026)

Création de `oddalertscomp.md` :
- Analyse détaillée de 9 fonctionnalités principales d'OddAlerts
- Tableau comparatif PariScore vs OddAlerts (17 critères)
- Identification des avantages compétitifs de PariScore (Power Score IA, UI premium)
- Roadmap d'amélioration priorisée sur 3 mois
- Recommandations stratégiques : filtres avancés, profit calculator, alertes temps réel

---

## Update — CLAUDE.md : TODOLIST Post-Audit (27 avril 2026)

Ajout de la section "15. TODOLIST — Améliorations Post-Audit OddAlerts" dans CLAUDE.md :
- 🔥 **P0 Quick Wins** (Semaines 1-4) : filtres avancés, profit calculator, alertes temps réel, page backtesting
- 🟡 **P1 Majeures** (Semaines 5-8) : dropping odds, Power Score V2, dashboard alertes, favoris
- 🔮 **P2-P3 Long Terme** (Mois 2-3) : in-play live, bet tracking, API publique, SQLite, monétisation
- Objectifs 3 mois : 100+ utilisateurs, 10+ Pro payants, accuracy >65%
- Positionnement stratégique : "PariScore = OddAlerts francophone avec IA explicative"

---

## Feature — Radar Chart Attributs (BeSoccer-style) (27 avril 2026)

Ajout d'un diagramme radar dans le modal Power Score pour comparer visuellement les attributs des deux équipes :

**Attributs calculés (sur 100) :**
- **Rating** : basé sur PPG (Points Par Gain)
- **Attack** : moyenne de buts marqués
- **Squad** : pourcentage de victoires (qualité effectif)
- **Goalkeepers** : inverse des buts encaissés
- **Defense** : inverse de la moyenne de buts concédés
- **Midfield** : contrôle (combinaison draws + wins/2)

**Implémentation :**
- Chart.js radar type avec 2 datasets (home/away)
- Couleurs : vert (home), bleu (away) avec transparence 15%
- Thème dark intégré (grille, labels, tooltips)
- Légende en bas avec points circulaires
- Canvas 400×280px responsive

**Position :** Entre "Power Score" et "Probabilités" dans le modal.

**Fonction :** `renderTeamRadar(m)` — calcule et affiche le radar basé sur `m.stats.home` et `m.stats.away`.

**Design inspiré de :** BeSoccer.com (diagramme ATTRIBUTS à 6 axes).

---

## Feature — Bouton APT + Modal Attributs Dédié (27 avril 2026)

### Contexte
Suite à un problème de quota Gemini (HTTP 429), l'utilisateur ne voulait plus que le radar chart soit exclusivement dans le modal Power Score IA (✦).

### Solution : Séparation des préoccupations
Création d'un **bouton APT séparé** (Attributs) à côté du diamant bleu (✦) :
- **✦ (diamant bleu)** → Power Score IA (Gemini) — payant, analyse complète
- **APT (violet)** → Attributs radar uniquement — gratuit, instantané, sans API

### Implémentation

**HTML :**
- Nouveau bouton `.apt-btn` dans chaque ligne du tableau (à côté de `.ai-btn`)
- Nouveau modal `#attributes-modal` avec canvas `#attr-radar-chart`

**CSS :**
- `.apt-btn` : violet (#ab47bc), taille 9px, font-mono, hover scale
- `#attributes-modal` / `#attributes-panel` : style identique au modal Gemini

**JavaScript :**
- `openAttributesRadar(idx)` : ouvre le modal, remplit titre/date, appelle renderAttributesRadar()
- `closeAttributesRadar()` : ferme le modal
- `renderAttributesRadar(m)` : identique à renderTeamRadar mais utilise `#attr-radar-chart`
- Suppression de `renderTeamRadar(m)` dans `renderPowerScore()` (plus dans modal Gemini)
- Suppression section "Team Attributes Radar" du modal Power Score

### Avantages
1. **Gratuit** — pas d'appel Gemini, utilise seulement les stats existantes
2. **Instantané** — pas de loading, s'affiche immédiatement
3. **Indépendant** — fonctionne même si Gemini est en quota exceeded
4. **Séparation claire** — ✦ = IA avancée, APT = stats visuelles basiques

### Position
Colonne Actions du tableau → **✦ APT** (deux boutons côte à côte)

### 🛠 Diagnostic technique - 28 Avril 2026
- **Spider Chart (Radar) :** Identification de la cause du radar vide (absence de data dans l'objet `stats`).
- **Data Mapping :** Définition des 6 axes requis provenant des `/standings` d'API-Football.
- **Requête :** Nécessité de forcer le rafraîchissement des statistiques côté serveur pour peupler `database.json`.

---

## Session du 28 avril 2026 — Refonte IA + Expansion Ligues + Fixes

### 1. Refonte Assistant Scout IA (Gemini)

**server.js — Proxy `/api/v1/gemini` :**
- Injection automatique de `safetySettings: BLOCK_NONE` sur les 4 catégories (Harassment, Hate Speech, Sexually Explicit, Dangerous Content) — évite les faux-positifs sur les stats sportives
- Injection de `generationConfig.response_mime_type: "application/json"` — force Gemini à retourner du JSON pur sans backticks ni texte parasite

**server.js — `generateAIScout()` :**
- Même `safetySettings` + même `response_mime_type` appliqués
- Nouveau prompt rôle "Expert en mathématiques appliquées au sport" avec vocabulaire scientifique (λ Poisson, écart statistique, indice de stabilité)
- Constante `GEMINI_SAFETY_SETTINGS` partagée entre le proxy et l'AI Scout

**pariscore.html — `callGemini()` :**
- Nouveau rôle : "Tu es l'expert en mathématiques appliquées au sport de la plateforme PariScore"
- Vocabulaire : "Écart statistique (edge)" remplace "Edge value bet", "λ domicile" remplace "Expected Goals dom"
- Nouveau format JSON de sortie : `top_5_opportunites` avec les clés :
  - `1_indice_stabilite` (🔒 Safe)
  - `2_croissance_fonds` (📈 Value)
  - `3_ecart_statistique` (💎 Value Bet)
  - `4_indice_speculatif` (⚡ Risqué, champ `score_estime`)
  - `5_analyse_finesse` (🎯 Finesse)

**pariscore.html — `renderPowerScore()` :**
- Lit `j.top_5_opportunites || j.top_5_paris` (rétrocompatible avec ancienne structure)
- `parisConfig` mis à jour avec les 5 nouvelles clés + maintien des 5 anciennes en fallback

---

### 2. Fix Spider Chart (Radar APT)

**Cause réelle :** `Chart.js` n'était pas chargé dans le HTML — `new Chart()` appelait une fonction undefined.

**Corrections :**
- Ajout du CDN `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js">` dans `<head>`
- `maintainAspectRatio: false` dans `renderAttributesRadar()` pour remplir correctement le conteneur `height:360px`
- Les 6 axes (Rating, Attack, Squad, Goalkeepers, Defense, Midfield) s'appuient sur `m.stats.home/away` avec fallback `simStats()`

---

### 3. Colonne "Score ≈" dans le tableau des matchs

- Nouvelle colonne entre xG et les cotes (1/N/2)
- Affiche le score le plus probable calculé par Poisson : `1-0 (14%)` en vert (grand)
- Les 3 scores suivants en petit : `2-0(11%) 0-0(9%) 1-1(8%)`
- Données déjà disponibles dans `poisson.topScores` — zéro appel API supplémentaire
- En-tête marqué `Score ≈` (`rowspan="2"`) avec tooltip "Score le plus probable selon Poisson"

---

### 4. Expansion du Catalogue — `leagues_config.json`

Nouveau fichier de configuration des ligues extrait de `server.js` :

| Type | Ligues | cron_hours |
|------|--------|-----------|
| T1 Europe | Ligue 1(61), PL(39), CL(2), LaLiga(140), Bundesliga(78), SerieA(135), EL(3), CEL(848) | 6h |
| T1 Monde | MLS(253), Brasileirão(71), J1(98), K-League(292), Saudi Pro(307) | 12h |
| T2 Europe | Championship(40), Ligue 2(62), 2.Bundesliga(79), Serie B(136), Segunda(141) | 12h |

**server.js — Chargement dynamique :**
- `SPORT_LABELS`, `ALL_SPORTS`, `ALL_LEAGUE_IDS` construits depuis `leagues_config.json` au boot
- Fallback intégré si le fichier est absent (7 ligues par défaut)
- `fetchStats()` : démarre avec `ALL_LEAGUE_IDS` puis complète avec les IDs découverts via fixtures

**Résultat :** 141 matchs disponibles (vs ~43 avant) couvrant 16 ligues actives

---

### 5. Fix critique — Saison API-Football (plan gratuit)

**Problème :** `currentSeason()` retournait 2025 (avril 2026, mois < 7). Le plan gratuit API-Football ne donne accès qu'aux saisons 2022-2024 → `response: []` → 0 équipes → tous les matchs en mode SIM.

**Correction dans `fetchStats()` :**
- Détection de l'erreur `errors.plan` dans la réponse standings
- Fallback automatique : `activeSeason--` puis nouvel appel avec la saison précédente
- Log explicite : `Plan gratuit — saison 2025 non accessible, bascule sur 2024`

**Résultat après fix :** 158 équipes LIVE chargées, badges LIVE dans le tableau

---

### Fichiers modifiés
| Fichier | Modifications |
|---------|--------------|
| `server.js` | Proxy Gemini (+safetySettings+mime_type), GEMINI_SAFETY_SETTINGS, chargement leagues_config.json, fetchStats() saison fallback |
| `pariscore.html` | callGemini() prompt scientifique, renderPowerScore() top_5_opportunites, Chart.js CDN, maintainAspectRatio, colonne Score ≈ |
| `leagues_config.json` | Nouveau fichier — 18 ligues configurées T1/T2 |
| `CLAUDE.md` | Sections 16 et 17 marquées [x] |

---

## [2026-04-28] — Version 4.0 "Elite Stats"

### Ajouté
- **Modal "PariScore Insights"** : hub de statistiques ultra-complet ouvert via bouton `STATS` dans le tableau des matchs.
  - 4 onglets : **Résumé** (forme, barres comparaison, marchés Poisson, notes par secteur) | **Stats Équipe** (tirs, dom/ext, records, pénaltys, discipline) | **Joueurs** (buteurs/passeurs par équipe, MVP ★, top ligue) | **Classement** (interactif avec filtres).
- **Route backend** `GET /api/v1/insights/:matchId` — fusionne stats équipe, stats avancées, top buteurs et classement en une seule réponse.
- **`calculatePoisson(lH, lA, max)`** — fonction nommée côté serveur retournant la matrice brute de probabilités (alias de `computePoisson`).
- **Pilier 2 — Tirs** : `shots_on_home/away`, `shots_total_home/away` extraits de `/teams/statistics` et affichés dans l'onglet Stats.
- **Pilier 5 — Discipline** : `cards_yellow_total`, `cards_red_total`, `clean_sheet_home/away/total` extraits et affichés.
- **Pilier 6 — xG Différentiel** : calcul `λ_home − λ_away` affiché sous les barres de comparaison avec label favori Poisson.
- **Pilier 7 — Team MVP** : joueur avec le meilleur rating mis en avant (badge ★ MVP, card surlignée or) dans l'onglet Joueurs.
- **Pilier 8 — Notes par Secteur** : barres Attaque/Défense (0-10, colorées vert/orange/rouge) calculées depuis `avgScored`/`avgConceded`.
- **Pilier 9 — Classement dynamique** : 3 modes (Global / Dom. / Ext.) + tri multi-critères (Points / Buts+ / Buts- / Cartons) via `insSetStandingsMode()` / `insSetStandingsSort()`.

### Amélioré
- `fetchTeamAdvancedStats()` enrichi : +10 nouveaux champs (shots, cards, clean_sheets, goals_total_avg).
- Standings dans `/api/v1/insights` : +18 champs home/away split pour le filtre dynamique côté client.
- Algorithme IA hybridé avec la Distribution de Poisson pour une précision accrue des marchés.

### Non implémenté (roadmap P2)
- **Pilier 4 — Corners** : non disponible dans `/teams/statistics` → requiert `/fixtures?team=&last=10` (budget API, reporté).

---

## [2026-04-28] — Bugfixes Modals (v4.0.1)

### Corrigé
- **Bug critique — mauvais match dans les modals** : `openInsights`, `openGemini`, `openScoreMatrix`, `openAttributesRadar` utilisaient `allMatches[idx]` où `idx` était l'index dans le tableau **filtré**. Quand un filtre ligue ou jour était actif, cliquer sur Arsenal (position 0 du filtré) chargeait `allMatches[0]` = un tout autre match.
  - **Fix** : les 4 boutons de chaque ligne passent maintenant `m.id` (identifiant stable) ; les fonctions font `allMatches.find(x => x.id === matchId)`.
- **Stats manquantes pour ligues mineures (J1, K-League…)** : quand une équipe n'est pas trouvée dans `db.teamStats` (fuzzy match échoue), `homeStats` est null → onglet Résumé affichait uniquement xG, sans PPG/Victoires/Buts.
  - **Fix** : fallback sur `d.match.stats?.home/away` (toujours présent, calculé par Poisson/simStats lors du `buildMatchRecord`).
- **Cache `advancedTeamStats` périmé (migration v4.0)** : les entrées en cache avant la v4.0 n'ont pas les champs `shots_on_total`, `cards_yellow_total`, etc. → onglet Stats Équipe affichait des sections vides même pour des équipes avec données LIVE.
  - **Fix** : `fetchTeamAdvancedStats` détecte l'absence de `shots_on_total` et invalide l'entrée → re-fetch automatique au prochain appel.

---

## [2026-04-29] — Migration SQLite (v4.3)

### Ajouté
- **`better-sqlite3`** : seule dépendance npm introduite — SQLite natif synchrone pour Node.js.
- **`pariscore.db`** : fichier SQLite unique remplaçant `database.json`, `history.json` et `ai_cache.json`.
- **WAL mode** (`PRAGMA journal_mode = WAL`) : lecteurs et écrivains ne se bloquent plus mutuellement — critique pour le Smart Polling live 60s.
- **Transactions atomiques** : `saveDB()` écrit toutes les clés en une seule transaction — fin des corruptions partielles si le serveur crash mid-write.
- **Couche KV SQLite** : `initSQLite()` + `kvGet(key)` + `kvSet(key, value)` + `kvSetBatch(entries)` — abstraction propre que le reste du code n'a pas besoin de connaître.
- **Migration one-shot automatique** : au premier démarrage, `loadDB/History/AICache()` détectent les anciens JSON, les importent dans SQLite, puis les renomment en `.migrated`.

### Modifié
- `saveDB()` : `fs.writeFile()` → `kvSetBatch()` transactionnel (5 clés : `db_matches`, `db_team_stats`, `db_adv_stats`, `db_top_scorers`, `db_meta`).
- `loadDB()` : `fs.readFileSync()` → `kvGet()` par clé + migration automatique si ancien JSON présent.
- `saveHistory()` / `loadHistory()` : idem → clés `history_matches`, `history_accuracy`.
- `saveAICache()` / `loadAICache()` : idem → clé `ai_cache`.
- `initSQLite()` appelé en premier dans la séquence de boot, avant `loadDB()`.
- `BLOCKED_FILES` : ajout de `pariscore.db` (protégé en HTTP 403).

### Architecture
- L'objet `db` en mémoire est **inchangé** : zéro refactoring des 91 accès `db.*` dans server.js.
- La contrainte "zéro dépendance npm" est levée pour `better-sqlite3` uniquement (requis par l'upgrade plan PRO API-Football + Smart Polling live).

---

## [2026-04-29] — Quick Wins UX + Inspiration Datafoot (v4.2)

### Ajouté
- **Sparklines de forme** : mini-graphe SVG (W=haut / D=milieu / L=bas) affiché à côté de chaque équipe dans la colonne Match — `formSparkline(form)` généré côté client, dot coloré sur le dernier résultat.
- **Système de favoris ★** : bouton étoile sur chaque ligne du tableau, persisté en `localStorage` (`ps_fav`). Filtre "★ Favoris" dans la barre Edge pour afficher uniquement les matchs étoilés.
- **Badges de match count sur filtres Jour** (inspiration Datafoot "Planning view") : "Aujourd'hui (8)", "Demain (5)" — le count est calculé à chaque `renderMatches()` et mis à jour dynamiquement.
- **Onglet Graphique** dans le modal Insights : évolution de forme SVG pour les deux équipes (lignes + dots colorés W/D/L) + barres de bilan de saison (V/N/D en %) avec PPG. Zéro appel API supplémentaire.
- **Accuracy pills** dans la status bar : indicateurs de précision backtesting (O2.5/BTTS/Edge) affichés sous forme de badges colorés (vert ≥65%, orange ≥55%, gris sinon) à la place du texte brut.
- **Badges de zone** dans Rankings : #1-4 bleu (CL) / #5-6 vert (Europa) / 3 derniers rouge (Relégation) — classe CSS `.rk-zone-cl/.rk-zone-el/.rk-zone-rel` sur `.rk-num`.
- **Mobile compact** : `@media (max-width:768px)` masque Nuls, Défaites et xG pour réduire la largeur du tableau.
- **`home_form`/`away_form`** dans `buildMatchRecord` (server.js) : la chaîne de forme de chaque équipe est désormais transmise dans la réponse `/api/v1/matches` et utilisée par les sparklines.

### Source d'inspiration
- Audit Datafoot.fr (datafoot.fr/access/fr/) : Planning view (match counts), form graphs, accuracy rate prominent

---

## [2026-04-28] — Classement Dynamique Rankings/Standings (v4.1)

### Ajouté
- **Onglet Classement refactorisé** : deux vues switchables **Rankings** (liste) et **Standings** (tableau), inspirées de l'image de référence BeSoccer/SofaScore.
- **Vue Rankings** : liste numérotée `# | Équipe [H/A] | Valeur | Barre de progression` ; barres colorées (bleu = domicile, violet = extérieur, bleu semi-transparent = autres équipes).
- **Sélecteur de critère** : dropdown PPG / Buts+ / Buts- / Cartons (tri instantané côté client, zéro appel API).
- **Filtre temporel** : dropdown Saison / L5 / L10 / L25 — PPG L5/L10/L25 calculé depuis la chaîne `form` (ex: "WWDLW") ; autres stats affichent la saison avec note explicative.
- **Filtre de lieu** : dropdown Global / Domicile / Extérieur (recalcul des valeurs home/away split).
- **Badges H/A** : équipes du match mises en évidence par badge coloré et texte en gras dans les deux vues.
- Nouvelles classes CSS : `.rk-controls`, `.rk-view-tabs/.rk-view-tab`, `.rk-select`, `.rk-list/.rk-row`, `.rk-num/.rk-name/.rk-val/.rk-bar`, `.rk-badge-H/.rk-badge-A`.

### Modifié
- Variables JS : `insStandingsSort` supprimé → remplacé par `insRankingStat` + `insRankingPeriod` + `insTablesView`.
- Setters : `insSetStandingsMode/Sort` → `insSetMode`, `insSetTabView`, `insSetRankStat`, `insSetRankPeriod` (tous via `_rebuildClassement()`).


## [2026-04-30] - Session Matin (Audit & IA)

### Added
- Lancement et finalisation de l'audit comparatif (`auditintegrationIA.md`) incluant MatchonAI, OddAlerts, ScoutingStats et TNNS Live[cite: 1, 2].
- Définition du "Master Prompt" Expert Data Science pour le futur chatbot PariScore[cite: 1].
- Configuration des MCP `firecrawl` et `odds-api` pour le support de la recherche web en direct[cite: 1].
- Planification de l'architecture de streaming (SSE) pour l'analyse de matchs en temps réel[cite: 1].

### Changed
- Mise à jour de la roadmap `CLAUDE.md` pour prioriser l'intégration de l'IA et du Power Score V2[cite: 1, 2].

## [2026-04-30] - Session Matin (Status: Ongoing)

### Added
- Début de l'audit concurrentiel sur l'intégration de l'IA (MatchonAI, OddAlerts, TNNS Live)[cite: 1, 2].
- Initialisation du fichier `auditintegrationIA.md`[cite: 1].

### Changed
- **Priorité redéfinie** : La prospection comparative et l'analyse des chatbots concurrents sont placées en tête de liste pour la session de 15h20[cite: 1].
- Le développement technique (SSE/Chatbot) est suspendu jusqu'à la finalisation complète de l'audit.
