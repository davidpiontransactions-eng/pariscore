/**
 * Bridge Node → Scrapling stealth (Camoufox) pour le scrap LiveTV.
 *
 * LiveTV (livetv902.me) renvoie HTTP 451 / 403 depuis les IP de datacenter.
 * Le fallback lance `scripts/livetv-stealth-fetch.py` (Spyder Camoufox,
 * fingerprint navigateur réaliste + proxy optionnel) et restitue le HTML.
 *
 * Feature-flag : `SCRAPLING_ENABLED=true` + `SCRAPLING_PROXY_URL=<proxy résidentiel>`
 * (proxy recommandé si le blocage est géographique/IP, pas seulement anti-bot).
 */

import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./api-error";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "livetv-stealth-fetch.py");
const STEALTH_TIMEOUT_MS = 90_000;

export function isScraplingStealthEnabled(): boolean {
  return process.env.SCRAPLING_ENABLED === "true";
}

function resolvePython(): string {
  return process.env.SCRAPLING_PYTHON || (process.platform === "win32" ? "python" : "python3");
}

/**
 * Fetch furtif d'une URL via Camoufox. Lance le script Python, lit le
 * fichier HTML temporaire qu'il produit, le supprime, retourne le contenu.
 * Lève `AppError` (code LIVETV_STEALTH_FAIL) si Camoufox/estimago échoue.
 */
export async function stealthFetchHtml(url: string): Promise<string> {
  const argv = [SCRIPT_PATH, url, "--timeout", String(STEALTH_TIMEOUT_MS)];
  const proxy = process.env.SCRAPLING_PROXY_URL;
  if (proxy) argv.push("--proxy", proxy);

  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      resolvePython(),
      argv,
      { timeout: STEALTH_TIMEOUT_MS + 20_000, maxBuffer: 512 * 1024 },
      (error, out) => {
        if (error) {
          reject(
            new AppError("LIVETV_STEALTH_FAIL", `scrapling: ${error.message}`, 502),
          );
          return;
        }
        resolve(out);
      },
    );
  });

  const line = stdout
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("{"));
  if (!line) {
    throw new AppError("LIVETV_STEALTH_FAIL", "scrapling: sortie JSON absente", 502);
  }

  let parsed: { ok?: boolean; path?: string; error?: string; status?: number | null };
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new AppError("LIVETV_STEALTH_FAIL", "scrapling: JSON invalide", 502);
  }

  if (!parsed.ok || !parsed.path) {
    throw new AppError(
      "LIVETV_STEALTH_FAIL",
      `scrapling: ${parsed.error ?? "status inconnu"} (${parsed.status ?? "?"})`,
      502,
    );
  }

  const html = await readFile(parsed.path, "utf8");
  await unlink(parsed.path).catch(() => {});
  return html;
}