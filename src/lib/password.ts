import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hachage de mot de passe — `node:crypto`, aucune dépendance.
 *
 * Pourquoi scrypt et pas bcrypt : bcrypt est une dépendance native absente de
 * l'allowlist (`package.json`) et demande une compilation. `scrypt` est dans la
 * stdlib, hors de question de dépendre d'un module natif pour hacher un mot de
 * passe ; les paramètres et le sel sont stockés DANS la chaîne, donc un ancien
 * hash reste vérifiable après un changement de coût.
 *
 * Format : `scrypt$N$r$p$selB64$hashB64`
 */

/** Longueur de la clé dérivée (octets). */
const KEY_LENGTH = 64;
/** Coût mémoire/CPU — 16 Mo, valeur recommandée par OWASP pour scrypt. */
const COST_N = 16384;
/** Facteur de parallélisation CPU. */
const COST_R = 8;
/** Facteur de parallélisation mémoire. */
const COST_P = 1;
/** Taille du sel (octets). */
const SALT_BYTES = 16;

/** Longueur maximale du mot de passe acceptée ( borne les entrées du formulaire). */
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Dérive un hash de mot de passe. Le sel est tiré aléatoirement à chaque appel :
 * deux mots de passe identiques ne produisent jamais la même chaîne.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: COST_N,
    r: COST_R,
    p: COST_P,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    String(COST_N),
    String(COST_R),
    String(COST_P),
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

/**
 * Vérifie un mot de passe contre un hash stocké.
 *
 * `timingSafeEqual` évite une fuite par timing sur la comparaison ; une chaîne
 * malformée (importée à la main, tronquée) renvoie `false` au lieu de lever.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (scheme !== "scrypt") return false;

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltRaw, "base64");
    expected = Buffer.from(hashRaw, "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 256 * 1024 * 1024,
    });
  } catch {
    // N hors bornes du noyau : hash inexploitable, on refuse l'accès.
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}