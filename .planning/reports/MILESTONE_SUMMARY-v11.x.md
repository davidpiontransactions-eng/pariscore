# MILESTONE SUMMARY — PariScore v11.x

> **Period** : 2026-05-20 (1 day, intensive sprint)
> **Versions** : v11.0 → v11.13 (14 micro-releases)
> **Theme** : CYBER-FINTECH OVERLAY + Sprint 1 P0 + Audit rapports
> **Source artifacts** : `CHANGELOG.md` (lines 257-271), `bd` closed Sprint 1 epic + sub-tasks
> **Generated** : 2026-05-24

---

## 1. OVERVIEW

### Mission

Visual identity unification + tennis serving UX polish + filter persistence + QA validation. Bridge milestone between v10.x infrastructure consolidation (multi-sources + AF kill-switch) and v12.x innovation backlog (math edge + spike research).

### Strategic context

Post-v10.78 (API-Football fully removed, BSD primary), DG demanded **visual coherence** across Foot+Tennis tabs. v10.61-65 had patched desktop fragmentation reactively ; v11 milestone = **proactive overlay**, theme-agnostic, applied as cohesive system.

Parallel: Sprint 1 P0 epic `bd qbe` (CORE-TABS) shipped — Mode Dual + IC Corridor + Hero Value + Mobile Card. Tennis serving indicator polish (3D ball SVG + serving pulse). Filter persistence localStorage (filter profiles).

### Outcome

- Visual identity locked (CF overlay = signature aesthetic preserved through v12.x)
- Sprint 1 P0 complete (`qbe` epic closed)
- Tennis UX gaps closed (serving fallback `?` badge + 3D translucent balls hub)
- 2 rapports audit livrés (QA crash test + Design V2.0 read-only)

---

## 2. ARCHITECTURE

### CF Overlay design system

- **Theme-agnostic** : works on dark "data terminal" base + light blue oddsalert variant
- **Foot + Tennis** unified panels (consistent chip styling, badge geometry, color semantics)
- **Inline overlay layer** : no separate CSS file, scoped via `[data-theme]` selectors in `pariscore.html` inline `<style>`
- **Token-based** : prefix `--cf-*` (60 vars) + utility classes `.cf-u-*` (spacing, typography, color)

### Module touchpoints v11.x

| Locus | Change |
|---|---|
| `pariscore.html` inline `<style>` | +800 lines CF overlay rules + responsive ≥768px scope |
| `pariscore.html` tennis section | SVG 3D ball + serving pulse animation + AiScore servePos parser |
| `pariscore.html` localStorage `tn_filter_profiles` | Filter profile persistence (UI-012) |
| `pariscore.html` `#page-matchs` table | Hero Value Cell + IC Corridor inline + Mode Dual toggle |
| `server.js` BSD prediction `surface_id` | Country mapping fix Conmebol/Concacaf/UEFA/CAF/AFC/FIFA |
| `server.js` Odds API fetcher | Predictive rate-limit guard (avoid quota burn) |
| `.context/` rapports | QA crash test + Design V2.0 read-only audit |

---

## 3. PHASES (micro-versions)

### v11.0 — Foundation
- CF overlay theme-agnostic scaffolded
- Variables `--cf-*` registered

### v11.1-v11.4 — Tennis serving UX
- v11.1-v11.2 — CF overlay Foot + Tennis dark trading panels applied
- v11.3 — Tennis ball SVG 3D + scoreboard serving indicator (pulse animation)
- v11.4 — Serving `?` badge fallback (when `is_serving_p1` null) + AiScore `servePos` parser

### v11.5-v11.8 — Sprint 1 P0 UI cluster
- v11.5 — **UI-009** Bet Score Gauge (radial 0-100 confidence)
- v11.6 — **UI-009 cont.** EV Heatmap (cells colored by EV bucket)
- v11.7 — **UI-011** Fatigue pastille (Δ days last match per team)
- v11.8 — **UI-017** Time-to-kickoff chip + **UI-018** 3D translucent balls hub cards

### v11.9 — Bug fix routing
- Fix country mapping bd `t8r` Copa Libertadores : Conmebol/Concacaf/UEFA/CAF/AFC/FIFA correctly mapped (était classé Arabie Saoudite)

### v11.10 — Quota protection
- Fix Odds API quota predictive rate-limit (avoid burst exhaustion 500 req/mo cap)

### v11.11 — UI-012 Filter persistence
- Profils filtres tennis sauvegardés localStorage
- Multiple named profiles (e.g., "ATP top tournaments", "Surface clay only")

### v11.12 — QA rapport
- Crash test audit Foot + Tennis (read-only)
- 28 risk flags identified → backlog v12.x

### v11.13 — Design V2.0 rapport
- Read-only Design System V2.0 evaluation
- Validates token unification + identifies drift (corrected v12.x)

---

## 4. DECISIONS (lock-ins)

1. **CF overlay theme-agnostic** : applied via `[data-theme]` selectors, NOT CSS class swap → both light + dark themes inherit overlay consistently
2. **3D translucent balls** : SVG inline (not PNG sprite) → resolution-independent + theme-colorable via `fill` currentColor pattern
3. **Filter profile persistence** : `localStorage` only (not synced backend) → privacy-first, no user account required for personalization
4. **Sprint 1 P0 scope freeze** : Mode Dual + IC Corridor + Hero Value + Mobile Card grouped under epic `qbe` — NOT split into separate epics (DG validated bundle)
5. **No CF refactor of mobile cards** (`.mc < 769px`) : v11 desktop-only, mobile cards intact → defer to V2 Mobile milestone (bd discussion 2026-05-24)
6. **Rapports read-only** : QA crash test + Design V2.0 NOT trigger code changes → backlog feed only, prevents scope creep mid-sprint

---

## 5. REQUIREMENTS (cumul implemented at v11.13)

| Requirement | Status |
|---|---|
| Visual identity unification (Foot+Tennis) | ✅ CF overlay |
| Sprint 1 P0 CORE-TABS epic | ✅ `bd qbe` closed |
| Hero Value Cell Foot | ✅ `bd 3ug` |
| IC Corridor inline VALUE cell | ✅ `bd l22` |
| Mode Dual [Trading]/[Analyse] toggle | ✅ `bd szt` |
| Mobile Card-View Tennis 6 KPI | ✅ `bd sv6` |
| Tennis serving indicator UX | ✅ v11.3 + v11.4 |
| Filter profile persistence | ✅ v11.11 UI-012 |
| Country mapping fix bd `t8r` | ✅ v11.9 |
| Bet Score Gauge + EV Heatmap | ✅ v11.5-v11.6 UI-009 |
| Fatigue pastille | ✅ v11.7 UI-011 |
| Time-to-kickoff chip | ✅ v11.8 UI-017 |
| 3D translucent balls hub | ✅ v11.8 UI-018 |
| QA crash test rapport | ✅ v11.12 (28 flags) |
| Design V2.0 audit rapport | ✅ v11.13 |

---

## 6. TECH DEBT (introduced + carry-over)

### Introduced v11.x

- CF overlay inline `<style>` adds +800 lines to already-large `pariscore.html` — extraction to separate CSS file deferred (HTTP/1.1 single roundtrip preserved)
- Filter profile persistence localStorage — no cross-device sync, no backup export (acceptable for v11, may need later)
- 28 risk flags from v11.12 QA rapport → feeds v12.x backlog (some fixed v12.65 like `8c5`, `k37`, `izsn`)

### Carry-over from v10.x (NOT fixed v11)

- Viewport desktop 1280px forced mobile (anti-pattern Mobile-First)
- 50 fragmented media queries
- No tests / no CI/CD
- Single-file SPA growing

---

## 7. GETTING STARTED (orient new contributor on v11 work)

### What v11 changed

If browsing `pariscore.html`:
- Search `--cf-` for overlay tokens
- Search `cf-u-` for utility classes
- Search `data-theme=` for theme-scoped overrides
- Search `tn_filter_profiles` for filter persistence logic
- Search `ball-svg` or `tennis-ball-3d` for serving indicator

### Reproduce v11 sprint workflow

```bash
# v11 used same bd-driven cycle (then-current)
bd ready
bd show qbe                     # epic CORE-TABS Sprint 1
bd update <sub-id> --claim
# edit pariscore.html (CF overlay scoped @media ≥769px)
node --check server.js          # syntax gate
git commit -m "feat(ui): bd <id> — UI-XXX description"
bd close <id>
```

### Key files to read v11 work

- [pariscore.html](pariscore.html) — search CF overlay (largest delta)
- [CHANGELOG.md:257-271](CHANGELOG.md:257) — v11.0-v11.13 entries
- `.context/rapport_qa_foot_tennis.md` — v11.12 28 risk flags
- bd `qbe` notes — Sprint 1 epic decisions
- bd `87d` notes — Design System V2.0 tokens centralization

---

## APPENDIX — v11 stats

| Metric | Value |
|---|---|
| Versions | 14 (v11.0 → v11.13) |
| Days | 1 (2026-05-20 intensive) |
| Lines added `pariscore.html` | ~800 (CF overlay) |
| bd epics closed | 1 (`qbe` CORE-TABS Sprint 1 P0) |
| bd sub-tasks closed | 6+ (UI-001 to UI-018 cluster) |
| UI features new | 6 (Bet Score Gauge, EV Heatmap, Fatigue pastille, Time-to-kickoff, 3D balls, Filter profiles) |
| Bug fixes | 2 (country mapping, Odds API rate-limit) |
| Rapports audit | 2 (QA crash test, Design V2.0) |

---

*Generated 2026-05-24. Adapted GSD milestone-summary template, PariScore artifacts (CHANGELOG / bd / `.context/` rapports).*
