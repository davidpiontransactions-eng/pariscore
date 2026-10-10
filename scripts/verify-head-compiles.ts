/**
 * Vérifie que le commit à pousser **compile**, et non le working tree.
 *
 * ## Le problème que ce script existe pour régler
 *
 * `bun run typecheck` typecheck le **working tree**. Or ce dépôt est modifié en
 * permanence par plusieurs sessions en parallèle : le working tree contient
 * régulièrement des changements non commités d'une autre session.
 *
 * Conséquence observée deux fois le 2026-10-10 :
 *   1. Une route non trackée a été commitée alors qu'elle importait
 *      `fetchBSDFootballFinishedRange` — présent dans le working tree, **absent de
 *      HEAD**. `tsc` : 0 erreur. `next build` sur le VPS : échec, rollback auto.
 *   2. Symétriquement, un commit peut « emprunter » un symbole d'une autre session et
 *      casser le build de tout le monde.
 *
 * Ni `tsc` ni `bun run lint` ne voit ce problème : ils regardent tous deux le working
 * tree. Le filet qui l'a rattrapé est le **rollback automatique du deploy runner** — mais
 * il agit **après** le push, donc sur `origin/main`.
 *
 * ## La solution
 *
 * On compile l'arbre **commité** dans un worktree jetable. Le worktree est créé
 * *à l'intérieur* du dépôt : la résolution de modules Node remonte l'arborescence et
 * trouve le `node_modules` du parent — pas de copie, pas d'installation, pas de
 * `node_modules` dupliqué à 1 Go.
 *
 * Usage :
 *   bun scripts/verify-head-compiles.ts          # vérifie HEAD
 *   bun scripts/verify-head-compiles.ts <ref>    # vérifie une autre ref
 *
 * Sortie : exit 0 si l'arbre commité compile, 1 sinon (stdout détaillé).
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const REF = process.argv[2] ?? "HEAD";
const ROOT = process.cwd();
/** Worktree À L'INTÉRIEUR du dépôt : Node remonte l'arborescence et trouve node_modules. */
const DIR = join(ROOT, ".tmp-verify-head");

const sh = (cmd: string): string => execSync(cmd, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

/** `git` sans bruit : les commandes de nettoyage echouent normalement. */
const quiet = (cmd: string): string =>
  execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 });

function cleanup() {
  try {
    quiet(`git worktree remove --force "${DIR}"`);
  } catch {
    /* deja retire */
  }
  if (existsSync(DIR)) rmSync(DIR, { recursive: true, force: true });
}

cleanup();

console.log(`=== VERIFIE QUE ${REF} COMPILE ===`);
console.log(`worktree: ${DIR}`);

try {
  sh(`git worktree add --detach --no-checkout "${DIR}" ${REF}`);
  sh(`git -C "${DIR}" checkout --detach ${REF}`);
} catch (e) {
  console.error(`Echec de creation du worktree : ${String(e).split("\n")[0]}`);
  cleanup();
  process.exit(2);
}

// Le build doit avoir ses fichiers .next de developpement absents : un `.next`()
// laissé par un run local dans l'index rendrait le typecheck non représentatif.
try {
  quiet(`git -C "${DIR}" clean -xfd -e node_modules -e .next`);
} catch {
  /* rien a nettoyer */
}

const steps: { label: string; cmd: string }[] = [
  { label: "tsc --noEmit", cmd: `bun x tsc --noEmit -p "${join(DIR, 'tsconfig.json')}"` },
];

let failed = false;
const results: string[] = [];

for (const step of steps) {
  let code = 0;
  let out = "";
  try {
    out = execSync(step.cmd, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, cwd: resolve(DIR) });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    code = err.status ?? 1;
  }
  results.push(`--- ${step.label} (exit ${code}) ---\n${out.trim() || "(aucune sortie)"}`);
  if (code !== 0) failed = true;
}

cleanup();

console.log(results.join("\n\n"));
console.log(`\n=== ${failed ? "ECHEC" : "OK"} : ${REF} ${failed ? "ne compile PAS" : "compile"} ===`);

if (failed) {
  console.error(
    "\nInterpretation : le working tree compile mais l arbre commite non.\n" +
      "Soit un fichier importe est absent du commit, soit un fichier modifie par une\n" +
      "session parallele fournit un symbole que HEAD ne contient pas.",
  );
}
process.exit(failed ? 1 : 0);