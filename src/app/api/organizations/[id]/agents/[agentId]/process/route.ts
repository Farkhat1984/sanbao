import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { processProject } from "@/lib/ai-cortex-client";
import { logAudit } from "@/lib/audit";

export async function POST(
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
  });
  if (!agent) return jsonError("Агент не найден", 404);
  if (!agent.projectId) return jsonError("Проект не создан", 400);

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org?.nsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(org.nsApiKey);

  try {
    await processProject(nsApiKey, agent.projectId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка обработки";
    await prisma.orgAgent.update({
      where: { id: agentId },
      data: { status: "ERROR" },
    });
    return jsonError(msg, 502);
  }

  await prisma.orgAgent.update({
    where: { id: agentId },
    data: { status: "PROCESSING" },
  });

  await logAudit({
    actorId: userId,
    action: "PROCESS",
    target: "OrgAgent",
    targetId: agentId,
  });

  return jsonOk({ success: true, status: "PROCESSING" });
}
