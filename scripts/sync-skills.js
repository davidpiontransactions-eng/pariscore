#!/usr/bin/env node
/**
 * sync-skills.js — Synchronise l'allowlist OpenCode depuis la source unique .agents/tools/.
 *
 * Architecture multi-plateforme :
 *   - .agents/tools/      = source unique (lue par ZCode ET OpenCode via junction)
 *   - .opencode/skills/   = junction Windows vers .agents/tools/ (créée une fois)
 *   - opencode.json clé "skill" = allowlist explicite des 145 skills
 *
 * Ce script régénère l'allowlist opencode.json à partir du contenu réel de
 * .agents/tools/. À lancer après chaque ajout/suppression de skill pour garder
 * OpenCode synchronisé.
 *
 * Portage Node.js (runtime officiel du projet) — l'ancien sync-skills.py est
 * conservé à titre indicatif mais Python n'est pas disponible sur tous les postes.
 *
 * Usage :
 *   node scripts/sync-skills.js            # met à jour opencode.json
 *   node scripts/sync-skills.js --check    # vérifie seulement (exit 1 si désynchronisé)
 *   node scripts/sync-skills.js --verify-junction  # vérifie que la junction est active
 */
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const AGENTS_TOOLS = path.join(PROJECT_ROOT, ".agents", "tools");
const OPENCODE_SKILLS = path.join(PROJECT_ROOT, ".opencode", "skills");
const OPENCODE_JSON = path.join(PROJECT_ROOT, "opencode.json");

/**
 * Liste les noms de skills (dossiers contenant un SKILL.md).
 * @param {string} skillsDir
 * @returns {string[]}
 */
function listSkills(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir)
    .filter((name) => {
      const full = path.join(skillsDir, name);
      try {
        return (
          fs.statSync(full).isDirectory() &&
          fs.existsSync(path.join(full, "SKILL.md"))
        );
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Vérifie que .opencode/skills pointe vers .agents/tools et que le contenu correspond.
 * @returns {boolean}
 */
function verifyJunction() {
  if (!fs.existsSync(OPENCODE_SKILLS)) {
    console.log("❌ .opencode/skills/ n'existe pas (junction manquante)");
    console.log("   Crée-la avec :");
    console.log(
      '   cmd //c "mklink /J C:\\...\\pariscore\\.opencode\\skills C:\\...\\pariscore\\.agents\\tools"'
    );
    return false;
  }

  const sourceSkills = listSkills(AGENTS_TOOLS);
  const ocSkills = listSkills(OPENCODE_SKILLS);

  const sourceStr = JSON.stringify(sourceSkills);
  const ocStr = JSON.stringify(ocSkills);
  if (sourceStr !== ocStr) {
    console.log("⚠️  Désynchronisation détectée :");
    console.log(`   Source .agents/tools/ : ${sourceSkills.length} skills`);
    console.log(`   Junction .opencode/skills/ : ${ocSkills.length} skills`);
    if (sourceSkills.length > ocSkills.length) {
      const missing = sourceSkills.filter((s) => !ocSkills.includes(s));
      console.log(`   Manquants côté junction : ${JSON.stringify(missing)}`);
    }
    return false;
  }

  console.log(
    `✓ Junction active — ${sourceSkills.length} skills visibles des deux côtés`
  );
  return true;
}

/**
 * Met à jour la clé 'skill' dans opencode.json.
 * @param {boolean} dryRun
 * @returns {number} code de sortie
 */
function updateAllowlist(dryRun = false) {
  const sourceSkills = listSkills(AGENTS_TOOLS);
  if (sourceSkills.length === 0) {
    console.log("❌ Aucun skill trouvé dans .agents/tools/");
    return 1;
  }

  if (!fs.existsSync(OPENCODE_JSON)) {
    console.log(`❌ ${OPENCODE_JSON} introuvable`);
    return 1;
  }

  const config = JSON.parse(fs.readFileSync(OPENCODE_JSON, "utf-8"));
  const oldSkills = Array.isArray(config.skill) ? config.skill : [];
  const oldCount = oldSkills.length;

  const newSet = new Set(sourceSkills);
  const oldSet = new Set(oldSkills);
  const added = sourceSkills.filter((x) => !oldSet.has(x));
  const removed = oldSkills.filter((x) => !newSet.has(x));

  if (dryRun) {
    console.log("Vérification (dry-run) :");
    console.log(`  Source : ${sourceSkills.length} skills`);
    console.log(`  Allowlist actuelle : ${oldCount} skills`);
    if (added.length)
      console.log(
        `  À ajouter (${added.length}) : ${JSON.stringify(added.slice(0, 10))}${
          added.length > 10 ? "..." : ""
        }`
      );
    if (removed.length)
      console.log(
        `  À retirer (${removed.length}) : ${JSON.stringify(removed.slice(0, 10))}${
          removed.length > 10 ? "..." : ""
        }`
      );
    if (!added.length && !removed.length) {
      console.log("  ✓ Allowlist déjà synchronisée");
      return 0;
    }
    return 1;
  }

  if (!added.length && !removed.length) {
    console.log(`✓ Allowlist déjà synchronisée (${oldCount} skills)`);
    return 0;
  }

  config.skill = sourceSkills;
  fs.writeFileSync(OPENCODE_JSON, JSON.stringify(config, null, 2) + "\n", "utf-8");

  console.log(
    `✓ opencode.json mis à jour : ${oldCount} → ${sourceSkills.length} skills`
  );
  if (added.length) console.log(`  + ${added.length} ajouté(s)`);
  if (removed.length) console.log(`  - ${removed.length} retiré(s)`);
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--verify-junction")) {
    process.exit(verifyJunction() ? 0 : 1);
  }
  if (args.includes("--check")) {
    process.exit(updateAllowlist(true));
  }
  process.exit(updateAllowlist(false));
}

main();
