import { requireAuth, jsonOk, jsonError, jsonValidationError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { orgUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId);
  if ("error" in memberResult) return memberResult.error;

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true, agents: true } },
      owner: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (!org) return jsonError("Организация не найдена", 404);

  return jsonOk(serializeDates({
    ...org,
    role: memberResult.member.role,
    memberCount: org._count.members,
    agentCount: org._count.agents,
  }));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = orgUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  const org = await prisma.organization.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    actorId: userId,
    action: "UPDATE",
    target: "Organization",
    targetId: id,
    details: parsed.data,
  });

  return jsonOk(serializeDates(org));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId, "OWNER");
  if ("error" in memberResult) return memberResult.error;

  await prisma.organization.delete({ where: { id } });

  await logAudit({
    actorId: userId,
    action: "DELETE",
    target: "Organization",
    targetId: id,
  });

  return jsonOk({ success: true });
}
