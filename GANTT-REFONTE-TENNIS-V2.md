# GANTT Refonte Tennis — Sprint 20-30/07 — Affectations Agent/Skill/MCP

> **Date** : 2026-07-20
> **Branche** : `refonte-tennis-v2`
> **Méthode** : dispatch parallèle d'agents dédiés, chacun avec un brief précis
> (rôle + skill + cible + contexte technique)
> **Livrables visuels** : `gantt-refonte-tennis-v2.json` + `gantt-refonte-tennis-v2.svg`

---

## 🎯 Matrice d'affectation (résumée)

| Phase | Tâches | Agent principal | Skill | MCP |
|---|---|---|---|---|
| **P0 Setup** | 4 | main-orchestrator + ui-designer | impeccable, hallmark, visual-regression, sketch-findings-pariscore | playwright |
| **P1 CRITICAL** 🔴 | 6 | frontend-developer + main-orchestrator | react-component-design, shadcn-ui, frontend-design, systematic-debugging | context7, chrome-devtools |
| **P2 live-stats** 🟠 | 4 | frontend-developer | tufte-data-viz, shadcn-ui, refactoring-agent | context7 |
| **P3 premium live** 🟡 | 5 | frontend-developer + accessibility-tester | tufte-data-viz, motion-framer, accessibility, react-utility-snippets | echarts, context7 |
| **P4 prematch** 🟠 | 5 | frontend-developer + accessibility-tester | shadcn-ui, react-nextjs-patterns, refactoring-agent | context7 |
| **P5 polish** | 7 | main-orchestrator + ui-designer + accessibility-tester + test-engineer + web-performance-auditor | impeccable, hallmark, visual-regression, webapp-testing, e2e-testing, core-web-vitals | playwright, frontendchecklist, lighthouse, chrome-devtools |
| **P6 deploy** | 4 | main-orchestrator | executing-plans, ps-deploy, verification-before-completion, ps-changelog | chrome-devtools, browser-tools, git |

---

## 📋 Détail par phase

### P0 — Setup & audit (20-21/07)

| # | Tâche | Agent | Skill | MCP |
|---|---|---|---|---|
| P0.1 | Audit impeccable composants tennis | main-orchestrator | `impeccable` (audit) | — |
| P0.2 | Audit anti-AI-slop | main-orchestrator | `hallmark` | — |
| P0.3 | Screenshots 'avant' | main-orchestrator | `visual-regression` | playwright |
| P0.4 | Aligner palette DESIGN_CHARTER | ui-designer | `sketch-findings-pariscore` | — |

### P1 — Fixes CRITICAL 🔴 (21/07) — **EN COURS**

| # | Tâche | Agent | Skill | MCP |
|---|---|---|---|---|
| P1.1 | `SetScoreline.tsx` (6-4 6-3 3-2) | frontend-developer | react-component-design + shadcn-ui + frontend-design | context7 |
| P1.2 | `CurrentGameScore.tsx` (15/30/40/AD) | frontend-developer | react-component-design | context7 |
| P1.3 | `ServerIndicator.tsx` (icône tennis) | frontend-developer | react-component-design | — |
| P1.4 | Intégrer 3 composants dans match-card-header | frontend-developer | react-nextjs-patterns | chrome-devtools |
| P1.5 | Fix i18n date match-card-header.tsx:53 | main-orchestrator | react-nextjs-patterns | — |
| P1.6 | Fix bug labels set momentum-dr.tsx | main-orchestrator | systematic-debugging | chrome-devtools |

### P2 — Refonte live-stats-panel 🟠 (22-23/07)

| # | Tâche | Agent | Skill | MCP |
|---|---|---|---|---|
| P2.1 | `ServeStatsBars.tsx` (1st in%, won%, 2nd won%) | frontend-developer | tufte-data-viz + shadcn-ui | context7 |
| P2.2 | `BreakPointsGrid.tsx` (set-par-set 2/3) | frontend-developer | tufte-data-viz | — |
| P2.3 | `SetBySetTable.tsx` (Sofascore-like) | frontend-developer | shadcn-ui + react-patterns | — |
| P2.4 | Supprimer 4 ServiceCircle (redondants) | frontend-developer | refactoring-agent | — |

### P3 — Nouveaux composants live premium 🟡 (24-26/07)

| # | Tâche | Agent | Skill | MCP |
|---|---|---|---|---|
| P3.1 | `WinProbabilityChart.tsx` (ECharts) | frontend-developer | tufte-data-viz + motion-framer | echarts |
| P3.2 | `PointTimeline.tsx` (PBP) | frontend-developer | tufte-data-viz | — |
| P3.3 | `StatsRadarChart.tsx` (shadcn Radar) | frontend-developer | tufte-data-viz + shadcn-ui | context7 (Recharts Radar) |
| P3.4 | Refonte momentum-dr.tsx (typo ≥11px, ARIA, 5 sets) | frontend-developer | react-component-design + accessibility | — |
| P3.5 | `useAnnouncer` / `<LiveRegion>` (a11y) | accessibility-tester | react-utility-snippets + accessibility | — |

### P4 — Refonte prematch 🟠 (26-27/07)

| # | Tâche | Agent | Skill | MCP |
|---|---|---|---|---|
| P4.1 | `LastMatchesList.tsx` (10 derniers matchs) | frontend-developer | shadcn-ui + react-patterns | — |
| P4.2 | Migrer `<img>` → next/image | frontend-developer | react-nextjs-patterns | context7 (next/image) |
| P4.3 | Fusionner match-card-detail ↔ stats-indicators-grid | frontend-developer | refactoring-agent | — |
| P4.4 | Restaurer tooltip SPS (lazy mount) | frontend-developer | react-component-design | — |
| P4.5 | Fix probability-bar + odds-comparator a11y | accessibility-tester | accessibility + best-practices | — |

### P5 — Polish & validation (28-29/07)

| # | Tâche | Agent | Skill | MCP |
|---|---|---|---|---|
| P5.1 | impeccable polish (micro-interactions) | ui-designer | impeccable (polish) + motion-framer | — |
| P5.2 | hallmark audit final | main-orchestrator | hallmark | — |
| P5.3 | visual-regression screenshots 'après' + diff | main-orchestrator | visual-regression | playwright |
| P5.4 | Audit a11y (axe-core, WCAG 2.2) | accessibility-tester | accessibility | frontendchecklist |
| P5.5 | Tests Playwright pérennes `tests/` | test-engineer | webapp-testing + e2e-testing | playwright |
| P5.6 | i18n complet (FR hardcodés → namespace tennis) | frontend-developer | react-nextjs-patterns | — |
| P5.7 | Core Web Vitals (LCP/INP/CLS) | web-performance-auditor | core-web-vitals + performance | lighthouse + chrome-devtools |

### P6 — Déploiement (30/07)

| # | Tâche | Agent | Skill | MCP |
|---|---|---|---|---|
| P6.1 | bun run build + node --check | main-orchestrator | executing-plans | — |
| P6.2 | Deploy VPS + pm2 restart | main-orchestrator | ps-deploy | — |
| P6.3 | Vérif prod (0 pageerror, 0 console.error) | main-orchestrator | verification-before-completion | chrome-devtools + browser-tools |
| P6.4 | bd close + bd remember + CHANGELOG | main-orchestrator | ps-changelog | git |

---

## 🤖 Rôles des agents (clarification)

| Agent | Source | Rôle dans la refonte |
|---|---|---|
| **main-orchestrator** | (toi, agent principal) | Coordination, debugging, audits, deploy |
| **frontend-developer** | VoltAgent | Exécutant frontend senior (création composants React) |
| **ui-designer** | VoltAgent | Exécutant design (polish, palette, micro-interactions) |
| **design-bridge** | VoltAgent | Traduction DESIGN.md ↔ code (Phase 0.4) |
| **accessibility-tester** | VoltAgent | Audit a11y WCAG 2.2 |
| **test-engineer** | opencode (déjà installé) | Tests E2E Playwright |
| **web-performance-auditor** | opencode (déjà installé) | Core Web Vitals + perf |

---

## 📊 Tracking temps réel

**Status Phase 1** : 🟡 EN COURS (2 agents dispatchés en parallèle)

| Agent | Tâche | Status |
|---|---|---|
| `frontend-developer` | P1.1 + P1.2 + P1.3 + P1.4 (3 composants + intégration) | 🟡 running |
| `main-orchestrator` | P1.5 + P1.6 (fix i18n + bug momentum) | 🟡 running |

**Prochaine étape** : attendre les 2 agents, valider leur livrables (tsc), puis
dispatch Phase 2.
