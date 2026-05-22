---
type: concept
slug: ai-scout
title: AI Scout (Combiné du Jour Gemini)
status: active
tags: [concept, ai, gemini, combine, value-bet, premium]
updated: 2026-05-22
sources: ["server.js", "pariscore.html (#ai-scout-panel)", "CLAUDE.md"]
xref: [[gemini]], [[power-score]], [[edge-no-vig]], [[poisson-bivarie]], [[value-bet]]
---

# AI Scout (Combiné du Jour)

**TL;DR:** Route `/api/v1/ai-scout` synthétise top 5 value-bets PariScore via Gemini en 3 picks structurés (Combiné / Grosse Confiance / Outsider). Affiché tête onglet Matchs `#ai-scout-panel`. Cache 6h pour amortir coût Gemini.

## 3 picks structurés

1. **🎯 Le Combiné du Jour** — 2-3 paris combinés avec cote estimée (cumul EV positif)
2. **💎 La Grosse Confiance** — pari le plus sûr (edge élevé + Poisson convergent + Power Score >75)
3. **🎲 L'Outsider à tenter** — pari risqué mais edge intéressant (prob 30-50% mais cote très favorable)

## Pipeline

```
1. Sélection top 5 matchs par best_edge.edge DESC depuis db.matches
2. Build prompt Gemini avec context cumulé:
   - Match cards (teams + cote + edge + prob Poisson)
   - Power Score si dispo
   - Forme + xG home/away
3. Gemini 1.5 Flash génère 3 picks markdown structuré
4. Cache 6h apiCacheGet('ai_scout_TTL_<date>')
5. Render frontend panel
```

## Cache TTL

`AI_SCOUT_TTL = 6 * 3600 * 1000` (6h). Invalidé:
- Automatique expiration
- Manuel refresh button user
- Force refresh quand new fixtures cron Stats

## Coût

- Gemini 1.5 Flash: ~$0.0002 per call (prompt ~3k tokens + output ~500)
- 4 generations/jour avec cache = ~$0.001/jour soutenu
- 30j × $0.001 = ~$0.03/mois total AI Scout

## Wire UI

- `pariscore.html` `#ai-scout-panel` — tête onglet Matchs, premier chargement
- Format: 3 cards verticales avec icons + cotes + edge + reasoning IA
- CTA "Voir détail" par pick → ouvre [[modal-insights]] match concerné

## Code locations

- `server.js` route `/api/v1/ai-scout` GET
- `server.js` cache `aiScoutCache` Map + TTL check
- `server.js` proxy `/api/v1/gemini` POST (clé jamais exposée client)
- `pariscore.html` render `#ai-scout-panel` content

## Gates

`/api/v1/ai-scout` dans FOOT_PRO set → requiert plan Pro Foot / Duo (server.js:14513). 403 sinon.

## Limites

- 3 picks fixed (pas dynamique selon nombre matchs jour)
- Pas backtesting accuracy AI picks (TODO innovation)
- Dépend prompt stability Gemini (drift output template)
- Combiné suggère paris corrélés (TODO: vérifier independence)

## Innovation backlog

- **Backtest accuracy AI picks** vs random baseline + EV pur
- **Multi-bet correlation check** avant suggérer combiné (independence test)
- **User personalization** — adapter risk profile (conservative vs aggressive)
- **Multi-sport** — extend tennis + autres

## Related

- [[gemini]] — Provider AI (à créer wave 3)
- [[power-score]] — Input top 5 sélection
- [[edge-no-vig]] — Input opportunity ranking
- [[poisson-bivarie]] — Input convergence check pour Grosse Confiance
- [[value-bet]] — Définit seuil (à créer wave 3)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
