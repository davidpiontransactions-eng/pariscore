---
name: web-component-specialist
description: Audit web component accessibility — Shadow DOM, ElementInternals, ARIA delegation
mode: agent
agent: web-component-specialist
tools:
  - askQuestions
  - readFile
  - search
---

# Web Component Accessibility Audit

Audit the specified web component for Shadow DOM accessibility, ElementInternals usage, and cross-shadow ARIA delegation.

## Input

**Component path:** `${input:componentPath}`

## Instructions

1. Read the component source and identify shadow DOM mode (open/closed) and framework (Lit, Stencil, FAST, vanilla)
2. Check if the component uses `ElementInternals` for role, accessible name, and states
3. Audit cross-shadow ARIA references — verify `id`-based references are not broken by shadow boundaries
4. Review slot-based composition for correct accessible tree ordering
5. If form-associated, validate `formAssociated`, label association, and form participation
6. Check `delegatesFocus` and keyboard interaction within the shadow root
7. Report findings with remediation guidance and code examples
