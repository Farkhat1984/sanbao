import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body?.token) return jsonError("Токен не указан", 400);

  const invite = await prisma.orgInvite.findUnique({
    where: { token: body.token },
    include: { org: { select: { id: true, name: true, slug: true } } },
  });

  if (!invite) return jsonError("Приглашение не найдено", 404);
  if (invite.status !== "PENDING") return jsonError("Приглашение уже использовано", 410);
  if (invite.expiresAt < new Date()) {
    await prisma.orgInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return jsonError("Срок приглашения истёк", 410);
  }

  // Verify email matches
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return jsonError("Приглашение отправлено на другой email", 403);
  }

  // Check not already a member
  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: invite.orgId, userId } },
  });
  if (existing) {
    await prisma.orgInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });
    return jsonOk({ success: true, org: invite.org });
  }

  // Accept: create member + update invite in transaction
  await prisma.$transaction([
    prisma.orgMember.create({
      data: { orgId: invite.orgId, userId, role: invite.role },
    }),
    prisma.orgInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    }),
  ]);

  await logAudit({
    actorId: userId,
    action: "ACCEPT_INVITE",
    target: "Organization",
    targetId: invite.orgId,
  });

  return jsonOk(serializeDates({ success: true, org: invite.org }));
}
