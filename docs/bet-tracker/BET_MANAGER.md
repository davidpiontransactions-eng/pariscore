# Bet Manager — Module de gestion de paris sportifs

**Livré le** : 2026-08-20 · **Bead** : ParisScorebis-0rql · **Rapport concurrentiel** : [RAPPORT_SCRAPING.md](./RAPPORT_SCRAPING.md)

Module complet intégré à PariScore (Next.js 16), best-of Bet-Analytix × BettingTracker : multi-bankrolls en base, import OCR de tickets 1xbet, import/export CSV, stats ROI/yield/drawdown, 17 calculateurs.

## Pages

| Route | Contenu |
|---|---|
| `/bankroll` | Dashboard : KPIs trading cockpit, courbe de capital (Recharts), répartitions (sport/bookmaker/plage de cote), derniers paris |
| `/bankroll/bets` | Liste complète : recherche, filtres par statut, export CSV, import CSV, ajout de pari |
| `/bankroll/tools` | 17 calculateurs gratuits + « Plan de mise » sur l'historique réel |

Accès : bouton **Bet Manager** (icône BarChart3) dans le header de la home.

## Architecture

```
prisma/schema.prisma              # Bankroll, Bet, BetLeg, Bookmaker, ImportBatch (SQLite, db:push)
src/lib/bet-manager/
  types.ts                        # Types partagés (Bet, Bankroll, stats…)
  stats.ts                        # Stats pures : ROI, yield, streaks, drawdown, variance, courbe, groupes
  calculators.ts                  # 17 calculateurs + parse/export CSV
  ocr.ts                          # OCR de ticket (tesseract.js, 100% local, import dynamique)
  api.ts                          # Client fetch /api/v1/bm/*
src/hooks/use-bet-manager.ts      # Hook SWR : bankrolls, paris, stats, actions
src/components/bet-manager/       # 9 composants (voir COMPONENTS.md)
src/app/bankroll/{,bets,tools}/   # Les 3 pages
src/app/api/v1/bm/                # API routes (bankrolls, bets, bets/[id], import/csv)
```

## API

| Endpoint | Méthodes | Rôle |
|---|---|---|
| `/api/v1/bm/bankrolls` | GET, POST | Liste / création bankroll |
| `/api/v1/bm/bankrolls/:id` | GET, PATCH, DELETE | Détail / édition / suppression (cascade paris) |
| `/api/v1/bm/bets` | GET, POST | Liste filtrable (bankrollId, status, sport, search) / création |
| `/api/v1/bm/bets/:id` | PATCH, DELETE | Règlement (won/lost/void/cashout → payout+profit auto) / suppression |
| `/api/v1/bm/import/csv` | POST | Import en masse `{bankrollId, csv}` |
| `/api/v1/bm/import/local-storage` | POST | Migration de l'ancien module localStorage `{state: {initial, bets[]}}` |
| `/api/v1/bm/auto-settle` | POST, GET(?token=) | Résultats automatiques via API-Football (GET = usage cron avec `CRON_SECRET`) |

## Résultats automatiques (auto-settle)

- **Bouton « Résultats auto »** (dashboard + page Paris) : résout les paris football *pending*.
- Résolution de fixture : `matchLabel` → recherche sur les fixtures API-Football (`v3.football.api-sports.io`, header `x-apisports-key`) dans une fenêtre J-2 → J+2 autour de la date de placement, matching souple des noms (normalisation accents/casse, initiales « PSG » ⊂ « Paris Saint Germain »). Cache fixtures 30 min via `KvStore`.
- Marchés évalués automatiquement : **1X2/Vainqueur, Over/Under (void si ligne entière exacte), BTTS, Double chance**. Tout autre marché → reste *pending* (règlement manuel).
- Seuls les matchs terminés (`FT`/`AET`/`PEN`) sont réglés.
- Nécessite `API_FOOTBALL_KEY` dans `.env` (absente en local actuellement — le bouton répond « Fixture introuvable », pas de crash). Tests unitaires : `scripts/test-auto-settle.ts` (18 cas).

## Migration ancien module (localStorage)

Bandeau automatique sur `/bankroll` et `/bankroll/bets` si l'ancien `setpoint-bankroll` (module tennis localStorage) contient des paris : import en un clic vers une bankroll dédiée (« Bankroll migrée (ancien module) »), conversion complète (statuts, payouts recalculés, tournoi → compétition, surface → note), flag `bm-migrated-setpoint` pour ne pas re-proposer. Bouton « Plus tard » pour ignorer.

## Parser OCR 1xbet

`src/lib/bet-manager/ocr.ts` — machine à états dédiée au format ticket 1xbet (FR/EN) :
- lignes événement (« PSG — Olympique de Marseille »), en-têtes marché → canoniques (Résultat → 1X2, Total buts/Plus de → Over/Under, Les deux équipes marquent → BTTS, Double chance…), sélections + cotes, pied de ticket (« Montant du pari », « Gain possible », « Cote totale », « N° de coupon »).
- Combinés détectés : >1 sélection → type *combiné*, legs pré-remplis dans le formulaire, cote totale = pied de ticket sinon produit des cotes.
- Fallback générique pour tickets non-1xbet. Tests : `scripts/test-ocr-parser.ts` (20 cas).

## Import 1xbet — méthodes sûres

⚠️ **Jamais de login/mot de passe** (CGU 1xbet = risque ban + sécurité). Deux méthodes supportées :

1. **OCR ticket** (bouton « Scanner un ticket » dans le formulaire) : capture d'écran du ticket → tesseract.js en local dans le navigateur (import dynamique, ~2 Mo chargés au premier scan) → regex extraction (match, cote, mise) → formulaire pré-rempli à vérifier.
2. **CSV** : copier-coller de l'historique 1xbet ou fichier .csv → mapping flexible (`placedAt,date,mise,cote,stake,odds…`) → aperçu du nombre de paris détectés → import.

## Métriques calculées (stats.ts)

ROI, yield, winrate, profit, cote moyenne, mise moyenne, meilleures/pires séries, série en cours, **drawdown max**, variance/écart-type des P/L, courbe de capital par jour. Les paris **void** (RET/WO remboursés) sont exclus des mises risquées — même règle que le module historique `use-bankroll`.

## QA

- `scripts/qa-bet-manager.py` (Playwright) : dashboard, ajout de pari via formulaire, règlement, filtres, 17 calculateurs, mobile 390px sans overflow horizontal. Screenshots dans `docs/bet-tracker/qa/`.
- `scripts/test-ocr-parser.ts` (bun) : 20 cas — parser 1xbet simple/combiné + fallback.
- `scripts/test-auto-settle.ts` (bun) : 18 cas — évaluation des marchés (1X2, O/U, BTTS, double chance, void, non supportés).
- `scripts/qa-migration.py` (Playwright) : migration localStorage → DB end-to-end validée (3 paris tennis, payouts recalculés, flag posé).
- Typecheck : 0 erreur sur le module (erreurs préexistantes ailleurs ignorées).
- ESLint : 0 erreur.
- API testée end-to-end au curl (création, règlement, import CSV, suppression, auto-settle sans clé → dégradé propre).

## Limites connues / suites possibles

- **Auto-settle non testé en réel** : `API_FOOTBALL_KEY` absente du `.env` local (présente sur le VPS). Le code est dégradé proprement (« Fixture introuvable »). À valider en prod ou en ajoutant la clé.
- Marchés auto-limités (1X2, O/U, BTTS, double chance) — handicaps et combinés restent manuels.
- L'OCR est testé sur textes simulés ; la qualité dépend de tesseract sur vraies captures (pré-remplissage à vérifier à chaque scan, jamais de saisie aveugle).
- Le module localStorage historique (`bankroll-dialog`) coexiste toujours (dialog Wallet) — la migration est proposée mais l'ancien module n'est pas retiré.