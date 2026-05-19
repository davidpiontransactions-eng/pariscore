# Recherche — Fallbacks 3 orphelins durs après retrait API-Football

*2026-05-19 · PariScore zéro-dep · Sofascore exclu · BSD primaire conservé*

> **DÉCISION DG 2026-05-19 — Rumeurs : SUNSET (option B).** apidojo = impasse
> (abo client = API immobilier générique, pas TransferMarket ; abo TransferMarket
> refusé). Aucune source rumeurs libre fiable zéro-dep. Le champ « transferts »
> est couvert à 100 % par les **transferts CONFIRMÉS + valeurs** via felipeall
> self-host (v10.73, déployé). Les **rumeurs** (nice-to-have, donnée la moins
> fiable) sont abandonnées proprement — UI masquée, aucune dette scrape.
> Issue `dj1` fermée « no viable free source ». Réactivable si budget RapidAPI
> apidojo TransferMarket (abo BASIC) un jour souscrit.

## Synthèse

- **Prédictions** : ✅ **résolu sans nouvelle source** — endpoint **BSD `/api/v2/predictions/` GRATUIT** : match_result (prob H/N/A), over_under 1.5/2.5/3.5, BTTS, expected_goals, score probable, recommendations, model.confidence (CatBoost v5, ré-entraîné/sem). Reco : source primaire + Poisson/Elo interne en cross-check. Zéro coût, zéro nouvelle dép.
- **Stats avancées équipe** : ⚠️ pas de source 100% gratuite zéro-dep. Compromis : **standings BSD (forme/xGf/xGa/buts)** + **Understat scrape JSON embarqué** (xG/tirs/formation, **6 grandes ligues only**) + calcul interne (clean sheets, série, moy dom/ext). **Cartons J/R + penalties = AUCUN fallback gratuit fiable** → "N/A" UI ou add-on football-data.org Statistics +15 €/mo. FBref & FotMob = **cassés en Node natif** (Cloudflare Selenium / header `x-fm-req` signé).
- **Rumeurs transferts** : ⚠️ pas de gratuit fiable. Meilleur = **RapidAPI apidojo `transfermarket`** endpoint rumeurs, free tier (~500 req/mois à confirmer page JS), cache 12h, zéro-dep (https+clé). Scraping direct geruechte = Cloudflare+JS = non fiable Node natif. Plan B : Apify ~15 $/mo.

## Tableau décision

| Champ | Reco | Coût | Zéro-dep | Effort |
|---|---|---|---|---|
| Prédictions | **BSD /api/v2/predictions/** + Poisson/Elo interne fallback | 0 € | Oui | Faible |
| Stats équipe | BSD standings + Understat scrape (6 ligues) + calc interne ; cartons/penalties N/A (ou football-data.org +15 €) | 0 € (ou +15 €) | Oui | Moyen |
| Rumeurs | RapidAPI apidojo transfermarket free tier + cache 12h | 0 € (à confirmer) | Oui | Faible |

## Shape BSD predictions (à valider sur appel réel)
`markets.match_result.{prob_home,prob_draw,prob_away,predicted}` · `markets.over_under.{prob_over_15,prob_over_25,prob_over_35}` · `markets.btts.prob_yes` · `markets.expected_goals.{home,away}` · `markets.score.most_likely` · `recommendations` · `model.confidence`. Probas 0–100.

## Incertitudes
1. Quota/prix exact RapidAPI apidojo (page JS) — vérif manuelle pricing.
2. Noms exacts champs BSD /predictions — confirmer sur 1 appel réel authentifié.
3. Stabilité JSON Understat — parseur défensif + fallback "BSD seul".

## Sources
football-data.org pricing/coverage · soccerdata releases + issue #742 (FotMob x-fm-req) · understat.com / understatapi / worldfootballR · BSD docs v2 (sports.bzzoiro.com/docs/v2/) · RapidAPI apidojo transfermarket (+pricing) · felipeall/transfermarkt-api · Apify curious_coder/transfermarkt · Scrapfly Cloudflare bypass 2026.
