# Loop Budget — Pariscore

> Budget tokens et limits pour les agents et MCP servers.
> Basé sur les patterns loop-engineering.

## Daily Limits

### Agents

| Agent | Max runs/day | Max tokens/run | Max sub-agent spawns/run |
|-------|--------------|----------------|--------------------------|
| opencode (main) | ∞ | 500k | 3 |
| cline | ∞ | 300k | 2 |
| zcode | ∞ | 400k | 2 |

### MCP Servers

| Server | Max calls/day | Max tokens/call | Notes |
|--------|---------------|-----------------|-------|
| project_fs | ∞ | 10k | Lecture/écriture fichiers |
| memory | 50 | 20k | Knowledge graph |
| git | 30 | 15k | Opérations structurées |
| playwright | 20 | 50k | Automatisation navigateur |
| scrapling | 10 | 100k | Scraping anti-bot |
| scrapy | 5 | 200k | Crawling massif |
| crawl4ai | 10 | 80k | Scraping web |
| bzzoiro-sports | 30 | 30k | Données sportives |
| sportdbdotdev | 30 | 30k | SportDB |
| sportradar | 20 | 40k | Sportradar |
| frontendchecklist | 10 | 25k | Audit frontend |
| stitch | 5 | 60k | Design → code |

### Workflows

| Workflow | Max runs/day | Max tokens/day | Max sub-agent spawns/run |
|----------|--------------|----------------|--------------------------|
| Scraping OddAlerts | 2 | 0 (no LLM) | 0 |
| Betting Analysis | 10 | 200k | 0 |
| QA APK | 1 | 300k | 2 |
| Code Review | 5 | 150k | 1 |
| bd triage | 3 | 100k | 0 |
| Feature Implementation | 3 | 400k | 2 |
| Bug Fix | 5 | 250k | 1 |

## Token Estimation

### By Model

| Model | Input tokens/1k chars | Output tokens/1k chars | Cost/1M tokens |
|-------|----------------------|------------------------|----------------|
| Claude 3.5 Sonnet | ~250 | ~250 | $3.00 / $15.00 |
| Claude 3 Opus | ~250 | ~250 | $15.00 / $75.00 |
| GPT-4o | ~250 | ~250 | $2.50 / $10.00 |
| Gemini 1.5 Pro | ~250 | ~250 | $1.25 / $5.00 |

### Common Operations

| Operation | Estimated tokens |
|-----------|------------------|
| Read 1 file (1k lines) | 4k input |
| Edit 1 file (10 changes) | 8k input + 2k output |
| Grep search | 2k input |
| Full codebase scan | 50k input |
| Betting analysis | 20k input + 5k output |
| Code review (1 PR) | 30k input + 10k output |
| Feature implementation | 40k input + 20k output |

## On Budget Exceed

1. **Pause schedulers** — Disable high-cadence workflows
2. **Append event** — Log to `loop-run-log.md`
3. **Open maintainer issue** — Report via `bd`

```bash
# Vérifier l'usage actuel
cat loop-run-log.md | jq 'select(.date > (now - 86400)) | .tokens_estimate' | jq -s 'add'
```

## Kill Switch

- **Label**: `pariscore-pause-loops`
- **Env var**: `LOOP_PAUSE=true`
- **Resume only after cleared in STATE.md**

```bash
# Pause all loops
export LOOP_PAUSE=true
echo "LOOP_PAUSE=true" >> .env.local

# Resume
unset LOOP_PAUSE
sed -i '/LOOP_PAUSE=true/d' .env.local
```

## Cost Estimation

### Daily Average (estimated)

| Component | Tokens/day | Cost/day |
|-----------|------------|----------|
| opencode sessions | 200k | $1.50 |
| MCP servers | 50k | $0.25 |
| Workflows | 100k | $0.75 |
| **Total** | **350k** | **$2.50** |

### Monthly Projection

| Scenario | Tokens/month | Cost/month |
|----------|--------------|------------|
| Light (1h/day) | 3M | $22 |
| Normal (3h/day) | 10M | $75 |
| Heavy (8h/day) | 25M | $188 |

## Recommendations

1. **Prefer L1 loops** — Report-only uses minimal tokens
2. **Batch operations** — Group related file edits
3. **Use Grep/Glob** — Before reading files (cheaper)
4. **Cache results** — Reuse previous analysis in same session
5. **Kill switch** — Always available if costs spike
