import { existsSync } from "fs";
import { join, resolve } from "path";

/**
 * Résolution des fichiers de `data/` — le dossier que les crons écrivent en
 * continu, donc la source de vérité VIVANTE des données.
 *
 * ## Pourquoi une liste de racines et pas un seul `DATA_DIR`
 *
 * La prod a DEUX dossiers de donnéesalive, alimentés par deux familles de
 * crons (constaté sur le VPS le 2026-10-08) :
 *   - `/opt/pariscorebis/data`   (36 entrées) — crons hockey / oddalerts / hltv ;
 *   - `/home/ubuntu/pariscore/data` (83 entrées) — crons flashscore / tennis /
 *     snooker / football, et tous les scripts lancés depuis le dépôt.
 * Choisir l'un OU l'autre pour `DATA_DIR` affamerait l'autre famille : une
 * seule variable ne peut pas désigner deux racines. On résout donc fichier par
 * fichier, en essayant les racines dans l'ordre.
 *
 * ## Pourquoi la copie du build arrive EN DERNIER
 *
 * `next build` copie dans `.next/standalone/data/` les fichiers `data/` qu'il
 * repère (file tracing), et le serveur standalone fait
 * `process.chdir(__dirname)` → `process.cwd()` = `.next/standalone`. Sans
 * arbitrage, la copie **figée au build** passerait avant le dossier vivant et
 * l'API servirait des données périmées : chaque mise à jour de cron exigeait
 * alors un redéploiement complet. Mesuré : le 2026-10-08, le snapshot handball
 * servait `-2 h` de retard alors que le fichier du cron était frais ; cette
 * copie pesait 83 Mo.
 *
 * Les racines sous `.next/` sont donc écartées tant qu'une racine vivante
 * répond — et restent le dernier recours (build local, DATA_DIR absent).
 */

/** Racine `data/` jamais retenue comme source de vérité : copie de build. */
function isBuildCopy(dir: string): boolean {
  return /(^|[\\/])\.next([\\/]|$)/.test(dir);
}

/**
 * Racines `data/` par ordre de priorité décroissante.
 * 1. `DATA_DIR` — réglage explicite de l'opérateur ;
 * 2. les `data/` vivants trouvés en remontant depuis `cwd` (le dépôt) ;
 * 3. les copies sous `.next/` (dernier recours).
 */
export function dataDirCandidates(): string[] {
  const live: string[] = [];
  const copies: string[] = [];
  const seen = new Set<string>();
  const add = (dir: string) => {
    if (seen.has(dir)) return;
    seen.add(dir);
    (isBuildCopy(dir) ? copies : live).push(dir);
  };

  const env = process.env.DATA_DIR;
  if (env) add(env);

  // Remontée depuis cwd : couvre le dépôt (`<repo>/data`) et le runtime
  // standalone (`<repo>/.next/standalone/data`, classé copie).
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    // turbopackIgnore : `dir` est calculé (cwd remonté) — l'annotation doit
    // porter sur l'ASSEMBLAGE du chemin, pas seulement l'appel FS (rapport 224).
    const candidate = join(/*turbopackIgnore: true*/ dir, "data");
    try {
      // turbopackIgnore : candidats calculés (cwd remonté) — sans cette
      // annotation Turbopack trace le projet entier (bead ParisScorebis-r4g8).
      if (existsSync(/*turbopackIgnore: true*/ candidate)) add(candidate);
    } catch {
      // chemin illisible → racine suivante
    }
    const up = resolve(dir, "..");
    if (up === dir) break;
    dir = up;
  }
  return [...live, ...copies];
}

/**
 * Chemin d'un fichier de données, ou `null` s'il est absent de toutes les
 * racines. À utiliser partout où l'existence du fichier conditionne le
 * comportement (loader de snapshot) : c'est ce qui rend la lecture
 * multi-racines réellement détectrice, au lieu d'échouer sur la première
 * racine et de retomber bêtement sur `cwd`.
 */
export function resolveDataFile(relativePath: string): string | null {
  for (const root of dataDirCandidates()) {
    const file = join(/*turbopackIgnore: true*/ root, /*turbopackIgnore: true*/ relativePath);
    try {
      // turbopackIgnore : chemin assemblé à l'exécution (cf. dataDirCandidates).
      if (existsSync(/*turbopackIgnore: true*/ file)) return file;
    } catch {
      // racine illisible → suivante
    }
  }
  return null;
}

/**
 * Chemin d'un fichier de données ASSUMANT qu'il existe (lecteurs qui lisent
 * par `readFile` et remontent l'erreur eux-mêmes). Conserve la sémantique
 * `DATA_DIR || cwd/data` des lecteurs existants.
 */
export function getDataPath(relativePath: string): string {
  // turbopackIgnore sur les DEUX arguments : sans eux Turbopack trace le projet
  // entier (toutes les sources + public/) → build VPS tué pendant la phase de
  // tracing (exit 1, 0 erreur, aucune ligne « Collecting page data »).
  const root = process.env.DATA_DIR || join(process.cwd(), "data");
  return join(/*turbopackIgnore: true*/ root, /*turbopackIgnore: true*/ relativePath);
}