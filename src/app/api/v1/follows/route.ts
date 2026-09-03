import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/follows?userId=xxx
 *
 * Récupère tous les follows d'un utilisateur.
 * Retourne un objet { follows: Record<string, FollowEntry> }.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const follows = await prisma.follow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

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
 * Toggle un follow (ajoute si absent, retire si présent).
 * Body: { userId, entityId, category, name, sport?, notifications? }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { userId, entityId, category, name, sport, notifications } = body;

  if (!userId || !entityId || !category || !name) {
    return NextResponse.json(
      { error: "Missing required fields: userId, entityId, category, name" },
      { status: 400 }
    );
  }

  const existing = await prisma.follow.findUnique({
    where: { userId_entityId: { userId, entityId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return NextResponse.json({ action: "removed", entityId });
  }

  const follow = await prisma.follow.create({
    data: {
      userId,
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
 * DELETE /api/v1/follows?userId=xxx
 *
 * Supprime tous les follows d'un utilisateur.
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await prisma.follow.deleteMany({ where: { userId } });

  return NextResponse.json({ action: "cleared" });
}
