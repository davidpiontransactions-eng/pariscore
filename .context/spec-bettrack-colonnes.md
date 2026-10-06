# Spec colonnes — BetManager + Suivi Bankroll (bettrack v1)

> **Phase 0 — 2026-10-06.** Sources : `C:\Users\David\Documents\GenOffice\calc.xlsx` (extrait structurel,
> dump : `%TEMP%\opencode\calc-dump.txt`, script `%TEMP%\opencode\parse-calc.mjs`) · inventaire
> `bettrackai.com` (~85 % : bundle JS public enroulé + Wayback 2026-06-14, 7 familles A-G) ·
> module existant `src/lib/bet-manager/` + `public/suivi-paris.html` (1 852 l.).
> Légende statut : ✅ existant · 🔧 à étendre · ➕ à créer · 📦 v2 · ❓ anomalie à trancher.

---

## 1. calc.xlsx — inventaire complet (3 feuilles : `Sheet1`, `Feuille1` vide, `Feuille2`)

### 1.1 Sheet1 — journal de plan (96 cellules, lignes 2-6, dates sérielles = 10ᵉ du mois)

| Col | En-tête | Formule (lignes 2→6) | Rôle | Statut cible |
|---|---|---|---|---|
| A | `date` | 46063 · 46091 · 46122 · 46152 (= 10/02 → 10/06/2026) | Date de la ligne de plan | ➕ `PlanDay.date` |
| B | `capital` | 200 · `=240` · `=B3+E3` · `=B4+E4` · `=B5+H5` | Capital en début de période | ➕ `PlanDay.capitalInitial` (❓ règles B divergentes, §4.2) |
| C | `% int. cap` | 0,1 partout | Taux réinvesti capital | ➕ param `pctCapital` (défaut 0,10) |
| D | `% bank` | 0,1 partout | Taux versé banque | ➕ param `pctBank` (défaut 0,10) |
| E | `Gain` | `=B×(C+D)` | Gain théorique de la période (`targetPct = C+D = 20 %`) | ➕ `PlanDay.gainTheorique` |
| F | `Gain à faire` | `=C×B` (l.2-4) ; `=E−L−N` (l.5-6) | Gain ajusté écarts/remboursements | ❓ §4.1 |
| G | `Bank` | vide l.2-4 ; `=C×B` l.5-6 | Part banque théorique | ➕ `PlanDay.bankTheorique` |
| H | `Cap` | `=B×D` | Part capital théorique | ➕ `PlanDay.capTheorique` |
| I | `A atteindre` | `=B+H+G` (l.2-3) ; `=B+G+H+Gₙ₋₁−N−Lₙ₋₁` (l.4-6) | Objectif cumulé théorique | ➕ `PlanDay.objectifCumul` (❓ §4.3) |
| J | `Atteint` | saisi (173,8 / 157 / 277…) ; `=Jₙ₋₁+(Gₙ+Hₙ−Lₙ₋₁−Nₙ₋₁)` (l.3) | Cumul réel | ➕ `PlanDay.reelCumul` = `computeReal()` |
| K | `Ecart` | `=J−I` | Écart réel − théorique (= « Montant de retard » suivi-paris) | ✅ colonne suivi-paris, ➕ calcul `plan.ts` |
| L | `Ecart j/rest` | `=K/O` | Écart étalé sur jours restants (signé) | ➕ `retard/j` (signé) |
| M | `Total Rbt bk` | saisi (−100, `=-100−N3−150`…) | Remboursements banque cumulés (manuel) | ➕ ledger `BankrollTx` (type withdrawal/adjust) |
| N | `Total Rbt par jour` | `=M/O` | Remboursement quotidien à servir | ➕ `PlanDay.rbtJour` |
| O | `Nbre de jours restant` | `=31−2`, 28, 27, 26, 26 | Jours restants dans la période | ➕ `PlanDay.joursRestants` |
| Q | `Bank rentré` | `Non` | Flag : part banque effectivement virée | ➕ `PlanDay.bankRentre` (bool) |
| R | *(sans en-tête)* | `=P+G+H` (P vide) | Total théorique banque+capital | ✅ redondant avec I, non porté |
| S | `Rbt` | `=100/O` (l.3) ; date 46183 (l.5) | Brouillon remboursement/jour | ❓ cellule brouillon, non porté |

### 1.2 Feuille2 — déclinaison quotidienne (12 cellules)

| Col | En-tête | Formule/valeur | Rôle | Statut cible |
|---|---|---|---|---|
| A | `Date` | 46152 (10/05/2026) | Date du jour de pari | ➕ `PlanDay.date` |
| B | `A faire par jour` | `=Sheet1!F5` | Objectif de gain du jour | ➕ `PlanDay.gainAFaire` |
| C | `Nbre Paris moyens` | 10 | n = paris/jour | ✅ param `maxBets` suivi-paris (défaut 11) 🔧 |
| D | `Cote moyenne` | 1,18 | cote cible | ✅ param `oddsTarget` (défaut 2,00) 🔧 |
| E | `Gains / Pari` | `=B/C` | `gainParPari = G/n` | ➕ `plan.ts` |
| F | `Mise moyenne` | `=E/(1−D)` | `stake = gainParPari / (cote−1)` | ❓ signe, §4.4 — canon : `E/(D−1)` |

---

## 2. Équations canoniques v1 (à implémenter dans `src/lib/bet-manager/plan.ts`)

Fusion calc.xlsx × `suivi-paris.html` (chiffres déjà validés entrée 126 : `C₃₀=3489.88 · B₃₀=3289.88 · T₃₀=6779.76`).

```
targetPct    = pctCapital + pctBank                    (défaut 0,10 + 0,10 = 0,20)
G_j          = targetPct × C_j                         (E, gain théorique du jour)
banque_j     = bankPct × G_j  ;  bankPct = pctCapital/(C+D) = 0,50   (G de Sheet1)
reinvest_j   = G_j − banque_j
C_{j+1}      = C_j + reinvest_j                        (×1,10/j aux défauts)
n            = maxBets                                 (défaut 11)
gainParPari  = G_j / n
stakeRequis  = gainParPari / (cote − 1)                (Feuille2 F corrigé)
O_req        = 1 + G_j / S_j                           (S_j = mise totale du jour)
O_neutre     = 1 / q                                   (q = proba de gain)
retardSigné  = T_th − T_re                             (= K, « Montant de retard »)
rbtJour      = max(0, retardSigné) / joursRestants     (jamais négatif, jour courant inclus)
tableArb     : 5 %→5.00 · 10 %→3.00 · 15 %→2.33 · 20 %→2.00 · 30 %→1,67 · 40 %→1,50 · 50 %→1,40 · 100 %→1,20
```

Params : `capital=200 · targetPct=20 % · bankPct=50 % · startDate · days=30 · maxBets=11 · stakePct=20 · oddsTarget=2.00 · winProb=0.50 · autoBank=true` (identiques `DEFAULTS` suivi-paris :422 et calc C/D = 10 %+10 %).

---

## 3. Matrice colonnes bettrackai → Pariscore

### 3.1 Table paris (famille A — Dashboard / Historique / Mark Won-Lost-Pending)

| Colonne bettrack | Cible Pariscore | Statut |
|---|---|---|
| Date | `Bet.placedAt` | ✅ |
| Matchup | `Bet.matchLabel` + `BetLeg.matchLabel` (combo) | ✅ |
| Selection | `Bet.pick` / `BetLeg.pick` | ✅ |
| Market | `Bet.market` / `BetLeg.market` | ✅ |
| Wager | `Bet.stake` | ✅ |
| Odds | `Bet.odds` | ✅ |
| Result (Won/Lost/Pending/Cashed Out) | `Bet.status` ∈ pending/won/lost/void/**cashout** | ✅ |
| Payout | `Bet.payout` | ✅ |
| Profit | `Bet.profit` + `betProfit()` | ✅ |
| Bookmaker | `Bet.bookmaker` | ✅ |
| Sport / League | `Bet.sport` | ✅ |
| Competition | `Bet.competition` | ✅ |
| Type Straight/Parlay/**Arbitrage** | `Bet.betType` single/combo/back/lay/dutch/system — **arbitrage absent** | 🔧 ajouter `"arb"` au union type + routes |
| Closing odds → CLV | `Bet.closingOdd` | ✅ champ ; 🔧 calcul `clvEdge` + collecte (auto-settle snapshot) |
| Mark Won/Lost/Pending, Delete | `settleBet` / `deleteBet` | ✅ |
| Cashed Out (montant saisi) | `onSettle(b,"cashout")` — API force `payout=stake` actuellement | 🔧 payout saisi (bug #, phase 5) |
| Export CSV par bet | `betsToCSV` + `exportReportHTML` | ✅ lib ; 🔧 branchement UI |
| Recherche + filtres date/statut/book/sport/type + tris | `bets/page.tsx` filtres existants | 🔧 étendre (tris Status/Book Group) |

### 3.2 Bankroll multi-comptes + ledger (famille A — Bankroll Tracker)

| Colonne bettrack | Cible | Statut |
|---|---|---|
| Accounts (solde initial, nom) | `Bankroll` (name, currency, initial) | ✅ |
| Deposits / Withdrawals / Bonuses / Adjustements | table **`BankrollTx`** (kind, amount, at, note, bankrollId) | ➕ phase 2 |
| KPI Current Bankroll | `stats.current` | ✅ |
| KPI Starting | `stats.initial` | ✅ |
| KPI Bet P/L | `stats.profit` | ✅ |
| KPI Pending Exposure | `Σ stakes status=pending` | ➕ dans `BankrollStats` |
| KPI Deposits/Withdrawals/Bonuses/Net Movement | agrégats `BankrollTx` | ➕ |
| Manual Ledger (liste transactions) | page ledger CRUD | ➕ phase 6 |
| Courbe Cumulative Bankroll (2 séries txn vs bet) | `capitalCurve()` 🔧 2ᵉ série `capitalCurveWithTx()` | 🔧 |
| Export CSV bankroll | `export-bankroll.ts` existant | ✅ 🔧 colonnes tx |

### 3.3 Active Bets (famille A — Premium)

| Colonne bettrack | Cible | Statut |
|---|---|---|
| Groupes in progress / upcoming / awaiting results | pending splité : `placedAt ≤ now` / `> now` / pending > 24 h sans settle | ➕ phase 6 (règle à affiner) |
| Live scores (poll 10 s) | infra live existante (socket/SWR) hors périmètre v1 : snapshot BSD si dispo | 📦 partiel v1 : badge si dispo, 📦 poll v2 |
| KPIs total / at risk / potential payout | `Σ pending stakes` + `Σ stake×odds` | ➕ |
| Cash-out manuel montant | fix phase 5 (payout saisi) | 🔧 |

### 3.4 Analytics + Insights (famille B)

| Colonne bettrack | Cible | Statut |
|---|---|---|
| Breakdown **By Market Type** | `groupStats(bets, b => b.market)` | ✅ pattern, 🔧 câblage UI |
| **By Odds Range** | `groupStats(bets, b => oddsBucket(b.odds))` | ✅ idem |
| **By Sportsbook** | `groupStats(bets, b => b.bookmaker)` | ✅ idem |
| **By Timing** (plages horaires) | `groupStats` + bucket horaire | ➕ helper `hourBucket()` |
| Métriques Bets/Wagered/Win %/ROI/Profit | `GroupStats` | ✅ |
| **Volume %** (part du total misé) | `g.staked / stats.totalStaked` | ➕ 1 champ calcul |
| **Longest win/lose streak par groupe** | streak run par groupe dans `groupStats` | 🔧 |
| Best/worst book, Top 10 parlays | tri `groupStats` + `bets.filter(combo)` tri profit | ➕ UI |
| Insights Strengths/Weaknesses/Watchouts | règles : ≥5 réglés pour signaler, « watchout » si négatif sur ≥20 paris | ➕ `insights.ts` (règles simples) |
| Presets Today/Week/Month/Quarter/YTD/All | filtres date existants | 🔧 presets |

### 3.5 CLV Tracker (famille B)

| Colonne bettrack | Cible | Statut |
|---|---|---|
| Average CLV Edge / CLV Raw / Positive CLV Rate / Bets Tracked | `clvEdge = 1/closingOdd − 1/odds` (**positif si notre cote > cote de clôture** = on a battu la clôture ; la formule initialement écrite `1/odds − 1/closing` avait le signe inversé, corrigé en P3) ; `avgRaw = odds − closingOdd` ; agrégats `computeClvStats()` | ➕ `stats.ts` (`clvEdge`, `computeClvStats`) ; 🔧 collecte `closingOdd` (snapshot auto-settle) |
| CLV par sport / par marché / win rate by CLV | `groupStats` sur buckets CLV | ➕ |

### 3.6 Calendrier P/L (famille A)

| Colonne bettrack | Cible | Statut |
|---|---|---|
| Jours colorés P/L + résumé mensuel + tendance | agrégat quotidien `betProfit` (déjà `capitalCurve` + `monthKey`) | ➕ composant `pl-calendar` phase 6 |
| Lien public / partage image | — | 📦 v2 (partage social) |

### 3.7 Calculatrices (famille C)

| Cible | Statut |
|---|---|
| Arb Calculator, Parlay Calculator | ✅ `calculators.ts` (`arbitrage`, `parlayCalculator`) |
| **Promo Conversion Calculator** (bonus, hedge, conversion %, scénarios) | ➕ `promoConversion()` phase 3 |
| 17→18 calculateurs + Montante | ✅ ; 🔧 en-tête « 17 » → 18, grille + carte Montante |

### 3.8 Import 1xBet HTML (demande utilisateur)

| Source | Cible | Statut |
|---|---|---|
| `ocr.ts parse1xbetTicket` (226 l., **jamais branché UI**) + `parse1xbetCoupon`/`parse1xbetHtml` (suivi-paris, zip coupon) | service unique `src/lib/bet-manager/import-1xbet.ts` + drag&drop/collage dans `bet-form` | ➕ phase 4 |
| OCR capture (IA, upload 4 Mo, review step) | `ocr.ts parseTicketText` + Gemini vision | 📦 v2 |

---

## 4. Anomalies calc.xlsx à trancher (avant phase 3)

1. **Feuille2 F** : `=E/(1−D)` avec cote D = 1,18 → mise **négative**. Canon retenu : `stake = gainParPari/(cote−1)`.
2. **Colonne F** change de définition : `=C×B` (l.2-4) puis `=E−L−N` (l.5-6). Canon : `gainAFaire = G − écarts − rbt` (correspond au calcul réel suivi-paris).
3. **Swap libellé/valeur C-D vs G-H** : `G (Bank) = C×B` avec C = « % int. cap » et `H (Cap) = B×D` avec D = « % bank ». Comme C = D = 10 %, le résultat est identique (50/50) — canon retenu : `banque = bankPct × G`, `bankPct = C/(C+D) = 0,50` (libellés à réaligner côté UI).
4. **B capital** : définitions divergentes `=Bₙ₋₁+Eₙ₋₁` (gain total) vs `=B₅+H₅` (part banque seule), `=240` en dur. Canon : `C_{j+1} = C_j + reinvest_j` (suivi-paris, ×1,10/j).
5. **I objectif cumul** : 3 définitions (l.2, l.3, l.4-6). Canon : `objectifCumul_j = C_j + banqueCumul + capitalCumul` (I2/I3).
6. **Fréquence** : dates Sheet1 = le 10 de chaque mois (02/06 2026) alors que le modèle suivi-paris est **quotidien 02/10→31/10** et O = jours restants (~30). **À confirmer : checkpoints mensuels OU lignes quotidiennes lacunaires ?** — la v1 implémente **quotidien** (modèle validé), avec JoursRestants comme champ.
7. Cellules brouillon non portées : `A7 =173+R3`, `J10 =J4+F5`, `S5` (date), `R =P+G+H` (P vide).

---

## 5. Hors périmètre v1 (📦 v2 confirmé par l'utilisateur)

Partage social (image PNG + lien `/s/<code>`) · OCR IA bet slip · Low Hold / Arb scanner live (infra odds existante déjà en place) · PRA/MLB props (non pertinent FR) · alerts daily recap + seuil edge (le hook `use-bet-notify` existe déjà pour les signaux) · onboarding multi-étapes · démo data · poll scores 5-10 s · sync backfill hors auto-settle.

---

## 6. Décisions validées (2026-10-06)

- **V1 = tracking complet** (phases 0-8 du plan).
- **Retrait `use-bankroll`** (localStorage) : `bet-slip` / `bet-dialog` / `bankroll-dialog` migrés sur `use-bet-manager` ; route `import/local-storage` déjà prête pour la migration des données existantes.
- **Plan quotidien = onglet `/bankroll/plan`** (page Next native, moteur en lib partagé ; `suivi-paris.html` reste disponible en export autonome).
- Réimplémentation fonctionnelle bettrackai : zéro code/asset/texte extrait, tokens `DESIGN_CHARTER.md`.
