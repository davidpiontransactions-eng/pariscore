---
type: decision
slug: sackmann-purge
title: ADR — Purge Sackmann tennis_atp/wta (licence CC BY-NC-SA incompatible)
status: approved-go-revised-plan
tags: [adr, legal, licence, tennis, data-source, compliance]
updated: 2026-05-23
sources: [".context/rapport-tennis-consolidation-2026.md", ".context/tennis-data-sources-scraping-2026.md", "bd 8uoc"]
xref: [[elo-dynamique]], [[tennis-abstract]]
bd: [8uoc]
---

# ADR — Purge Sackmann tennis_atp/wta (licence CC BY-NC-SA incompatible commercial)

**Date décidée:** 2026-05-23. **Statut:** APPROVED GO (revised plan — TML-DB invalidée 2026-05-23, replacement source = internal Elo from BSD/ESPN).

## Décision finale

**GO purge** des datasets Sackmann (`tennis_atp` + `tennis_wta` GitHub) actuellement utilisés dans `tennis_matches` table.

**Substitution choisie DG 2026-05-23 :** **Build internal Elo from BSD/ESPN settled matches** (0$ propriétaire, coverage limitée à BSD ingest start ~2024+, 3-5j dev).

## Raison purge

Jeff Sackmann publie ses datasets historiques tennis (1968-présent, ATP+WTA matches+rankings+players) sous **CC BY-NC-SA** ("Creative Commons Attribution-NonCommercial-ShareAlike").

PariScore = **service commercial** (abonnement Pro €19/mo via [[stripe]]). Utiliser data CC BY-NC-SA dans contexte commercial = **infraction licence**.

Risques:
- Mise en demeure Sackmann (improbable, mais possible)
- Risque légal exposure (judge non flexible sur NC)
- Reputational

## ⚠️ FINDING 2026-05-23 — TML-Database invalidée

Research v2 (commit `2ce9463`) revendiquait TennisMyLife/TML-Database = licence MIT compatible commercial. **FAUX.**

Vérification GitHub directe (https://github.com/TennisMyLife/TML-Database) révèle:
> "Non-commercial unless explicitly permitted."
> "Based on Jeff Sackmann's work: tennis_atp under Creative Commons Non-Commercial Share Alike."

TML-Database est un **dérivé Sackmann CC BY-NC-SA** — substituer Sackmann par TML = substitution stérile (même infraction NC, juste rebadgé). Donc **NO-GO TML**.

## 3 questions DG résolues (bd 8uoc)

| Q | Question | Réponse DG 2026-05-23 |
|---|---|---|
| Q1 | GO purge `tennis_matches` Sackmann + ETL substitution ? | **GO** purge confirmé |
| Q2 | Garder Sackmann pour usage research interne uniquement ? | NO (purge totale) |
| Q3 | Délai purge (immédiat vs après backup snapshot) ? | Backup obligatoire avant drop (audit trail) |

## Substitution proposée et choix DG 2026-05-23

| Option | Coût | License | Effort | Choix DG |
|---|---|---|---|---|
| Build internal Elo from BSD/ESPN | 0$ (BSD payé) | Propriétaire | 3-5j | ✅ **CHOISI** |
| Sportradar tennis API | ~651$ one-time | Commercial OK | 2-3j ETL | non |
| RapidAPI tennis-api1 | variable | Commercial OK | 1-2j | non |
| TennisMyLife/TML-Database | 0$ | **CC-NC** (invalidée 2026-05-23) | — | non |

## Plan migration révisé (2026-05-23)

1. **Backup** `tennis_matches` snapshot pré-purge (audit trail) — script `tools/backup-tennis-matches.js`
2. **Disable Sackmann sync** server.js immédiat (stop infraction continue) — flag `SACKMANN_SYNC_DISABLED`
3. **Build internal history ETL** (session future) — `tools/build-tennis-internal-history.js`, alimente nouvelle table `tennis_matches_internal` from BSD `bsd_tennis_matches_*` cache + ESPN tennis archive + `archive_tennis_matches` array
4. **Switch consumers** — refactor `computeTennisElo` + serve stats (T8) + set profile (T7) + speed index + backtest (T9) + tournament alias index → lecture depuis `tennis_matches_internal`
5. **Drop** old `tennis_matches` après validation 30j (separate script user runs on VPS)
6. **Strip dead code** `parseSackmannCSV` / `syncSackmannData` / `SACKMANN_REPOS` / endpoints `/api/v1/tennis/sackmann/*`
7. **Document** `LICENSE-DATA.md` racine — toutes sources data + licences

## Impact features

- [[elo-dynamique]] tennis surface — re-train avec internal data (coverage réduite mais propriétaire)
- H2H lifetime tennis — re-compute from internal history
- Tournament historical results — re-populate
- **Coverage limitation:** internal history demarre à BSD ingest start (~2024). Pas d'historique 1968-2023.
- Pas d'impact prod runtime (data historique seulement)

## Related

- [[elo-dynamique]] — Consommateur primary impacted
- [[tennis-abstract]] — Source complementary indépendante (Elo scraping weekly)
- bd `8uoc` (CLOSED 2026-05-22 research scope, replaced by new bd ticket internal Elo build)

## Changelog

- 2026-05-22: ADR formalisé wave bootstrap — pending DG Q1/Q2/Q3 bd `8uoc`
- 2026-05-23: DG decision GO purge. Finding TML-DB CC-NC (invalidée). Revised plan = build internal Elo from BSD/ESPN. Phase 1+2 exec immédiat session courante; phases 3-7 déférées.
