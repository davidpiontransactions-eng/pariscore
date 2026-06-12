# Étude — Scraping Betfair.com pour WOM par joueur (tennis)

Date: 2026-06-12
Auteur: Analyse technique
Statut: COMPLÈTE

---

## Résumé exécutif

**Le code dispose déjà de DEUX chemins pour obtenir le WOM par joueur tennis.** Aucun nouveau développement nécessaire — seulement des credentials ou une infra existante à activer.

| Chemin | Statut | Coût | Bloqueur |
|--------|--------|------|----------|
| betfair.com scraping inline (server.js) | ✅ Codé, appelé | GRATUIT | FlareSolverr + clé hardcodée |
| betfairService.js API officielle | ✅ Codé, 339 lignes | GRATUIT (Delayed Key) | BETFAIR_USER/PASS/APP_KEY |
| betwatch.fr Moneyway | ❌ Tennis paywallé | Payant (Extra Sports) | TOS + coût |

---

## 1. Chemin A — Scraping betfair.com (server.js inline)

_BF_AK = 'nzIFcwyWhrlwYMrh' → API read-only betfair.com → WOM par runner (p1/p2).

- etchBetfairWOM(name1, name2, sport) ~line 29618
- nrichMatchesWithBetfairWOM(matches, sport) ~line 29688
- **Déjà appelé pour tennis** ligne 23903
- Route GET /api/v1/tennis/wom?p1=&p2= ~line 35792

Dépend de FlareSolverr. Limitation : géo-bloqué France, clé hardcodée fragile.

---

## 2. Chemin B — API officielle Betfair (betfairService.js)

339 lignes, JSON-RPC, 4 étapes : login → listEvents → listMarketCatalogue → listMarketBook.

**Delayed App Key = GRATUIT (£0)**. Donne EX_BEST_OFFERS → WOM% par joueur calculable.

Procédure : VPN → compte Betfair → developer.betfair.com → clé Delayed → .env.

---

## 3. Chemin C — betwatch.fr tennis (paywall)

Cache data/betwatch_wom.json vide (count:0). Tennis = Extra Sports = payant. Abandonner.

---

## 4. Recommandation

**Immédiat** : tester le Chemin A sur VPS (déjà actif, appelé ligne 23903).
**Court terme** : créer compte Betfair (VPN) + Delayed Key gratuite.
**Moyen terme** : les deux chemins sont câblés et peuvent servir de fallback mutuel.
