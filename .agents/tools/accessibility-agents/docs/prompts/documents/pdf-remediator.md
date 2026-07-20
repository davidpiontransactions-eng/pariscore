# pdf-remediator

Guided PDF remediation using programmatic tools (pdf-lib, qpdf, ghostscript) and manual Adobe Acrobat Pro steps. Ask for one-click fixes or step-by-step instructions.

## When to Use It

- After a PDF accessibility audit reveals issues needing remediation
- When you need to fix PDF tags, reading order, or alt text programmatically
- When you want guided Adobe Acrobat Pro steps for manual fixes
- When converting scanned PDFs to tagged, accessible versions

## How to Launch It

**In GitHub Copilot Chat:**

```text
/pdf-remediator
```

Provide the file path when prompted. Or specify directly:

```text
/pdf-remediator C:\documents\annual-report.pdf
```

## What It Does

1. Opens the specified PDF and identifies the type of remediation needed
2. Categorizes issues into programmatic (auto-fixable) and manual
3. Generates scripts or step-by-step instructions for each fix category
4. Validates fixes after application

## Related

- [pdf-accessibility](../../agents/pdf-accessibility.md) — PDF scanning agent
- [audit-single-document](audit-single-document.md) — Full document audit
- [document-accessibility-wizard](../../agents/document-accessibility-wizard.md) — Guided audit
