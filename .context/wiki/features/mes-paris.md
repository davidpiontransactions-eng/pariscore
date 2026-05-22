---
type: feature
slug: mes-paris
title: Mes Paris (Bet Tracking + Bankroll)
status: active-v9.8-livré
tags: [feature, bet-tracking, bankroll, user-data, premium]
updated: 2026-05-22
sources: ["pariscore.html (#page-bets)", "server.js", "CLAUDE.md"]
xref: [[kelly-cap]], [[edge-no-vig]], [[stripe]], [[sqlite-wal]]
---

# Mes Paris (Bet Tracking + Bankroll)

**TL;DR:** Page `#page-bets` PariScore — gestion paris user (saisie/règlement) + bankroll réelle + KPIs + chart évolution + 3 tabs (Ouverts/Réglés/Combinés) + filtres + Kelly suggestion + export CSV. Livré v9.8 2026-05-12.

## Composants

- **KPIs header:** ROI%, Profit total, Win Rate, Longest Streak, Average odds
- **Chart bankroll** evolution (Chart.js line cumul)
- **3 tabs:**
  - Ouverts (paris en cours, awaiting result)
  - Réglés (settled win/loss)
  - Combinés (parlay/accumulators) — note: limited support, scope future
- **Filtres:** date range, ligue, marché, sport, status, edge min
- **Modals:**
  - Saisie pari (match + marché + cote + stake + Kelly suggestion auto)
  - Règlement (mark win/loss manual, propose auto-suggest depuis archive_matches verified)
  - Dépôt / Retrait bankroll

## Tables SQLite

```sql
CREATE TABLE user_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,         -- scope par user
  match_id TEXT,
  sport TEXT,
  league TEXT,
  market TEXT,                       -- '1X2', 'BTTS', 'O2.5', etc
  selection TEXT,                    -- 'HOME', 'YES', 'OVER', etc
  odds REAL,
  stake INTEGER,                     -- cents (precision int)
  potential_return INTEGER,          -- cents
  status TEXT,                       -- 'open', 'won', 'lost', 'void', 'cashout'
  created_at INTEGER,
  settled_at INTEGER,
  auto_suggested INTEGER             -- 0/1 flag UX
);

CREATE TABLE bankroll_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT,                         -- 'deposit', 'withdrawal', 'bet_stake', 'bet_payout'
  amount INTEGER,                    -- cents (signed)
  balance_after INTEGER,             -- cents (snapshot)
  ref_bet_id INTEGER,                -- FK user_bets si bet_stake/bet_payout
  note TEXT,
  created_at INTEGER
);
```

INTEGER cents pour precision (pas float drift). `bankroll_actuelle = sum(amount) per user`.

## Auto-suggest règlement

Quand match archivé `verified=true` (cf. `archive_matches` cron):
- Lookup `user_bets WHERE match_id = X AND status = 'open'`
- Detect win/loss selon market + selection vs score réel
- Propose règlement modal (jamais auto-applied — user confirme)

## Kelly suggestion (cf. [[kelly-cap]])

Modal "Saisie pari" calcule stake suggéré:
```js
prob_fair = match.fair[selection]  // depuis devig Shin-Hurley
edge = (odds × prob_fair) - 1
kelly_full = (odds × prob_fair - (1 - prob_fair)) / odds
kelly_25pct = kelly_full × 0.25
stake_suggested = bankroll_actuelle × kelly_25pct
stake_capped = min(stake_suggested, bankroll_actuelle × 0.05)  // 5% max abs
```

Toggle user "Kelly cap 25%" (default ON) vs "Kelly full" (warning risque).

## Export CSV

Bouton "Export Mes Paris CSV" → format compatible Excel:
```
Date,Match,Marché,Sélection,Cote,Stake,Status,P&L,Bankroll après
```

## Hors scope v9.8

- **Combinés/parlay** — UI 3e tab existe mais limited (no Kelly parlay generalization)
- **Scraping 1xbet** depuis Aff link backclick (impossible 1xbet anti-bot)
- **Cashout live** (necessite tracking partial odds drift — complexe)

## Gates

`/api/v1/bets*` + `/api/v1/bankroll*` dans `anyPro` set (server.js:14521) → requiert plan Pro quelconque. 403 sinon.

## Code locations

- `pariscore.html` `#page-bets` div container
- `pariscore.html` modals saisie/règlement/dépôt
- `server.js` routes `/api/v1/bets` CRUD + `/api/v1/bankroll` + `/api/v1/bankroll/simulated` (vitrine marketing publique)
- `server.js` `user_bets` + `bankroll_transactions` schemas
- `server.js` auto-suggest cron archive integration

## Related

- [[kelly-cap]] — Sizing logic
- [[edge-no-vig]] — Source prob_fair pour Kelly
- [[stripe]] — Conditionne accès (Pro user) (à créer)
- [[sqlite-wal]] — Persistance tables

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
