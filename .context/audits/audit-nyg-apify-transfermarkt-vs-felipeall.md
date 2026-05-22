# Audit bd `nyg` — Voie D Apify `curious_coder/transfermarkt` vs felipeall self-host

**Date** : 2026-05-22
**Persona** : CTO & Lead Data Scientist (Quant)
**bd issue** : `ParisScorebis-nyg` P3 — [DATA-ENG] Voie D Apify transfermarkt
**Décision** : **NO-GO ferme** — statu quo felipeall self-host

---

## 1. Contexte

PariScore enrichit déjà les données joueur Transfermarkt via le sidecar self-host `felipeall/transfermarkt-api` (Python FastAPI). Le ticket bd `nyg` propose d'évaluer une voie alternative : actor Apify `curious_coder/transfermarkt`.

Question quant : la Voie D apporte-t-elle un avantage net mesurable justifiant son coût récurrent OPEX et l'effort d'intégration ?

## 2. État du wiring felipeall (référence)

| Composant | Locus server.js | Fonction |
|---|---|---|
| `fetchTransfermarkt(path)` | ~9755 | HTTP GET sidecar `TRANSFERMARKT_API_URL` |
| `tmResolvePlayerId(name)` | ~9810 | Résolution name → id avec normalisation |
| `getTransfermarktBio(playerId)` | ~9849 | Bio + market value série temps |
| Enrichissement lineups | ~21771 | `enrichLineupsWithBio()` injection nat/age/mv |
| Route proxy publique | ~27047 | `GET /api/v1/transfermarkt/:kind/:id` |
| Commentaire scaffold retiré | ~9756 | `// Scaffold Apify retiré (actor payant) au profit du sidecar felipeall/transfermarkt-api` |

**État** : production, 100% des use cases couverts (profile, market_value, transfers, injuries).

## 3. Tableau comparatif 12 critères

| Critère | felipeall self-host | Apify `curious_coder/transfermarkt` |
|---|---|---|
| **Coût OPEX** | 0 € (VPS OVH déjà payé) | **$15/mo + usage** (~$180+/an) |
| **Coût CAPEX intégration** | 0 € (déjà fait) | ~6-10h dev (parser maison par page type) |
| **Accès actuel** | OK runtime prod | **403 `actor-is-not-rented`** (trial expiré) |
| **Schéma sortie** | Pydantic typé (`/profile`, `/market_value`, `/transfers`, `/injuries`) | URL-scraping générique HTML brut |
| **Latence** | Sub-second (sidecar local Docker) | 2-5s (Apify cloud + cold start) |
| **Rate limit** | Limité par anti-bot upstream Transfermarkt | Limité par plan Apify ($15 = budget compute mensuel) |
| **Anti-bot robustness** | Géré côté sidecar (Python+headers) | Géré côté Apify (incluant proxies rotatifs) |
| **Coverage data** | profile + market_value série temps + transfers + injuries + bio | profile + market_value spot + transfers (sans fees historiques) |
| **Maintenance** | Upstream open-source actif (felipeall/transfermarkt-api) | Upstream tiers Apify (vendor lock-in) |
| **Lock-in** | Aucun (FastAPI self-host) | Apify SDK + token + facturation |
| **PCI/RGPD** | Self-host = full control logs | Tiers cloud (US?) — DPA à signer |
| **ROI mesurable** | Déjà rentabilisé | Négatif (même data + coût + effort) |

## 4. Pourquoi NO-GO (5 verrous)

### Verrou 1 — Doublon fonctionnel
felipeall couvre **100%** des use cases visés par Apify. Aucune feature Apify-only justifierait le doublon (pas de live serving, pas de scouting ML, pas d'historique unique).

### Verrou 2 — Coût récurrent net négatif
$180+/an OPEX vs $0 pour felipeall. ROI négatif sans gain produit.

### Verrou 3 — Accès actuellement bloqué
Test Apify renvoie `403 actor-is-not-rented` (trial expiré). Levée du blocage = engagement budgétaire amont **avant** validation produit.

### Verrou 4 — Schéma générique vs typé
felipeall = Pydantic typé, contrat stable. Apify = HTML scraping → parser maison par type de page (cf §W1 test report). Régression schema risk.

### Verrou 5 — Cohérence stack
PariScore stack = **zéro-dep npm** (sauf `better-sqlite3`). Intégrer Apify = ajouter dépendance SDK ou écrire helper HTTP custom → augmente surface maintenance.

## 5. Conditions de réouverture (réserve P3)

Voie D Apify devient candidate si **au moins 1** des 3 conditions:

1. **felipeall tombe** — upstream abandonné OU anti-bot Transfermarkt durci au point de casser le sidecar self-host.
2. **Migration archi serverless** — abandon VPS OVH → sidecar Docker plus exécutable.
3. **Abonnement Apify déjà engagé** — un autre actor (ex: Sofascore via `6jro` Plan J) signe contrat Apify → coût marginal Voie D devient ~0.

## 6. Innovation backlog Edge (règle 1 protocole — 3 propositions)

### Piste A — Player fragility score
Composante `injuries_history_score` calculée depuis felipeall `/injuries` historique:
```
score = Σ(jours_indispo × poids_récence) / 365
poids_récence = exp(-Δjours / 180)  // demi-vie 6 mois
```
Injecter dans `buildMatchRecord` comme modulateur xG offensif quand starter clé. Sortie : badge fragility 0-100 dans modal Insights.

### Piste B — Market value momentum
Série temps `/market_value` felipeall → dérivée 90j = signal `transfer_market_signal` 0-100. Recalibrer Power Score quand δMV ≥ ±15% (proxy forme/transferts imminents).

Implémentation :
```js
const mvSeries = await getTransfermarktBio(pid).market_values;
const mv90d = mvSeries.filter(p => Date.now() - p.t < 90*86400_000);
const slope = linearRegression(mv90d).slope;
const signal = clamp(slope / mvSeries[0].value * 100, -100, 100);
```

### Piste C — Pattern on-demand throttled généralisé
Étendre `fetchAiscoreServingOnDemand` (server.js bd `c5i` Phase 3 commit `fbea217`) à `fetchTransfermarktOnDemand`:
- Trigger : clic UI fiche joueur uniquement
- Cooldown 10min/miss par playerId
- Évite warm cache 24h gaspille bande passante sidecar pour joueurs jamais consultés
- Helper générique `withOnDemandThrottle(fetcher, opts)` réutilisable pour OddsPapi sharp anchor (bd `bjv`)

## 7. Décision finale

**NO-GO ferme** sur la Voie D Apify `curious_coder/transfermarkt`.

**Action bd** :
```bash
bd update nyg --notes "NO-GO ferme 2026-05-22. felipeall self-host couvre 100% use case (server.js:9755+ helpers + route /api/v1/transfermarkt/:kind + enrichLineupsWithBio). Apify = $15/mo OPEX + 403 actor-is-not-rented + schema generique HTML. Reserve P3 conditions: felipeall tombe / VPS retire / abonnement Apify deja engage."
bd close nyg
```

**Backlog Edge ouvert** : pistes A/B/C ci-dessus à ticketer si DG GO sur enrichissement Power Score depuis felipeall existant (zéro coût marginal).

---

*Auditeur : CTO & Lead Data Scientist (Quant). Référence cross : `.context/etude-transfermarkt-vs-stack-actuel-2026.md` §6.*
