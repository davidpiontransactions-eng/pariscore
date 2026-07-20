# PariScore — Agents, Sous-agents & MCP Frontend à installer

> **Date** : 2026-07-20
> **Scope** : Ce doc couvre les **agents** (personas/sous-agents Claude, distincts des
> skills) et les **MCP servers** (tools additionnels). Pour les skills, voir
> `docs/SKILLS-INSTALL-TIER2-TIER3.md`.
>
> **Différence clé** :
> - **Skill** = fichier `SKILL.md` dans `.agents/tools/` (instructions spécifiques)
> - **Agent** = persona/sous-agent dans `.claude/agents/` ou `.opencode/agent/` (rôle
>   autonome avec mission, peut être invoqué en sous-agent)
> - **MCP server** = programme externe dans `.mcp.json` (expose des **tools** :
>   `mcp__<name>__<tool>`)

---

## 📊 État actuel (post-Tier 1 skills)

### Agents déjà installés

#### `.claude/agents/` (20 personas — format Markdown prose)

| Agent | Rôle |
|---|---|
| `cto.md` | Chief Technology Officer |
| `CHIEF SYSTEMS & DATA ARCHITECT.md` | Architecture systèmes & données |
| `CLAUDE MCP & SKILL ORCHESTRATOR.md` | Orchestrateur MCP & skills |
| `Cybersecurity & Data Integrity Office.md` | Sécurité |
| `EXECUTIVE ASSISTANT & EDITOR-IN-CHIEF.md` | Éditorial |
| `GROWTH MARKETING & AUDIENCE STRATEGIST.md` | Marketing |
| `LEAD AI & MACHINE LEARNING ENGINEER.md` | ML/AI |
| `Product Manager Agent.md` | Product |
| `REVENUE OPERATIONS & FINTECH SECURITY LEAD.md` | Fintech |
| `Responsable financier.mf` | Finance |
| `cs-engineering-lead.md` | Engineering lead |
| `cs-ux-researcher.md` | UX research |
| `cs-wiki-ingestor.md` | Wiki ingestor |
| `cskarpathyréviseur.md` | Code review style Karpathy |
| `gestionnaire de projet cs.md` | Chef de projet |
| `réglementation de lqualité CS.md` | QA réglementation |
| `sports-data-expert.md` | Data sportive |
| `sr-dev-expert.md` | Senior dev |
| `testeur senior.md` | QA senior |
| `ui-ux-designer-expert.md` | UI/UX design |

#### `.opencode/agent/` (6 sous-agents — format frontmatter)

| Agent | Rôle |
|---|---|
| `code-reviewer.md` | Review code |
| `fusion-main.md` | Agent principal Fusion |
| `fusion-sidekick.md` | Assistant Fusion |
| `security-auditor.md` | Audit sécurité |
| `test-engineer.md` | Ingénieur test |
| `web-performance-auditor.md` | **Performance web / Core Web Vitals** (déjà là ✅) |

### MCP servers déjà installés (15)

| MCP | Type | Rôle |
|---|---|---|
| `project_fs` | filesystem | Lecture/écriture fichiers projet |
| `memory` | official | Knowledge Graph persistant |
| `git` | official | Opérations git structurées |
| `playwright` | Microsoft | E2E navigateur, screenshots |
| `frontendchecklist` | HTTP | Audit frontend (385 règles) |
| `stitch` | Google | Design → code |
| `crawl4ai` | python | Scraping web |
| `scrapling` | python | Scraping adaptatif (3 modes) |
| `scrapy` | python | Crawling massif |
| `agentmemory` | npm | Mémoire agent |
| `shadcn` | officiel | Composants shadcn/ui ✅ **déjà installé** |
| `bzzoiro-sports` | HTTP | Data sportive |
| `sportdbdotdev` | HTTP | SportDB |
| `sportradar` | RapidAPI | Sportradar |

> ✅ **`shadcn` MCP est déjà installé** — pas besoin du MCP communautaire
> `JpisNice/shadcn-ui-mcp-server` recommandé ailleurs.

---

## 🥇 TIER 1 — Agents frontend à installer (priorité max)

### 1. `frontend-developer` (VoltAgent)

- **Repo** : https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/frontend-developer.md
- **Rôle** : Sous-agent développeur frontend senior. Implémente composants React,
  résout bugs UI, suit design system.
- **Pourquoi** : persona clair pour déléguer des tâches frontend à un sous-agent
  dédié. Actuellement tu n'as que `sr-dev-expert.md` (généraliste) et
  `ui-ux-designer-expert.md` (design). Il manque l'exécutant frontend.
- **Note** : ⭐⭐⭐

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force voltagent-subagents -ErrorAction SilentlyContinue
git clone --depth 1 --filter=blob:none --sparse https://github.com/VoltAgent/awesome-claude-code-subagents.git voltagent-subagents
cd voltagent-subagents
git sparse-checkout set categories/01-core-development
cd ..

# Récupérer le markdown de l'agent
$src = "voltagent-subagents\categories\01-core-development\frontend-developer.md"
if (Test-Path $src) {
    # Adapter le format VoltAgent → format .claude/agents (ajouter frontmatter si manquant)
    $content = Get-Content $src -Raw
    if ($content -notmatch '^---') {
        $frontmatter = @"
---
name: frontend-developer
description: Senior frontend developer agent. Implements React/Next.js components, fixes UI bugs, follows design system conventions. Use for delegated frontend implementation tasks.
---

"@
        $content = $frontmatter + $content
    }
    $content | Set-Content "C:\Users\David\ZCodeProject\pariscore\.claude\agents\frontend-developer.md" -Encoding UTF8
    Write-Host "✓ frontend-developer installé"
} else {
    Write-Host "❌ $src introuvable — vérifier la structure du repo"
}

# Cleanup
Remove-Item -Recurse -Force voltagent-subagents
```

---

### 2. `ui-designer` (VoltAgent)

- **Repo** : https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/ui-designer.md
- **Rôle** : Sous-agent designer UI. Traduit spécifications → maquettes/code UI
  cohérent avec un DESIGN.md.
- **Pourquoi** : complémentaire de ton `ui-ux-designer-expert.md` (plus orienté
  recherche/stratégie). Celui-ci est exécutant.
- **Note** : ⭐⭐⭐

```powershell
cd $env:TEMP
if (-not (Test-Path voltagent-subagents)) {
    git clone --depth 1 --filter=blob:none --sparse https://github.com/VoltAgent/awesome-claude-code-subagents.git voltagent-subagents
    cd voltagent-subagents
    git sparse-checkout set categories/01-core-development
    cd ..
}

$src = "voltagent-subagents\categories\01-core-development\ui-designer.md"
if (Test-Path $src) {
    $content = Get-Content $src -Raw
    if ($content -notmatch '^---') {
        $frontmatter = @"
---
name: ui-designer
description: UI designer agent. Translates specs into UI mockups/code matching DESIGN.md. Use for design execution tasks (color, layout, typography, components).
---

"@
        $content = $frontmatter + $content
    }
    $content | Set-Content "C:\Users\David\ZCodeProject\pariscore\.claude\agents\ui-designer.md" -Encoding UTF8
    Write-Host "✓ ui-designer installé"
}

Remove-Item -Recurse -Force voltagent-subagents
```

---

### 3. `design-bridge` (VoltAgent)

- **Repo** : https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/design-bridge.md
- **Rôle** : Traduit un DESIGN.md en instructions Claude Code concrètes pour
  builder l'UI. Pont entre un design system et l'implémentation.
- **Pourquoi** : tu as 74 DESIGN.md dans `.agents/design-md/`. Cet agent sert de
  "passeur" entre un DESIGN.md (ex: linear, vercel) et le code généré.
- **Note** : ⭐⭐⭐ (synergie directe avec `.agents/design-md/`)

```powershell
cd $env:TEMP
if (-not (Test-Path voltagent-subagents)) {
    git clone --depth 1 --filter=blob:none --sparse https://github.com/VoltAgent/awesome-claude-code-subagents.git voltagent-subagents
    cd voltagent-subagents
    git sparse-checkout set categories/01-core-development
    cd ..
}

$src = "voltagent-subagents\categories\01-core-development\design-bridge.md"
if (Test-Path $src) {
    $content = Get-Content $src -Raw
    if ($content -notmatch '^---') {
        $frontmatter = @"
---
name: design-bridge
description: Bridges a DESIGN.md design system to concrete Claude Code instructions for building UI. Use when aligning code generation with a reference DESIGN.md (e.g. from .agents/design-md/).
---

"@
        $content = $frontmatter + $content
    }
    $content | Set-Content "C:\Users\David\ZCodeProject\pariscore\.claude\agents\design-bridge.md" -Encoding UTF8
    Write-Host "✓ design-bridge installé"
}

Remove-Item -Recurse -Force voltagent-subagents
```

---

### 4. `a11y-architect` (rex-diego)

- **Repo** : https://github.com/rex-diego/everything-claude-code (gagnant Anthropic Hackathon)
- **Rôle** : Architecte accessibilité senior, WCAG 2.2 web/iOS/Android.
- **Pourquoi** : tu n'as pas d'agent a11y dédié dans `.claude/agents/`. Complète le
  MCP `frontendchecklist` et les skills `accessibility`/`accessibility-agents`.
- **Note** : ⭐⭐

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force everything-claude-code -ErrorAction SilentlyContinue
git clone --depth 1 --filter=blob:none --sparse https://github.com/rex-diego/everything-claude-code.git
cd everything-claude-code
git sparse-checkout set agents
cd ..

# Chercher l'agent a11y
$src = Get-ChildItem everything-claude-code\agents -Recurse -Filter "a11y*.md" | Select-Object -First 1
if ($src) {
    Copy-Item -Force $src.FullName `
      "C:\Users\David\ZCodeProject\pariscore\.claude\agents\a11y-architect.md"
    Write-Host "✓ a11y-architect installé"
} else {
    Write-Host "❌ a11y-architect non trouvé dans everything-claude-code/agents/"
    Write-Host "  Lister les agents dispo :"
    Get-ChildItem everything-claude-code\agents -Filter "*.md" | Select-Object Name
}

Remove-Item -Recurse -Force everything-claude-code
```

---

## 🥈 TIER 2 — Agents spécialisés (selon besoin)

### 2.1 Collections à cherry-picker

| Collection | Repo | Agents frontend notables |
|---|---|---|
| **VoltAgent/awesome-claude-code-subagents** | https://github.com/VoltAgent/awesome-claude-code-subagents ⭐23k | `frontend-developer`, `ui-designer`, `design-bridge`, `fullstack-developer` |
| **wshobson/agents** | https://github.com/wshobson/agents ⭐34k | Plugin `frontend-mobile-development` (React/Next/Tailwind), `responsive-design` skill |
| **rex-diego/everything-claude-code** | https://github.com/rex-diego/everything-claude-code | `a11y-architect`, `frontend-engineer` (gagnant hackathon) |
| **rohitg00/awesome-claude-code-toolkit** | https://github.com/rohitg00/awesome-claude-code-toolkit | 135 agents, inclut `migration-generator` |

### 2.2 Procédure cherry-pick générique d'un agent

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force <repo-name> -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/<org>/<repo>.git

# Lister les agents dispo
Get-ChildItem <repo-name> -Recurse -Filter "*.md" | 
  Where-Object { $_.FullName -match "agent" } | 
  Select-Object FullName

# Copier l'agent choisi
Copy-Item -Force "<repo-name>\<chemin>\<agent>.md" `
  "C:\Users\David\ZCodeProject\pariscore\.claude\agents\<agent>.md"

Remove-Item -Recurse -Force <repo-name>
```

---

### 2.3 Agents à créer soi-même (n'existent pas publiquement)

| Agent à créer | Pourquoi | Spécification |
|---|---|---|
| **`tennis-data-viz-agent`** | Aucun agent public spécialisé dataviz sportive | Combiner `tufte-data-viz` + patterns Recharts tennis. Mission : concevoir visualisations scores/momentum/stats joueurs. |
| **`live-score-ingestion-agent`** | Aucun subagent SSE/WebSocket React | Spécialiste React Query + SSE pour tableaux de scores live temps réel. |
| **`brand-consistency-guard`** | Aucun qui audite cohérence refonte vs DESIGN.md | Wrapper autour de `design-bridge` en mode audit. Vérifie chaque PR. |
| **`design-tokens-extractor`** | Pas d'outil public qui scrape site → tokens DESIGN.md | Combiner awesome-design-md + Playwright. |

#### Template pour créer un agent

```powershell
# Créer .claude/agents/tennis-data-viz-agent.md
$content = @"
---
name: tennis-data-viz-agent
description: Specialist agent for tennis data visualizations (scores, momentum, serve stats, head-to-head). Combines tufte-data-viz principles with tennis-specific chart patterns. Use when designing or implementing any tennis chart, scoreboard, or stats comparison.
---

# Tennis Data Visualization Agent

Tu es un spécialiste de la data-viz tennis. Ta mission : concevoir et implémenter
des visualisations claires, honnêtes (principes Tufte) et adaptées au contexte
live/prematch tennis.

## Métriques standards à visualiser

### Live (pendant le match)
- **Scoreboard** : `6-4 6-3 3-2` + jeu en cours `30-15`
- **Momentum** : courbe EWMA dominance ratio point-par-point
- **Win Probability** : courbe live proba 0-100% au fil du match
- **Serve stats** : 1st serve in%, 1st won%, 2nd won% (barres comparatives)
- **Break points** : matrice set-par-set `2/3` (converted/faced)
- **Set-by-set table** : games/aces/DF/1st%/BP par set (style Sofascore)

### Prematch
- **H2H radar** : 6 axes comparatifs (Aces, 1st%, BP saved, Ret won…)
- **Elo sparkline** : progression 30 jours
- **Form dots** : 5 derniers matchs W/L
- **Last 10 matches list** : adversaire, score, tournoi, surface

## Références visuelles

- Sofascore : [sofascore.com/tennis](https://www.sofascore.com/tennis)
- Flashscore : [flashscoreusa.com/tennis](https://www.flashscoreusa.com/tennis/)
- ASN momentum : [asndsports.com/tennis-momentum-chart/](https://asndsports.com/tennis-momentum-chart/)

## Librairies préférées (stack PariScore)

- **shadcn Charts (Recharts)** : radar, bar, line — standard
- **ECharts** : momentum/WinProbability live (Recharts rame sur gros datasets)
- **Motion AnimateNumber** : count-up scores

## Règles Tufte à respecter

1. **Data-ink ratio** : maximiser l'encre qui représente la donnée
2. **Direct labeling** : pas de légende quand on peut étiqueter directement
3. **Range-frame axes** : axes qui s'arrêtent aux données, pas à 0
4. **Pas de chartjunk** : éviter ombres 3D, gradients décoratifs

## Fichiers de référence du projet

- `src/components/tennis/momentum-dr.tsx` (454 lignes) — momentum existant
- `src/components/tennis/live-stats-panel.tsx` (303 lignes) — stats live
- `src/hooks/use-live-matches.ts` — source des données live
- `.agents/tools/tufte-data-viz/SKILL.md` — principes Tufte
- `.agents/design-md/` — 74 DESIGN.md de marques pour inspiration
"@

$content | Set-Content "C:\Users\David\ZCodeProject\pariscore\.claude\agents\tennis-data-viz-agent.md" -Encoding UTF8
Write-Host "✓ tennis-data-viz-agent créé"
```

---

## 🥉 TIER 1 — MCP servers à installer (frontend)

> ⚠️ **Doublon à éviter** : `shadcn` MCP est **déjà installé** (officiel, dans
> `.mcp.json`). Ne pas installer `JpisNice/shadcn-ui-mcp-server`.

### MCP 1 — ⭐⭐⭐ Context7

- **Repo** : https://github.com/upstash/context7 ⭐59k
- **Rôle** : Injecte la doc à jour de React 19, Next.js 16, Tailwind v4, shadcn
  directement dans le prompt → évite l'IA qui code en API obsolètes.
- **Pourquoi** : stack bleeding-edge → indispensable. Évite Next 14 / Tailwind v3.

```json
"context7": {
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp@latest"]
}
```

---

### MCP 2 — ⭐⭐⭐ Chrome DevTools (officiel Google)

- **Repo** : https://github.com/ChromeDevTools/chrome-devtools-mcp ⭐47k
- **Rôle** : Pilote un Chrome réel via DevTools Protocol : DOM vivant, perf tracing,
  screenshots, console, network.
- **Pourquoi** : debug visuel temps réel. Complément de Playwright (qui est E2E).

```json
"chrome-devtools": {
  "command": "npx",
  "args": ["chrome-devtools-mcp@latest"]
}
```

---

### MCP 3 — ⭐⭐ 21st.dev Magic

- **Repo** : https://github.com/21st-dev/magic-mcp ⭐5.5k
- **Rôle** : "v0 inside ZCode" — génère composants UI premium (landing, hero,
  cards) depuis du langage naturel.
- **Pourquoi** : hero page d'accueil tennis, cards "match à venir" premium.

```json
"magic21": {
  "command": "npx",
  "args": ["-y", "@21st-dev/magic@latest"],
  "env": { "TWENTYFIRST_API_KEY": "<clé-gratuite-21st-dev>" }
}
```

> S'inscrire sur https://21st.dev pour la clé API gratuite.

---

### MCP 4 — ⭐⭐ Browser Tools

- **Repo** : https://github.com/AgentDeskAI/browser-tools-mcp ⭐7k
- **Rôle** : Extension Chrome + MCP : capture console, erreurs réseau,
  screenshots, selectors depuis ton navigateur.
- **Pourquoi** : debug interactif, l'agent voit l'erreur exacte.

```json
"browser-tools": {
  "command": "npx",
  "args": ["@agentdeskai/browser-tools-server@latest"]
}
```

> ⚠️ Nécessite aussi l'extension Chrome "BrowserToolsMCP" à installer côté navigateur.

---

### MCP 5 — ⭐⭐ Figma Context (Framelink)

- **Repo** : https://github.com/GLips/Figma-Context-MCP ⭐15k
- **Rôle** : Traduit données Figma pour l'IA → génère code JSX fidèle.
- **Pourquoi** : SI tu as un workflow Figma pour l'UI tennis.

```json
"figma": {
  "command": "npx",
  "args": ["figma-developer-mcp", "--figma-api-key=KEY", "--stdio"],
  "env": { "FIGMA_API_KEY": "<clé-figma>" }
}
```

---

### MCP 6 — ⭐ Lighthouse

- **Repo** : https://github.com/danielsogl/lighthouse-mcp-server
- **Rôle** : Audit Lighthouse complet (perf, a11y, SEO, CWV) piloté par IA.
- **Pourquoi** : mesurer LCP/INP/CLS des pages denses.

```json
"lighthouse": {
  "command": "npx",
  "args": ["-y", "@danielsogl/lighthouse-mcp-server"]
}
```

---

### MCP 7 — ⭐ Storybook (officiel)

- **Repo** : https://github.com/storybookjs/mcp
- **Rôle** : Expose stories/props/composants Storybook à l'agent.
- **Pourquoi** : SI tu montes un Storybook design system tennis.

```json
"storybook": {
  "command": "npx",
  "args": ["storybook-mcp@latest"]
}
```

---

### MCP 8 — ⭐ Axe (Deque officiel)

- **Lien** : https://www.deque.com/axe/mcp-server/
- **Rôle** : Audit WCAG automatique via axe-core.
- **Pourquoi** : complément des agents `a11y-architect` + skills `accessibility`.

> Voir doc Deque pour l'install (variable selon contexte).

---

### MCP 9 — ⭐ Magic UI (officiel)

- **Repo** : https://github.com/magicuidesign/mcp
- **Rôle** : 150+ composants animés Magic UI (Motion + Tailwind) recherchables.
- **Pourquoi** : animations scores live.

> Voir https://magicui.design/docs/mcp pour l'install.

---

### MCP 10 — 🟢 ECharts

- **Repo** : https://github.com/hustcc/mcp-echarts (apache/echarts-mcp)
- **Rôle** : Génération charts ECharts via IA.
- **Pourquoi** : momentum/WinProbability (Recharts rame sur gros datasets).

```json
"echarts": {
  "command": "npx",
  "args": ["-y", "mcp-echarts"]
}
```

---

## 🚫 MCP frontend qui n'existent PAS (vérifié)

| MCP présumé | Statut réel |
|---|---|
| `tailwind-mcp` officiel | ❌ Discussion #19737 ouverte. Utiliser **Context7** pour la doc Tailwind v4. |
| `framer-motion-mcp` mature | ❌ Seul `Abhishekrajpurohit/motion-dev-mcp` (13 stars). Utiliser [Motion AI Kit](https://motion.dev/docs/ai-kit-context) + Context7. |
| `v0-mcp` standalone | ❌ v0 via UI Vercel. Équivalent = **21st.dev Magic**. |
| `recharts-mcp` / `nivo-mcp` | ❌ Aucun. Seul ECharts a un MCP. |
| `responsively-mcp` | ❌ N'existe pas. Chrome DevTools MCP couvre. |
| `nextjs-mcp` standalone | ❌ Pas de repo officiel. Context7 donne la doc Next 16. |

---

## ⚙️ Procédure universelle

### Installer un agent (4e choix de format)

#### Format A — `.claude/agents/*.md` (prose, comme tes 20 personas existants)

```powershell
cd $env:TEMP
git clone --depth 1 https://github.com/<org>/<repo>.git

# Option 1 : copier tel quel si déjà au bon format
Copy-Item -Force "<repo>\<agent>.md" `
  "C:\Users\David\ZCodeProject\pariscore\.claude\agents\<agent>.md"

# Option 2 : si pas de frontmatter, l'ajouter (voir template plus haut)
$content = Get-Content "<repo>\<agent>.md" -Raw
if ($content -notmatch '^---') {
    $frontmatter = @"
---
name: <agent-name>
description: <courte description de quand l'invoquer>
---

"@
    $content = $frontmatter + $content
}
$content | Set-Content "C:\Users\David\ZCodeProject\pariscore\.claude\agents\<agent>.md" -Encoding UTF8

# Cleanup
Remove-Item -Recurse -Force <repo>
```

#### Format B — `.opencode/agent/*.md` (frontmatter, comme tes 6 agents existants)

Même chose mais dans `.opencode/agent/`. Ce format est requis si tu veux que
l'agent soit invoquable comme sous-agent OpenCode.

```powershell
Copy-Item -Force "<repo>\<agent>.md" `
  "C:\Users\David\ZCodeProject\pariscore\.opencode\agent\<agent>.md"
```

#### Format C — créer un agent de zéro

Voir template `tennis-data-viz-agent` plus haut. Adapter pour chaque cas.

> ⚠️ **Règle** : un agent doit avoir un `name` et une `description` dans le
> frontmatter pour être découvrible. Sans ça, l'orchestrator ne sait pas quand
> l'invoquer.

---

### Installer un MCP server

```powershell
# 1. Tester que le package npm existe
npx -y <package>@latest --version

# 2. Éditer .mcp.json — ajouter dans "mcpServers"
#    (voir snippets JSON dans chaque MCP ci-dessus)
notepad C:\Users\David\ZCodeProject\pariscore\.mcp.json

# 3. Valider le JSON
cd C:\Users\David\ZCodeProject\pariscore
node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf-8')); console.log('✓ .mcp.json valide')"

# 4. Redémarrer ZCode (les MCP se chargent au démarrage uniquement)
```

---

## 📋 Checklist post-install

```powershell
cd C:\Users\David\ZCodeProject\pariscore

# 1. Compter les agents
Write-Host "Agents .claude/agents/: $((Get-ChildItem .claude\agents -Filter *.md).Count)"
Write-Host "Agents .opencode/agent/: $((Get-ChildItem .opencode\agent -Filter *.md).Count)"

# 2. Compter les MCP
$mcpCount = (node -e "const d=JSON.parse(require('fs').readFileSync('.mcp.json','utf-8')); console.log(Object.keys(d.mcpServers).length)")
Write-Host "MCP servers: $mcpCount"

# 3. Valider .mcp.json
node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf-8')); console.log('✓ .mcp.json valide')"

# 4. Lister agents récents
Get-ChildItem .claude\agents -Filter *.md | 
  Sort-Object LastWriteTime -Descending | 
  Select-Object -First 5 Name, LastWriteTime

# 5. Redémarrer ZCode
```

---

## 🧪 Tester un agent ou MCP fraîchement installé

### Tester un agent

```
Invoque l'agent frontend-developer pour implémenter un composant SetScoreline
affichant "6-4 6-3 3-2" depuis liveState.scoreA.sets.
```

Ou :

```
Délègue à ui-designer la conception d'une version premium de la carte tennis
en alignement avec .agents/design-md/linear/DESIGN.md.
```

### Tester un MCP

```
Utilise le MCP context7 pour récupérer la documentation à jour de
shadcn/ui Charts (Radar) compatible React 19 + Next 16.
```

Ou :

```
Utilise le MCP chrome-devtools pour ouvrir https://pariscore.fr/setpoint/,
prendre un screenshot et mesurer le LCP de la page.
```

---

## 🎯 Tier 1 synthèse — priorité max pour la refonte tennis

**À installer AVANT Phase 1 du plan de refonte** (cf. `todo.md`) :

### Agents (4)
1. ⭐⭐⭐ `frontend-developer` — exécutant frontend senior
2. ⭐⭐⭐ `ui-designer` — exécutant design (complément du stratège existant)
3. ⭐⭐⭐ `design-bridge` — pont DESIGN.md ↔ code (synergie `.agents/design-md/`)
4. ⭐⭐ `a11y-architect` — accessibilité WCAG 2.2

### MCP (2)
5. ⭐⭐⭐ **Context7** — doc live (anti-code obsolète)
6. ⭐⭐⭐ **Chrome DevTools** — debug visuel temps réel

**Total** : 4 agents + 2 MCP. Couvre la base critique pour démarrer la refonte.

---

## 📚 Sources principales

### Agents
- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) ⭐23k — 100+ sub-agents
- [wshobson/agents](https://github.com/wshobson/agents) ⭐34k — 94 plugins, 175 skills, 109 commands
- [rex-diego/everything-claude-code](https://github.com/rex-diego/everything-claude-code) — gagnant Anthropic Hackathon
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — awesome-list curée
- [Anthropic blog: Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills)

### MCP
- [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) — index MCP complet
- [tolkonepiu/best-of-mcp-servers](https://github.com/tolkonepiu/best-of-mcp-servers) — best-of MCP
- [Builder.io best MCP 2026](https://www.builder.io/blog/best-mcp-servers-2026)
- [Firecrawl best MCP for developers](https://www.firecrawl.dev/blog/best-mcp-servers-for-developers)
- [The New Stack 10 MCP frontend](https://thenewstack.io/10-mcp-servers-for-frontend-developers/)
- [shadcnstudio best MCP](https://shadcnstudio.com/blog/best-mcp-servers/)
- [datamcp.app best MCP 2026](https://datamcp.app/blog/best-mcp-servers-2026)
- [Reddit r/mcp 4 MCPs for frontend](https://www.reddit.com/r/mcp/comments/1oly1yq/4_mcps_every_frontend_dev_should_install_today/)

---

## 📌 Résumé exécutif

| Type | Installés | Tier 1 à ajouter | Tier 2 (optionnel) |
|---|---|---|---|
| **Agents** `.claude/agents/` | 20 | +4 (`frontend-developer`, `ui-designer`, `design-bridge`, `a11y-architect`) | Cherry-pick VoltAgent/wshobson selon besoins |
| **Sous-agents** `.opencode/agent/` | 6 | (couvert par .claude/agents/) | Idem |
| **MCP** `.mcp.json` | 15 | +2 (Context7, Chrome DevTools) | +8 (Magic21, Browser Tools, Figma, Lighthouse, Storybook, Axe, Magic UI, ECharts) |

**Prochaine action concrète** : exécuter la section "Tier 1" ci-dessus avant Phase 1
du plan de refonte tennis (dans `todo.md`).

---

*Document généré le 2026-07-20 — vérifier la fraîcheur des repos avant install.*
