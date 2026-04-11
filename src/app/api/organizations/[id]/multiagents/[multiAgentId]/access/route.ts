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
  { params }: { params: Promise<{ id: string; multiAgentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, multiAgentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const multiAgent = await prisma.multiAgent.findFirst({
    where: { id: multiAgentId, orgId: id },
    select: {
      id: true,
      accessMode: true,
      userAccess: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
  });
  if (!multiAgent) return jsonError("Мультиагент не найден", 404);

  return jsonOk(serializeDates({
    id: multiAgent.id,
    accessMode: multiAgent.accessMode,
    members: multiAgent.userAccess.map((ua) => ({
      id: ua.id,
      userId: ua.userId,
      user: ua.user,
    })),
  }));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; multiAgentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, multiAgentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = accessSchema.safeParse(body);
  if (!parsed.success) return jsonError("Ошибка валидации", 400);

  const multiAgent = await prisma.multiAgent.findFirst({
    where: { id: multiAgentId, orgId: id },
  });
  if (!multiAgent) return jsonError("Мультиагент не найден", 404);

  await prisma.$transaction(async (tx) => {
    await tx.multiAgent.update({
      where: { id: multiAgentId },
      data: { accessMode: parsed.data.accessMode },
    });

    if (parsed.data.accessMode === "SPECIFIC") {
      await tx.multiAgentUserAccess.deleteMany({ where: { multiAgentId } });
      if (parsed.data.memberUserIds.length > 0) {
        await tx.multiAgentUserAccess.createMany({
          data: parsed.data.memberUserIds.map((uid) => ({
            multiAgentId,
            userId: uid,
          })),
        });
      }
    } else {
      await tx.multiAgentUserAccess.deleteMany({ where: { multiAgentId } });
    }
  });

  return jsonOk({ success: true });
}
