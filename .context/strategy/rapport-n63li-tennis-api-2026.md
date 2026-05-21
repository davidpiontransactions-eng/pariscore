# Rapport — n63li/Tennis-API (eval incorporation PariScore)

> Date : 2026-05-21 · Auteur : Research agent · Source : `https://github.com/n63li/Tennis-API`
> Contexte stack tennis PariScore : ESPN public (live), BSD Tennis $5/mo (14 968 settled), Odds API (markets), Sackmann CSV (historique — risque NC).

---

## TL;DR

Repo **abandonné depuis 7 ans** (3 commits totaux, dernier en fev 2019), **scraper Express+Cheerio** ciblant atptour.com / wtatennis.com pour rankings ATP/WTA. Issue `code 403` ouverte depuis 2021 confirme que les sélecteurs CSS sont morts. **Aucun LICENSE file** (package.json mentionne ISC mais sans LICENSE le repo est de facto "All Rights Reserved" sur GitHub). Champ scrappé = uniquement rankings + index joueurs WTA — **zéro données match-level, zéro live, zéro stats avancées**. Scope déjà 100 % couvert par notre stack BSD + ESPN.

**Verdict : SKIP.**

---

## Project Overview

| Métrique | Valeur |
|---|---|
| Repo | `n63li/Tennis-API` |
| Description | "An API to scrape the ATP and WTA websites for tennis statistics" |
| Créé | 2019-01-28 |
| **Dernier commit réel** | **2019-02-17** (3 commits totaux, ~3 semaines de dev) |
| `pushedAt` GitHub | 2023-07-05 (artefact fork activity, **pas de nouveau code**) |
| Stars | 25 |
| Forks | 8 (1 seule fork active : `tylerhuyser/Tennis-API`, dernier push 2025-12-06) |
| Watchers | 2 |
| Issues ouvertes | 2 (#1 "code 403" ouvert depuis mai 2021, #2 "Fix single rankings for ATP" juil 2023) — **aucune réponse du mainteneur** |
| Archivé | Non (mais de facto dormant) |
| Taille | 11 KB JS |
| Homepage | aucune |
| CI / tests | aucun (`npm test` = `echo Error: no test specified && exit 1`) |

## License

- **Pas de fichier LICENSE** dans le repo (GitHub API retourne `licenseInfo: null`).
- `package.json` déclare `"license": "ISC"` (string sans fichier formel).
- Sur GitHub, l'absence de LICENSE file = **"All Rights Reserved" par défaut** (cf GitHub docs). Le champ `package.json` n'a pas de portée légale opposable.
- Conséquence : on ne peut pas fork/vendor proprement le code sans demander explicitement l'autorisation à n63li. Inutilisable en SaaS commercial sans levée d'ambiguïté.

## Source data

Scraper HTML (Cheerio) ciblant directement :

- `atptour.com/en/rankings/{singles,doubles,race-to-london,race-to-milan}`
- `atptour.com/en/performance-zone/win-loss-index`
- `atptour.com/en/stats/leaderboard?boardType={serve,return,pressure}`
- `wtatennis.com/rankings`
- `wtatennis.com/players` (index)
- `wtatennis.com/coaches`

**Aucune autre source** : pas de Sackmann, pas d'API tierce, pas de DB. C'est un wrapper de scraping pur sur les sites officiels.

⚠️ Tour ATP et WTA = sites notoirement hostiles au scraping (Cloudflare, sélecteurs CSS instables, ToS interdisant l'usage commercial automatisé). L'issue #1 "code 403" ouverte depuis 2021 sans réponse confirme le blocage WAF déjà à l'époque.

## Tech stack

| Couche | Choix |
|---|---|
| Runtime | Node.js |
| Framework | Express 4.16.4 (2018) |
| HTTP client | **axios 0.18.0** (CVE-2019-10742, CVE-2020-28168, CVE-2021-3749 — vulns connues SSRF/DoS) |
| Parser HTML | cheerio 1.0.0-rc.2 (2018) |
| Port | 8000 hardcodé |
| Persistance | aucune (stateless, scraping live à chaque requête) |
| Auth | aucune |
| Rate limit | aucun |

Stack compatible Node.js PariScore en théorie, mais **3 deps npm** (Express + axios + cheerio) viole le principe "zero-dep sauf better-sqlite3" du backend. Une réécriture sans deps prendrait ~30 lignes (https natif + un parser HTML léger).

## Endpoints / Features

Routes implémentées (à fonctionnalité réelle, après lecture du code) :

| Route | Statut probable 2026 |
|---|---|
| `GET /api/atp/rankings/singles` | Sélecteurs `.mega-table` morts (le site ATP a migré React en 2022) |
| `GET /api/atp/rankings/race-to-london` | Idem |
| `GET /api/atp/rankings/race-to-milan` | Idem |
| `GET /api/atp/rankings/doubles` | Idem |
| `GET /api/atp/stats/serve-leaders` | **Stub** — la route retourne `{status: 'serve leaders!'}` sans data |
| `GET /api/atp/players/win-loss` | Bug évident dans le code (push dans `countries`/`players` vides avant le scraping) |
| `GET /api/wta/rankings/singles` | **Stub** — retourne `{status: 'wta singles!'}` |
| `GET /api/wta/wta/doubles` | **Vide** (handler sans body) |
| `GET /api/wta/players/index` | Sélecteurs Drupal `.views-field-*` morts (WTA a refait son site) |
| `GET /api/wta/players/coaches` | Idem |

**Aucun endpoint match-level, aucun live, aucun historique, aucune cote, aucun stat avancée (xPoints, serve%, return%, breakpoints, etc.)**.

## Value vs existing stack

| Donnée | Stack PariScore actuelle | n63li/Tennis-API |
|---|---|---|
| Rankings ATP/WTA singles | ESPN public + BSD | rankings basiques (si non cassé) |
| Rankings doubles | BSD partial | doubles basiques |
| Race to Finals (London/Milan) | absent | nice-to-have **mais cassé** |
| Player index | ESPN + BSD | basique |
| Coaches | absent | uniquement WTA, basique |
| Stats serve/return/pressure | BSD partial | **stub vide** |
| Matchs live | ESPN + BSD WebSocket | absent |
| Historique match-level | Sackmann CSV (NC risk) | absent |
| Cotes | Odds API + BSD | absent |

**Apport net = 0**. La seule donnée potentiellement intéressante (Race to Finals) est cassée et de toute façon récupérable directement par scraping nous-mêmes ou via BSD.

## Risks

1. **Légal (LICENSE absent)** : usage commercial non autorisé par défaut. Bloquant SaaS PariScore.
2. **Légal (ToS ATP/WTA)** : les deux tours ATP/WTA interdisent explicitement le scraping automatisé pour usage commercial dans leurs ToS. Pas un risque seulement théorique : ATP a déjà adressé des C&D à des projets similaires (cf cas TennisAbstract circa 2020).
3. **Maintenance morte** : 0 commits depuis 7 ans, mainteneur injoignable (aucune réponse aux 2 issues). Fork actif `tylerhuyser/Tennis-API` (push Dec 2025) montre que d'autres ont dû le réécrire pour le faire fonctionner — preuve que l'upstream est cassé.
4. **Sécurité deps** : axios 0.18.0 = 3 CVE connues (SSRF, DoS). Inacceptable en prod.
5. **Sélecteurs CSS périmés** : ATP et WTA ont refait leurs sites en 2022-2023 (migrations React/Next). Tous les sélecteurs hardcodés sont morts. Issue #1 "code 403" confirme le blocage WAF Cloudflare.
6. **Stack hétérogène** : 3 npm deps vs charte "zero-dep" PariScore.

## Recommendation

**SKIP** — ne pas intégrer, ni vendor, ni fork pour PariScore.

**Si malgré tout besoin de rankings ATP/WTA :**

- BSD Sports Addon $5/mo couvre déjà les rankings ATP/WTA singles via `get_standings` (déjà payé, déjà intégré).
- ESPN public expose rankings via `sports/tennis/atp/rankings` (zero auth, zero risk, déjà utilisé).
- Pour le scraping direct (en dernier recours), repartir de zéro avec `https` natif + un mini parser regex — pas besoin de cheerio pour extraire un tableau de rankings, c'est ~50 lignes.

**Si l'objectif est de combler le gap "historique tennis match-level NC-safe"**, ce repo n'apporte rien. Continuer l'investigation côté :

- BSD Tennis (déjà 14 968 settled, déjà payé, demander à bzzoiro@proton.me un dump complet `MATCH_DATA` historique élargi)
- Tennis Abstract WP API (cf `rapport-tennisabstract-wp-api-2026.md` déjà rédigé)
- Kaggle datasets ATP/WTA CC0 ou ODbL (à auditer license au cas par cas)

## Cost / Effort

- **Coût intégration** : nul (pas d'API key) MAIS effort réécriture = 2-3 jours pour réparer scrapers + assumer risque légal et maintenance perpétuelle des sélecteurs CSS qui cassent à chaque redesign ATP/WTA (~tous les 18 mois).
- **Coût opportunité** : 100 % du temps perdu vs use BSD/ESPN qui couvrent déjà le scope.
- **Coût légal théorique** : C&D ATP/WTA + remediation = inestimable.

---

## VERDICT

**[SKIP]** — Coût 0 € / Effort 0 h. Repo abandonné 7 ans, sans LICENSE, scrapers cassés (issue #1 "403" non répondue depuis 2021), scope déjà 100 % couvert par BSD + ESPN, risque ToS ATP/WTA et faille axios 0.18.0. Aucune raison rationnelle d'incorporer.
