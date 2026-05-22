---
type: entity
slug: wikidata
title: Wikidata (CC0 historical data)
status: active
tags: [vendor, dataset, public, free, cc0, historical, tennis-winners]
updated: 2026-05-22
sources: ["server.js", "CLAUDE.md", "https://www.wikidata.org", ".context/audits/audit-data-missing.md"]
xref: [[openfootball]], [[tennis-mylife]], [[sackmann-purge]]
bd: [6du6]
---

# Wikidata (CC0 historical data)

**TL;DR:** Source data historique gratuit licence **CC0 (public domain)** — commercial OK. Use case PariScore = tennis winners historiques 56 entries wire Phase 2 livré v12.63 (bd `6du6`). Substitute légal pour data Sackmann CC BY-NC-SA en cours purge.

## Licence CC0

**Creative Commons Zero** = public domain dedication mondiale. Use commercial OK. Pas d'attribution requise (best practice quand même). Distinguer:
- ✅ Wikidata = CC0 (commercial OK)
- ❌ Wikipedia text = CC BY-SA (attribution + ShareAlike)
- ❌ Sackmann tennis_atp = CC BY-NC-SA (NonCommercial, INCOMPATIBLE PariScore)

## Use case PariScore: tennis winners

**Phase 1+2 livrées (bd `6du6`):**
- ETL SPARQL query Wikidata `/w/api.php?action=sparql` pour winners Grand Slam + Masters
- 56 entries wire dans `db.tennis_winners` Phase 2 v12.63
- Sources: ATP/WTA + Roland Garros + Wimbledon + US Open + Australian Open + Masters series

Validation post-deploy attendue (CLAUDE.md):
```
pm2 logs pariscore --lines 200 --nostream | grep -i "wikidata\|TennisLive\|safeFixed"
```

Cherche `ETL seed merge (wikidata CC0): 56/56` confirm successful wire.

## SPARQL query exemple

```sparql
SELECT ?event ?eventLabel ?year ?winner ?winnerLabel WHERE {
  ?event wdt:P31/wdt:P279* wd:Q859853 .  # tennis tournament
  ?event wdt:P585 ?date .
  BIND(YEAR(?date) AS ?year)
  ?event wdt:P1346 ?winner .             # winner property
  FILTER(?year >= 2000)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
LIMIT 1000
```

Endpoint: `https://query.wikidata.org/sparql?format=json&query=...`

Rate limit: 5 req/sec per IP. Use modéré OK.

## Coverage

- Tennis: ~5000+ tournois historiques tagged (variable fiabilité tournois mineurs)
- Foot: clubs + joueurs metadata massif mais structure inconsistent (besoin parsing complex)
- Autres sports: variable

## Use cases futurs

- **Référentiel managers/coachs** (DOB, nationality, career)
- **Stade venues coords** + capacity (overlap [[bsd-bzzoiro]] venues, fallback gratuit)
- **Joueurs tennis Grand Slam historique** détail (Year-end #1, GOAT debate data)

## Bd ticket

- `6du6` P0 in_progress — DB historique tennis+foot datasets gratuits (openfootball ODbL + Wikidata CC0) — Phase 2 wikidata wire livré, deploy VPS attendu

## Risques

- **API stability** — Wikidata public infra, occasional outages
- **SPARQL complexity** — queries optimization importante (timeout 60s default)
- **Data quality** — community-curated, errors possible (Phase 3 validation pending)

## Related

- [[openfootball]] — Source complementary historique foot ODbL (à créer wave 3)
- [[tennis-mylife]] — Substitution Sackmann MIT (à créer wave 3)
- [[sackmann-purge]] — ADR purge Sackmann en cours

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
