---
name: screen-reader-lab
description: Simulate screen reader behavior on a file for education and debugging
mode: agent
agent: screen-reader-lab
tools:
  - askQuestions
  - readFile
---

# Screen Reader Lab — Interactive Simulation

Simulate how a screen reader would navigate and announce the content of a file.

## Input

**File to simulate:** `${input:filePath}`

## Instructions

1. Read the specified file and parse the HTML or JSX content
2. Ask which navigation mode to simulate:
   - **Reading order** — Sequential traversal of all content
   - **Tab navigation** — Interactive elements only (Tab key)
   - **Heading navigation** — Jump between headings (H key)
   - **Form navigation** — Jump between form controls (F key)
3. Build an accessibility tree from the markup
4. Walk through each stop in the selected mode, outputting what a screen reader would announce (role, name, state, value)
5. Flag any issues found: missing labels, skipped headings, focus traps, incorrect ARIA
6. Remind the user that this is an approximation and real screen reader testing is still required
