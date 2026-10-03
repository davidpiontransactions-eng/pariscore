import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { validateRegistration } from "@/lib/auth-profile";

/**
 * POST /api/v1/auth/register
 *
 * Création de profil — c'est la seule porte d'entrée d'un compte en base.
 * Body : { email, username, password, confirmPassword }
 *
 * Réponses : 201 profil créé · 400 données invalides · 409 email ou login déjà
 * pris · 429 trop de tentatives depuis la même IP.
 *
 * Le rôle n'est **jamais** pris dans le body : un visiteur pourrait s'octroyer
 * `admin` par une requête à la main. Il vaut `freemium`, et seul un script
 * d'administration peut l'élever (voir `scripts/create-admin.mjs`).
 */

/** Fenêtre de limitation : 15 minutes. */
const RATE_WINDOW_MS = 15 * 60 * 1000;
/** Créations autorisées par IP et par fenêtre. */
const RATE_MAX = 10;

/**
 * Compteur en mémoire par IP. Volontairement simple : ce n'est pas une
 * défense anti-abus face à un distribué, seulement un garde-fou contre le
 * bourrage d'un script ou d'un robot. Un vrai déploiement multi-instance
 * demanderait Redis.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "inconnu").trim();
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

// Purge périodique : sans ça la Map grossit à l'infini sur un process long.
if (typeof setInterval === "function") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, RATE_WINDOW_MS);
  // Ne pas maintenir le process en vie juste pour le timer (tests, scripts).
  timer.unref?.();
}

export async function POST(request: Request) {
  const key = clientKey(request);
  if (rateLimited(key)) {
    return NextResponse.json(
      { error: "Trop de créations de profil depuis cette adresse. Réessaie dans 15 minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = validateRegistration(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { email, username, password } = parsed.value;

  // Pré-check explicite pour un message clair ; la contrainte UNIQUE reste
  // l'arbitre final (deux inscriptions simultanées passeraient le pré-check).
  const [byEmail, byUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
  ]);
  if (byEmail) {
    return NextResponse.json({ error: "Un profil existe déjà pour cette adresse e-mail." }, { status: 409 });
  }
  if (byUsername) {
    return NextResponse.json({ error: "Ce login est déjà pris." }, { status: 409 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: hashPassword(password),
        role: "freemium",
        name: username,
      },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    // course entre deux inscriptions : P2002 = violation d'unicité Prisma
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Adresse e-mail ou login déjà utilisé." },
        { status: 409 },
      );
    }
    throw error;
  }
}