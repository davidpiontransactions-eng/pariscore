# Accessibility Agents Extensions

Extensions let teams add their own accessibility standards without forking Accessibility Agents.

This directory contains the built-in Community Access extension packs used by the Codex plugin. These packs install automatically, but they are intentionally represented as extensions so third-party and company extensions can follow the same pattern.

## What an Extension Can Add

An extension can provide:

- Codex subagents
- specialist reference files
- trigger words and file patterns
- compliance profiles
- author metadata
- company or design-system rules
- regional or industry standards
- scanner mappings
- reporting guidance

Routers treat installed extensions as first-class contributors. When an extension matches the task domain, its agents can be included beside bundled core agents.

## Built-In Packs

- `core` - orchestration, WCAG education, testing guidance, and cross-cutting governance
- `web` - ARIA, keyboard, forms, contrast, modals, live regions, links, tables, media, and components
- `documents` - Office, PDF, EPUB, remediation, inventories, and document reports
- `markdown` - markdown scanning, fixing, reporting, and accessible documentation workflows
- `github` - PRs, issues, Actions, releases, projects, repositories, security, notifications, and wiki workflows
- `developer-tools` - Python, wxPython, desktop accessibility APIs, NVDA add-ons, scanner tooling, and CI accessibility

The built-in packs use `Community Access` as author metadata.

## Manifest Format

Each extension directory must include `extension.json`.

```json
{
  "name": "accessibility-agents-web",
  "displayName": "Web Accessibility Extension",
  "version": "6.0.0",
  "builtIn": true,
  "description": "Built-in web accessibility specialists for HTML, CSS, ARIA, keyboard, forms, modals, live regions, links, tables, media, and components.",
  "author": "Community Access",
  "domains": ["web"],
  "extensionPoints": ["agents", "references", "rules", "complianceProfiles"],
  "complianceProfiles": ["wcag-2.2-aa"],
  "agents": [
    {
      "name": "aria-specialist",
      "domains": ["web"],
      "path": "../../agents/aria-specialist.toml",
      "reference": "../../references/specialists/aria-specialist.md"
    }
  ]
}
```

Required fields:

- `name`
- `displayName`
- `version`
- `description`
- `author`
- `domains`
- `extensionPoints`

Most useful optional fields:

- `builtIn`
- `complianceProfiles`
- `agents`
- `rules`
- `references`
- `repository`
- `status`
- `visibility`

## Author Field

Use a simple author name. Do not require author URLs.

Built-in extensions use:

```json
"author": "Community Access"
```

Company extensions can use a team name:

```json
"author": "ACME Accessibility Team"
```

## Writing Extension Agents

An extension agent should say:

- when it applies
- which files, frameworks, or components it covers
- which standards or company policies it enforces
- what evidence it should collect
- how it reports findings
- whether it may edit files or only report findings

If a rule is company-specific, label it as company-specific. Do not describe private policy as WCAG unless it directly maps to a WCAG success criterion.

## Discovery Locations

The universal installer may install extension registries in these locations:

- Project scope: `.a11y-agents/extensions/`
- Global scope: `~/.a11y-agents/extensions/`
- Bundled Codex plugin scope: `codex-plugin/extensions/`

Each extension directory should include an `extension.json` manifest.

## Routing Rules

Router skills should consider extensions when:

- the extension domain matches the task
- trigger words match the prompt
- file patterns match changed files
- compliance profiles match the requested standard
- the user explicitly asks to include extensions

Extension findings should include:

- extension name
- rule or policy name when available
- whether the finding maps to a public standard
- file references and evidence
- remediation guidance

## Marketplace

Public extensions can be submitted to the Accessibility Agents Extension Marketplace.

The marketplace repository contains:

- `marketplace.json` registry
- built-in extension mirrors
- extension starter template
- validation scripts
- review documentation
- GitHub Actions checks

After a marketplace PR is merged, the Community Access website reads the registry and displays the extension with filters, details, manifest links, and optional GitHub repository links.

## Private Extensions

Private extensions should use the same manifest shape. They do not need a public repository and do not need marketplace submission.

Good candidates for private extensions:

- company design-system rules
- internal product standards
- private compliance mappings
- customer-specific documentation checks
- security-sensitive workflow guidance

## Validation

From the repository root:

```bash
node scripts/validate-codex-plugin.js
```

The validator checks that built-in extension manifests exist, parse as JSON, include required metadata, and reference valid built-in agent and reference files.

For the full extension authoring guide, see:

```text
docs/guides/accessibility-agent-extensions.md
```
