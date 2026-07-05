---
name: pm-product-cycle
description: |
  Orchestre le cycle produit complet en 5 phases : Strategy → PRD → Sprint → Ship.
  Utilise les 4 plugins pm-skills installés (pm-product-strategy, pm-execution, pm-ai-shipping, pm-go-to-market).
  Mode interactif : pose des questions à chaque phase. Mode headless : auto-exécute.
  Use when asked to "run the full pm cycle", "orchestrate the product workflow", "strategy to ship", "lance le cycle produit", "boucle produit complète".
---

# pm-product-cycle — Orchestrateur de cycle produit

## Principe

Pipeline séquentiel en 5 phases : Strategy → PRD → Sprint → Document & Test → Ship Check.
Chaque phase produit un artefact sur disque. La phase suivante le lit avant de s'exécuter.

Les phases s'exécutent en ordre strict. Chaque phase doit compléter avant la suivante.

## Convention d'artefacts

Chaque phase écrit son artefact dans le dossier `pm-skills-plugins/artifacts/` :
```
pm-skills-plugins/artifacts/
  strategy-{timestamp}.md    ← Phase 1
  prd-{timestamp}.md         ← Phase 2
  sprint-{timestamp}.md      ← Phase 3
  document-{timestamp}.md    ← Phase 4
  ship-report-{timestamp}.md ← Phase 5
```

## Phases

### Phase 1: Strategy Analysis

Charge et exécute le skill pm-product-strategy. La phase interroge l'utilisateur sur le contexte (marché, concurrents, vision) puis produit une analyse stratégique complète.

**Skills utilisés :**
- `swot-analysis` — Forces/Faiblesses/Opportunités/Menaces
- `porters-five-forces` — Analyse concurrentielle
- `value-proposition` — Proposition de valeur

**Commandes suggérées :**
- `/strategy` — Analyse stratégique complète
- `/market-scan` — Scan de marché
- `/value-proposition` — Définition de la proposition de valeur

**Artefact produit :** `pm-skills-plugins/artifacts/strategy-{timestamp}.md`

**Instructions :**
1. Demande à l'utilisateur le contexte : marché, produit, objectifs, concurrents
2. Si l'utilisateur veut une analyse rapide, lance `/strategy`
3. Si l'utilisateur veut approfondir, lance séquentiellement SWOT → Five Forces → Value Proposition
4. Synthétise les résultats dans l'artefact
5. Résume les décisions clés à l'utilisateur
6. Demande validation avant de passer à la Phase 2

---

### Phase 2: Product Strategy & Vision

Affine la stratégie en vision produit et business model.

**Skills utilisés :**
- `product-vision` — Énoncé de vision
- `business-model` — Business Model Canvas
- `product-strategy` — Product Strategy Canvas
- `pricing-strategy` — Stratégie de prix
- `monetization-strategy` — Stratégie de monétisation

**Commandes suggérées :**
- `/business-model` — Business Model Canvas
- `/pricing` — Stratégie de prix
- `/strategy` — Product Strategy Canvas

**Artefact produit :** `pm-skills-plugins/artifacts/prd-{timestamp}.md`

**Instructions :**
1. Relit l'artefact de la Phase 1
2. Définit la vision produit (Product Vision Canvas)
3. Construit le Business Model Canvas ou Product Strategy Canvas
4. Définit la stratégie de monétisation/prix si applicable
5. Synthétise dans l'artefact
6. Demande validation avant Phase 3

---

### Phase 3: PRD & Sprint Planning

Produit le Product Requirements Document et planifie le sprint.

**Skills utilisés :**
- `create-prd` — PRD complet en 8 sections
- `brainstorm-okrs` — OKRs d'équipe
- `outcome-roadmap` — Roadmap orientée outcomes
- `user-stories` — User stories (format 3 C's + INVEST)
- `sprint-plan` — Planification de sprint
- `prioritization-frameworks` — Matrice de priorisation
- `job-stories` — Jobs To Be Done

**Commandes suggérées :**
- `/write-prd` — Écrire le PRD
- `/plan-okrs` — Définir les OKRs
- `/write-stories` — Écrire les user stories
- `/sprint` — Planifier le sprint
- `/transform-roadmap` — Transformer la roadmap

**Artefact produit :** `pm-skills-plugins/artifacts/sprint-{timestamp}.md`

**Instructions :**
1. Relit les artefacts des Phases 1 et 2
2. Lance `/write-prd` pour le PRD complet
3. Propose de définir les OKRs avec `/plan-okrs`
4. Transforme la roadmap en outcomes avec `/transform-roadmap`
5. Planifie le sprint avec `/sprint`
6. Synthétise dans l'artefact
7. Demande validation avant Phase 4

---

### Phase 4: Documentation & Tests

Génère la documentation technique et les tests.

**Skills utilisés :**
- `document-app` — Documentation d'architecture
- `derive-tests` — Dérivation des cas de test
- `test-scenarios` — Scénarios de test détaillés
- `dummy-dataset` — Génération de données de test
- `release-notes` — Notes de release

**Commandes suggérées :**
- `/document-app` — Documenter l'architecture
- `/derive-tests` — Dériver les tests
- `/test-scenarios` — Scénarios de test
- `/generate-data` — Générer des données de test

**Artefact produit :** `pm-skills-plugins/artifacts/document-{timestamp}.md`

**Instructions :**
1. Relit les artefacts des phases précédentes
2. Lance `/document-app` pour l'architecture
3. Lance `/derive-tests` pour les cas de test
4. Optionnel : `/test-scenarios` pour les scénarios détaillés
5. Synthétise dans l'artefact
6. Demande validation avant Phase 5

---

### Phase 5: Pre-Ship Verification

Vérification finale avant mise en production.

**Skills utilisés :**
- `ship-check` — Checklist pré-déploiement
- `performance-audit-static` — Audit performance statique
- `security-audit-static` — Audit sécurité statique
- `intended-vs-implemented` — Vérification d'implémentation

**Commandes suggérées :**
- `/ship-check` — Checklist pré-déploiement
- `/security-audit-static` — Audit sécurité
- `/performance-audit-static` — Audit performance

**Artefact produit :** `pm-skills-plugins/artifacts/ship-report-{timestamp}.md`

**Instructions :**
1. Relit tous les artefacts précédents
2. Lance `/ship-check` pour la checklist complète
3. Optionnel : `/security-audit-static` + `/performance-audit-static`
4. Produit le rapport final avec statut GO/NO-GO
5. Si NO-GO, liste les blocages avec leur sévérité

---

## Modes d'exécution

### Mode interactif (défaut)
Chaque phase demande validation à l'utilisateur avant de passer à la suivante.
Les choix d'implémentation (quelle commande lancer, quel skill utiliser) sont proposés à l'utilisateur.

### Mode headless (automatique)
Quand `SESSION_KIND` est `"spawned"` ou que l'utilisateur précise "headless" ou "auto" :
- Auto-choisir la commande recommandée à chaque phase
- Produire tous les artefacts sans demander validation
- Rapport final complet

## Règles générales
1. Les phases s'exécutent en ordre strict — jamais en parallèle
2. Chaque phase lit l'artefact de la phase précédente avant de commencer
3. Les décisions mécaniques (1 seule bonne réponse) sont auto-décidées
4. Les décisions de stratégie/vision sont TOUJOURS soumises à l'utilisateur
5. En cas de blocage, STOP et résume le problème à l'utilisateur

## Completion Protocol

Rapport final avec :
- **STATUS** : DONE / DONE_WITH_CONCERNS / BLOCKED
- **Artefacts produits** : liste des fichiers avec leur chemin
- **Décisions clés** : résumé des choix effectués
- **Prochaines étapes recommandées** : ce que l'utilisateur devrait faire ensuite
