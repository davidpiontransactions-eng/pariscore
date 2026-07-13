# Page Agent - Browser Automation AI

## Description

Page Agent (Alibaba, MIT) est un agent GUI JavaScript injecté dans le navigateur via CDN.
Il exécute des commandes en langage naturel sur n'importe quelle page web :
cliquer, scroller, input, navigation, extraction de données.

Le CDN demo (`page-agent.demo.js`) embarque un LLM gratuit (`qwen3.5-plus`)
hébergé par Alibaba. **Aucune clé API nécessaire** en mode demo (défaut).

## Architecture

```
Agent (opencode / CLI)
  |
  |  shell out (Bun.$ / node)
  v
.opencode/tools/page-agent-runner.mjs
  |
  |  Playwright headless Chromium
  v
  1. Navigate vers URL
  2. Inject CDN (auto-init ou manual)
  3. pageAgent.execute(cmd) ou new PageAgent({...}).execute(cmd)
  |
  |  [Mode gemini] page.route() proxy intercepte les appels Gemini
  |  -> les relaie via Node.js https.request() (pas de CORS)
  |
  v
Résultat JSON { success, result, page }
```

## Proxy Gemini (page.route)

Le mode gemini utilise un **proxy Node.js** pour contourner les limitations CORS
du navigateur. L'endpoint OpenAI-compatible de Gemini
(`generativelanguage.googleapis.com/v1beta/openai/`) ne renvoie pas
le header `Access-Control-Allow-Origin`, ce qui bloque les appels `fetch()`.

### Fonctionnement

1. `page.route('**/generativelanguage.googleapis.com/**')` est enregistré **avant** l'injection du CDN
2. Quand `PageAgent.instance.execute(cmd)` fait un `fetch()` vers Gemini, le navigateur ne fait PAS la requête directement
3. Playwright intercepte la requête et appelle le handler Node.js
4. Le handler relaie la requête via `https.request()` (pas de CORS)
5. La réponse Gemini est retournée au navigateur avec les headers CORS

### Ce que le proxy gère

| Problème | Solution |
|----------|----------|
| CORS bloqué | Requête relayée par Node.js (pas de navigateur) |
| Double-slash `//chat/completions` | Correction : `//chat` -> `/chat` |
| Header Authorization perdu | Forwardé : `authorization` -> `Authorization: Bearer <key>` |
| CORS preflight (OPTIONS) | Réponse 204 avec headers CORS |

## Dual Mode

Le runner supporte deux modes via le flag `--llm` :

### Mode demo (défaut, gratuit, zéro config)

```bash
node .opencode/tools/page-agent-runner.mjs --url URL --command "CMD"
```

- CDN injecté en **auto-init** (sans `?autoInit=false`)
- Le CDN crée automatiquement `window.pageAgent` avec le LLM `qwen3.5-plus`
- `window.pageAgent.execute(cmd)` fonctionne immédiatement
- Aucune variable d'environnement requise
- Aucun proxy nécessaire (le LLM demo est hébergé sans CORS)

### Mode gemini (clé API requise)

```bash
node .opencode/tools/page-agent-runner.mjs --url URL --command "CMD" --llm gemini
```

Le runner charge `.env` automatiquement (lecture directe, pas de dépendance).
Pas besoin d'exporter manuellement la variable.

- CDN injecté avec `?autoInit=false`
- `window.PageAgent` (constructeur) exposé au lieu d'une instance
- Proxy `page.route()` installé avant l'injection du CDN
- Création manuelle de l'instance avec config Gemini + clé API
- Requiert `GEMINI_API_KEY` dans `.env` ou l'environnement

### Modèle Gemini utilisé

- **Modèle** : `gemini-2.5-flash`
- **Ancien modèle** : `gemini-2.0-flash` (quota free tier épuisé)
- **Endpoint** : `generativelanguage.googleapis.com/v1beta/openai/` (OpenAI-compatible)
- **Testé** : HTTP 200 sur `example.com` et `localhost:3000 (PariScore)`

## Paramètres

| Param | Description |
|-------|-------------|
| `--url URL` | URL cible à ouvrir |
| `--command CMD` | Commande en langage naturel |
| `--llm MODE` | Mode LLM : `demo` (défaut) ou `gemini` |
| `--screenshot PATH` | Capture d'écran optionnelle |
| `--timeout MS` | Timeout navigation (défaut: 60000) |

## Exemples

```bash
# Mode demo (défaut) - sans clé API
node .opencode/tools/page-agent-runner.mjs --url https://pariscore.com --command "click the Football tab"

# Mode demo - extraction
node .opencode/tools/page-agent-runner.mjs --url https://pariscore.com --command "list all visible matches"

# Mode demo - test simple
node .opencode/tools/page-agent-runner.mjs --url https://example.com --command "what do you see on this page"

# Mode gemini - décrire une page
node .opencode/tools/page-agent-runner.mjs --url http://localhost:3000 --command "décris cette page en 1 phrase" --llm gemini

# Mode gemini - navigation sur PariScore
node .opencode/tools/page-agent-runner.mjs --url http://localhost:3000 --command "clique sur Tennis et liste les matchs" --llm gemini --timeout 120000
```

## Integration Tool opencode

Le tool `page-agent.ts` est auto-découvert dans `.opencode/tools/`.
Il expose deux fonctions :

```typescript
// Mode demo (default) - execute une commande
tool.execute({ url: "https://example.com", command: "what do you see" })

// Mode gemini
tool.execute({ url: "https://example.com", command: "what do you see", llm: "gemini" })

// Mode gemini avec timeout
tool.execute({ url: "http://localhost:3000", command: "clique sur Tennis", llm: "gemini", timeout: 120000 })

// getPageState - résumé rapide
tool.getPageState({ url: "http://localhost:3000" })
tool.getPageState({ url: "http://localhost:3000", llm: "gemini" })
```

## Fichiers

| Fichier | Rôle |
|---------|------|
| `.opencode/tools/page-agent-runner.mjs` | Runner principal (proxy inclus) |
| `.opencode/tools/page-agent.ts` | Tool opencode (execute + getPageState) |
| `.env` | Contient `GEMINI_API_KEY` (chargé auto par le runner) |

## Dépendances

- Installé dans `.opencode/` (isolé du backend racine)
- `page-agent@1.11.0` (CDN jsdelivr)
- `playwright@1.61.1` (headless Chromium)
- `@opencode-ai/plugin` (pour le tool opencode)
- Modules natifs Node.js uniquement : https, fs, path (zéro dépendance npm)

## Notes

- Le LLM gratuit demo (`qwen3.5-plus`) est limité en usage (usage interne / tests)
- Pour production : utiliser `--llm gemini` avec une clé API Gemini valide dans `.env`
- Le mode demo utilise **sans** `?autoInit=false` — le CDN crée automatiquement `window.pageAgent`
- Le mode gemini utilise `?autoInit=false` — expose `window.PageAgent` (constructeur)
- Le proxy page.route() ne s'active qu'en mode gemini (pas nécessaire en demo)
- Le runner charge `.env` automatiquement (parse le fichier, pas de dépendance dotenv)
- Ancienne clé API AIzaSyDT6UlHKe-Q2wMFiDwxfH7PBijsE2uhGGA : quota épuisé (429) — ne plus utiliser
- `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-flash-001` : quota free tier épuisé (429)
- `gemini-2.5-flash` : fonctionne (HTTP 200). `gemini-3-flash-preview` : HTTP 200 mais réponse vide
- Testé et validé sur `https://example.com` et `http://localhost:3000` (PariScore)
