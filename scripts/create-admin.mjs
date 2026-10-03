/**
 * create-admin.mjs — crée (ou promeut) un profil admin.
 *
 * Usage :
 *   bun scripts/create-admin.mjs --email a@b.fr --username login
 *   bun scripts/create-admin.mjs --email a@b.fr --username login --generate
 *
 * `--generate` génère un mot de passe fort et ne l'affiche QU'UNE FOIS. Sans
 * cette option, le mot de passe est lu dans ADMIN_PASSWORD (ou prompt interactif
 * absent : le script échoue, il ne devine jamais).
 *
 * Pourquoi un script et pas une route HTTP : un endpoint qui dit « crée un
 * admin » est un takeover waiting to happen. Ici il faut un accès shell.
 *
 * Rappel : la route POST /api/v1/auth/register force `role: "freemium"` — un
 * visiteur ne peut pas s'auto-attribuer le rôle admin.
 */
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.ts";
import { validateRegistration } from "../src/lib/auth-profile.ts";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const has = (name) => process.argv.includes(`--${name}`);

/** Mot de passe fort : 24 caractères d'un alphabet sans ambiguïté (0/O, 1/l). */
function generatePassword() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Charge DATABASE_URL depuis le .env si la variable n'est pas déjà exportée. */
function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  for (const path of ["../.env", ".env"]) {
    if (!existsSync(path)) continue;
    const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(readFileSync(path, "utf8"));
    if (m) {
      process.env.DATABASE_URL = m[1].trim();
      return;
    }
  }
  throw new Error("DATABASE_URL introuvable (ni dans l'env, ni dans .env).");
}

const email = arg("email");
const username = arg("username");
const generated = has("generate");

if (!email || !username) {
  console.error("Usage : bun scripts/create-admin.mjs --email <email> --username <login> [--generate]");
  process.exit(1);
}

const password = generated ? generatePassword() : process.env.ADMIN_PASSWORD;

if (!password) {
  console.error(
    "Aucun mot de passe fourni. Utilise --generate pour en créer un,\n" +
      "ou renseigne ADMIN_PASSWORD dans l'environnement.",
  );
  process.exit(1);
}

// Mêmes règles que l'inscription HTTP, y compris la confirmation omise ici :
// le script est une opération d'administration, pas un formulaire.
const parsed = validateRegistration({ email, username, password, confirmPassword: password });
if (!parsed.ok) {
  console.error(`Refus : ${parsed.error}`);
  process.exit(1);
}

ensureDatabaseUrl();
const { email: cleanEmail, username: cleanUsername, password: cleanPassword } = parsed.value;
const passwordHash = hashPassword(cleanPassword);

const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });

let user;
let action;
if (existing) {
  // Compte déjà présent : on relève le rôle et on remet le hash, ce qui permet
  // aussi une réinitialisation de mot de passe depuis le shell.
  user = await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash, role: "admin", username: cleanUsername },
    select: { id: true, email: true, username: true, role: true },
  });
  action = existing.role === "admin" ? "admin mis à jour" : "compte promu admin";
} else {
  user = await prisma.user.create({
    data: { email: cleanEmail, username: cleanUsername, passwordHash, role: "admin", name: cleanUsername },
    select: { id: true, email: true, username: true, role: true },
  });
  action = "profil admin créé";
}

console.log(`${action} :`);
console.log(`  id       ${user.id}`);
console.log(`  email    ${user.email}`);
console.log(`  login    ${user.username}`);
console.log(`  role     ${user.role}`);
if (generated) {
  console.log("");
  console.log("MOT DE PASSE (affiché une seule fois) :");
  console.log(`  ${cleanPassword}`);
}

await prisma.$disconnect();