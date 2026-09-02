# Session: Multi-Provider LLM Integration (2026-09-02)

**Scope**: Intégration de 5 providers LLM gratuits dans `src/lib/llm.ts` — OrcaRouter, OpenRouter, NVIDIA NIM, Groq, Gemini (existant), Local (existant). Fallback chain automatique, status multi-provider, 410+ modèles gratuits accessibles.

## Résumé

PariScore dispose maintenant d'un client LLM unifié avec **6 providers** et **fallback chain 3 niveaux**. Chaque provider est OpenAI-compatible (raw `fetch`, zéro dépendance). Les modèles gratuits sont priorisés par défaut.

## Providers intégrés

| Provider | Base URL | Free models | Rate limit | Priorité free |
|----------|----------|-------------|------------|---------------|
| **Gemini** | `generativelanguage.googleapis.com/v1beta` | 17 | 15 RPM, 1500 RPD | Défaut |
| **OrcaRouter** | `api.orcarouter.ai/v1` | 2 (DeepSeek V4) | Non publié | Free |
| **OpenRouter** | `openrouter.ai/api/v1` | 28+ | 20 RPM, 50-1000 RPD | Free |
| **NVIDIA NIM** | `integrate.api.nvidia.com/v1` | 46+ | ~40 RPM | Free |
| **Groq** | `api.groq.com/openai/v1` | 12 | 30 RPM, 14400 RPD | Rapide |
| **Local** | `http://127.0.0.1:8000/v1` | ∞ | Illimité | Offline |

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/lib/llm.ts` | +450 lignes : 3 nouveaux transports (OpenRouter, NIM, Groq), types étendus, config 6 providers, status concurrent, fallback chain |
| `src/app/api/ai/football-match-report/route.ts` | Type `provider` étendu avec 6 values |
| `src/app/api/ai/gemini-insight/route.ts` | Type `provider` étendu avec 6 values |
| `src/app/api/ai/gemini-insight/compare/route.ts` | Type `provider` étendu avec 6 values |
| `.env` | +12 vars (OPENROUTER_*, NIM_*, GROQ_*) |
| `.env.example` | Documentation 4 nouveaux providers |

## Nouveaux modes LLM_PROVIDER

```
gemini          → Gemini (défaut, déjà implémenté)
local           → Ollama/MAX (défaut, déjà implémenté)
orcarouter      → OrcaRouter → openrouter → gemini
openrouter      → OpenRouter → orcarouter → gemini
nvidia          → NVIDIA NIM → openrouter → gemini
groq            → Groq → openrouter → gemini
auto            → gemini → openrouter → local
```

## Fallback chain (mode auto)

```
1. gemini (15 RPM, 1500 RPD)
2. openrouter/free (28+ modèles, 20 RPM)
3. local (Ollama/MAX, illimité)
```

## Transport pattern (commun aux 6 providers)

Chaque transport suit le même pattern :
1. Vérifier la config (API key)
2. Construire le body OpenAI-compatible
3. POST avec AbortSignal.timeout
4. Retry 429 free tier (Retry-After)
5. Fallback response_format si 400/422
6. Extraire `choices[0].message.content`

## Status API (GET /api/ai/llm-status)

Sondage concurrent de 5 endpoints en `Promise.allSettled` :
- OrcaRouter: `GET /v1/models`
- OpenRouter: `GET /v1/models`
- NVIDIA NIM: `GET /v1/models`
- Groq: `GET /v1/models`
- Local: `GET /v1/models`

Réponse inclut `reachable`, `latencyMs`, `error` pour chaque provider.

## Clés API requises

| Variable | Provider | Obtenir la clé |
|----------|----------|----------------|
| `GEMINI_API_KEY` | Google Gemini | https://aistudio.google.com/apikey |
| `ORCA_API_KEY` | OrcaRouter | https://orcarouter.ai/console |
| `OPENROUTER_API_KEY` | OpenRouter | https://openrouter.ai/settings/keys |
| `NIM_API_KEY` | NVIDIA NIM | https://build.nvidia.com/settings/api-keys |
| `GROQ_API_KEY` | Groq | https://console.groq.com/keys |

## Validation

- Typecheck : ✅ 0 erreurs dans `src/` (erreurs pré-existantes dans `tools/skyvern/`)
- Lint : ✅ 0 erreurs
- Aucune nouvelle dépendance (raw `fetch`)

## Usage

```typescript
import { generateText } from "@/lib/llm";

// Mode free auto (gemini → openrouter → local)
const r1 = await generateText({ prompt: "Analyse ce match" });

// Provider spécifique
const r2 = await generateText({ prompt: "...", provider: "openrouter" });
const r3 = await generateText({ prompt: "...", provider: "nvidia" });
const r4 = await generateText({ prompt: "...", provider: "groq" });

// Status complet
import { llmStatus } from "@/lib/llm";
const status = await llmStatus();
// { gemini: {...}, orca: {...}, openrouter: {...}, nvidia: {...}, groq: {...}, local: {...} }
```

## Sources de données

- **FreeLLM.net** : 410+ modèles, 31 providers, 234 vérifiés via API live
- **OpenRouter** : 28+ free models, auto-router `openrouter/free`
- **NVIDIA NIM** : 46+ free models, ~40 RPM
- **OrcaRouter** : 2 free models (DeepSeek V4), auto-router `orcarouter/free`
- **Groq** : 12 free models, LPU ultra-rapide
