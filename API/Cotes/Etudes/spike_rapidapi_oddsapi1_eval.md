# SPIKE EVAL — RapidAPI odds-api1 (bd ParisScorebis-qkx)

> **Date** : 21 mai 2026
> **Mission** : évaluer RapidAPI `odds-api1.p.rapidapi.com` comme source alternative cotes
> **Statut** : ⏸️ PARTIEL — login RapidAPI requis pour pricing détaillé (gates dashboard)
> **Bd ticket** : `ParisScorebis-qkx`

---

## 1. ENDPOINT TESTÉ (fourni par DG)

```
GET https://odds-api1.p.rapidapi.com/media/participants/{participantId}
Headers:
  Content-Type: application/json
  x-rapidapi-host: odds-api1.p.rapidapi.com
  x-rapidapi-key: <COMPROMISED — see security warning>
```

⚠️ **Clé API exposée en clair dans chat** : revoke immédiat requis sur dashboard RapidAPI.

---

## 2. EVAL — Ce qui est connu sans login

### Provider profile
- **Hosted** : RapidAPI marketplace (`p.rapidapi.com`)
- **URL** : https://rapidapi.com/odds-api1/api/odds-api1
- **Type** : odds aggregator B2B
- **Auth** : `x-rapidapi-key` header per RapidAPI standard

### Endpoint pattern
`/media/participants/{participantId}` suggère :
- Endpoint orienté équipe/joueur ("participant")
- Peut être lookup média (logos, photos) PAS odds directement
- Vrai endpoint odds probable : `/odds/...` ou `/markets/...` ou `/events/...`

### RapidAPI pricing tiers standards (référence marketplace)
La plupart des APIs sur RapidAPI suivent ce pattern :

| Tier | Coût/mois | Req/jour ou mois |
|---|---|---|
| BASIC (free) | $0 | 50-500 req/mois |
| PRO | $10-30 | 5k-20k req/mois |
| ULTRA | $30-100 | 50k-200k req/mois |
| MEGA | $100-500 | illimité |

Sans login dashboard, **tarification exacte odds-api1 inconnue**.

---

## 3. ANALYSE COMPARATIVE (vs spike_odds_alternatives.md combo retenu)

### Combo recommandé v12.15 :
| Source | Coût/mois | Couverture |
|---|---|---|
| The-Odds-API Starter | $30 | 7+ sports, 15+ books, 20k req |
| API-Football odds | $0 (inclus Pro) | foot only, 50 books |
| Polymarket proxy | $0 | foot+tennis populaires |
| **Total** | **$30/mo** | Diversité maximale |

### Question pour odds-api1 :
1. **Pricing tier identique à The-Odds-API ?** Si oui → redondance, pas value-add
2. **Coverage différentielle ?** Si odds-api1 expose marchés non-couverts (props joueurs détaillées, asian handicap, corners, cards) → value-add
3. **Latence inférieure ?** Si <100ms vs ~300ms The-Odds-API → value-add
4. **Données differente bookmakers ?** Si inclut bookmakers non-EU (Asia, US sharp books Pinnacle alternative) → value-add

---

## 4. RECOMMANDATION ACTIONS DG

### Phase 1 — Eval rapide (30min)
1. **Revoke clé exposée** dashboard RapidAPI (security)
2. **Login** https://rapidapi.com/odds-api1/api/odds-api1
3. **Lire** : pricing exact + endpoints catalog + coverage matrix
4. **Test** : générer NOUVELLE clé (private), tester 5 endpoints clés sur Postman/curl
5. **Documenter** : results dans ce fichier section 5 ci-dessous

### Phase 2 — Décision GO/NO-GO
**GO si** :
- Pricing ≤ $30/mo POUR coverage non-couverte par combo actuel
- OR latence <100ms verified
- OR markets uniques (props joueur, corners live)

**NO-GO si** :
- Pricing identique The-Odds-API sans value-add
- Coverage subset de ce qu'on a déjà
- ToS restrictive (commercial use, scraping interdit)

### Phase 3 — Si GO → impl (bd `x9s`)
- Ajouter `providers/odds_api1.js` client RapidAPI
- Intégrer dans fallback chain : Odds API → API-Football → **odds-api1** → Polymarket → null
- Tests E2E (bd `sml`)

---

## 5. ⏳ RÉSULTATS DG TESTS (à compléter après login)

| Endpoint | Status | Coverage | Latence | Note |
|---|---|---|---|---|
| `/events/list` ou similaire | ⏳ | ? | ? | ? |
| `/odds/{eventId}` | ⏳ | ? | ? | ? |
| `/markets/...` | ⏳ | ? | ? | ? |
| `/sports` | ⏳ | ? | ? | ? |

**Pricing confirmé** : ⏳ à confirmer dashboard
**Quota free tier** : ⏳
**Coverage sports** : ⏳
**Coverage markets** : ⏳
**Coverage bookmakers** : ⏳
**ToS commercial use** : ⏳

---

## 6. STATUT

- ❌ Eval pricing/coverage : **bloquée sur login RapidAPI** (non scrappable)
- ✅ Architecture impl prête (spike_odds_alternatives.md)
- ⏸️ Décision GO/NO-GO : attend DG eval dashboard

**Action immédiate DG** : revoke clé exposée + login + remplir section 5 ci-dessus + commenter décision.

bd `qkx` reste OPEN tant que section 5 pas remplie.

---

*Rapport partial 21/05/2026. Bd ticket : ParisScorebis-qkx.*
*Spike read-only. Aucun code production touché.*
