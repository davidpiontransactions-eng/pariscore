import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validatePassword } from "@/lib/auth-profile";

/**
 * POST /api/v1/auth/password
 *
 * Change le mot de passe du profil **connecté**. Body :
 * { currentPassword, newPassword, confirmPassword }
 *
 * Réponses : 200 · 401 sans session · 400 données invalides · 403 si le profil
 * n'a pas de mot de passe (compte OAuth : aucun secret à changer) · 409 si le
 * mot de passe actuel ne correspond pas.
 *
 * Le mot de passe actuel est exigé : sans lui, une session volée suffit à
 * prendre le compte définitivement.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Session requise." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const raw = (body ?? {}) as { currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown };
  const currentPassword = typeof raw.currentPassword === "string" ? raw.currentPassword : "";
  const newPassword = typeof raw.newPassword === "string" ? raw.newPassword : "";
  const confirmPassword = typeof raw.confirmPassword === "string" ? raw.confirmPassword : "";

  const check = validatePassword(newPassword);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Les deux mots de passe ne correspondent pas." }, { status: 400 });
  }
  if (!currentPassword) {
    return NextResponse.json({ error: "Mot de passe actuel obligatoire." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "Ce profil utilise une connexion externe (Google/GitHub) : aucun mot de passe à changer." },
      { status: 403 },
    );
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 409 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  return NextResponse.json({ ok: true });
}