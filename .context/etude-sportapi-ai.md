# Étude — sevruk.sportapi.ai pour PariScore

**Date** : 2026-05-13
**Auteur** : Claude (CTO/Quant)
**Statut** : Étude only — pas d'intégration code commandée
**Décision utilisateur** : différer toute intégration. Budget POC décidé ultérieurement.

---

## 1. Identité provider

| Élément | Valeur |
|---|---|
| Domaine commercial | `sportapi.ai` |
| Sous-domaine étudié | `sevruk.sportapi.ai` (homepage identique au domaine racine) |
| Base API | `https://api.sportapi.ai/v1/` |
| Frontend | Nuxt 3 SPA (`buildId: "dev"`) derrière Cloudflare |
| Docs publiques | `https://sportapi.ai/docs/` — SPA non SSR, contenu invisible sans rendu JS |
| Pricing public | `https://sportapi.ai/pricing/` — SPA non SSR, prix $ non extractibles via WebFetch/curl |
| robots.txt | `User-Agent: *` `Disallow:` (vide) — pas de restriction de crawl |
| WHOIS / contact | Non investigué |

**Signaux "one-man shop"** :
- Sous-domaine = patronyme auteur ("sevruk").
- `buildId: "dev"` exposé en production (mauvaise hygiène CI/CD).
- Aucun mention "team", "company", "about us" indexable dans Google.
- Aucune review tierce trouvée (sportsapis.dev 2026, apidog blog, slashdot, sportsdataapi.com, weareexquisite.co.uk) → **absent des comparatifs marché 2026**.

---

## 2. Capacités techniques (sources : Google snippets, pas docs officielles)

| Élément | Valeur connue |
|---|---|
| Couverture sports | 50+ (football, basket, tennis, ...) |
| Auth | Header `X-API-Key: <clé>` |
| Endpoints v1 connus | `/v1/fixtures`, `/v1/matches` (live), `/v1/teams/{id}` (roster incl.), `/v1/standings` |
| Endpoints inconnus | odds, predictions, players, injuries, lineups, events, history, xG → **non documenté en clair** |
| Rate-limit headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Tiers volume | Free **100 req/h** · Basic **1 000 req/h** · Pro **10 000 req/h** · Enterprise custom |
| Live freshness | "Refreshed every minute during active matches" (revendiqué) |
| Uptime annoncé | 99.9% (revendiqué) |
| Sécurité | API key + rate limiting (revendiqué "enterprise-grade") |

**Inconnues bloquantes** :
- Prix $ exact par tier.
- Quotas mensuels (uniquement horaires connus → 100/h × 720h = 72k/mo théorique Free).
- Marchés cotes disponibles (1X2, BTTS, totals, props).
- Profondeur stats (ratings, xG, shotmap, possession ?).
- Couverture ligues précise (J1, MLS, Ligue 2, ligues sud-américaines ?).
- TOS commercial usage (PariScore = SaaS payant €19/mois).
- Latence p50/p95.

---

## 3. Pricing analysis — comparatif concurrents (mai 2026, prix vérifiés)

| Provider | Entry tier | Volume entry | Couverture | Maturité |
|---|---|---|---|---|
| **API-Football** | $19/mo (PRO actuel PariScore) | 7 500 req/jour | 960+ leagues foot only | Mature, reviews +++ |
| **The Odds API** | $30/mo | 20k credits/mo | Odds 70+ bookmakers, multi-sports | Mature, reviews +++ |
| **Sportradar** | Enterprise only (devis) | Sur mesure | Premium tier-1 (NBA officiel, FIFA officiel) | Reference industrie |
| **Sportsdata.io** | $25–$500/mo | Par sport | NFL/NBA/MLB/NHL/PGA US-centric | Mature |
| **TheSportsDB** | $3–$5/mo Patreon | Illimité | Multi-sport, profondeur faible | Communautaire |
| **Highlightly** | Tier free + payant | Variable | Multi-sport + highlights vidéo | Récent |
| **Entitysport** | Tier free + payant | Variable | Cricket-centric | Niche |
| **sportapi.ai** | **? non publié** | 100–10 000 req/h selon tier | 50+ sports revendiqué | **Non noté en 2026** |

**Hypothèse pricing** (extrapolée du marché — **non confirmée**) :
- Free $0 / 100 req/h
- Basic ~$15–25/mo / 1 000 req/h
- Pro ~$49–99/mo / 10 000 req/h
- Enterprise $300+/mo / custom

→ Ces chiffres sont des **estimations marché**, pas des faits sportapi.ai. À vérifier par inscription Free tier.

**Analyse économique pour PariScore** :
- Volume scout PariScore actuel : 18 ligues × stats 6-12h + live polling 60s (19h-23h, ~240 req/jour). Ordre de grandeur : ~7-10k req/mois.
- **Si Free 100/h** : 100 × 24 = 2 400 req/jour théorique → suffit largement pour POC sur 1 sport.
- **Si Basic 1 000/h** : 24 000 req/jour → confortable pour tout PariScore.
- **Si tier Basic ~$15-25/mo** : **comparable à API-Football PRO $19/mo**. Pas d'avantage coût clair.
- **Si tier Basic > $25/mo** : pas rentable vs API-Football.

---

## 4. +/- pour PariScore

### Avantages potentiels

- ✅ **Multi-sport 50+** : ouvre tennis, basket, NFL pour v10 (la colonne `sport` existe déjà dans `user_bets` depuis v9.8.1).
- ✅ **Auth simple** `X-API-Key` : pattern déjà rodé dans `httpsGet()` (server.js:469, 383 pour API-Football).
- ✅ **Rate-limit headers standards** : intégration triviale dans le quota tracker `apiCacheGet/Set`.
- ✅ **Architecture PariScore prête** : routing multi-layer (server.js:7474–7557) accepte un L4 sans refactor (étapes 1–3 = BSD, Football-Data, The Odds API).

### Inconvénients / risques

- ❌ **Opacité commerciale** : pas de prix public, pas de contact corporate visible, pas de SLA contractuel.
- ❌ **One-man shop indicators** : nom auteur en sous-domaine + buildId "dev" en prod → hygiène CI/CD douteuse.
- ❌ **Absent des comparatifs marché 2026** : sportsapis.dev, apidog, slashdot, sportsdataapi.com → **aucune review tierce**.
- ❌ **Pas de retours communauté** : zéro mention sur Stack Overflow, Reddit r/SportsBook, GitHub issues publics.
- ❌ **Pas de mention odds/bookmakers** dans docs publiques → ne remplace probablement pas The Odds API.
- ❌ **Pas de mention prédictions/xG/ratings** → ne remplace probablement pas API-Football PRO.
- ❌ **Risque service abandonné** : nom .ai + Cloudflare = facile à monter, facile à shutdown.
- ❌ **Docs invisibles aux moteurs de recherche** (SPA Nuxt non SSR) → friction pour onboarding développeur + support.

---

## 5. Documentation via context7

**Résultat** : `sportapi.ai` **non indexé** dans Context7 (résolution lib renvoie AI SDK, Spring AI, Vercel AI — aucune correspondance).

Raison : Context7 indexe les **lib code open-source** (React, Next.js, Prisma...), pas les **SaaS commerciaux fermés** comme sportapi.ai.

**Alternatives pour récupérer la documentation officielle** :

1. **POC inscription Free tier** (méthode officielle) — créer compte → dashboard utilisateur expose souvent une spec OpenAPI/Swagger complète.
2. **Wayback Machine** : `https://web.archive.org/web/2026/https://sportapi.ai/docs/` → snapshot existe (mai 2026) mais contenu SPA = pas extractible.
3. **JS bundle inspection** (éthique sur ressource publique) : récupérer `_nuxt/srv/www/sevruk.sportapi.ai/...entry.async.js` + grep endpoints/strings.
4. **WHOIS contact** → email auteur → demander spec.
5. **Inspection navigateur** : ouvrir `https://sportapi.ai/docs/` dans Chrome devtools → DOM rendu = contenu réel.

→ **Recommandation simple** : si décision POC un jour, inscription Free = moyen le plus rapide et conforme TOS.

---

## 6. Verdict final

**Position recommandée** : ⏸️ **Étude classée, pas d'action immédiate**.

**Justifications** :

1. **Pas de remplacement plausible** d'API-Football PRO ni The Odds API — couverture odds/prédictions/xG non documentée publiquement, donc présumée absente ou non comparable.
2. **Possible L4 d'enrichissement multi-sport** uniquement si PariScore élargit en v10 hors-football (tennis, basket) — la colonne `user_bets.sport` v9.8.1 anticipait ce besoin, mais aucun module front/back n'exploite encore les sports non-foot.
3. **Risque opérationnel haut** : provider artisanal, absent des comparatifs marché 2026, aucune review tierce → ne jamais placer en chemin critique d'un SaaS payant.
4. **Coût caché** : sans prix publics, impossible de comparer avec les budgets actuels (API-Football $19/mo + The Odds API gratuit 500/mo).

**Conditions pour rouvrir le dossier** :
- v10 PariScore intègre vraiment un autre sport que le football (tennis/basket en priorité).
- ET aucun provider mature (API-Football, The Odds API, Sportradar) ne couvre ce sport à un prix acceptable.
- ET un POC Free tier sportapi.ai démontre couverture + latence + complétude équivalentes.

**Sinon** : statu quo BSD → Football-Data → The Odds API (cotes) + BSD → API-Football PRO (stats) + Sofascore microservice (live).

---

## 7. Annexes — Sources de l'étude

| Source | URL | Statut |
|---|---|---|
| Homepage Sevruk | https://sevruk.sportapi.ai/ | 403 via WebFetch / 200 SPA via curl (Nuxt, contenu JS-only) |
| Homepage commerciale | https://sportapi.ai/ | 200 SPA Nuxt |
| Docs (SPA) | https://sportapi.ai/docs/ | 200 SPA Nuxt — contenu inaccessible sans rendu JS |
| Pricing (SPA) | https://sportapi.ai/pricing/ | 200 SPA Nuxt — contenu inaccessible sans rendu JS |
| API endpoint | https://api.sportapi.ai/ | 502 (Cloudflare) sans Bearer/X-API-Key |
| Wayback docs | https://web.archive.org/web/2026/https://sportapi.ai/docs/ | Snapshot 2026-05-13 — SPA encore JS-only |
| Snippets Google | Recherches "sportapi.ai endpoints", "rate limit", "pricing" | Sources des éléments factuels de §2 |
| Comparatifs concurrents | sportsapis.dev/, apidog.com, slashdot.org, sportsdataapi.com | sportapi.ai **absent** de tous les comparatifs 2026 |

**Limites de l'étude** : tous les éléments §2 proviennent de snippets de moteurs de recherche, **pas de la doc officielle rendue**. Une inscription Free tier reste nécessaire pour passer du "probable" au "vérifié".
