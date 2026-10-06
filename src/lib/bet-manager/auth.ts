// Auth partagée des routes /api/v1/bm/* — session NextAuth obligatoire.
// Avant cette couche, les 7 routes étaient ouvertes sans aucune vérification
// (constat entrée spec §3, phase P2 du plan bettrack).
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/** Retourne une réponse 401 si aucune session ; null si l'accès est autorisé. */
export async function requireBmSession(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  return null;
}
