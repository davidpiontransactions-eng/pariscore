---
name: pdf-remediator
description: Fix accessibility issues in a PDF document. Generates programmatic fix scripts (pdf-lib/qpdf/ghostscript) and step-by-step Adobe Acrobat Pro instructions for issues that require manual intervention.
mode: agent
tools:
  - askQuestions
---

# PDF Accessibility Remediation

Fix accessibility issues in the PDF document at the path below using the **pdf-remediator** agent.

## Document to remediate

**Path:** `${input:documentPath}`

## Instructions

1. Check for an existing audit report (`DOCUMENT-ACCESSIBILITY-AUDIT.md`) — if none exists, run `pdf-accessibility` first
2. Classify all findings into **auto-fixable** (script-based via pdf-lib/qpdf/ghostscript) and **manual** (Adobe Acrobat Pro required)
3. Present the classification table to the user and ask which category to address
4. For auto-fixable issues: generate a shell script, review with user, create backup, execute
5. For manual issues: provide step-by-step Acrobat Pro instructions with exact menu paths
6. Verify results and recommend re-scanning after all fixes are applied
