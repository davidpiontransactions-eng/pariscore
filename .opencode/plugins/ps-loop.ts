/**
 * ps-loop — boucle d'ingénierie automatique pour OpenCode.
 *
 * Inspiré des « + » d'Aider (rapport `.context/rapport-fin-mission-aider-2026-09-25.md`),
 * adaptés à notre config (Windows/CMD, gates obligatoires, graphe local).
 *
 * 1. `tool.execute.after` sur edit/write/apply_patch → **lint ciblé automatique**
 *    (eslint sur le fichier touché, ~4 s) ; en cas d'erreur un bloc `[auto-lint]`
 *    est injecté dans la sortie de l'outil → l'agent le voit immédiatement.
 * 2. **Rafraîchissement différé du graphe** : `graphify update .` lancé en tâche de
 *    fond (détaché, non bloquant) après une salve d'éditions.
 * 3. `experimental.chat.system.transform` → rappel en tête de **chaque session** :
 *    gates obligatoires + hiérarchie docs (context7 en automatique).
 * 4. `event session.created` → vérifie que `CONTEXT7_API_KEY` est bien en env.
 * 5. `shell.env` → s'assure que `.bun\bin` est sur le PATH des shells (gates).
 *
 * Chargement : auto via `.opencode/plugins/` (aucune entrée dans opencode.json).
 * Ne pas ajouter d'entrée `plugin` : double-chargement (cf. issue sqz #10).
 */

import type { Plugin } from "@opencode-ai/plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute, resolve } from "node:path";

const execFileAsync = promisify(execFile);

const HOME = process.env.USERPROFILE || process.env.HOME || "";
const BUN = process.env.PS_LOOP_BUN || `${HOME}\\.bun\\bin\\bun.exe`;
const GRAPHIFY = process.env.PS_LOOP_GRAPHIFY || `${HOME}\\.local\\bin\\graphify.exe`;
const BUN_BIN_DIR = `${HOME}\\.bun\\bin`;

/** Fichiers que l'on sait lint (TS/JS uniquement). */
const SOURCE_RE = /\.(tsx|ts|jsx|js|mjs|cjs)$/;
/** Répertoires jamais lintés (bruit / artefacts de build). */
const SKIP_RE = /[\\/](node_modules|\.next|\.graphify|\.agents|\.opencode[\\/]node_modules|android|downloaded_files)[\\/]/;

/** Anti-rafale : un lint toutes les 1,5 s max (les sauvegardes en série ne déclenchent qu'un run). */
const LINT_DEBOUNCE_MS = 1500;
/** Boucle graphe : au moins 3 éditions et 8 min écoulées depuis le dernier refresh. */
const GRAPH_MIN_EDITS = 3;
const GRAPH_DEBOUNCE_MS = 8 * 60 * 1000;

const SYSTEM_BLOCK = [
  "[boucle auto · plugin ps-loop]",
  "• Chaque edit/write lance un lint ciblé : si un bloc [auto-lint] apparaît dans la sortie, corrige-le avant de poursuivre.",
  "• Pour conclure « done » : `bun run lint` + `bun run typecheck` doivent être à 0 erreur (bun est sur le PATH).",
  "• Après un lot important de fichiers : `graphify update .` (le plugin le lance aussi en différé).",
  "• Docs d'une lib → MCP `context7` : `resolve-library-id` puis `query-docs` (clé CONTEXT7_API_KEY en env). Ordre : skill grant → context7 → football-docs → webfetch.",
  "• Mode architecte : pendant la conception, écrire des specs/plans UNIQUEMENT — pas de code.",
  "• RAPPORT DE TÂCHE : à CHAQUE fin de tâche finie, ajouter UNE entrée en tête du tableau `.context/RAPPORT-TACHES.md` (date, tâche, bead, fichiers, vérifications, statut) PUIS donner le rapport point d'arrêt à l'utilisateur (tâche, fichiers, vérifications, bead(s), prochaine étape). 1 tâche finie = 1 maj du rapport.",
].join("\n");

let lastLintAt = 0;
let editSinceGraph = 0;
let lastGraphAt = 0;

/** Relance `graphify update .` en process détaché (jamais bloquant l'agent). */
function refreshGraph(cwd: string): void {
  try {
    const child = execFile(
      GRAPHIFY,
      ["update", "."],
      { cwd, windowsHide: true },
      () => undefined,
    );
    child.unref?.();
  } catch {
    /* graphify absent : silencieux, c'est un luxe pas une obligation */
  }
}

/** Préfixe le PATH utilisateur avec .bun\bin (insensible à la casse, jamais dupliqué). */
function ensureBunPath(env: Record<string, string>): void {
  const key = Object.keys(env).find(k => k.toUpperCase() === "PATH") ?? "PATH";
  const current = env[key] ?? "";
  if (current.toUpperCase().includes(BUN_BIN_DIR.toUpperCase())) return;
  env[key] = current ? `${BUN_BIN_DIR};${current}` : BUN_BIN_DIR;
}

const factory: Plugin = async ({ directory }) => {
  return {
    async event({ event }) {
      if (event.type === "session.created" && !process.env.CONTEXT7_API_KEY) {
        console.warn(
          "[ps-loop] CONTEXT7_API_KEY absente de l'environnement : le MCP context7 sera en rate limit.",
        );
      }
    },

    /** Rappels injectés en tête de chaque session (gates + context7 automatiques). */
    async ["experimental.chat.system.transform"](_input, output) {
      output.system.push(SYSTEM_BLOCK);
    },

    /** .bun\bin sur le PATH des shells lancés par OpenCode. */
    async ["shell.env"](_input, output) {
      try {
        ensureBunPath(output.env);
      } catch {
        /* env figé : rien à faire */
      }
    },

    /** Lint ciblé après édition + boucle graphe. */
    async ["tool.execute.after"](input, output) {
      if (input.tool !== "edit" && input.tool !== "write" && input.tool !== "apply_patch") return;

      const raw =
        input.args?.filePath ?? input.args?.path ?? input.args?.file_path ?? input.args?.filename;
      if (typeof raw !== "string" || !raw || !SOURCE_RE.test(raw)) return;
      if (SKIP_RE.test(raw)) return;

      const abs = isAbsolute(raw) ? raw : resolve(directory, raw);
      const now = Date.now();

      // --- 1. lint ciblé (debounce) ---
      if (now - lastLintAt >= LINT_DEBOUNCE_MS) {
        lastLintAt = now;
        try {
          await execFileAsync(BUN, ["x", "eslint", "--quiet", abs], {
            cwd: directory,
            timeout: 30_000,
            windowsHide: true,
            encoding: "utf8",
          });
        } catch (e) {
          const err = e as { code?: number; stdout?: string; stderr?: string; message?: string };
          const text = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
          // Timeout / binaire introuvable : on n'écrit rien plutôt que du faux positif.
          if (text && err.code !== undefined && err.code !== null) {
            const rel = abs.startsWith(directory) ? abs.slice(directory.length + 1) : abs;
            output.output += `\n\n[auto-lint] bun x eslint --quiet ${rel}\n${text.slice(0, 2500)}`;
            output.title = `${output.title ?? ""} · lint: ${err.code} erreur(s)`; // eslint-disable-line
          }
        }
      }

      // --- 2. boucle graphe (différée) ---
      editSinceGraph += 1;
      if (editSinceGraph >= GRAPH_MIN_EDITS && now - lastGraphAt > GRAPH_DEBOUNCE_MS) {
        editSinceGraph = 0;
        lastGraphAt = now;
        refreshGraph(directory);
      }
    },
  };
};

// Export V1 : id requis pour les plugins chargés depuis un fichier.
export default { id: "ps-loop", server: factory };
// Export nommé : déduplication par identité pour les loaders anciens.
export const psLoop = factory;
