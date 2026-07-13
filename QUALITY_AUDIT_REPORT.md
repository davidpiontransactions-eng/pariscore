# QUALITY_AUDIT_REPORT.md — PariScore V1

**Date d'audit** : 2026-07-12
**Auditeur** : Code Reviewer / Reality Checker (sous-agent Explore)
**Cible** : `C:/Users/David/ZCodeProject/pariscore/` — monolithe V1 en production
**Méthode** : `node --check`, `wc -l`, `grep`, lecture ciblée. Aucun fichier de code modifié pendant l'audit.

> Rapport rédigé par le chef de projet à partir des findings de l'agent Explore (read-only, ne disposait pas d'outil Write).

---

## Synthèse exécutive — Score global par dimension

| # | Dimension | Score | Verdict |
|---|-----------|-------|---------|
| 1 | Santé syntaxique | 🟢 VERT | `server.js` + `pariscore.app.js` passent `node --check` (exit 0) |
| 2 | Dette technique (monolithes) | 🔴 ROUGE | 3 fichiers >27k lignes, 491 `console.log`, 143 catch silencieux |
| 3 | Sécurité résiduelle | 🟢 VERT | 0 `eval`, 0 `new Function`, 0 secret hardcoded, child_process sanitizé, _debug protégé |
| 4 | API surface | 🟢 VERT | 411 routes V1 ; 10/10 routes admin échantillonnées protégées |
| 5 | Dépendances & config | 🔴 ROUGE | `package.json` racine = V2 (Next.js), en conflit direct avec V1 ; `.env.example` = V2 |
| 6 | Duplication / orphelins | 🟠 ORANGE | `pariscore.js` archivé (✅) ; 6-7 fichiers .js orphelins à la racine |

**Verdict global** : 🟠 **ORANGE**. Le code V1 est syntaxiquement sain et sécurisé, mais souffre d'une dette de monolithe massive et d'un **conflit de configuration racine critique** (`package.json`/`.env.example` décrivent V2).

---

## 1. Santé syntaxique — 🟢 VERT

| Fichier | `node --check` | Lignes |
|----------|----------------|--------|
| `server.js` (2.5 Mo) | OK | 52 076 |
| `pariscore.app.js` (1.8 Mo) | OK | 32 399 |
| `pariscore.html` | — | 27 378 |
| `admin.html` | — | 469 |
| **Total** | | **112 322** |

## 2. Dette technique — 🔴 ROUGE

- TODO/FIXME : 3 dans server.js (suivi de phase, pas des bugs ouverts), 0 dans pariscore.app.js
- `console.log` résiduels : **491** côté serveur (production, sans structure de logging)
- Try/catch : 1161 total, dont **143 silencieux vides** (~12%) — mélange de requires défensifs (acceptables) et catchs avalant des erreurs métier (à revoir)

## 3. Sécurité résiduelle — 🟢 VERT

- `eval(` / `new Function(` : **0** partout
- `child_process` : 13 références, spawn en mode non-shell (argv tableau) + whitelist regex — pas d'injection shell
- Secrets hardcoded : **0** — les 157 vars sont lues via `process.env`, `render.yaml` en `sync:false`
- Route `_debug` unique (`POST /api/v1/_debug/tennis-rehydrate-test`) protégée admin-only (403 sinon)

## 4. API surface — 🟢 VERT

- Routes `/api/v1/*` uniques : **411** (vs ~351 annoncées — écart à clarifier)
- 10/10 routes admin échantillonnées protégées (`getAuthUser` + `role !== 'admin'` → 403, ou `x-admin-key`, ou localhost+token)
- 38 auth guards `getAuthUser`, 36 checks `user.role`

## 5. Dépendances & config — 🔴 ROUGE

- **CRITICAL** : `package.json` racine = `"nextjs_tailwind_shadcn_ts"` v0.2.0 (V2), en contradiction avec `render.yaml` qui déploie V1 (`node server.js`, `buildCommand: echo "No build step required"`). Tout `npm install` racine installe l'arbre V2 inutile/casant pour V1.
- `.env.example` décrit V2 (`NEXT_PUBLIC_*`, PostHog, VAPID) — ignore les 157 vars V1 réelles.
- `render.yaml` cohérent avec V1 ✅ (`node server.js`, health `/api/v1/status`, disk `/app/data`).

## 6. Duplication / orphelins — 🟠 ORANGE

- `pariscore.js` correctement archivé dans `.archive/` ✅ (résiduel : commentaires + whitelist Cache-Control cosmétique)
- Fichiers `.js` racine orphelins (~1 732 lignes legacy) : `betwatchService.js`, `tennis-live-api.js`, `tennis-live.js`, `seed-history.js`, `gen-powerscore-md.js`, `debug-page-agent.js` — candidats à l'archive
- `ecosystem.config.js` : config PM2 légitime mais inutile sur Render

---

## Top 10 actions correctives prioritaires

1. **[CRITICAL] Résoudre le conflit `package.json` racine** — séparer physiquement V1 et V2 (dossiers/repos distincts)
2. **[HIGH] Régénérer un `.env.example` fidèle à V1** (couvrir les 157 vars : ADMIN_PASSWORD, JWT_SECRET, STRIPE_*, DISCORD_*, BSD_LIVE_*, CATBOOST_*, EDA_PYTHON_BIN…)
3. **[HIGH] Amorcer le découpage du monolithe `server.js`** (52k lignes) — isoler routes admin, ETL/seed, tennis pipeline, auth
4. **[MEDIUM] Logger structuré** pour remplacer les 491 `console.log` (niveaux, JSON, Sentry/PostHog)
5. **[MEDIUM] Auditer les 143 catch silencieux** — tagger les requires défensifs, logger les catch métier
6. **[MEDIUM] Découper `pariscore.app.js` (32k) et `pariscore.html` (27k)**
7. **[LOW] Clarifier le compte de routes** (411 vs 351)
8. **[LOW] Archiver les `.js` orphelins racine** dans `.archive/`
9. **[LOW] Documenter `ecosystem.config.js`** (PM2 local, pas Render)
10. **[INFO] Capitaliser sur les points forts** : zéro exécution dynamique, zéro secret hardcoded, auth admin systématique, child_process sanitizé
