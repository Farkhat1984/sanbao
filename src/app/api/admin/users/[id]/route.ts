import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();
  const { role, planSlug, isBanned, bannedReason } = body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Ban / unban
  if (isBanned !== undefined) {
    await prisma.user.update({
      where: { id },
      data: {
        isBanned: !!isBanned,
        bannedAt: isBanned ? new Date() : null,
        bannedReason: isBanned ? (bannedReason || null) : null,
      },
    });
  }

  if (role && ["USER", "PRO", "ADMIN"].includes(role)) {
    await prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  if (planSlug) {
    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    await prisma.subscription.upsert({
      where: { userId: id },
      create: {
        userId: id,
        planId: plan.id,
        grantedBy: result.userId,
      },
      update: {
        planId: plan.id,
        grantedBy: result.userId,
      },
    });
  }

  const updated = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      subscription: {
        select: {
          plan: { select: { slug: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;

  if (id === result.userId) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
