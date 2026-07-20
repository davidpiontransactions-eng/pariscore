# Metadata and Markup Conventions (2026)

This guide defines recommended metadata and markdown structure conventions for agents, skills, and instruction files in this repository.

## Why This Exists

These conventions improve:

- Tool-driven routing and filtering
- Release and audit reproducibility
- Contract validation across orchestrators and specialists
- Long-term consistency across Copilot, Claude Code, and Gemini surfaces

## Agent Frontmatter Metadata

Use `metadata` for machine-readable properties that should remain stable across wording changes.

Example:

```yaml
---
name: accessibility-lead
description: Accessibility team lead and orchestrator
tools: ['read', 'edit', 'search', 'agent']
metadata:
  owner: web-a11y
  domain: web
  maturity: stable
  release-phase: ga
  capability-tags: ["wcag-2.2", "aria", "keyboard", "forms"]
  dispatch-contract: required
---
```

Recommended fields:

| Field | Type | Purpose |
|------|------|---------|
| `owner` | string | Team or maintainer group |
| `domain` | string | `web`, `document`, `github`, `developer`, `cross-cutting` |
| `maturity` | string | `stable`, `beta`, `experimental` |
| `release-phase` | string | `ga`, `preview`, `internal` |
| `capability-tags` | array | Discovery and filtering tags |
| `dispatch-contract` | string | `required` for orchestrators that must follow specialist dispatch |

## Skill Frontmatter Metadata

Example:

```yaml
---
name: web-severity-scoring
description: Compute web accessibility scores and grades
metadata:
  spec-version: "2026-05"
  model-compatibility: ["copilot", "claude", "gemini"]
  scoring-model: "v2"
  compliance-profiles: ["wcag-2.2-aa", "en-301-549"]
---
```

Recommended fields:

| Field | Type | Purpose |
|------|------|---------|
| `spec-version` | string | Internal schema/contract version |
| `model-compatibility` | array | Supported model hosts |
| `scoring-model` | string | Versioned scoring method when applicable |
| `compliance-profiles` | array | Regulatory or standards mapping |

## Instruction File Markup Conventions

Use predictable heading and checklist structure so scanners and maintainers can parse files consistently.

Required section headings for larger instruction files:

- `## Decision Matrix`
- `## Non-Negotiable Standards`
- `## Acceptance Criteria`

Markdown structure rules:

- One H1 per file
- Explicit language tags on all fenced code blocks
- Lists surrounded by blank lines
- Avoid ambiguous links in policy docs

## Release and Audit Metadata

When writing release notes or audit outputs, include explicit metadata blocks to support reproducibility.

Example:

```yaml
metadata:
  release: "5.2.0"
  scoring-model: "web-severity-scoring-v2"
  profile: "balanced"
  calibration-version: "2026-q2"
  generated-at: "2026-05-06T00:00:00Z"
```

## Validation Integration

Conventions are designed to be compatible with existing validation tooling:

- `scripts/validate-agents.js` supports the `metadata` frontmatter key
- `scripts/validate-orchestrator-dispatch.js` validates specialist dispatch contracts
- `.github/workflows/validate-orchestrator-contracts.yml` enforces contract checks in CI

## Adoption Strategy

1. Add metadata to orchestrators first (`dispatch-contract: required`).
2. Add metadata to high-traffic skills (scoring, scanning, compliance).
3. Expand metadata coverage incrementally during normal edits to avoid large refactor risk.
4. Keep metadata values stable and update only on semantic changes.
