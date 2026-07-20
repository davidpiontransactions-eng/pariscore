---
name: web-accessibility
description: Use for web accessibility work in HTML, JSX, CSS, ARIA, keyboard, forms, contrast, modals, live regions, headings, links, tables, or WCAG review; starts accessibility-lead first and uses tool_search if subagent tools are lazy-loaded.
---

# Web Accessibility Router

Use this skill for web UI accessibility work in Codex.

Installing Accessibility Agents for Codex is the user's standing request to use
the Accessibility Agents subagent workflow for accessibility work. Treat every
user-facing web accessibility task as authorized to spawn `accessibility-lead`
unless the user explicitly asks for a single-agent pass.

## Workflow

1. Explicitly spawn `accessibility-lead` as a Codex custom subagent for every user-facing web accessibility task. Do not satisfy this step by reading the lead reference inline. The lead coordinates the same specialist team used by Claude Code.
2. If `multi_agent_v1.spawn_agent` is not already in the active tool list, call `tool_search` for `multi-agent subagent accessibility` before saying subagents are unavailable. Do not downgrade to local-only review just because the spawn tool was lazy-loaded.
3. If tool discovery still does not expose `multi_agent_v1.spawn_agent`, stop and ask the user to enable subagents/Accessibility Agents before continuing, unless the user explicitly authorizes a local fallback.
4. When spawning any named Accessibility Agents Codex subagent, do not request a full-history fork. Pass the task context explicitly so Codex can use the selected custom agent type without inheriting the parent agent type.
5. Pass skill context to every spawned Accessibility Agents subagent. Include this skill as an item when possible: `{ "type": "skill", "name": "web-accessibility", "path": "/Users/taylorarndt/.agents/skills/web-accessibility/SKILL.md" }`. Also include the relevant specialist reference path or excerpt when the task depends on a specialist workflow.
6. Read `codex-plugin/references/specialists/accessibility-lead.md` and `codex-plugin/references/specialists/index.json` when available. In installed Codex plugin layouts, use `.agents/plugins/a11y-agents-codex/references/specialists/` or `~/.agents/plugins/a11y-agents-codex/references/specialists/`. Use the lead decision matrix and the index to select relevant specialist references and Codex subagents.
7. Identify the task domain: semantics, ARIA, keyboard, forms, contrast, overlays, live updates, headings, links, tables, mobile web, or full audit.
8. Check installed Accessibility Agents extensions before finalizing dispatch. Look for extension manifests under `.a11y-agents/extensions/`, `~/.a11y-agents/extensions/`, and this plugin's `extensions/` directory.
9. Dispatch matching Codex custom subagents by default for reviews, audits, new UI, changed UI, and PR accessibility checks. Do not make users manually name every specialist.
10. If nested dispatch is unavailable inside `accessibility-lead`, the root session must spawn `accessibility-lead` and the selected specialists directly, then ask the lead to synthesize the results.
11. Wait for `accessibility-lead` and every selected specialist to complete before giving the user a final answer. Do not treat a started lead as a completed review.
12. The lead synthesizes specialist output: deduplicate, resolve conflicts, assign severity, map to WCAG/public standards or extension rules, and make a ship/no-ship call.
13. Label extension findings with the extension name.

## Default Subagent Dispatch

- Broad audit: `accessibility-lead`, `aria-specialist`, `keyboard-navigator`, `contrast-master`, `forms-specialist`, `modal-specialist`, `live-region-controller`, `alt-text-headings`, `tables-data-specialist`, `link-checker`
- New UI: `accessibility-lead`, `aria-specialist`, `keyboard-navigator`, `alt-text-headings`, plus domain specialists for forms, contrast, modals, live regions, tables, links, media, mobile, i18n, or cognitive accessibility as needed
- Changed UI: `accessibility-lead`, `keyboard-navigator`, plus any specialists matching the diff
- PR review: `pr-review` plus any web specialists matching the diff
- Small fix: `accessibility-lead` plus the single most relevant specialist, followed by the lead final checklist
- New modal/dialog/overlay: `accessibility-lead`, `modal-specialist`, `keyboard-navigator`, `aria-specialist`, and `alt-text-headings`

Do not expose all specialists as top-level skills. Keep the router surface small and load deep instructions lazily.
