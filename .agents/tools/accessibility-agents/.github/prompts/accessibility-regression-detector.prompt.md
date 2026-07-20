---
name: accessibility-regression-detector
description: Detect accessibility regressions — compare current state against baseline audit
mode: agent
agent: accessibility-regression-detector
tools:
  - askQuestions
  - readFile
  - search
  - runInTerminal
---

# Accessibility Regression Detection

Compare the current accessibility state against a baseline audit report to detect regressions, track remediation progress, and classify issues.

## Input

**Baseline report:** `${input:baselineReport}`

## Instructions

1. Read the baseline audit report at the specified path
2. Identify the most recent audit report in the workspace to use as the current state (or run a fresh scan if none exists)
3. Compare findings between baseline and current, classifying each issue as New, Fixed, Persistent, or Regressed
4. Calculate the overall score delta and per-category score changes
5. If regressions are found, use git history to identify which commits introduced them
6. Generate a regression summary with score trends, issue counts by classification, and remediation priorities
7. Flag any Regressed issues (previously fixed, now returned) as highest priority
