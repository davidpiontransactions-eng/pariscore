# PariScore — Skills Tier 2 & Tier 3 à installer (frontend)

> **Date** : 2026-07-20
> **Pré-requis** : ZCode relancé après install Tier 1 (`tufte-data-viz`, `web-quality-*` ×6,
> `design-review`, `tailwind-theme-builder`, `react-patterns` + `ui-ux-pro-max-cli` npm +
> `.agents/design-md/` 74 DESIGN.md).
>
> **Convention du repo** : tout skill va dans `.agents/tools/<name>/SKILL.md`.
> La junction `.opencode/skills/` pointe déjà vers `.agents/tools/` (vérifiée).
> Après chaque ajout : `node scripts/sync-skills.js` puis relancer ZCode.
>
> **Shell** : PowerShell (Windows). Équivalences Unix → PowerShell en bas de fichier.

---

## 📊 Récap install actuel (post-Tier 1)

| Élément | État |
|---|---|
| Skills `.agents/tools/` | **164** (153 originaux + 11 Tier 1) |
| `ui-ux-pro-max-cli` (npm global) | v2.11.0 ✅ |
| `.agents/design-md/` | 74 DESIGN.md marques ✅ |
| `opencode.json` allowlist | synchronisée (0 → 164) ✅ |
| Bug `sync-skills.js:28` | corrigé ✅ |

---

## 🥇 TIER 1 BIS — Skills critiques restants (à installer en priorité)

> Manquants au Tier 1 initial, signalés comme essentiels par l'audit.

### 1. `frontend-design` (Anthropic officiel)

- **Repo** : https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design
- **Rôle** : Skill officiel Anthropic anti-AI-slop. Pousse Claude à faire des choix
  esthétiques audacieux, typographie distinctive, éviter le « slop » générique.
- **Pourquoi** : le SEUL skill officiel Anthropic pour le frontend. Complète
  `hallmark` + `impeccable` avec la ligne de conduite maison d'Anthropic.
- **Note** : ⭐⭐⭐ TOP PICK

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force anthropic-frontend-design -ErrorAction SilentlyContinue
# Clone sparse : juste le plugin frontend-design
git clone --depth 1 --filter=blob:none --sparse https://github.com/anthropics/claude-code.git anthropic-cc
cd anthropic-cc
git sparse-checkout set plugins/frontend-design
cd ..

# Copier le skill dans .agents/tools/
New-Item -ItemType Directory -Force "C:\Users\David\ZCodeProject\pariscore\.agents\tools\frontend-design" | Out-Null
Copy-Item -Recurse -Force "anthropic-cc\plugins\frontend-design\*" `
  "C:\Users\David\ZCodeProject\pariscore\.agents\tools\frontend-design\"

# Cleanup
Remove-Item -Recurse -Force anthropic-cc
```

> ⚠️ Vérifier ensuite que `.agents/tools/frontend-design/SKILL.md` existe. Si la structure
> interne diffère, ajuster le chemin source.

---

### 2. `accessibility-agents` (11 spécialistes WCAG 2.2 AA)

- **Repo** : https://github.com/Community-Access/accessibility-agents
- **Rôle** : 11 sous-agents WCAG 2.2 AA (cognitive, mobile, screen reader, motor…) qui
  se chargent automatiquement dans Claude Code.
- **Pourquoi** : distinct de `fec-accessibility-testing` (qui est un MCP). Donne une
  couche d'agents experts. Critique pour les tableaux de scores live (souvent problématiques).
- **Note** : ⭐⭐⭐ TOP PICK

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force accessibility-agents -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/Community-Access/accessibility-agents.git

# La structure interne peut varier — inspecter avant de copier
Get-ChildItem accessibility-agents -Directory | Select-Object Name

# Hypothèse la plus probable : copier chaque agent comme un skill
# Ajuster selon la structure réelle observée
New-Item -ItemType Directory -Force "C:\Users\David\ZCodeProject\pariscore\.agents\tools\accessibility-agents" | Out-Null
Copy-Item -Recurse -Force "accessibility-agents\*" `
  "C:\Users\David\ZCodeProject\pariscore\.agents\tools\accessibility-agents\"

# Cleanup
Remove-Item -Recurse -Force accessibility-agents
```

> ⚠️ À inspecter : `accessibility-agents` embarque peut-être plusieurs SKILL.md.
> Si oui, restructurer pour qu'il n'y en ait qu'un seul à la racine du dossier
> `.agents/tools/accessibility-agents/` (sinon `sync-skills.js` ne le découvre pas).

---

### 3. `web-quality-skills` complet (déjà partiellement installé)

- **Statut** : 6 skills déjà copiés. Vérifier s'il y a des skills bonus dans le repo.
- **Repo** : https://github.com/addyosmani/web-quality-skills

```powershell
# Vérifier ce qui est dispo en plus
cd $env:TEMP
Remove-Item -Recurse -Force web-quality-skills -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/addyosmani/web-quality-skills.git
Get-ChildItem web-quality-skills\skills -Directory | Select-Object Name
```

> Si rien de plus → skip. Les 6 déjà installés couvrent tout.

---

## 🥈 TIER 2 — Skills spécialisés (à installer selon besoin)

### 2.1 `claudedesignskills` — Animation & 3D

- **Repo** : https://github.com/freshtechbro/claudedesignskills
- **Rôle** : 23 skills animation : GSAP+ScrollTrigger, Framer Motion, React Spring,
  Lottie, anime.js, Three.js.
- **Pourquoi** : animations fluides pour refonte moderne (transitions, player cards,
  replays). Bundle le plus mature pour l'animation.
- **Note** : ⭐⭐ pour refonte tennis (motion = différenciateur premium)

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force claudedesignskills -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/freshtechbro/claudedesignskills.git

# Inspecter la structure interne (probable : .claude/skills/* ou skills/*)
Get-ChildItem claudedesignskills -Directory -Recurse -Depth 2 | Select-Object FullName

# Copier les skills un par un — adapter le chemin source selon structure observée
$skillsToCopy = @("motion-framer","motion-gsap","threejs","lottie","react-spring")
foreach ($s in $skillsToCopy) {
  $src = Get-ChildItem claudedesignskills -Recurse -Directory -Filter $s | Select-Object -First 1
  if ($src) {
    Copy-Item -Recurse -Force $src.FullName `
      "C:\Users\David\ZCodeProject\pariscore\.agents\tools\"
  }
}

# Cleanup
Remove-Item -Recurse -Force claudedesignskills
```

> ⚠️ Les skills internes ne sont peut-être pas dans une liste fixe. Inspecter
> `claudedesignskills/.claude/skills/` ou `claudedesignskills/skills/` avant.

---

### 2.2 `secondsky/claude-skills` — Collection sélective

- **Repo** : https://github.com/secondsky/claude-skills
- **Rôle** : 170 skills production-tested. À cherry-picker :
  - `motion` — Framer/Motion (drag-drop, scroll, gestures, SVG morphing)
  - `web-performance-optimization` — Core Web Vitals via Performance Observer API
- **Note** : ⭐⭐ (overlap partiel avec web-quality-skills pour la perf)

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force secondsky-claude-skills -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/secondsky/claude-skills.git secondsky-claude-skills

# Inspecter la structure
Get-ChildItem secondsky-claude-skills -Directory | Select-Object Name

# Cherry-pick ciblé (adapter le chemin selon structure observée)
@("motion","web-performance-optimization") | ForEach-Object {
  $src = Get-ChildItem secondsky-claude-skills -Recurse -Directory -Filter $_ | Select-Object -First 1
  if ($src) {
    Copy-Item -Recurse -Force $src.FullName `
      "C:\Users\David\ZCodeProject\pariscore\.agents\tools\"
  }
}

# Cleanup
Remove-Item -Recurse -Force secondsky-claude-skills
```

---

### 2.3 `awesome-design-md` — Vérifier couverture actuelle

- **Statut** : déjà installé dans `.agents/design-md/` (74 brands).
- **Action** : vérifier s'il manque des DESIGN.md clés pour la refonte tennis.

```powershell
# Voir ce qui est disponible
Get-ChildItem C:\Users\David\ZCodeProject\pariscore\.agents\design-md -Directory | Select-Object Name

# Marques recommandées pour refonte tennis (vérifier présence) :
#   - linear       (UI dense data-driven)
#   - vercel       (dashboard moderne)
#   - stripe       (data-viz soignée)
#   - claude       (cohérence avec l'écosystème)
#   - cursor       (éditeur code)
#   - apple        (minimalisme premium)
```

> Si une marque clé manque → re-clone le repo et copier le dossier manquant.

---

### 2.4 `code-migration-kit` (Anthropic officiel)

- **Repo** : https://github.com/anthropics/code-migration-kit-with-claude-code
- **Rôle** : Prompts/templates/scripts pour migrations de langage à grande échelle.
- **Pourquoi** : migration legacy `pariscore.html` (vanilla JS, 1.5 MB) → React.
  Backlog ancien (dépréciation monolithe `server.js` 52 435 lignes).
- **Note** : ⭐ (utile pour la grosse dette legacy, pas urgent pour refonte UI)

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force code-migration-kit -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/anthropics/code-migration-kit-with-claude-code.git code-migration-kit

# Inspecter la structure
Get-ChildItem code-migration-kit -Directory | Select-Object Name

# Copier comme resource (pas comme skill — ce sont des prompts/templates)
New-Item -ItemType Directory -Force "C:\Users\David\ZCodeProject\pariscore\.agents\code-migration-kit" | Out-Null
Copy-Item -Recurse -Force "code-migration-kit\*" `
  "C:\Users\David\ZCodeProject\pariscore\.agents\code-migration-kit\"

# Cleanup
Remove-Item -Recurse -Force code-migration-kit
```

---

### 2.5 `refactoring-agent` (xdg)

- **Repo** : https://github.com/xdg/xdg-claude (sous-dossier `refactoring-agent/`)
- **Rôle** : 2 sous-agents (un recommande, un exécute) + slash commands.
- **Pourquoi** : refactor `live-stats-panel.tsx` (303 lignes) et `match-detail-dialog.tsx`
  (508 lignes) proprement.
- **Note** : ⭐ niche mais bien fichu

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force xdg-claude -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/xdg/xdg-claude.git

# Le plugin est dans refactoring-agent/
Get-ChildItem xdg-claude\refactoring-agent -Recurse | Select-Object FullName

# Copier comme skill
New-Item -ItemType Directory -Force "C:\Users\David\ZCodeProject\pariscore\.agents\tools\refactoring-agent" | Out-Null
Copy-Item -Recurse -Force "xdg-claude\refactoring-agent\*" `
  "C:\Users\David\ZCodeProject\pariscore\.agents\tools\refactoring-agent\"

# Cleanup
Remove-Item -Recurse -Force xdg-claude
```

---

### 2.6 Collections à connaître (cherry-pick possible)

| Collection | Repo | Ce qu'elle contient |
|---|---|---|
| **VoltAgent/awesome-claude-code-subagents** | https://github.com/VoltAgent/awesome-claude-code-subagents ⭐23k | 100+ sub-agents : `frontend-developer`, `ui-designer`, `design-bridge`, `fullstack-developer` |
| **wshobson/agents** | https://github.com/wshobson/agents ⭐34k | 94 plugins, 175 skills, 109 commands. Plugin `frontend-mobile-development` |
| **rex-diego/everything-claude-code** | https://github.com/rex-diego/everything-claude-code | 48 agents + 182 skills (gagnant Anthropic Hackathon). Inclut `a11y-architect` |
| **anthropics/skills** | https://github.com/anthropics/skills | 17 skills officiels (voir 2.7) |

> Ces collections sont massives. Ne PAS tout installer — cherry-picker uniquement
> ce qui manque dans ta stack. Voir `wshobson/agents` pour `responsive-design`
> (container queries, fluid typography, mobile-first).

---

### 2.7 `anthropics/skills` (officiels Anthropic)

- **Repo** : https://github.com/anthropics/skills
- **Rôle** : 17 skills officiels Anthropic. Pertinents pour la refonte :
  - `webapp-testing` — Playwright avancé (complète `playwright-mcp`)
  - `mcp-builder` — créer ses propres MCP
  - `theme-factory` — génération de thèmes
  - `canvas-design` — design créatif (bannières, visuels)
  - `algorithmic-art` — art génératif (utile pour hero/bannière tennis)
- **Note** : ⭐⭐ (officiels, bien faits)

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force anthropic-skills -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/anthropics/skills.git anthropic-skills

# Inspecter les skills dispo
Get-ChildItem anthropic-skills\skills -Directory | Select-Object Name

# Cherry-pick les 3 plus utiles pour la refonte tennis
@("webapp-testing","theme-factory","canvas-design") | ForEach-Object {
  $src = "anthropic-skills\skills\$_"
  if (Test-Path $src) {
    Copy-Item -Recurse -Force $src `
      "C:\Users\David\ZCodeProject\pariscore\.agents\tools\"
  }
}

# Cleanup
Remove-Item -Recurse -Force anthropic-skills
```

---

## 🥉 TIER 3 — MCP servers (nouvelle catégorie d'outils)

> Les MCP sont des **servers** qui ajoutent des tools à ZCode. Ils se configurent
> dans `.mcp.json` (déjà 11 serveurs installés). Contrairement aux skills, ils ne
> vont PAS dans `.agents/tools/`.

### 3.1 ⭐ Context7 — doc live versionnée

- **Repo** : https://github.com/upstash/context7 ⭐59k
- **Rôle** : Injecte la doc à jour de React 19, Next.js 16, Tailwind v4, shadcn
  directement dans le prompt → évite l'IA qui code en API obsolètes.
- **Pourquoi** : stack bleeding-edge → indispensable. Évite code Next 14 / Tailwind v3.

**Install** — ajouter dans `.mcp.json` :

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

---

### 3.2 ⭐ Chrome DevTools MCP (officiel Google)

- **Repo** : https://github.com/ChromeDevTools/chrome-devtools-mcp ⭐47k
- **Rôle** : Pilote un Chrome réel via DevTools Protocol : inspecter DOM vivant,
  performance tracing, screenshots, console, network.
- **Pourquoi** : debug visuel temps réel. Complément de Playwright (E2E) pour le
  debug interactif.

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

---

### 3.3 ⭐ 21st.dev Magic MCP

- **Repo** : https://github.com/21st-dev/magic-mcp ⭐5.5k
- **Rôle** : "v0 inside ZCode" — génère des composants UI premium (landing, hero,
  cards) depuis du langage naturel.
- **Pourquoi** : idéal pour le hero page d'accueil tennis avec rendu premium.

```json
{
  "mcpServers": {
    "magic21": {
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@latest"],
      "env": { "TWENTYFIRST_API_KEY": "<ta-clé-gratuite-21st-dev>" }
    }
  }
}
```

> S'inscrire sur https://21st.dev pour la clé API (gratuit).

---

### 3.4 ⭐ shadcn/ui MCP (communauté)

- **Repo** : https://github.com/JpisNice/shadcn-ui-mcp-server ⭐2.9k
- **Rôle** : Donne à l'agent accès aux composants, blocks, démos shadcn/ui v4.
- **Pourquoi** : ta stack exacte est shadcn/ui → l'agent aura les bonnes commandes
  CLI et signatures de composants.

```json
{
  "mcpServers": {
    "shadcn-ui": {
      "command": "npx",
      "args": ["-y", "shadcn-ui-mcp-server"]
    }
  }
}
```

> Alternative : MCP officiel shadcn documenté sur https://ui.shadcn.com/docs/mcp.

---

### 3.5 🟡 Browser Tools MCP

- **Repo** : https://github.com/AgentDeskAI/browser-tools-mcp ⭐7k
- **Rôle** : Extension Chrome + MCP : capture console, erreurs réseau, screenshots,
  selectors depuis ton navigateur.
- **Pourquoi** : pendant la refonte, si un composant casse, l'agent voit l'erreur
  console + le DOM exact.

```json
{
  "mcpServers": {
    "browser-tools": {
      "command": "npx",
      "args": ["@agentdeskai/browser-tools-server@latest"]
    }
  }
}
```

> ⚠️ Nécessite aussi l'extension Chrome "BrowserToolsMCP" à installer côté navigateur.

---

### 3.6 🟡 Figma Context MCP (Framelink)

- **Repo** : https://github.com/GLips/Figma-Context-MCP ⭐15k
- **Rôle** : Traduit les données Figma pour l'IA → génère du code JSX fidèle au design.
- **Pourquoi** : utile SI tu as des maquettes Figma de l'UI tennis.
- **Note** : skip si pas de workflow Figma.

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["figma-developer-mcp", "--figma-api-key=KEY", "--stdio"],
      "env": { "FIGMA_API_KEY": "<ta-clé-figma>" }
    }
  }
}
```

---

### 3.7 🟡 Lighthouse MCP

- **Repo** : https://github.com/danielsogl/lighthouse-mcp-server
- **Rôle** : Audit Lighthouse complet piloté par IA (perf, a11y, SEO, CWV).
- **Pourquoi** : mesurer LCP/INP/CLS des pages denses.

```json
{
  "mcpServers": {
    "lighthouse": {
      "command": "npx",
      "args": ["-y", "@danielsogl/lighthouse-mcp-server"]
    }
  }
}
```

---

### 3.8 🟡 Axe MCP (Deque officiel)

- **Lien** : https://www.deque.com/axe/mcp-server/
- **Rôle** : Audit WCAG automatique via axe-core.
- **Pourquoi** : complément des skills `accessibility` / `accessibility-agents`.

> Voir la doc Deque pour l'install (variable selon contexte). Alternative
> communautaire : https://github.com/priyankark/a11y-mcp via `uvx`.

---

### 3.9 🟡 Storybook MCP (officiel)

- **Repo** : https://github.com/storybookjs/mcp
- **Rôle** : Expose stories/props/composants Storybook à l'agent.
- **Pourquoi** : SI tu montes un Storybook pour le design system tennis.

```json
{
  "mcpServers": {
    "storybook": {
      "command": "npx",
      "args": ["storybook-mcp@latest"]
    }
  }
}
```

---

### 3.10 🟡 Magic UI MCP (officiel)

- **Repo** : https://github.com/magicuidesign/mcp
- **Rôle** : 150+ composants animés Magic UI (Motion + Tailwind) recherchables.
- **Pourquoi** : animations scores live, transitions.

> Voir https://magicui.design/docs/mcp pour l'install.

---

### 3.11 🟢 ECharts MCP

- **Repo** : https://github.com/hustcc/mcp-echarts (ou apache/echarts-mcp)
- **Rôle** : Génération charts ECharts via IA.
- **Pourquoi** : si tu choisis ECharts pour momentum/WinProbability (Recharts rame
  sur gros datasets — recharts#6574).

```json
{
  "mcpServers": {
    "echarts": {
      "command": "npx",
      "args": ["-y", "mcp-echarts"]
    }
  }
}
```

---

## 🚫 MCP qui n'existent PAS (vérifié — ne pas chercher)

| MCP présumé | Statut réel |
|---|---|
| `tailwind-mcp` officiel | ❌ Discussion ouverte #19737 côté TailwindLabs. Utiliser **Context7** pour la doc Tailwind v4. |
| `framer-motion-mcp` mature | ❌ Seul `Abhishekrajpurohit/motion-dev-mcp` (13 stars). Utiliser [Motion AI Kit](https://motion.dev/docs/ai-kit-context) + Context7. |
| `v0-mcp` standalone | ❌ v0 via UI Vercel uniquement. Équivalent = **21st.dev Magic**. |
| `recharts-mcp` / `nivo-mcp` | ❌ Aucun. Seul ECharts a un MCP. |
| `responsively-mcp` | ❌ N'existe pas. Chrome DevTools MCP le couvre. |
| `nextjs-mcp` standalone | ❌ Pas de repo officiel. Context7 donne la doc Next 16. |

---

## 🎯 TIER 1 BIS synthèse — priorité max pour la refonte tennis

**À installer AVANT de commencer Phase 1 du plan de refonte** :

1. ⭐⭐⭐ `frontend-design` (Anthropic officiel) — base anti-AI-slop
2. ⭐⭐⭐ `accessibility-agents` (11 spécialistes WCAG 2.2 AA)
3. ⭐⭐⭐ MCP **Context7** — doc live (anti-code obsolète)
4. ⭐⭐⭐ MCP **Chrome DevTools** — debug visuel temps réel

**Total** : 2 skills + 2 MCP. Couvre la base critique pour démarrer la refonte.

---

## ⚙️ Procédure universelle — installer un skill

### Méthode A — Skill avec `SKILL.md` à la racine du repo (cas simple)

```powershell
# 1. Cloner dans temp
cd $env:TEMP
Remove-Item -Recurse -Force <repo-name> -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/<org>/<repo>.git

# 2. Retirer le .git interne (évite conflit dans le mono-repo pariscore)
Remove-Item -Recurse -Force <repo-name>\.git

# 3. Copier dans .agents/tools/
Copy-Item -Recurse -Force <repo-name> `
  C:\Users\David\ZCodeProject\pariscore\.agents\tools\

# 4. Synchroniser l'allowlist OpenCode
cd C:\Users\David\ZCodeProject\pariscore
node scripts\sync-skills.js
node scripts\sync-skills.js --verify-junction

# 5. Cleanup
cd $env:TEMP
Remove-Item -Recurse -Force <repo-name>

# 6. Redémarrer ZCode pour la découverte
```

### Méthode B — Skill dans un sous-dossier du repo (cherry-pick)

```powershell
cd $env:TEMP
Remove-Item -Recurse -Force <repo-name> -ErrorAction SilentlyContinue
git clone --depth 1 https://github.com/<org>/<repo>.git

# Inspecter la structure pour trouver le SKILL.md
Get-ChildItem <repo-name> -Recurse -Filter "SKILL.md" | Select-Object FullName

# Copier le bon sous-dossier
Copy-Item -Recurse -Force <repo-name>\<chemin>\<skill-name> `
  C:\Users\David\ZCodeProject\pariscore\.agents\tools\<skill-name>

# Sync + verify + cleanup (voir Méthode A étapes 4-6)
```

### Méthode C — MCP server (différent : va dans `.mcp.json`)

```powershell
# 1. Tester que le package npm existe
npx -y <package>@latest --version

# 2. Éditer .mcp.json — ajouter une entrée dans "mcpServers"
notepad C:\Users\David\ZCodeProject\pariscore\.mcp.json

# 3. Valider le JSON
node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf-8')); console.log('✓ .mcp.json valide')"

# 4. Redémarrer ZCode (les MCP se chargent au démarrage)
```

---

## 📋 Checklist post-install (à lancer après chaque ajout)

```powershell
cd C:\Users\David\ZCodeProject\pariscore

# 1. Compter les skills (doit augmenter)
$skills = Get-ChildItem .agents\tools -Directory | Where-Object { Test-Path "$($_.FullName)\SKILL.md" }
Write-Host "Skills total: $($skills.Count)"

# 2. Vérifier la junction
node scripts\sync-skills.js --verify-junction

# 3. Synchroniser allowlist
node scripts\sync-skills.js

# 4. Lister les nouveaux skills installés récemment (tri date)
Get-ChildItem .agents\tools -Directory | 
  Sort-Object LastWriteTime -Descending | 
  Select-Object -First 10 Name, LastWriteTime

# 5. Valider .mcp.json si ajout de MCP
node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf-8')); console.log('✓ .mcp.json valide')"

# 6. Redémarrer ZCode (fermer/rouvrir la fenêtre)
```

---

## 🧪 Tester un skill fraîchement installé

Dans une nouvelle session ZCode, taper :

```
Utilise <skill-name> pour [tâche spécifique].
```

Exemples concrets :

```
Utilise frontend-design pour auditer ma carte tennis src/components/tennis/match-card.tsx 
et identifier 3 améliorations esthétiques majeures.

Utilise accessibility-agents pour vérifier la conformité WCAG 2.2 AA 
de mes tableaux de scores live.

Utilise tufte-data-viz pour proposer 3 visualisations Recharts 
comparant les stats de service de deux joueurs.

Utilise motion-framer pour animer le passage de "prematch" à "live" 
sur la match card quand un match démarre.
```

---

## 🔄 Équivalences Unix (Git Bash) → PowerShell

| Unix | PowerShell | Note |
|---|---|---|
| `rm -rf <path>` | `Remove-Item -Recurse -Force <path>` | Ajouter `-ErrorAction SilentlyContinue` si le path n'existe pas |
| `cp -rf <src> <dst>` | `Copy-Item -Recurse -Force <src> <dst>` | |
| `cp -rf src/* dst/` | `Copy-Item -Recurse -Force "src\*" "dst\"` | `\*` important pour le contenu |
| `mkdir -p <path>` | `New-Item -ItemType Directory -Force <path> \| Out-Null` | |
| `/tmp/...` | `$env:TEMP\...` | `%TEMP%` Windows |
| `\` (continuation ligne) | `` ` `` (backtick) | **PAS apostrophe** |
| `cd /tmp` | `cd $env:TEMP` | |
| `for x in a b; do ...; done` | `@("a","b") \| ForEach-Object { ... }` | |
| `find . -name X` | `Get-ChildItem -Recurse -Filter X` | |
| `ls \| grep X` | `Get-ChildItem \| Where-Object { $_.Name -match "X" }` | |

---

## ⚠️ Pièges à connaître

| Piège | Solution |
|---|---|
| **`Remove-Item -rf`** n'existe pas | Toujours `-Recurse -Force` (mots complets) |
| **`cp -rf` → erreur "A parameter cannot be found"** | Tu es en PowerShell ! Utiliser `Copy-Item -Recurse -Force` |
| **`git clone` dans `$env:TEMP`** | Le cwd se reset parfois — utiliser `cd $env:TEMP` à chaque étape |
| **Skill non découvert après install** | Vérifier qu'il y a bien un `SKILL.md` à la racine du dossier dans `.agents/tools/` |
| **Structure interne d'un repo inconnue** | `Get-ChildItem -Recurse -Filter "SKILL.md"` avant de copier |
| **`sync-skills.js` plantait avant** | Bug corrigé en Tier 1 (`opencode.json` → `.opencode/opencode.json`). Maintenant OK. |
| **MCP non chargé après ajout dans `.mcp.json`** | Les MCP se chargent au DÉMARRAGE de ZCode → redémarrer obligatoire |
| **`cp` récursif écrase sans warning** | PowerShell `Copy-Item -Force` aussi — bien vérifier le chemin destination |

---

## 📚 Sources principales

- [anthropics/skills](https://github.com/anthropics/skills) — skills officiels Anthropic
- [anthropics/claude-code/plugins/frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) — skill officiel frontend
- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) — 100+ sub-agents
- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — 74 DESIGN.md marques
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — index 1000+ skills
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — awesome-list curée
- [finfin/awesome-frontend-skills](https://github.com/finfin/awesome-frontend-skills) — 70+ skills frontend
- [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills) — 67 design SKILL.md
- [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) — index MCP complet
- [Composio top design skills](https://composio.dev/content/top-design-skills)
- [Firecrawl best skills 2026](https://www.firecrawl.dev/blog/best-claude-code-skills)
- [Builder.io best MCP 2026](https://www.builder.io/blog/best-mcp-servers-2026)
- [The New Stack 10 MCP frontend](https://thenewstack.io/10-mcp-servers-for-frontend-developers/)
- [Anthropic blog: Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills)

---

## 📌 Résumé exécutif

| Tiers | Nb | Priorité pour refonte tennis | Action recommandée |
|---|---|---|---|
| **Tier 1 BIS** | 2 skills + 2 MCP | 🔴 CRITICAL — installer avant Phase 1 | `frontend-design`, `accessibility-agents`, MCP Context7, MCP Chrome DevTools |
| **Tier 2** | ~6 skills + 5 MCP | 🟡 selon besoin | `claudedesignskills` (motion), `secondsky` (motion/perf), MCP Magic21, shadcn, Lighthouse, Figma |
| **Tier 3** | ~3 MCP niche | 🟢 bonus | MCP Storybook, Magic UI, ECharts |

**Prochaine action concrète** : exécuter la section "TIER 1 BIS" ci-dessus avant de
commencer Phase 1 du plan de refonte tennis (dans `todo.md`).

---

*Document généré le 2026-07-20 — vérifier la fraîcheur des repos (étoiles, derniers
commits) avant install, surtout pour les MCP qui évoluent vite.*
