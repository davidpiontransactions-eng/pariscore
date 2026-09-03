# vLLM en local — rapport + intégration PariScore

> Source : https://github.com/vllm-project/vllm — lue le 2026-09-03 (README + quickstart).
> Licence : **Apache-2.0** (vérifiée). Origine : Sky Computing Lab, UC Berkeley. 2000+ contributeurs.

## C'est quoi (faits)

- Moteur d'**inférence/serving LLM** rapide : **PagedAttention** (papier SOSP'23),
  continuous batching, chunked prefill, prefix caching, CUDA/HIP graphs, speculative decoding.
- **200+ architectures HF** : Llama, Qwen, Gemma, Mixtral, DeepSeek-V3, Mamba, LLaVA/Qwen-VL,
  embeddings (E5, GTE, ColBERT), rerankers.
- Quantization : FP8, INT4/INT8, GPTQ/AWQ, GGUF, compressed-tensors, etc.
- **Serveur OpenAI-compatible** (`/v1/chat/completions`, `/v1/completions`, `/v1/models`),
  + API Anthropic Messages et gRPC. Structured outputs (xgrammar/guidance), tool calling.
- Pré-requis officiels : **OS Linux**, Python 3.10–3.13 (`uv pip install vllm`).
  GPU NVIDIA/AMD/Intel, CPU x86/ARM, Apple Silicon (vLLM-Metal), TPU/Gaudi/Ascend via plugins.
- Lancement canonique : `vllm serve Qwen/Qwen2.5-1.5B-Instruct` → `http://localhost:8000`.

## Pourquoi PAS installé ici (décision)

1. **Windows natif non supporté** par vLLM (Linux-only ; sur ce poste = WSL2 + CUDA ou Docker).
2. **GPU local insuffisant** : GTX 1050 (Pascal, ~2 Go VRAM) — juste assez pour un micro-modèle
   quantifié en test, pas pour servir les features IA PariScore en continu.
3. **Aucune dépendance à ajouter** : l'intégration est 100 % protocole (HTTP OpenAI-compatible),
   pas de paquet npm/pip dans le repo.

## PariScore : déjà compatible, 0 ligne de code

`src/lib/llm.ts` possède un helper générique `callOpenAICompatible()` (6 providers le partagent)
et un provider `local` dont les défauts **sont exactement ceux de vLLM** :

```env
LLM_PROVIDER=local
LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1
LOCAL_LLM_MODEL=Qwen/Qwen2.5-1.5B-Instruct
LOCAL_LLM_API_KEY=EMPTY
LLM_FALLBACK_ENABLED=true
```

`LLM_PROVIDER=local` → `callLocal()` → `${LOCAL_LLM_BASE_URL}/chat/completions`.
Avec `LLM_FALLBACK_ENABLED=true`, repli auto vers gemini/openrouter si le serveur local est down.
Bonus : structured outputs + tool calling de vLLM correspondent aux rapports JSON
(`gemini-insight`, `football-match-report`).

## Le jour où (machine Linux/WSL2 avec GPU sérieux)

```bash
uv venv --python 3.12 --seed
source .venv/bin/activate
uv pip install vllm --torch-backend=auto
vllm serve Qwen/Qwen2.5-1.5B-Instruct --host 0.0.0.0 --port 8000
curl http://localhost:8000/v1/models
```

Alternative Docker : `vllm/vllm-openai:latest` avec `--gpus all`.

## Opencode : provider local bon marché (à activer quand le serveur tourne)

Modèle : coût API nul, confidentialité totale, latence LAN. Snippet pour `.opencode/opencode.json`
(même pattern que `orcarouter`, via `@ai-sdk/openai-compatible`) :

```json
"vllm-local": {
  "npm": "@ai-sdk/openai-compatible",
  "name": "vLLM local",
  "options": {
    "baseURL": "http://localhost:8000/v1",
    "apiKey": "EMPTY"
  },
  "models": {
    "qwen2.5-1.5b": { "name": "Qwen2.5 1.5B (vLLM local)", "limit": { "context": 32768, "output": 8192 } }
  }
}
```

Ne pas l'ajouter tant que `curl http://localhost:8000/v1/models` ne répond pas.
Idéal pour : `review`/`refactor-clean`/`doc-updater` (tâches à faible exigence), jamais pour l'archi.

## Cline : même endpoint, config manuelle

Provider `OpenAI Compatible` : Base URL `http://localhost:8000/v1`, API Key `EMPTY`,
Model ID = nom exact du modèle servi (`vllm serve X` → `X`). Pas de hooks ECC sous Cline
(cf. `.agents/tools/ecc-bridge/SKILL.md`) : vLLM ne change rien à ça.

## Cas d'usage PariScore si serveur dispo (VPS GPU ou LAN)

- `insights`/`match-report` : `LLM_PROVIDER=local` en dev, gemini en prod (fallback déjà câblé).
- Embeddings locaux (E5/GTE via vLLM) pour recherche sémantique matchs/joueurs, sans coût/token.
- Batch offline (`LLM.generate`) pour backfills de rapports, pas du temps réel.
