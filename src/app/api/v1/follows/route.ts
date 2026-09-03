import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/follows
 *
 * Récupère tous les follows de l'utilisateur connecté.
 * Retourne un tableau de follows au format UseFollowStore.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const follows = await prisma.follow.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Convertir au format UseFollowStore (Record<string, FollowEntry>)
  const followsRecord: Record<string, unknown> = {};
  for (const f of follows) {
    followsRecord[f.entityId] = {
      id: f.entityId,
      category: f.category,
      name: f.name,
      sport: f.sport,
      notifications: f.notifications,
      addedAt: f.createdAt.toISOString(),
    };
  }

  return NextResponse.json({ follows: followsRecord });
}

/**
 * POST /api/v1/follows
 *
 * Ajoute ou supprime un follow.
 * Body: { entityId, category, name, sport?, notifications? }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entityId, category, name, sport, notifications } = body;

  if (!entityId || !category || !name) {
    return NextResponse.json(
      { error: "Missing required fields: entityId, category, name" },
      { status: 400 }
    );
  }

  // Toggle : si existe déjà → supprimer, sinon → créer
  const existing = await prisma.follow.findUnique({
    where: { userId_entityId: { userId: session.user.id, entityId } },
  });

  if (existing) {
    await prisma.follow.delete({
      where: { id: existing.id },
    });
    return NextResponse.json({ action: "removed", entityId });
  }

  const follow = await prisma.follow.create({
    data: {
      userId: session.user.id,
      entityId,
      category,
      name,
      sport: sport ?? null,
      notifications: notifications ?? false,
    },
  });

  return NextResponse.json({ action: "added", follow });
}

/**
 * DELETE /api/v1/follows
 *
 * Supprime tous les follows de l'utilisateur.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.follow.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ action: "cleared" });
}
