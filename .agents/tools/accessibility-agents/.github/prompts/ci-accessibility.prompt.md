---
name: ci-accessibility
description: Set up, manage, or troubleshoot accessibility CI/CD pipelines
mode: agent
agent: ci-accessibility
tools:
  - askQuestions
  - readFile
  - runInTerminal
  - search
---

# CI/CD Accessibility Pipeline Manager

Help the user set up, manage, or troubleshoot automated accessibility scanning in their CI/CD pipeline.

## Input

**Task:** `${input:task}`

## Instructions

1. Identify the CI platform from repository config files (`.github/workflows/`, `azure-pipelines.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/config.yml`)
2. Based on the task, either generate new pipeline config, update existing config, or diagnose issues
3. For new setups, include axe-core CLI installation, WCAG 2.x tag filtering, and SARIF output where supported
4. Configure baseline management so only new regressions fail the build
5. Set up appropriate severity thresholds: block on critical/serious, warn on moderate/minor
6. Add PR annotations if the platform supports them
7. Validate the configuration with a dry-run explanation before committing changes
