import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();
  const { role, planSlug, isBanned, bannedReason } = body;

  // Validate inputs
  if (role !== undefined && !["USER", "ADMIN"].includes(role)) {
    return jsonError("Invalid role", 400);
  }
  if (bannedReason !== undefined && typeof bannedReason === "string" && bannedReason.length > 500) {
    return jsonError("bannedReason too long (max 500)", 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return jsonError("User not found", 404);
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

  if (role && ["USER", "ADMIN"].includes(role)) {
    await prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  if (planSlug) {
    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) {
      return jsonError("Plan not found", 404);
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

  return jsonOk(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;

  if (id === result.userId) {
    return jsonError("Cannot delete yourself", 400);
  }

  await prisma.user.delete({ where: { id } });
  return jsonOk({ success: true });
}
