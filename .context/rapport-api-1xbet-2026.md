# Rapport — Étude intégration API 1xBet sur PariScore

> Étude faisabilité · +/− · valeur produit · recommandation
> Date : 2026-05-15 · Statut : **ANALYSE — aucun code modifié**
> Contexte : l'utilisateur parie **principalement sur 1xBet** ; PariScore est positionné marché **FR/ANJ**.

---

## 1. Réalité : il n'existe PAS d'API 1xBet officielle publique

1xBet **ne fournit aucune API REST publique documentée** de cotes/marchés aux tiers. Trois voies seulement :

| Voie | Nature | Cotes ? | Officiel/légal | Verdict |
|---|---|---|---|---|
| **A. The Odds API — feed `onexbet`** | Agrégateur tiers payant déjà intégré à PariScore | ✅ oui (1X2/totals) | ✅ supporté, légal | **RECOMMANDÉ** |
| **B. LineFeed non officiel** (`1xbet.com/LineFeed/Get1x2_VZip`, `service-api`) | Endpoints internes du site, scrapés | ✅ oui (tous marchés) | ❌ viole ToS, anti-bot, geo-block | À éviter |
| **C. 1xBet Partners / Affiliate API** | API programme d'affiliation | ❌ stats marketing uniquement | ✅ légal | Hors sujet (pas de cotes) |

**Découverte projet** : The Odds API expose déjà 1xBet. Commentaire existant [server.js:8873](server.js:8873) :
> « Pour 1xbet : `ODDS_REGIONS=eu,us2` (couvre 1xbet via region us2 selon Odds API). »

→ **Aucune nouvelle API à intégrer.** La cote 1xBet est accessible *aujourd'hui* via le pipeline The Odds API déjà en place, en ajoutant `us2` aux régions.

---

## 2. Avantages (+) d'avoir les cotes 1xBet dans PariScore

- **EV/Edge personnalisé** : l'utilisateur parie sur 1xBet → calculer l'edge contre la **cote réellement jouable** (pas une moyenne EU) rend le Value Bet exact pour *lui*.
- **1xBet = cotes souvent « molles »/hautes** sur marchés secondaires → plus d'opportunités de valeur détectées vs books sharp (Pinnacle).
- **Cohérence tracking** : module « Mes Paris » utilise déjà `1xbet` comme bookmaker par défaut (import CSV, `normalizeBookmaker`). Boucler la chaîne cote→pari→règlement sur le même book.
- **Marge bookmaker mesurable** : comparer marge 1xBet vs no-vig marché → quantifier le coût réel des paris de l'utilisateur.

## 3. Inconvénients (−) / Risques

- **Pas d'API officielle** : voie B (scraping LineFeed) = endpoints non documentés, **changent sans préavis**, Cloudflare/anti-bot, domaines miroirs rotatifs (1xbet.com → 1xlite/1x-mirrors), **bans IP**, maintenance permanente, fiabilité faible.
- **Risque juridique / ToS** : scraper 1xBet viole ses CGU. 1xBet **non licencié ANJ** (interdit de promotion en France).
- **Conflit positionnement produit** : PariScore force-désactive les books non-ANJ ([server.js:3013](server.js:3013) « Nettoyage forcé — désactive tout bookmaker non-ANJ (1xBet, etc.) ») et liste 1xbet `aNJ:false` ([server.js:10105](server.js:10105)). Afficher des cotes 1xBet publiquement = incohérent avec le positionnement FR/ANJ et risque réglementaire (promotion opérateur non agréé).
- **Qualité données voie A** : The Odds API `onexbet` = 1X2/totals principaux, **pas** la profondeur de marchés du vrai 1xBet (handicaps asiatiques, props).
- **Coût quota** : ajouter `us2` aux régions The Odds API ≈ multiplie les requêtes par région → surveiller quota gratuit 500/mois (cron 12h).

---

## 4. Recommandation

**Voie A — The Odds API `onexbet` (region us2)** : seule option à la fois *légale, supportée, déjà câblée*.

- **Usage privé/perso recommandé** : intégrer la cote 1xBet pour le calcul EV **côté tracking/Mes Paris** (l'utilisateur l'utilise déjà), **sans l'afficher publiquement** comme book promu sur la page Matchs → évite le conflit ANJ.
- Concrètement (sur GO, non implémenté) :
  1. `.env` : `ODDS_REGIONS=eu,us2` (active le feed 1xBet via The Odds API).
  2. Vérifier que `normalizeBookmaker` mappe le label Odds API (`onexbet`/`1xBet`) → `1xbet`.
  3. Optionnel : flag interne `personal_book=1xbet` → colonne EV « vs 1xBet » visible **uniquement** en mode connecté/Mes Paris, pas en vitrine publique.
  4. Surveiller quota The Odds API après ajout `us2`.
- **Voie B (scraping LineFeed)** : déconseillée — risque légal + fragilité + conflit ANJ. À n'envisager que pour un usage strictement privé, hors prod publique, en assumant la maintenance.
- **Voie C (Affiliate)** : sans objet (pas de cotes).

### Tableau décision

| Critère | Voie A (Odds API us2) | Voie B (scraping) |
|---|---|---|
| Légal / ToS | ✅ | ❌ |
| Stabilité | ✅ (API supportée) | ❌ (casse fréquente) |
| Profondeur marchés | moyenne (1X2/totals) | élevée |
| Effort intégration | faible (config) | élevé + maintenance |
| Conflit ANJ | gérable (privé) | fort |
| Coût | quota Odds API | infra anti-ban |
| **Reco** | **OUI (privé)** | Non |

---

## 5. Conclusion

- **Pas d'« API 1xBet » à intégrer** — elle n'existe pas officiellement.
- Le besoin réel (« EV sur la cote que je joue ») est satisfait par **The Odds API region `us2`** déjà disponible dans PariScore — **config-only, 0 nouvelle dépendance**.
- Garder l'affichage 1xBet **privé** (tracking/EV perso) pour ne pas heurter le positionnement ANJ ni la règle `aNJ:false` existante.
- Scraping LineFeed = dernier recours, usage privé uniquement, risques assumés.

**Décision attendue avant tout code :**
- (a) GO config Voie A (`ODDS_REGIONS=eu,us2` + EV « vs 1xBet » privé) ?
- (b) Périmètre : privé/Mes Paris uniquement, ou aussi vitrine publique (⚠ risque ANJ) ?
- (c) Voie B scraping : exclue, ou à étudier pour usage strictement perso hors prod ?

*Rapport pour validation. Aucune modification effectuée.*
