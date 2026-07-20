---
name: wcag-aaa
description: Audit content against WCAG 2.2 Level AAA success criteria
mode: agent
agent: wcag-aaa
tools:
  - askQuestions
  - readFile
  - search
---

# WCAG 2.2 Level AAA Auditor

Audit web content against WCAG 2.2 Level AAA success criteria beyond the AA baseline.

## Input

**Scope to audit:** `${input:scope}`

## Instructions

1. Verify that the target content has been audited at AA level first; if not, recommend running an AA audit before proceeding
2. Identify the pages, components, or content areas within the provided scope
3. Evaluate each applicable AAA success criterion:
   - Enhanced contrast (7:1 normal text, 4.5:1 large text)
   - Extended audio descriptions (1.2.7)
   - Sign language (1.2.6)
   - Reading level (3.1.5)
   - Abbreviations (3.1.4)
   - Pronunciation (3.1.6)
   - Focus appearance enhanced (2.4.13)
   - Target size (2.5.5)
   - Context-sensitive help (3.3.5)
   - Error prevention for all inputs (3.3.6)
4. Report each finding with the WCAG criterion, severity, affected element, and remediation guidance
5. Prioritize findings by impact and feasibility
6. Note that full AAA conformance across an entire site is rarely expected; recommend targeting specific content areas
