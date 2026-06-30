# Debug Automation Pipeline — PariScore

**Objectif :** Passer d'un débogage **réactif** (on attend qu'un utilisateur signale un crash) à un débogage **proactif et orchestré** (dès qu'une erreur 500 / crash JS est détecté, un pipeline automatique ouvre le triage → diagnostic → patch → QA).

**Créé le :** 2026-06-30 (suite au post-mortem PSCATCH)
**Skill directeur :** `superpowers:systematic-debugging`

---

## 0. Le problème que ça résout

Le bandeau `PSCATCH` nous a rendus aveugles pendant des semaines (`msg: {}`). Quand on a enfin capturé une vraie trace, le bug était déjà en production. Le pattern :

1. Crash en prod → invisible (sérialiseur défaillant).
2. Signalement utilisateur → trop tard.
3. Debug manuel ad-hoc → lent, non reproductible.

**Solution :** un pipeline qui se déclenche **automatiquement** sur le signal d'erreur, pas sur le signalement humain.

---

## 1. Taxonomie des ressources

### 1.1 Agents (rôles)

| Agent | Rôle | Entrées | Sorties |
|-------|------|---------|---------|
| **Triage Agent** | Lit les logs, classifie l'erreur (JS client / 500 serveur / timeout API / DB), détermine la sévérité, isole le composant fautif. | Log brut (`/api/v1/clientside-error`, log serveur, stack trace) | Ticket structuré : `{type, severity, component, file_suspect, repro_hints}` |
| **Diagnostics Agent** | Applique `systematic-debugging` Phase 1–3 : reproduit, lit le code source, trace le data flow, forme une hypothèse de root cause. | Ticket Triage + accès filesystem + git blame | **RCA documentée** + hypothèse de fix minimale |
| **Patching Agent** | Implémente le fix (Phase 4 du skill) : un seul changement ciblé, test de régression, pas de refacto opportuniste. | RCA + Diagnostics | Branche git + diff + test de régression |
| **QA Agent** | Vérifie : le test passe, pas de régression elsewhere, démarre le serveur local, valide la route/le rendu. | Branche Patching | Rapport QA `{pass, regressions, screenshot?}` |

### 1.2 Skills (compétences requises)

| Skill | Usage | Dispo ? |
|-------|-------|---------|
| `superpowers:systematic-debugging` | **Colon vertébral** du Diagnostics Agent. Iron Law : pas de fix sans RCA. | ✅ |
| `superpowers:test-driven-development` | Patching Agent : écrire le test de régression **avant** le fix. | ✅ |
| `superpowers:verification-before-completion` | QA Agent : prouver que le fix marche avant de claim "résolu". | ✅ |
| `superpowers:root-cause-tracing` | Diagnostics : tracer la bad value en arrière dans la call stack. | ✅ (dans le skill dir) |
| `secret-scanning` | Vérifier qu'un diff ne leak pas `.env` / clés API. | ✅ |
| `metier-audit-qa` | QA Agent : audit métier du module impacté. | ✅ |
| `log-analysis` *(à créer)* | Triage Agent : parser/formatteur de logs PariScore (PSCATCH, server console). | ❌ À scaffold |
| `ast-parsing` *(à créer)* | Diagnostics : naviguer le monolithe `server.js` (7578 lignes) / `pariscore.js` par symboles. | ❌ À scaffold |

### 1.3 MCP (Model Context Protocols)

| Serveur MCP | Rôle dans le pipeline | Dispo ? |
|-------------|----------------------|---------|
| `project_fs` | Lecture/écriture fichiers (remplace shell `cat`/`sed`). | ✅ `.mcp.json` |
| `git` | `git_blame`, `git_diff`, `git_log` pour identifier le commit introducteur du bug. | ✅ |
| `memory` (Knowledge Graph) | Stocker les RCA persistantes, les patterns de bugs récurrents, les décisions. `search_nodes("bug: PSCATCH")` pour restaurer le contexte. | ✅ |
| **Sentry / Datadog MCP** *(à brancher)* | Triage Agent : pull des erreurs agrégées, stack traces groupées, breadcrumbs. | ❌ Configurer un webhook + MCP HTTP |
| **SQLite inspector MCP** *(à créer)* | Diagnostics : requêter `pariscore.db` (métriques, historique, erreurs persistées). | ❌ Petit MCP custom via `better-sqlite3` |
| **Render deploy MCP** *(via API)* | Patching→QA : déclencher un deploy canary après merge. | ❌ Utiliser `render.yaml` + API REST Render |

---

## 2. Master Prompt d'Orchestration

### 2.1 Le déclencheur (hook production → pipeline)

Deux signaux déclenchent le pipeline :

**Signal A — Crash JS client :** un POST arrive sur `/api/v1/clientside-error` avec un payload dont `message` ≠ `"{}"`.
**Signal B — Erreur 500 serveur :** `server.js` logge `[ERR] 500` sur une route `/api/v1/*`.

Le webhook Render (ou un cron local) déclenche alors le script d'orchestration :

### 2.2 Script Bash d'orchestration (`scripts/debug-pipeline.sh`)

```bash
#!/usr/bin/env bash
# Debug Automation Pipeline — PariScore
# Déclenché sur erreur 500 serveur OU crash JS client signalé.
set -euo pipefail

LOG_FILE="${1:-/tmp/ps-error-latest.json}"
PIPELINE_DIR="$(git rev-parse --show-toplevel)"
cd "$PIPELINE_DIR"

echo "═══ [PSCATCH-PIPELINE] $(date -Iseconds) ═══"
echo "Log source: $LOG_FILE"

# ── A) Triage : intercepter + classifier le log ──────────────────────
echo "[1/4] Triage Agent..."
TRIAGE_JSON=$(zcode --mode=orchestrator --non-interactive run-skill metier-recherche-web \
  --prompt "Lis le log d'erreur dans $LOG_FILE. Classifie: type (js_client|http_500|timeout|db), severity (P0|P1|P2), component suspecté, fichier:line pointé par la stack. Rends un JSON strict." \
  --input "@$LOG_FILE")
echo "  → $TRIAGE_JSON"

# ── B) Diagnostics : RCA via systematic-debugging ────────────────────
echo "[2/4] Diagnostics Agent (systematic-debugging)..."
zcode --mode=orchestrator --non-interactive \
  --prompt "Skill: superpowers:systematic-debugging. Ticket: $TRIAGE_JSON. Applique Phase 1 (root cause investigation) sur le composant suspecté. Utilise project_fs + git MCP. Produis une RCA dans POST_MORTEM_<id>.md. Ne PROPOSE AUCUN FIX avant la fin de la Phase 3."

# ── C) Patching : générer la branche + correctif ─────────────────────
echo "[3/4] Patching Agent..."
BRANCH="hotfix/$(date +%Y%m%d)-$(echo "$TRIAGE_JSON" | jq -r '.id // "auto"')"
git checkout -b "$BRANCH"
zcode --mode=orchestrator --non-interactive \
  --prompt "Skill: superpowers:test-driven-development + superpowers:verification-before-completion. Applique le fix de la RCA (un seul changement ciblé). Écris d'abord un test de régression. Lance 'node -c' sur les fichiers modifiés."

# ── D) QA : vérification + PR ────────────────────────────────────────
echo "[4/4] QA Agent..."
zcode --mode=orchestrator --non-interactive \
  --prompt "Skill: metier-audit-qa. Démarre 'node server.js', vérifie la route impactée, check les régressions. Si OK, ouvre la PR via gh. Si KO, documente et rejette la branche."

echo "═══ [PSCATCH-PIPELINE] FIN — branche: $BRANCH ═══"
```

### 2.3 Variante JSON (si orchestré par un scheduler)

```json
{
  "name": "pariscore-debug-pipeline",
  "trigger": {
    "type": "webhook",
    "url": "https://pariscore.onrender.com/api/v1/clientside-error",
    "filter": "payload.severity in ['P0','P1'] AND payload.message != '{}'"
  },
  "steps": [
    { "agent": "Triage",      "skill": "metier-recherche-web",         "mcp": ["project_fs"],                  "output": "triage.json" },
    { "agent": "Diagnostics", "skill": "superpowers:systematic-debugging", "mcp": ["project_fs","git","memory"], "output": "POST_MORTEM_<id>.md", "gate": "rca_complete" },
    { "agent": "Patching",    "skill": "superpowers:test-driven-development", "mcp": ["project_fs","git"],     "branch": "hotfix/<date>-<id>", "gate": "node_c_ok" },
    { "agent": "QA",          "skill": "metier-audit-qa",              "mcp": ["project_fs"],                  "gate": "qa_pass", "action_on_pass": "open_pr" }
  ],
  "on_failure": "post to #pariscore-alerts with RCA draft"
}
```

---

## 3. Gates de qualité (anti-court-circuit)

Chaque agent a un **gate** bloquant. Le pipeline ne passe au suivant que si le gate est vert. C'est l'incarnation de l'**Iron Law** de `systematic-debugging` :

| Transition | Gate obligatoire | Si KO |
|------------|------------------|-------|
| Triage → Diagnostics | Log parsé, type identifié | Retry Triage (max 2) puis alerte humaine |
| Diagnostics → Patching | **RCA écrite + hypothèse unique** | **BLOQUÉ** — pas de fix sans RCA |
| Patching → QA | `node -c` OK + test de régression écrit | Retour Patching |
| QA → PR | QA pass + 0 régression | Retour Diagnostics (architecture à questionner si ≥3 échecs) |

**Règle des 3 fixes** (Phase 4.5 du skill) : si le Patching Agent échoue 3×, le pipeline s'arrête et ouvre une discussion d'architecture plutôt que de tenter un 4e fix.

---

## 4. Intégration Knowledge Graph (mémoire persistante)

À chaque exécution, le Diagnostics Agent écrit dans le MCP `memory` :

```
create_entities([{
  name: "bug-<id>",
  entityType: "bug",
  observations: [
    "RCA: throw new Error() vide → JSON.stringify → {}",
    "Composant: pariscore.html serialize()",
    "Fix: branche hotfix/20260630-pscatch",
    "Pattern récurrent: toute capture globale doit gérer les props non-énumérables"
  ]
}])
create_relation("bug-<id>", "RELATES_TO", "pariscore-architecture")
```

Ainsi, `search_nodes("serialize Error {}")` restaure instantanément le contexte lors d'une prochaine session.

---

## 5. Roadmap d'implémentation

| Étape | Action | Effort |
|-------|--------|--------|
| **1** | Scaffold skill local `log-analysis` (parser PSCATCH + logs server) | S |
| **2** | Créer MCP SQLite inspector custom (`better-sqlite3`) | M |
| **3** | Brancher webhook Sentry → `/api/v1/clientside-error` déjà existant | S |
| **4** | Script `scripts/debug-pipeline.sh` + scheduler (cron Render / PM2) | M |
| **5** | Alerting Slack/Discord `#pariscore-alerts` on pipeline failure | S |
| **6** | MCP Render deploy (canary auto post-merge) | L |

---

## 6. Lien avec le Post-Mortem

Ce pipeline est la **prévention systémique** issue du post-mortem `POST_MORTEM_PSCATCH.md`. L'erreur fantôme `msg: {}` n'aurait jamais atteint la production si :
- le **Triage Agent** avait vu un log exploitable (sérialiseur sain) ;
- le **Diagnostics Agent** avait tourné en continu sur les erreurs 500 ;
- le **Knowledge Graph** avait retenu le piège "`JSON.stringify(Error) === {}`".

Le fix manuel corrige le passé ; ce pipeline protège le futur.
