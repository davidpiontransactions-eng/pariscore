---
type: decision
slug: sackmann-purge
title: ADR — Purge Sackmann tennis_atp/wta (licence CC BY-NC-SA incompatible)
status: pending-dg-decision
tags: [adr, legal, licence, tennis, data-source, compliance]
updated: 2026-05-22
sources: [".context/rapport-tennis-consolidation-2026.md", ".context/tennis-data-sources-scraping-2026.md", "bd 8uoc"]
xref: [[tennis-mylife]], [[elo-dynamique]], [[tennis-abstract]]
bd: [8uoc]
---

# ADR — Purge Sackmann tennis_atp/wta (licence CC BY-NC-SA incompatible commercial)

**Date proposée:** 2026-05-22 (Research v2 livré commit `2ce9463`). **Statut:** PENDING DG decision (3 questions Q1/Q2/Q3).

## Décision proposée

**GO purge** des datasets Sackmann (`tennis_atp` + `tennis_wta` GitHub) actuellement utilisés dans `tennis_matches` table.

Substituer par **TennisMyLife/TML-Database** licence MIT compatible commercial.

## Raison

Jeff Sackmann publie ses datasets historiques tennis (1968-présent, ATP+WTA matches+rankings+players) sous **CC BY-NC-SA** ("Creative Commons Attribution-NonCommercial-ShareAlike").

PariScore = **service commercial** (abonnement Pro €19/mo via [[stripe]]). Utiliser data CC BY-NC-SA dans contexte commercial = **infraction licence**.

Risques:
- Mise en demeure Sackmann (improbable, mais possible)
- Risque légal exposure (judge non flexible sur NC)
- Reputational

## 3 questions DG pending (bd 8uoc)

| Q | Question |
|---|---|
| Q1 | GO purge `tennis_matches` Sackmann + ETL TML-DB MIT substitution ? |
| Q2 | Garder Sackmann pour usage **research interne** uniquement (Elo modèle training, jamais exposé client) — acceptable ? |
| Q3 | Délai purge (immédiat vs après backup snapshot complet) ? |

## Alternative TML-Database (TennisMyLife)

- Licence **MIT** ✅ commercial OK
- GitHub: https://github.com/TennisMyLife/TML-Database
- Coverage: ATP+WTA historique
- Format similaire Sackmann (CSV par année)
- Maintenu activement

## Plan migration (si GO)

1. **Backup** `tennis_matches` table snapshot pré-purge (audit trail)
2. **ETL TML-DB** → nouvelle table `tennis_matches_tml` parallèle (validation cohérence)
3. **Switch** primary source dans queries Elo/H2H/stats
4. **Drop** old `tennis_matches` après validation 30j
5. **Document** licence MIT dans `LICENSE-DATA.md` racine

## Impact features

- [[elo-dynamique]] tennis surface — re-train avec TML-DB
- H2H lifetime tennis — re-compute
- Tournament historical results — re-populate
- Pas d'impact prod runtime (data historique seulement)

## Related

- [[tennis-mylife]] — Substitution proposée (à créer wave 3)
- [[elo-dynamique]] — Consommateur primary impacted
- [[tennis-abstract]] — Source complementary indépendante (Elo scraping weekly)

## Changelog

- 2026-05-22: ADR formalisé wave bootstrap — pending DG Q1/Q2/Q3 bd `8uoc`
