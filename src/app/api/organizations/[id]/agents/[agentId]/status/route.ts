import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";

const ALLOWED_STATUSES = ["READY", "ERROR", "PUBLISHED", "CREATING"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Неверный формат запроса", 400);
  }

  const newStatus = body.status as AllowedStatus | undefined;
  if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
    return jsonError(`Допустимые статусы: ${ALLOWED_STATUSES.join(", ")}`, 400);
  }

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
    select: { id: true },
  });
  if (!agent) return jsonError("Агент не найден", 404);

  await prisma.orgAgent.update({
    where: { id: agentId },
    data: { status: newStatus },
  });

  return jsonOk({ success: true, status: newStatus });
}
