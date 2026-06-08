# tools/docker — dockerized dev tools

Two tools installed as Docker containers (Docker Desktop on Windows):

| Tool | What | Dir |
|------|------|-----|
| **Scrapy** | Web crawling/scraping framework (`scrapy/scrapy`) | `scrapy/` |
| **Hermes Agent** | NousResearch LLM agent (`NousResearch/hermes-agent`) + local **Ollama** (zero API key) | `hermes/` |

> `hermes-agent/` (the cloned upstream repo) and Ollama model data are **gitignored** — only the compose/Dockerfile/config we authored is committed. Re-clone hermes with:
> `git clone --depth 1 https://github.com/NousResearch/hermes-agent.git tools/docker/hermes-agent`

---

## Scrapy

Stateless CLI in a container. Your spiders/projects live in `scrapy/project/` (mounted, persisted on host).

```bash
# build (once)
docker compose -f tools/docker/scrapy/docker-compose.yml build

# version check
docker compose -f tools/docker/scrapy/docker-compose.yml run --rm scrapy

# create a project + crawl
docker compose -f tools/docker/scrapy/docker-compose.yml run --rm scrapy scrapy startproject demo
docker compose -f tools/docker/scrapy/docker-compose.yml run --rm scrapy sh -c "cd demo && scrapy genspider quotes quotes.toscrape.com"
docker compose -f tools/docker/scrapy/docker-compose.yml run --rm scrapy sh -c "cd demo && scrapy crawl quotes -o /work/demo/out.json"
```

Output files land in `tools/docker/scrapy/project/` on the host.

---

## Hermes Agent (+ Ollama, local, no API key)

Stack = `ollama` (serves the model) + `gateway` (hermes runtime) + `dashboard` (web UI on `:9119`).
Model config: `%USERPROFILE%\.hermes\config.yaml` → points hermes at `http://ollama:11434/v1`.

```bash
# start the stack (pulls images)
docker compose -f tools/docker/hermes/docker-compose.yml up -d

# pull a model into ollama (default config expects llama3.2:3b ~2GB)
docker compose -f tools/docker/hermes/docker-compose.yml exec ollama ollama pull llama3.2:3b

# dashboard (config, API keys, model picker)
#   http://127.0.0.1:9119

# talk to hermes CLI inside the container
docker compose -f tools/docker/hermes/docker-compose.yml exec gateway hermes --help
docker compose -f tools/docker/hermes/docker-compose.yml exec gateway hermes model    # interactive model picker

# logs / stop
docker compose -f tools/docker/hermes/docker-compose.yml logs -f gateway
docker compose -f tools/docker/hermes/docker-compose.yml down
```

### Swap the model
Pull it, then edit `model.default` in `%USERPROFILE%\.hermes\config.yaml`:
```bash
docker compose -f tools/docker/hermes/docker-compose.yml exec ollama ollama pull qwen2.5:7b
# then set model.default: "qwen2.5:7b" and: docker compose ... restart gateway
```
Bigger models = better agentic behaviour but more RAM/VRAM. `llama3.2:3b` is the light default to prove the install.

### Use a cloud provider instead of Ollama
Edit `%USERPROFILE%\.hermes\config.yaml`:
```yaml
model:
  default: "anthropic/claude-..."   # or any OpenRouter model
  provider: "auto"
  base_url: "https://openrouter.ai/api/v1"
```
Set the key via the dashboard (`:9119`) or `hermes` CLI, then `docker compose ... restart gateway`.

---

## Security notes
- Dashboard binds `127.0.0.1` only (stores keys) — never expose on LAN without auth.
- Ollama port `11434` bound to `127.0.0.1`.
- No secrets committed; `.hermes/config.yaml` lives in your home dir, not the repo.
