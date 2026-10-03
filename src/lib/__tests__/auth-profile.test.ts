import { describe, expect, test } from "bun:test";
import {
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  normalizeEmail,
  validatePassword,
  validateRegistration,
} from "@/lib/auth-profile";

const base = {
  email: "david.pion74@gmail.com",
  username: "davidoo372",
  password: "pariScore2026",
  confirmPassword: "pariScore2026",
};

describe("validateRegistration", () => {
  test("accepte un profil valide et normalise email/login", () => {
    const r = validateRegistration({
      ...base,
      email: "  David.Pion74@Gmail.COM ",
      username: "  Davidoo372 ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.email).toBe("david.pion74@gmail.com");
      expect(r.value.username).toBe("davidoo372");
    }
  });

  test("exige l'email", () => {
    const r = validateRegistration({ ...base, email: "" });
    expect(r.ok).toBe(false);
  });

  test("refuse un email malformé", () => {
    for (const email of ["pasunemail", "a@b", "a b@c.fr", "a@@b.fr"]) {
      expect(validateRegistration({ ...base, email }).ok).toBe(false);
    }
  });

  test("exige un login", () => {
    expect(validateRegistration({ ...base, username: "" }).ok).toBe(false);
  });

  test("borne la longueur du login", () => {
    expect(validateRegistration({ ...base, username: "a".repeat(MIN_USERNAME_LENGTH - 1) }).ok).toBe(false);
    expect(validateRegistration({ ...base, username: "a".repeat(MAX_USERNAME_LENGTH + 1) }).ok).toBe(false);
  });

  test("refuse les caractères dangerous dans le login", () => {
    for (const username of ["davidoo 372", "davidoo/372", "<script>", "davidoo@372"]) {
      expect(validateRegistration({ ...base, username }).ok).toBe(false);
    }
  });

  test("exige un mot de passe d'au moins 8 caractères avec lettre et chiffre", () => {
    expect(validateRegistration({ ...base, password: "a".repeat(MIN_PASSWORD_LENGTH - 1), confirmPassword: "a".repeat(MIN_PASSWORD_LENGTH - 1) }).ok).toBe(false);
    expect(validateRegistration({ ...base, password: "aaaaaaaaaaaa", confirmPassword: "aaaaaaaaaaaa" }).ok).toBe(false);
    expect(validateRegistration({ ...base, password: "1234567890", confirmPassword: "1234567890" }).ok).toBe(false);
    expect(validateRegistration({ ...base, password: "pariScore2026", confirmPassword: "pariScore2026" }).ok).toBe(true);
  });

  test("exige la confirmation et refuse une divergence", () => {
    expect(validateRegistration({ ...base, confirmPassword: "" }).ok).toBe(false);
    expect(validateRegistration({ ...base, confirmPassword: "autre1234" }).ok).toBe(false);
  });

  test("ne lève pas sur une entrée non objet", () => {
    for (const junk of [null, undefined, 42, "texte", []]) {
      expect(validateRegistration(junk).ok).toBe(false);
    }
  });
});

describe("normalizeEmail", () => {
  test("trim + minuscules", () => {
    expect(normalizeEmail("  A@B.FR ")).toBe("a@b.fr");
  });
});

describe("validatePassword (changement de mot de passe)", () => {
  test("applique exactement les memes regles que l'inscription", () => {
    expect(validatePassword("pariScore2026").ok).toBe(true);
    expect(validatePassword("").ok).toBe(false);
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1)).ok).toBe(false);
    expect(validatePassword("aaaaaaaaaaaa").ok).toBe(false);
    expect(validatePassword("123456789012").ok).toBe(false);
    expect(validatePassword("a1".repeat(120)).ok).toBe(false);
  });
});