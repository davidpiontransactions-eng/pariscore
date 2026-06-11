# Orchestration gstack des plugins pm-skills

## Principe

gstack peut piloter les 4 plugins pm-skills via le mécanisme **Skill-as-subroutine** :
une super-skill (`.claude/skills/pm-product-cycle/SKILL.md`) lit chaque skill child
depuis le disque et exécute ses sections séquentiellement.

## Pipeline

```
Phase 1: Strategy Analysis
  Skills: swot-analysis, porters-five-forces, value-proposition
  Commandes: /strategy, /market-scan
  Artefact: pm-skills-plugins/artifacts/strategy-*.md

Phase 2: Product Strategy & Vision
  Skills: product-vision, business-model, pricing-strategy
  Commandes: /business-model, /pricing
  Artefact: pm-skills-plugins/artifacts/prd-*.md

Phase 3: PRD & Sprint Planning
  Skills: create-prd, brainstorm-okrs, user-stories, sprint-plan
  Commandes: /write-prd, /plan-okrs, /sprint
  Artefact: pm-skills-plugins/artifacts/sprint-*.md

Phase 4: Documentation & Tests
  Skills: document-app, derive-tests, test-scenarios
  Commandes: /document-app, /derive-tests
  Artefact: pm-skills-plugins/artifacts/document-*.md

Phase 5: Pre-Ship Verification
  Skills: ship-check, security-audit-static
  Commandes: /ship-check, /security-audit-static
  Artefact: pm-skills-plugins/artifacts/ship-report-*.md
```

## Utilisation

```bash
# Démarrer le cycle complet
"lance le cycle produit complet pour [feature]"

# Démarrer à partir d'une phase spécifique
"exécute la phase 3 (PRD & Sprint) pour [feature]"

# Mode dégradé (phase unique)
"lance /write-prd pour [feature]"
"fais un /ship-check"
```

## Intégration gstack

Les phases sont compatibles avec le pipeline gstack :

1. `/gstack-office-hours` → Définition du problème
2. `pm-product-cycle` Phase 1-2 → Stratégie + Vision
3. `/gstack-plan-ceo-review` → Revue CEO du plan
4. `/gstack-plan-eng-review` → Revue Engineering
5. `pm-product-cycle` Phase 3 → PRD + Sprint
6. Implémentation
7. `pm-product-cycle` Phase 4-5 → Tests + Ship
8. `/gstack-ship` → PR + Déploiement
