# COMPONENTS.md — PariScore Component Registry

> **Source of truth for component names.** Read this BEFORE referencing any
> component file. If a name is not listed here, **it does not exist** — do not
> invent variants, do not loop searching for it. Either use the real name below,
> or create it explicitly.
>
> Generated 2026-07-24 from `src/components/`. **Regenerate** after adding/removing
> components: `node scripts/regen-component-registry.mjs` (TODO) or re-run the
> extract pass. 146 components total (football: 9, leagues: 4, tennis: 51, etc.).

## ⚠️ Common hallucinations (these do NOT exist)

These names have been invented by agents and caused search loops. **Do not
reference them.** The real equivalent (if any) is in the right column.

| ❌ Invented name (DOES NOT EXIST) | ✅ Real name (or "create it") |
|-----------------------------------|-------------------------------|
| `match-header` | `match-card-header` |
| `score-card` | `match-card` or `match-card-detail` |
| `live-card` | `football-live-card` / `match-card-broadcast` |
| `player-card` | `player-block` / `player-profile-header` |
| `odds-card` | `odds-comparator` / `best-odd-badge` |
| `stats-card` | `stats-indicators-grid` / `player-statline` |

**Rule:** when unsure a component exists, `ls src/components/<category>/` once.
If absent, STOP searching — create it or ask. Do not retry with name variants.

---

## Tennis (`src/components/tennis/`) — 51 components

| Component | File | Role |
|-----------|------|------|
| backtest-badge | backtest-badge.tsx | Badge indiquant qu'un backtest existe |
| best-odd-badge | best-odd-badge.tsx | Meilleure cote trouvée pour un joueur |
| break-points-grid | break-points-grid.tsx | Matrice visuelle des balles de break |
| confidence-interval | confidence-interval.tsx | Intervalle de confiance (dual-track V2) |
| country-flag | country-flag.tsx | Drapeau du pays par code ISO |
| current-game-score | current-game-score.tsx | Score du jeu en cours (0/15/30/40/Av.) |
| featured-matches-marquee | featured-matches-marquee.tsx | Bandeau défilant des matchs à la une |
| form-dots | form-dots.tsx | Forme récente en points colorés (● W / ○ L) |
| kpi-card | kpi-card.tsx | Carte KPI générique (3-zone) |
| last-match-highlight | last-match-highlight.tsx | Chip « Dernier match » — lien YouTube vers le dernier highlight TennisTV du joueur |
| last-match-highlights-widget | last-match-highlights-widget.tsx | Mini-lecteurs YouTube du dernier match joué (H2H > joueurs > tournoi) |
| previous-match-highlights-widget | previous-match-highlights-widget.tsx | Mini-lecteurs YouTube du tour précédent (dernier match réel BSD last5 > cascade) |
| last-matches-list | last-matches-list.tsx | Derniers matchs d'un joueur |
| live-score-announcer | live-score-announcer.tsx | Annonce score pour lecteur d'écran (a11y) |
| live-stats-panel | live-stats-panel.tsx | Panneau des stats live |
| match-card | match-card.tsx | Carte de match (principale) |
| match-card-broadcast | match-card-broadcast.tsx | Carte style TV broadcast (R7) |
| live-decision-badges | live-decision-badges.tsx | Badges d'alerte live : DR, 2nd sv, fatigue, BP (R10) |
| live-decisions-drawer | live-decisions-drawer.tsx | Drawer « Décisions Live » — DR, DPI, signaux, alertes (R10) |
| live-odds-panel | live-odds-panel.tsx | Cotes live P1/P2 (1xBet, repli BSD) : chips + flèches direction + Kelly |
| match-card-detail | match-card-detail.tsx | Détail interne extrait de MatchCard |
| match-card-footer | match-card-footer.tsx | Pied de carte de match |
| match-card-header | match-card-header.tsx | En-tête de carte de match |
| match-detail-dialog | match-detail-dialog.tsx | Dialogue d'analyse détaillée d'un match |
| match-pip-widget | match-pip-widget.tsx | Conteneur du widget Document PiP (multi-matchs favoris live) |
| momentum-dr | momentum-dr.tsx | Momentum (dynamic, best-of-5 aware) |
| momentum-score | momentum-score.tsx | Score 0-100 EWM (DR/aces/serve/form/momentum) |
| odds-comparator | odds-comparator.tsx | Comparateur de cotes |
| pip-bet-panel | pip-bet-panel.tsx | Panneau 5 bets prédictifs (vainqueur match/set, Over games) |
| pip-match-row | pip-match-row.tsx | Ligne compacte d'un match dans le widget PiP (score + DR + feu tricolore) |
| player-block | player-block.tsx | Bloc joueur (avatar + nom + stats) |
| player-profile-header | player-profile-header.tsx | En-tête profil joueur ("A. Rublev") |
| player-profile-dialog | player-profile-dialog.tsx | Fiche joueur in-page (rang ATP/WTA, Elo par surface, prochains matchs) |
| player-profile-view | player-profile-view.tsx | Vue profil `/tennis/player/[slug]` |
| player-statline | player-statline.tsx | Ligne de stats compacte sous le nom |
| player-vs-block | player-vs-block.tsx | Layout duel VS avec avatars, drapeaux, barre prob |
| point-timeline | point-timeline.tsx | Timeline horizontale des points joués |
| press-review-panel | press-review-panel.tsx | Revue de presse tennis (3+ sources, consensus, LLM fallback) |
| probability-bar | probability-bar.tsx | Barre de probabilité (décomposition) |
| probability-ring | probability-ring.tsx | Anneau de probabilité (SVG) |
| quick-add-ring | quick-add-ring.tsx | Anneau d'ajout rapide au bet-slip |
| serve-stats-bars | serve-stats-bars.tsx | Barres divergentes comparant les stats service |
| server-indicator | server-indicator.tsx | Indicateur "X sert" (balle pulsée) |
| set-by-set-table | set-by-set-table.tsx | Tableau set par set |
| set-scoreline | set-scoreline.tsx | Scoreline set par set (notation tennis) |
| sparkline | sparkline.tsx | Sparkline SVG minimal pour progression Elo |
| stat-chip | stat-chip.tsx | Chip de stat compact |
| stats-indicators-grid | stats-indicators-grid.tsx | Grille hiérarchique des indicateurs match |
| stats-leaderboard | stats-leaderboard.tsx | Leaderboard stats joueurs type ATP (page `/tennis/stats`) |
| stats-radar-chart | stats-radar-chart.tsx | Radar chart des stats (6 axes) |
| surface-badge | surface-badge.tsx | Badge surface (Dur/Terre battue/Gazon) |
| tennis-search-bar | tennis-search-bar.tsx | Barre de recherche tennis (joueurs/tournois) |
| tournament-header-card | tournament-header-card.tsx | Carte tournoi sélectionné (filtre de la liste + annulation) |
| tennis-sub-tabs | tennis-sub-tabs.tsx | Sous-onglets tennis |
| tournament-badge | tournament-badge.tsx | Badge catégorie tournoi (GS/M1000/500) |
| tournament-view | tournament-view.tsx | Vue `/tennis/tournament/[slug]` |
| tournaments-list | tournaments-list.tsx | Liste des tournois |
| win-probability-chart | win-probability-chart.tsx | Graphique de probabilité de victoire |

## Football (`src/components/football/`) — 11 components

| Component | File | Role |
|-----------|------|------|
| football-filters | football-filters.tsx | Filtres football (league bar + drapeaux CDN + lien stats) |
| football-live-card | football-live-card.tsx | Carte match live football |
| football-match-card | football-match-card.tsx | Carte de match football |
| football-match-detail-dialog | football-match-detail-dialog.tsx | Dialogue analyse détaillée d'un match foot |
| football-tab-content | football-tab-content.tsx | Contenu de l'onglet football |
| flashscore-football-list | flashscore-football-list.tsx | Liste style Flashscore |
| LiveDecisionMomentumWidget | LiveDecisionMomentumWidget.tsx | Widget live : indice de pression [-100,+100], alerte but imminent, marchés live |
| MatchPredictiveCard | MatchPredictiveCard.tsx | Carte analyse prédictive ML (badge tendance, résumé, 3 paris, zéro lien externe) |
| momentum-chart | momentum-chart.tsx | Graphique momentum football |
| tennis-tab-content | tennis-tab-content.tsx | Contenu de l'onglet tennis _(vit ici, pas dans tennis/)_ |
| top-teams-presets-bar | top-teams-presets-bar.tsx | Barre de 10 filtres rapides prédictifs (1X2, DC, Over/Under, PPG, Corners…) |

## Leagues (`src/components/leagues/`) — 4 components

| Component | File | Role |
|-----------|------|------|
| league-stats-table | league-stats-table.tsx | Tableau classement ligue (triable, métriques avancées) |
| league-location-tabs | league-location-tabs.tsx | Toggle Global / Domicile / Extérieur |
| league-market-tops | league-market-tops.tsx | Grille widgets « Tops Équipes par Marché » |
| league-market-widget | league-market-widget.tsx | Widget unitaire top 5 d'un marché (PPG, Over, BTTS…) |

## F1 (`src/components/f1/`) — 2 components

| Component | File | Role |
|-----------|------|------|
| f1-driver-card | f1-driver-card.tsx | Carte pilote F1 (photo, écurie, proba) |
| f1-tab-content | f1-tab-content.tsx | Contenu de l'onglet F1 |

## MMA (`src/components/mma/`) — 3 components

| Component | File | Role |
|-----------|------|------|
| mma-fight-card | mma-fight-card.tsx | Carte de combat MMA |
| mma-filters | mma-filters.tsx | Filtres MMA |
| mma-tab-content | mma-tab-content.tsx | Contenu de l'onglet MMA |

## Cycling (`src/components/cycling/`) — 3 components

| Component | File | Role |
|-----------|------|------|
| cycling-filters | cycling-filters.tsx | Filtres cyclisme |
| cycling-stage-card | cycling-stage-card.tsx | Carte d'étape cyclisme |
| cycling-tab-content | cycling-tab-content.tsx | Contenu de l'onglet cyclisme |

## CS2 (`src/components/cs2/`) — 1 component

| Component | File | Role |
|-----------|------|------|
| cs2-tab-content | cs2-tab-content.tsx | Contenu de l'onglet CS2 |

## NBA (`src/components/nba/`) — 1 component

| Component | File | Role |
|-----------|------|------|
| nba-tab-content | nba-tab-content.tsx | Contenu de l'onglet NBA |

## WNBA (`src/components/wnba/`) — 1 component

| Component | File | Role |
|-----------|------|------|
| wnba-tab-content | wnba-tab-content.tsx | Contenu de l'onglet WNBA |

## Layout (`src/components/layout/`) — 1 component

| Component | File | Role |
|-----------|------|------|
| sport-tabs | sport-tabs.tsx | Onglets de navigation entre sports |

## AI (`src/components/ai/`) — 2 components

| Component | File | Role |
|-----------|------|------|
| ai-compare-dialog | ai-compare-dialog.tsx | Dialogue de comparaison 2 matchs par Gemini (cote-à-cote, facteurs, recommandation) |
| ai-insight-card | ai-insight-card.tsx | Carte d'analyse mono-match Gemini (sélecteur + mode compare) |
| editorial-insight | editorial-insight.tsx | Analyse éditoriale prédictive (whitelist): compact carte / full modale, traduit fr/en selon locale |

## UI primitives (`src/components/ui/`) — 50 components (shadcn/ui, New York)

Standard shadcn/ui set, owned in-repo. Full list: `accordion`, `alert`,
`alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`,
`calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`,
`context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`,
`input-otp`, `input`, `label`, `menubar`, `navigation-menu`, `pagination`,
`player-avatar`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`,
`separator`, `sheet`, `skeleton`, `slider`, `sonner`, `spinner`, `sport-image`, `switch`,
`table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`, `tooltip`,
`typography`.

Enumerate with `ls src/components/ui/`. Do NOT invent UI primitives — if a
shadcn component is missing, add it via `bunx shadcn@latest add <name>`.

## Root (`src/components/`) — 20 components

| Component | File | Role |
|-----------|------|------|
| ab-test-debug | ab-test-debug.tsx | Debug panel for A/B tests |
| about-dialog | about-dialog.tsx | Dialogue "À propos" |
| analytics-provider | analytics-provider.tsx | Provider analytics (lazy-init client) |
| api-docs-dialog | api-docs-dialog.tsx | Dialogue de doc API |
| bankroll-dialog | bankroll-dialog.tsx | Dialogue gestion de bankroll |
| bet-dialog | bet-dialog.tsx | Dialogue de pari |
| bet-slip | bet-slip.tsx | Le bet-slip (panier de paris) |
| bookmaker-comparator-dialog | bookmaker-comparator-dialog.tsx | Comparateur de bookmakers |
| consent-banner | consent-banner.tsx | Bannière de consentement (RGPD) |
| consent-provider | consent-provider.tsx | Provider de consentement |
| email-toggle | email-toggle.tsx | Toggle notifications email |
| feedback-widget | feedback-widget.tsx | Widget de feedback utilisateur |
| language-toggle | language-toggle.tsx | Toggle de langue (cookie-based) |
| paper-trading-dialog | paper-trading-dialog.tsx | Dialogue paper trading |
| privacy-dialog | privacy-dialog.tsx | Dialogue vie privée |
| push-toggle | push-toggle.tsx | Toggle notifications push |
| sentry-error-boundary | sentry-error-boundary.tsx | Error boundary Sentry |
| sw-register | sw-register.tsx | Enregistrement service worker (PWA) |
| terminal-toggle | terminal-toggle.tsx | Toggle mode terminal |
| theme-toggle | theme-toggle.tsx | Toggle thème clair/sombre |
| value-bet-scanner-indicator | value-bet-scanner-indicator.tsx | Indicateur du scanner de value bets |

---

## Conventions

- **One component per file**, filename = kebab-case = export name (PascalCase).
- **Sport components** live in `src/components/<sport>/`. Cross-sport or app-shell
  components live at `src/components/` root.
- **`tennis-tab-content`** is the exception — it lives in `football/` for
  historical reasons (shared tab shell). Don't "fix" this without checking imports.
- **UI primitives** are shadcn/ui (New York style). Reuse them; don't hand-roll
  buttons/dialogs.
