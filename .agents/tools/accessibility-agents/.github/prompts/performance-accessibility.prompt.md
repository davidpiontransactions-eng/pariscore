---
name: performance-accessibility
description: Audit performance-accessibility intersection — lazy loading, skeleton screens, CLS, loading states
mode: agent
agent: performance-accessibility
tools:
  - askQuestions
  - readFile
  - search
---

# Performance Accessibility Audit

Audit the specified scope for accessibility issues at the intersection of web performance optimization and assistive technology compatibility.

## Input

**Scope:** `${input:scope}`

## Instructions

1. Identify the frontend framework and its lazy loading / code splitting patterns
2. Audit lazy-loaded images and content for preserved alt text and screen reader announcements
3. Check skeleton screens for `aria-hidden="true"` on placeholders and `aria-busy` on content regions
4. Assess Cumulative Layout Shift impact on focused elements and screen reader reading position
5. Review route-level code splitting for accessible loading indicators and focus management
6. Check infinite scroll for a keyboard-accessible alternative (e.g., "Load more" button)
7. Verify core content and navigation work with JavaScript disabled (progressive enhancement)
8. Report findings with WCAG criterion references and remediation guidance
