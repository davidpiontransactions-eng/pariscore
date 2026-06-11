# pm-product-strategy — Boîte à outils stratégique produit

Plugin de stratégie produit pour Claude Code / Cowork. Fournit 12 skills et 5 commandes couvrant toute la chaîne stratégique : vision, modèles d'affaires, pricing, analyse concurrentielle et macro-environnement.

## Skills (12)

| Skill | Description |
|-------|-------------|
| `ansoff-matrix` | Matrice d'Ansoff — stratégies de croissance (pénétration, développement, diversification) |
| `business-model` | Business Model Canvas complet (9 blocs) |
| `lean-canvas` | Lean Canvas pour startups et validation d'hypothèses |
| `monetization-strategy` | Brainstorming de 3-5 stratégies de monétisation avec tests de validation |
| `pestle-analysis` | Analyse PESTLE (Politique, Économique, Social, Technologique, Légal, Environnemental) |
| `porters-five-forces` | Analyse des 5 forces de Porter (rivalité, fournisseurs, clients, substituts, entrants) |
| `pricing-strategy` | Design de stratégie pricing (modèles, concurrence, consentement à payer, expériences) |
| `product-strategy` | Product Strategy Canvas en 9 sections (vision → défendabilité) |
| `product-vision` | Création d'une vision produit inspirante et réalisable |
| `startup-canvas` | Startup Canvas — stratégie (9 sections) + business model combinés |
| `swot-analysis` | Analyse SWOT (Forces, Faiblesses, Opportunités, Menaces) |
| `value-proposition` | Proposition de valeur en 6 parties (Qui, Pourquoi, Avant, Comment, Après, Alternatives) |

## Commandes (5)

| Commande | Description |
|----------|-------------|
| `/strategy` | Crée un Product Strategy Canvas complet (9 sections) |
| `/business-model` | Explore les modèles d'affaires (lean, full, startup, value-prop) |
| `/value-proposition` | Design une proposition de valeur au format JTBD |
| `/market-scan` | Analyse macro-environnement — SWOT + PESTLE + Porter + Ansoff combinés |
| `/pricing` | Design d'une stratégie pricing avec analyse concurrentielle et tests |

## Installation

Les skills se chargent automatiquement quand le sujet est pertinent. Les commandes s'invoquent avec `/nom-commande`.

## Source

Ce plugin est extrait du marketplace [pm-skills](https://github.com/phuryn/pm-skills) par Paweł Huryn.
