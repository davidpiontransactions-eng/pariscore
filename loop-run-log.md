# Loop Run Log — Pariscore

> Historique structuré JSON des runs d'agents et workflows.
> Append one entry per run. Prune entries older than 30 days.

## Format

```json
{
  "run_id": "2026-08-25T10:00:00Z",
  "pattern": "workflow-name",
  "agent": "opencode|cline|zcode",
  "duration_s": 120,
  "items_found": 582,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 0,
  "mcp_calls": 0,
  "files_changed": 0,
  "outcome": "success | partial | failed | no-op",
  "error": null
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | ISO 8601 | Timestamp unique du run |
| `pattern` | string | Nom du workflow/pattern |
| `agent` | string | Agent utilisé (opencode/cline/zcode) |
| `duration_s` | int | Durée en secondes |
| `items_found` | int | Éléments découverts |
| `actions_taken` | int | Actions effectuées |
| `escalations` | int | Escalations vers human |
| `tokens_estimate` | int | Tokens estimés consommés |
| `mcp_calls` | int | Appels MCP effectués |
| `files_changed` | int | Fichiers modifiés |
| `outcome` | string | Résultat final |
| `error` | string|null | Message d'erreur si échec |

## Patterns Known

| Pattern | Description | Risk |
|---------|-------------|------|
| `scraping-oddalerts` | Extraction ligues oddalerts.com | low |
| `betting-analysis` | Analyse odds + edge detection | medium |
| `qa-apk` | QA automatisé APK Android | low |
| `code-review` | Review de code | low |
| `feature-impl` | Implémentation feature | medium |
| `bug-fix` | Correction de bug | medium |
| `bd-triage` | Triage des issues bd | low |
| `skill-update` | Mise à jour d'un skill | low |
| `deploy` | Déploiement VPS | high |

## Recent Runs

<!-- Loop appends below this line -->
{"run_id":"2026-08-25T10:00:00Z","pattern":"scraping-oddalerts","agent":"node","duration_s":120,"items_found":582,"actions_taken":1,"escalations":0,"tokens_estimate":0,"mcp_calls":0,"files_changed":1,"outcome":"success","error":null}
