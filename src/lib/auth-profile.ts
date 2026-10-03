/**
 * Création de profil — règles de validation pures.
 *
 * Isolé du route handler pour deux raisons : la validation est la frontière de
 * confiance (frontière HTTP = entrée utilisateur non fiable, on ne la raccourcit
 * pas), et elle doit être testable sans base ni serveur.
 */

/** Longueur minimale du mot de passe. */
export const MIN_PASSWORD_LENGTH = 8;
/** Longueur minimale du login. */
export const MIN_USERNAME_LENGTH = 3;
/** Longueur maximale du login. */
export const MAX_USERNAME_LENGTH = 24;
/** Rôles reconnus. Tout autre rôle est refusé à l'inscription. */
export const ROLES = ["freemium", "admin"] as const;

export type Role = (typeof ROLES)[number];

export type RegistrationInput = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

export type ValidationResult =
  | { ok: true; value: { email: string; username: string; password: string } }
  | { ok: false; error: string };

/** Login : minuscules, lettres/chiffres/point/tiret/underscore uniquement. */
const USERNAME_RE = /^[a-z0-9._-]+$/;
/** Contrôle d'email volontairement simple : un seul `@`, pas d'espace. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Normalise un email : trim + minuscules (la colonne est `unique`). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Règles de mot de passe — partagées par l'inscription et le changement.
 *
 * Lettre + chiffre : « aaaaaaaaaaaa » est refusé. 8 minimum : en dessous, un
 * mot de passe n'est qu'un nom d'utilisateur deviné.
 */
export function validatePassword(password: string): { ok: true } | { ok: false; error: string } {
  if (!password) return { ok: false, error: "Mot de passe obligatoire." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum.` };
  }
  if (password.length > 200) {
    return { ok: false, error: "Mot de passe : 200 caractères maximum." };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: "Mot de passe : il faut au moins une lettre et un chiffre." };
  }
  return { ok: true };
}

/**
 * Valide une demande d'inscription.
 *
 * `confirmPassword` est exigé : sans confirmation, une faute de frappe crée un
 * profil que l'utilisateur ne peut plus rejoindre. Toutes les vérifications sont
 * cumulatives et le premier échec est renvoyé — un message unique n'indique pas
 * quel champ est pris, mais évite d'énumérer les contraintes du système.
 */
export function validateRegistration(input: unknown): ValidationResult {
  const raw = (input ?? {}) as Partial<RegistrationInput>;
  const email = normalizeEmail(asString(raw.email));
  const username = asString(raw.username).trim().toLowerCase();
  const password = asString(raw.password);
  const confirmPassword = asString(raw.confirmPassword);

  if (!email) return { ok: false, error: "Adresse e-mail obligatoire." };
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Adresse e-mail invalide." };
  }

  if (!username) return { ok: false, error: "Login obligatoire." };
  if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
    return {
      ok: false,
      error: `Login : entre ${MIN_USERNAME_LENGTH} et ${MAX_USERNAME_LENGTH} caractères.`,
    };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "Login : minuscules, chiffres, point, tiret et underscore uniquement.",
    };
  }

  if (!password) return { ok: false, error: "Mot de passe obligatoire." };
  const pwd = validatePassword(password);
  if (!pwd.ok) return pwd;

  if (password !== confirmPassword) {
    return { ok: false, error: "Les deux mots de passe ne correspondent pas." };
  }

  return { ok: true, value: { email, username, password } };
}

/** Vrai si la valeur est un rôle reconnu. Garde-fou avant écriture en base. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}