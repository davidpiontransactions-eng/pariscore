#!/usr/bin/env node
/**
 * scripts/pre-deploy-check.js — Vérifications pré-déploiement du système de prédictions
 *
 * Lance 10 vérifications critiques avant chaque déploiement.
 * Sortie 0 si tout passe, 1 si au moins un check échoue.
 *
 * Usage: node scripts/pre-deploy-check.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "pariscore.db");
const MODELS_DIR = path.join(ROOT, "models");

let passed = 0;
let failed = 0;
const results = [];

function check(label, fn) {
  try {
    const detail = fn();
    passed++;
    results.push({ ok: true, label, detail });
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    failed++;
    results.push({ ok: false, label, detail: e.message });
    console.log(`  ✗ ${label} — ${e.message}`);
  }
}

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    stdio: "pipe",
    timeout: opts.timeout || 120_000,
    env: { ...process.env, ...opts.env },
    encoding: "utf-8",
  }).trim();
}

console.log("");
console.log("  Pré-deploy checks pour le système de prédictions");
console.log("  ─────────────────────────────────────────────────");

// ── 1. [DB] pariscore.db existe et contient kv['history_matches'] ────────────
check("[DB] pariscore.db existe", () => {
  if (!fs.existsSync(DB_PATH)) throw new Error(`${DB_PATH} introuvable`);
  return `trouvé (${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB)`;
});

check("[DB] kv['history_matches'] existe", () => {
  const Database = require("better-sqlite3");
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db.prepare("SELECT value FROM kv WHERE key = ?").get("history_matches");
    if (!row) throw new Error("clé 'history_matches' absente de la table kv");
    let count = 0;
    try {
      const data = JSON.parse(row.value);
      count = Array.isArray(data) ? data.length : 0;
    } catch { /* value n'est pas un JSON array */ }
    return `${count} match${count !== 1 ? "s" : ""} historiques`;
  } finally {
    db.close();
  }
});

// ── 2. [Models] 3 fichiers .cbm dans models/ ────────────────────────────────
check("[Models] 3 fichiers .cbm présents", () => {
  const required = ["catboost_football_1x2_v1.cbm", "catboost_football_over25_v1.cbm", "catboost_football_btts_v1.cbm"];
  if (!fs.existsSync(MODELS_DIR)) throw new Error(`dossier ${MODELS_DIR} introuvable`);
  const missing = required.filter((f) => !fs.existsSync(path.join(MODELS_DIR, f)));
  if (missing.length > 0) throw new Error(`manquants : ${missing.join(", ")}`);
  return required.map((f) => {
    const s = fs.statSync(path.join(MODELS_DIR, f)).size;
    return `${f} (${(s / 1024).toFixed(0)} KB)`;
  }).join(", ");
});

// ── 3. [Python] module catboost importable ───────────────────────────────────
check("[Python] catboost importable", () => {
  const py = process.platform === "win32" ? "python" : "python3";
  try {
    const ver = run(`${py} -c "import catboost; print(catboost.__version__)"`, { timeout: 15_000 });
    return `v${ver}`;
  } catch {
    throw new Error("catboost non installé (pip install catboost)");
  }
});

// ── 4. [Env] CATBOOST_ENABLED défini ────────────────────────────────────────
check("[Env] CATBOOST_ENABLED dans .env", () => {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) throw new Error(".env introuvable");
  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(/^CATBOOST_ENABLED=(.+)$/m);
  if (!match) throw new Error("CATBOOST_ENABLED absent de .env");
  if (match[1].trim() !== "true") throw new Error(`CATBOOST_ENABLED=${match[1].trim()} (attendu: true)`);
  return "true";
});

// ── 5. [TypeScript] typecheck passe ─────────────────────────────────────────
check("[TypeScript] typecheck passe", () => {
  run("bun run typecheck", { timeout: 120_000 });
  return "0 erreurs";
});

// ── 6. [Lint] lint passe ────────────────────────────────────────────────────
check("[Lint] lint passe", () => {
  run("bun run lint", { timeout: 120_000 });
  return "0 erreurs";
});

// ── 7. [Tests] tous les tests passent ───────────────────────────────────────
check("[Tests] tous les tests passent", () => {
  run("bun run test", { timeout: 180_000 });
  return "tous passent";
});

// ── 8. [Build] next build réussit ───────────────────────────────────────────
check("[Build] next build réussit", () => {
  run("bun run build", { timeout: 300_000 });
  return "succès";
});

// ── 9. [Prisma] schéma valide + client généré ───────────────────────────────
check("[Prisma] schéma valide + client généré", () => {
  run("npx prisma validate", { timeout: 30_000 });
  const clientDir = path.join(ROOT, "node_modules", ".prisma", "client");
  if (!fs.existsSync(clientDir)) throw new Error("client Prisma non généré (npx prisma generate)");
  return "valide + généré";
});

// ── Résumé ──────────────────────────────────────────────────────────────────
console.log("");
console.log("  ─────────────────────────────────────────────────");
console.log(`  Résumé : ${passed}/${passed + failed} vérifications passées`);

if (failed > 0) {
  console.log("");
  console.log("  ✗ ÉCHEC — déploiement déconseillé");
  console.log("");
  process.exit(1);
} else {
  console.log("");
  console.log("  ✓ TOUS LES CHECKS PASSENT — prêt pour le déploiement");
  console.log("");
  process.exit(0);
}
