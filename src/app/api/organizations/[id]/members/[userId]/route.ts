import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const roleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const actorId = result.auth.userId;
  const { id, userId: targetUserId } = await params;

  const memberResult = await requireOrgMember(id, actorId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return jsonError("Неверная роль", 400);

  // Can't change OWNER role
  const target = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: id, userId: targetUserId } },
  });
  if (!target) return jsonError("Участник не найден", 404);
  if (target.role === "OWNER") return jsonError("Нельзя изменить роль владельца", 403);

  // Only OWNER can promote to ADMIN
  if (parsed.data.role === "ADMIN" && memberResult.member.role !== "OWNER") {
    return jsonError("Только владелец может назначать администраторов", 403);
  }

  const updated = await prisma.orgMember.update({
    where: { orgId_userId: { orgId: id, userId: targetUserId } },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  await logAudit({
    actorId,
    action: "UPDATE",
    target: "OrgMember",
    targetId: updated.id,
    details: { role: parsed.data.role, targetUserId },
  });

  return jsonOk(serializeDates(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const actorId = result.auth.userId;
  const { id, userId: targetUserId } = await params;

  // Users can remove themselves; ADMIN+ can remove others
  if (actorId !== targetUserId) {
    const memberResult = await requireOrgMember(id, actorId, "ADMIN");
    if ("error" in memberResult) return memberResult.error;
  }

  const target = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: id, userId: targetUserId } },
  });
  if (!target) return jsonError("Участник не найден", 404);
  if (target.role === "OWNER") return jsonError("Нельзя удалить владельца", 403);

  await prisma.orgMember.delete({
    where: { orgId_userId: { orgId: id, userId: targetUserId } },
  });

  await logAudit({
    actorId,
    action: "DELETE",
    target: "OrgMember",
    targetId: target.id,
    details: { targetUserId },
  });

  return jsonOk({ success: true });
}
