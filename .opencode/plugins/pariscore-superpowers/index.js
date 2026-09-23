/**
 * PariScore Superpowers Plugin for OpenCode.ai
 *
 * Auto-injects bootstrap context via message transform.
 * Registers skills directory via config hook.
 * Inspired by obra/superpowers plugin architecture.
 */

import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple frontmatter extraction
const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };
  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};
  for (const line of frontmatterStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line
        .slice(colonIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      frontmatter[key] = value;
    }
  }
  return { frontmatter, content: body };
};

// Normalize path
const normalizePath = (p, homeDir) => {
  if (!p || typeof p !== "string") return null;
  let normalized = p.trim();
  if (!normalized) return null;
  if (normalized.startsWith("~/")) {
    normalized = path.join(homeDir, normalized.slice(2));
  } else if (normalized === "~") {
    normalized = homeDir;
  }
  return path.resolve(normalized);
};

// Module-level cache for bootstrap content
let _bootstrapCache = undefined;

export const PariScoreSuperpowersPlugin = async ({ client, directory }) => {
  const homeDir = os.homedir();
  const superpowersSkillsDir = path.resolve(
    __dirname,
    "../../skills",
  );
  const envConfigDir = normalizePath(process.env.OPENCODE_CONFIG_DIR, homeDir);
  const configDir = envConfigDir || path.join(homeDir, ".config/opencode");

  // Helper to generate bootstrap content (cached after first call)
  const getBootstrapContent = () => {
    if (_bootstrapCache !== undefined) return _bootstrapCache;

    // Try to load using-superpowers skill
    const skillPath = path.join(
      superpowersSkillsDir,
      "using-superpowers",
      "SKILL.md",
    );
    if (!fs.existsSync(skillPath)) {
      _bootstrapCache = null;
      return null;
    }

    const fullContent = fs.readFileSync(skillPath, "utf8");
    const { content } = extractAndStripFrontmatter(fullContent);

    // Caveman skill — mode communication obligatoire dès le démarrage
    let cavemanBlock = "";
    const cavemanPath = path.join(directory, ".opencode", "skills", "caveman", "SKILL.md");
    if (fs.existsSync(cavemanPath)) {
      const cavemanRaw = fs.readFileSync(cavemanPath, "utf8");
      const { content: cavemanBody } = extractAndStripFrontmatter(cavemanRaw);
      cavemanBlock = `

## CAVEMAN MODE — OBLIGATOIRE (chargé au démarrage)

Apply the caveman skill below to EVERY response (telegraphic, minimal tokens).
Active from this session until the user says "normal mode".

${cavemanBody}`;
    }

    // PariScore-specific tool mapping
    const toolMapping = `**Tool Mapping for OpenCode (PariScore):**
When skills request actions, substitute OpenCode equivalents:
- Create or update todos → \`todowrite\`
- \`Subagent (general-purpose):\` → \`task\` with \`subagent_type: "general"\`
- Invoke a skill → OpenCode's native \`skill\` tool
- Read files → \`read\`
- Create, edit, or delete files → \`apply_patch\` or \`write\`/\`edit\`
- Run shell commands → \`oc_bash\` (CMD, NOT bash — bash freezes on Windows) ; si absent : \`ps_shell\` (plugin de secours, même syntaxe CMD)
- Search files → \`grep\`, \`oc_glob\`
- Fetch a URL → \`webfetch\`

**CRITICAL PariScore conventions:**
- Always use CMD syntax, never bash (Windows environment)
- Use \`oc_bash\` not \`bash\` (bash tool is disabled) ; fallback \`ps_shell\`
- Project: Next.js 16 + Bun + React 19 + Prisma
- Skills in \`.agents/tools-active/\` ; runtime Bun → commands \`bun run lint\`, \`bun run typecheck\` (skill bun-runtime)`;

    _bootstrapCache = `<EXTREMELY_IMPORTANT>
You have PariScore Superpowers — a structured development methodology.

**SUPERPOWERS = SYSTÉMATIQUES (injecté au démarrage de CHAQUE session).**
Applique using-superpowers à CHAQUE tâche, même si l'utilisateur ne l'invoque pas :
- tâche créative (feature/composant) → brainstorming d'abord
- bug/regression → systematic-debugging / diagnosing-bugs avant fix
- édition de code → research (Grep/Glob/Read) avant d'écrire
- avant de dire "fait" → verification-before-completion (gates exécutés, output lu)
- ≥2 tâches indépendantes → dispatching-parallel-agents (task tool)
- gros plan → writing-plans puis executing-plans
Les skills vivent dans le skill tool + .agents/tools-active/ ; charge-les via \`skill\` quand la tâche matche leur description.

**IMPORTANT: The using-superpowers skill content is included below. It is ALREADY LOADED — you are currently following it. Do NOT use the skill tool to load "using-superpowers" again — that would be redundant.**

${content}

${toolMapping}${cavemanBlock}
</EXTREMELY_IMPORTANT>`;

    return _bootstrapCache;
  };

  return {
    // Inject skills path into live config
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(superpowersSkillsDir)) {
        config.skills.paths.push(superpowersSkillsDir);
      }
    },

    // Inject bootstrap into the first user message of each session
    "experimental.chat.messages.transform": async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages.length) return;
      const firstUser = output.messages.find((m) => m.info.role === "user");
      if (!firstUser || !firstUser.parts.length) return;

      // Guard: skip if already injected
      if (
        firstUser.parts.some(
          (p) => p.type === "text" && p.text.includes("EXTREMELY_IMPORTANT"),
        )
      )
        return;

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        ...ref,
        type: "text",
        text: bootstrap,
      });
    },
  };
};

// Export nommé + default : sûr quel que soit le mode de résolution du loader plugin
export default PariScoreSuperpowersPlugin;
