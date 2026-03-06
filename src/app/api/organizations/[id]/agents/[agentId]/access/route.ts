import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { z } from "zod";

const accessSchema = z.object({
  accessMode: z.enum(["ALL_MEMBERS", "SPECIFIC"]),
  memberUserIds: z.array(z.string()).max(100).optional().default([]),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
    select: {
      id: true,
      accessMode: true,
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
  });
  if (!agent) return jsonError("Агент не найден", 404);

  return jsonOk(serializeDates(agent));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = accessSchema.safeParse(body);
  if (!parsed.success) return jsonError("Ошибка валидации", 400);

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
  });
  if (!agent) return jsonError("Агент не найден", 404);

  await prisma.$transaction(async (tx) => {
    await tx.orgAgent.update({
      where: { id: agentId },
      data: { accessMode: parsed.data.accessMode },
    });

    if (parsed.data.accessMode === "SPECIFIC") {
      // Sync members
      await tx.orgAgentMember.deleteMany({ where: { orgAgentId: agentId } });
      if (parsed.data.memberUserIds.length > 0) {
        await tx.orgAgentMember.createMany({
          data: parsed.data.memberUserIds.map((uid) => ({
            orgAgentId: agentId,
            userId: uid,
          })),
        });
      }
    } else {
      // ALL_MEMBERS: clear specific list
      await tx.orgAgentMember.deleteMany({ where: { orgAgentId: agentId } });
    }
  });

  return jsonOk({ success: true });
}
