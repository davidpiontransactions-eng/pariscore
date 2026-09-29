// Plugin PariScore — outil shell de secours (oc_bash absent de certaines sessions).
// spawn(command, {shell:true}) : Windows → cmd.exe /d /s /c "command" avec arguments
// VERBATIM — les guillemets de la commande passent intacts (l'ancien pattern
// spawn("cmd.exe", ["/d","/s","/c",cmd], {shell:false}) ré-échappait " en \" à la
// MSVCRT et cassait toute commande contenant des guillemets, cf. entry 95).
// POSIX → /bin/sh -c. Timeout, cap output, kill arbre Windows via taskkill.
// CMD uniquement (bash freeze — AGENTS.md).

import { spawn } from "node:child_process"
import { type Plugin, tool } from "@opencode-ai/plugin"
import type { Plugin as PluginV2 } from "@opencode/plugin"

interface ExecInput {
  command: string
  cwd?: string
  timeoutSeconds?: number
}

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

const DEFAULT_TIMEOUT_S = 180
const MAX_TIMEOUT_MS = 600_000
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024

function runCommand(command: string, cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<RunResult> {
  // shell:true → Windows : cmd.exe /d /s /c "command", arguments VERBATIM
  // (windowsVerbatimArguments en interne) : /d désactive AutoRun, /s fait strip
  // des seules quotes externes, les guillemets internes restent littéraux.
  const isWin = process.platform === "win32"
  const GRACE_MS = 2_000 // après exit : délai laissé aux streams avant résolution forcée

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: process.env,
      shell: true,
      detached: true,
      windowsHide: true,
    })
    child.stdin.end()

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let outputBytes = 0
    let settled = false
    let closed = false
    let exitCode: number | null = null
    let killedBySignal: NodeJS.Signals | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let graceTimer: ReturnType<typeof setTimeout> | undefined
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined
    let onAbort: (() => void) | undefined

    const finish = (cb: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(graceTimer)
      if (onAbort) signal?.removeEventListener("abort", onAbort)
      cb()
    }

    const killTree = (): void => {
      if (closed || child.pid === undefined) return
      if (isWin) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
        return
      }
      try {
        process.kill(-child.pid, "SIGTERM")
      } catch {
        child.kill("SIGTERM")
      }
    }

    const terminate = (): void => {
      if (closed) return
      killTree()
      forceKillTimer ??= setTimeout(() => {
        if (!closed) killTree()
      }, 3_000)
    }

    const guard = (chunks: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.byteLength
      if (outputBytes > MAX_OUTPUT_BYTES) {
        terminate()
        finish(() => reject(new Error(`Sortie dépassant ${MAX_OUTPUT_BYTES} octets — commande arrêtée.`)))
        return
      }
      chunks.push(chunk)
    }

    const settleWithResult = (): void => {
      closed = true
      finish(() => {
        const stdout = Buffer.concat(stdoutChunks).toString("utf8")
        const stderr = Buffer.concat(stderrChunks).toString("utf8")
        resolve({ stdout, stderr, exitCode: exitCode ?? (killedBySignal ? 137 : 1) })
      })
    }

    child.stdout.on("data", (c: Buffer) => guard(stdoutChunks, c))
    child.stderr.on("data", (c: Buffer) => guard(stderrChunks, c))

    child.on("error", (err) => {
      finish(() => reject(new Error(err.message.includes("ENOENT") ? `Shell introuvable : ${isWin ? "cmd.exe" : "/bin/sh"}` : err.message)))
    })

    child.on("exit", (code, signalKilled) => {
      // Anti-hang pipelines : cmd.exe peut sortir alors qu'un petit-fils tient
      // encore les handles stdio → « close » n'arrive jamais. On résout après
      // une période de grâce avec la sortie collectée, sans kill des survivants.
      exitCode = code
      killedBySignal = signalKilled ?? null
      graceTimer = setTimeout(() => {
        if (!closed) {
          try {
            child.stdout.destroy()
            child.stderr.destroy()
          } catch {
            /* déjà détruits */
          }
          settleWithResult()
        }
      }, GRACE_MS)
    })

    child.on("close", (code, signalKilled) => {
      clearTimeout(graceTimer)
      exitCode = code
      killedBySignal = signalKilled ?? killedBySignal
      settleWithResult()
    })

    onAbort = (): void => {
      terminate()
      finish(() => reject(new Error("Commande annulée par l'agent.")))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
      return
    }

    timer = setTimeout(() => {
      terminate()
      finish(() => reject(new Error(`Timeout après ${Math.round(timeoutMs / 1000)}s.`)))
    }, timeoutMs)
  })
}

function formatResult(result: RunResult): string {
  const parts: string[] = []
  if (result.stdout) parts.push(result.stdout.trimEnd())
  if (result.stderr) parts.push(result.stderr.trimEnd())
  parts.push(`\n[exit ${result.exitCode}]`)
  return parts.filter(Boolean).join("\n")
}

const PS_SHELL_DESCRIPTION =
  "Exécute une commande shell LOCALE (CMD sur Windows — jamais de syntaxe Bash : " +
  "pas de $VAR, ls, cat, 2>/dev/null ; utiliser dir, type, %VAR%, 2>nul). " +
  "Remplace oc_bash quand celui-ci est absent. Timeout max 600s, sortie max 5 Mo. " +
  "Usage : bun run typecheck, bun run lint, git status, bun run scripts/…"

const execInputSchema = {
  type: "object",
  properties: {
    command: { type: "string", description: "Commande à exécuter (syntaxe CMD sur Windows)." },
    cwd: { type: "string", description: "Répertoire de travail (défaut : racine du projet/session)." },
    timeoutSeconds: { type: "integer", minimum: 1, maximum: 600, description: "Timeout en secondes (défaut 180, max 600)." },
  },
  required: ["command"],
  additionalProperties: false,
}

// ── OpenCode 1.x ─────────────────────────────────────────────────────────────

export const PsShellPlugin: Plugin = async ({ worktree }) => {
  return {
    tool: {
      ps_shell: tool({
        description: PS_SHELL_DESCRIPTION,
        args: {
          command: tool.schema.string().describe("Commande à exécuter (syntaxe CMD sur Windows)."),
          cwd: tool.schema.string().optional().describe("Répertoire de travail (défaut : racine du projet)."),
          timeoutSeconds: tool.schema.number().int().positive().optional().describe("Timeout en secondes (défaut 180, max 600)."),
        },
        async execute(args, context) {
          const input = args as ExecInput
          const cwd = input.cwd || context.worktree || context.directory || worktree
          const timeoutMs = Math.min((input.timeoutSeconds ?? DEFAULT_TIMEOUT_S) * 1000, MAX_TIMEOUT_MS)
          try {
            const result = await runCommand(input.command, cwd, timeoutMs, context.abort)
            return formatResult(result)
          } catch (err) {
            return `ERREUR ps_shell : ${err instanceof Error ? err.message : String(err)}`
          }
        },
      }),
    },
  }
}

// ── OpenCode 2.x ─────────────────────────────────────────────────────────────

async function resolveSessionCwd(ctx: PluginV2.Context, sessionID: string): Promise<string> {
  try {
    const session = await ctx.session.get({ sessionID })
    const directory = session.location.directory
    const subpath = session.subpath
    return subpath === undefined || subpath === "" ? directory : joinPath(directory, subpath)
  } catch {
    return ctx.location.directory
  }
}

function joinPath(dir: string, sub: string): string {
  return dir.endsWith("/") || dir.endsWith("\\") ? dir + sub : dir + (process.platform === "win32" ? "\\" : "/") + sub
}

async function setupV2(ctx: PluginV2.Context): Promise<void> {
  await ctx.tool.transform((editor) => {
    editor.add({
      name: "ps_shell",
      description: PS_SHELL_DESCRIPTION,
      input: execInputSchema,
      execute: async (input, toolCtx) => {
        const execInput = input as ExecInput
        const cwd = execInput.cwd || (await resolveSessionCwd(ctx, toolCtx.sessionID))
        const timeoutMs = Math.min((execInput.timeoutSeconds ?? DEFAULT_TIMEOUT_S) * 1000, MAX_TIMEOUT_MS)
        try {
          const result = await runCommand(execInput.command, cwd, timeoutMs)
          return { content: formatResult(result) }
        } catch (err) {
          return { content: `ERREUR ps_shell : ${err instanceof Error ? err.message : String(err)}` }
        }
      },
    })
  })
}

export default {
  id: "ps-shell",
  setup: setupV2,
  server: PsShellPlugin,
}
