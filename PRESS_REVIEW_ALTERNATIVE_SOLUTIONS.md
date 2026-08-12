# PRESS_REVIEW_ALTERNATIVE_SOLUTIONS.md

> **Objectif** : éliminer la dépendance à l'API Gemini du module « Revue de presse »
> (Tennis & Football) et proposer des solutions **100 % gratuites (0 €)**,
> **ultra-fiables** et **pérennes** pour alimenter les résumés et prédictions de la presse.
>
> **Statut** : document d'architecture — **aucun code n'a été modifié**.
> Toute implémentation attend le « GO » explicite de l'utilisateur.
>
> **Date** : 2026-08-11 · **Portée** : `src/lib/tennis-press-review-service.ts`,
> `src/lib/football-press-review-service.ts`, routes
> `/api/v1/{tennis,football}/press-review`.

---

## 1. État des lieux (audit du code actuel)

Le module actuel est **déjà à ~60 % sans LLM**. Gemini n'intervient qu'en **dernier
recours** (`llmFallback()`), jamais dans le chemin nominal.

### Pipeline actuel (identique Tennis & Football)

```
Requête API (matchId, joueurs/équipes)
  └─> Cache mémoire (24 h) ──> Cache disque .cache/press-review/ (24 h)
       └─> 1. Google News RSS  ──> match /<item>/ ──> filtrage domaines connus
       │      (5 sources max, 1 par domaine)
       ├─> 2. Fallback Google Search HTML (si < 3 sources)
       │      └─> regex URL site:cible ──> fetch article
       ├─> 3. stripHtml() + regex déterministes (extractPrediction / extractSummary)
       ├─> 4. Consensus (computeConsensus : % joueur A/B, 1X2, Over/Under, BTTS)
       └─> 5. **[GEMINI UNIQUEMENT]** si sources < 3 : llmFallback() gemini-2.0-flash
              └─> génère 3 pseudo-sources JSON (temperature 0.4, timeout 20 s)
```

### Points de dépendance Gemini

| Fichier | Fonction | Rôle | Fréquence |
|---|---|---|---|
| `src/lib/tennis-press-review-service.ts` | `llmFallback()` (l. 224-270) | 3 prédictions JSON fictives quand le scraping < 3 sources | Rare (cache 24 h) |
| `src/lib/football-press-review-service.ts` | `llmFallback()` (l. 312-370) | idem football | Rare (cache 24 h) |

### Diagnostic

- ✅ Le chemin nominal est **déjà déterministe** (regex + consensus).
- ⚠️ Le vrai point de fragilité est la **découverte d'articles** (Google News RSS OK,
  fallback Google Search HTML fragile : CAPTCHA, consentement, structure volatile).
- ⚠️ Le fallback Gemini produit des **prédictions fictives** (risque éthique/SEO :
  « faux avis presse » présentés comme réels).
- ⚠️ Quota/erreurs Gemini = panne de la source de secours.

---

## 2. Critères d'évaluation (méthodologie)

| Critère | Définition |
|---|---|
| **Fiabilité** | % de requêtes aboutissant à ≥ MIN_SOURCES (3) sources réelles, sur 30 jours |
| **Résilience** | Comportement lors des changements de structure HTML / blocage anti-bot / CORS |
| **Latence** | Temps du premier octet au résultat JSON complet (cache chaud exclu) |
| **Coût** | 0 € confirmé ? Quotas gratuits, menace de saturage, pérennité du tier |
| **Maintenance** | Effort de supervision des sélecteurs / sources (semaines) |

**Volumes cibles** (estimation) : ~50-100 matchs/jour client → ~200-400 fetch
d'articles/jour max (atténués par le cache 24 h), soit ~10 000 requêtes/mois.
Tous les tiers gratuits cités absorbent ce volume sans problème.

---

## 3. OPTION A — Web Scraping Direct & Extracteurs DOM Déterministes

### Principe de fonctionnement

Remplacement du scraping « texte brut » par des **connecteurs par source**
(sélecteurs CSS précis + extraction JSON-LD quand disponible), exécutés avec une
librairie de parsing léger.

```
Requête API
  └─> Router par source (Forebet, FootyStats, SportyTrader, WhoScored, TennisMajors, LWOS…)
       └─> Fetch HTML (fetch natif Node, UA PariScoreBot, redirect follow)
            ├─> Cheerio (DOM sans navigateur, ~4 Mo)
            │    └─> Sélecteurs CSS par template source :
            │         • meta[name="description"]   (100 % des sites)
            │         • script[type="application/ld+json"]  (JSON-LD si dispo)
            │         • h1 + premiers <p> de l'article
            │         • blocs « Prediction » / « Verdict » / « Our prediction » (class/id)
            ├─> Extraction du pronostic : regex existantes (extractPrediction) SUR LES
            │    BLOCS CIBLÉS uniquement (meilleur ratio signal/bruit)
            └─> Consensus + templates French (inchangés)
  └─> [0 appel LLM]
```

### Focus par famille de site

| Source | Stratégie | Sélecteurs clés (exemples) |
|---|---|---|
| SportyTrader | JSON-LD + bloc « pronostic » | `script.ld+json`, `.matches-predictions` |
| Forebet | Tableaux de prédictions structurés | `#expert-predictions`, tableaux 1X2/O/U |
| FootyStats | HTML semi-structuré | `.prediction-box`, `meta.description` |
| LastWordOnSports | Articles preview avec bloc Conclusion | `.entry-content p:last-of-type` |
| TennisMajors / Tennis.com | Preview + « Who will win » | `meta[property="og:description"]` |

### Fiabilité estimée

- **65-85 %** par source en extraction ciblée (vs ~50-70 % actuellement en texte brut).
- Résilience : **moyenne** — un redéploiement CSS casse un connecteur, mais
  l'architecture multi-sources tolère la perte de 1-2 sources (MIN_SOURCES = 3 sur 5).
- Anti-bot : certains sites (WhoScored, Forebet) exigent cookies/JS → privilégier les
  sources statiques + cache. Ajout d'un **circuit-breaker par domaine** (2 échecs
  consécutifs → désactivation 24 h + alerte).

### Latence d'exécution

- Fetch HTML : 400-1 500 ms / article
- Parsing Cheerio : 10-50 ms / article
- **Total : 1-3 s pour 3-5 sources en parallèle** (Promise.all par match)

### Coût total

- **0 €** — Cheerio est MIT, gratuit, hébergé sur le VPS existant (Bun/Node natif).
- ~5 000 € d'économie annuelle si l'on évite de passer sur un tier payant Gemini.

### Avantages

- Zéro dépendance externe (pas de service tiers entre PariScore et la source).
- Contrôle total : sélecteurs maîtrisés, cache existant réutilisé tel quel.
- Chemin nominal inchangé : regex, consensus et templates restent en place.

### Inconvénients

- Maintenance manuelle des sélecteurs (à ré-auditer tous les 3-6 mois).
- Fragile face aux anti-bot côté VPS (IP partagée) ; risques de 403/429.
- Conformité TOU : nécessite de respecter robots.txt / fair-use par source
  (cf. `LICENSE-DATA.md` — pari au fair-use).

---

## 4. OPTION B — Flux RSS + Parser RSS + Templates Déterministes

### Principe de fonctionnement

Ingestion **programmée** (cron) des flux RSS des sources au lieu du scraping à la volée.
Le RSS est un format **stable depuis 15 ans** : le parsing par titre + description
ne casse presque jamais. La synthèse se fait par **templates rédigés** (pas de LLM).

```
CRON quotidien (00h30 UTC, paris pré-calculés comme pariscore-cron-gemini)
  └─> Fetch des flux RSS/Atom des sources :
       • news.google.com/rss/search?q="{J1} vs {J2} prediction&hl=fr"  (déjà utilisé)
       • flux officiels : lastwordonsports.com/feed, tennismajors.com/feed,
         sportytrader.com/rss  (à vérifier domaine par domaine)
  └─> Parser RSS (regex <item> existante → généralisée, ou rss-parser ~50 Ko)
       └─> Items enrichis : { title, link, source, pubDate, description }
            ├─> Filtre : titre contient /{nomA}|{nomB}|vs|prediction|preview/
            ├─> Fetch article (seulement pour les items prometteurs)
            └─> Template de synthèse déterministe (modèle rédigé une fois) :
                 « 3/5 médias placent X favori (65 %). SportyTrader parie sur une
                 victoire de X, Over 2.5 (68 %). Notre consensus : X 62 % / Y 38 %. »
  └─> Index par match (YYYY-MM-DD, ligue) dans .cache/press-review/ (réutilisé)
```

### Fiabilité estimée

- **85-95 %** sur la découverte d'articles (RSS est le format le plus stable du web).
- Résilience : **élevée** — un flux mort est détecté par le cron (healthcheck)
  et retiré du pool sans impact utilisateur.
- Réduit fortement les blocages anti-bot : Google News RSS ne fait pas de CAPTCHA
  (contrairement au fallback Google Search HTML actuel, à éliminer).

### Latence d'exécution

- Fetch RSS : 300-800 ms (réseau) + parsing < 10 ms
- Fetch article sélectif : +400-1 500 ms seulement pour les items retenus
- **Total : 0,5-2 s par match** (vs 2-6 s aujourd'hui avec le fallback Google Search).

### Coût total

- **0 €** — parsers open source MIT ; aucun quota externe (Google News RSS public).

### Avantages

- Le format le plus stable du web : quasi zéro maintenance de structure.
- Pré-charge possible par cron → **cache chaud à 100 %** au premier clic (0 ms ressenti).
- Supprime le fallback Google Search HTML (très fragile) → fiabilité globalement en hausse.

### Inconvénients

- Toutes les sources n'ont pas de RSS exploitable pour les *prédictions* (Forebet :
  pas de RSS par match ; WhoScored : flux news seulement) → à réserver à la
  **découverte d'articles**, pas à l'extraction de pronostics structurés.
- Titres/descriptions RSS parfois trop courts pour le niveau de détail actuel
  (expertSummary 2-3 phrases) → nécessite le fetch article optionnel (Option A).
- Ne remplace pas les sources structurées (Forebet/SportyTrader tables) seules.

---

## 5. OPTION C — Jina Reader (`r.jina.ai`) + Moteur de Synthèse Interne

### Principe de fonctionnement

Utilisation du **proxy de lecture gratuit Jina Reader** : `https://r.jina.ai/{URL}`
convertit n'importe quel article en **Markdown propre** (il gère JS, cookies,
navigation, anti-bot basique). Côté PariScore : nettoyage regex/NLP léger + isolation
du paragraphe « Prediction » / « Verdict » + synthèse interne (pas de LLM).

```
Article inaccessible en direct (403 / CAPTCHA / JS-only)
  └─> GET https://r.jina.ai/{urlArticle}
       ├─> Header X-Timeout: 10   (facteur de résilience)
       ├─> Header X-Return-Format: markdown
       └─> Réponse : Markdown propre (titres ##, liste, tableaux) en ~2-6 s
  └─> Post-traitement interne (Node.js, 0 LLM) :
       ├─> Repérer le bloc « Prediction » / « Verdict » / « Our pick »
       │    (regex multilingue + ancres de section Markdown)
       ├─> extractPrediction() / extractSummary() existants (inchangés)
       └─> Template de synthèse French (identique Option B)
```

### Fiabilité estimée

- **90 %+** de disponibilité du service Jina Reader sur les URLs des 10 sources
  (il gère la majorité des anti-bot côté client).
- Résilience : **élevée** — utilisé en **couche de secours uniquement** (fallback du
  fetch direct), donc une panne de Jina ne casse rien dans le chemin nominal.
- Quotas gratuits : ~**20 RPM anonyme**, ~**200 RPM avec clé gratuite** (Jina AI,
  à confirmer à la date d'implémentation) → largement suffisant à nos volumes
  (quelques dizaines d'articles/semaine en fallback).

### Latence d'exécution

- **2-6 s par article** (Jina rend + fetch), contre 0,5-1,5 s en fetch direct.
- → **En fallback uniquement** : pénalité acceptable (cas rare), avec timeout 10 s
  et circuit-breaker.

### Coût total

- **0 €** — tier gratuit Jina Reader (clé API optionnelle gratuite), volume 100×
  sous le quota. Aucun paiement possible requis.

### Avantages

- **Arme anti-blocage** : résout les 403/CAPTCHA/JS-only des sources les plus dures
  (WhoScored, Forebet) sans acheter de proxies.
- Aucun LLM : la synthèse est 100 % interne (regex + templates).
- Incrémental : s'intègre dans l'existant en *une seule branche de fallback*.

### Inconvénients

- Dépendance à un service tiers gratuit (TOU de Jina, quotas évolutifs).
- Latence 3-4× supérieure au fetch direct → jamais sur le chemin nominal.
- Rédaction de contenu : pas d'analyse, uniquement du texte brut structuré
  (les connecteurs DOM de l'Option A restent supérieurs quand ils fonctionnent).

---

## 6. OPTION D — API LLM Alternative Free Tier (Groq / Hugging Face Inference)

> ⚠️ **Option réserve** : elle remplace Gemini par un autre LLM. Elle ne satisfait
> la contrainte « 0 € » QUE tant que le free tier existe. Elle est listée pour
> complétude et pour le cas où un traitement de texte resterait indispensable
> (ex. traduction d'expertSummary en français).

### Principe de fonctionnement

```
Si < MIN_SOURCES sources réelles (même cascade que llmFallback actuelle) :
  └─> Groq API (groq.com) : llama-3.3-70b / mixtral-8x7b
       • Endpoint OpenAI-compatible : POST /v1/chat/completions
       • Tier gratuit : ~14 400 requêtes/jour (10 RPM par modèle — chiffres évolutifs)
       • Latence très basse (~300-1 500 ms), adaptée à l'usage synchrone
  └─> Alternatif : Hugging Face Serverless Inference (POST https://api-inference.huggingface.co/models/{model})
       • Model Ouput : llama-3.2-3b / qwen2.5-7b / mistral-7b
       • Tier gratuit : clé HF gratuite, rate-limit variable (~20-60 RPM, queue par cold-start)
       • Latence : 1-10 s (cold start possible) → timeout 20 s obligatoire
  └─> Même prompt JSON que llmFallback (temperature 0.4, maxTokens 1000)
       └─> Même parsing / validation (JSON.parse + whitelist types)
```

### Fiabilité estimée

- **95 %+** de disponibilité des plateformes (Groq très stable), mais **quotas
  gratuits variables** : risque de 429 en pic, taux évolutif au fil des annonces
  des fournisseurs → **la moins « pérenne »** des quatre options.
- Malgré tout, toujours plus fiable que le fallback Google Search HTML actuel.

### Latence d'exécution

- Groq : **300-1 500 ms** · HF Serverless : **1-10 s** (cold start).
- Ajout 0,5-2 s au temps de réponse global, uniquement dans le cas < 3 sources.

### Coût total

- **0 €** (tiers gratuits actuels). Risque de dérive future : free tiers LLM
  révisés régulièrement (c'est précisément la fragilité vécue avec Gemini).

### Avantages

- Migration la plus rapide (même shape que llmFallback actuel).
- Groq : qualité de texte quasi-LLM pour les expertSummary, inférieure de 2-3×
  seulement aux gros modèles, latence excellente.

### Inconvénients

- **Reste une dépendance API tierce** : le problème « quotas/erreurs » se déplace
  de Gemini vers Groq/HF, il ne disparaît pas.
- Les prédictions générées restent **fictives** (problème d'authenticité inchangé).
- HF Serverless : cold starts lents et queue en pic ; nécessite un key management.

---

## 7. Tableau comparatif récapitulatif

| Critère | A. Scraping DOM (Cheerio) | B. RSS + Templates | C. Jina Reader + Synthèse | D. Groq / HF Free |
|---|---|---|---|---|
| **Principe** | Sélecteurs CSS + JSON-LD par source | Flux RSS + templates rédigés | Proxy Markdown + regex interne | LLM free tier |
| **Fiabilité estimée** | 65-85 % | **85-95 %** | **90 %+** (en fallback) | 95 % (quotas variables) |
| **Résilience structure** | Moyenne (CSS cassable) | **Très élevée** (RSS stable) | Élevée (couche secours) | Basse (tier évolutif) |
| **Latence (par match)** | 1-3 s | **0,5-2 s** (cache chaud 0 ms) | 2-6 s (fallback seul) | 0,3-2 s |
| **Coût** | **0 €** | **0 €** | **0 €** | 0 € (non pérenne) |
| **Dépendance tierce** | Aucune | Google News RSS (public) | Jina (free tier) | **API LLM** |
| **Prédictions fictives ?** | Non | Non | Non | **Oui** |
| **Maintenance** | Sélecteurs / 3-6 mois | Très faible | Faible | Nulle (mais quotas à surveiller) |
| **Remplace llmFallback ?** | Oui | Oui | Oui | Remplace Gemini par un autre LLM |
| **Conformité / TOU** | À surveiller par source | RSS = usage prévu | Proxy tiers (TOU Jina) | N/A (données synthétiques) |

---

## 8. RECOMMANDATION — Combinaison gagnante

> **Layered pipeline « Zero-LLM »** : A (nominal) → C (secours anti-blocage) → B (pré-cron)
> avec **suppression totale de llmFallback** (Gemini et toute LLM).

```
[CRON 00h30]  B. RSS Google News → pré-remplissage du cache (matches du jour)
                                        │
Requête API  →  Cache 24 h (chaud) ─────┤
                 │
                 ▼
        [0] Routing par source ─────────┐
                 │                      │
        [1] A. Fetch direct + Cheerio (sélecteurs CSS + JSON-LD)
                 │ échec 403 / CAPTCHA / JS-only
                 ▼
        [2] C. Jina Reader → Markdown propre
                 │
                 ▼
        [3] Moteur interne : extractPrediction/extractSummary (regex existantes)
                 │                                        │
                 ▼                                        ▼
        [4] Consensus + Template French          [5] Cache disque 24 h
                 │
                 ▼
        JSON /api/v1/{tennis,football}/press-review (même shape qu'aujourd'hui)
```

### Justification

1. **Supprimer `llmFallback()`** des deux services (Tennis l. 224, Football l. 312) :
   les prédictions fictives sont le seul vrai problème éthique ET technique.
   À la place : **template de « synthèse média » déterministe** construit à partir
   du consensus réel (réutilise `computeConsensus` + formules de confidence).
2. **A en nominal** : connecteurs Cheerio par source (~5 tennis + ~5 football),
   ciblant `meta[description]`, JSON-LD et blocs « Prediction ». Refactoriser
   `discoverArticles()` en un `SourceConnector[]` (interface commune).
3. **C en secours** : si fetch direct échoue (403/CAPTCHA) → `r.jina.ai/{url}`.
   Circuit-breaker par domaine + timeout 10 s.
4. **B en pré-cron** : garder Google News RSS (déjà en place), le passer en cron
   quotidien (patron `pariscore-cron-gemini` existant) pour un cache chaud à 100 %.
5. **D non retenue** pour la génération : remplacer un LLM par un autre ne règle ni
   les quotas ni l'authenticité. Option gardée en réserve pour **traduction seule**
   (expertSummary EN→FR) si nécessaire un jour, via Groq free tier.

### Impact prévisionnel

| Métrique | Aujourd'hui | Cible |
|---|---|---|
| Taux de succès (≥ 3 sources réelles) | ~50-70 % | **85-95 %** |
| Latence médiane (cache froid) | 2-6 s | **1-3 s** |
| Dépendance API externe | Gemini (payant possible) | **0 API payante** |
| Authenticité des sources | 3/3 réelles en nominal, fictives en fallback | **100 % réelles** |
| Coût mensuel | 0 € (quota) → risque de facture | **0 € garanti, pérenne** |

### Étapes d'implémentation proposées (à valider avant tout code)

1. `@refactor` services : isoler `llmFallback` (suppression) + extraire les regex
   existantes dans `src/lib/press-extractors.ts` (module partagé tennis/football).
2. `src/lib/press-connectors/` : 10 connecteurs (5 tennis, 5 football) — interface
   `SourceConnector { name, domain, fetchPrediction(match) }`.
3. Fallback Jina : `src/lib/press-jina-fallback.ts` (+ header `X-Time`, timeout,
   circuit-breaker par domaine).
4. Cron pré-charge : `scripts/cron-press-review.sh` calqué sur `scripts/cron-gemini.sh`
   + entrée `pariscore-cron-press-review` dans `ecosystem.config.js`.
5. Template de synthèse French : module `press-synthesis-templates.ts` (aucun LLM).
6. Tests : `qa-node` + jeu de fixtures HTML par source (anti-régression sur
   changement de structure) — voir `tests/` existants.
7. Doc : mise à jour CHANGELOG + `COMPONENTS.md` (panel inchangé côté UI).

---

## 9. Risques & garde-fous transverses

| Risque | Garde-fou |
|---|---|
| Changement de structure d'une source | Circuit-breaker par domaine + fixtures de test par source |
| 403 massifs (IP VPS) | Basculer la source vers Jina Reader en secours ; rotation UA |
| Évolution des quotas Jina | Clé API gratuite (200 RPM) + monitoring du quota restant |
| TOU des sites scrapés | Respect robots.txt par domaine, fetch à basse fréquence (cron),
  citation de la source dans le JSON (champ `url` déjà présent) |
| Latence en pic | Cache 24 h existant + pré-charge cron (cache chaud) |
| Perte d'une source entière | MIN_SOURCES = 3 sur 5 : la dégradation reste présentable |

---

*Document d'architecture — généré le 2026-08-11. Aucune modification de code
n'a été effectuée. En attente de validation de la solution avant implémentation.*