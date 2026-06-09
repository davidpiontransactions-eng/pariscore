# Research — Pinnacle API évolution 2026 (bd `bjv` Option C)

> **Date** : 2026-05-22
> **Auteur** : Agent research (read-only)
> **Contexte** : Spike `.context/spike_odds_alternatives.md` §2.5 (2025) avait coté Pinnacle direct 25/100 ❌. Re-vérification 12 mois plus tard.
> **Scope** : web research only — zéro modif code.

---

## 1. Résumé exécutif

**Verdict : NO-GO direct Pinnacle API + GO conditionnel via aggregator dédié `pinnodds.com` ($99/mo) si besoin sharp confirmé.**

- L'API officielle Pinnacle est **fermée au grand public depuis le 23 juillet 2025** (pire qu'en spike 2025, où elle restait techniquement accessible). Accès B2B existe via `b2b@pinnaclesolution.com` mais tarif rapporté ~**€5 000/mo** + licence sportsbook régulée requise → hors scope PariScore.
- 3 voies abordables d'accès indirect persistent en 2026 : **pinnodds.com** (WebSocket Pinnacle dédié, $99/mo), **OddsPapi.io** (free tier 250 req inclut Pinnacle), **SportsGameOdds Rookie** ($99/mo REST). The Odds API ne contient **PAS** Pinnacle → fallback initialement envisagé invalide pour sharp data.
- **Recommandation** : rester sur le course actuel (Odds API + spike RapidAPI `odds-api1` en cours sur bd `bjv`) tant qu'aucun besoin sharp explicite n'est validé par le DG. Si pivot sharp activé → tester d'abord OddsPapi free tier (zéro coût), puis pinnodds.com $99/mo.

---

## 2. Pinnacle API officielle 2026 — statut

| Critère | Valeur 2026 |
|---|---|
| **Statut public** | ❌ Fermée depuis **23 juillet 2025** |
| **Citation officielle** | « Access to Pinnacle API suite has been closed for the general public since July 23rd, 2025. » |
| **Documentation GitHub** | `github.com/pinnacleapi/pinnacleapi-documentation` toujours en ligne (référence historique) |
| **Procédure d'accès** | Email use-case à `api@pinnacle.com` — réponse case-by-case |
| **Profils acceptés** | High-value bettors, partenariats commerciaux, projets académiques/handicapping |
| **Pricing rapporté** | **€5 000/mo** (mentionné dans discussions communautaires) — non confirmé officiellement |
| **Sport coverage** | Multi-sport (foot, tennis, basket, hockey, NFL, MMA, baseball, handball, volley, cricket, eSports) — pas foot only contrairement à spike 2025 |
| **Auth** | HTTP Basic + HTTPS |
| **Endpoints** | RESTful : `/sports`, `/fixtures`, `/odds`, `/special`, `/bets`, etc. + delta/snapshot |

**Verdict** : porte fermée pour PariScore (volume insuffisant, pas de licence sportsbook régulée, tarif prohibitif).

---

## 3. Pinnacle Solution B2B — accessibilité PariScore

| Critère | Valeur |
|---|---|
| **Contact** | `b2b@pinnaclesolution.com` |
| **Marque** | Pinnacle Solution (LinkedIn : linkedin.com/company/pinnaclesolution) |
| **Offre** | Sportsbook white label (iFrame + Turnkey), API data feed, risk management, eSports |
| **Spécialité** | US Sports, Tennis, Soccer, eSports — odds update 1-5s |
| **Pré-requis** | Licence sportsbook régulée dans ≥1 juridiction, projection volume, type plateforme |
| **Sandbox** | Credentials (client ID + API keys) après approbation BD team |
| **Accessibilité PariScore** | ❌ Bloquée : PariScore est plateforme d'analyse/value-bet, pas un sportsbook régulé. Pas de licence active = pas d'éligibilité. Tarif probable ≥ €5k/mo enterprise. |

---

## 4. Aggregators alternatifs avec Pinnacle inclus

| Provider | Pricing entry | Pinnacle inclus ? | WebSocket | Update freq | Verdict PariScore |
|---|---|---|---|---|---|
| **pinnodds.com** | **$99/mo** Pro (WS) | ✅ DÉDIÉ Pinnacle | ✅ raw WS + SSE + REST | ~100-500ms | 🟢 **Best fit prix/sharp** si pivot |
| **OddsPapi.io** | **Free** (250 req) puis $49/mo | ✅ free tier inclut Pinnacle + Singbet | ❌ REST only | 10s | 🟢 **Best free** pour POC sharp |
| **SportsGameOdds** | $99/mo Rookie | ✅ 80+ books inc. Pinnacle | ❌ REST (WS = All-Star enterprise custom) | ~10s | 🟡 OK mais sans WS |
| **RapidAPI Pinnacle Odds (tipsters)** | non publié dans search | ✅ DÉDIÉ Pinnacle | ❌ REST only | delta + snapshot | 🟡 Voir pricing tier direct sur hub |
| **OpticOdds** | non publié (devis) | ✅ enterprise 200+ books | ✅ enterprise | RT | 🔴 Enterprise = $$$ probable |
| **SportsFirst** | $299/mo+ | ✅ | ❓ | ❓ | 🔴 Trop cher entry |
| **The Odds API** | $30/mo Starter | ❌ **PAS Pinnacle** | ❌ | 10s+ | 🔴 **DEAD END pour sharp** — invalide hypothèse fallback initiale |

**Découverte critique** : The Odds API (notre fallback assumé dans le brief) ne couvre PAS Pinnacle, même sur plans payants. Cité par OddsPapi blog : « The Odds API restricts the free tier to ~40 soft books with no sharp data ». → Si PariScore veut Pinnacle, The Odds API n'est PAS une solution, peu importe le tier.

---

## 5. Community libs reverse-engineered — statut 2026

| Lib | URL | Dernière activité | Statut |
|---|---|---|---|
| `rozzac90/pinnacle` (Python wrapper) | github.com/rozzac90/pinnacle | PyPI v0.0.8 → **Sep 2018**, issues 2022 | ❌ **Abandonné** |
| `Austerius/Pinnacle-Scraper` (Scrapy/Selenium eSports) | github.com/Austerius/Pinnacle-Scraper | Scrapy 1.5 / Python 3.6 | ❌ Obsolète (stack legacy) |
| `w1r2p1/hello-world-pinnacle-bet-api` | github | Démo, pas de maintenance | ❌ Non maintenu |
| `pinnacle-dev/rcs-py` | github | Active **mais homonyme** : SDK pour Pinnacle.sh (RCS messaging), pas le sportsbook | ❌ Hors sujet |

**Conclusion** : aucun wrapper communautaire Python/JS sportsbook Pinnacle maintenu en 2026. Tous les forks GitHub précédents sont morts post-fermeture juillet 2025. Le risque reverse-eng (scraping direct pinnacle.com) est cumulé avec une charge de maintenance permanente sur stack obsolète.

---

## 6. ToS & risque actualisé

- **ToS Pinnacle 2026** : interdit explicitement l'accès automatisé / scraping non autorisé (cohérent depuis 2024).
- **Cloudflare protection** : pinnacle.com est derrière Cloudflare. Depuis juillet 2025, Cloudflare bloque par défaut le scraping AI (TLS fingerprinting + bot reputation + behavioral signals) — ban IP rapide, cease-and-desist possibles.
- **Cas observés** : pas de cease-and-desist public récent contre dev solo, mais blocage Cloudflare systématique reporté sur forums (arbusers.com thread t6406, t6554).
- **Risque légal pour PariScore** : violation ToS = perte d'accès + risque réputationnel auprès d'autres providers (BSD, Odds API peuvent fermer les comptes si lien établi). **Verdict** : ne PAS scraper pinnacle.com directement.

---

## 7. Recommandation finale

**Maintenir le course actuel — Option C NO-GO en POC, GO conditionnel pinnodds.com si besoin sharp validé DG.**

**Rationale 5 lignes** :
1. L'évolution 2025→2026 a **dégradé** l'option directe (API publique fermée juillet 2025) — pas d'amélioration commerciale accessible à PariScore (B2B Pinnacle Solution exige licence sportsbook + €5k/mo).
2. Le fallback Odds API Starter $30/mo mentionné dans le brief est **invalide** pour sharp : The Odds API ne distribue PAS Pinnacle. Cette correction doit être remontée au DG.
3. Si PariScore décide de pivoter vers données sharp Pinnacle, le chemin pragmatique 2026 est : **(a)** tester OddsPapi.io free tier 250 req (zéro coût, valide la valeur métier) ; **(b)** si validé, upgrade pinnodds.com $99/mo Pro pour WebSocket sub-seconde (drop-in compatible client Pinnacle API) ; **(c)** SportsGameOdds Rookie $99/mo en backup si pinnodds.com indisponible.
4. Reverse-eng community libs **mort** en 2026 (rozzac90 dead depuis 2018, scrapers obsolètes, Cloudflare blocage par défaut) → ne pas investir dev maison.
5. Le spike RapidAPI `odds-api1` en cours sur bd `bjv` reste la voie active la plus rationnelle ; ajouter à l'eval une comparaison directe coverage Pinnacle (oui/non) et fréquence update pour cadrer la valeur ajoutée potentielle avant tout pivot.

**Action proposée bd `bjv`** : garder in_progress, noter Option C closed (NO-GO direct + GO conditionnel pinnodds.com), poursuivre eval `odds-api1` avec critère explicite « Pinnacle coverage ».

---

## Sources

- [GitHub - pinnacleapi/pinnacleapi-documentation](https://github.com/pinnacleapi/pinnacleapi-documentation)
- [RapidAPI - Pinnacle Odds (tipsters)](https://rapidapi.com/tipsters/api/pinnacle-odds)
- [RapidAPI - Pinnacle Odds Pricing](https://rapidapi.com/tipsters/api/pinnacle-odds/pricing)
- [pinnodds.com — WebSocket Pinnacle feed](https://pinnodds.com/)
- [OddsPapi — Pricing comparison 2026](https://oddspapi.io/blog/odds-api-pricing-2026-comparison/)
- [OddsPapi — Free 350+ bookmakers](https://oddspapi.io/blog/free-odds-api-350-bookmakers/)
- [SportsGameOdds — Pricing](https://sportsgameodds.com/pricing)
- [SportsGameOdds — Pinnacle Odds API](https://sportsgameodds.com/bookmakers/pinnacle-odds-api)
- [OpticOdds — Pinnacle API](https://opticodds.com/sportsbooks/pinnacle-api)
- [The Odds API — Bookmaker list](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html)
- [SportsFirst — Pinnacle Sports API](https://www.sportsfirst.net/sportsapi/pinnaclesportsapi)
- [Pinnacle Solution LinkedIn](https://www.linkedin.com/company/pinnaclesolution)
- [Arbusers — Pinnacle API thread](https://arbusers.com/pinnacle-api-t6554/)
- [GitHub - rozzac90/pinnacle](https://github.com/rozzac90/pinnacle)
- [GitHub - Austerius/Pinnacle-Scraper](https://github.com/Austerius/Pinnacle-Scraper)
- [Scrapfly — Bypass Cloudflare 2026](https://scrapfly.io/blog/posts/how-to-bypass-cloudflare-anti-scraping)
- [Bubblemarble — Pinnacle integration guide](https://bubblemarble.pro/blog/pinnacle-sports-betting-api-integration-guide)
- [SharpAPI — Best Sports Betting APIs 2026](https://sharpapi.io/compare/best-sports-betting-apis)
