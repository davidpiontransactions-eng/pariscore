# WIKI-SCHEMA — PariScore LLM Wiki

> Configuration document for the Karpathy LLM Wiki pattern applied to PariScore.
> **Source pattern:** https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
> **Maintainer:** Claude Opus 4.7 (1M context) + David (DG curates sources + directs analysis)
> **Last review:** 2026-05-22

---

## 1. THREE-LAYER ARCHITECTURE

| Layer | Path | Role | Mutability |
|---|---|---|---|
| **Raw sources** | `.context/audits/`, `.context/strategy/`, `.context/sessions/`, `.context/specs/`, `dataset_*.json`, BSD MCP probes, gist fetches | Immutable — never edit. Append-only. | Read-only |
| **Wiki** | `.context/wiki/` | LLM-synthesized markdown entity/concept/feature/decision pages with cross-refs. Compounds over time. | Read/Write by LLM |
| **Schema** | `.context/wiki/WIKI-SCHEMA.md` (this file) | Defines structure, templates, naming, workflows. | Read/Write — humans + LLM |

---

## 2. THREE OPERATIONS

### Ingest
**Trigger:** user provides new source (URL, file, dataset, decision, bd ticket update).
**Steps:**
1. Read source fully. Extract entities, concepts, decisions touched.
2. For each touched page (typically 5-15): apply diff via Edit, never full rewrite unless restructure.
3. Add cross-refs `[[entity-slug]]` to related pages.
4. Append entry to `log.md` (date + source + pages touched + summary 1-line).
5. If source introduces new entity/concept → create new page from template (section 5).

### Query
**Trigger:** user asks a question OR I need context for code/decision.
**Steps:**
1. `Grep` wiki first (entities/concepts/features/decisions). NOT raw sources.
2. Synthesize answer from wiki pages, citing `[[page-name]]`.
3. If finding is non-trivial → file back as page update OR new page.
4. If contradiction detected vs current wiki state → flag in answer, propose patch.

### Lint
**Trigger:** periodic (every ~10 ingest ops) OR user explicit `/lint`.
**Steps:**
1. Scan all wiki pages for: orphan pages (no incoming `[[link]]`), broken `[[link]]` references, contradictions across pages, last-update >90d on `status: active` pages, missing required frontmatter fields.
2. Output report in `log.md` under `## LINT YYYY-MM-DD` heading.
3. Propose patches; don't auto-apply destructive changes without user OK.

---

## 3. PAGE TYPES

| Type | Dir | Purpose |
|---|---|---|
| `entity` | `entities/` | External org/vendor/API/dataset/tool (BSD, Sofascore, Stripe, ESPN, Apify, etc) |
| `concept` | `concepts/` | Math model, algorithm, UX pattern, abstract idea (Poisson, Elo, Edge no-vig, Power Score) |
| `feature` | `features/` | Product feature (Live Dashboard, Modal Insights, Mes Paris, Mobile PWA) |
| `decision` | `decisions/` | ADR-style decision record (Zero-dep Node, SQLite WAL, BSD Addon, etc) |
| `infra` | (top-level) | `index.md`, `log.md`, `WIKI-SCHEMA.md` |

---

## 4. NAMING CONVENTIONS

- **Slug:** lowercase, kebab-case, no accents, no spaces. Ex: `bsd-bzzoiro`, `poisson-bivarie`, `modal-insights`.
- **Filename:** `<slug>.md` in appropriate dir.
- **Cross-ref:** `[[<slug>]]` — resolves relative to wiki root via type prefix when ambiguous (`[[entity:bsd-bzzoiro]]`).
- **Title (H1):** human-readable, capitalized — `# BSD (Bzzoiro Sports)`.

---

## 5. PAGE TEMPLATE (required frontmatter + sections)

```markdown
---
type: entity | concept | feature | decision
slug: <kebab-case-slug>
title: Human Readable Title
status: active | deprecated | research | bloqued
tags: [tag1, tag2]
updated: YYYY-MM-DD
sources: [path/to/source1.md, https://url]
xref: [[other-slug-1]], [[other-slug-2]]
bd: <bd-id> (if linked to beads ticket)
---

# <Title>

**TL;DR:** one-line summary.

## Context
Why this exists / what problem it addresses in PariScore.

## Details
Substance: API endpoints, math formulas, code locations, file:line refs, costs, gotchas.

## Code locations
- `server.js:1234-1300` — main fetcher
- `pariscore.html:5678` — UI render

## Open questions / gaps
List unknowns to investigate.

## Related
- [[xref-1]]
- [[xref-2]]

## Changelog
- YYYY-MM-DD: initial creation from <source>
- YYYY-MM-DD: updated <section> after <event>
```

---

## 6. INGEST PROTOCOL — MAPPING RAW → WIKI

| Raw source pattern | Target page(s) |
|---|---|
| `.context/audits/audit-<X>.md` | entity or feature page for X + log.md entry |
| `.context/strategy/<X>.md` | decision page or concept page |
| `.context/rapport-<X>.md` | entity or feature page synthesis |
| `dataset_<vendor>_*.json` | entity page for vendor + describe shape/coverage |
| `bd show <id>` ticket | feature/concept page if scope >2h, else log.md entry |
| Code commit (server.js/pariscore.html) | update affected entity/feature/concept pages + log.md |
| Gist/external URL fetch | reference frontmatter `sources:` field + content synthesis in body |

---

## 7. CROSS-REFERENCING RULES

- **Always** link entity → vendor/source. Ex: `flashscore-livestream` ETL page → `[[flashscore]]` + `[[apify]]`.
- **Always** link feature → underlying concepts. Ex: `live-dashboard-cockpit` → `[[live-intensity]]` + `[[momentum]]` + `[[win-prob]]`.
- **Always** link decision → entities/concepts impacted.
- **Prefer** bidirectional links — when adding `A → B`, also append `B → A` in B's `## Related`.

---

## 8. INDEX.md MAINTENANCE

`index.md` is the catalog. When creating a new wiki page:
1. Add line under correct category section.
2. Format: `- [[<slug>]] — one-line description (status badge)`.
3. Keep alphabetical within each category.

---

## 9. LOG.md MAINTENANCE

Append-only timeline. Entry format:
```
## YYYY-MM-DD HH:MM — <OPERATION> — <source>
Pages touched: [[page1]], [[page2]], [[page3]]
Summary: 1-2 lines.
```

Never edit past entries. New session = new heading day.

---

## 10. PARISCORE-SPECIFIC NOTES

- **Source of truth tâches** = `bd ready` (beads). Wiki documents WHY/WHAT/HOW; bd tracks STATE.
- **CLAUDE.md** = pilote dashboard (current snapshot), NOT canonical. Wiki = canonical evolving knowledge.
- **`.context/` already 165 .md** — most are audit reports + research, treat as raw sources. Migrate insights progressively, never delete.
- **Caveman mode active** — wiki content written normal (code/markdown), user-facing responses caveman.

---

## 11. WHAT NOT TO WIKI

- Code patterns derivable from grep'ing repo.
- Git history (use `git log`).
- Ephemeral debug state (use bd notes or session logs).
- Anything in CLAUDE.md that mirrors bd state.

Keep wiki: durable, cross-domain, synthesizing knowledge that compounds value.
