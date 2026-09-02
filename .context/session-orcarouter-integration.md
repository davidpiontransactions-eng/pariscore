# Session: OrcaRouter Integration (2026-09-02)

**Scope**: Intégration du provider OrcaRouter (passerelle API OpenAI-compatible, 200+ modèles, free tiers DeepSeek V4) dans le client LLM unifié `src/lib/llm.ts`.

## Résumé

OrcaRouter est une passerelle API OpenAI-compatible qui route les requêtes vers 11 providers (OpenAI, Anthropic, Google, DeepSeek, Grok, Qwen, Kimi, MiniMax, Z.ai, Kling, ByteDance) au prix coûtant sans marge. Deux modèles gratuits sont disponibles via le suffixe `-free` : `deepseek/deepseek-v4-flash-free` et `deepseek/deepseek-v4-pro-free`. Le routeur `orcarouter/free` sélectionne automatiquement le meilleur modèle gratuit selon la difficulté de la requête.

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/lib/llm.ts` | Ajout provider `orcarouter` + `orcarouter+gemini`, types `LlmProviderMode` étendus, config env OrcaRouter, transport `callOrcaRouter()` avec retry 429 free tier, fallback 3 niveaux, status OrcaRouter dans `llmStatus()` |
| `src/app/api/ai/football-match-report/route.ts` | Type `provider` étendu avec `"orcarouter"` |
| `src/app/api/ai/gemini-insight/route.ts` | Type `provider` étendu avec `"orcarouter"` |
| `src/app/api/ai/gemini-insight/compare/route.ts` | Type `provider` étendu avec `"orcarouter"` |
| `.env` | Ajout `ORCA_API_KEY`, `ORCA_MODEL_FREE`, `ORCA_MODEL`, `ORCA_TIMEOUT_MS` |
| `.env.example` | Documentation des vars OrcaRouter |

## Nouveaux modes LLM_PROVIDER

| Mode | Provider principal | Fallback |
|------|-------------------|----------|
| `orcarouter` | OrcaRouter (free/payant selon `ORCA_MODEL`) | gemini → local |
| `orcarouter+gemini` | OrcaRouter | gemini (immédiat) |
| `auto` | Gemini | orcarouter → local |
| `gemini` (défaut) | Gemini | orcarouter → local |
| `local` | Ollama/MAX | gemini |

## Gestion 429 Free Tier

- Avec `Retry-After` → attendre exactement X secondes, réessayer 1 fois
- Sans `Retry-After` → prompt trop long, throw `ORCA_FREE_PROMPT_CAP` (pas de retry)
- Pas de backoff exponentiel (recommandation OrcaRouter)

## Clés API

- `ORCA_API_KEY` : clé API OrcaRouter (sk-orca-...)
- `ORCA_MODEL_FREE` : modèle free (défaut `orcarouter/free`)
- `ORCA_MODEL` : modèle payant (défaut `orcarouter/auto`)
- `ORCA_TIMEOUT_MS` : timeout par appel (défaut 30000ms)

## Validation

- Typecheck : ✅ 0 erreurs liées à OrcaRouter (erreurs pré-existantes dans tools/skyvern, tools/prompt-engineering-guide, etc.)
- Lint : ✅ 0 erreurs
- Aucune nouvelle dépendance ajoutée (raw `fetch` comme les transports existants)

## Usage

```typescript
import { generateText } from "@/lib/llm";

// Mode free (auto-router entre DeepSeek V4 Flash et Pro)
const result = await generateText({
  prompt: "Analyse ce match de tennis",
  provider: "orcarouter",  // utilise ORCA_MODEL_FREE par défaut
});

// Mode payant (auto-router entre tous les modèles)
const result2 = await generateText({
  prompt: "Analyse ce match de tennis",
  provider: "orcarouter+gemini",  // OrcaRouter d'abord, fallback Gemini
});
```

## Statut OrcaRouter

```bash
curl "http://localhost:3000/api/ai/llm-status?token=CRON_SECRET"
```

Réponse inclut :
```json
{
  "orca": {
    "configured": true,
    "modelFree": "orcarouter/free",
    "modelPaid": "orcarouter/auto",
    "reachable": true,
    "latencyMs": 150,
    "error": null
  }
}
```
