---
name: i18n-accessibility
description: Audit internationalization accessibility — lang attributes, dir, RTL, bidirectional text
mode: agent
agent: i18n-accessibility
tools:
  - askQuestions
  - readFile
  - search
---

# i18n Accessibility Audit

Audit the specified scope for internationalization-related accessibility issues including language identification, text direction, and bidirectional content handling.

## Input

**Scope:** `${input:scope}`

## Instructions

1. Identify all languages and text directions used in the target content
2. Validate `<html lang>` is present and uses a correct BCP 47 tag
3. Check inline content in a different language for `lang` attribute wrappers (WCAG 3.1.2)
4. Audit `dir` attributes for correctness on RTL and mixed-direction content
5. Review form fields for logical tab order in mixed-direction layouts
6. Check icons and directional UI elements for correct RTL mirroring
7. Report findings with WCAG criterion references and remediation guidance
