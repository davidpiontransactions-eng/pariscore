import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword, MAX_PASSWORD_LENGTH } from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
  test("un mot de passe se relit correctement", () => {
    const hash = hashPassword("pariScore2026");
    expect(verifyPassword("pariScore2026", hash)).toBe(true);
  });

  test("le sel rend le hachage non déterministe", () => {
    expect(hashPassword("pariScore2026")).not.toBe(hashPassword("pariScore2026"));
  });

  test("un mauvais mot de passe est refusé", () => {
    const hash = hashPassword("pariScore2026");
    expect(verifyPassword("pariscore2026", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  test("le format stocke les paramètres scrypt (migration de coût possible)", () => {
    const [scheme, n, r, p, salt, hash] = hashPassword("pariScore2026").split("$");
    expect(scheme).toBe("scrypt");
    expect(n).toBe("16384");
    expect(r).toBe("8");
    expect(p).toBe("1");
    expect(Buffer.from(salt, "base64").length).toBe(16);
    expect(Buffer.from(hash, "base64").length).toBe(64);
  });

  test("un hash corrompu est refusé sans lever", () => {
    const hash = hashPassword("pariScore2026");
    for (const broken of [
      "",
      "bcrypt$10$abc",
      "scrypt$abc$8$1$c2FsdA==$aGFzaA==",
      "scrypt$16384$8$1$$",
      "scrypt$999999999999$8$1$c2FsdA==$aGFzaA==",
    ]) {
      expect(verifyPassword("pariScore2026", broken)).toBe(false);
    }
  });

  test("le mot de passe en clair n'apparaît jamais dans le hash", () => {
    expect(hashPassword("pariScore2026")).not.toContain("pariScore2026");
  });

  test("un mot de passe à la longueur max est accepté", () => {
    const long = "a1".repeat(MAX_PASSWORD_LENGTH / 2);
    expect(verifyPassword(long, hashPassword(long))).toBe(true);
  });
});