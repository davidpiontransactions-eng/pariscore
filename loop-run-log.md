# Loop Run Log â€” Pariscore

> Historique structurÃ© JSON des runs d'agents et workflows.
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
| `agent` | string | Agent utilisÃ© (opencode/cline/zcode) |
| `duration_s` | int | DurÃ©e en secondes |
| `items_found` | int | Ã‰lÃ©ments dÃ©couverts |
| `actions_taken` | int | Actions effectuÃ©es |
| `escalations` | int | Escalations vers human |
| `tokens_estimate` | int | Tokens estimÃ©s consommÃ©s |
| `mcp_calls` | int | Appels MCP effectuÃ©s |
| `files_changed` | int | Fichiers modifiÃ©s |
| `outcome` | string | RÃ©sultat final |
| `error` | string|null | Message d'erreur si Ã©chec |

## Patterns Known

| Pattern | Description | Risk |
|---------|-------------|------|
| `scraping-oddalerts` | Extraction ligues oddalerts.com | low |
| `betting-analysis` | Analyse odds + edge detection | medium |
| `qa-apk` | QA automatisÃ© APK Android | low |
| `code-review` | Review de code | low |
| `feature-impl` | ImplÃ©mentation feature | medium |
| `bug-fix` | Correction de bug | medium |
| `bd-triage` | Triage des issues bd | low |
| `skill-update` | Mise Ã  jour d'un skill | low |
| `deploy` | DÃ©ploiement VPS | high |

## Recent Runs

<!-- Loop appends below this line -->
{"run_id":"2026-08-25T10:00:00Z","pattern":"scraping-oddalerts","agent":"node","duration_s":120,"items_found":582,"actions_taken":1,"escalations":0,"tokens_estimate":0,"mcp_calls":0,"files_changed":1,"outcome":"success","error":null}
Le processus ne peut pas acc‚der au fichier car ce fichier est utilis‚ par un autre processus.
Le processus ne peut pas acc‚der au fichier car ce fichier est utilis‚ par un autre processus.
Le processus ne peut pas acc‚der au fichier car ce fichier est utilis‚ par un autre processus.
Error: no beads database found
Hint: run 'bd where' to inspect the resolved workspace, or 'bd init' to create a new database
      or set BEADS_DIR to point to your .beads directory
Le processus ne peut pas acc‚der au fichier car ce fichier est utilis‚ par un autre processus.
Le processus ne peut pas acc‚der au fichier car ce fichier est utilis‚ par un autre processus.
Le processus ne peut pas acc‚der au fichier car ce fichier est utilis‚ par un autre processus.
